import { Link } from 'react-router-dom';

export default function Footer({ profile }) {
  const year = new Date().getFullYear();
  const social = profile?.social || {};
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="logo">La <span className="logo-accent">Paisley</span></Link>
            <p>{profile?.tagline || '專業霧眉・線條眉・韓式漸層眉，一對最適合你的眉，從這裡開始。'}</p>
          </div>
          <div>
            <h4>Menu</h4>
            <ul>
              <li><Link to="/services">服務項目</Link></li>
              <li><Link to="/works">作品集</Link></li>
              <li><Link to="/booking">線上預約</Link></li>
            </ul>
          </div>
          <div>
            <h4>Contact</h4>
            {profile?.phone && <p>📞 {profile.phone}</p>}
            {profile?.email && <p>✉️ {profile.email}</p>}
            {profile?.location && <p>📍 {profile.location}</p>}
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; {year} La Paisley ・ All rights reserved.</span>
          <div className="social-links">
            {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer">Instagram</a>}
            {social.line && <a href={social.line} target="_blank" rel="noreferrer">LINE</a>}
            {social.facebook && <a href={social.facebook} target="_blank" rel="noreferrer">Facebook</a>}
            {social.threads && <a href={social.threads} target="_blank" rel="noreferrer">Threads</a>}
          </div>
        </div>
      </div>
    </footer>
  );
}
