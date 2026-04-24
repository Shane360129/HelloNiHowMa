import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ImageField from '../../components/ImageField';
import { fetchServices, createService, updateService, deleteService } from '../../context/api';

const emptyService = {
  name: '', subtitle: '', description: '', price: '', duration: '', durationMinutes: 210, image: '', featured: false, order: 0
};

export default function ManageServices() {
  const [services, setServices] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyService);
  const [saving, setSaving] = useState(false);

  const load = () => fetchServices().then(setServices);
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(emptyService); setEditing('new'); };
  const openEdit = (s) => { setForm({ ...s }); setEditing(s.id); };
  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing === 'new') await createService(form);
      else await updateService(editing, form);
      setEditing(null);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('確定要刪除此項目？')) return;
    try {
      await deleteService(id);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <AdminLayout>
      <div className="admin-header">
        <h1>服務項目管理</h1>
        <button className="btn" onClick={openNew}>新增項目</button>
      </div>

      {editing !== null && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing === 'new' ? '新增項目' : '編輯項目'}</h2>
            <form onSubmit={handleSave} className="admin-form" style={{ boxShadow: 'none', padding: 0 }}>
              <div className="form-row">
                <div className="form-group">
                  <label>項目名稱</label>
                  <input value={form.name} onChange={e => update('name', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>英文副標</label>
                  <input value={form.subtitle} onChange={e => update('subtitle', e.target.value)} placeholder="Korean Misty Brow" />
                </div>
              </div>
              <div className="form-group">
                <label>描述</label>
                <textarea rows={3} value={form.description} onChange={e => update('description', e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>價格</label>
                  <input value={form.price} onChange={e => update('price', e.target.value)} placeholder="NT$ 4,800" />
                </div>
                <div className="form-group">
                  <label>時長顯示文字</label>
                  <input value={form.duration} onChange={e => update('duration', e.target.value)} placeholder="約 150 分鐘" />
                </div>
                <div className="form-group">
                  <label>預約時長（分鐘）</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={form.durationMinutes ?? 210}
                    onChange={e => update('durationMinutes', Number(e.target.value))}
                  />
                  <p className="form-hint">實際鎖定行事曆的時間長度，預設 210 分鐘（3.5 小時）</p>
                </div>
                <div className="form-group">
                  <label>排序</label>
                  <input type="number" value={form.order} onChange={e => update('order', Number(e.target.value))} />
                </div>
              </div>
              <ImageField
                label="封面圖"
                value={form.image}
                onChange={v => update('image', v)}
              />
              <div className="form-group checkbox-group">
                <label>
                  <input type="checkbox" checked={form.featured} onChange={e => update('featured', e.target.checked)} />
                  設為精選（首頁推薦）
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

      {services.length === 0 ? (
        <div className="empty-state">尚未建立任何項目</div>
      ) : (
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th>封面</th>
                <th>名稱</th>
                <th>價格</th>
                <th>時長</th>
                <th>精選</th>
                <th>排序</th>
                <th style={{ width: '180px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id}>
                  <td>{s.image && <img src={s.image} alt={s.name} className="table-thumb" />}</td>
                  <td>
                    <div>{s.name}</div>
                    {s.subtitle && <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{s.subtitle}</div>}
                  </td>
                  <td>{s.price}</td>
                  <td>{s.duration}</td>
                  <td>{s.featured ? '✓' : '—'}</td>
                  <td>{s.order ?? 0}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => openEdit(s)}>編輯</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}>刪除</button>
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
