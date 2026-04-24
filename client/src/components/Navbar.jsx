import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user } = useAuth();
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="container navbar-content">
        <Link to="/" className="logo">La <span className="logo-accent">Paisley</span></Link>
        <div className="nav-links">
          <Link to="/" className={isActive('/') ? 'active' : ''}>首頁</Link>
          <Link to="/services" className={isActive('/services') ? 'active' : ''}>服務項目</Link>
          <Link to="/works" className={isActive('/works') ? 'active' : ''}>作品集</Link>
          <Link to="/booking" className="btn btn-sm">立即預約</Link>
          {user && <Link to="/admin/dashboard" className="btn btn-sm btn-outline">後台</Link>}
        </div>
      </div>
    </nav>
  );
}
