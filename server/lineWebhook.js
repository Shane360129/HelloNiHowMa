const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  User,
  Booking,
  Service,
  Setting,
  Profile,
  LineWebhookEvent
} = require('./models');
const {
  pushTemplate,
  replyText,
  notifyBookingStatusChange
} = require('./line');

function verifySignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret || !rawBody) return false;
  const expected = crypto
    .createHmac('sha256', channelSecret)
    .update(rawBody)
    .digest('base64');
  if (expected.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function handleEvent(event) {
  // 去重：寫入 webhook event 表，UNIQUE 失敗就跳過
  if (event.webhookEventId) {
    try {
      await LineWebhookEvent.create({
        webhookEventId: event.webhookEventId,
        type: event.type || 'unknown',
        rawPayload: event,
        processedAt: new Date()
      });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        console.log('[webhook] duplicate event, skipping:', event.webhookEventId);
        return;
      }
      console.error('[webhook] log error:', err.message);
    }
  }

  switch (event.type) {
    case 'follow': return handleFollow(event);
    case 'unfollow': return handleUnfollow(event);
    case 'message': return handleMessage(event);
    case 'postback': return handlePostback(event);
    default:
      console.log('[webhook] unhandled type:', event.type);
  }
}

async function handleFollow(event) {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;
  const [user] = await User.findOrCreate({
    where: { lineUserId },
    defaults: {
      lineUserId,
      source: 'line',
      displayName: 'LINE 用戶',
      isFollowingOA: true
    }
  });
  await user.update({ isFollowingOA: true });

  const settings = await Setting.findOne();
  await pushTemplate(lineUserId, 'oa_welcome', {
    name: user.displayName,
    storeName: settings?.businessName || 'La Paisley'
  }).catch(err => console.error('[follow] welcome push:', err.message));
}

async function handleUnfollow(event) {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;
  const user = await User.findOne({ where: { lineUserId } });
  if (user) await user.update({ isFollowingOA: false });
}

async function handleMessage(event) {
  if (event.message?.type !== 'text') {
    return replyText(event.replyToken,
      '您好 ✨ 您可以輸入「預約」「查預約」「營業時間」「聯絡」或「菜單」'
    );
  }
  const text = (event.message.text || '').trim();
  const lineUserId = event.source?.userId;

  if (/查預約|我的預約/i.test(text)) {
    return handleQueryBookings(event, lineUserId);
  }
  if (/^預約$|想預約|我要預約|預約頁/i.test(text)) {
    return handlePromptBooking(event);
  }
  if (/取消預約/i.test(text)) {
    return replyText(event.replyToken, '請至「我的預約」頁面操作取消，或直接回覆此訊息與我們聯絡。');
  }
  if (/營業時間|幾點|有開/i.test(text)) {
    const settings = await Setting.findOne();
    return replyText(event.replyToken, `🕒 ${settings?.businessHours || '請洽店家確認'}`);
  }
  if (/聯絡|地址|電話|怎麼去|哪裡/i.test(text)) {
    return handleContact(event);
  }
  if (/菜單|價目|價格|多少錢/i.test(text)) {
    return handleMenu(event);
  }
  return replyText(event.replyToken,
    '您好 ✨ 您可以輸入：\n「預約」開始預約\n「查預約」查看我的預約\n「營業時間」「聯絡」「菜單」'
  );
}

async function handleQueryBookings(event, lineUserId) {
  if (!lineUserId) return;
  const user = await User.findOne({ where: { lineUserId } });
  if (!user) {
    return replyText(event.replyToken,
      '查無您的預約紀錄。\n第一次使用嗎？輸入「預約」開始 ✨'
    );
  }
  const bookings = await Booking.findAll({
    where: {
      userId: user.id,
      status: { [Op.in]: ['pending', 'confirmed'] }
    },
    order: [['date', 'ASC'], ['time', 'ASC']],
    limit: 5
  });
  if (bookings.length === 0) {
    return replyText(event.replyToken,
      '目前沒有未完成的預約。\n輸入「預約」可以開始預約 ✨'
    );
  }
  const lines = ['您的預約：'];
  for (const b of bookings) {
    const statusLabel = b.status === 'confirmed' ? '✓ 已確認' : '⏳ 待確認';
    lines.push(`\n📅 ${b.date} ${b.time}\n💄 ${b.service}\n${statusLabel}`);
  }
  return replyText(event.replyToken, lines.join('\n'));
}

