import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MapPin, Search, Navigation, X, Check, Locate, Loader2 } from 'lucide-react';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const locationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle map click events
function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  return position ? (
    <Marker 
      position={[position.lat, position.lng]} 
      icon={locationIcon}
      draggable={true}
      eventHandlers={{
        dragend(e) {
          const marker = e.target;
          const pos = marker.getLatLng();
          setPosition({ lat: pos.lat, lng: pos.lng });
        }
      }}
    />
  ) : null;
}

// Component to fly to position when it changes
function FlyToPosition({ position }) {
  const map = useMap();
  
  useEffect(() => {
    if (position) {
      map.flyTo([position.lat, position.lng], 15, { duration: 1 });
    }
  }, [position, map]);

  return null;
}

function LocationPickerModal({ isOpen, onClose, onLocationSelect, initialLocation, title = "Choose Your Location" }) {
  const [position, setPosition] = useState(initialLocation || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [address, setAddress] = useState('');
  const [mapCenter, setMapCenter] = useState(initialLocation || { lat: 28.7041, lng: 77.1025 });

  useEffect(() => {
    if (initialLocation) {
      setPosition(initialLocation);
      setMapCenter(initialLocation);
      reverseGeocode(initialLocation.lat, initialLocation.lng);
    }
  }, [initialLocation]);

  useEffect(() => {
    if (position) {
      reverseGeocode(position.lat, position.lng);
    }
  }, [position]);

  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      if (data.display_name) {
        setAddress(data.display_name);
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const newPos = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        setPosition(newPos);
        setMapCenter(newPos);
      } else {
        alert('Location not found. Please try a different search.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Failed to search location. Please try again.');
    }
    setSearching(false);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(newPos);
        setMapCenter(newPos);
        setGettingLocation(false);
      },
      (error) => {
        setGettingLocation(false);
        let errorMsg = 'Unable to get your location.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission denied. Please enable location access in your browser settings.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Location information unavailable. Please try again.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location request timed out. Please try again.';
        }
        alert(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleConfirm = () => {
    try {
      if (position && position.lat && position.lng) {
        const locationData = {
          lat: position.lat,
          lng: position.lng,
          address: address || `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`
        };
        onLocationSelect(locationData);
        onClose();
      } else {
        alert('Please select a location on the map first.');
      }
    } catch (error) {
      console.error('Error confirming location:', error);
      alert('Failed to save location. Please try again.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <MapPin className="w-5 h-5 text-red-600" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 sm:space-y-4">
          {/* Use Current Location Button - Prominent */}
          <Button 
            data-testid="use-current-location-btn"
            onClick={handleGetCurrentLocation}
            disabled={gettingLocation}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-sm sm:text-base"
          >
            {gettingLocation ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                Detecting Location...
              </>
            ) : (
              <>
                <Locate className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Use My Current Location (GPS)
              </>
            )}
          </Button>

          <div className="text-center text-xs sm:text-sm text-gray-500">— OR —</div>

          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                data-testid="location-search-input"
                className="pl-10 text-sm sm:text-base"
                placeholder="Search location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button 
              data-testid="location-search-btn"
              onClick={handleSearch} 
              disabled={searching}
              variant="outline"
              className="w-full sm:w-auto"
            >
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Map Container - Responsive height */}
          <div className="h-48 sm:h-64 md:h-80 w-full rounded-lg overflow-hidden border-2 border-gray-200 shadow-inner">
            <MapContainer
              center={[mapCenter.lat, mapCenter.lng]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <LocationMarker position={position} setPosition={setPosition} />
              <FlyToPosition position={position} />
            </MapContainer>
          </div>

          {/* Selected Location Info */}
          {position && (
            <div className="bg-green-50 border border-green-200 p-2 sm:p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-green-800">Selected Location</p>
                  <p className="text-xs text-green-700 line-clamp-2" title={address}>{address || 'Loading address...'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <p className="text-xs text-gray-500 text-center">
            Tap on map or drag marker to adjust location
          </p>

          {/* Action Buttons */}
          <div className="flex gap-2 sm:gap-3 pt-2">
            <Button 
              data-testid="cancel-location-btn"
              variant="outline" 
              className="flex-1 text-sm" 
              onClick={onClose}
            >
              <X className="w-4 h-4 mr-1 sm:mr-2" />
              Cancel
            </Button>
            <Button 
              data-testid="confirm-location-btn"
              className="flex-1 bg-red-600 hover:bg-red-700 text-sm" 
              onClick={handleConfirm}
              disabled={!position}
            >
              <Check className="w-4 h-4 mr-1 sm:mr-2" />
              Save Location
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default LocationPickerModal;
