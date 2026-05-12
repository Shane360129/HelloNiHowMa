import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import BookingCalendar from '../../components/BookingCalendar';
import {
  fetchBookings,
  updateBooking,
  deleteBooking,
  createAdminBooking,
  fetchServices,
  lookupUserByPhone,
  fetchAdminUser
} from '../../context/api';

const STATUS_LABEL = {
  pending: '待確認',
  confirmed: '已確認',
  completed: '已完成',
  cancelled: '已取消'
};
const STATUS_OPTIONS = Object.keys(STATUS_LABEL);

const SOURCE_LABEL = {
  customer_self: '客戶自助',
  admin_phone: '電話',
  admin_dm: '私訊',
  walk_in: '走入'
};
const SOURCE_BADGE_CLASS = {
  customer_self: 'badge-line',
  admin_phone: 'badge-phone',
  admin_dm: 'badge-dm',
  walk_in: 'badge-walkin'
};

export default function ManageBookings() {
  const [params, setParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [detail, setDetail] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [prefillUser, setPrefillUser] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchBookings();
      setBookings(data);
    } catch (err) {
      alert(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    fetchServices().then(setServices).catch(() => {});
  }, [load]);

  // 從 URL 取得 ?createForUser=X，自動開啟 drawer 並預填
  useEffect(() => {
    const userId = params.get('createForUser');
    if (!userId) return;
    fetchAdminUser(userId)
      .then(({ user }) => {
        setPrefillUser(user);
        setCreateOpen(true);
        const next = new URLSearchParams(params);
        next.delete('createForUser');
        setParams(next, { replace: true });
      })
      .catch(err => alert(err.message));
  }, [params, setParams]);

  const filtered = useMemo(() =>
    bookings.filter(b =>
      (statusFilter === 'all' || b.status === statusFilter) &&
      (sourceFilter === 'all' || b.source === sourceFilter)
    ), [bookings, statusFilter, sourceFilter]
  );

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
        <button type="button" className="btn btn-sm" onClick={() => { setPrefillUser(null); setCreateOpen(true); }}>
          + 新增預約
        </button>
      </div>

      <div className="filter-bar" style={{ marginTop: '0.5rem' }}>
        {['all', ...STATUS_OPTIONS].map(s => (
          <button
            key={s}
            className={`filter-btn ${statusFilter === s ? 'active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? '全部狀態' : STATUS_LABEL[s]}
          </button>
        ))}
        <span style={{ width: '1px', alignSelf: 'stretch', background: '#eee' }} />
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="all">全部來源</option>
          {Object.entries(SOURCE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
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
                <th>來源</th>
                <th>項目</th>
                <th>預約時段</th>
                <th>狀態</th>
                <th style={{ width: '180px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id}>
                  <td style={{ fontSize: '0.85rem' }}>
                    {new Date(b.createdAt).toLocaleString('zh-TW', { hour12: false })}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{b.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{b.phone}</div>
                    {b.internalNotes && <div style={{ fontSize: '0.75rem', color: '#8a6800' }}>📝 內部備註</div>}
                  </td>
                  <td>
                    <span className={`source-badge ${SOURCE_BADGE_CLASS[b.source] || ''}`}>
                      {SOURCE_LABEL[b.source] || b.source}
                    </span>
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
        <DetailModal
          detail={detail}
          onClose={() => setDetail(null)}
          onSaved={() => { setDetail(null); load(); }}
        />
      )}

      {createOpen && (
        <CreateBookingDrawer
          services={services}
          prefillUser={prefillUser}
          onClose={() => { setCreateOpen(false); setPrefillUser(null); }}
          onCreated={() => { setCreateOpen(false); setPrefillUser(null); load(); }}
        />
      )}
    </AdminLayout>
  );
}

function DetailModal({ detail, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: detail.name,
    phone: detail.phone,
    lineId: detail.lineId || '',
    service: detail.service,
    date: detail.date,
    time: detail.time,
    notes: detail.notes || '',
    internalNotes: detail.internalNotes || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await updateBooking(detail.id, form);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <h2>預約詳情</h2>
        <div style={{ marginBottom: '0.6rem' }}>
          <span className={`source-badge ${SOURCE_BADGE_CLASS[detail.source] || ''}`}>
            {SOURCE_LABEL[detail.source] || detail.source}
          </span>
          {' '}
          <span className={`my-booking-status ${detail.status}`}>{STATUS_LABEL[detail.status]}</span>
          {' · 建立於 '}
          {new Date(detail.createdAt).toLocaleString('zh-TW', { hour12: false })}
        </div>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-row">
          <div className="form-group">
            <label>姓名</label>
            <input value={form.name} onChange={e => upd('name', e.target.value)} />
          </div>
          <div className="form-group">
            <label>電話</label>
            <input value={form.phone} onChange={e => upd('phone', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>LINE ID</label>
            <input value={form.lineId} onChange={e => upd('lineId', e.target.value)} />
          </div>
          <div className="form-group">
            <label>項目</label>
            <input value={form.service} onChange={e => upd('service', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>日期</label>
            <input type="date" value={form.date} onChange={e => upd('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label>時間</label>
            <input type="time" value={form.time} onChange={e => upd('time', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>客戶備註</label>
          <textarea rows={2} value={form.notes} onChange={e => upd('notes', e.target.value)} />
        </div>
        <div className="form-group">
          <label>內部備註（客戶看不到）</label>
          <textarea rows={2} value={form.internalNotes} onChange={e => upd('internalNotes', e.target.value)} />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>關閉</button>
          <button type="button" className="btn" onClick={handleSave} disabled={saving}>
            {saving ? '儲存中…' : '儲存變更'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateBookingDrawer({ services, prefillUser, onClose, onCreated }) {
  const [form, setForm] = useState(() => ({
    source: 'admin_phone',
    name: prefillUser?.displayName || '',
    phone: prefillUser?.phone || '',
    lineId: prefillUser?.lineUserId || '',
    userId: prefillUser?.id || null,
    service: services[0]?.name || '',
    date: '',
    time: '',
    durationMinutes: '',
    notes: '',
    internalNotes: '',
    status: 'pending',
    ignoreConflict: false
  }));
  const [phoneLookup, setPhoneLookup] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lookupTimer = useRef(null);
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // 同電話即時搜尋
  useEffect(() => {
    if (!form.phone || form.phone.length < 4 || form.userId) {
      setPhoneLookup(null);
      return;
    }
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(async () => {
      try {
        const data = await lookupUserByPhone(form.phone);
        setPhoneLookup(data);
      } catch {
        setPhoneLookup(null);
      }
    }, 300);
    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
  }, [form.phone, form.userId]);

  const linkExistingUser = (user) => {
    upd('userId', user.id);
    upd('name', user.displayName || form.name);
    upd('lineId', user.lineUserId || '');
    setPhoneLookup(null);
  };

  const unlinkUser = () => {
    upd('userId', null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.phone || !form.service || !form.date || !form.time) {
      setError('請填寫姓名、電話、項目、日期與時間');
      return;
    }
    setSaving(true);
    try {
      await createAdminBooking({
        ...form,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer drawer-wide" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h2>+ 新增預約（代客建立）</h2>
          <button type="button" className="drawer-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="drawer-body">
            <div className="form-group">
              <label>來源 *</label>
              <div className="filter-bar" style={{ margin: 0 }}>
                {Object.entries(SOURCE_LABEL).filter(([k]) => k !== 'customer_self').map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    className={`filter-btn ${form.source === k ? 'active' : ''}`}
                    onClick={() => upd('source', k)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>姓名 *</label>
                <input value={form.name} onChange={e => upd('name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>電話 *</label>
                <input value={form.phone} onChange={e => upd('phone', e.target.value)} required />
                {form.userId && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 4 }}>
                    ● 已連結到既有客戶（User #{form.userId}）
                    <button type="button" className="btn-link" onClick={unlinkUser}>解除</button>
                  </div>
                )}
              </div>
            </div>

            {phoneLookup && !form.userId && (phoneLookup.user || phoneLookup.recentBookings.length > 0) && (
              <div className="phone-lookup-card">
                {phoneLookup.user ? (
                  <>
                    <div style={{ fontWeight: 500 }}>
                      🔍 找到既有客戶：{phoneLookup.user.displayName}
                      {phoneLookup.user.lineUserId && <span style={{ color: '#06c755', marginLeft: 6 }}>● 已綁定 LINE</span>}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                      過去 {phoneLookup.recentBookings.length} 筆預約
                    </div>
                    <button type="button" className="btn btn-sm" onClick={() => linkExistingUser(phoneLookup.user)}>
                      連結此客戶
                    </button>
                  </>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                    📋 此電話過去曾有 {phoneLookup.recentBookings.length} 筆預約（未連結 User）
                  </div>
                )}
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>LINE ID（選填）</label>
                <input
                  value={form.lineId}
                  onChange={e => upd('lineId', e.target.value)}
                  disabled={!!form.userId}
                />
              </div>
              <div className="form-group">
                <label>項目 *</label>
                <select value={form.service} onChange={e => upd('service', e.target.value)} required>
                  <option value="" disabled>選擇項目</option>
                  {services.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.name}{s.durationMinutes ? ` (${s.durationMinutes} 分)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>選擇日期與時段</label>
              <BookingCalendar
                service={form.service}
                selectedDate={form.date}
                selectedTime={form.time}
                onPick={(date, time) => {
                  upd('date', date);
                  upd('time', time ?? '');
                }}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>日期（也可手動填）</label>
                <input type="date" value={form.date} onChange={e => upd('date', e.target.value)} />
              </div>
              <div className="form-group">
                <label>時間（手動填）</label>
                <input type="time" value={form.time} onChange={e => upd('time', e.target.value)} />
              </div>
              <div className="form-group">
                <label>時長（分鐘，留空依服務）</label>
                <input
                  type="number"
                  value={form.durationMinutes}
                  onChange={e => upd('durationMinutes', e.target.value)}
                  placeholder="auto"
                />
              </div>
            </div>

            <div className="form-group checkbox-group">
              <label style={{ color: form.ignoreConflict ? '#c4452f' : 'inherit' }}>
                <input
                  type="checkbox"
                  checked={form.ignoreConflict}
                  onChange={e => upd('ignoreConflict', e.target.checked)}
                />
                ⚠ 忽略時段衝突 / 公休（強制建立）
              </label>
            </div>

            <div className="form-group">
              <label>客戶備註</label>
              <textarea rows={2} value={form.notes} onChange={e => upd('notes', e.target.value)} />
            </div>
            <div className="form-group">
              <label>內部備註（客戶看不到）</label>
              <textarea rows={2} value={form.internalNotes} onChange={e => upd('internalNotes', e.target.value)} />
            </div>

            <div className="form-group">
              <label>建立後狀態</label>
              <div className="filter-bar" style={{ margin: 0 }}>
                <button
                  type="button"
                  className={`filter-btn ${form.status === 'pending' ? 'active' : ''}`}
                  onClick={() => upd('status', 'pending')}
                >
                  待確認（暫不通知）
                </button>
                <button
                  type="button"
                  className={`filter-btn ${form.status === 'confirmed' ? 'active' : ''}`}
                  onClick={() => upd('status', 'confirmed')}
                >
                  已確認（推播預約成功訊息）
                </button>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: 4 }}>
                D2：建立時不打擾客戶，等狀態切到「已確認」才推播「預約成功」訊息（需客戶已綁定 LINE）。
              </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
          </div>
          <div className="drawer-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>取消</button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? '建立中…' : '建立預約'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
