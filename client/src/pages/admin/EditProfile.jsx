import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { fetchProfile, updateProfile } from '../../context/api';

export default function EditProfile() {
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchProfile().then(setProfile);
  }, []);

  const handleChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialChange = (field, value) => {
    setProfile(prev => ({
      ...prev,
      social: { ...prev.social, [field]: value }
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await updateProfile(profile);
      setMessage('已儲存！');
    } catch {
      setMessage('儲存失敗');
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
            <label>姓名</label>
            <input value={profile.name} onChange={e => handleChange('name', e.target.value)} />
          </div>
          <div className="form-group">
            <label>頭銜</label>
            <input value={profile.title} onChange={e => handleChange('title', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>自我介紹</label>
          <textarea rows={4} value={profile.bio} onChange={e => handleChange('bio', e.target.value)} />
        </div>

        <div className="form-group">
          <label>大頭照 URL</label>
          <input value={profile.avatar} onChange={e => handleChange('avatar', e.target.value)} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={profile.email} onChange={e => handleChange('email', e.target.value)} />
          </div>
          <div className="form-group">
            <label>電話</label>
            <input value={profile.phone} onChange={e => handleChange('phone', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>所在地</label>
          <input value={profile.location} onChange={e => handleChange('location', e.target.value)} />
        </div>

        <h3>社群連結</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Instagram</label>
            <input value={profile.social?.instagram || ''} onChange={e => handleSocialChange('instagram', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Facebook</label>
            <input value={profile.social?.facebook || ''} onChange={e => handleSocialChange('facebook', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Line</label>
            <input value={profile.social?.line || ''} onChange={e => handleSocialChange('line', e.target.value)} />
          </div>
        </div>

        <button type="submit" className="btn" disabled={saving}>
          {saving ? '儲存中...' : '儲存變更'}
        </button>
      </form>
    </AdminLayout>
  );
}
