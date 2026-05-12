import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Services from './pages/Services';
import Works from './pages/Works';
import Booking from './pages/Booking';
import MyBookings from './pages/MyBookings';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import EditProfile from './pages/admin/EditProfile';
import ManageWorks from './pages/admin/ManageWorks';
import ManageServices from './pages/admin/ManageServices';
import ManageBookings from './pages/admin/ManageBookings';
import ManageUsers from './pages/admin/ManageUsers';
import ManageNews from './pages/admin/ManageNews';
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
      <CustomerAuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={withNav(<Home />)} />
            <Route path="/services" element={withNav(<Services />)} />
            <Route path="/works" element={withNav(<Works />)} />
            <Route path="/booking" element={withNav(<Booking />)} />
            <Route path="/me/bookings" element={withNav(<MyBookings />)} />

            {/* Admin */}
            <Route path="/admin" element={<Login />} />
            <Route path="/admin/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admin/bookings" element={<ProtectedRoute><ManageBookings /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><ManageUsers /></ProtectedRoute>} />
            <Route path="/admin/services" element={<ProtectedRoute><ManageServices /></ProtectedRoute>} />
            <Route path="/admin/works" element={<ProtectedRoute><ManageWorks /></ProtectedRoute>} />
            <Route path="/admin/news" element={<ProtectedRoute><ManageNews /></ProtectedRoute>} />
            <Route path="/admin/profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </CustomerAuthProvider>
    </AuthProvider>
  );
}
