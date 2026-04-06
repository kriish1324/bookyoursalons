import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { auth, requestFCMToken, onForegroundMessage } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Toaster } from 'sonner';
import ErrorBoundary from './components/ErrorBoundary';
import Landing from './pages/Landing';
import CustomerHome from './pages/CustomerHome';
import CustomerProfile from './pages/CustomerProfile';
import SalonDashboard from './pages/SalonDashboard';
import SalonRegistration from './pages/SalonRegistration';
import SalonPartnerSetup from './pages/SalonPartnerSetup';
import SalonPartnerLogin from './pages/SalonPartnerLogin';
import SalonPendingApproval from './pages/SalonPendingApproval';
import AdminLogin from './pages/AdminLogin';
import EnhancedAdminDashboard from './pages/EnhancedAdminDashboard';
import './App.css';

// Admin phone number for route protection - verified in AdminLogin.js
// const ADMIN_PHONE = '+916205777957';

// Loading spinner component
const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50">
    <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mb-4"></div>
    <p className="text-gray-600 font-medium">Loading...</p>
  </div>
);

// Auto-redirect wrapper for Landing page
function LandingWithAutoRedirect() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const userRole = localStorage.getItem('userRole');
    const firebaseUid = localStorage.getItem('firebaseUid');
    const partnerStatus = localStorage.getItem('partnerStatus');
    
    if (firebaseUid && userRole) {
      // Auto-redirect based on role
      if (userRole === 'customer') {
        navigate('/customer', { replace: true });
      } else if (userRole === 'salon') {
        if (partnerStatus === 'active') {
          navigate('/salon/dashboard', { replace: true });
        } else if (partnerStatus === 'pending') {
          navigate('/salon/pending', { replace: true });
        }
      }
    }
    setChecking(false);
  }, [navigate]);

  if (checking) {
    return <LoadingScreen />;
  }

  return <Landing />;
}

function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const role = localStorage.getItem('userRole');
        setUserRole(role);
        
        // Request FCM token for push notifications (salon partners)
        if (role === 'salon') {
          try {
            const fcmToken = await requestFCMToken();
            if (fcmToken) {
              console.log('FCM Token obtained');
              localStorage.setItem('fcmToken', fcmToken);
            }
          } catch (e) {
            console.log('FCM not available');
          }
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    // Listen for foreground messages
    onForegroundMessage((payload) => {
      if (payload.notification) {
        const { title, body } = payload.notification;
        import('sonner').then(({ toast }) => {
          toast(title, { description: body });
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  // Admin check: localStorage flag with valid session time (24 hours)
  const adminAuthTime = localStorage.getItem('adminAuthTime');
  const isAdminSessionValid = adminAuthTime && 
    (Date.now() - parseInt(adminAuthTime)) < 24 * 60 * 60 * 1000;
  const isAdmin = localStorage.getItem('isAdmin') === 'true' && isAdminSessionValid;
  const partnerStatus = localStorage.getItem('partnerStatus');
  const hasSalonAccess = (user && userRole === 'salon') || partnerStatus === 'active';

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster position="top-center" richColors />
        <Routes>
          <Route path="/" element={<LandingWithAutoRedirect />} />
          <Route path="/customer" element={user && userRole === 'customer' ? <CustomerHome /> : <Navigate to="/" />} />
          <Route path="/customer/profile" element={user && userRole === 'customer' ? <CustomerProfile /> : <Navigate to="/" />} />
          <Route path="/salon/partner-setup" element={<SalonPartnerSetup />} />
          <Route path="/salon/login" element={<SalonPartnerLogin />} />
          <Route path="/salon/register" element={<SalonRegistration />} />
          <Route path="/salon/pending" element={<SalonPendingApproval />} />
          <Route path="/salon/dashboard" element={hasSalonAccess ? <SalonDashboard /> : <Navigate to="/salon/pending" />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<Navigate to="/admin/login" />} />
          <Route path="/admin/dashboard" element={isAdmin ? <EnhancedAdminDashboard /> : <Navigate to="/admin/login" />} />
          {/* Catch-all route for 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;