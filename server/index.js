const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { Op, literal } = require('sequelize');
const { connectDB, sequelize } = require('./db');
const {
  Admin,
  Profile,
  Work,
  Service,
  Booking,
  Setting,
  News,
  User,
  MessageTemplate,
  Broadcast
} = require('./models');
const {
  notifyBookingCreated,
  notifyBookingStatusChange,
  sendTestMessage,
  resolveCredentials: resolveLineCredentials
} = require('./line');
const {
  ensureDefaultTemplates,
  renderFromTemplate,
  defaultSampleVars
} = require('./messageTemplates');
const { verifySignature, handleEvent: handleWebhookEvent } = require('./lineWebhook');
const {
  resolveLoginCredentials,
  buildState,
  verifyState,
  buildAuthorizeUrl,
  exchangeCode,
  fetchProfile: fetchLineProfile,
  verifyIdToken,
  upsertLineUser
} = require('./lineAuth');
const {
  getDayAvailability,
  getMonthAvailability,
  validateBookingSlot
} = require('./availability');

const app = express();
const PORT = process.env.PORT || 4000;

// JWT_SECRET：生產環境必須由環境變數提供（spec §9.1）
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is required in production.');
    process.exit(1);
  }
  JWT_SECRET = 'dev-only-' + crypto.randomBytes(16).toString('hex');
  console.warn('WARNING: JWT_SECRET not set. Using ephemeral dev secret (tokens expire on restart).');
}

const JWT_ADMIN_AUDIENCE = 'la-paisley-admin';
const JWT_CUSTOMER_AUDIENCE = 'la-paisley-customer';

// 信任 Render / Cloudflare 的 X-Forwarded-For，讓 rate limit 抓得到真實 IP
app.set('trust proxy', 1);

// CORS 白名單
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // 同源 / curl / server-to-server
    if (ALLOWED_ORIGINS.length === 0) return cb(null, true); // 未設定 = 不限（開發用）
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    // LIFF 內嵌頁面從 line.me / liff.line.me 開啟
    if (/^https:\/\/[a-z0-9-]+\.line(-apps)?\.(me|com)$/i.test(origin)) return cb(null, true);
    return cb(new Error(`CORS not allowed: ${origin}`));
  },
  credentials: true
}));

// 捕捉 raw body 給 LINE webhook 做 HMAC 簽章驗證
app.use(express.json({
  limit: '25mb',
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));

// ============ Rate Limiters ============

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '登入嘗試過於頻繁，請稍候再試' }
});

const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '預約請求過於頻繁，請稍候再試' }
});

const lineAuthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'LINE 授權請求過於頻繁，請稍候再試' }
});

async function initAdmin() {
  const existing = await Admin.findOne({ where: { username: 'admin' } });
  if (!existing) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await Admin.create({ username: 'admin', password: hashedPassword });
    console.log('Admin initialized - username: admin, password: admin123');
  }
}

async function initSettings() {
  const existing = await Setting.findOne();
  if (!existing) {
    await Setting.create({});
    console.log('Settings initialized with defaults');
  }
}

function adminMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未授權' });
  try {
    req.user = jwt.verify(token, JWT_SECRET, { audience: JWT_ADMIN_AUDIENCE });
    next();
  } catch {
    res.status(401).json({ error: 'Token 無效或已過期' });
  }
}

// 別名：保留向後相容（其他 handler 仍呼叫 authMiddleware）
const authMiddleware = adminMiddleware;

async function customerMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '請先以 LINE 登入' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { audience: JWT_CUSTOMER_AUDIENCE });
    const user = await User.findByPk(decoded.sub);
    if (!user) return res.status(401).json({ error: '帳號不存在' });
    if (user.blocked) return res.status(403).json({ error: '此帳號已被停用' });
    req.user = user;
    req.userId = user.id;
    next();
  } catch {
    res.status(401).json({ error: 'Token 無效或已過期' });
  }
}

function signCustomerToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      lineUserId: user.lineUserId || null,
      displayName: user.displayName
    },
    JWT_SECRET,
    { expiresIn: '7d', audience: JWT_CUSTOMER_AUDIENCE }
  );
}

// ============ LINE Webhook ============
//
// 必須放在 cors / json 設定之後，但**不**套 rate limiter（LINE 平台會頻繁打）。
// 我們在 express.json 設了 verify 函式把 raw body 存到 req.rawBody，用來
// 做 HMAC 簽章驗證。
//
// 流程：驗簽 → 立刻回 200 → 非同步處理每筆 event。
app.post('/api/line/webhook', async (req, res) => {
  const signature = req.headers['x-line-signature'];
  const { channelSecret } = await resolveLineCredentials();
  if (!verifySignature(req.rawBody, signature, channelSecret)) {
    console.warn('[webhook] invalid signature');
    return res.status(401).end();
  }
  res.status(200).end();
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  for (const event of events) {
    handleWebhookEvent(event).catch(err =>
      console.error('[webhook] event error:', err?.message || err)
    );
  }
});

