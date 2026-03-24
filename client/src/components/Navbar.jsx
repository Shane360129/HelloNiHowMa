import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="container navbar-content">
        <Link to="/" className="logo">Fragrance Atelier</Link>
        <div className="nav-links">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>首頁</Link>
          <Link to="/portfolio" className={location.pathname === '/portfolio' ? 'active' : ''}>作品集</Link>
          {user ? (
            <Link to="/admin/dashboard" className="btn btn-sm">管理後台</Link>
          ) : (
            <Link to="/admin" className="btn btn-sm">管理登入</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
