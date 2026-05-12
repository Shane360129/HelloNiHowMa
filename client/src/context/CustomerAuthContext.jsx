import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initLiff, isInLineApp, liffAutoLogin, getLiffSdk } from '../lib/liff';

const CustomerAuthContext = createContext(null);
const API = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'customer_token';

export function getCustomerToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function CustomerAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liffReady, setLiffReady] = useState(false);
  const [inLineApp, setInLineApp] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // 1. 接住 OAuth callback 的 ?token=
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      const loginStatus = params.get('login');
      if (urlToken && loginStatus === 'success') {
        localStorage.setItem(TOKEN_KEY, urlToken);
        params.delete('token');
        params.delete('login');
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
        window.history.replaceState({}, '', newUrl);
      }

      // 2. 嘗試用既有 token 取回個資
      let stored = localStorage.getItem(TOKEN_KEY);
      if (stored) {
        try {
          const res = await fetch(`${API}/api/auth/me`, {
            headers: { Authorization: `Bearer ${stored}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) {
              setUser(data);
              setToken(stored);
            }
          } else {
            localStorage.removeItem(TOKEN_KEY);
            stored = null;
          }
        } catch {
          // ignore network errors here
        }
      }

      // 3. 讀 public settings 看 LIFF 是否啟用
      let liffId = '';
      try {
        const r = await fetch(`${API}/api/public-settings`);
        if (r.ok) {
          const s = await r.json();
          liffId = s.lineLiffId || '';
        }
      } catch {
        // ignore
      }

      // 4. 若有 liffId，嘗試 init LIFF
      if (liffId) {
        const liff = await initLiff(liffId);
        if (liff && !cancelled) {
          setLiffReady(true);
          setInLineApp(isInLineApp());

          // 5. 若在 LINE App 內且尚未認證 → 自動以 idToken 換 server JWT
          if (isInLineApp() && !stored) {
            try {
              const data = await liffAutoLogin(API);
              if (data?.token && !cancelled) {
                localStorage.setItem(TOKEN_KEY, data.token);
                setToken(data.token);
                // 重新跑一次 /me 拿完整資料（含 phone / reminderOptIn 等）
                const r2 = await fetch(`${API}/api/auth/me`, {
                  headers: { Authorization: `Bearer ${data.token}` }
                });
                if (r2.ok) setUser(await r2.json());
              }
            } catch (err) {
              console.warn('[LIFF] auto-login failed:', err?.message);
            }
          }
        }
      }

      if (!cancelled) setLoading(false);
    }

    bootstrap();
    return () => { cancelled = true; };
  }, []);

  const loginWithLine = useCallback((returnTo) => {
    // 如果已 init LIFF 且在 LINE App 內，直接呼叫 liff.login()
    const liff = getLiffSdk();
    if (liffReady && isInLineApp() && !liff.isLoggedIn()) {
      liff.login();
      return;
    }
    // 一般瀏覽器走 OAuth flow
    const target = returnTo || window.location.pathname + window.location.search;
    window.location.href = `${API}/api/auth/line/authorize?returnTo=${encodeURIComponent(target)}`;
  }, [liffReady]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API}/api/auth/logout`, { method: 'POST' });
    } catch {
      /* ignore */
    }
    // 若在 LIFF 內，呼叫 liff.logout() 一併登出 LINE Login session
    if (liffReady) {
      try { getLiffSdk().logout(); } catch { /* ignore */ }
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
  }, [liffReady]);

  const refreshMe = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return null;
    const res = await fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    setUser(data);
    return data;
  }, []);

  return (
    <CustomerAuthContext.Provider
      value={{ user, token, loading, loginWithLine, logout, refreshMe, liffReady, inLineApp }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export const useCustomerAuth = () => useContext(CustomerAuthContext);