// ============ Health ============

app.get('/api/health', async (req, res) => {
  const startedAt = Date.now();
  let dbOk = false;
  try {
    await Setting.findOne({ attributes: ['id'] });
    dbOk = true;
  } catch (err) {
    console.error('[health] db check failed:', err.message);
  }
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    uptime: process.uptime(),
    db: dbOk,
    responseTimeMs: Date.now() - startedAt,
    version: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || 'dev'
  });
});

// ============ Public API ============

app.get('/api/profile', async (req, res) => {
  const profile = await Profile.findOne();
  res.json(profile || {});
});

app.get('/api/works', async (req, res) => {
  const works = await Work.findAll({ order: [['id', 'DESC']] });
  res.json(works);
});

app.get('/api/services', async (req, res) => {
  const services = await Service.findAll({ order: [['order', 'ASC'], ['id', 'ASC']] });
  res.json(services);
});

app.get('/api/news', async (req, res) => {
  const items = await News.findAll({
    where: { published: true },
    order: [['pinned', 'DESC'], ['publishedAt', 'DESC'], ['id', 'DESC']],
    limit: 20
  });
  res.json(items);
});

app.get('/api/public-settings', async (req, res) => {
  const s = await Setting.findOne();
  if (!s) return res.json({});
  res.json({
    businessName: s.businessName,
    businessHours: s.businessHours,
    bookingNote: s.bookingNote,
    bookingEnabled: s.bookingEnabled,
    lineLoginRequired: s.lineLoginRequired !== false,
    lineLiffId: s.lineLiffId || process.env.LINE_LIFF_ID || '',
    googleAnalyticsId: s.googleAnalyticsId || ''
  });
});

app.get('/api/availability/month', async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ error: '請提供有效的 year 與 month' });
  }
  const data = await getMonthAvailability(year, month, req.query.service);
  res.json(data);
});

app.get('/api/availability/day', async (req, res) => {
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: '請提供 YYYY-MM-DD 格式的日期' });
  }
  const data = await getDayAvailability(date, req.query.service);
  res.json(data);
});

app.post('/api/bookings', bookingLimiter, async (req, res) => {
  const settings = await Setting.findOne();
  const requireLogin = settings?.lineLoginRequired !== false; // D1

  // 嘗試解析 customer JWT（依設定可選）
  let user = null;
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, { audience: JWT_CUSTOMER_AUDIENCE });
      user = await User.findByPk(decoded.sub);
      if (user?.blocked) return res.status(403).json({ error: '此帳號已被停用' });
    } catch {
      // token 無效 → 視為未登入
    }
  }

  if (requireLogin && !user) {
    return res.status(401).json({
      error: '請先以 LINE 登入再預約',
      code: 'LINE_LOGIN_REQUIRED'
    });
  }

  const { name, phone, lineId, service, date, time, notes } = req.body || {};
  const effectiveName = name || user?.displayName;
  const effectiveLineId = user?.lineUserId || (lineId ? String(lineId).trim() : '');

  if (!effectiveName || !phone || !service || !date || !time) {
    return res.status(400).json({ error: '請完整填寫姓名、電話、項目、日期與時間' });
  }

  const dateStr = String(date).trim();
  const timeStr = String(time).trim();
  const serviceStr = String(service).trim();
  const phoneStr = String(phone).trim();

  const check = await validateBookingSlot({ date: dateStr, time: timeStr, service: serviceStr });
  if (!check.ok) {
    return res.status(400).json({ error: check.error });
  }

  const booking = await Booking.create({
    name: String(effectiveName).trim(),
    phone: phoneStr,
    lineId: effectiveLineId,
    userId: user?.id || null,
    service: serviceStr,
    date: dateStr,
    time: timeStr,
    durationMinutes: check.duration,
    notes: notes ? String(notes).trim() : '',
    source: 'customer_self',
    status: 'pending'
  });

  // 補登用戶電話（首次預約時）
  if (user && !user.phone && phoneStr) {
    await user.update({ phone: phoneStr });
  }

  // 走訊息模板系統推播（客戶 + 店家 Flex with action buttons）
  notifyBookingCreated(booking, user).catch(err => console.error('[LINE] notify error:', err));

  res.status(201).json({
    id: booking.id,
    message: '預約已送出，我們會盡快與您確認時段 💌'
  });
});

