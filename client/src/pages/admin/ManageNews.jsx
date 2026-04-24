import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ImageField from '../../components/ImageField';
import { fetchAdminNews, createNews, updateNews, deleteNews } from '../../context/api';

const todayStr = () => new Date().toISOString().slice(0, 10);

const emptyNews = {
  title: '', content: '', image: '', link: '',
  pinned: false, published: true, publishedAt: todayStr()
};

export default function ManageNews() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyNews);
  const [saving, setSaving] = useState(false);

  const load = () => fetchAdminNews().then(setItems).catch(err => alert(err.message));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ ...emptyNews, publishedAt: todayStr() }); setEditing('new'); };
  const openEdit = (n) => { setForm({ ...emptyNews, ...n }); setEditing(n.id); };
  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing === 'new') await createNews(form);
      else await updateNews(editing, form);
      setEditing(null);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('確定要刪除此則消息？')) return;
    try {
      await deleteNews(id);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <AdminLayout>
      <div className="admin-header">
        <h1>最新消息管理</h1>
        <button className="btn" onClick={openNew}>新增消息</button>
      </div>

      {editing !== null && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing === 'new' ? '新增消息' : '編輯消息'}</h2>
            <form onSubmit={handleSave} className="admin-form" style={{ boxShadow: 'none', padding: 0 }}>
              <div className="form-group">
                <label>標題 *</label>
                <input value={form.title} onChange={e => update('title', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>內容</label>
                <textarea
                  rows={5}
                  value={form.content}
                  onChange={e => update('content', e.target.value)}
                  placeholder="可使用換行；保留適度留白讓內容透氣。"
                />
              </div>
              <ImageField
                label="封面圖（選填）"
                value={form.image}
                onChange={v => update('image', v)}
                hint="會自動縮小至 1600px JPEG"
              />
              <div className="form-row">
                <div className="form-group">
                  <label>發布日期</label>
                  <input type="date" value={form.publishedAt || ''} onChange={e => update('publishedAt', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>外部連結（選填）</label>
                  <input
                    type="url"
                    value={form.link || ''}
                    onChange={e => update('link', e.target.value)}
                    placeholder="https://instagram.com/..."
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={!!form.published}
                      onChange={e => update('published', e.target.checked)}
                    />
                    發布到前台
                  </label>
                </div>
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={!!form.pinned}
                      onChange={e => update('pinned', e.target.checked)}
                    />
                    置頂顯示
                  </label>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? '儲存中...' : '儲存'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-state">尚無消息</div>
      ) : (
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th>圖片</th>
                <th>標題</th>
                <th>發布日</th>
                <th>狀態</th>
                <th>置頂</th>
                <th style={{ width: '180px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(n => (
                <tr key={n.id}>
                  <td>{n.image ? <img src={n.image} alt={n.title} className="table-thumb" /> : '—'}</td>
                  <td>{n.title}</td>
                  <td>{n.publishedAt || '—'}</td>
                  <td>{n.published ? '公開' : '草稿'}</td>
                  <td>{n.pinned ? '★' : '—'}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => openEdit(n)}>編輯</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(n.id)}>刪除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
