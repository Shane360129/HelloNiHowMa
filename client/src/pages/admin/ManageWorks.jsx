import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { fetchWorks, createWork, updateWork, deleteWork } from '../../context/api';

const emptyWork = {
  title: '', description: '', image: '', category: '',
  notes: { top: '', middle: '', base: '' }, featured: false
};

export default function ManageWorks() {
  const [works, setWorks] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyWork);
  const [saving, setSaving] = useState(false);

  const load = () => fetchWorks().then(setWorks);
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm(emptyWork);
    setEditing('new');
  };

  const openEdit = (work) => {
    setForm({ ...work });
    setEditing(work.id);
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleNoteChange = (field, value) => {
    setForm(prev => ({
      ...prev,
      notes: { ...prev.notes, [field]: value }
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing === 'new') {
        await createWork(form);
      } else {
        await updateWork(editing, form);
      }
      setEditing(null);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('確定要刪除此作品？')) return;
    await deleteWork(id);
    await load();
  };

  return (
    <AdminLayout>
      <div className="admin-header">
        <h1>作品管理</h1>
        <button className="btn" onClick={openNew}>新增作品</button>
      </div>

      {editing !== null && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing === 'new' ? '新增作品' : '編輯作品'}</h2>
            <form onSubmit={handleSave} className="admin-form">
              <div className="form-row">
                <div className="form-group">
                  <label>作品名稱</label>
                  <input value={form.title} onChange={e => handleChange('title', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>分類</label>
                  <input value={form.category} onChange={e => handleChange('category', e.target.value)} placeholder="如：花香調、木質調" required />
                </div>
              </div>

              <div className="form-group">
                <label>描述</label>
                <textarea rows={3} value={form.description} onChange={e => handleChange('description', e.target.value)} required />
              </div>

              <div className="form-group">
                <label>圖片 URL</label>
                <input value={form.image} onChange={e => handleChange('image', e.target.value)} required />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>前調</label>
                  <input value={form.notes?.top || ''} onChange={e => handleNoteChange('top', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>中調</label>
                  <input value={form.notes?.middle || ''} onChange={e => handleNoteChange('middle', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>基調</label>
                  <input value={form.notes?.base || ''} onChange={e => handleNoteChange('base', e.target.value)} />
                </div>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input type="checkbox" checked={form.featured} onChange={e => handleChange('featured', e.target.checked)} />
                  設為精選（顯示於首頁）
                </label>
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

      <div className="works-table">
        <table>
          <thead>
            <tr>
              <th>圖片</th>
              <th>名稱</th>
              <th>分類</th>
              <th>精選</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {works.map(work => (
              <tr key={work.id}>
                <td><img src={work.image} alt={work.title} className="table-thumb" /></td>
                <td>{work.title}</td>
                <td>{work.category}</td>
                <td>{work.featured ? '✓' : '-'}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => openEdit(work)}>編輯</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(work.id)}>刪除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
