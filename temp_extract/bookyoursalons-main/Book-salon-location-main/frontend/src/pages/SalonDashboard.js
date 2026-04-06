import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { 
  Scissors, Calendar, DollarSign, Clock, User, Camera, Upload, MapPin, 
  AlertTriangle, CreditCard, IndianRupee, Check, X, Bell, Phone, Timer,
  TrendingUp, Users, Star, BarChart3, Image, Settings, Power
} from 'lucide-react';
import LocationPickerModal from '../components/LocationPickerModal';

// Use relative path for Firebase Functions
const API = '/api';
const RAZORPAY_KEY = process.env.REACT_APP_RAZORPAY_KEY_ID || 'rzp_test_placeholder';

function SalonDashboard() {
  const navigate = useNavigate();
  const [salon, setSalon] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [commissionData, setCommissionData] = useState(null);
  const [dashboardAnalytics, setDashboardAnalytics] = useState(null);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [showGalleryDialog, setShowGalleryDialog] = useState(false);
  const [showCommissionDialog, setShowCommissionDialog] = useState(false);
  const [showHoursDialog, setShowHoursDialog] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [bankDetails, setBankDetails] = useState({
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    upi_id: ''
  });
  const [hoursData, setHoursData] = useState({
    opening_time: '09:00',
    closing_time: '20:00'
  });
  const [loading, setLoading] = useState(true);
  const [payingCommission, setPayingCommission] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(true);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('1_month');
  const [trialInfo, setTrialInfo] = useState(null);

  const SUBSCRIPTION_PLANS = {
    '1_month': { price: 999, days: 30, name: '1 Month Plan' },
    '3_months': { price: 2499, days: 90, name: '3 Months Plan (Save ₹498)' }
  };

  // Wait for auth initialization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthReady(true);
      if (user) {
        fetchSalonData();
      } else {
        const firebaseUid = localStorage.getItem('firebaseUid');
        const partnerStatus = localStorage.getItem('partnerStatus');
        if (firebaseUid && partnerStatus === 'active') {
          fetchSalonDataByUid(firebaseUid);
        } else {
          setLoading(false);
          navigate('/salon/login');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Polling for new bookings every 30 seconds
  useEffect(() => {
    if (!salon?.salon_id) return;
    const interval = setInterval(() => {
      fetchPendingBookings();
      checkAutoClose();
    }, 30000);
    return () => clearInterval(interval);
  }, [salon?.salon_id]);

  const fetchPendingBookings = async () => {
    if (!salon?.salon_id) return;
    try {
      const response = await axios.get(`${API}/bookings/salon/${salon.salon_id}/pending`);
      const data = Array.isArray(response.data) ? response.data : [];
      setPendingBookings(data);
    } catch (err) {
      console.error('Error fetching pending bookings:', err);
      setPendingBookings([]);
    }
  };

  const checkAutoClose = async () => {
    if (!salon?.salon_id || !autoCloseEnabled) return;
    try {
      const response = await axios.post(`${API}/salon/${salon.salon_id}/check-auto-close`);
      if (response.data.auto_closed) {
        toast.info('Salon is now marked as FULLY BOOKED for today');
        fetchSalonData();
      }
    } catch (error) {
      console.error('Auto-close check error:', error);
    }
  };

  const fetchDashboardAnalytics = async (salonId) => {
    try {
      const response = await axios.get(`${API}/salon/${salonId}/dashboard-analytics`);
      setDashboardAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchSalonDataByUid = async (uid) => {
    try {
      const salonResponse = await axios.get(`${API}/salon/user/${uid}`);
      const salonData = salonResponse.data || {};
      setSalon(salonData);
      setIsOpen(salonData.current_status !== 'closed');
      setAutoCloseEnabled(salonData.auto_close_enabled !== false);
      setHoursData({
        opening_time: salonData.opening_time || '09:00',
        closing_time: salonData.closing_time || '20:00'
      });
      
      // Calculate trial info
      if (salonData.subscription) {
        const sub = salonData.subscription;
        const expiresAt = sub.expires_at || sub.trial_end_date;
        if (expiresAt) {
          const now = new Date();
          const expires = new Date(expiresAt);
          const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
          setTrialInfo({
            isFreeTrial: sub.plan === 'free_trial',
            daysRemaining: Math.max(0, daysLeft),
            expiresAt: expiresAt,
            planName: sub.plan_name || 'Free Trial',
            isExpired: daysLeft <= 0
          });
        }
      }
      
      if (salonData.salon_id) {
        const bookingsResponse = await axios.get(`${API}/bookings/salon/${salonData.salon_id}`);
        const bookingsData = Array.isArray(bookingsResponse.data) ? bookingsResponse.data : [];
        setBookings(bookingsData);
        fetchDashboardAnalytics(salonData.salon_id);
      }
    } catch (error) {
      console.error('Error fetching salon data:', error);
      if (error.response?.status === 404) {
        navigate('/salon/register');
      }
    }
    setLoading(false);
  };

  const fetchSalonData = async () => {
    try {
      const user = auth.currentUser;
      const uid = user?.uid || localStorage.getItem('firebaseUid');
      
      if (!uid) {
        console.error('No authenticated user');
        setLoading(false);
        return;
      }
      
      const salonResponse = await axios.get(`${API}/salon/user/${uid}`);
      const salonData = salonResponse.data || {};
      setSalon(salonData);
      setIsOpen(salonData.current_status !== 'closed');
      setAutoCloseEnabled(salonData.auto_close_enabled !== false);
      setHoursData({
        opening_time: salonData.opening_time || '09:00',
        closing_time: salonData.closing_time || '20:00'
      });
      
      // Calculate trial info
      if (salonData.subscription) {
        const sub = salonData.subscription;
        const expiresAt = sub.expires_at || sub.trial_end_date;
        if (expiresAt) {
          const now = new Date();
          const expires = new Date(expiresAt);
          const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
          setTrialInfo({
            isFreeTrial: sub.plan === 'free_trial',
            daysRemaining: Math.max(0, daysLeft),
            expiresAt: expiresAt,
            planName: sub.plan_name || 'Free Trial',
            isExpired: daysLeft <= 0
          });
        }
      }
      
      if (salonData.salon_id) {
        const bookingsResponse = await axios.get(`${API}/bookings/salon/${salonData.salon_id}`);
        const bookingsData = Array.isArray(bookingsResponse.data) ? bookingsResponse.data : [];
        setBookings(bookingsData);
        
        // Fetch pending bookings
        try {
          const pendingResponse = await axios.get(`${API}/bookings/salon/${salonData.salon_id}/pending`);
          const pendingData = Array.isArray(pendingResponse.data) ? pendingResponse.data : [];
          setPendingBookings(pendingData);
        } catch (err) {
          setPendingBookings([]);
        }
        
        // Fetch commission data - keeping for backward compatibility
        try {
          const commissionResponse = await axios.get(`${API}/commission/salon/${salonData.salon_id}`);
          setCommissionData(commissionResponse.data || {});
        } catch (err) {
          setCommissionData({});
        }

        // Fetch dashboard analytics
        fetchDashboardAnalytics(salonData.salon_id);
      }
    } catch (error) {
      console.error('Error fetching salon data:', error);
      if (error.response?.status === 404) {
        navigate('/salon/register');
      }
    }
    setLoading(false);
  };

  const handleApproveBooking = async (bookingId) => {
    try {
      await axios.post(`${API}/booking/${bookingId}/approve`);
      toast.success('Booking confirmed!');
      fetchSalonData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve booking');
    }
  };

  const handleRejectBooking = async (bookingId, reason = 'Salon unavailable') => {
    try {
      await axios.post(`${API}/booking/${bookingId}/reject?reason=${encodeURIComponent(reason)}`);
      toast.success('Booking rejected');
      fetchSalonData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject booking');
    }
  };

  const toggleSalonStatus = async () => {
    try {
      const newStatus = !isOpen;
      await axios.patch(`${API}/salon/${salon.salon_id}/toggle-status`, {
        is_open: newStatus,
        auto_close_enabled: autoCloseEnabled
      });
      setIsOpen(newStatus);
      toast.success(`Salon is now ${newStatus ? 'OPEN' : 'CLOSED'}`);
      fetchSalonData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const updateOperatingHours = async () => {
    try {
      await axios.patch(`${API}/salon/${salon.salon_id}/hours`, hoursData);
      toast.success('Operating hours updated!');
      setShowHoursDialog(false);
      fetchSalonData();
    } catch (error) {
      toast.error('Failed to update hours');
    }
  };

  const handlePayCommission = async () => {
    if (!salon || !commissionData?.current_month_ledger) {
      toast.error('No pending commission to pay');
      return;
    }
    
    setPayingCommission(true);
    try {
      const response = await axios.post(`${API}/commission/generate-payment-link/${salon.salon_id}`);
      
      const options = {
        key: response.data.razorpay_key || RAZORPAY_KEY,
        amount: response.data.amount * 100,
        currency: response.data.currency,
        name: 'BookYourSalons',
        description: `Commission Payment - ${response.data.billing_month}`,
        order_id: response.data.order_id,
        handler: async function (rzpResponse) {
          try {
            await axios.post(`${API}/commission/verify-payment`, {
              razorpay_payment_id: rzpResponse.razorpay_payment_id,
              razorpay_order_id: rzpResponse.razorpay_order_id,
              razorpay_signature: rzpResponse.razorpay_signature
            });
            toast.success('Commission payment successful!');
            fetchSalonData();
            setShowCommissionDialog(false);
          } catch (err) {
            toast.error('Payment verification failed');
          }
        },
        prefill: { contact: salon.phone },
        theme: { color: '#dc2626' }
      };
      
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Failed to initiate payment');
    }
    setPayingCommission(false);
  };

  const saveBankDetails = async () => {
    if (!bankDetails.account_holder_name || !bankDetails.bank_name || !bankDetails.account_number || !bankDetails.ifsc_code) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/salon/${salon.salon_id}/bank-details`, bankDetails);
      toast.success('Bank details saved successfully');
      setShowBankDialog(false);
      fetchSalonData();
    } catch (error) {
      toast.error('Failed to save bank details');
    }
    setLoading(false);
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5000000) {
        toast.error('File size must be less than 5MB');
        return;
      }
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        toast.error('Only JPG, JPEG, and PNG files are allowed');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleGallerySelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 5) {
      toast.error('Maximum 5 photos at a time');
      return;
    }

    const validFiles = files.filter(f => f.size <= 5000000 && ['image/jpeg', 'image/jpg', 'image/png'].includes(f.type));
    
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGalleryPhotos(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadGalleryPhotos = async () => {
    if (galleryPhotos.length === 0) {
      toast.error('Please select photos');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/salon/${salon.salon_id}/gallery`, {
        salon_id: salon.salon_id,
        photos: galleryPhotos
      });
      toast.success('Gallery updated!');
      setShowGalleryDialog(false);
      setGalleryPhotos([]);
      fetchSalonData();
    } catch (error) {
      toast.error('Failed to upload photos');
    }
    setLoading(false);
  };

  const uploadPhoto = async () => {
    if (!photoFile) {
      toast.error('Please select a photo');
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Photo = reader.result;
        await axios.post(`${API}/salon/${salon.salon_id}/upload-photo`, {
          salon_id: salon.salon_id,
          photo_url: base64Photo
        });
        toast.success('Photo uploaded successfully');
        setShowPhotoDialog(false);
        setPhotoFile(null);
        setPhotoPreview('');
        fetchSalonData();
      };
      reader.readAsDataURL(photoFile);
    } catch (error) {
      toast.error('Failed to upload photo');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    auth.signOut();
    localStorage.clear();
    navigate('/');
  };

  const handleLocationUpdate = async (selectedLocation) => {
    try {
      await axios.patch(`${API}/salon/${salon.salon_id}/location`, {
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng
      });
      toast.success('Location updated successfully!');
      fetchSalonData();
    } catch (error) {
      toast.error('Failed to update location');
    }
  };

  // Safe array operations
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const todayBookings = safeBookings.filter(b => b && b.booking_date === new Date().toISOString().split('T')[0] && b.status === 'confirmed');
  const upcomingBookings = safeBookings.filter(b => b && new Date(b.booking_date) > new Date() && b.status === 'confirmed');
  const completedBookings = safeBookings.filter(b => b && b.status === 'completed');
  
  // 0% commission - salon partners receive 100% revenue
  const totalEarnings = safeBookings.filter(b => b && b.payment_status === 'paid').reduce((sum, b) => sum + (b.service_price || 0), 0);

  if (!salon) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 pb-20">
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-2 sm:px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center">
              <Scissors className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 mr-2" />
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">{salon.salon_name}</h1>
                <p className="text-xs sm:text-sm text-gray-600">{salon.area}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Open/Closed Toggle */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
                <Power className={`w-4 h-4 ${isOpen ? 'text-green-600' : 'text-red-600'}`} />
                <span className="text-sm font-medium">{isOpen ? 'OPEN' : 'CLOSED'}</span>
                <Switch
                  checked={isOpen}
                  onCheckedChange={toggleSalonStatus}
                  data-testid="salon-status-toggle"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowHoursDialog(true)}>
                <Clock className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Hours</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowLocationDialog(true)}>
                <MapPin className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Location</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowPhotoDialog(true)}>
                <Camera className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Photo</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowGalleryDialog(true)}>
                <Image className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Gallery</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowBankDialog(true)}>
                <CreditCard className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Bank</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Status Alerts */}
        {salon.status === 'pending' && (
          <Card className="mb-4 border-yellow-300 bg-yellow-50">
            <CardContent className="pt-4 sm:pt-6">
              <p className="text-center text-yellow-800 font-medium text-sm sm:text-base">
                Your salon is pending approval. You'll be able to receive bookings once approved by admin.
              </p>
            </CardContent>
          </Card>
        )}

        {salon.status === 'blocked' && (
          <Card className="mb-4 border-red-500 bg-red-50">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-center justify-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                <p className="font-medium text-sm sm:text-base">Your salon is blocked. Contact support.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {salon.current_status === 'fully_booked' && (
          <Card className="mb-4 border-orange-400 bg-orange-50">
            <CardContent className="pt-4">
              <p className="text-center text-orange-700 font-medium">
                Your salon is FULLY BOOKED for today! Great job!
              </p>
            </CardContent>
          </Card>
        )}

        {/* FREE TRIAL CARD */}
        {trialInfo && trialInfo.isFreeTrial && !trialInfo.isExpired && (
          <Card className="mb-4 border-2 border-green-400 bg-gradient-to-r from-green-50 to-emerald-50" data-testid="trial-card">
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-3 rounded-full">
                    <Check className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-green-700">FREE TRIAL ACTIVE</h3>
                    <p className="text-sm text-green-600">Enjoy unlimited bookings during your trial period</p>
                  </div>
                </div>
                <div className="text-center bg-white px-6 py-3 rounded-lg shadow-sm">
                  <p className="text-3xl font-bold text-green-700">{trialInfo.daysRemaining}</p>
                  <p className="text-xs text-gray-500">days remaining</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TRIAL EXPIRING SOON WARNING */}
        {trialInfo && trialInfo.isFreeTrial && trialInfo.daysRemaining <= 7 && trialInfo.daysRemaining > 0 && (
          <Card className="mb-4 border-2 border-orange-400 bg-orange-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-orange-700">
                <AlertTriangle className="w-5 h-5" />
                <p className="font-medium">Your free trial ends in {trialInfo.daysRemaining} days! Upgrade now to continue.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TRIAL EXPIRED */}
        {trialInfo && trialInfo.isExpired && (
          <Card className="mb-4 border-2 border-red-400 bg-red-50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-5 h-5" />
                  <p className="font-medium">Your trial has expired! Upgrade to continue receiving bookings.</p>
                </div>
                <Button onClick={() => setShowUpgradeDialog(true)} className="bg-red-600 hover:bg-red-700">
                  Upgrade Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* UPGRADE PLAN CARD */}
        <Card className="mb-4 border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50" data-testid="upgrade-plan-card">
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-purple-700">Upgrade Your Plan</h3>
                <p className="text-sm text-gray-600">Unlock unlimited bookings and premium visibility.</p>
              </div>
              <Button 
                onClick={() => setShowUpgradeDialog(true)}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="upgrade-plan-btn"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mb-6">
          <Card data-testid="today-bookings-card">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Today</CardDescription>
              <CardTitle className="text-2xl sm:text-3xl">{todayBookings.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card data-testid="upcoming-bookings-card">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Upcoming</CardDescription>
              <CardTitle className="text-2xl sm:text-3xl">{upcomingBookings.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card data-testid="total-earnings-card">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Your Revenue</CardDescription>
              <CardTitle className="text-2xl sm:text-3xl">₹{totalEarnings}</CardTitle>
            </CardHeader>
          </Card>
          <Card data-testid="rating-card" className="bg-yellow-50">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs flex items-center gap-1">
                <Star className="w-3 h-3" />Rating
              </CardDescription>
              <CardTitle className="text-2xl sm:text-3xl text-yellow-700">{salon.rating || '4.0'}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Analytics Section */}
        {dashboardAnalytics && (
          <Card className="mb-6" data-testid="analytics-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <BarChart3 className="w-5 h-5" />
                Analytics Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-gray-600">This Week</p>
                  <p className="text-xl font-bold text-blue-700">{dashboardAnalytics.week?.bookings || 0}</p>
                  <p className="text-xs text-gray-500">₹{dashboardAnalytics.week?.revenue || 0}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-gray-600">This Month</p>
                  <p className="text-xl font-bold text-green-700">{dashboardAnalytics.month?.bookings || 0}</p>
                  <p className="text-xs text-gray-500">₹{dashboardAnalytics.month?.revenue || 0}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-gray-600">Total Customers</p>
                  <p className="text-xl font-bold text-purple-700">{dashboardAnalytics.customers?.total || 0}</p>
                  <p className="text-xs text-gray-500">{dashboardAnalytics.customers?.repeat || 0} repeat</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-xs text-gray-600">Repeat Rate</p>
                  <p className="text-xl font-bold text-orange-700">{dashboardAnalytics.customers?.repeat_rate || 0}%</p>
                </div>
              </div>

              {/* Popular Services */}
              {dashboardAnalytics.popular_services?.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-sm mb-2">Popular Services</h4>
                  <div className="flex flex-wrap gap-2">
                    {dashboardAnalytics.popular_services.map((service, idx) => (
                      <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                        {service.name} ({service.count})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Peak Hours */}
              {dashboardAnalytics.peak_hours?.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-sm mb-2">Peak Hours</h4>
                  <div className="flex flex-wrap gap-2">
                    {dashboardAnalytics.peak_hours.map((hour, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                        {hour.hour} ({hour.count})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pending Bookings Alert */}
        {pendingBookings.length > 0 && (
          <Card className="mb-6 border-orange-400 bg-orange-50" data-testid="pending-bookings-alert">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700 text-base sm:text-lg">
                <Bell className="w-5 h-5 animate-pulse" />
                New Booking Requests ({pendingBookings.length})
              </CardTitle>
              <CardDescription className="text-orange-600 text-xs sm:text-sm">
                Please respond within 15 minutes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 sm:space-y-4">
                {pendingBookings.map((booking) => {
                  const expiresAt = new Date(booking.approval_expires_at);
                  const now = new Date();
                  const minutesLeft = Math.max(0, Math.floor((expiresAt - now) / 60000));
                  
                  return (
                    <div 
                      key={booking.booking_id} 
                      className="bg-white p-3 sm:p-4 rounded-lg border-2 border-orange-200"
                      data-testid={`pending-booking-${booking.booking_id}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="space-y-1 sm:space-y-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="font-semibold text-sm sm:text-base">{booking.customer_name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                            <Phone className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span>{booking.customer_phone}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <Scissors className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span>{booking.service_name} - ₹{booking.service_price}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                            <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span>{booking.booking_date} at {booking.slot_time}</span>
                          </div>
                        </div>
                        <div className="flex flex-row sm:flex-col gap-2 items-center sm:items-end">
                          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                            minutesLeft <= 5 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            <Timer className="w-3 h-3" />
                            <span>{minutesLeft} min left</span>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-xs sm:text-sm"
                              onClick={() => handleApproveBooking(booking.booking_id)}
                            >
                              <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              Accept
                            </Button>
                            <Button 
                              size="sm"
                              variant="destructive"
                              className="text-xs sm:text-sm"
                              onClick={() => handleRejectBooking(booking.booking_id)}
                            >
                              <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Salon Info & Bookings */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Salon Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Salon Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {salon.photo_url && (
                  <img src={salon.photo_url} alt="Salon" className="w-full h-40 sm:h-48 object-cover rounded-lg" />
                )}
                
                {salon.photo_gallery?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Gallery ({salon.photo_gallery.length} photos)</p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {salon.photo_gallery.map((photo, idx) => (
                        <img key={idx} src={photo.url} alt={`Gallery ${idx}`} className="w-20 h-20 object-cover rounded flex-shrink-0" />
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600 text-xs">Owner</p>
                    <p className="font-medium">{salon.owner_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-xs">Phone</p>
                    <p className="font-medium">{salon.phone}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-xs">Staff</p>
                    <p className="font-medium">{salon.staff_count} members</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-xs">Avg Time</p>
                    <p className="font-medium">{salon.avg_service_time} min</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-xs">Opens</p>
                    <p className="font-medium">{salon.opening_time || '09:00'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-xs">Closes</p>
                    <p className="font-medium">{salon.closing_time || '20:00'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Services</p>
                  <div className="flex flex-wrap gap-2">
                    {salon.services?.map((service) => (
                      <span key={service.id} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                        {service.name} - ₹{service.price}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bookings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="today">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="today" className="text-xs sm:text-sm">Today</TabsTrigger>
                  <TabsTrigger value="upcoming" className="text-xs sm:text-sm">Upcoming</TabsTrigger>
                  <TabsTrigger value="all" className="text-xs sm:text-sm">All</TabsTrigger>
                </TabsList>
                
                <TabsContent value="today" className="space-y-2 mt-4 max-h-80 overflow-y-auto">
                  {todayBookings.length === 0 ? (
                    <p className="text-center text-gray-500 py-8 text-sm">No bookings for today</p>
                  ) : (
                    todayBookings.map((booking) => <BookingCard key={booking.booking_id} booking={booking} />)
                  )}
                </TabsContent>

                <TabsContent value="upcoming" className="space-y-2 mt-4 max-h-80 overflow-y-auto">
                  {upcomingBookings.length === 0 ? (
                    <p className="text-center text-gray-500 py-8 text-sm">No upcoming bookings</p>
                  ) : (
                    upcomingBookings.map((booking) => <BookingCard key={booking.booking_id} booking={booking} />)
                  )}
                </TabsContent>

                <TabsContent value="all" className="space-y-2 mt-4 max-h-80 overflow-y-auto">
                  {bookings.length === 0 ? (
                    <p className="text-center text-gray-500 py-8 text-sm">No bookings yet</p>
                  ) : (
                    bookings.slice(0, 20).map((booking) => <BookingCard key={booking.booking_id} booking={booking} />)
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hours Dialog */}
      <Dialog open={showHoursDialog} onOpenChange={setShowHoursDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Operating Hours</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Opening Time</label>
                <Input
                  type="time"
                  value={hoursData.opening_time}
                  onChange={(e) => setHoursData({ ...hoursData, opening_time: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Closing Time</label>
                <Input
                  type="time"
                  value={hoursData.closing_time}
                  onChange={(e) => setHoursData({ ...hoursData, closing_time: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Auto-close when fully booked</p>
                <p className="text-xs text-gray-500">Automatically mark as fully booked</p>
              </div>
              <Switch
                checked={autoCloseEnabled}
                onCheckedChange={setAutoCloseEnabled}
              />
            </div>
            <Button className="w-full" onClick={updateOperatingHours}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bank Details Dialog */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bank Account Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Account Holder Name *</label>
              <Input value={bankDetails.account_holder_name} onChange={(e) => setBankDetails({ ...bankDetails, account_holder_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Bank Name *</label>
              <Input value={bankDetails.bank_name} onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Account Number *</label>
              <Input value={bankDetails.account_number} onChange={(e) => setBankDetails({ ...bankDetails, account_number: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">IFSC Code *</label>
              <Input value={bankDetails.ifsc_code} onChange={(e) => setBankDetails({ ...bankDetails, ifsc_code: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">UPI ID (Optional)</label>
              <Input value={bankDetails.upi_id} onChange={(e) => setBankDetails({ ...bankDetails, upi_id: e.target.value })} />
            </div>
            <Button className="w-full" onClick={saveBankDetails} disabled={loading}>
              {loading ? 'Saving...' : 'Save Bank Details'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Upload Dialog */}
      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Salon Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {photoPreview && (
              <img src={photoPreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
            )}
            <Input type="file" accept="image/jpeg,image/jpg,image/png" onChange={handlePhotoSelect} />
            <p className="text-xs text-gray-500">Max size: 5MB | Formats: JPG, JPEG, PNG</p>
            <Button className="w-full" onClick={uploadPhoto} disabled={loading || !photoFile}>
              <Upload className="w-4 h-4 mr-2" />
              {loading ? 'Uploading...' : 'Upload Photo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gallery Upload Dialog */}
      <Dialog open={showGalleryDialog} onOpenChange={setShowGalleryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Photo Gallery</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {galleryPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {galleryPhotos.map((photo, idx) => (
                  <div key={idx} className="relative">
                    <img src={photo} alt={`Upload ${idx}`} className="w-20 h-20 object-cover rounded" />
                    <button
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1"
                      onClick={() => setGalleryPhotos(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Input type="file" accept="image/jpeg,image/jpg,image/png" multiple onChange={handleGallerySelect} />
            <p className="text-xs text-gray-500">Select up to 5 photos at a time</p>
            <Button className="w-full" onClick={uploadGalleryPhotos} disabled={loading || galleryPhotos.length === 0}>
              <Upload className="w-4 h-4 mr-2" />
              {loading ? 'Uploading...' : `Upload ${galleryPhotos.length} Photos`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location Update Modal */}
      <LocationPickerModal
        isOpen={showLocationDialog}
        onClose={() => setShowLocationDialog(false)}
        onLocationSelect={handleLocationUpdate}
        initialLocation={salon?.location?.coordinates ? { lat: salon.location.coordinates[1], lng: salon.location.coordinates[0] } : null}
        title="Update Salon Location"
      />

      {/* Upgrade Plan Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Upgrade Your Plan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Choose a subscription plan to continue receiving bookings after your trial ends.
            </p>
            
            {/* Plan Options */}
            <div className="space-y-3">
              <div 
                onClick={() => setSelectedPlan('1_month')}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedPlan === '1_month' 
                    ? 'border-purple-600 bg-purple-50' 
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">1 Month Plan</p>
                    <p className="text-2xl font-bold text-purple-700">₹999</p>
                  </div>
                  {selectedPlan === '1_month' && (
                    <Check className="w-6 h-6 text-purple-600" />
                  )}
                </div>
              </div>
              
              <div 
                onClick={() => setSelectedPlan('3_months')}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all relative ${
                  selectedPlan === '3_months' 
                    ? 'border-purple-600 bg-purple-50' 
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <span className="absolute -top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded">BEST VALUE</span>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">3 Months Plan</p>
                    <p className="text-2xl font-bold text-purple-700">₹2499</p>
                    <p className="text-xs text-green-600">Save ₹498</p>
                  </div>
                  {selectedPlan === '3_months' && (
                    <Check className="w-6 h-6 text-purple-600" />
                  )}
                </div>
              </div>
            </div>

            {/* UPI Payment Section */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="font-medium text-blue-800 mb-2">Payment via UPI</p>
              <p className="text-sm text-blue-700">Pay ₹{SUBSCRIPTION_PLANS[selectedPlan].price} to:</p>
              <p className="font-mono text-blue-800 mt-1 bg-white px-2 py-1 rounded">6205777957-i24a@axl</p>
              <Button
                type="button"
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  const amount = SUBSCRIPTION_PLANS[selectedPlan].price;
                  const upiLink = `upi://pay?pa=6205777957-i24a@axl&pn=BookYourSalons&am=${amount}&cu=INR&tn=Subscription_${selectedPlan}`;
                  window.location.href = upiLink;
                }}
              >
                <IndianRupee className="w-4 h-4 mr-2" />
                Pay ₹{SUBSCRIPTION_PLANS[selectedPlan].price} via UPI App
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              After payment, your subscription will be activated within 24 hours. Contact support if you face any issues.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookingCard({ booking }) {
  return (
    <Card className="p-3" data-testid={`booking-card-${booking.booking_id}`}>
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <User className="w-3 h-3 text-gray-500" />
            <p className="font-medium text-sm">{booking.customer_name}</p>
          </div>
          <p className="text-xs text-gray-600">{booking.service_name}</p>
          <p className="text-xs text-gray-500">{booking.booking_date} at {booking.slot_time}</p>
          <p className="text-xs font-medium text-green-600">₹{booking.service_price}</p>
        </div>
        <div className="text-right">
          <span className={`text-xs px-2 py-0.5 rounded ${
            booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
            booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
            booking.status === 'completed' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {booking.status.toUpperCase()}
          </span>
        </div>
      </div>
    </Card>
  );
}

export default SalonDashboard;