// ============ Auth API ============

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ where: { username } });
  if (!admin) return res.status(401).json({ error: '帳號或密碼錯誤' });

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) return res.status(401).json({ error: '帳號或密碼錯誤' });

  const token = jwt.sign(
    { username, sub: String(admin.id) },
    JWT_SECRET,
    { expiresIn: '24h', audience: JWT_ADMIN_AUDIENCE }
  );
  res.json({ token, username });
});

app.get('/api/auth/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, username: req.user.username });
});

// ============ Customer Auth (LINE Login) ============

// Step 1: 客戶點「LINE 登入」 → 後端 302 到 LINE 授權頁
app.get('/api/auth/line/authorize', lineAuthLimiter, async (req, res) => {
  try {
    const { channelId, callbackUrl } = await resolveLoginCredentials();
    if (!channelId || !callbackUrl) {
      return res.status(500).json({ error: 'LINE Login 尚未設定，請聯絡管理員' });
    }
    const returnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : '/';
    const state = buildState(JWT_SECRET, returnTo);
    const url = buildAuthorizeUrl({ channelId, callbackUrl, state });
    res.redirect(302, url);
  } catch (err) {
    console.error('[line/authorize]', err);
    res.status(500).json({ error: '無法啟動 LINE 登入' });
  }
});

// Step 2: LINE 重導回呼
app.get('/api/auth/line/callback', lineAuthLimiter, async (req, res) => {
  try {
    const { code, state, error: lineError } = req.query;
    if (lineError) {
      return res.redirect(302, `/?login=cancelled`);
    }
    if (!code || !state) {
      return res.status(400).send('Missing code or state');
    }
    const decodedState = verifyState(JWT_SECRET, String(state));
    if (!decodedState) {
      return res.status(400).send('Invalid or expired state');
    }
    const { channelId, channelSecret, callbackUrl } = await resolveLoginCredentials();
    if (!channelId || !channelSecret || !callbackUrl) {
      return res.status(500).send('LINE Login not configured');
    }

    const tokenResponse = await exchangeCode({
      code: String(code),
      channelId,
      channelSecret,
      callbackUrl
    });
    const profile = await fetchLineProfile(tokenResponse.access_token);
    const user = await upsertLineUser(profile);
    const jwtToken = signCustomerToken(user);

    const returnTo = decodedState.returnTo || '/';
    const safeReturn = returnTo.startsWith('/') ? returnTo : '/';
    const sep = safeReturn.includes('?') ? '&' : '?';
    res.redirect(302, `${safeReturn}${sep}token=${encodeURIComponent(jwtToken)}&login=success`);
  } catch (err) {
    console.error('[line/callback]', err);
    res.redirect(302, '/?login=failed');
  }
});

// LIFF 內：用 idToken 換 server JWT
app.post('/api/auth/line/liff-token', lineAuthLimiter, async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: '缺少 idToken' });
    const { channelId } = await resolveLoginCredentials();
    if (!channelId) return res.status(500).json({ error: 'LINE Login 尚未設定' });

    const verified = await verifyIdToken({ idToken, channelId });
    const profile = {
      userId: verified.sub,
      displayName: verified.name || 'LINE 用戶',
      pictureUrl: verified.picture || '',
      statusMessage: ''
    };
    const user = await upsertLineUser(profile);
    const token = signCustomerToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        displayName: user.displayName,
        pictureUrl: user.pictureUrl
      }
    });
  } catch (err) {
    console.error('[line/liff-token]', err);
    res.status(401).json({ error: 'idToken 驗證失敗' });
  }
});

// 取得目前登入客戶資訊
app.get('/api/auth/me', customerMiddleware, async (req, res) => {
  const u = req.user;
  res.json({
    id: u.id,
    lineUserId: u.lineUserId,
    displayName: u.displayName,
    pictureUrl: u.pictureUrl,
    email: u.email,
    phone: u.phone,
    reminderOptIn: u.reminderOptIn,
    tags: u.tags || []
  });
});

// 客戶登出（無狀態 JWT，後端僅回 200）
app.post('/api/auth/logout', (req, res) => {
  res.json({ ok: true });
});

// 客戶更新自己的個人資訊（電話、提醒偏好）
app.patch('/api/me/profile', customerMiddleware, async (req, res) => {
  const allowed = ['phone', 'email', 'reminderOptIn'];
  const update = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  }
  await req.user.update(update);
  res.json({ ok: true, user: req.user });
});

// ============ Customer: My Bookings ============

app.get('/api/me/bookings', customerMiddleware, async (req, res) => {
  const bookings = await Booking.findAll({
    where: { userId: req.userId },
    order: [['date', 'DESC'], ['time', 'DESC']]
  });
  res.json(bookings);
});

