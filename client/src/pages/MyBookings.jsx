import { useState, useEffect, useMemo } from 'react';
import { fetchProfile, fetchMyBookings, cancelMyBooking, updateMyProfile } from '../context/api';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import Footer from '../components/Footer';

const STATUS_LABEL = {
  pending: '待確認',
  confirmed: '已確認',
  completed: '已完成',
  cancelled: '已取消'
};

const TABS = [
  { key: 'upcoming', label: '即將到來' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' }
];

function classifyBooking(b) {
  if (b.status === 'completed') return 'completed';
  if (b.status === 'cancelled') return 'cancelled';
  return 'upcoming';
}

export default function MyBookings() {
  const { user: customer, loginWithLine, loading: customerLoading, refreshMe } = useCustomerAuth();
  const [bookings, setBookings] = useState([]);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    fetchProfile().then(setProfile);
  }, []);

  useEffect(() => {
    if (!customer) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchMyBookings()
      .then(setBookings)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [customer]);

  const visible = useMemo(
    () => bookings.filter(b => classifyBooking(b) === activeTab),
    [bookings, activeTab]
  );

  const handleCancel = async (id) => {
    if (!confirm('確定要取消這筆預約嗎？')) return;
    setBusyId(id);
    try {
      const updated = await cancelMyBooking(id);
      setBookings(prev => prev.map(b => b.id === id ? updated : b));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleReminderToggle = async () => {
    if (!customer) return;
    try {
      await updateMyProfile({ reminderOptIn: !customer.reminderOptIn });
      await refreshMe();
    } catch (err) {
      alert(err.message);
    }
  };

  if (customerLoading) {
    return <div className="loading">載入中...</div>;
  }

  if (!customer) {
    return (
      <div className="page">
        <section className="page-header">
          <div className="container">
            <h1>我的預約</h1>
          </div>
        </section>
        <section className="booking-section">
          <div className="container">
            <div className="login-required-card">
              <h2>請先以 LINE 登入</h2>
              <p>登入後可查看您的預約紀錄與管理個人偏好</p>
              <button type="button" className="btn btn-line btn-lg" onClick={() => loginWithLine('/me/bookings')}>
                <span className="line-icon">L</span> 以 LINE 登入
              </button>
            </div>
          </div>
        </section>
        <Footer profile={profile} />
      </div>
    );
  }

  return (
    <div className="page">
      <section className="page-header">
        <div className="container">
          <div className="eyebrow">My Bookings</div>
          <h1>我的預約</h1>
          <p>{customer.displayName} 您好，這裡是您的預約紀錄</p>
        </div>
      </section>

      <section className="booking-section">
        <div className="container">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="my-booking-tabs">
            {TABS.map(t => {
              const count = bookings.filter(b => classifyBooking(b) === t.key).length;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={activeTab === t.key ? 'active' : ''}
                  onClick={() => setActiveTab(t.key)}
                >
                  {t.label}（{count}）
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="loading">載入中...</div>
          ) : visible.length === 0 ? (
            <div className="placeholder-card">目前沒有此類預約</div>
          ) : (
            <div className="my-bookings-list">
              {visible.map(b => (
                <div key={b.id} className="my-booking-card">
                  <div className="my-booking-meta">
                    <span className={`my-booking-status ${b.status}`}>{STATUS_LABEL[b.status]}</span>
                    <div className="my-booking-title">{b.service}</div>
                    <div className="my-booking-date">{b.date} {b.time}（{b.durationMinutes} 分鐘）</div>
                    {b.notes && <div className="my-booking-date">備註：{b.notes}</div>}
                  </div>
                  <div>
                    {['pending', 'confirmed'].includes(b.status) && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => handleCancel(b.id)}
                        disabled={busyId === b.id}
                      >
                        {busyId === b.id ? '取消中...' : '取消預約'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '3rem', padding: '1.5rem', background: '#fff', borderRadius: '14px', border: '1px solid #efe6d6' }}>
            <h3 style={{ marginTop: 0 }}>個人偏好</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={customer.reminderOptIn !== false}
                onChange={handleReminderToggle}
              />
              <span>接收 LINE 預約提醒（預約前一天）</span>
            </label>
          </div>
        </div>
      </section>

      <Footer profile={profile} />
    </div>
  );
}
