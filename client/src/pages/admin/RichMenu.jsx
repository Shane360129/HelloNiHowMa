import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout';
import {
  fetchRichMenus,
  setDefaultRichMenu,
  clearDefaultRichMenu,
  deleteRichMenu
} from '../../context/api';

export default function RichMenu() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await fetchRichMenus();
      setData(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSetDefault = async (id) => {
    setBusy(id);
    try {
      await setDefaultRichMenu(id);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  const handleClearDefault = async () => {
    if (!confirm('確定清除預設 Rich Menu？所有未自訂 menu 的客戶將看不到圖文選單。')) return;
    setBusy('clear');
    try {
      await clearDefaultRichMenu();
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('確定刪除此 Rich Menu？無法復原。')) return;
    setBusy(id);
    try {
      await deleteRichMenu(id);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminLayout>
      <div className="admin-header">
        <h1>Rich Menu（圖文選單）</h1>
        <button type="button" className="btn btn-sm btn-outline" onClick={load} disabled={loading}>
          {loading ? '載入中…' : '重新整理'}
        </button>
      </div>

      <div className="alert alert-info">
        <strong>建議流程：</strong>使用{' '}
        <a href="https://manager.line.biz/" target="_blank" rel="noreferrer">LINE OA Manager</a>{' '}
        建立圖文選單（上傳圖片、設定區塊動作），這裡可以快速切換預設選單或刪除舊版本。
        建立 LIFF 連結時請使用<code>https://liff.line.me/{'{LIFF_ID}'}</code> 格式。
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {data && (
        <>
          <div style={{ margin: '1rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <strong>目前預設：</strong>
            {data.defaultRichMenuId ? (
              <>
                <code>{data.defaultRichMenuId}</code>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={handleClearDefault}
                  disabled={busy === 'clear'}
                >
                  {busy === 'clear' ? '清除中…' : '清除預設'}
                </button>
              </>
            ) : (
              <span style={{ color: 'var(--text-light)' }}>尚未設定預設選單</span>
            )}
          </div>

          {data.richmenus.length === 0 ? (
            <div className="empty-state">
              帳號內尚無 Rich Menu。請至 LINE OA Manager 建立後回來這裡指定預設。
            </div>
          ) : (
            <div className="admin-table">
              <table>
                <thead>
                  <tr>
                    <th>名稱</th>
                    <th>大小</th>
                    <th>區塊數</th>
                    <th>聊天列文字</th>
                    <th>Rich Menu ID</th>
                    <th style={{ width: 220 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.richmenus.map(m => (
                    <tr key={m.richMenuId}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{m.name}</div>
                        {m.isDefault && (
                          <span className="source-badge badge-line" style={{ marginTop: 4, display: 'inline-block' }}>
                            ✓ 預設
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {m.size?.width} × {m.size?.height}
                      </td>
                      <td>{m.areas?.length || 0}</td>
                      <td style={{ fontSize: '0.85rem' }}>{m.chatBarText}</td>
                      <td>
                        <code style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>{m.richMenuId}</code>
                      </td>
                      <td>
                        {!m.isDefault && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleSetDefault(m.richMenuId)}
                            disabled={busy === m.richMenuId}
                          >
                            {busy === m.richMenuId ? '處理中…' : '設為預設'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(m.richMenuId)}
                          disabled={busy === m.richMenuId}
                          style={{ marginLeft: 4 }}
                        >
                          刪除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
