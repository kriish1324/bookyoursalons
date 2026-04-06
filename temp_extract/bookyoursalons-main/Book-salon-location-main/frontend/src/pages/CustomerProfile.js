import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { User, Phone, Calendar, Star, Heart, Clock, ArrowLeft, LogOut, Award } from 'lucide-react';
import { toast } from 'sonner';
import Logo from '../components/Logo';


const API = '/api';

function CustomerProfile() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  
  const userName = localStorage.getItem('userName') || 'Customer';
  const userPhone = localStorage.getItem('userPhone') || '';
  const userEmail = localStorage.getItem('userEmail') || '';

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      // Fetch bookings
      if (userPhone) {
        const bookingsRes = await axios.get(`${API}/bookings/customer/${userPhone}`);
        const bookingsData = Array.isArray(bookingsRes.data) ? bookingsRes.data : [];
        setBookings(bookingsData);
        
        // Calculate loyalty points (10 points per completed booking)
        const completedCount = bookingsData.filter(b => b.status === 'completed').length;
        setLoyaltyPoints(completedCount * 10);
      }
      
      // Fetch favorites
      try {
        const firebaseUid = localStorage.getItem('firebaseUid');
        if (firebaseUid) {
          const favRes = await axios.get(`${API}/customer/${firebaseUid}/favorites`);
          setFavorites(Array.isArray(favRes.data) ? favRes.data : []);
        }
      } catch (err) {
        setFavorites([]);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
    toast.success('Logged out successfully');
  };

  const upcomingBookings = bookings.filter(b => 
    b && new Date(b.booking_date) >= new Date() && b.status !== 'cancelled' && b.status !== 'completed'
  );
  
  const pastBookings = bookings.filter(b => 
    b && (new Date(b.booking_date) < new Date() || b.status === 'completed')
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/customer')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Logo size="small" />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-lg">
        {/* Profile Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-orange-400 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-800">{userName}</h2>
                {userPhone && (
                  <div className="flex items-center gap-1 text-gray-600 text-sm">
                    <Phone className="w-3 h-3" />
                    <span>+91 {userPhone}</span>
                  </div>
                )}
                {userEmail && (
                  <p className="text-gray-500 text-sm">{userEmail}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loyalty Points */}
        <Card className="mb-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-600">Loyalty Points</p>
                  <p className="text-2xl font-bold text-yellow-700">{loyaltyPoints}</p>
                </div>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>Earn 10 points</p>
                <p>per booking</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card>
            <CardContent className="pt-4 text-center">
              <Calendar className="w-6 h-6 mx-auto text-blue-600 mb-1" />
              <p className="text-xl font-bold">{bookings.length}</p>
              <p className="text-xs text-gray-500">Total Bookings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Heart className="w-6 h-6 mx-auto text-red-500 mb-1" />
              <p className="text-xl font-bold">{favorites.length}</p>
              <p className="text-xs text-gray-500">Favorites</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Star className="w-6 h-6 mx-auto text-yellow-500 mb-1" />
              <p className="text-xl font-bold">{pastBookings.length}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Bookings */}
        {upcomingBookings.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Upcoming Bookings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingBookings.slice(0, 3).map((booking, idx) => (
                <div key={idx} className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800">{booking.salon_name || 'Salon'}</p>
                      <p className="text-sm text-gray-600">{booking.service_name}</p>
                      <p className="text-xs text-gray-500">
                        {booking.booking_date} at {booking.booking_time}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Past Bookings */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              Booking History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pastBookings.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No past bookings yet</p>
            ) : (
              <div className="space-y-3">
                {pastBookings.slice(0, 5).map((booking, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-800">{booking.salon_name || 'Salon'}</p>
                      <p className="text-sm text-gray-600">{booking.service_name}</p>
                      <p className="text-xs text-gray-500">{booking.booking_date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-800">₹{booking.service_price || 0}</p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs mt-1"
                        onClick={() => navigate('/customer')}
                      >
                        Rebook
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            className="w-full bg-red-600 hover:bg-red-700" 
            onClick={() => navigate('/customer')}
          >
            Book New Service
          </Button>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CustomerProfile;
