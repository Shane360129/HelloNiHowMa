import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { fetchBookings, updateBooking, deleteBooking } from '../../context/api';

const STATUS_LABEL = {
  pending: '待確認',
  confirmed: '已確認',
  completed: '已完成',
  cancelled: '已取消'
};

const STATUS_OPTIONS = Object.keys(STATUS_LABEL);

export default function ManageBookings() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);

  const load = () => fetchBookings().then(setBookings).catch(err => alert(err.message));

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);

  const handleStatusChange = async (id, status) => {
    try {
      await updateBooking(id, { status });
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('確定要刪除此預約？')) return;
    try {
      await deleteBooking(id);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <AdminLayout>
      <div className="admin-header">
        <h1>預約管理</h1>
        <div className="filter-bar" style={{ margin: 0 }}>
          {['all', ...STATUS_OPTIONS].map(s => (
            <button
              key={s}
              className={`filter-btn ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(s)}
            >
              {s === 'all' ? '全部' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">尚無符合的預約</div>
      ) : (
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th>建立時間</th>
                <th>客人</th>
                <th>聯絡方式</th>
                <th>項目</th>
                <th>預約時段</th>
                <th>狀態</th>
                <th style={{ width: '180px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id}>
                  <td>{new Date(b.createdAt).toLocaleString('zh-TW', { hour12: false })}</td>
                  <td>{b.name}</td>
                  <td>
                    <div>{b.phone}</div>
                    {b.lineId && <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>LINE: {b.lineId}</div>}
                  </td>
                  <td>{b.service}</td>
                  <td>{b.date} {b.time}</td>
                  <td>
                    <select value={b.status} onChange={e => handleStatusChange(b.id, e.target.value)}>
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-outline" onClick={() => setDetail(b)}>詳情</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(b.id)}>刪除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>預約詳情</h2>
            <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.95rem' }}>
              <div><strong>姓名：</strong>{detail.name}</div>
              <div><strong>電話：</strong>{detail.phone}</div>
              {detail.lineId && <div><strong>LINE：</strong>{detail.lineId}</div>}
              <div><strong>項目：</strong>{detail.service}</div>
              <div><strong>時段：</strong>{detail.date} {detail.time}</div>
              <div><strong>狀態：</strong>{STATUS_LABEL[detail.status]}</div>
              <div><strong>建立時間：</strong>{new Date(detail.createdAt).toLocaleString('zh-TW', { hour12: false })}</div>
              {detail.notes && <div><strong>備註：</strong><br/>{detail.notes}</div>}
            </div>
            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setDetail(null)}>關閉</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