app.patch('/api/me/bookings/:id/cancel', customerMiddleware, async (req, res) => {
  const booking = await Booking.findOne({
    where: { id: req.params.id, userId: req.userId }
  });
  if (!booking) return res.status(404).json({ error: '預約不存在' });
  if (!['pending', 'confirmed'].includes(booking.status)) {
    return res.status(400).json({ error: '此預約狀態無法取消' });
  }

  // 取消時限檢查
  const settings = await Setting.findOne();
  const limitHours = settings?.bookingCancelHoursLimit ?? 24;
  if (limitHours > 0) {
    const tzOffset = Number(process.env.BOOKING_TZ_OFFSET_MINUTES ?? 480);
    const nowMs = Date.now() + tzOffset * 60 * 1000;
    const [y, mo, d] = booking.date.split('-').map(Number);
    const [hh, mm] = booking.time.split(':').map(Number);
    const bookingMs = Date.UTC(y, mo - 1, d, hh, mm);
    const diffHours = (bookingMs - nowMs) / 1000 / 3600;
    if (diffHours < limitHours) {
      return res.status(400).json({
        error: `距離預約時間少於 ${limitHours} 小時，無法線上取消，請直接聯絡店家`
      });
    }
  }

  await booking.update({ status: 'cancelled' });
  res.json(booking);
});

// ============ Admin: Profile ============

app.put('/api/admin/profile', authMiddleware, async (req, res) => {
  let profile = await Profile.findOne();
  if (profile) {
    await profile.update(req.body);
  } else {
    profile = await Profile.create(req.body);
  }
  res.json(profile);
});

// ============ Admin: Works ============

app.post('/api/admin/works', authMiddleware, async (req, res) => {
  const work = await Work.create(req.body);
  res.status(201).json(work);
});

app.put('/api/admin/works/:id', authMiddleware, async (req, res) => {
  const work = await Work.findByPk(req.params.id);
  if (!work) return res.status(404).json({ error: '作品不存在' });
  await work.update(req.body);
  res.json(work);
});

app.delete('/api/admin/works/:id', authMiddleware, async (req, res) => {
  const work = await Work.findByPk(req.params.id);
  if (!work) return res.status(404).json({ error: '作品不存在' });
  await work.destroy();
  res.json({ message: '已刪除' });
});

// ============ Admin: Services ============

app.post('/api/admin/services', authMiddleware, async (req, res) => {
  const service = await Service.create(req.body);
  res.status(201).json(service);
});

app.put('/api/admin/services/:id', authMiddleware, async (req, res) => {
  const service = await Service.findByPk(req.params.id);
  if (!service) return res.status(404).json({ error: '項目不存在' });
  await service.update(req.body);
  res.json(service);
});

app.delete('/api/admin/services/:id', authMiddleware, async (req, res) => {
  const service = await Service.findByPk(req.params.id);
  if (!service) return res.status(404).json({ error: '項目不存在' });
  await service.destroy();
  res.json({ message: '已刪除' });
});

// ============ Admin: Bookings ============

app.get('/api/admin/bookings', authMiddleware, async (req, res) => {
  const { status, source } = req.query;
  const where = {};
  if (status) where.status = status;
  if (source) where.source = source;
  const bookings = await Booking.findAll({
    where,
    order: [['createdAt', 'DESC']],
    include: [{ model: User, as: 'user', attributes: ['id', 'lineUserId', 'pictureUrl', 'tags', 'reminderOptIn'] }]
  });
  res.json(bookings);
});

// 後台代客建立預約（D2 + D8）
app.post('/api/admin/bookings', authMiddleware, async (req, res) => {
  const {
    name, phone, lineId, service, date, time, durationMinutes,
    notes, internalNotes, source, userId,
    status, ignoreConflict
  } = req.body || {};

  if (!name || !phone || !service || !date || !time || !source) {
    return res.status(400).json({ error: '請填寫姓名、電話、來源、項目、日期與時間' });
  }
  if (!['admin_phone', 'admin_dm', 'walk_in'].includes(source)) {
    return res.status(400).json({ error: '預約來源無效' });
  }

  const dateStr = String(date).trim();
  const timeStr = String(time).trim();
  const serviceStr = String(service).trim();
  const phoneStr = String(phone).trim();
  const nameStr = String(name).trim();

  const check = await validateBookingSlot({ date: dateStr, time: timeStr, service: serviceStr });
  if (!ignoreConflict && !check.ok) {
    return res.status(400).json({ error: check.error });
  }
  const duration = Number(durationMinutes) || check.duration || 210;

  // D8：找到或建立 User
  let user = null;
  if (userId) user = await User.findByPk(userId);
  if (!user) user = await User.findOne({ where: { phone: phoneStr } });
  if (!user) {
    user = await User.create({
      lineUserId: null,
      source,
      displayName: nameStr,
      phone: phoneStr,
      createdByAdminId: req.user?.sub ? Number(req.user.sub) : null
    });
  }

  const initialStatus = status === 'confirmed' ? 'confirmed' : 'pending';

  const booking = await Booking.create({
    name: nameStr,
    phone: phoneStr,
    lineId: lineId || user.lineUserId || '',
    userId: user.id,
    service: serviceStr,
    date: dateStr,
    time: timeStr,
    durationMinutes: duration,
    notes: notes ? String(notes).trim() : '',
    internalNotes: internalNotes ? String(internalNotes).trim() : '',
    status: initialStatus,
    source,
    createdByAdminId: req.user?.sub ? Number(req.user.sub) : null
  });

  // D2：建立時不推播店家通知（admin 自己建立的，admin 已知）
  // D2：若 status 直接 = confirmed 且客戶有 LINE userId，走訊息模板推「預約成功」
  if (initialStatus === 'confirmed' && user.lineUserId) {
    notifyBookingStatusChange(booking, user, 'pending')
      .catch(err => console.error('[LINE] admin booking notify error:', err.message));
  }

  res.status(201).json(booking);
});

