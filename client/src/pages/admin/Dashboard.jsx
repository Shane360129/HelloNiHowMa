import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { fetchProfile, fetchWorks } from '../../context/api';

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [works, setWorks] = useState([]);

  useEffect(() => {
    fetchProfile().then(setProfile);
    fetchWorks().then(setWorks);
  }, []);

  return (
    <AdminLayout>
      <h1>管理總覽</h1>
      <div className="dashboard-cards">
        <div className="dash-card">
          <h3>個人資訊</h3>
          {profile && (
            <>
              <p className="dash-value">{profile.name}</p>
              <p className="dash-sub">{profile.title}</p>
            </>
          )}
          <Link to="/admin/profile" className="btn btn-sm">編輯</Link>
        </div>
        <div className="dash-card">
          <h3>作品數量</h3>
          <p className="dash-value">{works.length}</p>
          <p className="dash-sub">已發布作品</p>
          <Link to="/admin/works" className="btn btn-sm">管理</Link>
        </div>
        <div className="dash-card">
          <h3>精選作品</h3>
          <p className="dash-value">{works.filter(w => w.featured).length}</p>
          <p className="dash-sub">顯示於首頁</p>
          <Link to="/admin/works" className="btn btn-sm">管理</Link>
        </div>
      </div>
    </AdminLayout>
  );
}
