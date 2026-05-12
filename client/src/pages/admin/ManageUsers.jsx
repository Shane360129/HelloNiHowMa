import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import {
  fetchAdminUsers,
  fetchAdminUser,
  updateAdminUser,
  createAdminUser,
  deleteAdminUser
} from '../../context/api';

const SOURCE_LABEL = {
  line: 'LINE',
  walk_in: '走入',
  phone: '電話',
  dm: '私訊'
};
const SOURCE_BADGE_CLASS = {
  line: 'badge-line',
  walk_in: 'badge-walkin',
  phone: 'badge-phone',
  dm: 'badge-dm'
};

const BOOKING_STATUS_LABEL = {
  pending: '待確認',
  confirmed: '已確認',
  completed: '已完成',
  cancelled: '已取消'
};

export default function ManageUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ source: '', search: '', hasLine: '', blocked: '' });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminUsers(filters);
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => ({
    total: users.length,
    line: users.filter(u => u.lineUserId).length,
    offline: users.filter(u => !u.lineUserId).length,
    following: users.filter(u => u.isFollowingOA).length,
    blocked: users.filter(u => u.blocked).length
  }), [users]);

  return (
    <AdminLayout>
      <div className="admin-header">
        <h1>LINE 客戶</h1>
        <button type="button" className="btn btn-sm" onClick={() => setCreateOpen(true)}>+ 新增客戶</button>
      </div>

      <div className="user-stat-row">
        <div className="user-stat"><div className="user-stat-num">{totals.total}</div><div className="user-stat-label">總用戶</div></div>
        <div className="user-stat"><div className="user-stat-num">{totals.line}</div><div className="user-stat-label">LINE 用戶</div></div>
        <div className="user-stat"><div className="user-stat-num">{totals.offline}</div><div className="user-stat-label">離線用戶</div></div>
        <div className="user-stat"><div className="user-stat-num">{totals.following}</div><div className="user-stat-label">追蹤官方帳號</div></div>
        <div className="user-stat"><div className="user-stat-num">{totals.blocked}</div><div className="user-stat-label">黑名單</div></div>
      </div>

      <div className="filter-bar" style={{ marginTop: '1rem' }}>
        <input
          className="filter-search"
          placeholder="搜尋姓名 / 電話 / LINE ID"
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
        />
        <select
          value={filters.source}
          onChange={e => setFilters(f => ({ ...f, source: e.target.value }))}
        >
          <option value="">全部來源</option>
          <option value="line">LINE</option>
          <option value="walk_in">走入</option>
          <option value="phone">電話</option>
          <option value="dm">私訊</option>
        </select>
        <select
          value={filters.hasLine}
          onChange={e => setFilters(f => ({ ...f, hasLine: e.target.value }))}
        >
          <option value="">全部 (含/不含 LINE)</option>
          <option value="true">已綁定 LINE</option>
          <option value="false">未綁定 LINE</option>
        </select>
        <select
          value={filters.blocked}
          onChange={e => setFilters(f => ({ ...f, blocked: e.target.value }))}
        >
          <option value="">全部 (含黑名單)</option>
          <option value="false">非黑名單</option>
          <option value="true">僅黑名單</option>
        </select>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{error}</div>}

      {loading ? (
        <div className="loading">載入中...</div>
      ) : users.length === 0 ? (
        <div className="empty-state">尚無符合的客戶</div>
      ) : (
        <div className="admin-table" style={{ marginTop: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th>客戶</th>
                <th>來源</th>
                <th>電話</th>
                <th>標籤</th>
                <th>預約次數</th>
                <th>最後預約</th>
                <th>建立時間</th>
                <th style={{ width: 100 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} onClick={() => openDetail(u.id, setDetail)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {u.pictureUrl
                        ? <img src={u.pictureUrl} alt="" className="user-avatar" />
                        : <span className="user-avatar user-avatar-fallback">{u.displayName?.[0] || '?'}</span>}
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {u.displayName}
                          {u.blocked && <span className="badge-block" style={{ marginLeft: 6 }}>黑名單</span>}
                        </div>
                        {u.lineUserId && <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>LINE: {u.lineUserId.slice(0, 12)}…</div>}
                      </div>
                    </div>
                  </td>
                  <td><span className={`source-badge ${SOURCE_BADGE_CLASS[u.source]}`}>{SOURCE_LABEL[u.source]}</span></td>
                  <td>{u.phone || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                  <td>
                    {(u.tags || []).map(t => <span key={t} className="tag-chip">{t}</span>)}
                  </td>
                  <td>{u.bookingCount ?? 0}</td>
                  <td>{u.lastBookingDate || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                    {new Date(u.createdAt).toLocaleDateString('zh-TW')}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn btn-sm btn-outline" onClick={() => openDetail(u.id, setDetail)}>詳情</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <UserDetailDrawer
          detail={detail}
          onClose={() => setDetail(null)}
          onSaved={() => { load(); }}
          onDelete={async () => {
            if (!confirm(`確定刪除 ${detail.user.displayName}？歷史預約將保留但不再連結到此客戶。`)) return;
            try {
              await deleteAdminUser(detail.user.id);
              setDetail(null);
              load();
            } catch (err) {
              alert(err.message);
            }
          }}
          onCreateBooking={(user) => {
            navigate(`/admin/bookings?createForUser=${user.id}`);
          }}
        />
      )}

      {createOpen && (
        <CreateUserModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); load(); }}
        />
      )}
    </AdminLayout>
  );
}

async function openDetail(id, setDetail) {
  try {
    const data = await fetchAdminUser(id);
    setDetail(data);
  } catch (err) {
    alert(err.message);
  }
}

function UserDetailDrawer({ detail, onClose, onSaved, onDelete, onCreateBooking }) {
  const { user, bookings } = detail;
  const [form, setForm] = useState({
    displayName: user.displayName,
    phone: user.phone || '',
    email: user.email || '',
    tags: user.tags || [],
    notes: user.notes || '',
    blocked: user.blocked,
    reminderOptIn: user.reminderOptIn
  });
  const [tagDraft, setTagDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleAddTag = () => {
    const t = tagDraft.trim();
    if (!t) return;
    if (form.tags.includes(t)) { setTagDraft(''); return; }
    upd('tags', [...form.tags, t]);
    setTagDraft('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAdminUser(user.id, form);
      onSaved();
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h2>客戶詳情</h2>
          <button type="button" className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">
          <div className="user-profile-block">
            {user.pictureUrl
              ? <img src={user.pictureUrl} alt="" className="user-avatar-lg" />
              : <span className="user-avatar-lg user-avatar-fallback">{user.displayName?.[0] || '?'}</span>}
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{user.displayName}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                <span className={`source-badge ${SOURCE_BADGE_CLASS[user.source]}`}>{SOURCE_LABEL[user.source]}</span>
                {user.lineUserId && <span style={{ marginLeft: 6 }}>· LINE: {user.lineUserId}</span>}
              </div>
              {user.isFollowingOA && <div style={{ fontSize: '0.8rem', color: '#06c755', marginTop: 4 }}>● 已追蹤官方帳號</div>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>姓名</label>
              <input value={form.displayName} onChange={e => upd('displayName', e.target.value)} />
            </div>
            <div className="form-group">
              <label>電話</label>
              <input value={form.phone} onChange={e => upd('phone', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Email</label>
            <input value={form.email} onChange={e => upd('email', e.target.value)} />
          </div>

          <div className="form-group">
            <label>標籤</label>
            <div className="tag-list">
              {form.tags.map(t => (
                <span key={t} className="tag-chip">
                  {t}
                  <button type="button" onClick={() => upd('tags', form.tags.filter(x => x !== t))}>×</button>
                </span>
              ))}
              <input
                className="tag-input"
                placeholder="輸入後按 Enter"
                value={tagDraft}
                onChange={e => setTagDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
              />
            </div>
          </div>

          <div className="form-group">
            <label>內部備註（客戶看不到）</label>
            <textarea rows={3} value={form.notes} onChange={e => upd('notes', e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-group checkbox-group">
              <label>
                <input type="checkbox" checked={!!form.blocked} onChange={e => upd('blocked', e.target.checked)} />
                列入黑名單（禁止預約）
              </label>
            </div>
            <div className="form-group checkbox-group">
              <label>
                <input type="checkbox" checked={form.reminderOptIn !== false} onChange={e => upd('reminderOptIn', e.target.checked)} />
                接收預約提醒
              </label>
            </div>
          </div>

          <h3 style={{ marginTop: '1.5rem' }}>歷史預約 ({bookings.length})</h3>
          {bookings.length === 0 ? (
            <div className="empty-state">尚無預約紀錄</div>
          ) : (
            <div className="history-list">
              {bookings.map(b => (
                <div key={b.id} className="history-row">
                  <div>
                    <div style={{ fontWeight: 500 }}>{b.service}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                      {b.date} {b.time} · 來源：{SOURCE_LABEL[b.source] || b.source}
                    </div>
                  </div>
                  <span className={`my-booking-status ${b.status}`}>{BOOKING_STATUS_LABEL[b.status]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="drawer-footer">
          <button type="button" className="btn btn-danger" onClick={onDelete}>刪除客戶</button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-outline" onClick={() => onCreateBooking(user)}>+ 建立預約</button>
          <button type="button" className="btn" onClick={handleSave} disabled={saving}>
            {saving ? '儲存中…' : '儲存變更'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    displayName: '',
    phone: '',
    email: '',
    source: 'walk_in',
    tags: [],
    notes: ''
  });
  const [tagDraft, setTagDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const upd = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await createAdminUser(form);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>新增客戶</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit} className="admin-form" style={{ marginTop: '0.5rem' }}>
          <div className="form-row">
            <div className="form-group">
              <label>姓名 *</label>
              <input value={form.displayName} onChange={e => upd('displayName', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>電話 *</label>
              <input value={form.phone} onChange={e => upd('phone', e.target.value)} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => upd('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label>來源 *</label>
              <select value={form.source} onChange={e => upd('source', e.target.value)}>
                <option value="walk_in">走入</option>
                <option value="phone">電話</option>
                <option value="dm">私訊</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>標籤</label>
            <div className="tag-list">
              {form.tags.map(t => (
                <span key={t} className="tag-chip">
                  {t}
                  <button type="button" onClick={() => upd('tags', form.tags.filter(x => x !== t))}>×</button>
                </span>
              ))}
              <input
                className="tag-input"
                placeholder="輸入後按 Enter"
                value={tagDraft}
                onChange={e => setTagDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const t = tagDraft.trim();
                    if (t && !form.tags.includes(t)) upd('tags', [...form.tags, t]);
                    setTagDraft('');
                  }
                }}
              />
            </div>
          </div>
          <div className="form-group">
            <label>內部備註</label>
            <textarea rows={3} value={form.notes} onChange={e => upd('notes', e.target.value)} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>取消</button>
            <button type="submit" className="btn" disabled={saving}>{saving ? '建立中…' : '建立'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