app.patch('/api/admin/bookings/:id', authMiddleware, async (req, res) => {
  const allowed = [
    'status', 'name', 'phone', 'lineId', 'service',
    'date', 'time', 'notes', 'internalNotes', 'durationMinutes'
  ];
  const update = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  }
  const booking = await Booking.findByPk(req.params.id);
  if (!booking) return res.status(404).json({ error: '預約不存在' });

  const prevStatus = booking.status;
  await booking.update(update);

  // D2：狀態切換時自動推播客戶（走訊息模板）
  if (update.status && update.status !== prevStatus && booking.userId) {
    const user = await User.findByPk(booking.userId);
    notifyBookingStatusChange(booking, user, prevStatus)
      .catch(err => console.error('[LINE] status change notify error:', err.message));
  }

  res.json(booking);
});

app.delete('/api/admin/bookings/:id', authMiddleware, async (req, res) => {
  const booking = await Booking.findByPk(req.params.id);
  if (!booking) return res.status(404).json({ error: '預約不存在' });
  await booking.destroy();
  res.json({ message: '已刪除' });
});

// ============ Admin: Users (LINE 客戶 + 走入客戶) ============

app.get('/api/admin/users', authMiddleware, async (req, res) => {
  const { source, search, tag, blocked, hasLine } = req.query;
  const where = {};
  if (source) where.source = source;
  if (blocked === 'true') where.blocked = true;
  if (blocked === 'false') where.blocked = false;
  if (hasLine === 'true') where.lineUserId = { [Op.ne]: null };
  if (hasLine === 'false') where.lineUserId = null;
  if (search) {
    const term = `%${search.trim()}%`;
    where[Op.or] = [
      { displayName: { [Op.iLike]: term } },
      { phone: { [Op.iLike]: term } },
      { lineUserId: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } }
    ];
  }
  // 標籤過濾用 PostgreSQL JSONB containment
  const include = [];
  if (tag) {
    include.push(literal(`tags @> '${JSON.stringify([tag]).replace(/'/g, "''")}'`));
  }

  const users = await User.findAll({
    where: include.length ? { [Op.and]: [where, ...include] } : where,
    attributes: {
      include: [
        [literal('(SELECT COUNT(*)::int FROM bookings WHERE bookings."userId" = "User".id)'), 'bookingCount'],
        [literal('(SELECT MAX(date) FROM bookings WHERE bookings."userId" = "User".id)'), 'lastBookingDate']
      ]
    },
    order: [['createdAt', 'DESC']],
    limit: 500
  });
  res.json(users);
});

// 後台代客預約時，用電話搜尋已存在的 User + 最近預約
app.get('/api/admin/users/lookup', authMiddleware, async (req, res) => {
  const phone = String(req.query.phone || '').trim();
  if (!phone) return res.json({ user: null, recentBookings: [] });
  const user = await User.findOne({ where: { phone } });
  let recentBookings = [];
  if (user) {
    recentBookings = await Booking.findAll({
      where: { userId: user.id },
      order: [['date', 'DESC'], ['time', 'DESC']],
      limit: 10
    });
  } else {
    // 沒有 User 但歷史上可能有同電話的匿名預約（理論上 D8 之後不該發生，但保留相容）
    recentBookings = await Booking.findAll({
      where: { phone },
      order: [['date', 'DESC'], ['time', 'DESC']],
      limit: 10
    });
  }
  res.json({ user, recentBookings });
});

app.get('/api/admin/users/:id', authMiddleware, async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: '用戶不存在' });
  const bookings = await Booking.findAll({
    where: { userId: user.id },
    order: [['date', 'DESC'], ['time', 'DESC']]
  });
  res.json({ user, bookings });
});

