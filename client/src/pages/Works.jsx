import { useState, useEffect } from 'react';
import { fetchWorks, fetchProfile } from '../context/api';
import Footer from '../components/Footer';

export default function Works() {
  const [works, setWorks] = useState([]);
  const [profile, setProfile] = useState(null);
  const [filter, setFilter] = useState('全部');

  useEffect(() => {
    fetchWorks().then(setWorks);
    fetchProfile().then(setProfile);
  }, []);

  const categories = ['全部', ...new Set(works.map(w => w.category).filter(Boolean))];
  const filtered = filter === '全部' ? works : works.filter(w => w.category === filter);

  return (
    <div className="page">
      <section className="page-header">
        <div className="container">
          <div className="eyebrow">Portfolio</div>
          <h1>作品集</h1>
          <p>每一對眉型，都是為客人量身打造的藝術品</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {categories.length > 1 && (
            <div className="filter-bar">
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`filter-btn ${filter === cat ? 'active' : ''}`}
                  onClick={() => setFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="works-grid">
            {filtered.map(work => (
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

          {filtered.length === 0 && (
            <div className="empty-state">尚未有作品</div>
          )}
        </div>
      </section>

      <Footer profile={profile} />
    </div>
  );
}
