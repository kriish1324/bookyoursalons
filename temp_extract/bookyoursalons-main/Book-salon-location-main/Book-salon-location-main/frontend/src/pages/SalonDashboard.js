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
import { toast } from 'sonner';
import { Scissors, Calendar, DollarSign, Clock, User, Camera, Upload, MapPin, AlertTriangle, CreditCard, IndianRupee, Check, X, Bell, Phone, Timer } from 'lucide-react';
import LocationPickerModal from '../components/LocationPickerModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const RAZORPAY_KEY = process.env.REACT_APP_RAZORPAY_KEY_ID || 'rzp_test_placeholder';

function SalonDashboard() {
  const navigate = useNavigate();
  const [salon, setSalon] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [commissionData, setCommissionData] = useState(null);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [showCommissionDialog, setShowCommissionDialog] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [bankDetails, setBankDetails] = useState({
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    upi_id: ''
  });
  const [loading, setLoading] = useState(true);
  const [payingCommission, setPayingCommission] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // Wait for auth initialization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthReady(true);
      if (user) {
        fetchSalonData();
      } else {
        // No authenticated user, check localStorage
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

  const fetchSalonDataByUid = async (uid) => {
    try {
      const salonResponse = await axios.get(`${API}/salon/user/${uid}`);
      setSalon(salonResponse.data || {});
      
      if (salonResponse.data?.salon_id) {
        const bookingsResponse = await axios.get(`${API}/bookings/salon/${salonResponse.data.salon_id}`);
        const bookingsData = Array.isArray(bookingsResponse.data) ? bookingsResponse.data : [];
        setBookings(bookingsData);
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
      setSalon(salonResponse.data || {});
      
      if (salonResponse.data?.salon_id) {
        const bookingsResponse = await axios.get(`${API}/bookings/salon/${salonResponse.data.salon_id}`);
        const bookingsData = Array.isArray(bookingsResponse.data) ? bookingsResponse.data : [];
        setBookings(bookingsData);
        
        // Fetch pending bookings
        try {
          const pendingResponse = await axios.get(`${API}/bookings/salon/${salonResponse.data.salon_id}/pending`);
          const pendingData = Array.isArray(pendingResponse.data) ? pendingResponse.data : [];
          setPendingBookings(pendingData);
        } catch (err) {
          console.error('Error fetching pending bookings:', err);
          setPendingBookings([]);
        }
        
        // Fetch commission data
        try {
          const commissionResponse = await axios.get(`${API}/commission/salon/${salonResponse.data.salon_id}`);
          setCommissionData(commissionResponse.data || {});
        } catch (err) {
          console.error('Error fetching commission data:', err);
          setCommissionData({});
        }
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
        prefill: {
          contact: salon.phone
        },
        theme: {
          color: '#dc2626'
        }
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
      console.error('Error saving bank details:', error);
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
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
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
      console.error('Error uploading photo:', error);
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
      console.error('Error updating location:', error);
      toast.error('Failed to update location');
    }
  };

  // Safe array operations
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  
  const todayBookings = safeBookings.filter(b => b && b.booking_date === new Date().toISOString().split('T')[0] && b.status === 'confirmed');
  const upcomingBookings = safeBookings.filter(b => b && new Date(b.booking_date) > new Date() && b.status === 'confirmed');
  const completedBookings = safeBookings.filter(b => b && b.status === 'completed');
  
  // COMMISSION RATE = 0% (temporarily disabled)
  const PLATFORM_COMMISSION_RATE = 0; // Can be changed to 0.10 for 10% in future
  
  const totalEarnings = safeBookings
    .filter(b => b && b.payment_status === 'paid')
    .reduce((sum, b) => sum + (b.service_price || 0), 0);
  const netEarnings = totalEarnings * (1 - PLATFORM_COMMISSION_RATE); // 100% goes to salon
  const platformCommission = totalEarnings * PLATFORM_COMMISSION_RATE; // 0% platform fee

  if (!salon) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Scissors className="w-8 h-8 text-purple-600 mr-2" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{salon.salon_name}</h1>
              <p className="text-sm text-gray-600">{salon.area}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button data-testid="update-location-btn" variant="outline" onClick={() => setShowLocationDialog(true)}>
              <MapPin className="w-4 h-4 mr-2" />
              Location
            </Button>
            <Button data-testid="upload-photo-btn" variant="outline" onClick={() => setShowPhotoDialog(true)}>
              <Camera className="w-4 h-4 mr-2" />
              Salon Photo
            </Button>
            <Button data-testid="manage-bank-btn" variant="outline" onClick={() => setShowBankDialog(true)}>
              Bank Details
            </Button>
            <Button data-testid="logout-btn" variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {salon.status === 'pending' && (
          <Card className="mb-6 border-yellow-300 bg-yellow-50">
            <CardContent className="pt-6">
              <p className="text-center text-yellow-800 font-medium">
                Your salon is pending approval. You'll be able to receive bookings once approved by admin.
              </p>
            </CardContent>
          </Card>
        )}

        {salon.status === 'blocked' && (
          <Card className="mb-6 border-red-500 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                <p className="font-medium">
                  Your salon is blocked due to overdue commission. Please pay your pending commission to continue receiving bookings.
                </p>
              </div>
              {commissionData?.current_month_ledger?.total_pending > 0 && (
                <div className="mt-4 text-center">
                  <Button onClick={() => setShowCommissionDialog(true)} className="bg-red-600 hover:bg-red-700">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay ₹{Number(commissionData.current_month_ledger?.total_pending || 0).toFixed(2)} Now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card data-testid="today-bookings-card">
            <CardHeader className="pb-3">
              <CardDescription>Today's Bookings</CardDescription>
              <CardTitle className="text-3xl">{todayBookings.length}</CardTitle>
            </CardHeader>
          </Card>

          <Card data-testid="upcoming-bookings-card">
            <CardHeader className="pb-3">
              <CardDescription>Upcoming</CardDescription>
              <CardTitle className="text-3xl">{upcomingBookings.length}</CardTitle>
            </CardHeader>
          </Card>

          <Card data-testid="total-earnings-card">
            <CardHeader className="pb-3">
              <CardDescription>Total Revenue</CardDescription>
              <CardTitle className="text-3xl">₹{totalEarnings}</CardTitle>
            </CardHeader>
          </Card>

          <Card data-testid="net-earnings-card" className="bg-green-50">
            <CardHeader className="pb-3">
              <CardDescription>Your Earnings (90%)</CardDescription>
              <CardTitle className="text-3xl text-green-700">₹{Number(netEarnings || 0).toFixed(0)}</CardTitle>
              <p className="text-xs text-gray-600 mt-1">Commission: ₹{Number(platformCommission || 0).toFixed(0)}</p>
            </CardHeader>
          </Card>
        </div>

        {/* Pending Bookings Alert Section */}
        {pendingBookings.length > 0 && (
          <Card className="mb-6 border-orange-400 bg-orange-50" data-testid="pending-bookings-alert">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700">
                <Bell className="w-5 h-5 animate-pulse" />
                New Booking Requests ({pendingBookings.length})
              </CardTitle>
              <CardDescription className="text-orange-600">
                Please respond within 15 minutes to avoid auto-cancellation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingBookings.map((booking) => {
                  const expiresAt = new Date(booking.approval_expires_at);
                  const now = new Date();
                  const minutesLeft = Math.max(0, Math.floor((expiresAt - now) / 60000));
                  
                  return (
                    <div 
                      key={booking.booking_id} 
                      className="bg-white p-4 rounded-lg border-2 border-orange-200"
                      data-testid={`pending-booking-${booking.booking_id}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="font-semibold">{booking.customer_name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4" />
                            <span>{booking.customer_phone}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Scissors className="w-4 h-4" />
                            <span>{booking.service_name} - ₹{booking.service_price}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            <span>{booking.booking_date} at {booking.slot_time}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CreditCard className="w-4 h-4" />
                            <span className={booking.payment_method === 'online' ? 'text-green-600' : 'text-blue-600'}>
                              {booking.payment_method === 'online' ? 'Online Payment' : 'Pay at Salon'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${
                            minutesLeft <= 5 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            <Timer className="w-3 h-3" />
                            <span>{minutesLeft} min left</span>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 flex-1"
                              onClick={() => handleApproveBooking(booking.booking_id)}
                              data-testid={`accept-btn-${booking.booking_id}`}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Accept
                            </Button>
                            <Button 
                              size="sm"
                              variant="destructive"
                              className="flex-1"
                              onClick={() => handleRejectBooking(booking.booking_id)}
                              data-testid={`reject-btn-${booking.booking_id}`}
                            >
                              <X className="w-4 h-4 mr-1" />
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

        {/* Subscription Status */}
        {salon.subscription_status === 'expired' && (
          <Card className="mb-6 border-red-500 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                <p className="font-medium">Your subscription has expired. Renew to continue receiving bookings.</p>
              </div>
              <div className="mt-4 text-center">
                <Button className="bg-red-600 hover:bg-red-700">Renew Subscription</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {salon.subscription_status === 'inactive' && (
          <Card className="mb-6 border-yellow-400 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-2 text-yellow-700">
                <Clock className="w-5 h-5" />
                <p className="font-medium">Your subscription payment is pending approval. Please wait for admin verification.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Commission Breakdown Section */}
        {commissionData && (
          <Card className="mb-6" data-testid="commission-breakdown-card">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <IndianRupee className="w-5 h-5" />
                    Commission Breakdown
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">10% platform fee on all bookings</CardDescription>
                </div>
                {commissionData.commission_summary?.offline_pending > 0 && (
                  <Button 
                    onClick={() => setShowCommissionDialog(true)}
                    className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
                    data-testid="pay-commission-btn"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay Now
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-green-50 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-600">Online (Auto)</p>
                  <p className="text-lg sm:text-2xl font-bold text-green-700">₹{Number(commissionData.commission_summary?.online_collected || 0).toFixed(2)}</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-lg ${commissionData.commission_summary?.offline_pending > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                  <p className="text-xs sm:text-sm text-gray-600">Offline (Pending)</p>
                  <p className={`text-lg sm:text-2xl font-bold ${commissionData.commission_summary?.offline_pending > 0 ? 'text-yellow-700' : 'text-gray-700'}`}>
                    ₹{Number(commissionData.commission_summary?.offline_pending || 0).toFixed(2)}
                  </p>
                </div>
                <div className="p-3 sm:p-4 bg-blue-50 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-600">Offline (Paid)</p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-700">₹{Number(commissionData.commission_summary?.offline_paid || 0).toFixed(2)}</p>
                </div>
                <div className="p-4 bg-gray-100 rounded-lg">
                  <p className="text-sm text-gray-600">Total Commission</p>
                  <p className="text-2xl font-bold">₹{Number(commissionData.commission_summary?.total_commission || 0).toFixed(2)}</p>
                </div>
              </div>
              
              {commissionData.due_date_countdown !== null && commissionData.commission_summary?.offline_pending > 0 && (
                <div className={`mt-4 p-3 rounded-lg text-center ${
                  commissionData.due_date_countdown <= 5 ? 'bg-red-100 text-red-700' : 
                  commissionData.due_date_countdown <= 10 ? 'bg-yellow-100 text-yellow-700' : 
                  'bg-blue-100 text-blue-700'
                }`}>
                  <p className="font-medium">
                    {commissionData.due_date_countdown <= 0 
                      ? '⚠️ Commission payment is OVERDUE!' 
                      : `Payment due in ${commissionData.due_date_countdown} days`}
                  </p>
                </div>
              )}

              <div className="mt-4 text-xs text-gray-500">
                <p>• Online payments: 10% commission auto-deducted before payout</p>
                <p>• Pay at Salon: Commission collected monthly via payment link</p>
                <p>• Total Bookings: {commissionData.total_bookings} (Online: {commissionData.online_bookings}, Offline: {commissionData.offline_bookings})</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Salon Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {salon.photo_url && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600 mb-2">Salon Photo</p>
                  <img src={salon.photo_url} alt="Salon" className="w-full max-w-md h-48 object-cover rounded-lg shadow-md" />
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Owner</p>
                <p className="font-medium">{salon.owner_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium">{salon.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Staff Count</p>
                <p className="font-medium">{salon.staff_count} members</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Service Time</p>
                <p className="font-medium">{salon.avg_service_time} minutes</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-600 mb-2">Services</p>
                <div className="flex flex-wrap gap-2">
                  {salon.services?.map((service) => (
                    <span key={service.id} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                      {service.name} - ₹{service.price}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="today">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
              
              <TabsContent value="today" className="space-y-3 mt-4">
                {todayBookings.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No bookings for today</p>
                ) : (
                  todayBookings.map((booking) => (
                    <BookingCard key={booking.booking_id} booking={booking} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="upcoming" className="space-y-3 mt-4">
                {upcomingBookings.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No upcoming bookings</p>
                ) : (
                  upcomingBookings.map((booking) => (
                    <BookingCard key={booking.booking_id} booking={booking} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="all" className="space-y-3 mt-4 max-h-96 overflow-y-auto">
                {bookings.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No bookings yet</p>
                ) : (
                  bookings.map((booking) => (
                    <BookingCard key={booking.booking_id} booking={booking} />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bank Account Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Account Holder Name *</label>
              <Input
                data-testid="account-holder-input"
                value={bankDetails.account_holder_name}
                onChange={(e) => setBankDetails({ ...bankDetails, account_holder_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Bank Name *</label>
              <Input
                data-testid="bank-name-input"
                value={bankDetails.bank_name}
                onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Account Number *</label>
              <Input
                data-testid="account-number-input"
                value={bankDetails.account_number}
                onChange={(e) => setBankDetails({ ...bankDetails, account_number: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">IFSC Code *</label>
              <Input
                data-testid="ifsc-input"
                value={bankDetails.ifsc_code}
                onChange={(e) => setBankDetails({ ...bankDetails, ifsc_code: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">UPI ID (Optional)</label>
              <Input
                data-testid="upi-input"
                value={bankDetails.upi_id}
                onChange={(e) => setBankDetails({ ...bankDetails, upi_id: e.target.value })}
              />
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Bank account must be verified via Razorpay for automatic commission split.
              </p>
            </div>
            <Button data-testid="save-bank-details-btn" className="w-full" onClick={saveBankDetails} disabled={loading}>
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
            {salon.photo_url && !photoPreview && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Current Photo:</p>
                <img src={salon.photo_url} alt="Current salon" className="w-full h-48 object-cover rounded-lg" />
              </div>
            )}
            
            {photoPreview && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Preview:</p>
                <img src={photoPreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Select Photo</label>
              <Input
                data-testid="photo-upload-input"
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handlePhotoSelect}
              />
              <p className="text-xs text-gray-500 mt-1">Max size: 5MB | Formats: JPG, JPEG, PNG</p>
            </div>

            <Button 
              data-testid="upload-photo-submit-btn"
              className="w-full" 
              onClick={uploadPhoto} 
              disabled={loading || !photoFile}
            >
              <Upload className="w-4 h-4 mr-2" />
              {loading ? 'Uploading...' : 'Upload Photo'}
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

      {/* Commission Payment Dialog */}
      <Dialog open={showCommissionDialog} onOpenChange={setShowCommissionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Pay Pending Commission
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {commissionData?.current_month_ledger && (
              <>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Billing Month</span>
                    <span className="font-medium">{commissionData.current_month_ledger.billing_month}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Offline Bookings</span>
                    <span className="font-medium">{commissionData.current_month_ledger.booking_count}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Amount Due</span>
                    <span className="text-red-600">₹{commissionData.current_month_ledger.total_pending?.toFixed(2)}</span>
                  </div>
                </div>

                {commissionData.due_date_countdown !== null && (
                  <div className={`p-3 rounded-lg text-center ${
                    commissionData.due_date_countdown <= 0 ? 'bg-red-100 text-red-700' :
                    commissionData.due_date_countdown <= 5 ? 'bg-yellow-100 text-yellow-700' : 
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {commissionData.due_date_countdown <= 0 
                      ? 'Payment is OVERDUE! Pay now to avoid blocking.' 
                      : `Due in ${commissionData.due_date_countdown} days`}
                  </div>
                )}

                <Button 
                  className="w-full bg-red-600 hover:bg-red-700"
                  onClick={handlePayCommission}
                  disabled={payingCommission}
                  data-testid="confirm-pay-commission-btn"
                >
                  {payingCommission ? 'Processing...' : `Pay ₹${commissionData.current_month_ledger.total_pending?.toFixed(2)} Now`}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  Payment will be processed securely via Razorpay
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookingCard({ booking }) {
  return (
    <Card data-testid={`booking-card-${booking.booking_id}`}>
      <CardContent className="pt-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              <p className="font-medium">{booking.customer_name}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Scissors className="w-4 h-4" />
              <span>{booking.service_name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>{booking.booking_date}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>{booking.slot_time}</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-green-600">
              <DollarSign className="w-4 h-4" />
              <span>₹{booking.service_price}</span>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-xs px-2 py-1 rounded ${
              booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
              booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {booking.status.toUpperCase()}
            </span>
            <p className="text-xs text-gray-500 mt-2">
              {booking.payment_method === 'online' ? 'Paid Online' : 'Pay at Salon'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SalonDashboard;