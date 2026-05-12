import { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '../../components/AdminLayout';
import {
  fetchMessageTemplates,
  updateMessageTemplate,
  previewMessageTemplate,
  testSendMessageTemplate
} from '../../context/api';

const CHANNEL_LABEL = {
  line_text: '純文字',
  line_flex: 'Flex Message'
};

const COMMON_VARIABLES = [
  'name', 'phone', 'service', 'date', 'time', 'endTime',
  'duration', 'notes', 'storeName', 'storeAddress', 'storePhone', 'bookingId'
];

export default function ManageTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMessageTemplates();
      setTemplates(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggleEnabled = async (tpl) => {
    try {
      const updated = await updateMessageTemplate(tpl.key, { enabled: !tpl.enabled });
      setTemplates(prev => prev.map(t => t.key === tpl.key ? updated : t));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <AdminLayout>
      <div className="admin-header">
        <h1>LINE 訊息模板</h1>
      </div>
      <div className="alert alert-info" style={{ marginTop: '0.5rem' }}>
        修改模板後立即生效，不需重新部署。預設模板隨服務啟動時自動建立；若需新增模板鍵值，請與開發者聯絡。
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading">載入中...</div>
      ) : (
        <div className="admin-table" style={{ marginTop: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th>啟用</th>
                <th>名稱 / Key</th>
                <th>說明</th>
                <th>通道</th>
                <th>最後修改</th>
                <th style={{ width: 100 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.key}>
                  <td>
                    <label className="toggle">
                      <input type="checkbox" checked={t.enabled} onChange={() => handleToggleEnabled(t)} />
                      <span />
                    </label>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{t.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                      <code>{t.key}</code>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>{t.description}</td>
                  <td>
                    <span className={`source-badge ${t.channel === 'line_flex' ? 'badge-dm' : 'badge-line'}`}>
                      {CHANNEL_LABEL[t.channel]}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                    {t.updatedAt ? new Date(t.updatedAt).toLocaleString('zh-TW', { hour12: false }) : '—'}
                    {t.updatedBy && <div>by {t.updatedBy}</div>}
                  </td>
                  <td>
                    <button className="btn btn-sm btn-outline" onClick={() => setEditing(t)}>編輯</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <TemplateEditor
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setTemplates(prev => prev.map(t => t.key === updated.key ? updated : t));
            setEditing(null);
          }}
        />
      )}
    </AdminLayout>
  );
}

function TemplateEditor({ template, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: template.name,
    description: template.description || '',
    enabled: template.enabled,
    channel: template.channel,
    content: template.content || '',
    flexJsonText: template.flexJson ? JSON.stringify(template.flexJson, null, 2) : ''
  });
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const previewTimer = useRef(null);
  const contentRef = useRef(null);

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const buildPayload = useCallback(() => {
    const payload = {
      template: {
        name: form.name,
        description: form.description,
        enabled: true, // 預覽時忽略停用狀態
        channel: form.channel,
        content: form.content,
        flexJson: null
      }
    };
    if (form.channel === 'line_flex' && form.flexJsonText.trim()) {
      try {
        payload.template.flexJson = JSON.parse(form.flexJsonText);
      } catch {
        return { invalid: true, reason: 'Flex JSON 格式錯誤' };
      }
    }
    return payload;
  }, [form]);

  // 自動預覽（debounced）
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      const payload = buildPayload();
      if (payload.invalid) {
        setPreviewError(payload.reason);
        setPreview(null);
        return;
      }
      try {
        const data = await previewMessageTemplate(template.key, payload);
        setPreview(data.rendered);
        setPreviewError('');
      } catch (err) {
        setPreviewError(err.message);
        setPreview(null);
      }
    }, 350);
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current); };
  }, [form, template.key, buildPayload]);

  const handleInsertVariable = (varName) => {
    const tag = `{${varName}}`;
    const el = contentRef.current;
    if (el && document.activeElement === el) {
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      const next = form.content.slice(0, start) + tag + form.content.slice(end);
      upd('content', next);
      setTimeout(() => {
        el.focus();
        el.selectionStart = el.selectionEnd = start + tag.length;
      }, 0);
    } else {
      upd('content', form.content + tag);
    }
  };

  const handleSave = async () => {
    setMessage('');
    const payload = buildPayload();
    if (payload.invalid) { alert(payload.reason); return; }
    setSaving(true);
    try {
      const updated = await updateMessageTemplate(template.key, {
        ...payload.template,
        enabled: form.enabled
      });
      setMessage('已儲存');
      onSaved(updated);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    const payload = buildPayload();
    if (payload.invalid) { alert(payload.reason); return; }
    setTesting(true);
    setMessage('');
    try {
      const result = await testSendMessageTemplate(template.key, payload);
      setMessage(result.message || '已發送測試訊息');
    } catch (err) {
      alert(err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer drawer-xl" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h2>編輯模板：{template.name}</h2>
          <button type="button" className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">
          <div className="template-editor-grid">
            <div>
              <div className="form-group">
                <label>Key</label>
                <input value={template.key} disabled style={{ fontFamily: 'monospace' }} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>名稱</label>
                  <input value={form.name} onChange={e => upd('name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>通道</label>
                  <select value={form.channel} onChange={e => upd('channel', e.target.value)}>
                    <option value="line_text">純文字</option>
                    <option value="line_flex">Flex Message</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>說明</label>
                <input value={form.description} onChange={e => upd('description', e.target.value)} />
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input type="checkbox" checked={form.enabled} onChange={e => upd('enabled', e.target.checked)} />
                  啟用
                </label>
              </div>
              <div className="form-group">
                <label>{form.channel === 'line_flex' ? 'altText（推播通知列顯示文字）' : '訊息內容'}</label>
                <textarea
                  ref={contentRef}
                  rows={form.channel === 'line_flex' ? 2 : 7}
                  value={form.content}
                  onChange={e => upd('content', e.target.value)}
                />
              </div>
              {form.channel === 'line_flex' && (
                <div className="form-group">
                  <label>Flex JSON</label>
                  <textarea
                    rows={14}
                    value={form.flexJsonText}
                    onChange={e => upd('flexJsonText', e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: 4 }}>
                    參考{' '}
                    <a href="https://developers.line.biz/flex-simulator/" target="_blank" rel="noreferrer">
                      Flex Simulator
                    </a>{' '}
                    設計 Flex Message
                  </div>
                </div>
              )}
              <div className="form-group">
                <label>可用變數（點擊插入）</label>
                <div className="tag-list" style={{ flexWrap: 'wrap' }}>
                  {COMMON_VARIABLES.map(v => (
                    <button
                      key={v}
                      type="button"
                      className="tag-chip"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleInsertVariable(v)}
                    >
                      {`{${v}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="template-preview-panel">
              <h3>即時預覽</h3>
              {previewError && <div className="alert alert-error">{previewError}</div>}
              {preview ? (
                <PreviewBubble message={preview} />
              ) : (
                <div className="placeholder-card">輸入內容後將顯示預覽…</div>
              )}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.8rem' }}>
                預覽以範例資料（王小姐 / 2026-06-01 10:00 / 韓式霧眉）渲染。實際送出時會替換成該預約 / 客戶的真實資料。
              </div>
            </div>
          </div>
          {message && <div className="alert" style={{ marginTop: '0.8rem' }}>{message}</div>}
        </div>
        <div className="drawer-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>取消</button>
          <button type="button" className="btn btn-outline" onClick={handleTestSend} disabled={testing}>
            {testing ? '發送中…' : '發送測試訊息給店家 LINE'}
          </button>
          <button type="button" className="btn" onClick={handleSave} disabled={saving}>
            {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewBubble({ message }) {
  if (message.type === 'text') {
    return (
      <div className="preview-chat">
        <div className="preview-bubble">{message.text}</div>
      </div>
    );
  }
  if (message.type === 'flex') {
    return (
      <div>
        <div className="preview-flex-note">📱 Flex Message — 實際在 LINE 中顯示樣式請以「測試發送」為準</div>
        <pre className="preview-flex-json">{JSON.stringify(message.contents, null, 2)}</pre>
      </div>
    );
  }
  return <pre className="preview-flex-json">{JSON.stringify(message, null, 2)}</pre>;
}
