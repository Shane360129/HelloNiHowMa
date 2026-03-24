import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">載入中...</div>;
  if (!user) return <Navigate to="/admin" replace />;

  return children;
}
