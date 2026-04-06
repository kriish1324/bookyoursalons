import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { MapPin, Search } from 'lucide-react';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const salonIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function LocationMarker({ position, setPosition }) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return position ? <Marker position={position} icon={salonIcon} draggable={true} eventHandlers={{
    dragend(e) {
      setPosition(e.target.getLatLng());
    }
  }} /> : null;
}

function MapLocationPicker({ initialLocation, onLocationSelect }) {
  const [position, setPosition] = useState(initialLocation || { lat: 28.7041, lng: 77.1025 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const mapRef = useRef(null);

  useEffect(() => {
    if (initialLocation) {
      setPosition(initialLocation);
    }
  }, [initialLocation]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      // Use Nominatim geocoding service (free, no API key)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const newPos = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        setPosition(newPos);
        if (mapRef.current) {
          mapRef.current.flyTo(newPos, 15);
        }
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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPosition(newPos);
          if (mapRef.current) {
            mapRef.current.flyTo(newPos, 15);
          }
        },
        () => {
          alert('Unable to get your location. Please search or click on the map.');
        }
      );
    }
  };

  const handleConfirm = () => {
    if (position && onLocationSelect) {
      onLocationSelect(position.lat, position.lng);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            className="pl-10"
            placeholder="Search location (e.g., Connaught Place, Delhi)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? 'Searching...' : 'Search'}
        </Button>
        <Button variant="outline" onClick={handleGetCurrentLocation}>
          <MapPin className="w-4 h-4 mr-2" />
          My Location
        </Button>
      </div>

      <div className="h-96 w-full rounded-lg overflow-hidden border-2 border-gray-300">
        <MapContainer
          center={[position.lat, position.lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} setPosition={setPosition} />
        </MapContainer>
      </div>

      <div className="bg-blue-50 p-3 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>Selected Location:</strong> {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          Click on the map or drag the marker to adjust the location
        </p>
      </div>

      <Button onClick={handleConfirm} className="w-full">
        Confirm Location
      </Button>
    </div>
  );
}

export default MapLocationPicker;