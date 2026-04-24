import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { fetchSettings, updateSettings, sendLineTest, changePassword } from '../../context/api';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => {
    fetchSettings().then(setSettings).catch(err => setError(err.message));
  }, []);

  const update = (field, value) => setSettings(prev => ({ ...prev, [field]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);
    try {
      await updateSettings(settings);
      setMessage('設定已儲存');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setMessage('');
    setError('');
    setTesting(true);
    try {
      const r = await sendLineTest();
      setMessage(r.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg('');
    try {
      await changePassword(pwCurrent, pwNew);
      setPwMsg('密碼已更新');
      setPwCurrent('');
      setPwNew('');
    } catch (err) {
      setPwMsg(err.message);
    }
  };

  if (!settings) return <AdminLayout><div className="loading">載入中...</div></AdminLayout>;

  return (
    <AdminLayout>
      <h1>系統設定</h1>

      {message && <div className="alert">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSave} className="admin-form">
        <h3>店家資訊</h3>
        <div className="form-row">
          <div className="form-group">
            <label>店家名稱</label>
            <input value={settings.businessName || ''} onChange={e => update('businessName', e.target.value)} />
          </div>
          <div className="form-group">
            <label>營業時間</label>
            <input value={settings.businessHours || ''} onChange={e => update('businessHours', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>預約頁小提示</label>
          <input value={settings.bookingNote || ''} onChange={e => update('bookingNote', e.target.value)} />
        </div>
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settings.bookingEnabled !== false}
              onChange={e => update('bookingEnabled', e.target.checked)}
            />
            開啟線上預約（取消勾選則暫停接受新預約）
          </label>
        </div>

        <h3>LINE 通知</h3>
        <div className="alert alert-info" style={{ marginTop: 0 }}>
          <div>以下任一種方式皆可：</div>
          <ul style={{ paddingLeft: '1.2rem', marginTop: '0.3rem' }}>
            <li><strong>LINE Messaging API</strong>（推薦）：填入 Channel Access Token 與推播對象 ID（userId / groupId）</li>
            <li><strong>LINE Notify</strong>（舊制）：填入個人發行的 Notify Token</li>
          </ul>
          <div style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
            也可改用環境變數：LINE_CHANNEL_ACCESS_TOKEN / LINE_TARGET_ID / LINE_NOTIFY_TOKEN
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Channel Access Token</label>
            <input value={settings.lineChannelAccessToken || ''} onChange={e => update('lineChannelAccessToken', e.target.value)} placeholder="Bearer token 內容" />
          </div>
          <div className="form-group">
            <label>推播對象 ID</label>
            <input value={settings.lineTargetId || ''} onChange={e => update('lineTargetId', e.target.value)} placeholder="Uxxxxxxxx 或 Cxxxxxxxx" />
          </div>
        </div>
        <div className="form-group">
          <label>LINE Notify Token（舊制備援）</label>
          <input value={settings.lineNotifyToken || ''} onChange={e => update('lineNotifyToken', e.target.value)} />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn" disabled={saving}>
            {saving ? '儲存中...' : '儲存設定'}
          </button>
          <button type="button" className="btn btn-outline" onClick={handleTest} disabled={testing}>
            {testing ? '傳送中...' : '發送測試通知'}
          </button>
        </div>
      </form>

      <form onSubmit={handleChangePassword} className="admin-form" style={{ marginTop: '1.5rem' }}>
        <h3>變更管理員密碼</h3>
        {pwMsg && <div className="alert">{pwMsg}</div>}
        <div className="form-row">
          <div className="form-group">
            <label>目前密碼</label>
            <input type="password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>新密碼</label>
            <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} required />
          </div>
        </div>
        <button type="submit" className="btn btn-sm">更新密碼</button>
      </form>
    </AdminLayout>
  );
}