app.patch('/api/admin/users/:id', authMiddleware, async (req, res) => {
  const allowed = ['displayName', 'phone', 'email', 'tags', 'notes', 'blocked', 'reminderOptIn'];
  const update = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  }
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: '用戶不存在' });
  await user.update(update);
  res.json(user);
});

app.post('/api/admin/users', authMiddleware, async (req, res) => {
  const { displayName, phone, email, source, notes, tags } = req.body || {};
  if (!displayName || !phone) {
    return res.status(400).json({ error: '請填寫姓名與電話' });
  }
  if (source && !['walk_in', 'phone', 'dm'].includes(source)) {
    return res.status(400).json({ error: '來源無效' });
  }
  const existing = await User.findOne({ where: { phone: String(phone).trim() } });
  if (existing) {
    return res.status(409).json({
      error: '此電話已有對應的客戶資料',
      existingUser: existing
    });
  }
  const user = await User.create({
    lineUserId: null,
    source: source || 'walk_in',
    displayName: String(displayName).trim(),
    phone: String(phone).trim(),
    email: email ? String(email).trim() : '',
    notes: notes || '',
    tags: Array.isArray(tags) ? tags : [],
    createdByAdminId: req.user?.sub ? Number(req.user.sub) : null
  });
  res.status(201).json(user);
});

app.delete('/api/admin/users/:id', authMiddleware, async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: '用戶不存在' });
  // 將 user 的 booking userId 設為 null，保留預約紀錄
  await Booking.update({ userId: null }, { where: { userId: user.id } });
  await user.destroy();
  res.json({ message: '已刪除' });
});

// ============ Admin: Message Templates ============

app.get('/api/admin/message-templates', authMiddleware, async (req, res) => {
  const templates = await MessageTemplate.findAll({ order: [['key', 'ASC']] });
  res.json(templates);
});

app.get('/api/admin/message-templates/:key', authMiddleware, async (req, res) => {
  const tpl = await MessageTemplate.findOne({ where: { key: req.params.key } });
  if (!tpl) return res.status(404).json({ error: '模板不存在' });
  res.json(tpl);
});

app.put('/api/admin/message-templates/:key', authMiddleware, async (req, res) => {
  const tpl = await MessageTemplate.findOne({ where: { key: req.params.key } });
  if (!tpl) return res.status(404).json({ error: '模板不存在' });
  const allowed = ['name', 'description', 'enabled', 'channel', 'content', 'flexJson', 'variables'];
  const update = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) update[k] = req.body[k];
  }
  update.updatedBy = req.user.username || 'admin';
  await tpl.update(update);
  res.json(tpl);
});

