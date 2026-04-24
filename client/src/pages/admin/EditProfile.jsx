import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ImageField from '../../components/ImageField';
import { fetchProfile, updateProfile } from '../../context/api';

export default function EditProfile() {
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchProfile().then(data => setProfile({ social: {}, ...data }));
  }, []);

  const update = (field, value) =>
    setProfile(prev => ({ ...prev, [field]: value }));
  const updateSocial = (field, value) =>
    setProfile(prev => ({ ...prev, social: { ...(prev.social || {}), [field]: value } }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await updateProfile(profile);
      setMessage('已儲存！');
    } catch (err) {
      setMessage(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return <AdminLayout><div className="loading">載入中...</div></AdminLayout>;

  return (
    <AdminLayout>
      <h1>編輯個人資訊</h1>
      {message && <div className="alert">{message}</div>}
      <form onSubmit={handleSave} className="admin-form">
        <div className="form-row">
          <div className="form-group">
            <label>品牌名稱 / 工作室名</label>
            <input value={profile.name || ''} onChange={e => update('name', e.target.value)} />
          </div>
          <div className="form-group">
            <label>頭銜 / 副標</label>
            <input value={profile.title || ''} onChange={e => update('title', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>Hero 標語</label>
          <input value={profile.tagline || ''} onChange={e => update('tagline', e.target.value)} placeholder="一對最適合你的眉，從這裡開始" />
        </div>

        <div className="form-group">
          <label>首頁簡介（顯示在首頁上方獨立區塊）</label>
          <textarea
            rows={3}
            value={profile.homeIntro || ''}
            onChange={e => update('homeIntro', e.target.value)}
            placeholder="例如：La Paisley 是一間以韓式霧眉與線條眉為主的小型工作室..."
          />
          <p className="form-hint">未填寫時，前台會顯示「待補」提示。</p>
        </div>

        <div className="form-group">
          <label>自我介紹（About 區塊）</label>
          <textarea rows={4} value={profile.bio || ''} onChange={e => update('bio', e.target.value)} />
        </div>

        <div className="form-row">
          <ImageField
            label="About 頁頭像"
            value={profile.avatar || ''}
            onChange={v => update('avatar', v)}
          />
          <ImageField
            label="Hero 背景圖"
            value={profile.heroImage || ''}
            onChange={v => update('heroImage', v)}
            hint="建議 1600x1000 以上的橫幅圖片"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={profile.email || ''} onChange={e => update('email', e.target.value)} />
          </div>
          <div className="form-group">
            <label>電話</label>
            <input value={profile.phone || ''} onChange={e => update('phone', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>所在地（簡述）</label>
            <input value={profile.location || ''} onChange={e => update('location', e.target.value)} />
          </div>
          <div className="form-group">
            <label>詳細地址（選填）</label>
            <input value={profile.address || ''} onChange={e => update('address', e.target.value)} />
          </div>
        </div>

        <h3>社群連結</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Instagram</label>
            <input value={profile.social?.instagram || ''} onChange={e => updateSocial('instagram', e.target.value)} placeholder="https://instagram.com/la_paisley_2025" />
          </div>
          <div className="form-group">
            <label>LINE</label>
            <input value={profile.social?.line || ''} onChange={e => updateSocial('line', e.target.value)} placeholder="https://line.me/R/ti/p/@xxx" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Facebook</label>
            <input value={profile.social?.facebook || ''} onChange={e => updateSocial('facebook', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Threads</label>
            <input value={profile.social?.threads || ''} onChange={e => updateSocial('threads', e.target.value)} />
          </div>
        </div>

        <button type="submit" className="btn" disabled={saving}>
          {saving ? '儲存中...' : '儲存變更'}
        </button>
      </form>
    </AdminLayout>
  );
}
