import { useState, useEffect } from 'react';
import { fetchWorks } from '../context/api';

export default function Portfolio() {
  const [works, setWorks] = useState([]);
  const [filter, setFilter] = useState('全部');

  useEffect(() => {
    fetchWorks().then(setWorks);
  }, []);

  const categories = ['全部', ...new Set(works.map(w => w.category))];
  const filtered = filter === '全部' ? works : works.filter(w => w.category === filter);

  return (
    <div className="page">
      <section className="page-header">
        <div className="container">
          <h1>作品集</h1>
          <p>每一款香氛都是一段獨特的故事</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
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

          <div className="works-grid">
            {filtered.map(work => (
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
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <p>&copy; 2024 Fragrance Atelier. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
