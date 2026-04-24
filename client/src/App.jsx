import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Services from './pages/Services';
import Works from './pages/Works';
import Booking from './pages/Booking';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import EditProfile from './pages/admin/EditProfile';
import ManageWorks from './pages/admin/ManageWorks';
import ManageServices from './pages/admin/ManageServices';
import ManageBookings from './pages/admin/ManageBookings';
import Settings from './pages/admin/Settings';
import ProtectedRoute from './components/ProtectedRoute';

const withNav = (el) => (
  <>
    <Navbar />
    {el}
  </>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={withNav(<Home />)} />
          <Route path="/services" element={withNav(<Services />)} />
          <Route path="/works" element={withNav(<Works />)} />
          <Route path="/booking" element={withNav(<Booking />)} />

          {/* Admin */}
          <Route path="/admin" element={<Login />} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/admin/bookings" element={<ProtectedRoute><ManageBookings /></ProtectedRoute>} />
          <Route path="/admin/services" element={<ProtectedRoute><ManageServices /></ProtectedRoute>} />
          <Route path="/admin/works" element={<ProtectedRoute><ManageWorks /></ProtectedRoute>} />
          <Route path="/admin/profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
