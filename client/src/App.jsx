import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Portfolio from './pages/Portfolio';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import EditProfile from './pages/admin/EditProfile';
import ManageWorks from './pages/admin/ManageWorks';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<><Navbar /><Home /></>} />
          <Route path="/portfolio" element={<><Navbar /><Portfolio /></>} />

          {/* Admin */}
          <Route path="/admin" element={<Login />} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/admin/profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
          <Route path="/admin/works" element={<ProtectedRoute><ManageWorks /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
