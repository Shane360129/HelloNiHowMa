import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { fetchDashboardStats, fetchLineQuota } from '../../context/api';

const STATUS_LABEL = {
  pending: '待確認',
  confirmed: '已確認',
  completed: '已完成',
  cancelled: '已取消'
};

const SOURCE_LABEL = {
  customer_self: '客戶自助',
  admin_phone: '電話',
  admin_dm: '私訊',
  walk_in: '走入'
};

function timeAgo(date) {
  if (!date) return '—';
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return '剛剛';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [quota, setQuota] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardStats().then(setStats).catch(err => setError(err.message));
    fetchLineQuota().then(setQuota).catch(() => setQuota(null));
  }, []);

  if (error) {
    return (
      <AdminLayout>
        <h1>管理總覽</h1>
        <div className="alert alert-error">{error}</div>
      </AdminLayout>
    );
  }
  if (!stats) {
    return <AdminLayout><div className="loading">載入中...</div></AdminLayout>;
  }

  const quotaLow = quota?.available && quota.quota != null && quota.remaining < 50;

  return (
    <AdminLayout>
      <h1>管理總覽</h1>
      <div className="dashboard-cards">
        <div className="dash-card">
          <h3>今日預約</h3>
          <p className="dash-value">{stats.today.bookings}</p>
          <p className="dash-sub">
            待確認 {stats.today.pending}
            {stats.today.pending > 0 && <span className="dash-dot" />}
          </p>
          <Link to="/admin/bookings" className="btn btn-sm">處理</Link>
        </div>
        <div className="dash-card">
          <h3>本週預約</h3>
          <p className="dash-value">{stats.thisWeek.bookings}</p>
          <p className="dash-sub">起算日週日</p>
          <Link to="/admin/bookings" className="btn btn-sm">查看</Link>
        </div>
        <div className="dash-card">
          <h3>本月預約</h3>
          <p className="dash-value">{stats.thisMonth.bookings}</p>
          <p className="dash-sub">新註冊 {stats.thisMonth.newUsers} 位客戶</p>
          <Link to="/admin/bookings" className="btn btn-sm">查看</Link>
        </div>
        <div className="dash-card">
          <h3>追蹤官方帳號</h3>
          <p className="dash-value">{stats.users.lineFollowers}</p>
          <p className="dash-sub">總客戶 {stats.users.total} 位</p>
          <Link to="/admin/users" className="btn btn-sm">管理</Link>
        </div>
      </div>

      {/* 系統健康 */}
      <h2 style={{ marginTop: '2rem', color: 'var(--primary-dark)', fontSize: '1.1rem' }}>系統狀態</h2>
      <div className="dashboard-cards">
        <div className="dash-card">
          <h3>LINE Webhook</h3>
          <p className="dash-value" style={{ fontSize: '1.1rem', fontWeight: 'normal' }}>
            {stats.lineHealth.lastWebhookType || '—'}
          </p>
          <p className="dash-sub">
            最近事件：{timeAgo(stats.lineHealth.lastWebhookAt)}
          </p>
          <Link to="/admin/audit-logs" className="btn btn-sm btn-outline">查看日誌</Link>
        </div>
        <div className="dash-card" style={quotaLow ? { borderColor: '#c4452f' } : {}}>
          <h3>LINE 推播配額</h3>
          {quota?.available ? (
            <>
              <p className="dash-value" style={{ fontSize: '1.4rem' }}>
                {quota.remaining != null ? `${quota.remaining}` : quota.quota == null ? '不限' : quota.quota}
              </p>
              <p className="dash-sub">
                本月用量：{quota.consumption}
                {quota.quota != null && ` / ${quota.quota}`}
              </p>
            </>
          ) : (
            <>
              <p className="dash-value" style={{ fontSize: '1.1rem', color: 'var(--text-light)' }}>—</p>
              <p className="dash-sub">尚未設定 Channel Access Token</p>
            </>
          )}
          <Link to="/admin/broadcasts" className="btn btn-sm btn-outline">推播管理</Link>
        </div>
        <div className="dash-card">
          <h3>預約來源（本月）</h3>
          <div style={{ marginTop: '0.4rem' }}>
            {(stats.thisMonth.sourceBreakdown || []).length === 0 ? (
              <p className="dash-sub">本月尚無預約</p>
            ) : (
              stats.thisMonth.sourceBreakdown.map(s => (
                <div key={s.source} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 2 }}>
                  <span>{SOURCE_LABEL[s.source] || s.source}</span>
                  <strong>{s.count}</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 即將到來的預約 */}
      <h2 style={{ marginTop: '2.5rem', color: 'var(--primary-dark)', fontSize: '1.1rem' }}>
        即將到來的預約 ({stats.upcomingBookings.length})
      </h2>
      {stats.upcomingBookings.length === 0 ? (
        <div className="empty-state">目前沒有未完成的預約</div>
      ) : (
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th>日期 / 時間</th>
                <th>客人</th>
                <th>項目</th>
                <th>電話</th>
                <th>來源</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody>
              {stats.upcomingBookings.map(b => (
                <tr key={b.id}>
                  <td>{b.date} {b.time}</td>
                  <td>{b.name}</td>
                  <td>{b.service}</td>
                  <td>{b.phone}</td>
                  <td><span className="source-badge">{SOURCE_LABEL[b.source] || b.source}</span></td>
                  <td><span className={`my-booking-status ${b.status}`}>{STATUS_LABEL[b.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
