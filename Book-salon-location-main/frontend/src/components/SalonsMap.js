import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { MapPin, Navigation } from 'lucide-react';

// Custom icons
const customerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const salonIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Haversine formula for distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function SalonsMap({ salons, onSalonSelect }) {
  const [userLocation, setUserLocation] = useState(null);
  const [radius, setRadius] = useState(5);
  const [filteredSalons, setFilteredSalons] = useState([]);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    getUserLocation();
  }, []);

  useEffect(() => {
    // Ensure salons is an array before processing
    const safeSalons = Array.isArray(salons) ? salons : [];
    
    if (userLocation && safeSalons.length > 0) {
      const filtered = safeSalons.filter(salon => {
        if (!salon || !salon.location?.coordinates) return false;
        const [lng, lat] = salon.location.coordinates;
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          lat,
          lng
        );
        return distance <= radius;
      }).map(salon => {
        const [lng, lat] = salon.location.coordinates;
        return {
          ...salon,
          distance: calculateDistance(userLocation.lat, userLocation.lng, lat, lng)
        };
      }).sort((a, b) => a.distance - b.distance);
      
      setFilteredSalons(filtered);
    } else {
      setFilteredSalons([]);
    }
  }, [userLocation, salons, radius]);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocationError('');
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLocationError('Unable to get your location. Using default location (Delhi).');
          setUserLocation({ lat: 28.7041, lng: 77.1025 });
        }
      );
    } else {
      setLocationError('Geolocation not supported. Using default location (Delhi).');
      setUserLocation({ lat: 28.7041, lng: 77.1025 });
    }
  };

  const openNavigation = (lat, lng, name) => {
    // Opens Google Maps navigation without API key
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_name=${encodeURIComponent(name)}`;
    window.open(url, '_blank');
  };

  if (!userLocation) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Detecting your location...</p>
          {locationError && (
            <p className="text-sm text-red-600 mt-2">{locationError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Nearby Salons ({filteredSalons.length} found)</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Radius:</span>
          <Select value={radius.toString()} onValueChange={(val) => setRadius(parseInt(val))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 km</SelectItem>
              <SelectItem value="3">3 km</SelectItem>
              <SelectItem value="5">5 km</SelectItem>
              <SelectItem value="10">10 km</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {locationError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">{locationError}</p>
          <Button size="sm" variant="outline" onClick={getUserLocation} className="mt-2">
            Try Again
          </Button>
        </div>
      )}

      <div className="h-96 w-full rounded-lg overflow-hidden border-2 border-gray-300">
        <MapContainer
          center={[userLocation.lat, userLocation.lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* User location marker */}
          <Marker position={[userLocation.lat, userLocation.lng]} icon={customerIcon}>
            <Popup>
              <div className="text-center">
                <strong>Your Location</strong>
              </div>
            </Popup>
          </Marker>

          {/* Radius circle */}
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={radius * 1000}
            pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }}
          />

          {/* Salon markers */}
          {filteredSalons.map((salon) => {
            const [lng, lat] = salon.location.coordinates;
            return (
              <Marker key={salon.salon_id} position={[lat, lng]} icon={salonIcon}>
                <Popup>
                  <div className="min-w-[200px]">
                    <h4 className="font-bold text-base mb-1">{salon.salon_name}</h4>
                    <p className="text-sm text-gray-600 mb-2">{salon.area}</p>
                    <p className="text-xs text-gray-500 mb-2">
                      <MapPin className="inline w-3 h-3 mr-1" />
                      {salon.distance.toFixed(2)} km away
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => onSalonSelect && onSalonSelect(salon)}
                      >
                        View Details
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openNavigation(lat, lng, salon.salon_name)}
                      >
                        <Navigation className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {filteredSalons.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No salons found within {radius}km radius.</p>
          <p className="text-sm text-gray-500 mt-2">Try increasing the search radius.</p>
        </div>
      )}
    </div>
  );
}

export default SalonsMap;