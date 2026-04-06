import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { 
  MapPin, Search, Star, Clock, Calendar, LogOut, Navigation, Map, User, Heart, 
  Bell, TrendingUp, Sparkles, Camera, ChevronRight, X, Phone, AlertTriangle,
  CheckCircle, Image
} from 'lucide-react';
import LocationPickerModal from '../components/LocationPickerModal';
import NearbySalonsMap from '../components/NearbySalonsMap';

// Use relative path for Firebase Functions
const API = '/api';

const categories = [
  { id: 'haircut', name: 'Haircut', icon: '✂️' },
  { id: 'makeup', name: 'Makeup', icon: '💄' },
  { id: 'facial', name: 'Facial', icon: '🧖' },
  { id: 'spa', name: 'Spa', icon: '💆' },
  { id: 'bridal', name: 'Bridal', icon: '👰' }
];

function CustomerHome() {
  const navigate = useNavigate();
  const [userGender, setUserGender] = useState(localStorage.getItem('userGender') || '');
  const [location, setLocation] = useState({ lat: null, lng: null, address: 'Choose Your Location' });
  const [searchQuery, setSearchQuery] = useState('');
  const [radius] = useState(5);
  const [salons, setSalons] = useState([]);
  const [filteredSalons, setFilteredSalons] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSalon, setSelectedSalon] = useState(null);
  const [showBooking, setShowBooking] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [bookings, setBookings] = useState([]);
  const [showBookings, setShowBookings] = useState(false);
  const [sortBy, setSortBy] = useState('rating');
  const [loading, setLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showMapView, setShowMapView] = useState(false);
  const [trendingSalons, setTrendingSalons] = useState([]);
  const [recommendedSalons, setRecommendedSalons] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [bookingReminder, setBookingReminder] = useState(null);
  const [showReminderBanner, setShowReminderBanner] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewData, setReviewData] = useState({ rating: 5, review_text: '' });
  const [salonReviews, setSalonReviews] = useState([]);
  const [showSalonDetails, setShowSalonDetails] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [serviceReminders, setServiceReminders] = useState([]);
  const [currentLockId, setCurrentLockId] = useState(null);

  // Spam protection
  const [recentBookingTimes, setRecentBookingTimes] = useState([]);

  const handleGenderChange = (gender) => {
    setUserGender(gender);
    localStorage.setItem('userGender', gender);
    filterAndSortSalons();
  };

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    loadSavedLocation();
    fetchFavorites();
    checkUpcomingReminders();
    fetchTrendingSalons();
    fetchRecommendedSalons();
    fetchServiceReminders();
  }, []);

  // Check reminders every minute
  useEffect(() => {
    const interval = setInterval(checkUpcomingReminders, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchTrendingSalons = async () => {
    try {
      const response = await axios.get(`${API}/salons/trending`);
      setTrendingSalons(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching trending salons:', error);
    }
  };

  const fetchRecommendedSalons = async () => {
    try {
      const phone = localStorage.getItem('userPhone');
      if (!phone) return;
      const response = await axios.get(`${API}/salons/recommended?customer_phone=${phone}`);
      setRecommendedSalons(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching recommended salons:', error);
    }
  };

  const fetchServiceReminders = async () => {
    try {
      const phone = localStorage.getItem('userPhone');
      if (!phone) return;
      const response = await axios.get(`${API}/customer/${phone}/service-reminders`);
      setServiceReminders(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching service reminders:', error);
    }
  };

  const checkUpcomingReminders = async () => {
    try {
      const phone = localStorage.getItem('userPhone');
      if (!phone) return;
      
      const response = await axios.get(`${API}/bookings/upcoming-reminders/${phone}`);
      const reminders = Array.isArray(response.data) ? response.data : [];
      
      if (reminders.length > 0) {
        const urgent = reminders.find(r => r.is_urgent);
        if (urgent) {
          setBookingReminder(urgent);
          setShowReminderBanner(true);
          // Show toast for urgent reminders
          toast.warning(
            `Your appointment at ${urgent.salon_name} starts in ${urgent.minutes_away} minutes!`,
            { duration: 10000 }
          );
        }
      }
    } catch (error) {
      console.error('Error checking reminders:', error);
    }
  };

  const fetchFavorites = async () => {
    try {
      const firebaseUid = localStorage.getItem('firebaseUid');
      if (!firebaseUid) return;
      const response = await axios.get(`${API}/customer/${firebaseUid}/favorites`);
      setFavorites(Array.isArray(response.data) ? response.data.map(s => s.salon_id) : []);
    } catch (error) {
      setFavorites([]);
    }
  };

  const toggleFavorite = async (salonId, e) => {
    e.stopPropagation();
    try {
      const firebaseUid = localStorage.getItem('firebaseUid');
      if (!firebaseUid) {
        toast.error('Please login to save favorites');
        return;
      }
      
      await axios.post(`${API}/customer/${firebaseUid}/favorites/${salonId}`);
      
      if (favorites.includes(salonId)) {
        setFavorites(favorites.filter(id => id !== salonId));
        toast.success('Removed from favorites');
      } else {
        setFavorites([...favorites, salonId]);
        toast.success('Added to favorites');
      }
    } catch (error) {
      toast.error('Failed to update favorites');
    }
  };

  useEffect(() => {
    if (location.lat && location.lng) {
      searchSalons();
    }
  }, [location]);

  useEffect(() => {
    filterAndSortSalons();
  }, [salons, searchQuery, selectedCategory, sortBy]);

  const loadSavedLocation = () => {
    const savedLocation = localStorage.getItem('customerLocation');
    if (savedLocation) {
      try {
        const parsed = JSON.parse(savedLocation);
        setLocation(parsed);
      } catch (e) {
        setLocation({ lat: null, lng: null, address: 'Choose Your Location' });
      }
    }
  };

  const handleLocationSelect = (selectedLocation) => {
    try {
      if (!selectedLocation || typeof selectedLocation.lat !== 'number' || typeof selectedLocation.lng !== 'number') {
        toast.error('Invalid location. Please try again.');
        return;
      }

      const newLocation = {
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        address: selectedLocation.address || `${Number(selectedLocation.lat).toFixed(6)}, ${Number(selectedLocation.lng).toFixed(6)}`
      };
      
      setLocation(newLocation);
      localStorage.setItem('customerLocation', JSON.stringify(newLocation));
      toast.success('Location saved successfully!');
    } catch (error) {
      toast.error('Failed to save location. Please try again.');
    }
  };

  const searchSalons = async () => {
    if (!location.lat || !location.lng) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API}/salons/nearby`, {
        params: { lat: location.lat, lng: location.lng, radius }
      });
      const salonData = Array.isArray(response.data) ? response.data : [];
      setSalons(salonData);
    } catch (error) {
      console.error('Error fetching salons:', error);
      setSalons([]);
    }
    setLoading(false);
  };

  // Smart Search
  const handleSmartSearch = async (query) => {
    if (!query || query.length < 2) {
      setShowSearchResults(false);
      setSearchResults([]);
      return;
    }
    
    try {
      const response = await axios.get(`${API}/search`, {
        params: { 
          query, 
          lat: location.lat || undefined, 
          lng: location.lng || undefined 
        }
      });
      setSearchResults(Array.isArray(response.data) ? response.data : []);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const filterAndSortSalons = () => {
    let filtered = Array.isArray(salons) ? [...salons] : [];

    if (userGender && filtered.length > 0) {
      filtered = filtered.filter(salon => {
        if (!salon) return false;
        if (userGender === 'male') {
          return salon.business_type === 'salon' || !salon.business_type;
        } else if (userGender === 'female') {
          return salon.business_type === 'parlour' || !salon.business_type;
        }
        return true;
      });
    }

    if (searchQuery && filtered.length > 0) {
      filtered = filtered.filter(salon => {
        if (!salon) return false;
        const nameMatch = salon.salon_name?.toLowerCase().includes(searchQuery.toLowerCase());
        const areaMatch = salon.area?.toLowerCase().includes(searchQuery.toLowerCase());
        const serviceMatch = Array.isArray(salon.services) && salon.services.some(s => s?.name?.toLowerCase().includes(searchQuery.toLowerCase()));
        return nameMatch || areaMatch || serviceMatch;
      });
    }

    if (selectedCategory !== 'all' && filtered.length > 0) {
      filtered = filtered.filter(salon => {
        if (!salon) return false;
        return Array.isArray(salon.services) && salon.services.some(s => s?.name?.toLowerCase().includes(selectedCategory));
      });
    }

    filtered.sort((a, b) => {
      if (sortBy === 'rating') return (b?.rating || 4.0) - (a?.rating || 4.0);
      if (sortBy === 'price') {
        const aPrice = Array.isArray(a?.services) && a.services[0]?.price ? a.services[0].price : 0;
        const bPrice = Array.isArray(b?.services) && b.services[0]?.price ? b.services[0].price : 0;
        return aPrice - bPrice;
      }
      return 0;
    });

    setFilteredSalons(filtered);
  };

  const fetchSlots = async (salonId, date) => {
    try {
      const response = await axios.get(`${API}/salon/${salonId}/slots`, { params: { date } });
      const slots = Array.isArray(response.data?.available_slots) ? response.data.available_slots : [];
      setAvailableSlots(slots);
    } catch (error) {
      console.error('Error fetching slots:', error);
      setAvailableSlots([]);
    }
  };

  const fetchSalonReviews = async (salonId) => {
    try {
      const response = await axios.get(`${API}/salon/${salonId}/reviews`);
      setSalonReviews(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setSalonReviews([]);
    }
  };

  const handleViewSalonDetails = (salon) => {
    setSelectedSalon(salon);
    fetchSalonReviews(salon.salon_id);
    setShowSalonDetails(true);
  };

  const handleBookService = (salon, service) => {
    setSelectedSalon(salon);
    setSelectedService(service);
    setShowBooking(true);
    setShowSalonDetails(false);
    if (selectedDate) fetchSlots(salon.salon_id, selectedDate);
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setSelectedSlot(''); // Reset slot selection on date change
    setCurrentLockId(null);
    if (selectedSalon) fetchSlots(selectedSalon.salon_id, date);
  };

  // Lock slot when selected to prevent double booking
  const handleSlotSelect = async (slot) => {
    if (!selectedSalon || !selectedDate) return;
    
    const phone = localStorage.getItem('userPhone') || '';
    
    try {
      const response = await axios.post(`${API}/slot/lock`, {
        salon_id: selectedSalon.salon_id,
        slot_time: slot,
        booking_date: selectedDate,
        customer_phone: phone
      });
      
      if (response.data.locked) {
        setSelectedSlot(slot);
        setCurrentLockId(response.data.lock_id || null);
        toast.success('Slot reserved for 5 minutes');
      } else {
        toast.error(response.data.message || 'Slot not available');
        // Refresh slots
        fetchSlots(selectedSalon.salon_id, selectedDate);
      }
    } catch (error) {
      console.error('Slot lock error:', error);
      setSelectedSlot(slot); // Fallback - allow selection anyway
    }
  };

  const createBooking = async () => {
    if (!selectedSlot || !paymentMethod) {
      toast.error('Please select slot and payment method');
      return;
    }

    // Backend spam check
    const phone = localStorage.getItem('userPhone');
    try {
      const spamCheck = await axios.post(`${API}/booking/check-spam`, { customer_phone: phone });
      if (!spamCheck.data.allowed) {
        toast.error(spamCheck.data.message);
        return;
      }
    } catch (error) {
      console.error('Spam check error:', error);
    }

    const customerPhone = localStorage.getItem('userPhone');
    const customerName = localStorage.getItem('userName') || 'Customer';

    setLoading(true);
    try {
      const response = await axios.post(`${API}/booking/create`, {
        salon_id: selectedSalon.salon_id,
        service_id: selectedService.id,
        slot_time: selectedSlot,
        booking_date: selectedDate,
        payment_method: paymentMethod,
        customer_phone: customerPhone,
        customer_name: customerName
      });

      if (paymentMethod === 'online') {
        const orderResponse = await axios.post(`${API}/payment/create-order`, {
          amount: selectedService.price,
          booking_id: response.data.booking_id
        });

        const options = {
          key: process.env.REACT_APP_RAZORPAY_KEY_ID,
          amount: orderResponse.data.amount,
          currency: 'INR',
          order_id: orderResponse.data.id,
          handler: async (paymentResponse) => {
            await axios.post(`${API}/payment/verify`, paymentResponse);
            toast.success('Booking confirmed & payment successful!');
            setShowBooking(false);
            resetBookingForm();
          },
          prefill: { contact: customerPhone }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } else {
        toast.success('Booking request sent! Wait for salon confirmation.');
        setShowBooking(false);
        resetBookingForm();
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    }
    setLoading(false);
  };

  const resetBookingForm = () => {
    setSelectedSlot('');
    setPaymentMethod('');
    setSelectedService(null);
    setSelectedSalon(null);
  };

  const fetchBookings = async () => {
    const phone = localStorage.getItem('userPhone');
    if (!phone) {
      setBookings([]);
      setShowBookings(true);
      return;
    }
    try {
      const response = await axios.get(`${API}/bookings/customer/${phone}`);
      const bookingsData = Array.isArray(response.data) ? response.data : [];
      setBookings(bookingsData);
      setShowBookings(true);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookings([]);
      setShowBookings(true);
    }
  };

  const cancelBooking = async (bookingId) => {
    try {
      await axios.patch(`${API}/booking/${bookingId}/cancel`);
      toast.success('Booking cancelled');
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel');
    }
  };

  const submitReview = async () => {
    if (!selectedSalon) return;
    
    try {
      await axios.post(`${API}/review/create`, {
        salon_id: selectedSalon.salon_id,
        customer_phone: localStorage.getItem('userPhone'),
        customer_name: localStorage.getItem('userName') || 'Customer',
        rating: reviewData.rating,
        review_text: reviewData.review_text
      });
      toast.success('Review submitted!');
      setShowReviewDialog(false);
      setReviewData({ rating: 5, review_text: '' });
      fetchSalonReviews(selectedSalon.salon_id);
    } catch (error) {
      toast.error('Failed to submit review');
    }
  };

  const handleLogout = () => {
    auth.signOut();
    localStorage.clear();
    navigate('/');
  };

  const getSalonStatusBadge = (salon) => {
    const status = salon.current_status || 'open';
    if (status === 'closed') {
      return <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">CLOSED</span>;
    }
    if (status === 'fully_booked') {
      return <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">FULLY BOOKED</span>;
    }
    return <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">OPEN</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      
      {/* Reminder Banner */}
      {showReminderBanner && bookingReminder && (
        <div className="bg-yellow-500 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 animate-pulse" />
            <span className="text-sm font-medium">
              Your appointment at {bookingReminder.salon_name} starts in {bookingReminder.minutes_away} minutes!
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowReminderBanner(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-red-600 whitespace-nowrap">BookYourSalons</h1>
              <Button 
                data-testid="choose-location-btn"
                variant="outline"
                onClick={() => setShowLocationPicker(true)}
                className="flex items-center gap-1 sm:gap-2 border-red-200 hover:bg-red-50 hover:border-red-400 transition-all text-xs sm:text-sm px-2 sm:px-3"
              >
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-red-600 flex-shrink-0" />
                <span className="font-medium text-gray-700 max-w-[80px] sm:max-w-[150px] md:max-w-[200px] truncate">
                  {location.lat ? (location.address?.split(',')[0] || 'Location Set') : 'Choose Location'}
                </span>
                {location.lat && <Navigation className="w-3 h-3 text-green-600 hidden sm:block" />}
              </Button>
            </div>
            <div className="flex gap-1 sm:gap-2 flex-shrink-0">
              {location.lat && (
                <Button 
                  size="sm" 
                  variant={showMapView ? "default" : "outline"}
                  onClick={() => setShowMapView(!showMapView)}
                  className="text-xs sm:text-sm px-2 sm:px-3"
                  data-testid="toggle-map-btn"
                >
                  <Map className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Map</span>
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => navigate('/customer/profile')}
                className="text-xs sm:text-sm px-2 sm:px-3"
              >
                <User className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                <span className="hidden sm:inline">Profile</span>
              </Button>
              <Button size="sm" variant="outline" onClick={fetchBookings} className="text-xs sm:text-sm px-2 sm:px-3">
                <span className="hidden sm:inline">Bookings</span>
                <Calendar className="w-4 h-4 sm:hidden" />
              </Button>
              <Button size="sm" variant="outline" onClick={handleLogout} className="px-2 sm:px-3">
                <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Smart Search */}
      <div className="bg-red-600 text-white py-4 sm:py-8">
        <div className="container mx-auto px-2 sm:px-4">
          <div className="max-w-2xl mx-auto">
            {!location.lat && (
              <div className="bg-white/10 backdrop-blur rounded-lg p-3 sm:p-4 mb-3 sm:mb-4 text-center">
                <p className="text-white/90 mb-2 sm:mb-3 text-sm sm:text-base">Select your location to discover nearby salons</p>
                <Button 
                  data-testid="hero-choose-location-btn"
                  onClick={() => setShowLocationPicker(true)}
                  className="bg-white text-red-600 hover:bg-gray-100 text-sm sm:text-base"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Choose Your Location
                </Button>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <Input
                className="pl-10 sm:pl-12 py-4 sm:py-6 text-base sm:text-lg bg-white text-gray-900"
                placeholder="Search salon, service, area..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleSmartSearch(e.target.value);
                }}
                data-testid="smart-search-input"
              />
              {/* Search Results Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white rounded-b-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  {searchResults.slice(0, 5).map((salon) => (
                    <div 
                      key={salon.salon_id}
                      className="p-3 border-b hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                      onClick={() => {
                        handleViewSalonDetails(salon);
                        setShowSearchResults(false);
                      }}
                    >
                      <div>
                        <p className="font-medium text-gray-900">{salon.salon_name}</p>
                        <p className="text-sm text-gray-500">{salon.area}</p>
                      </div>
                      <div className="flex items-center gap-1 text-yellow-600">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm">{salon.rating || '4.0'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {/* Service Reminders */}
        {serviceReminders.length > 0 && (
          <Card className="mb-4 border-blue-200 bg-blue-50" data-testid="service-reminders">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
                <Bell className="w-4 h-4" />
                Time for your next visit!
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {serviceReminders.slice(0, 3).map((reminder, idx) => (
                  <div key={idx} className="flex-shrink-0 bg-white p-2 rounded-lg border text-sm">
                    <p className="font-medium">{reminder.service_name}</p>
                    <p className="text-xs text-gray-500">{reminder.salon_name}</p>
                    <p className="text-xs text-blue-600">{reminder.days_since} days ago</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Map View */}
        {location.lat && showMapView && (
          <div className="mb-4 sm:mb-6">
            <NearbySalonsMap
              userLocation={{ lat: location.lat, lng: location.lng }}
              salons={salons}
              radius={radius}
              onSalonSelect={(salon) => handleViewSalonDetails(salon)}
            />
          </div>
        )}

        {/* Trending Salons Section */}
        {trendingSalons.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-red-600" />
                Trending Near You
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
              {trendingSalons.slice(0, 5).map((salon) => (
                <Card 
                  key={salon.salon_id} 
                  className="flex-shrink-0 w-64 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleViewSalonDetails(salon)}
                  data-testid={`trending-salon-${salon.salon_id}`}
                >
                  {salon.photo_url && (
                    <div className="h-32 overflow-hidden rounded-t-lg">
                      <img src={salon.photo_url} alt={salon.salon_name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{salon.salon_name}</p>
                        <p className="text-xs text-gray-500">{salon.area}</p>
                      </div>
                      <div className="flex items-center gap-1 bg-green-600 text-white px-1.5 py-0.5 rounded text-xs">
                        <Star className="w-3 h-3 fill-current" />
                        {salon.rating || '4.0'}
                      </div>
                    </div>
                    {salon.recent_bookings > 0 && (
                      <p className="text-xs text-red-600 mt-1">{salon.recent_bookings} bookings this week</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Gender Filter */}
        {userGender && (
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-xs sm:text-sm text-gray-600">Showing {userGender === 'male' ? 'Salons' : 'Parlours'} for you</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={userGender === 'male' ? 'default' : 'outline'}
                  onClick={() => handleGenderChange('male')}
                  className="text-xs sm:text-sm"
                >
                  Male (Salons)
                </Button>
                <Button
                  size="sm"
                  variant={userGender === 'female' ? 'default' : 'outline'}
                  onClick={() => handleGenderChange('female')}
                  className="text-xs sm:text-sm"
                >
                  Female (Parlours)
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Categories */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold">Categories</h2>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <div
            onClick={() => setSelectedCategory('all')}
            className={`p-2 sm:p-4 bg-white rounded-lg shadow-sm cursor-pointer text-center transition-all ${
              selectedCategory === 'all' ? 'ring-2 ring-red-600' : 'hover:shadow-md'
            }`}
          >
            <div className="text-xl sm:text-3xl mb-1 sm:mb-2">🏪</div>
            <div className="font-medium text-xs sm:text-base">All</div>
          </div>
          {categories.map(cat => (
            <div
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`p-2 sm:p-4 bg-white rounded-lg shadow-sm cursor-pointer text-center transition-all ${
                selectedCategory === cat.id ? 'ring-2 ring-red-600' : 'hover:shadow-md'
              }`}
            >
              <div className="text-xl sm:text-3xl mb-1 sm:mb-2">{cat.icon}</div>
              <div className="font-medium text-xs sm:text-base">{cat.name}</div>
            </div>
          ))}
        </div>

        {/* Salons List */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-xl font-bold">{filteredSalons.length} Salons Found</h2>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-28 sm:w-40 text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">Top Rated</SelectItem>
              <SelectItem value="price">Lowest Price</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading salons...</p>
          </div>
        ) : filteredSalons.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No salons found. Try adjusting your search.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredSalons.map((salon) => (
              <Card 
                key={salon.salon_id} 
                className="hover:shadow-lg transition-shadow overflow-hidden cursor-pointer"
                onClick={() => handleViewSalonDetails(salon)}
                data-testid={`salon-card-${salon.salon_id}`}
              >
                {salon.photo_url && (
                  <div className="h-40 sm:h-48 overflow-hidden relative">
                    <img src={salon.photo_url} alt={salon.salon_name} className="w-full h-full object-cover" />
                    <button
                      className="absolute top-2 right-2 p-2 bg-white/80 rounded-full"
                      onClick={(e) => toggleFavorite(salon.salon_id, e)}
                    >
                      <Heart className={`w-5 h-5 ${favorites.includes(salon.salon_id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                    </button>
                  </div>
                )}
                <CardHeader className="pb-2 sm:pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                        {salon.salon_name}
                        {getSalonStatusBadge(salon)}
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">{salon.area}</CardDescription>
                    </div>
                    <div className="flex items-center gap-1 bg-green-600 text-white px-2 py-1 rounded text-xs sm:text-sm">
                      <Star className="w-3 h-3 fill-current" />
                      <span>{salon.rating || '4.0'}</span>
                    </div>
                  </div>
                  {salon.review_count > 0 && (
                    <p className="text-xs text-gray-500">{salon.review_count} reviews</p>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {salon.services?.slice(0, 2).map((service) => (
                      <div key={service.id} className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-xs sm:text-sm">{service.name}</p>
                          <p className="text-xs text-gray-600">₹{service.price}</p>
                        </div>
                        <Button 
                          size="sm" 
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBookService(salon, service);
                          }}
                          disabled={salon.current_status === 'closed'}
                        >
                          Book
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Salon Details Dialog */}
      <Dialog open={showSalonDetails} onOpenChange={setShowSalonDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedSalon?.salon_name}</span>
              {selectedSalon && getSalonStatusBadge(selectedSalon)}
            </DialogTitle>
            <DialogDescription>{selectedSalon?.area}</DialogDescription>
          </DialogHeader>
          
          {selectedSalon && (
            <div className="space-y-4">
              {/* Photo Gallery */}
              {(selectedSalon.photo_url || selectedSalon.photo_gallery?.length > 0) && (
                <div className="space-y-2">
                  {selectedSalon.photo_url && (
                    <img 
                      src={selectedSalon.photo_url} 
                      alt={selectedSalon.salon_name}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  )}
                  {selectedSalon.photo_gallery?.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {selectedSalon.photo_gallery.map((photo, idx) => (
                        <img 
                          key={idx}
                          src={photo.url}
                          alt={`Gallery ${idx + 1}`}
                          className="w-24 h-24 object-cover rounded flex-shrink-0"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Rating & Reviews Summary */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-2xl font-bold text-green-700">
                    <Star className="w-6 h-6 fill-current" />
                    {selectedSalon.rating || '4.0'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {selectedSalon.review_count || 0} reviews
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowReviewDialog(true)}
                >
                  Write Review
                </Button>
              </div>

              {/* Operating Hours */}
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-800">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Open: {selectedSalon.opening_time || '09:00'} - {selectedSalon.closing_time || '20:00'}
                </p>
              </div>

              {/* Services */}
              <div>
                <h4 className="font-semibold mb-2">Services</h4>
                <div className="space-y-2">
                  {selectedSalon.services?.map((service) => (
                    <div key={service.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-green-600 font-semibold">₹{service.price}</p>
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => handleBookService(selectedSalon, service)}
                        disabled={selectedSalon.current_status === 'closed'}
                      >
                        Book Now
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reviews */}
              {salonReviews.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Recent Reviews</h4>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {salonReviews.slice(0, 5).map((review) => (
                      <div key={review.review_id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{review.customer_name}</span>
                          <div className="flex items-center gap-1 text-yellow-600">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-current' : ''}`} />
                            ))}
                          </div>
                        </div>
                        {review.review_text && (
                          <p className="text-sm text-gray-600">{review.review_text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Direction Button */}
              {selectedSalon.location?.coordinates && (
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => {
                    const [lng, lat] = selectedSalon.location.coordinates;
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                  }}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Get Directions
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Booking Dialog */}
      <Dialog open={showBooking} onOpenChange={setShowBooking}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Book Appointment</DialogTitle>
          </DialogHeader>
          {selectedSalon && selectedService && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">{selectedSalon.salon_name}</p>
                <p className="text-sm text-gray-600">{selectedService.name} - ₹{selectedService.price}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Select Date
                </label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Select Time Slot
                </label>
                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                  {availableSlots.length === 0 ? (
                    <p className="col-span-4 text-center text-sm text-gray-500 py-4">No slots available</p>
                  ) : (
                    availableSlots.map((slot) => (
                      <Button
                        key={slot}
                        size="sm"
                        variant={selectedSlot === slot ? 'default' : 'outline'}
                        onClick={() => handleSlotSelect(slot)}
                        className="text-xs"
                      >
                        {slot}
                      </Button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Payment Method</label>
                <div className="space-y-2">
                  <Button
                    variant={paymentMethod === 'online' ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => setPaymentMethod('online')}
                  >
                    Pay Online Now
                  </Button>
                  <Button
                    variant={paymentMethod === 'pay_at_salon' ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => setPaymentMethod('pay_at_salon')}
                  >
                    Pay at Salon
                  </Button>
                </div>
              </div>

              <Button className="w-full bg-red-600 hover:bg-red-700" onClick={createBooking} disabled={loading}>
                {loading ? 'Processing...' : 'Confirm Booking'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bookings Dialog */}
      <Dialog open={showBookings} onOpenChange={setShowBookings}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>My Bookings</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="upcoming">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="space-y-3 mt-4">
              {bookings.filter(b => new Date(b.booking_date) >= new Date() && b.status !== 'cancelled' && b.status !== 'completed').length === 0 ? (
                <p className="text-center text-gray-500 py-8">No upcoming bookings</p>
              ) : (
                bookings.filter(b => new Date(b.booking_date) >= new Date() && b.status !== 'cancelled' && b.status !== 'completed').map((booking) => (
                  <Card key={booking.booking_id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{booking.salon_name}</p>
                          <p className="text-sm text-gray-600">{booking.service_name}</p>
                          <p className="text-sm text-gray-500">{booking.booking_date} at {booking.slot_time}</p>
                          <p className="text-sm font-medium text-green-600">₹{booking.service_price}</p>
                          <span className={`text-xs px-2 py-1 rounded mt-2 inline-block ${
                            booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                            booking.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-700' :
                            booking.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {booking.status === 'pending_approval' ? 'AWAITING CONFIRMATION' : booking.status.toUpperCase()}
                          </span>
                        </div>
                        {(booking.status === 'confirmed' || booking.status === 'pending_approval') && (
                          <Button size="sm" variant="destructive" onClick={() => cancelBooking(booking.booking_id)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
            <TabsContent value="past" className="space-y-3 mt-4">
              {bookings.filter(b => new Date(b.booking_date) < new Date() || b.status === 'completed').length === 0 ? (
                <p className="text-center text-gray-500 py-8">No past bookings</p>
              ) : (
                bookings.filter(b => new Date(b.booking_date) < new Date() || b.status === 'completed').map((booking) => (
                  <Card key={booking.booking_id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{booking.salon_name}</p>
                          <p className="text-sm text-gray-600">{booking.service_name}</p>
                          <p className="text-sm text-gray-500">{booking.booking_date}</p>
                          <p className="text-sm font-medium text-green-600">₹{booking.service_price}</p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedSalon({ salon_id: booking.salon_id, salon_name: booking.salon_name });
                            setShowReviewDialog(true);
                          }}
                        >
                          Review
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
            <DialogDescription>{selectedSalon?.salon_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setReviewData({ ...reviewData, rating: star })}
                    className="focus:outline-none"
                  >
                    <Star 
                      className={`w-8 h-8 ${star <= reviewData.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Your Review (Optional)</label>
              <textarea
                className="w-full p-3 border rounded-lg resize-none"
                rows={4}
                placeholder="Share your experience..."
                value={reviewData.review_text}
                onChange={(e) => setReviewData({ ...reviewData, review_text: e.target.value })}
              />
            </div>
            <Button className="w-full" onClick={submitReview}>
              Submit Review
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onLocationSelect={handleLocationSelect}
        initialLocation={location.lat ? { lat: location.lat, lng: location.lng } : null}
        title="Choose Your Location"
      />
    </div>
  );
}

export default CustomerHome;
