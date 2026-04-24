import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LINKS = [
  { path: '/admin/dashboard', label: '總覽' },
  { path: '/admin/bookings', label: '預約管理' },
  { path: '/admin/services', label: '服務項目' },
  { path: '/admin/works', label: '作品管理' },
  { path: '/admin/news', label: '最新消息' },
  { path: '/admin/profile', label: '個人資訊' },
  { path: '/admin/settings', label: '系統設定' }
];

export default function AdminLayout({ children }) {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  const activeLabel = LINKS.find(l => l.path === location.pathname)?.label || '管理後台';

  return (
    <div className="admin-layout">
      <header className="admin-topbar">
        <button
          type="button"
          className="admin-hamburger"
          aria-label="開啟選單"
          onClick={() => setOpen(true)}
        >
          <span /><span /><span />
        </button>
        <span className="admin-topbar-title">{activeLabel}</span>
        <Link to="/" className="admin-topbar-link">前台</Link>
      </header>

      {open && <div className="admin-drawer-backdrop" onClick={() => setOpen(false)} />}

      <aside className={'admin-sidebar' + (open ? ' admin-sidebar-open' : '')}>
        <div className="sidebar-header">
          <Link to="/" className="logo">La <span className="logo-accent">Paisley</span></Link>
          <span className="badge">管理後台</span>
        </div>
        <nav className="sidebar-nav">
          {LINKS.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className={location.pathname === link.path ? 'active' : ''}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Link to="/" className="btn btn-outline btn-sm btn-block">前往前台</Link>
          <button onClick={handleLogout} className="btn btn-danger btn-sm btn-block">登出</button>
        </div>
      </aside>

      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
