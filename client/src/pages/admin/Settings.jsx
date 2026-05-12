import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ScheduleEditor from '../../components/ScheduleEditor';
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

        <h3>預約時段設定</h3>
        <ScheduleEditor settings={settings} onChange={update} />

        <h3>LINE Messaging API（店家通知）</h3>
        <div className="alert alert-info" style={{ marginTop: 0 }}>
          <div>新預約建立時會自動推播到店家 LINE。請於 LINE Developers Console 取得：</div>
          <ul style={{ paddingLeft: '1.2rem', marginTop: '0.3rem' }}>
            <li>Channel Access Token（長效）</li>
            <li>Channel Secret（webhook 簽章驗證用）</li>
            <li>推播對象 userId / groupId</li>
          </ul>
          <div style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
            也可改用環境變數：LINE_MESSAGING_CHANNEL_ACCESS_TOKEN / LINE_MESSAGING_CHANNEL_SECRET / LINE_TARGET_ID
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
          <label>Channel Secret（webhook 簽章驗證）</label>
          <input value={settings.lineChannelSecret || ''} onChange={e => update('lineChannelSecret', e.target.value)} placeholder="可留空，Phase 4 啟用 webhook 時填入" />
        </div>

        <h3>LINE Login（客戶登入）</h3>
        <div className="alert alert-info" style={{ marginTop: 0 }}>
          <div>客戶用 LINE 註冊/登入預約頁所需的憑證。請於 LINE Developers Console 建立 LINE Login Channel + LIFF App：</div>
          <div style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
            也可改用環境變數：LINE_LOGIN_CHANNEL_ID / LINE_LOGIN_CHANNEL_SECRET / LINE_LIFF_ID
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>LINE Login Channel ID</label>
            <input value={settings.lineLoginChannelId || ''} onChange={e => update('lineLoginChannelId', e.target.value)} placeholder="2001234567" />
          </div>
          <div className="form-group">
            <label>LINE Login Channel Secret</label>
            <input value={settings.lineLoginChannelSecret || ''} onChange={e => update('lineLoginChannelSecret', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>LIFF ID</label>
          <input value={settings.lineLiffId || ''} onChange={e => update('lineLiffId', e.target.value)} placeholder="2001234567-AbCdEfGh" />
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
