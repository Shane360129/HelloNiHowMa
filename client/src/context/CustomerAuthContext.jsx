import { createContext, useContext, useState, useEffect, useCallback } from 'react';

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

  // 從 callback redirect 接住 token 並清掉 URL 參數
  useEffect(() => {
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

    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }

    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` }
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => {
        setUser(data);
        setToken(stored);
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const loginWithLine = useCallback((returnTo) => {
    const target = returnTo || window.location.pathname + window.location.search;
    window.location.href = `${API}/api/auth/line/authorize?returnTo=${encodeURIComponent(target)}`;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API}/api/auth/logout`, { method: 'POST' });
    } catch {
      /* ignore */
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
  }, []);

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
    <CustomerAuthContext.Provider value={{ user, token, loading, loginWithLine, logout, refreshMe }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export const useCustomerAuth = () => useContext(CustomerAuthContext);
