import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, Navigation, AlertCircle, Search, Loader2, X } from 'lucide-react';
import { createGeoJSONCircle, getBoundingBoxForRadius } from '../utils/geoJsonCircle';
import {
  MAP_STYLE_URL,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
} from '../constants/map.config';
import { geocodingService, GeocodingResult } from '../services/geocoding.service';

export interface GeoZoneMapPickerProps {
  latitude: number | string | null | undefined;
  longitude: number | string | null | undefined;
  radiusMeters: number;
  address?: string;
  onLocationChange: (lat: number, lng: number, address?: string) => void;
  disabled?: boolean;
}

export const GeoZoneMapPicker: React.FC<GeoZoneMapPickerProps> = ({
  latitude,
  longitude,
  radiusMeters,
  address,
  onLocationChange,
  disabled = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const lastFitBoundsRef = useRef<{ lat: number; lng: number; radius: number } | null>(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Address Search State (Strictly user-triggered)
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showResultsDropdown, setShowResultsDropdown] = useState(false);

  // Coordinate parsing & validation
  const parsedLat =
    latitude !== null && latitude !== undefined && latitude !== ''
      ? parseFloat(String(latitude))
      : NaN;
  const parsedLng =
    longitude !== null && longitude !== undefined && longitude !== ''
      ? parseFloat(String(longitude))
      : NaN;

  const hasValidCoords =
    !isNaN(parsedLat) &&
    !isNaN(parsedLng) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLng >= -180 &&
    parsedLng <= 180;

  const currentCenter: [number, number] = hasValidCoords
    ? [parsedLng, parsedLat]
    : DEFAULT_MAP_CENTER;

  const safeRadius = Math.max(10, Math.min(10000, Number(radiusMeters) || 150));

  // Initialize MapLibre Map instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let map: maplibregl.Map;

    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: MAP_STYLE_URL,
        center: currentCenter,
        zoom: hasValidCoords ? DEFAULT_MAP_ZOOM : 15,
        attributionControl: { compact: true },
      });

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        'top-right',
      );

      mapRef.current = map;

      map.on('load', () => {
        setIsMapReady(true);
        setMapError(null);

        // Add Geofence Circle GeoJSON source and layers
        const initialCenter: [number, number] = hasValidCoords
          ? [parsedLng, parsedLat]
          : DEFAULT_MAP_CENTER;

        if (!map.getSource('geofence-circle-source')) {
          map.addSource('geofence-circle-source', {
            type: 'geojson',
            data: hasValidCoords
              ? createGeoJSONCircle(initialCenter, safeRadius)
              : { type: 'FeatureCollection', features: [] },
          });

          map.addLayer({
            id: 'geofence-circle-fill',
            type: 'fill',
            source: 'geofence-circle-source',
            paint: {
              'fill-color': '#3B82F6',
              'fill-opacity': 0.22,
            },
          });

          map.addLayer({
            id: 'geofence-circle-line',
            type: 'line',
            source: 'geofence-circle-source',
            paint: {
              'line-color': '#2563EB',
              'line-width': 2,
              'line-opacity': 0.85,
            },
          });
        }

        // Add Draggable Location Marker if coordinates exist
        if (hasValidCoords && !markerRef.current) {
          const marker = new maplibregl.Marker({
            draggable: !disabled,
            color: '#2563EB',
          })
            .setLngLat([parsedLng, parsedLat])
            .addTo(map);

          marker.on('dragend', () => {
            const lngLat = marker.getLngLat();
            onLocationChange(
              Number(lngLat.lat.toFixed(6)),
              Number(lngLat.lng.toFixed(6)),
            );
          });

          markerRef.current = marker;
        }

        // Initial radius fit bounds
        if (hasValidCoords) {
          const bbox = getBoundingBoxForRadius([parsedLng, parsedLat], safeRadius);
          map.fitBounds(bbox, { padding: 45, maxZoom: 17, duration: 600 });
          lastFitBoundsRef.current = { lat: parsedLat, lng: parsedLng, radius: safeRadius };
        }
      });

      // Map Click to place / move location
      map.on('click', (e) => {
        if (disabled) return;
        const { lng, lat } = e.lngLat;
        onLocationChange(
          Number(lat.toFixed(6)),
          Number(lng.toFixed(6)),
        );
        setShowResultsDropdown(false);
      });

      map.on('error', (e) => {
        console.warn('MapLibre map notice:', e?.error?.message || e);
        if (!mapRef.current?.loaded()) {
          setMapError('Map tiles could not be loaded. You can still enter coordinates manually.');
        }
      });
    } catch (err: any) {
      console.warn('MapLibre initialization exception:', err?.message || err);
      setMapError('Map initialization failed. Manual coordinate entry remains fully operational.');
    }

    return () => {
      if (markerRef.current) {
        try {
          markerRef.current.remove();
        } catch {}
        markerRef.current = null;
      }
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
      setIsMapReady(false);
    };
  }, []); // Run once on mount

  // Synchronize Marker, Circle, and Map View when props change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (hasValidCoords) {
      const targetLngLat: [number, number] = [parsedLng, parsedLat];

      // 1. Update or create marker
      if (!markerRef.current) {
        try {
          const marker = new maplibregl.Marker({
            draggable: !disabled,
            color: '#2563EB',
          })
            .setLngLat(targetLngLat)
            .addTo(map);

          marker.on('dragend', () => {
            const lngLat = marker.getLngLat();
            onLocationChange(
              Number(lngLat.lat.toFixed(6)),
              Number(lngLat.lng.toFixed(6)),
            );
          });

          markerRef.current = marker;
        } catch {}
      } else {
        const cur = markerRef.current.getLngLat();
        if (
          Math.abs(cur.lat - parsedLat) > 0.000001 ||
          Math.abs(cur.lng - parsedLng) > 0.000001
        ) {
          markerRef.current.setLngLat(targetLngLat);
        }
      }

      // 2. Update GeoJSON circle polygon
      if (map.isStyleLoaded && map.isStyleLoaded()) {
        const source = map.getSource('geofence-circle-source') as maplibregl.GeoJSONSource | undefined;
        if (source && typeof source.setData === 'function') {
          source.setData(createGeoJSONCircle(targetLngLat, safeRadius));
        }
      }

      // 3. Auto-fit radius bounds when radius or center changes materially
      const lastFit = lastFitBoundsRef.current;
      const shouldFitBounds =
        !lastFit ||
        lastFit.radius !== safeRadius ||
        Math.abs(lastFit.lat - parsedLat) > 0.005 ||
        Math.abs(lastFit.lng - parsedLng) > 0.005;

      if (shouldFitBounds && isMapReady && typeof map.fitBounds === 'function') {
        try {
          const bbox = getBoundingBoxForRadius(targetLngLat, safeRadius);
          map.fitBounds(bbox, { padding: 45, maxZoom: 17, duration: 600 });
          lastFitBoundsRef.current = { lat: parsedLat, lng: parsedLng, radius: safeRadius };
        } catch {}
      }
    } else {
      // Remove marker if coordinates become empty
      if (markerRef.current) {
        try {
          markerRef.current.remove();
        } catch {}
        markerRef.current = null;
      }
      // Clear circle
      if (map.isStyleLoaded && map.isStyleLoaded()) {
        const source = map.getSource('geofence-circle-source') as maplibregl.GeoJSONSource | undefined;
        if (source && typeof source.setData === 'function') {
          source.setData({ type: 'FeatureCollection', features: [] });
        }
      }
    }
  }, [parsedLat, parsedLng, safeRadius, disabled, isMapReady, hasValidCoords]);

  // Handle User-Triggered Address Search (Search button click or Enter key)
  const handlePerformSearch = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const query = searchQuery.trim();
      if (!query || query.length < 2) return;

      setIsSearching(true);
      setSearchError(null);
      setShowResultsDropdown(true);

      try {
        const results = await geocodingService.searchAddress(query);
        setSearchResults(results);
        if (results.length === 0) {
          setSearchError('No matching locations found for your search.');
        }
      } catch (err: any) {
        setSearchResults([]);
        setSearchError(
          err?.message || 'Geocoding search failed. You can still set coordinates manually or on map.',
        );
      } finally {
        setIsSearching(false);
      }
    },
    [searchQuery],
  );

  // Handle selection of a search result
  const handleSelectSearchResult = (result: GeocodingResult) => {
    setShowResultsDropdown(false);
    setSearchQuery('');
    setSearchResults([]);

    const map = mapRef.current;
    if (map) {
      map.flyTo({
        center: [result.longitude, result.latitude],
        zoom: DEFAULT_MAP_ZOOM,
        essential: true,
      });
    }

    onLocationChange(result.latitude, result.longitude, result.displayName);
  };

  // "Use My Location" action using browser geolocation
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setMapError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setMapError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));

        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [lng, lat],
            zoom: DEFAULT_MAP_ZOOM,
            essential: true,
          });
        }

        onLocationChange(lat, lng);
      },
      (err) => {
        setIsLocating(false);
        let msg = 'Unable to retrieve location.';
        if (err.code === 1) msg = 'Location permission denied by user.';
        else if (err.code === 2) msg = 'Position unavailable.';
        else if (err.code === 3) msg = 'Location request timed out.';
        setMapError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  return (
    <div className="w-full space-y-2.5">
      {/* Top Controls Header: Address Search & Locate Me Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* User-Triggered Address Search Bar */}
        <div className="relative flex-1">
          <form onSubmit={handlePerformSearch} className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                data-testid="geozone-search-input"
                placeholder="Search office, building or address (press Enter)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePerformSearch();
                  }
                }}
                disabled={disabled}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setShowResultsDropdown(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              data-testid="geozone-search-submit"
              disabled={disabled || isSearching || !searchQuery.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors flex items-center gap-1 shrink-0"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <span>Search</span>
              )}
            </button>
          </form>

          {/* Search Results Dropdown Popover */}
          {showResultsDropdown && (searchResults.length > 0 || searchError) && (
            <div
              data-testid="geozone-search-results"
              className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto"
            >
              {searchError ? (
                <div className="p-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{searchError}</span>
                </div>
              ) : (
                <div className="py-1 divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Search Results ({searchResults.length})
                  </div>
                  {searchResults.map((res) => (
                    <button
                      key={res.placeId}
                      type="button"
                      onClick={() => handleSelectSearchResult(res)}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors flex items-start gap-2"
                    >
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{res.displayName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Use My Location Button */}
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={disabled || isLocating}
          className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors disabled:opacity-50 shrink-0 border border-blue-200 dark:border-blue-800/50"
        >
          {isLocating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Locating...</span>
            </>
          ) : (
            <>
              <Navigation className="w-3.5 h-3.5" />
              <span>Use My Location</span>
            </>
          )}
        </button>
      </div>

      {/* Map Error / Fallback Notice Banner */}
      {mapError && (
        <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{mapError}</span>
        </div>
      )}

      {/* MapLibre Canvas Container */}
      <div className="relative w-full h-64 sm:h-72 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 shadow-inner">
        <div
          ref={mapContainerRef}
          data-testid="maplibre-container"
          className="w-full h-full"
        />

        {/* Interactive Helper Overlay Tag */}
        <div className="absolute bottom-2 left-2 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 shadow-sm pointer-events-none flex items-center gap-1.5">
          <span className="text-amber-500">💡</span>
          <span>Click map or drag marker to set coordinates</span>
        </div>
      </div>
    </div>
  );
};
