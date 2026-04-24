import { useState, useEffect } from 'react';
import { fetchProfile, fetchServices, fetchPublicSettings, createBooking } from '../context/api';
import Footer from '../components/Footer';

const todayStr = () => new Date().toISOString().split('T')[0];

export default function Booking() {
  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    lineId: '',
    service: '',
    date: '',
    time: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchProfile().then(setProfile);
    fetchServices().then(list => {
      setServices(list);
      setForm(prev => (prev.service ? prev : { ...prev, service: list[0]?.name || '' }));
    });
    fetchPublicSettings().then(setSettings);
  }, []);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await createBooking(form);
      setMessage(res.message || '預約已送出，感謝您！');
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const bookingDisabled = settings && settings.bookingEnabled === false;

  return (
    <div className="page">
      <section className="page-header">
        <div className="container">
          <div className="eyebrow">Book an Appointment</div>
          <h1>線上預約</h1>
          <p>{settings?.bookingNote || '預約送出後，我們會透過 LINE 或電話確認實際時段'}</p>
        </div>
      </section>

      <section className="booking-section">
        <div className="container">
          <div className="booking-wrap">
            {bookingDisabled ? (
              <div className="alert alert-info">
                目前暫停線上預約，請直接透過 LINE 或電話聯繫我們。
              </div>
            ) : submitted ? (
              <>
                <div className="booking-success">{message}</div>
                <p style={{ textAlign: 'center', color: 'var(--text-light)' }}>
                  您也可以透過以下方式與我們聯繫：
                </p>
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  {profile?.social?.line && (
                    <a className="btn btn-outline btn-sm" href={profile.social.line} target="_blank" rel="noreferrer">加 LINE</a>
                  )}
                  {profile?.phone && (
                    <a className="btn btn-outline btn-sm" href={`tel:${profile.phone}`} style={{ marginLeft: '0.5rem' }}>
                      撥打電話
                    </a>
                  )}
                </div>
              </>
            ) : (
              <>
                <h2>預約表單</h2>
                <p className="subtitle">請留下您的聯絡方式與想預約的時段</p>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>姓名 *</label>
                      <input value={form.name} onChange={e => update('name', e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label>聯絡電話 *</label>
                      <input value={form.phone} onChange={e => update('phone', e.target.value)} required />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>LINE ID（選填）</label>
                    <input value={form.lineId} onChange={e => update('lineId', e.target.value)} placeholder="方便我們後續聯繫您" />
                  </div>

                  <div className="form-group">
                    <label>預約項目 *</label>
                    <select value={form.service} onChange={e => update('service', e.target.value)} required>
                      <option value="" disabled>請選擇服務項目</option>
                      {services.map(s => (
                        <option key={s.id} value={s.name}>
                          {s.name}{s.price ? `（${s.price}）` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>希望日期 *</label>
                      <input type="date" value={form.date} min={todayStr()} onChange={e => update('date', e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label>希望時間 *</label>
                      <input type="time" value={form.time} onChange={e => update('time', e.target.value)} required />
                      <p className="form-hint">{settings?.businessHours || '營業時間依實際公告為準'}</p>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>備註 / 需求</label>
                    <textarea
                      rows={4}
                      value={form.notes}
                      onChange={e => update('notes', e.target.value)}
                      placeholder="例如：第一次做、希望的眉型風格、膚況特殊狀況等"
                    />
                  </div>

                  <button type="submit" className="btn btn-block btn-lg" disabled={loading}>
                    {loading ? '送出中...' : '送出預約'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <Footer profile={profile} />
    </div>
  );
}
