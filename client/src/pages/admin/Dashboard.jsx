import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { fetchBookings, fetchWorks, fetchServices } from '../../context/api';

const STATUS_LABEL = {
  pending: '待確認',
  confirmed: '已確認',
  completed: '已完成',
  cancelled: '已取消'
};

export default function Dashboard() {
  const [bookings, setBookings] = useState([]);
  const [works, setWorks] = useState([]);
  const [services, setServices] = useState([]);

  useEffect(() => {
    fetchBookings().then(setBookings).catch(() => setBookings([]));
    fetchWorks().then(setWorks);
    fetchServices().then(setServices);
  }, []);

  const pending = bookings.filter(b => b.status === 'pending').length;
  const upcoming = bookings.filter(b =>
    b.status !== 'cancelled' && b.status !== 'completed'
  ).length;
  const recent = bookings.slice(0, 5);

  return (
    <AdminLayout>
      <h1>管理總覽</h1>
      <div className="dashboard-cards">
        <div className="dash-card">
          <h3>待確認預約</h3>
          <p className="dash-value">{pending}</p>
          <p className="dash-sub">尚未回覆客人</p>
          <Link to="/admin/bookings" className="btn btn-sm">處理</Link>
        </div>
        <div className="dash-card">
          <h3>進行中預約</h3>
          <p className="dash-value">{upcoming}</p>
          <p className="dash-sub">待確認 + 已確認</p>
          <Link to="/admin/bookings" className="btn btn-sm">查看</Link>
        </div>
        <div className="dash-card">
          <h3>服務項目</h3>
          <p className="dash-value">{services.length}</p>
          <p className="dash-sub">公開於前台</p>
          <Link to="/admin/services" className="btn btn-sm">管理</Link>
        </div>
        <div className="dash-card">
          <h3>作品數量</h3>
          <p className="dash-value">{works.length}</p>
          <p className="dash-sub">已發布作品</p>
          <Link to="/admin/works" className="btn btn-sm">管理</Link>
        </div>
      </div>

      <h2 style={{ marginTop: '2.5rem', color: 'var(--primary-dark)', fontSize: '1.2rem' }}>最近預約</h2>
      {recent.length === 0 ? (
        <div className="empty-state">目前沒有預約紀錄</div>
      ) : (
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th>客人</th>
                <th>項目</th>
                <th>日期 / 時間</th>
                <th>電話</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(b => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>{b.service}</td>
                  <td>{b.date} {b.time}</td>
                  <td>{b.phone}</td>
                  <td><span className={`status-chip status-${b.status}`}>{STATUS_LABEL[b.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
