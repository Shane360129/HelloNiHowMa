import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchProfile, fetchWorks, fetchServices } from '../context/api';
import Footer from '../components/Footer';

export default function Home() {
  const [profile, setProfile] = useState(null);
  const [works, setWorks] = useState([]);
  const [services, setServices] = useState([]);

  useEffect(() => {
    fetchProfile().then(setProfile);
    fetchWorks().then(data => setWorks(data.filter(w => w.featured).slice(0, 6)));
    fetchServices().then(data => setServices(data.filter(s => s.featured).slice(0, 3)));
  }, []);

  if (!profile) return <div className="loading">載入中...</div>;

  const heroStyle = profile.heroImage
    ? { backgroundImage: `url(${profile.heroImage})` }
    : undefined;

  return (
    <div className="page">
      {/* Hero */}
      <section className="hero">
        <div className="hero-overlay" style={heroStyle} />
        <div className="container hero-content">
          <div className="hero-eyebrow">La Paisley ・ 霧眉美業</div>
          <h1 className="hero-title">La Paisley</h1>
          <p className="hero-subtitle">{profile.tagline || '一對最適合你的眉，從這裡開始'}</p>
          <div className="hero-cta">
            <Link to="/booking" className="btn btn-lg">立即預約</Link>
            <Link to="/works" className="btn btn-lg btn-ghost">瀏覽作品</Link>
          </div>
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
              <div className="eyebrow">About Us</div>
              <h2 className="section-title">{profile.name}</h2>
              <p className="subtitle">{profile.title}</p>
              <p>{profile.bio}</p>
              <div className="about-meta">
                {profile.location && <span>{profile.location}</span>}
                {profile.phone && <span>{profile.phone}</span>}
                {profile.email && <span>{profile.email}</span>}
              </div>
              <div style={{ marginTop: '2rem' }}>
                <Link to="/services" className="btn btn-outline btn-sm">查看服務項目</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="section section-alt">
        <div className="container">
          <div className="center">
            <div className="eyebrow">Signature Services</div>
            <h2 className="section-title center">精選服務項目</h2>
            <p className="section-lead">從自然的柔霧眉到根根分明的線條眉，量身打造最適合你臉型與氣質的眉型。</p>
          </div>
          <div className="services-grid">
            {services.map(s => (
              <div key={s.id} className="service-card">
                {s.image && (
                  <div className="svc-image">
                    <img src={s.image} alt={s.name} />
                  </div>
                )}
                <div className="svc-body">
                  {s.subtitle && <span className="svc-subtitle">{s.subtitle}</span>}
                  <h3 className="svc-name">{s.name}</h3>
                  <p className="svc-desc">{s.description}</p>
                  <div className="svc-meta">
                    <span className="svc-price">{s.price}</span>
                    <span className="svc-duration">{s.duration}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="center" style={{ marginTop: '2.5rem' }}>
            <Link to="/services" className="btn">查看所有服務</Link>
          </div>
        </div>
      </section>

      {/* Featured Works */}
      <section className="section">
        <div className="container">
          <div className="center">
            <div className="eyebrow">Recent Works</div>
            <h2 className="section-title center">精選作品</h2>
            <p className="section-lead">每一對眉型都是為客人量身設計，記錄真實案例與自然的前後變化。</p>
          </div>
          <div className="works-grid">
            {works.map(work => (
              <div key={work.id} className="work-card">
                <div className="work-image">
                  <img src={work.image} alt={work.title} />
                  {work.category && <span className="work-category">{work.category}</span>}
                </div>
                <div className="work-info">
                  <h3>{work.title}</h3>
                  <p>{work.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="center" style={{ marginTop: '2.5rem' }}>
            <Link to="/works" className="btn btn-outline">查看全部作品</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-banner">
        <div className="container">
          <h2>準備好擁有一對屬於你的眉了嗎？</h2>
          <p>線上填寫預約單，我們會在 24 小時內透過 LINE 或電話與你確認。</p>
          <Link to="/booking" className="btn btn-ghost btn-lg">線上預約</Link>
        </div>
      </section>

      <Footer profile={profile} />
    </div>
  );
}
