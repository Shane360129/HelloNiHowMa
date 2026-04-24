import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchServices, fetchProfile } from '../context/api';
import Footer from '../components/Footer';

export default function Services() {
  const [services, setServices] = useState([]);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    fetchServices().then(setServices);
    fetchProfile().then(setProfile);
  }, []);

  return (
    <div className="page">
      <section className="page-header">
        <div className="container">
          <div className="eyebrow">Our Services</div>
          <h1>服務項目與價格</h1>
          <p>所有項目皆採預約制・含完整諮詢、眉型設計與術後衛教</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
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

          {services.length === 0 && (
            <div className="empty-state">目前尚未公開任何服務項目</div>
          )}

          <div className="center" style={{ marginTop: '3rem' }}>
            <Link to="/booking" className="btn btn-lg">我要預約</Link>
          </div>
        </div>
      </section>

      <Footer profile={profile} />
    </div>
  );
}
