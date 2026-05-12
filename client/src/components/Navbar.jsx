import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';

export default function Navbar() {
  const { user: admin } = useAuth();
  const { user: customer, loginWithLine, logout: customerLogout, loading: customerLoading } = useCustomerAuth();
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <nav className="navbar">
      <div className="container navbar-content">
        <Link to="/" className="logo">La <span className="logo-accent">Paisley</span></Link>
        <div className="nav-links">
          <Link to="/" className={isActive('/') ? 'active' : ''}>首頁</Link>
          <Link to="/services" className={isActive('/services') ? 'active' : ''}>服務項目</Link>
          <Link to="/works" className={isActive('/works') ? 'active' : ''}>作品集</Link>
          <Link to="/booking" className="btn btn-sm">立即預約</Link>

          {customerLoading ? null : customer ? (
            <div className="user-menu" ref={menuRef}>
              <button
                type="button"
                className="user-menu-trigger"
                onClick={() => setMenuOpen(v => !v)}
                aria-expanded={menuOpen}
              >
                {customer.pictureUrl
                  ? <img src={customer.pictureUrl} alt={customer.displayName} className="user-avatar" />
                  : <span className="user-avatar user-avatar-fallback">{customer.displayName?.[0] || '?'}</span>}
                <span className="user-name">{customer.displayName}</span>
              </button>
              {menuOpen && (
                <div className="user-menu-dropdown">
                  <Link to="/me/bookings" onClick={() => setMenuOpen(false)}>📅 我的預約</Link>
                  <button type="button" onClick={() => { setMenuOpen(false); customerLogout(); }}>登出</button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" className="btn btn-sm btn-line" onClick={() => loginWithLine()}>
              <span className="line-icon">L</span> LINE 登入
            </button>
          )}

          {admin && <Link to="/admin/dashboard" className="btn btn-sm btn-outline">後台</Link>}
        </div>
      </div>
    </nav>
  );
}