app.post('/api/admin/message-templates/:key/preview', authMiddleware, async (req, res) => {
  try {
    const tpl = await MessageTemplate.findOne({ where: { key: req.params.key } });
    if (!tpl) return res.status(404).json({ error: '模板不存在' });
    // Allow previewing unsaved edits by passing draft in body.template
    const draft = req.body?.template;
    const merged = draft ? { ...tpl.toJSON(), ...draft } : tpl.toJSON();
    const sample = { ...defaultSampleVars(), ...(req.body?.sampleData || {}) };
    const rendered = renderFromTemplate(merged, sample, { ignoreEnabled: true });
    if (!rendered) return res.status(400).json({ error: '無法渲染（請檢查 Flex JSON 是否有效）' });
    res.json({ rendered, sampleData: sample });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/message-templates/:key/test-send', authMiddleware, async (req, res) => {
  try {
    const tpl = await MessageTemplate.findOne({ where: { key: req.params.key } });
    if (!tpl) return res.status(404).json({ error: '模板不存在' });
    const { channelAccessToken, targetId } = await resolveLineCredentials();
    if (!channelAccessToken) return res.status(400).json({ error: '尚未設定 Channel Access Token' });
    const to = req.body?.toUserId || targetId;
    if (!to) return res.status(400).json({ error: '尚未設定推播對象 ID' });
    const draft = req.body?.template;
    const merged = draft ? { ...tpl.toJSON(), ...draft } : tpl.toJSON();
    const sample = { ...defaultSampleVars(), ...(req.body?.sampleData || {}) };
    const rendered = renderFromTemplate(merged, sample, { ignoreEnabled: true });
    if (!rendered) return res.status(400).json({ error: '無法渲染訊息' });
    const r = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`
      },
      body: JSON.stringify({ to, messages: [rendered] })
    });
    if (!r.ok) {
      const body = await r.text();
      return res.status(400).json({ error: `推播失敗 (${r.status}): ${body}` });
    }
    res.json({ ok: true, message: `已發送測試訊息至 ${to === targetId ? '店家 LINE' : to}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============ Admin: LINE 推播配額 ============

app.get('/api/admin/line/quota', authMiddleware, async (req, res) => {
  try {
    const { channelAccessToken } = await resolveLineCredentials();
    if (!channelAccessToken) {
      return res.json({ available: false, reason: 'no_token' });
    }
    const headers = { Authorization: `Bearer ${channelAccessToken}` };
    const [qRes, cRes] = await Promise.all([
      fetch('https://api.line.me/v2/bot/message/quota', { headers }),
      fetch('https://api.line.me/v2/bot/message/quota/consumption', { headers })
    ]);
    if (!qRes.ok || !cRes.ok) {
      return res.json({ available: false, reason: 'fetch_failed' });
    }
    const quota = await qRes.json();
    const consumption = await cRes.json();
    const limit = quota.type === 'limited' ? (quota.value || 0) : null;
    const used = Number(consumption.totalUsage || 0);
    res.json({
      available: true,
      type: quota.type,
      quota: limit,
      consumption: used,
      remaining: limit == null ? null : Math.max(0, limit - used)
    });
  } catch (err) {
    res.json({ available: false, error: err.message });
  }
});

// ============ Admin: Broadcasts ============

app.get('/api/admin/broadcasts', authMiddleware, async (req, res) => {
  const broadcasts = await Broadcast.findAll({
    order: [['createdAt', 'DESC']],
    limit: 100
  });
  res.json(broadcasts);
});

app.get('/api/admin/broadcasts/:id', authMiddleware, async (req, res) => {
  const b = await Broadcast.findByPk(req.params.id);
  if (!b) return res.status(404).json({ error: '推播紀錄不存在' });
  res.json(b);
});

async function resolveBroadcastTargets({ type, recipientUserIds, recipientTags }) {
  if (type === 'all_followers') return null; // null = use /broadcast endpoint
  if (type === 'single') {
    if (!recipientUserIds?.length) return [];
    const users = await User.findAll({
      where: {
        id: { [Op.in]: recipientUserIds },
        lineUserId: { [Op.ne]: null },
        blocked: false
      }
    });
    return users.map(u => u.lineUserId);
  }
  if (type === 'tag') {
    if (!recipientTags?.length) return [];
    const tagClauses = recipientTags.map(tag =>
      literal(`tags @> '${JSON.stringify([tag]).replace(/'/g, "''")}'`)
    );
    const users = await User.findAll({
      where: {
        lineUserId: { [Op.ne]: null },
        blocked: false,
        [Op.and]: [{ [Op.or]: tagClauses }]
      }
    });
    return users.map(u => u.lineUserId);
  }
  return [];
}

function buildBroadcastMessage({ messageType, content, flexJson, imageUrl }) {
  if (messageType === 'text') {
    return { type: 'text', text: content };
  }
  if (messageType === 'flex') {
    return { type: 'flex', altText: (content || '通知').slice(0, 400), contents: flexJson };
  }
  if (messageType === 'image') {
    return { type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl };
  }
  throw new Error('unsupported message type');
}

app.post('/api/admin/broadcasts', authMiddleware, async (req, res) => {
  const {
    type,
    recipientUserIds = [],
    recipientTags = [],
    messageType = 'text',
    content = '',
    flexJson,
    imageUrl = ''
  } = req.body || {};
  if (!['single', 'tag', 'all_followers'].includes(type)) {
    return res.status(400).json({ error: '推播類型無效' });
  }
  if (!['text', 'flex', 'image'].includes(messageType)) {
    return res.status(400).json({ error: '訊息類型無效' });
  }
  if (messageType === 'text' && !content.trim()) {
    return res.status(400).json({ error: '請填寫訊息內容' });
  }
  if (messageType === 'flex' && !flexJson) {
    return res.status(400).json({ error: 'Flex JSON 不可空白' });
  }
  if (messageType === 'image' && !imageUrl) {
    return res.status(400).json({ error: '請提供圖片網址' });
  }

  let message;
  try {
    message = buildBroadcastMessage({ messageType, content, flexJson, imageUrl });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const { channelAccessToken } = await resolveLineCredentials();
  if (!channelAccessToken) {
    return res.status(400).json({ error: '尚未設定 LINE Channel Access Token' });
  }

  // Resolve targets
  let targets;
  try {
    targets = await resolveBroadcastTargets({ type, recipientUserIds, recipientTags });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const broadcast = await Broadcast.create({
    type,
    recipientUserIds: type === 'single' ? recipientUserIds : [],
    recipientTags: type === 'tag' ? recipientTags : [],
    messageType,
    content,
    flexJson: messageType === 'flex' ? flexJson : null,
    imageUrl: imageUrl || '',
    status: 'sending',
    sentBy: req.user.username || 'admin'
  });

  let successCount = 0;
  let failureCount = 0;
  const failureDetails = [];

  try {
    if (type === 'all_followers') {
      // LINE broadcast endpoint - free, no quota
      const r = await fetch('https://api.line.me/v2/bot/message/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${channelAccessToken}`
        },
        body: JSON.stringify({ messages: [message] })
      });
      if (!r.ok) {
        const body = await r.text();
        failureDetails.push({ stage: 'broadcast', error: `${r.status}: ${body}` });
        failureCount = 1;
      } else {
        successCount = 1;
      }
    } else if (!targets.length) {
      failureDetails.push({ note: '無符合條件的收件人' });
    } else if (type === 'single' && targets.length === 1) {
      const r = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${channelAccessToken}`
        },
        body: JSON.stringify({ to: targets[0], messages: [message] })
      });
      if (!r.ok) {
        const body = await r.text();
        failureDetails.push({ userId: targets[0], error: `${r.status}: ${body}` });
        failureCount = 1;
      } else {
        successCount = 1;
      }
    } else {
      // Multicast batches of 500
      for (let i = 0; i < targets.length; i += 500) {
        const batch = targets.slice(i, i + 500);
        const r = await fetch('https://api.line.me/v2/bot/message/multicast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${channelAccessToken}`
          },
          body: JSON.stringify({ to: batch, messages: [message] })
        });
        if (!r.ok) {
          const body = await r.text();
          failureDetails.push({ batchSize: batch.length, error: `${r.status}: ${body}` });
          failureCount += batch.length;
        } else {
          successCount += batch.length;
        }
      }
    }
  } catch (err) {
    failureDetails.push({ error: err.message });
    failureCount += targets?.length || 1;
  }

  const finalStatus =
    successCount > 0 ? 'sent' : (failureCount > 0 ? 'failed' : 'sent');
  await broadcast.update({
    status: finalStatus,
    successCount,
    failureCount,
    failureDetails,
    sentAt: new Date()
  });

  res.json(broadcast);
});

