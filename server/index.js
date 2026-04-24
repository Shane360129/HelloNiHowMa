const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const connectDB = require('./db');
const Admin = require('./models/Admin');
const Profile = require('./models/Profile');
const Work = require('./models/Work');
const Service = require('./models/Service');
const Booking = require('./models/Booking');
const Setting = require('./models/Setting');
const { notifyBooking, sendTestMessage } = require('./line');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'la-paisley-admin-secret-key-2025';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

async function initAdmin() {
  const existing = await Admin.findOne({ username: 'admin' });
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

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未授權' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token 無效或已過期' });
  }
}

// ============ Public API ============

app.get('/api/profile', async (req, res) => {
  const profile = await Profile.findOne();
  res.json(profile || {});
});

app.get('/api/works', async (req, res) => {
  const works = await Work.find().sort({ createdAt: -1 });
  res.json(works);
});

app.get('/api/services', async (req, res) => {
  const services = await Service.find().sort({ order: 1, _id: 1 });
  res.json(services);
});

app.get('/api/public-settings', async (req, res) => {
  const s = await Setting.findOne();
  if (!s) return res.json({});
  res.json({
    businessName: s.businessName,
    businessHours: s.businessHours,
    bookingNote: s.bookingNote,
    bookingEnabled: s.bookingEnabled
  });
});

app.post('/api/bookings', async (req, res) => {
  const settings = await Setting.findOne();
  if (settings && settings.bookingEnabled === false) {
    return res.status(400).json({ error: '目前暫停線上預約，請透過 LINE 或電話聯繫我們' });
  }

  const { name, phone, lineId, service, date, time, notes } = req.body || {};
  if (!name || !phone || !service || !date || !time) {
    return res.status(400).json({ error: '請完整填寫姓名、電話、項目、日期與時間' });
  }

  const booking = await Booking.create({
    name: String(name).trim(),
    phone: String(phone).trim(),
    lineId: lineId ? String(lineId).trim() : '',
    service: String(service).trim(),
    date: String(date).trim(),
    time: String(time).trim(),
    notes: notes ? String(notes).trim() : ''
  });

  notifyBooking(booking.toJSON()).catch(err => console.error('[LINE] notify error:', err));

  res.status(201).json({
    id: booking.id,
    message: '預約已送出，我們會盡快與您確認時段 💌'
  });
});

// ============ Auth API ============

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin) return res.status(401).json({ error: '帳號或密碼錯誤' });

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) return res.status(401).json({ error: '帳號或密碼錯誤' });

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, username });
});

app.get('/api/auth/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, username: req.user.username });
});

// ============ Admin: Profile ============

app.put('/api/admin/profile', authMiddleware, async (req, res) => {
  const profile = await Profile.findOneAndUpdate({}, req.body, {
    new: true,
    upsert: true,
    runValidators: true
  });
  res.json(profile);
});

// ============ Admin: Works ============

app.post('/api/admin/works', authMiddleware, async (req, res) => {
  const work = await Work.create(req.body);
  res.status(201).json(work);
});

app.put('/api/admin/works/:id', authMiddleware, async (req, res) => {
  const work = await Work.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!work) return res.status(404).json({ error: '作品不存在' });
  res.json(work);
});

app.delete('/api/admin/works/:id', authMiddleware, async (req, res) => {
  const work = await Work.findByIdAndDelete(req.params.id);
  if (!work) return res.status(404).json({ error: '作品不存在' });
  res.json({ message: '已刪除' });
});

// ============ Admin: Services ============

app.post('/api/admin/services', authMiddleware, async (req, res) => {
  const service = await Service.create(req.body);
  res.status(201).json(service);
});

app.put('/api/admin/services/:id', authMiddleware, async (req, res) => {
  const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!service) return res.status(404).json({ error: '項目不存在' });
  res.json(service);
});

app.delete('/api/admin/services/:id', authMiddleware, async (req, res) => {
  const service = await Service.findByIdAndDelete(req.params.id);
  if (!service) return res.status(404).json({ error: '項目不存在' });
  res.json({ message: '已刪除' });
});

// ============ Admin: Bookings ============

app.get('/api/admin/bookings', authMiddleware, async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};
  const bookings = await Booking.find(filter).sort({ createdAt: -1 });
  res.json(bookings);
});

app.patch('/api/admin/bookings/:id', authMiddleware, async (req, res) => {
  const allowed = ['status', 'name', 'phone', 'lineId', 'service', 'date', 'time', 'notes'];
  const update = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  }
  const booking = await Booking.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!booking) return res.status(404).json({ error: '預約不存在' });
  res.json(booking);
});

app.delete('/api/admin/bookings/:id', authMiddleware, async (req, res) => {
  const booking = await Booking.findByIdAndDelete(req.params.id);
  if (!booking) return res.status(404).json({ error: '預約不存在' });
  res.json({ message: '已刪除' });
});

// ============ Admin: Settings ============

app.get('/api/admin/settings', authMiddleware, async (req, res) => {
  const settings = await Setting.findOne();
  res.json(settings || {});
});

app.put('/api/admin/settings', authMiddleware, async (req, res) => {
  const settings = await Setting.findOneAndUpdate({}, req.body, {
    new: true,
    upsert: true,
    runValidators: true
  });
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
  const admin = await Admin.findOne({ username: req.user.username });
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
  app.listen(PORT, () => {
    console.log(`La Paisley server running on port ${PORT}`);
  });
});
