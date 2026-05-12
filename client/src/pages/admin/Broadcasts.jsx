import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout';
import {
  fetchBroadcasts,
  createBroadcast,
  deleteBroadcast,
  fetchLineQuota,
  fetchAdminUserTags,
  fetchAdminUsers
} from '../../context/api';

const TYPE_LABEL = {
  single: '單一用戶',
  tag: '標籤群組',
  all_followers: '全體追蹤者'
};

const MESSAGE_TYPE_LABEL = {
  text: '純文字',
  flex: 'Flex Message',
  image: '圖片'
};

const STATUS_LABEL = {
  draft: '草稿',
  queued: '排程中',
  sending: '發送中',
  sent: '已送出',
  failed: '失敗',
  cancelled: '已取消'
};

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [quota, setQuota] = useState(null);
  const [tags, setTags] = useState([]);
  const [users, setUsers] = useState([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    try {
      const [bs, q, ts, us] = await Promise.all([
        fetchBroadcasts(),
        fetchLineQuota().catch(() => null),
        fetchAdminUserTags().catch(() => []),
        fetchAdminUsers({ hasLine: 'true' }).catch(() => [])
      ]);
      setBroadcasts(bs);
      setQuota(q);
      setTags(ts);
      setUsers(us);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!confirm('確定刪除此推播紀錄？')) return;
    try {
      await deleteBroadcast(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <AdminLayout>
      <div className="admin-header">
        <h1>主動推播</h1>
        <button type="button" className="btn btn-sm" onClick={() => setComposeOpen(true)}>+ 新增推播</button>
      </div>

      {quota && quota.available && (
        <div className="quota-banner">
          <div>
            <strong>LINE 推播配額</strong>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 2 }}>
              本月已用 {quota.consumption}
              {quota.quota != null && ` / ${quota.quota} 則`}
              {quota.remaining != null && ` · 剩餘 ${quota.remaining} 則`}
            </div>
          </div>
          {quota.quota != null && quota.remaining < 50 && (
            <span className="badge-block" style={{ background: '#f3d4d4', color: '#8c2e2e' }}>
              ⚠ 配額即將耗盡
            </span>
          )}
        </div>
      )}
      {quota && !quota.available && (
        <div className="alert alert-error">無法取得 LINE 配額（請確認 Channel Access Token 是否正確）</div>
      )}

      {broadcasts.length === 0 ? (
        <div className="empty-state">尚未有推播紀錄</div>
      ) : (
        <div className="admin-table" style={{ marginTop: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th>發送時間</th>
                <th>對象</th>
                <th>訊息類型</th>
                <th>內容摘要</th>
                <th>狀態</th>
                <th>成功 / 失敗</th>
                <th>發送者</th>
                <th style={{ width: 120 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map(b => (
                <tr key={b.id}>
                  <td style={{ fontSize: '0.85rem' }}>
                    {b.sentAt
                      ? new Date(b.sentAt).toLocaleString('zh-TW', { hour12: false })
                      : new Date(b.createdAt).toLocaleString('zh-TW', { hour12: false })}
                  </td>
                  <td>
                    {TYPE_LABEL[b.type]}
                    {b.type === 'tag' && b.recipientTags?.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                        {b.recipientTags.join(', ')}
                      </div>
                    )}
                  </td>
                  <td>{MESSAGE_TYPE_LABEL[b.messageType]}</td>
                  <td style={{ maxWidth: 260, fontSize: '0.85rem' }}>
                    {(b.content || '').slice(0, 60)}{(b.content || '').length > 60 ? '…' : ''}
                  </td>
                  <td>
                    <span className={`my-booking-status ${b.status === 'sent' ? 'confirmed' : b.status === 'failed' ? 'cancelled' : ''}`}>
                      {STATUS_LABEL[b.status]}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: '#1f7a3e' }}>✓ {b.successCount}</span>
                    {' / '}
                    <span style={{ color: '#8c2e2e' }}>✗ {b.failureCount}</span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{b.sentBy}</td>
                  <td>
                    <button className="btn btn-sm btn-outline" onClick={() => setDetail(b)}>詳情</button>
                    {['draft', 'queued'].includes(b.status) && (
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(b.id)}>刪除</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {composeOpen && (
        <ComposeBroadcast
          tags={tags}
          users={users}
          quota={quota}
          onClose={() => setComposeOpen(false)}
          onSent={() => { setComposeOpen(false); load(); }}
        />
      )}

      {detail && (
        <BroadcastDetail broadcast={detail} onClose={() => setDetail(null)} />
      )}
    </AdminLayout>
  );
}

function ComposeBroadcast({ tags, users, quota, onClose, onSent }) {
  const [form, setForm] = useState({
    type: 'all_followers',
    recipientUserIds: [],
    recipientTags: [],
    messageType: 'text',
    content: '',
    flexJson: '',
    imageUrl: ''
  });
  const [userSearch, setUserSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const estimatedRecipients =
    form.type === 'all_followers'
      ? '全體追蹤者（依 LINE 廣播 API 計算）'
      : form.type === 'tag'
        ? `${users.filter(u => (u.tags || []).some(t => form.recipientTags.includes(t))).length} 人`
        : `${form.recipientUserIds.length} 人`;

  const handleSubmit = async () => {
    setError('');
    if (form.type === 'single' && !form.recipientUserIds.length) {
      setError('請選擇至少一位用戶');
      return;
    }
    if (form.type === 'tag' && !form.recipientTags.length) {
      setError('請選擇至少一個標籤');
      return;
    }
    if (form.messageType === 'text' && !form.content.trim()) {
      setError('請填寫訊息內容');
      return;
    }
    if (!confirm(`確定要發送這則推播嗎？\n對象：${TYPE_LABEL[form.type]}\n估計：${estimatedRecipients}`)) return;

    setSending(true);
    try {
      const payload = {
        type: form.type,
        recipientUserIds: form.recipientUserIds,
        recipientTags: form.recipientTags,
        messageType: form.messageType,
        content: form.content,
        imageUrl: form.imageUrl
      };
      if (form.messageType === 'flex') {
        try {
          payload.flexJson = JSON.parse(form.flexJson);
        } catch {
          setError('Flex JSON 格式錯誤');
          setSending(false);
          return;
        }
      }
      await createBroadcast(payload);
      onSent();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const filteredUsers = users.filter(u =>
    !userSearch
    || u.displayName?.toLowerCase().includes(userSearch.toLowerCase())
    || u.phone?.includes(userSearch)
  );

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer drawer-wide" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h2>+ 新增推播</h2>
          <button type="button" className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">
          <div className="form-group">
            <label>對象</label>
            <div className="filter-bar" style={{ margin: 0 }}>
              <button type="button" className={`filter-btn ${form.type === 'all_followers' ? 'active' : ''}`}
                onClick={() => upd('type', 'all_followers')}>全體追蹤者</button>
              <button type="button" className={`filter-btn ${form.type === 'tag' ? 'active' : ''}`}
                onClick={() => upd('type', 'tag')}>標籤群組</button>
              <button type="button" className={`filter-btn ${form.type === 'single' ? 'active' : ''}`}
                onClick={() => upd('type', 'single')}>選擇用戶</button>
            </div>
          </div>

          {form.type === 'tag' && (
            <div className="form-group">
              <label>選擇標籤（可多選）</label>
              {tags.length === 0 ? (
                <div className="placeholder-card">尚未為任何客戶設定標籤</div>
              ) : (
                <div className="tag-list" style={{ flexWrap: 'wrap' }}>
                  {tags.map(t => {
                    const active = form.recipientTags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        className={'tag-chip ' + (active ? 'tag-chip-active' : '')}
                        onClick={() => upd('recipientTags',
                          active ? form.recipientTags.filter(x => x !== t) : [...form.recipientTags, t]
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {form.type === 'single' && (
            <div className="form-group">
              <label>選擇用戶（可多選）</label>
              <input
                className="filter-search"
                placeholder="搜尋姓名 / 電話"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{ width: '100%', marginBottom: '0.5rem' }}
              />
              <div className="user-pick-list">
                {filteredUsers.slice(0, 50).map(u => (
                  <label key={u.id} className="user-pick-row">
                    <input
                      type="checkbox"
                      checked={form.recipientUserIds.includes(u.id)}
                      onChange={() => {
                        const next = form.recipientUserIds.includes(u.id)
                          ? form.recipientUserIds.filter(id => id !== u.id)
                          : [...form.recipientUserIds, u.id];
                        upd('recipientUserIds', next);
                      }}
                    />
                    {u.pictureUrl
                      ? <img src={u.pictureUrl} alt="" className="user-avatar" />
                      : <span className="user-avatar user-avatar-fallback">{u.displayName?.[0] || '?'}</span>}
                    <div>
                      <div>{u.displayName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{u.phone}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>訊息類型</label>
            <div className="filter-bar" style={{ margin: 0 }}>
              <button type="button" className={`filter-btn ${form.messageType === 'text' ? 'active' : ''}`}
                onClick={() => upd('messageType', 'text')}>純文字</button>
              <button type="button" className={`filter-btn ${form.messageType === 'flex' ? 'active' : ''}`}
                onClick={() => upd('messageType', 'flex')}>Flex Message</button>
              <button type="button" className={`filter-btn ${form.messageType === 'image' ? 'active' : ''}`}
                onClick={() => upd('messageType', 'image')}>圖片</button>
            </div>
          </div>

          {form.messageType === 'text' && (
            <div className="form-group">
              <label>內容</label>
              <textarea rows={6} value={form.content} onChange={e => upd('content', e.target.value)} />
            </div>
          )}
          {form.messageType === 'flex' && (
            <>
              <div className="form-group">
                <label>altText（通知列顯示文字）</label>
                <input value={form.content} onChange={e => upd('content', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Flex JSON</label>
                <textarea
                  rows={14}
                  value={form.flexJson}
                  onChange={e => upd('flexJson', e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}
                  placeholder='{"type":"bubble","body":{...}}'
                />
              </div>
            </>
          )}
          {form.messageType === 'image' && (
            <>
              <div className="form-group">
                <label>圖片網址</label>
                <input value={form.imageUrl} onChange={e => upd('imageUrl', e.target.value)} placeholder="https://..." />
              </div>
              <div className="form-group">
                <label>圖片說明（選填，作為通知列文字）</label>
                <input value={form.content} onChange={e => upd('content', e.target.value)} />
              </div>
            </>
          )}

          <div className="alert alert-info">
            <strong>對象：</strong>{TYPE_LABEL[form.type]} · {estimatedRecipients}
            {quota?.available && quota.remaining != null && (
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                目前剩餘 LINE 推播配額：{quota.remaining} 則
              </div>
            )}
          </div>

          {error && <div className="alert alert-error">{error}</div>}
        </div>
        <div className="drawer-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>取消</button>
          <button type="button" className="btn" onClick={handleSubmit} disabled={sending}>
            {sending ? '發送中…' : '確認發送'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BroadcastDetail({ broadcast: b, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <h2>推播詳情</h2>
        <div style={{ marginBottom: '0.6rem' }}>
          <span className={`my-booking-status ${b.status === 'sent' ? 'confirmed' : b.status === 'failed' ? 'cancelled' : ''}`}>
            {STATUS_LABEL[b.status]}
          </span>
          {' · '}{TYPE_LABEL[b.type]}
          {' · '}{MESSAGE_TYPE_LABEL[b.messageType]}
          {b.sentAt && ' · ' + new Date(b.sentAt).toLocaleString('zh-TW', { hour12: false })}
        </div>
        {b.recipientTags?.length > 0 && (
          <div style={{ marginBottom: '0.6rem' }}>
            <strong>標籤：</strong>{b.recipientTags.join(', ')}
          </div>
        )}
        <div style={{ marginBottom: '0.6rem' }}>
          <strong>成功：</strong>{b.successCount} ·{' '}
          <strong>失敗：</strong>{b.failureCount}
        </div>
        {b.messageType === 'flex' ? (
          <pre className="preview-flex-json">{JSON.stringify(b.flexJson, null, 2)}</pre>
        ) : (
          <pre className="preview-flex-json">{b.content}</pre>
        )}
        {b.failureDetails?.length > 0 && (
          <>
            <h3 style={{ marginTop: '1rem' }}>失敗詳情</h3>
            <pre className="preview-flex-json">{JSON.stringify(b.failureDetails, null, 2)}</pre>
          </>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>關閉</button>
        </div>
      </div>
    </div>
  );
}
