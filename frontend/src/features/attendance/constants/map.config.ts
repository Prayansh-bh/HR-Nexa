/**
 * Centralized Map & Geolocation Configuration for HR NEXA
 * Uses OpenFreeMap Bright vector tiles (OpenStreetMap data) with zero paid API keys or subscription dependencies.
 */

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';

export const DEFAULT_MAP_CENTER: [number, number] = [73.8567, 18.5204]; // [lng, lat] (Pune / India central commercial hub fallback)

export const DEFAULT_MAP_ZOOM = 16; // Street-level zoom for crisp building & road visibility

export const DEFAULT_GEOFENCE_RADIUS_METERS = 150;

export const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
