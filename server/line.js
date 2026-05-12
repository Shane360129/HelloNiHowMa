const Setting = require('./models/Setting');

const STATUS_LABEL = {
  pending: '待確認',
  confirmed: '已確認',
  completed: '已完成',
  cancelled: '已取消'
};

function formatBookingMessage(booking) {
  const lines = [
    '【La Paisley 新預約通知】',
    `姓名：${booking.name}`,
    `電話：${booking.phone}`,
    booking.lineId ? `LINE：${booking.lineId}` : null,
    `項目：${booking.service}`,
    `日期：${booking.date} ${booking.time}`,
    booking.notes ? `備註：${booking.notes}` : null,
    `狀態：${STATUS_LABEL[booking.status] || booking.status}`
  ].filter(Boolean);
  return lines.join('\n');
}

async function pushText(token, to, text) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE Messaging API ${res.status}: ${body}`);
  }
}

async function pushFlex(token, to, altText, contents) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'flex', altText, contents }]
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE Messaging API ${res.status}: ${body}`);
  }
}

async function resolveCredentials() {
  const dbSettings = await Setting.findOne();
  return {
    channelAccessToken:
      process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN ||
      dbSettings?.lineChannelAccessToken ||
      '',
    channelSecret:
      process.env.LINE_MESSAGING_CHANNEL_SECRET ||
      dbSettings?.lineChannelSecret ||
      '',
    targetId:
      process.env.LINE_TARGET_ID ||
      dbSettings?.lineTargetId ||
      ''
  };
}

async function notifyBooking(booking) {
  const text = formatBookingMessage(booking);
  const { channelAccessToken, targetId } = await resolveCredentials();
  if (!channelAccessToken || !targetId) {
    console.log('[LINE] credentials not configured, skipping notification');
    return { skipped: true };
  }
  try {
    await pushText(channelAccessToken, targetId, text);
    console.log('[LINE] notification sent');
    return { ok: true };
  } catch (err) {
    console.error('[LINE] notification failed:', err.message);
    return { ok: false, error: err.message };
  }
}

async function sendTestMessage() {
  const text = '【La Paisley】這是一則 LINE 通知測試訊息 ✨';
  const { channelAccessToken, targetId } = await resolveCredentials();
  if (!channelAccessToken) throw new Error('尚未設定 Channel Access Token');
  if (!targetId) throw new Error('尚未設定推播對象 ID');
  await pushText(channelAccessToken, targetId, text);
  return { ok: true };
}

module.exports = {
  notifyBooking,
  sendTestMessage,
  formatBookingMessage,
  pushText,
  pushFlex,
  resolveCredentials
};
