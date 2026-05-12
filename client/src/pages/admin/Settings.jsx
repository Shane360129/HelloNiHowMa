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

  const [adminLineDraft, setAdminLineDraft] = useState('');

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

        <h3>預約規則</h3>
        <div className="alert alert-info" style={{ marginTop: 0 }}>
          這些規則會影響前台預約頁的可選時段與取消限制。
        </div>
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settings.lineLoginRequired !== false}
              onChange={e => update('lineLoginRequired', e.target.checked)}
            />
            強制要求 LINE 登入才能預約（D1）
          </label>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>預設預約時長（分鐘）</label>
            <input
              type="number"
              min="15"
              step="15"
              value={settings.defaultBookingDuration || 210}
              onChange={e => update('defaultBookingDuration', Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>時段間隔（分鐘）</label>
            <input
              type="number"
              min="15"
              step="15"
              value={settings.slotInterval || 30}
              onChange={e => update('slotInterval', Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>前後緩衝（分鐘）</label>
            <input
              type="number"
              min="0"
              step="5"
              value={settings.bookingBufferMinutes ?? 0}
              onChange={e => update('bookingBufferMinutes', Number(e.target.value))}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>最早可預約（幾天後）</label>
            <input
              type="number"
              min="0"
              value={settings.bookingEarliestDays ?? 1}
              onChange={e => update('bookingEarliestDays', Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>最晚可預約（幾小時前）</label>
            <input
              type="number"
              min="0"
              value={settings.bookingLatestHours ?? 24}
              onChange={e => update('bookingLatestHours', Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>取消時限（幾小時前可取消）</label>
            <input
              type="number"
              min="0"
              value={settings.bookingCancelHoursLimit ?? 24}
              onChange={e => update('bookingCancelHoursLimit', Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>每人每週上限（0=不限）</label>
            <input
              type="number"
              min="0"
              value={settings.bookingPerUserPerWeek ?? 0}
              onChange={e => update('bookingPerUserPerWeek', Number(e.target.value))}
            />
          </div>
        </div>

        <h3>預約時段設定</h3>
        <ScheduleEditor settings={settings} onChange={update} />

        <h3>提醒設定</h3>
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settings.reminderEnabled !== false}
              onChange={e => update('reminderEnabled', e.target.checked)}
            />
            啟用自動預約提醒（D3）
          </label>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>提醒發送時間</label>
            <input
              type="time"
              value={settings.reminderTime || '10:00'}
              onChange={e => update('reminderTime', e.target.value)}
            />
            <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: 4 }}>
              修改後同日下個整點生效，不需重新部署
            </div>
          </div>
          <div className="form-group">
            <label>提前幾天提醒</label>
            <input
              type="number"
              min="0"
              value={settings.reminderLeadDays ?? 1}
              onChange={e => update('reminderLeadDays', Number(e.target.value))}
            />
          </div>
        </div>

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

        <h3>店家 LINE 內一鍵確認預約（D4 / 白名單）</h3>
        <div className="alert alert-info" style={{ marginTop: 0 }}>
          列在白名單內的 LINE userId，可以在 LINE 訊息中直接點 [確認]/[取消] 按鈕更新預約狀態。
          請使用 LINE Login 後從 <code>/api/auth/me</code> 取得自己的 userId 填入。
        </div>
        <div className="form-group">
          <label>店員 LINE userId 白名單</label>
          <div className="tag-list">
            {(settings.adminLineUserIds || []).map(uid => (
              <span key={uid} className="tag-chip">
                {uid.length > 16 ? uid.slice(0, 12) + '…' : uid}
                <button
                  type="button"
                  onClick={() => update('adminLineUserIds', settings.adminLineUserIds.filter(x => x !== uid))}
                >×</button>
              </span>
            ))}
            <input
              className="tag-input"
              placeholder="U… 後按 Enter"
              value={adminLineDraft}
              onChange={e => setAdminLineDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const t = adminLineDraft.trim();
                  if (t && !(settings.adminLineUserIds || []).includes(t)) {
                    update('adminLineUserIds', [...(settings.adminLineUserIds || []), t]);
                  }
                  setAdminLineDraft('');
                }
              }}
            />
          </div>
        </div>

        <h3>進階</h3>
        <div className="form-row">
          <div className="form-group">
            <label>推播配額警告閾值（剩 N 則時警告）</label>
            <input
              type="number"
              min="0"
              value={settings.pushQuotaWarnThreshold ?? 50}
              onChange={e => update('pushQuotaWarnThreshold', Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>Google Analytics ID（D10）</label>
            <input
              value={settings.googleAnalyticsId || ''}
              onChange={e => update('googleAnalyticsId', e.target.value)}
              placeholder="G-XXXXXXXXXX"
            />
          </div>
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
