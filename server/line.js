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

async function sendViaMessagingApi(token, to, text) {
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

async function sendViaNotify(token, text) {
  const params = new URLSearchParams({ message: `\n${text}` });
  const res = await fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${token}`
    },
    body: params.toString()
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE Notify ${res.status}: ${body}`);
  }
}

async function resolveSettings() {
  const dbSettings = await Setting.findOne();
  return {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || dbSettings?.lineChannelAccessToken || '',
    targetId: process.env.LINE_TARGET_ID || dbSettings?.lineTargetId || '',
    notifyToken: process.env.LINE_NOTIFY_TOKEN || dbSettings?.lineNotifyToken || ''
  };
}

async function notifyBooking(booking) {
  const text = formatBookingMessage(booking);
  const { channelAccessToken, targetId, notifyToken } = await resolveSettings();

  const attempts = [];

  if (channelAccessToken && targetId) {
    try {
      await sendViaMessagingApi(channelAccessToken, targetId, text);
      attempts.push({ channel: 'messaging-api', ok: true });
    } catch (err) {
      attempts.push({ channel: 'messaging-api', ok: false, error: err.message });
    }
  }

  if (notifyToken) {
    try {
      await sendViaNotify(notifyToken, text);
      attempts.push({ channel: 'notify', ok: true });
    } catch (err) {
      attempts.push({ channel: 'notify', ok: false, error: err.message });
    }
  }

  if (attempts.length === 0) {
    console.log('[LINE] No credentials configured, skipping notification');
    return { skipped: true };
  }

  const anySuccess = attempts.some(a => a.ok);
  if (!anySuccess) {
    console.error('[LINE] All notification attempts failed', attempts);
  } else {
    console.log('[LINE] Notification sent', attempts);
  }
  return { attempts };
}

async function sendTestMessage() {
  const text = '【La Paisley】這是一則 LINE 通知測試訊息 ✨';
  const { channelAccessToken, targetId, notifyToken } = await resolveSettings();
  if (!channelAccessToken && !notifyToken) {
    throw new Error('尚未設定任何 LINE 金鑰');
  }
  if (channelAccessToken && !targetId) {
    throw new Error('已設定 Channel Access Token，但缺少推播對象 ID');
  }
  if (channelAccessToken && targetId) {
    await sendViaMessagingApi(channelAccessToken, targetId, text);
  }
  if (notifyToken) {
    await sendViaNotify(notifyToken, text);
  }
  return { ok: true };
}

module.exports = { notifyBooking, sendTestMessage, formatBookingMessage };
