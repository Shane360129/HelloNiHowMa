import liff from '@line/liff';

let initialized = false;
let initPromise = null;
let initError = null;
let cachedLiffId = null;

export function getLiffSdk() {
  return liff;
}

export function isLiffInitialized() {
  return initialized;
}

export function getLiffInitError() {
  return initError;
}

// Idempotent init. Subsequent calls return the cached promise.
export function initLiff(liffId) {
  if (!liffId) return Promise.resolve(null);
  if (initialized && cachedLiffId === liffId) return Promise.resolve(liff);
  if (initPromise) return initPromise;

  cachedLiffId = liffId;
  initPromise = liff
    .init({ liffId })
    .then(() => {
      initialized = true;
      initError = null;
      return liff;
    })
    .catch(err => {
      console.warn('[LIFF] init failed:', err?.message || err);
      initError = err;
      initPromise = null;
      return null;
    });
  return initPromise;
}

// True when running inside the LINE in-app browser (LIFF window).
export function isInLineApp() {
  if (!initialized) return false;
  try {
    return liff.isInClient();
  } catch {
    return false;
  }
}

// Convenience: open a URL outside the LIFF browser when running inside LINE,
// otherwise behave like a normal target=_blank.
export function openExternal(url) {
  if (initialized && liff.isInClient()) {
    liff.openWindow({ url, external: true });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// Try to authenticate the current LIFF user against our server.
// Returns { token, user } on success, null otherwise.
export async function liffAutoLogin(apiBase) {
  if (!initialized) return null;
  if (!liff.isInClient()) return null; // 外部瀏覽器走 OAuth flow
  if (!liff.isLoggedIn()) {
    liff.login(); // 會在 LINE 內導向授權頁，回來後本程式重新執行
    return null;
  }
  const idToken = liff.getIDToken();
  if (!idToken) return null;
  const res = await fetch(`${apiBase}/api/auth/line/liff-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  if (!res.ok) {
    console.warn('[LIFF] token exchange failed:', res.status);
    return null;
  }
  return res.json();
}
