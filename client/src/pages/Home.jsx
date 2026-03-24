import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchProfile, fetchWorks } from '../context/api';

export default function Home() {
  const [profile, setProfile] = useState(null);
  const [works, setWorks] = useState([]);

  useEffect(() => {
    fetchProfile().then(setProfile);
    fetchWorks().then(data => setWorks(data.filter(w => w.featured)));
  }, []);

  if (!profile) return <div className="loading">載入中...</div>;

  return (
    <div className="page">
      {/* Hero */}
      <section className="hero">
        <div className="hero-overlay" />
        <div className="container hero-content">
          <h1 className="hero-title">Fragrance Atelier</h1>
          <p className="hero-subtitle">探索香氛的藝術與美學</p>
          <Link to="/portfolio" className="btn btn-lg">瀏覽作品集</Link>
        </div>
      </section>

      {/* About */}
      <section className="section">
        <div className="container">
          <div className="about-grid">
            <div className="about-image">
              <img src={profile.avatar} alt={profile.name} />
            </div>
            <div className="about-text">
              <h2 className="section-title">關於我</h2>
              <h3>{profile.name}</h3>
              <p className="subtitle">{profile.title}</p>
              <p>{profile.bio}</p>
              <div className="contact-info">
                <p>📍 {profile.location}</p>
                <p>✉️ {profile.email}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Works */}
      <section className="section section-alt">
        <div className="container">
          <h2 className="section-title center">精選作品</h2>
          <div className="works-grid">
            {works.map(work => (
              <div key={work.id} className="work-card">
                <div className="work-image">
                  <img src={work.image} alt={work.title} />
                  <span className="work-category">{work.category}</span>
                </div>
                <div className="work-info">
                  <h3>{work.title}</h3>
                  <p>{work.description}</p>
                  {work.notes && (
                    <div className="work-notes">
                      <span><strong>前調：</strong>{work.notes.top}</span>
                      <span><strong>中調：</strong>{work.notes.middle}</span>
                      <span><strong>基調：</strong>{work.notes.base}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="center" style={{ marginTop: '2rem' }}>
            <Link to="/portfolio" className="btn">查看全部作品</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>&copy; 2024 Fragrance Atelier by {profile.name}. All rights reserved.</p>
          <div className="social-links">
            {profile.social?.instagram && <a href={profile.social.instagram} target="_blank" rel="noreferrer">Instagram</a>}
            {profile.social?.facebook && <a href={profile.social.facebook} target="_blank" rel="noreferrer">Facebook</a>}
          </div>
        </div>
      </footer>
    </div>
  );
}
