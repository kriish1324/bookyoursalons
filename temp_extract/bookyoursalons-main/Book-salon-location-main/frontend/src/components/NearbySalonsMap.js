import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from './ui/button';
import { MapPin, Navigation, Star, Phone } from 'lucide-react';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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

const parlourIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
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

// Component to fit bounds
function FitBounds({ userLocation, salons }) {
  const map = useMap();
  
  useEffect(() => {
    if (userLocation && salons.length > 0) {
      const bounds = L.latLngBounds([[userLocation.lat, userLocation.lng]]);
      salons.forEach(salon => {
        if (salon.location?.coordinates) {
          bounds.extend([salon.location.coordinates[1], salon.location.coordinates[0]]);
        }
      });
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    } else if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 14);
    }
  }, [userLocation, salons, map]);

  return null;
}

function NearbySalonsMap({ userLocation, salons, onSalonSelect, radius = 5 }) {
  const [salonsWithDistance, setSalonsWithDistance] = useState([]);

  useEffect(() => {
    // Ensure salons is an array before processing
    const safeSalons = Array.isArray(salons) ? salons : [];
    
    if (userLocation && safeSalons.length > 0) {
      const withDistance = safeSalons
        .filter(salon => salon && salon.location?.coordinates)
        .map(salon => {
          const [lng, lat] = salon.location.coordinates;
          const distance = calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
          return { ...salon, distance, salonLat: lat, salonLng: lng };
        })
        .filter(salon => salon.distance <= radius)
        .sort((a, b) => a.distance - b.distance);
      setSalonsWithDistance(withDistance);
    } else {
      setSalonsWithDistance([]);
    }
  }, [userLocation, salons, radius]);

  const openNavigation = (lat, lng, name) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_name=${encodeURIComponent(name)}`;
    window.open(url, '_blank');
  };

  if (!userLocation) {
    return (
      <div className="bg-gray-100 rounded-lg p-6 sm:p-8 text-center">
        <MapPin className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 text-sm sm:text-base">Select your location to see nearby salons on map</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold">
          {salonsWithDistance.length} {salonsWithDistance.length === 1 ? 'Salon' : 'Salons'} within {radius} km
        </h3>
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            You
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            Salon
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            Parlour
          </span>
        </div>
      </div>

      {/* Map Container - Mobile Responsive */}
      <div className="h-64 sm:h-80 md:h-96 w-full rounded-lg overflow-hidden border-2 border-gray-200 shadow-md">
        <MapContainer
          center={[userLocation.lat, userLocation.lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* User location marker */}
          <Marker position={[userLocation.lat, userLocation.lng]} icon={customerIcon}>
            <Popup>
              <div className="text-center p-1">
                <strong className="text-blue-600">Your Location</strong>
              </div>
            </Popup>
          </Marker>

          {/* Radius circle */}
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={radius * 1000}
            pathOptions={{ 
              color: '#3b82f6', 
              fillColor: '#3b82f6', 
              fillOpacity: 0.1,
              weight: 2
            }}
          />

          {/* Salon markers */}
          {salonsWithDistance.map((salon) => (
            <Marker 
              key={salon.salon_id} 
              position={[salon.salonLat, salon.salonLng]} 
              icon={salon.business_type === 'parlour' ? parlourIcon : salonIcon}
            >
              <Popup>
                <div className="min-w-[180px] sm:min-w-[220px] p-1">
                  <h4 className="font-bold text-sm sm:text-base mb-1">{salon.salon_name}</h4>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">{salon.area}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                    <MapPin className="w-3 h-3" />
                    <span>{salon.distance.toFixed(1)} km away</span>
                  </div>
                  {salon.rating && (
                    <div className="flex items-center gap-1 text-xs mb-2">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span>{salon.rating}</span>
                    </div>
                  )}
                  <div className="flex gap-1 sm:gap-2 mt-2">
                    <Button 
                      size="sm" 
                      className="flex-1 text-xs"
                      onClick={() => onSalonSelect && onSalonSelect(salon)}
                    >
                      View
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-xs"
                      onClick={() => openNavigation(salon.salonLat, salon.salonLng, salon.salon_name)}
                    >
                      <Navigation className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          <FitBounds userLocation={userLocation} salons={salonsWithDistance} />
        </MapContainer>
      </div>

      {salonsWithDistance.length === 0 && (
        <div className="text-center py-4 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-sm">No salons found within {radius}km of your location.</p>
        </div>
      )}
    </div>
  );
}

export default NearbySalonsMap;
