import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { User, Phone, Calendar, Star, Heart, Clock, ArrowLeft, LogOut, Award, Pencil, MapPin, Mail, Check } from 'lucide-react';
import { toast } from 'sonner';
import Logo from '../components/Logo';


const API = process.env.REACT_APP_BACKEND_URL || '/api';

function CustomerProfile() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  const [userName, setUserName] = useState(localStorage.getItem('userName') || 'Customer');
  const [userPhone, setUserPhone] = useState(localStorage.getItem('userPhone') || '');
  const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || '');
  const [userAddress, setUserAddress] = useState(localStorage.getItem('userAddress') || '');
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    address: '',
    email: ''
  });

  useEffect(() => {
    fetchUserData();
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      if (userPhone) {
        const response = await axios.get(`${API}/user/profile/${encodeURIComponent(userPhone)}`);
        if (response.data) {
          if (response.data.name) {
            setUserName(response.data.name);
            localStorage.setItem('userName', response.data.name);
          }
          if (response.data.address) {
            setUserAddress(response.data.address);
            localStorage.setItem('userAddress', response.data.address);
          }
          if (response.data.email) {
            setUserEmail(response.data.email);
            localStorage.setItem('userEmail', response.data.email);
          }
        }
      }
    } catch (error) {
      console.log('Profile fetch error:', error);
    }
  };

  const fetchUserData = async () => {
    setLoading(true);
    try {
      // Fetch bookings
      if (userPhone) {
        const bookingsRes = await axios.get(`${API}/bookings/customer/${encodeURIComponent(userPhone)}`);
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

  const openEditDialog = () => {
    setEditForm({
      name: userName || '',
      address: userAddress || '',
      email: userEmail || ''
    });
    setShowEditDialog(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const response = await axios.put(`${API}/user/update-profile`, {
        phone: userPhone,
        firebase_uid: localStorage.getItem('firebaseUid'),
        name: editForm.name,
        address: editForm.address,
        email: editForm.email
      });

      if (response.data) {
        // Update local state and localStorage
        setUserName(editForm.name);
        setUserAddress(editForm.address);
        setUserEmail(editForm.email);
        
        localStorage.setItem('userName', editForm.name);
        localStorage.setItem('userAddress', editForm.address);
        localStorage.setItem('userEmail', editForm.email);
        
        toast.success('Profile updated successfully ✅');
        setShowEditDialog(false);
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(error.response?.data?.error || 'Failed to update profile');
    }
    setSaving(false);
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
        {/* Profile Card with Edit Button */}
        <Card className="mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-r from-red-500 to-orange-500"></div>
          <CardContent className="pt-12 relative">
            <div className="flex items-end gap-4">
              <div className="w-20 h-20 bg-white rounded-full border-4 border-white shadow-lg flex items-center justify-center -mt-10">
                <User className="w-10 h-10 text-red-500" />
              </div>
              <div className="flex-1 pb-2">
                <h2 className="text-xl font-bold text-gray-800">{userName || 'Customer'}</h2>
                {userPhone && (
                  <div className="flex items-center gap-1 text-gray-600 text-sm">
                    <Phone className="w-3 h-3" />
                    <span>{userPhone}</span>
                  </div>
                )}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={openEditDialog}
                className="mb-2"
                data-testid="edit-profile-btn"
              >
                <Pencil className="w-4 h-4 mr-1" />
                Edit
              </Button>
            </div>
            
            {/* Additional Info */}
            <div className="mt-4 space-y-2">
              {userEmail && (
                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{userEmail}</span>
                </div>
              )}
              {userAddress && (
                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{userAddress}</span>
                </div>
              )}
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
                        {booking.booking_date} at {booking.slot_time || booking.booking_time}
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

      {/* EDIT PROFILE DIALOG */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="bg-red-100 p-2 rounded-lg">
                <Pencil className="w-5 h-5 text-red-600" />
              </div>
              Edit Profile
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                <User className="w-4 h-4 inline mr-1" />
                Name
              </label>
              <Input
                data-testid="edit-name-input"
                value={editForm.name}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                placeholder="Enter your name"
                className="border-gray-300 focus:border-red-500"
              />
            </div>

            {/* Phone Field (Read-only) */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                <Phone className="w-4 h-4 inline mr-1" />
                Phone Number
              </label>
              <Input
                value={userPhone}
                disabled
                className="bg-gray-100 text-gray-500"
              />
              <p className="text-xs text-gray-400 mt-1">Phone number cannot be changed</p>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                <Mail className="w-4 h-4 inline mr-1" />
                Email (Optional)
              </label>
              <Input
                type="email"
                data-testid="edit-email-input"
                value={editForm.email}
                onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                placeholder="Enter your email"
                className="border-gray-300 focus:border-red-500"
              />
            </div>

            {/* Address Field */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                <MapPin className="w-4 h-4 inline mr-1" />
                Address (Optional)
              </label>
              <Input
                data-testid="edit-address-input"
                value={editForm.address}
                onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                placeholder="Enter your address"
                className="border-gray-300 focus:border-red-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setShowEditDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveProfile}
                className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
                disabled={saving}
                data-testid="save-profile-btn"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                    Saving...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Check className="w-5 h-5" />
                    Save Changes
                  </span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CustomerProfile;
