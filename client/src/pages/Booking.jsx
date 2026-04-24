import { useState, useEffect } from 'react';
import { fetchProfile, fetchServices, fetchPublicSettings, createBooking } from '../context/api';
import Footer from '../components/Footer';
import BookingCalendar from '../components/BookingCalendar';

const STEPS = [
  { key: 'time', label: '選擇時段' },
  { key: 'info', label: '填寫資訊' },
  { key: 'done', label: '送出預約' }
];

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

  const handlePick = (date, time) => {
    setForm(prev => ({
      ...prev,
      date,
      time: time ?? (prev.date === date ? prev.time : '')
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!form.service) { setError('請選擇預約項目'); return; }
    if (!form.name || !form.phone) { setError('請填寫姓名與聯絡電話'); return; }
    if (!form.date || !form.time) { setError('請於行事曆選擇日期與時段'); return; }
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
  const activeStep = !form.service || !form.date || !form.time ? 0
    : !form.name || !form.phone ? 1 : 2;

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
          {bookingDisabled ? (
            <div className="booking-wrap">
              <div className="alert alert-info">
                目前暫停線上預約，請直接透過 LINE 或電話聯繫我們。
              </div>
            </div>
          ) : submitted ? (
            <div className="booking-wrap">
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
            </div>
          ) : (
            <div className="booking-flow">
              <ol className="booking-steps">
                {STEPS.map((s, i) => (
                  <li
                    key={s.key}
                    className={
                      'booking-step' +
                      (i === activeStep ? ' step-active' : '') +
                      (i < activeStep ? ' step-done' : '')
                    }
                  >
                    <span className="step-num">{i + 1}</span>
                    <span className="step-label">{s.label}</span>
                  </li>
                ))}
              </ol>

              <form onSubmit={handleSubmit} className="booking-form">
                <div className="booking-card">
                  <h2 className="booking-card-title">挑選時段</h2>
                  <p className="booking-card-sub">
                    先選擇預約項目，再從行事曆點選日期；右側會列出可預約的時間，已被預約的時段會打 ✕。
                  </p>

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

                  <BookingCalendar
                    service={form.service}
                    selectedDate={form.date}
                    selectedTime={form.time}
                    onPick={handlePick}
                  />
                  <div className="chosen-slot">
                    {form.date && form.time
                      ? <span><strong>已選：</strong>{form.date}<span className="sep">·</span>{form.time}</span>
                      : <span className="placeholder">尚未選擇時段</span>}
                  </div>
                </div>

                <div className="booking-card">
                  <h2 className="booking-card-title">聯絡資訊</h2>
                  <p className="booking-card-sub">
                    留下聯繫方式，我們會盡快以 LINE 或電話與您確認。
                  </p>

                  {error && <div className="alert alert-error">{error}</div>}

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
                    <label>備註 / 需求</label>
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={e => update('notes', e.target.value)}
                      placeholder="例如：第一次做、希望的眉型風格、膚況特殊狀況等"
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-block btn-lg" disabled={loading}>
                  {loading ? '送出中...' : '送出預約'}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>

      <Footer profile={profile} />
    </div>
  );
}
