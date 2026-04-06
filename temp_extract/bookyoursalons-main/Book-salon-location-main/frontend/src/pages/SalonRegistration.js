import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { PlusCircle, Trash2, MapPin, Check, Upload, CreditCard, Crown } from 'lucide-react';
import LocationPickerModal from '../components/LocationPickerModal';

// Use relative path for Firebase Functions
const API = '/api';

const SUBSCRIPTION_PLANS = {
  '1_month': { price: 999, days: 30, name: '1 Month Plan' },
  '3_months': { price: 2499, days: 90, name: '3 Months Plan (Save ₹498)' }
};

function SalonRegistration() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    salon_name: '',
    owner_name: '',
    phone: localStorage.getItem('userPhone') || '',
    address: '',
    area: '',
    latitude: null,
    longitude: null,
    staff_count: 1,
    avg_service_time: 30,
    secondary_phone: '',
    business_type: 'salon',
    subscription_plan: '1_month',
    payment_reference: '',
    payment_screenshot_url: '',
    opening_time: '09:00',
    closing_time: '20:00'
  });
  const [services, setServices] = useState([{ id: '1', name: '', price: '' }]);
  const [loading, setLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationAddress, setLocationAddress] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);

  const addService = () => {
    setServices([...services, { id: Date.now().toString(), name: '', price: '' }]);
  };

  const removeService = (id) => {
    setServices(services.filter(s => s.id !== id));
  };

  const updateService = (id, field, value) => {
    setServices(services.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleScreenshotSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentScreenshot(reader.result);
        setFormData({ ...formData, payment_screenshot_url: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLocationSelect = (selectedLocation) => {
    try {
      // Validate selectedLocation
      if (!selectedLocation || typeof selectedLocation.lat !== 'number' || typeof selectedLocation.lng !== 'number') {
        console.error('Invalid location data:', selectedLocation);
        toast.error('Invalid location. Please try again.');
        return;
      }

      setFormData({
        ...formData,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng
      });
      setLocationAddress(selectedLocation.address || `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`);
      toast.success('Salon location saved!');
    } catch (error) {
      console.error('Error saving salon location:', error);
      toast.error('Failed to save location. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate location is selected
    if (!formData.latitude || !formData.longitude) {
      toast.error('Please select your salon location on the map');
      return;
    }

    const validServices = services.filter(s => s.name && s.price);
    if (validServices.length === 0) {
      toast.error('Please add at least one service');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      const firebaseUid = user?.uid || localStorage.getItem('firebaseUid');
      
      if (!firebaseUid) {
        toast.error('Please login again to continue');
        navigate('/');
        return;
      }
      
      await axios.post(`${API}/salon/register`, {
        ...formData,
        services: validServices.map(s => ({ ...s, price: parseFloat(s.price) })),
        firebase_uid: firebaseUid,
        subscription_plan: 'free_trial',
        payment_reference: 'FREE_TRIAL',
        status: 'pending'
      });
      
      // Store salon name for pending page
      localStorage.setItem('pendingSalonName', formData.salon_name);
      localStorage.setItem('partnerStatus', 'pending');
      
      toast.success('Registration submitted! Your 1-month free trial will start after admin approval.');
      navigate('/salon/pending');
    } catch (error) {
      console.error('Error registering salon:', error);
      toast.error(error.response?.data?.detail || 'Failed to register salon');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 py-6 sm:py-12 px-2 sm:px-4">
      <div className="container mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl text-center">Register Your Salon</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Business Type *</label>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={formData.business_type === 'salon' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setFormData({ ...formData, business_type: 'salon' })}
                  >
                    Salon (For Men)
                  </Button>
                  <Button
                    type="button"
                    variant={formData.business_type === 'parlour' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setFormData({ ...formData, business_type: 'parlour' })}
                  >
                    Parlour (For Women)
                  </Button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Salon Name *</label>
                  <Input
                    data-testid="salon-name-input"
                    required
                    value={formData.salon_name}
                    onChange={(e) => setFormData({ ...formData, salon_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Owner Name *</label>
                  <Input
                    data-testid="owner-name-input"
                    required
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Phone Number *</label>
                  <Input
                    data-testid="phone-input"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Secondary Phone</label>
                  <Input
                    data-testid="secondary-phone-input"
                    value={formData.secondary_phone}
                    onChange={(e) => setFormData({ ...formData, secondary_phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Full Address *</label>
                <Input
                  data-testid="address-input"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Area/Locality *</label>
                <Input
                  data-testid="area-input"
                  required
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                />
              </div>

              {/* Salon Location Picker - Mandatory */}
              <div>
                <label className="block text-sm font-medium mb-2">Salon Location (Map) *</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-purple-400 transition-colors">
                  {formData.latitude && formData.longitude ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-full">
                          <Check className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-green-700">Location Selected</p>
                          <p className="text-xs text-gray-600 max-w-[300px] truncate" title={locationAddress}>
                            {locationAddress || `${formData.latitude.toFixed(6)}, ${formData.longitude.toFixed(6)}`}
                          </p>
                        </div>
                      </div>
                      <Button 
                        data-testid="change-salon-location-btn"
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowLocationPicker(true)}
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <MapPin className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 mb-3">Set your salon location on the map</p>
                      <Button 
                        data-testid="set-salon-location-btn"
                        type="button" 
                        variant="default"
                        onClick={() => setShowLocationPicker(true)}
                      >
                        <MapPin className="w-4 h-4 mr-2" />
                        Choose Salon Location
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Customers will find your salon based on this location (required)
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Staff Count *</label>
                  <Input
                    data-testid="staff-count-input"
                    type="number"
                    required
                    min="1"
                    value={formData.staff_count}
                    onChange={(e) => setFormData({ ...formData, staff_count: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Avg Service Time (min) *</label>
                  <Input
                    data-testid="avg-time-input"
                    type="number"
                    required
                    min="10"
                    value={formData.avg_service_time}
                    onChange={(e) => setFormData({ ...formData, avg_service_time: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              {/* Opening Hours */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Opening Time *</label>
                  <Input
                    data-testid="opening-time-input"
                    type="time"
                    required
                    value={formData.opening_time}
                    onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Closing Time *</label>
                  <Input
                    data-testid="closing-time-input"
                    type="time"
                    required
                    value={formData.closing_time}
                    onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium">Services *</label>
                  <Button data-testid="add-service-btn" type="button" size="sm" onClick={addService}>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Add Service
                  </Button>
                </div>
                <div className="space-y-3">
                  {services.map((service, index) => (
                    <div key={service.id} className="flex gap-2">
                      <Input
                        data-testid={`service-name-${index}`}
                        placeholder="Service name"
                        value={service.name}
                        onChange={(e) => updateService(service.id, 'name', e.target.value)}
                      />
                      <Input
                        data-testid={`service-price-${index}`}
                        type="number"
                        placeholder="Price"
                        value={service.price}
                        onChange={(e) => updateService(service.id, 'price', e.target.value)}
                      />
                      {services.length > 1 && (
                        <Button
                          data-testid={`remove-service-${index}`}
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => removeService(service.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Free Trial Banner */}
              <Card className="border-2 border-green-400 bg-gradient-to-r from-green-50 to-emerald-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-3 rounded-full">
                      <Crown className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-green-700">🎉 1 Month FREE Trial!</h3>
                      <p className="text-green-600">Register your salon and start with a 1 Month Free Trial.</p>
                      <p className="text-sm text-gray-600 mt-1">No payment required during the trial period.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Subscription Plan Info (for after trial) */}
              <Card className="border-2 border-purple-200 bg-purple-50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-purple-700">
                    <Crown className="w-5 h-5" />
                    After Free Trial - Subscription Plans
                  </CardTitle>
                  <CardDescription>Choose a plan after your 30-day free trial ends</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-lg border-2 border-gray-200 bg-white">
                      <div>
                        <p className="font-semibold">1 Month</p>
                        <p className="text-2xl font-bold text-purple-700">₹999</p>
                      </div>
                    </div>
                    <div className="p-4 rounded-lg border-2 border-gray-200 bg-white relative">
                      <span className="absolute -top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded">BEST VALUE</span>
                      <div>
                        <p className="font-semibold">3 Months</p>
                        <p className="text-2xl font-bold text-purple-700">₹2499</p>
                        <p className="text-xs text-green-600">Save ₹498</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 text-center">
                    You'll be reminded before your trial ends. Pay via UPI: <span className="font-mono font-medium">6205777957-i24a@axl</span>
                  </p>
                </CardContent>
              </Card>

              <Button data-testid="submit-registration-btn" type="submit" className="w-full" disabled={loading}>
                {loading ? 'Registering...' : 'Start Free Trial & Register'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Location Picker Modal for Salon */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onLocationSelect={handleLocationSelect}
        initialLocation={formData.latitude && formData.longitude ? { lat: formData.latitude, lng: formData.longitude } : null}
        title="Set Your Salon Location"
      />
    </div>
  );
}

export default SalonRegistration;