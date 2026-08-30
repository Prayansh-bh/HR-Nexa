import { NOMINATIM_BASE_URL } from '../constants/map.config';

export interface GeocodingResult {
  displayName: string;
  latitude: number;
  longitude: number;
  placeId: string;
}

export interface IGeocodingService {
  searchAddress(query: string): Promise<GeocodingResult[]>;
}

class NominatimGeocodingService implements IGeocodingService {
  private cache = new Map<string, GeocodingResult[]>();
  private lastRequestTimestamp = 0;
  private readonly minRequestIntervalMs = 1000; // Respect Nominatim 1 req/sec policy

  /**
   * Performs an explicit, user-triggered geocoding lookup using OpenStreetMap Nominatim.
   * Includes rate-limiting (max 1 req/sec), caching, and graceful error handling.
   *
   * @param query - The user-provided address or landmark search text.
   */
  async searchAddress(query: string): Promise<GeocodingResult[]> {
    const trimmed = query?.trim();
    if (!trimmed || trimmed.length < 2) {
      return [];
    }

    const cacheKey = trimmed.toLowerCase();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Rate-limiting delay enforcement
    const now = Date.now();
    const elapsed = now - this.lastRequestTimestamp;
    if (elapsed < this.minRequestIntervalMs) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minRequestIntervalMs - elapsed),
      );
    }

    this.lastRequestTimestamp = Date.now();

    try {
      const url = `${NOMINATIM_BASE_URL}?format=json&q=${encodeURIComponent(
        trimmed,
      )}&limit=5&addressdetails=1`;

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.status === 429) {
        console.warn('Nominatim rate limit reached (429). Please try again in a moment.');
        throw new Error('Search rate limit reached. Please wait a few seconds before retrying.');
      }

      if (!response.ok) {
        throw new Error(`Geocoding search failed with status: ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        return [];
      }

      const results: GeocodingResult[] = data.map((item: any) => ({
        displayName: item.display_name || item.name || 'Unknown location',
        latitude: Number(parseFloat(item.lat).toFixed(6)),
        longitude: Number(parseFloat(item.lon).toFixed(6)),
        placeId: String(item.place_id || `${item.lat},${item.lon}`),
      }));

      // Cache up to 50 search queries
      if (this.cache.size > 50) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, results);

      return results;
    } catch (err: any) {
      console.warn('Geocoding service error:', err?.message || err);
      throw err;
    }
  }
}

// Singleton geocoding service instance
export const geocodingService: IGeocodingService = new NominatimGeocodingService();
