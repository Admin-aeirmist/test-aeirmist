import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, X, Navigation, Loader2 } from 'lucide-react';

interface LocationSearchProps {
  selectedLocation: string | null;
  onSelect: (location: string | null) => void;
}

export const LocationSearch: React.FC<LocationSearchProps> = ({ selectedLocation, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const popularPlaces = [
    'Dhaka, Bangladesh',
    'Chittagong, Bangladesh',
    'Sylhet, Bangladesh',
    'Rajshahi, Bangladesh',
    'Tokyo, Japan',
    'New York, USA',
    'London, UK',
    'Dubai, UAE',
  ];

  // Real Nominatim geocoding search
  const searchNominatim = async (text: string) => {
    if (!text.trim()) {
      setResults(popularPlaces);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=6&addressdetails=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'Aeirmist-App/1.0' } }
      );
      if (res.ok) {
        const data = await res.json();
        const places: string[] = data.map((item: any) => {
          const addr = item.address || {};
          const parts = [
            addr.city || addr.town || addr.village || addr.municipality,
            addr.state || addr.county,
            addr.country,
          ].filter(Boolean);
          return parts.length > 0 ? parts.join(', ') : item.display_name.split(',').slice(0, 2).join(',').trim();
        }).filter(Boolean);
        setResults(Array.from(new Set(places)));
      }
    } catch {
      setResults(popularPlaces);
    } finally {
      setIsSearching(false);
    }
  };

  // Reverse geocode current position
  const detectLocation = () => {
    setIsSearching(true);
    if (!navigator.geolocation) { onSelect('Current Location'); setIsSearching(false); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'Aeirmist-App/1.0' } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const label = [
              addr.city || addr.town || addr.village,
              addr.state,
              addr.country,
            ].filter(Boolean).join(', ');
            onSelect(label || data.display_name.split(',').slice(0, 2).join(',').trim());
          } else {
            onSelect(`${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`);
          }
        } catch {
          onSelect(`${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`);
        }
        setIsSearching(false);
      },
      () => { onSelect('Current Location'); setIsSearching(false); }
    );
  };

  // Debounced search
  const handleSearch = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchNominatim(text), 400);
  };

  // Load popular places on mount
  useEffect(() => { setResults(popularPlaces); }, []);

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4">
      <div className="flex justify-between items-center border-b border-white/10 pb-2">
        <span className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1.5">
          <MapPin size={14} className="text-[#00f3ff]" />
          <span>Location</span>
        </span>
        {selectedLocation && (
          <button
            onClick={() => onSelect(null)}
            className="text-[10px] text-red-400 hover:underline uppercase font-bold flex items-center gap-0.5"
          >
            <X size={10} /> Remove
          </button>
        )}
      </div>

      {selectedLocation ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#00f3ff]/10 border border-[#00f3ff]/20 rounded-xl text-xs text-[#00f3ff]">
          <MapPin size={14} className="animate-pulse" />
          <span className="font-bold">{selectedLocation}</span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search cities, landmarks, countries..."
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f3ff] placeholder:text-white/20"
            />
            {isSearching
              ? <Loader2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#00f3ff] animate-spin" />
              : <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
            }
          </div>

          <button
            onClick={detectLocation}
            disabled={isSearching}
            className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-white flex items-center justify-center gap-2 border border-white/5 transition-all disabled:opacity-50"
          >
            <Navigation size={12} className={isSearching ? 'animate-spin' : ''} />
            <span>{isSearching ? 'Detecting...' : 'Use Current Location'}</span>
          </button>

          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            <span className="text-[9px] font-black uppercase text-white/30 tracking-widest block mb-1">
              {query ? 'Results' : 'Popular Places'}
            </span>
            {results.length === 0 && !isSearching && (
              <p className="text-xs text-white/30 text-center py-2">No results found</p>
            )}
            {results.map((place) => (
              <button
                key={place}
                onClick={() => onSelect(place)}
                className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2"
              >
                <MapPin size={10} className="text-white/20 shrink-0" />
                <span>{place}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
