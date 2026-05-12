import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { fetchAuditLogs } from '../../context/api';

const ACTION_LABEL = {
  'booking.create': '建立預約',
  'booking.update': '更新預約',
  'booking.delete': '刪除預約',
  'booking.confirm.via_line': 'LINE 內確認預約',
  'booking.cancel.via_line': 'LINE 內取消預約',
  'user.create': '建立客戶',
  'user.update': '更新客戶',
  'user.delete': '刪除客戶',
  'template.update': '更新訊息模板',
  'broadcast.send': '發送推播',
  'settings.update': '更新系統設定',
  'richmenu.set_default': '設定預設 Rich Menu',
  'richmenu.clear_default': '清除預設 Rich Menu',
  'richmenu.delete': '刪除 Rich Menu'
};

const TARGET_TYPES = ['', 'Booking', 'User', 'MessageTemplate', 'Broadcast', 'Setting', 'RichMenu'];

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [filters, setFilters] = useState({ action: '', targetType: '' });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs({ ...filters, page, pageSize });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const actionOptions = Object.entries(ACTION_LABEL);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminLayout>
      <div className="admin-header">
        <h1>稽核日誌</h1>
      </div>

      <div className="filter-bar" style={{ marginTop: '0.5rem' }}>
        <select value={filters.action} onChange={e => { setFilters(f => ({ ...f, action: e.target.value })); setPage(1); }}>
          <option value="">全部動作</option>
          {actionOptions.map(([k, v]) => <option key={k} value={k}>{v}（{k}）</option>)}
        </select>
        <select value={filters.targetType} onChange={e => { setFilters(f => ({ ...f, targetType: e.target.value })); setPage(1); }}>
          <option value="">全部資源類型</option>
          {TARGET_TYPES.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
          共 {total} 筆 · 第 {page} / {totalPages} 頁
        </span>
      </div>

      {loading ? (
        <div className="loading">載入中...</div>
      ) : logs.length === 0 ? (
        <div className="empty-state">尚無稽核紀錄</div>
      ) : (
        <div className="admin-table" style={{ marginTop: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th>時間</th>
                <th>操作者</th>
                <th>動作</th>
                <th>目標</th>
                <th>IP</th>
                <th style={{ width: 80 }}>詳情</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: '0.85rem' }}>
                    {new Date(log.createdAt).toLocaleString('zh-TW', { hour12: false })}
                  </td>
                  <td>{log.adminUsername || (log.adminId ? `admin#${log.adminId}` : '—')}</td>
                  <td>
                    <div>{ACTION_LABEL[log.action] || log.action}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>
                      <code>{log.action}</code>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {log.targetType ? `${log.targetType} #${log.targetId}` : '—'}
                  </td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{log.ip || '—'}</td>
                  <td>
                    <button className="btn btn-sm btn-outline" onClick={() => setDetail(log)}>檢視</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '1rem' }}>
        <button className="btn btn-sm btn-outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>上一頁</button>
        <span style={{ alignSelf: 'center', fontSize: '0.85rem' }}>第 {page} / {totalPages} 頁</span>
        <button className="btn btn-sm btn-outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>下一頁</button>
      </div>

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <h2>稽核紀錄詳情</h2>
            <div style={{ display: 'grid', gap: '0.4rem', marginBottom: '1rem' }}>
              <div><strong>時間：</strong>{new Date(detail.createdAt).toLocaleString('zh-TW', { hour12: false })}</div>
              <div><strong>操作者：</strong>{detail.adminUsername || (detail.adminId ? `admin#${detail.adminId}` : '—')}</div>
              <div><strong>動作：</strong>{ACTION_LABEL[detail.action] || detail.action} <code>{detail.action}</code></div>
              <div><strong>目標：</strong>{detail.targetType ? `${detail.targetType} #${detail.targetId}` : '—'}</div>
              <div><strong>IP：</strong>{detail.ip || '—'}</div>
              <div style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}><strong>UA：</strong>{detail.userAgent || '—'}</div>
            </div>
            <h3>變更內容</h3>
            <pre className="preview-flex-json">{JSON.stringify(detail.diff || {}, null, 2)}</pre>
            <div className="form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setDetail(null)}>關閉</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
