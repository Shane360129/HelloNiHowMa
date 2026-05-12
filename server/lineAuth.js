const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Setting = require('./models/Setting');
const User = require('./models/User');

const LINE_AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const LINE_PROFILE_URL = 'https://api.line.me/v2/profile';
const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';
const STATE_AUDIENCE = 'la-paisley-oauth-state';

async function resolveLoginCredentials() {
  const dbSettings = await Setting.findOne();
  return {
    channelId:
      process.env.LINE_LOGIN_CHANNEL_ID ||
      dbSettings?.lineLoginChannelId ||
      '',
    channelSecret:
      process.env.LINE_LOGIN_CHANNEL_SECRET ||
      dbSettings?.lineLoginChannelSecret ||
      '',
    callbackUrl: process.env.LINE_LOGIN_CALLBACK_URL || '',
    liffId: process.env.LINE_LIFF_ID || dbSettings?.lineLiffId || ''
  };
}

function buildState(jwtSecret, returnTo) {
  return jwt.sign(
    {
      nonce: crypto.randomBytes(16).toString('hex'),
      returnTo: returnTo || '/'
    },
    jwtSecret,
    { expiresIn: '5m', audience: STATE_AUDIENCE }
  );
}

function verifyState(jwtSecret, state) {
  try {
    return jwt.verify(state, jwtSecret, { audience: STATE_AUDIENCE });
  } catch {
    return null;
  }
}

function buildAuthorizeUrl({ channelId, callbackUrl, state }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: channelId,
    redirect_uri: callbackUrl,
    state,
    scope: 'profile openid',
    bot_prompt: 'normal'
  });
  return `${LINE_AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCode({ code, channelId, channelSecret, callbackUrl }) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl,
    client_id: channelId,
    client_secret: channelSecret
  });
  const res = await fetch(LINE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  if (!res.ok) {
    throw new Error(`LINE token exchange failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function fetchProfile(accessToken) {
  const res = await fetch(LINE_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error(`LINE profile fetch failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function verifyIdToken({ idToken, channelId }) {
  const params = new URLSearchParams({ id_token: idToken, client_id: channelId });
  const res = await fetch(LINE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  if (!res.ok) {
    throw new Error(`LINE id_token verify failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function upsertLineUser(profile) {
  const [user] = await User.findOrCreate({
    where: { lineUserId: profile.userId },
    defaults: {
      lineUserId: profile.userId,
      source: 'line',
      displayName: profile.displayName || 'LINE 用戶',
      pictureUrl: profile.pictureUrl || '',
      statusMessage: profile.statusMessage || ''
    }
  });
  await user.update({
    displayName: profile.displayName || user.displayName,
    pictureUrl: profile.pictureUrl || user.pictureUrl,
    statusMessage: profile.statusMessage || user.statusMessage,
    lastLoginAt: new Date()
  });
  return user;
}

module.exports = {
  resolveLoginCredentials,
  buildState,
  verifyState,
  buildAuthorizeUrl,
  exchangeCode,
  fetchProfile,
  verifyIdToken,
  upsertLineUser
};