app.delete('/api/admin/broadcasts/:id', authMiddleware, async (req, res) => {
  const b = await Broadcast.findByPk(req.params.id);
  if (!b) return res.status(404).json({ error: '推播紀錄不存在' });
  if (!['draft', 'queued'].includes(b.status)) {
    return res.status(400).json({ error: '已送出的推播僅能保留歷史，無法刪除' });
  }
  await b.destroy();
  res.json({ message: '已刪除' });
});

// 後台用：列出所有已存在的 tags（拼湊客戶 tags 出現過的集合）
app.get('/api/admin/user-tags', authMiddleware, async (req, res) => {
  const users = await User.findAll({ attributes: ['tags'] });
  const set = new Set();
  for (const u of users) {
    (u.tags || []).forEach(t => set.add(t));
  }
  res.json([...set].sort());
});

// ============ Admin: News ============

app.get('/api/admin/news', authMiddleware, async (req, res) => {
  const items = await News.findAll({ order: [['pinned', 'DESC'], ['publishedAt', 'DESC'], ['id', 'DESC']] });
  res.json(items);
});

app.post('/api/admin/news', authMiddleware, async (req, res) => {
  const item = await News.create(req.body);
  res.status(201).json(item);
});

app.put('/api/admin/news/:id', authMiddleware, async (req, res) => {
  const item = await News.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: '消息不存在' });
  await item.update(req.body);
  res.json(item);
});

app.delete('/api/admin/news/:id', authMiddleware, async (req, res) => {
  const item = await News.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: '消息不存在' });
  await item.destroy();
  res.json({ message: '已刪除' });
});

// ============ Admin: Settings ============

app.get('/api/admin/settings', authMiddleware, async (req, res) => {
  const settings = await Setting.findOne();
  res.json(settings || {});
});

app.put('/api/admin/settings', authMiddleware, async (req, res) => {
  let settings = await Setting.findOne();
  if (settings) {
    await settings.update(req.body);
  } else {
    settings = await Setting.create(req.body);
  }
  res.json(settings);
});

app.post('/api/admin/line/test', authMiddleware, async (req, res) => {
  try {
    await sendTestMessage();
    res.json({ message: '已送出測試訊息，請確認 LINE 是否收到 ✨' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============ Admin: Password ============

app.put('/api/admin/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = await Admin.findOne({ where: { username: req.user.username } });
  const valid = await bcrypt.compare(currentPassword, admin.password);
  if (!valid) return res.status(400).json({ error: '目前密碼不正確' });
  admin.password = await bcrypt.hash(newPassword, 10);
  await admin.save();
  res.json({ message: '密碼已更新' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

connectDB().then(async () => {
  await initAdmin();
  await initSettings();
  await ensureDefaultTemplates();
  app.listen(PORT, () => {
    console.log(`La Paisley server running on port ${PORT}`);
  });
});
