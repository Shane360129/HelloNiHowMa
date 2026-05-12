const Setting = require('./models/Setting');
const { renderTemplate, buildBookingVars } = require('./messageTemplates');

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';

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

async function pushMessages(to, messages) {
  if (!to || !messages?.length) return { skipped: true };
  const { channelAccessToken } = await resolveCredentials();
  if (!channelAccessToken) {
    console.log('[LINE] no channel access token configured, skipping push');
    return { skipped: true };
  }
  const res = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`
    },
    body: JSON.stringify({ to, messages })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE push ${res.status}: ${body}`);
  }
  return { ok: true };
}

async function pushText(token, to, text) {
  const tokenToUse = token || (await resolveCredentials()).channelAccessToken;
  if (!tokenToUse) return { skipped: true };
  const res = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenToUse}`
    },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] })
  });
  if (!res.ok) {
    throw new Error(`LINE push ${res.status}: ${await res.text()}`);
  }
  return { ok: true };
}

async function pushFlex(token, to, altText, contents) {
  const tokenToUse = token || (await resolveCredentials()).channelAccessToken;
  if (!tokenToUse) return { skipped: true };
  const res = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenToUse}`
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'flex', altText, contents }]
    })
  });
  if (!res.ok) {
    throw new Error(`LINE push ${res.status}: ${await res.text()}`);
  }
  return { ok: true };
}

async function pushTemplate(to, key, vars) {
  if (!to) return { skipped: true };
  const message = await renderTemplate(key, vars);
  if (!message) return { skipped: true, reason: 'template_missing_or_disabled' };
  return pushMessages(to, [message]);
}

async function replyMessages(replyToken, messages) {
  if (!replyToken || !messages?.length) return;
  const { channelAccessToken } = await resolveCredentials();
  if (!channelAccessToken) return;
  const res = await fetch(LINE_REPLY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`
    },
    body: JSON.stringify({ replyToken, messages })
  });
  if (!res.ok) {
    console.error('[LINE reply]', res.status, await res.text());
  }
}

async function replyText(replyToken, text) {
  return replyMessages(replyToken, [{ type: 'text', text }]);
}

// 客戶自助預約：推給客戶 + 推給店家（D2）
async function notifyBookingCreated(booking, user) {
  if (booking.source !== 'customer_self') return; // D2：後台代客預約建立時不通知
  const vars = await buildBookingVars(booking);

  if (user?.lineUserId && !user.blocked) {
    pushTemplate(user.lineUserId, 'booking_created_customer', vars)
      .catch(err => console.error('[LINE] booking_created_customer:', err.message));
  }

  const { targetId } = await resolveCredentials();
  if (targetId) {
    pushTemplate(targetId, 'booking_created_store', vars)
      .catch(err => console.error('[LINE] booking_created_store:', err.message));
  }
}

// 預約狀態變更：推給客戶（D2）
async function notifyBookingStatusChange(booking, user, prevStatus) {
  if (!user?.lineUserId || user.blocked) return;
  if (booking.status === prevStatus) return;
  let key = null;
  if (booking.status === 'confirmed') key = 'booking_confirmed_customer';
  else if (booking.status === 'cancelled') key = 'booking_cancelled_customer';
  else if (booking.status === 'completed') key = 'booking_completed_customer';
  if (!key) return;
  const vars = await buildBookingVars(booking);
  try {
    await pushTemplate(user.lineUserId, key, vars);
  } catch (err) {
    console.error(`[LINE] ${key}:`, err.message);
  }
}

async function sendTestMessage() {
  const { channelAccessToken, targetId } = await resolveCredentials();
  if (!channelAccessToken) throw new Error('尚未設定 Channel Access Token');
  if (!targetId) throw new Error('尚未設定推播對象 ID');
  await pushText(channelAccessToken, targetId, '【La Paisley】這是一則 LINE 通知測試訊息 ✨');
  return { ok: true };
}

module.exports = {
  resolveCredentials,
  pushText,
  pushFlex,
  pushMessages,
  pushTemplate,
  replyMessages,
  replyText,
  notifyBookingCreated,
  notifyBookingStatusChange,
  sendTestMessage,
  // Legacy alias for older callers
  notifyBooking: notifyBookingCreated
};
