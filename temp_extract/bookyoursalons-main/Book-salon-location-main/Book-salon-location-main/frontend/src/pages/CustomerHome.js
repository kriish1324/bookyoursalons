import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { MapPin, Search, Star, Clock, Calendar, LogOut, Filter, X, Navigation, Map, User, Heart } from 'lucide-react';
import LocationPickerModal from '../components/LocationPickerModal';
import NearbySalonsMap from '../components/NearbySalonsMap';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
  const [radius] = useState(5); // Fixed 5km radius
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
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('rating');
  const [loading, setLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showMapView, setShowMapView] = useState(false);
  const [trendingSalons, setTrendingSalons] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [bookingReminder, setBookingReminder] = useState(null);

  // Spam protection: track recent bookings
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
  }, []);

  // Check for upcoming booking reminders
  const checkUpcomingReminders = async () => {
    try {
      const phone = localStorage.getItem('userPhone');
      if (!phone) return;
      
      const response = await axios.get(`${API}/bookings/customer/${phone}`);
      const bookingsData = Array.isArray(response.data) ? response.data : [];
      
      // Find upcoming bookings within next hour
      const now = new Date();
      const upcoming = bookingsData.find(b => {
        if (b.status !== 'confirmed' && b.status !== 'accepted') return false;
        const bookingDateTime = new Date(`${b.booking_date}T${b.booking_time}`);
        const diff = bookingDateTime - now;
        return diff > 0 && diff <= 60 * 60 * 1000; // Within 1 hour
      });
      
      if (upcoming) {
        const bookingDateTime = new Date(`${upcoming.booking_date}T${upcoming.booking_time}`);
        const minutesAway = Math.round((bookingDateTime - now) / (60 * 1000));
        
        if (minutesAway <= 5) {
          setBookingReminder({
            salon: upcoming.salon_name,
            service: upcoming.service_name,
            time: upcoming.booking_time,
            minutesAway
          });
        }
      }
    } catch (error) {
      console.error('Error checking reminders:', error);
    }
  };

  // Check reminders every minute
  useEffect(() => {
    const interval = setInterval(checkUpcomingReminders, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch user favorites
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

  // Toggle favorite
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

  // Load saved location from localStorage (no auto-detect)
  const loadSavedLocation = () => {
    const savedLocation = localStorage.getItem('customerLocation');
    if (savedLocation) {
      try {
        const parsed = JSON.parse(savedLocation);
        setLocation(parsed);
      } catch (e) {
        // If parsing fails, keep default state - user needs to select location
        setLocation({ lat: null, lng: null, address: 'Choose Your Location' });
      }
    }
  };

  // Handle location selection from modal
  const handleLocationSelect = (selectedLocation) => {
    try {
      // Validate selectedLocation
      if (!selectedLocation || typeof selectedLocation.lat !== 'number' || typeof selectedLocation.lng !== 'number') {
        console.error('Invalid location data:', selectedLocation);
        toast.error('Invalid location. Please try again.');
        return;
      }

      const newLocation = {
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        address: selectedLocation.address || `${Number(selectedLocation.lat || 0).toFixed(6)}, ${Number(selectedLocation.lng || 0).toFixed(6)}`
      };
      
      setLocation(newLocation);
      localStorage.setItem('customerLocation', JSON.stringify(newLocation));
      toast.success('Location saved successfully!');
    } catch (error) {
      console.error('Error saving location:', error);
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
      // Ensure response.data is an array
      const salonData = Array.isArray(response.data) ? response.data : [];
      setSalons(salonData);
    } catch (error) {
      console.error('Error fetching salons:', error);
      setSalons([]);
    }
    setLoading(false);
  };

  const filterAndSortSalons = () => {
    // Ensure salons is an array before filtering
    let filtered = Array.isArray(salons) ? [...salons] : [];

    // Filter by gender/business type
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

  const handleBookService = (salon, service) => {
    setSelectedSalon(salon);
    setSelectedService(service);
    setShowBooking(true);
    if (selectedDate) fetchSlots(salon.salon_id, selectedDate);
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    if (selectedSalon) fetchSlots(selectedSalon.salon_id, date);
  };

  const createBooking = async () => {
    if (!selectedSlot || !paymentMethod) {
      toast.error('Please select slot and payment method');
      return;
    }

    // SPAM PROTECTION: Check if user has made more than 3 bookings in last 5 minutes
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    const recentBookings = recentBookingTimes.filter(t => t > fiveMinutesAgo);
    
    if (recentBookings.length >= 3) {
      toast.error('Too many bookings! Please wait 5 minutes before booking again.');
      return;
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

      // Track this booking time for spam protection
      setRecentBookingTimes([...recentBookings, now]);

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
        toast.success('Booking confirmed! Pay at salon.');
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

  const handleLogout = () => {
    auth.signOut();
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-red-600 whitespace-nowrap">BookYourSalons</h1>
              {/* Choose Your Location Button - Prominent in header */}
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

      {/* Hero Section with Search */}
      <div className="bg-red-600 text-white py-4 sm:py-8">
        <div className="container mx-auto px-2 sm:px-4">
          <div className="max-w-2xl mx-auto">
            {/* Show prompt if no location selected */}
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
                className="pl-10 sm:pl-12 py-4 sm:py-6 text-base sm:text-lg bg-white"
                placeholder="Search salon, service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {/* Map View - Shows when location is set and map toggle is active */}
        {location.lat && showMapView && (
          <div className="mb-4 sm:mb-6">
            <NearbySalonsMap
              userLocation={{ lat: location.lat, lng: location.lng }}
              salons={salons}
              radius={radius}
              onSalonSelect={(salon) => {
                setSelectedSalon(salon);
                if (salon.services?.length > 0) {
                  handleBookService(salon, salon.services[0]);
                }
              }}
            />
          </div>
        )}

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

        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold">Categories</h2>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4 mb-6 sm:mb-8">
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

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-xl font-bold">{filteredSalons.length} Salons</h2>
          <div className="flex gap-2">
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
        </div>

        {loading ? (
          <div className="text-center py-12">Loading salons...</div>
        ) : filteredSalons.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500">No salons found. Try adjusting your search.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSalons.map((salon) => (
              <Card key={salon.salon_id} className="hover:shadow-lg transition-shadow overflow-hidden">
                {salon.photo_url && (
                  <div className="h-48 overflow-hidden">
                    <img src={salon.photo_url} alt={salon.salon_name} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-start justify-between">
                    <span className="text-sm sm:text-base">{salon.salon_name}</span>
                    <div className="flex items-center gap-1 bg-green-600 text-white px-2 py-1 rounded text-xs sm:text-sm">
                      <Star className="w-3 h-3 fill-current" />
                      <span>{salon.rating || '4.2'}</span>
                    </div>
                  </CardTitle>
                  <div className="flex items-center justify-between">
                    <p className="text-xs sm:text-sm text-gray-600">{salon.area}</p>
                    {salon.location?.coordinates && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          const [lng, lat] = salon.location.coordinates;
                          window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_name=${encodeURIComponent(salon.salon_name)}`, '_blank');
                        }}
                        data-testid={`directions-btn-${salon.salon_id}`}
                      >
                        <Navigation className="w-3 h-3 mr-1" />
                        Directions
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 sm:space-y-3">
                    {salon.services?.slice(0, 3).map((service) => (
                      <div key={service.id} className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm">{service.name}</p>
                          <p className="text-xs sm:text-sm text-gray-600">₹{service.price}</p>
                        </div>
                        <Button size="sm" className="text-xs sm:text-sm" onClick={() => handleBookService(salon, service)}>Book</Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

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
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {availableSlots.length === 0 ? (
                    <p className="col-span-3 text-center text-sm text-gray-500 py-4">No slots available</p>
                  ) : (
                    availableSlots.map((slot) => (
                      <Button
                        key={slot}
                        size="sm"
                        variant={selectedSlot === slot ? 'default' : 'outline'}
                        onClick={() => setSelectedSlot(slot)}
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

      <Dialog open={showBookings} onOpenChange={setShowBookings}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>My Bookings</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {bookings.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No bookings yet</p>
            ) : (
              bookings.map((booking) => (
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
                          booking.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {booking.status.toUpperCase()}
                        </span>
                      </div>
                      {booking.status === 'confirmed' && (
                        <Button size="sm" variant="destructive" onClick={() => cancelBooking(booking.booking_id)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
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