async function handlePromptBooking(event) {
  const settings = await Setting.findOne();
  const liffId = settings?.lineLiffId || process.env.LINE_LIFF_ID;
  if (liffId) {
    return replyText(event.replyToken,
      `請點以下連結開始預約 ✨\nhttps://liff.line.me/${liffId}`
    );
  }
  return replyText(event.replyToken,
    '請至我們的網站預約：\nhttps://lapaisley.com/booking'
  );
}

async function handleContact(event) {
  const profile = await Profile.findOne();
  const parts = [
    profile?.address && `📍 ${profile.address}`,
    profile?.phone && `📞 ${profile.phone}`,
    profile?.email && `📧 ${profile.email}`,
    profile?.social?.instagram && `📷 ${profile.social.instagram}`
  ].filter(Boolean);
  return replyText(event.replyToken,
    parts.length ? parts.join('\n') : '請至我們的網站查看聯絡方式'
  );
}

async function handleMenu(event) {
  const services = await Service.findAll({
    order: [['order', 'ASC'], ['id', 'ASC']]
  });
  if (!services.length) {
    return replyText(event.replyToken, '尚未設定服務項目');
  }
  const lines = ['💄 服務項目：\n'];
  for (const s of services) {
    const parts = [s.name];
    if (s.price) parts.push(s.price);
    if (s.duration) parts.push(s.duration);
    lines.push(parts.join(' · '));
  }
  return replyText(event.replyToken, lines.join('\n'));
}

async function handlePostback(event) {
  const lineUserId = event.source?.userId;
  const data = event.postback?.data;
  if (!lineUserId || !data) return;

  // D4：白名單驗證
  const settings = await Setting.findOne();
  const allowed = settings?.adminLineUserIds || [];
  if (!Array.isArray(allowed) || !allowed.includes(lineUserId)) {
    return replyText(event.replyToken,
      '您沒有權限執行此操作。如需協助請與店家聯絡。'
    );
  }

  const params = new URLSearchParams(data);
  const action = params.get('action');
  const bookingId = params.get('id');
  if (!action || !bookingId) return;

  const booking = await Booking.findByPk(bookingId);
  if (!booking) {
    return replyText(event.replyToken, '此預約已不存在或已被刪除。');
  }

  let newStatus = null;
  if (action === 'booking_confirm') newStatus = 'confirmed';
  else if (action === 'booking_cancel') newStatus = 'cancelled';
  if (!newStatus) return;

  const prevStatus = booking.status;
  if (prevStatus === newStatus) {
    const stateLabel = prevStatus === 'confirmed' ? '已確認' : '已取消';
    return replyText(event.replyToken, `此預約已是「${stateLabel}」狀態。`);
  }

  await booking.update({ status: newStatus });

  const user = booking.userId ? await User.findByPk(booking.userId) : null;
  notifyBookingStatusChange(booking, user, prevStatus)
    .catch(err => console.error('[postback notify]', err.message));

  const label = newStatus === 'confirmed' ? '✅ 已確認' : '❌ 已取消';
  const customerNote = user?.lineUserId
    ? '📤 已通知客戶'
    : '客戶未綁定 LINE，請以其他方式通知';
  return replyText(event.replyToken,
    `${label} ${booking.name} 的預約\n📅 ${booking.date} ${booking.time}\n💄 ${booking.service}\n\n${customerNote}`
  );
}

module.exports = {
  verifySignature,
  handleEvent
};
