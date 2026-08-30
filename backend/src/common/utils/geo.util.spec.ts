import {
  calculateDistanceMeters,
  isWithinGeofence,
  isValidCoordinate,
  isValidRadius,
  EARTH_RADIUS_METERS,
} from './geo.util';

describe('Canonical Geo Utility (Haversine)', () => {
  describe('1. isValidCoordinate', () => {
    it('accepts valid coordinates within bounds', () => {
      expect(isValidCoordinate(0, 0)).toBe(true);
      expect(isValidCoordinate(90, 180)).toBe(true);
      expect(isValidCoordinate(-90, -180)).toBe(true);
      expect(isValidCoordinate(12.9716, 77.5946)).toBe(true);
    });

    it('rejects out of bounds or invalid coordinates', () => {
      expect(isValidCoordinate(90.1, 0)).toBe(false);
      expect(isValidCoordinate(-90.1, 0)).toBe(false);
      expect(isValidCoordinate(0, 180.1)).toBe(false);
      expect(isValidCoordinate(0, -180.1)).toBe(false);
      expect(isValidCoordinate(NaN, 0)).toBe(false);
      expect(isValidCoordinate(0, Infinity)).toBe(false);
      expect(isValidCoordinate(null, 77.5946)).toBe(false);
      expect(isValidCoordinate(undefined, 77.5946)).toBe(false);
      expect(isValidCoordinate('12.9716' as any, 77.5946)).toBe(false);
    });
  });

  describe('2. isValidRadius', () => {
    it('accepts valid radii from 1m to 10,000m', () => {
      expect(isValidRadius(1)).toBe(true);
      expect(isValidRadius(150)).toBe(true);
      expect(isValidRadius(10000)).toBe(true);
    });

    it('rejects zero, negative, extreme, or non-numeric radii', () => {
      expect(isValidRadius(0)).toBe(false);
      expect(isValidRadius(-50)).toBe(false);
      expect(isValidRadius(10001)).toBe(false);
      expect(isValidRadius(NaN)).toBe(false);
      expect(isValidRadius(Infinity)).toBe(false);
      expect(isValidRadius('150' as any)).toBe(false);
    });
  });

  describe('3. calculateDistanceMeters', () => {
    it('returns exactly 0 for identical coordinates', () => {
      const distance = calculateDistanceMeters(12.9716, 77.5946, 12.9716, 77.5946);
      expect(distance).toBe(0);
    });

    it('accurately computes distance between known landmarks', () => {
      // Bangalore Vidhana Soudha (12.9797, 77.5907) to Bangalore MG Road Metro (12.9756, 77.6066)
      // Known geodesic distance is approximately 1,780 meters (~1.78 km)
      const distance = calculateDistanceMeters(12.9797, 77.5907, 12.9756, 77.6066);
      expect(distance).toBeGreaterThan(1700);
      expect(distance).toBeLessThan(1850);
    });

    it('accurately computes short distances (~100m offset)', () => {
      // 0.0009 degrees latitude is approx 100 meters
      const lat1 = 12.9716;
      const lon1 = 77.5946;
      const lat2 = 12.9716 + 0.0009;
      const lon2 = 77.5946;
      const distance = calculateDistanceMeters(lat1, lon1, lat2, lon2);
      expect(distance).toBeGreaterThan(95);
      expect(distance).toBeLessThan(105);
    });

    it('throws on invalid origin or destination coordinates', () => {
      expect(() => calculateDistanceMeters(95, 0, 10, 10)).toThrow('Invalid origin coordinates');
      expect(() => calculateDistanceMeters(10, 10, 10, 190)).toThrow('Invalid destination coordinates');
      expect(() => calculateDistanceMeters(NaN, 0, 10, 10)).toThrow('Invalid origin coordinates');
    });
  });

  describe('4. isWithinGeofence', () => {
    const zoneLat = 12.9716;
    const zoneLon = 77.5946;
    const radius = 100; // 100 meters

    it('returns true when employee is inside radius (D < R)', () => {
      // ~20 meters away
      const empLat = 12.9716 + 0.00018;
      const empLon = 77.5946;
      expect(isWithinGeofence(empLat, empLon, zoneLat, zoneLon, radius)).toBe(true);
    });

    it('returns true when employee is at the exact center (D = 0)', () => {
      expect(isWithinGeofence(zoneLat, zoneLon, zoneLat, zoneLon, radius)).toBe(true);
    });

    it('returns false when employee is outside radius (D > R)', () => {
      // ~200 meters away
      const empLat = 12.9716 + 0.0018;
      const empLon = 77.5946;
      expect(isWithinGeofence(empLat, empLon, zoneLat, zoneLon, radius)).toBe(false);
    });

    it('evaluates boundary condition (distance <= radiusMeters)', () => {
      // Calculate exact distance to a point
      const empLat = 12.9716 + 0.0005;
      const empLon = 77.5946;
      const exactDistance = calculateDistanceMeters(empLat, empLon, zoneLat, zoneLon);

      // When radius is exactDistance -> inside (true)
      expect(isWithinGeofence(empLat, empLon, zoneLat, zoneLon, exactDistance)).toBe(true);

      // When radius is exactDistance - 0.01 -> outside (false)
      expect(isWithinGeofence(empLat, empLon, zoneLat, zoneLon, exactDistance - 0.01)).toBe(false);

      // When radius is exactDistance + 0.01 -> inside (true)
      expect(isWithinGeofence(empLat, empLon, zoneLat, zoneLon, exactDistance + 0.01)).toBe(true);
    });

    it('throws error when radius is invalid', () => {
      expect(() => isWithinGeofence(12.9716, 77.5946, 12.9716, 77.5946, -10)).toThrow('Invalid geofence radius');
      expect(() => isWithinGeofence(12.9716, 77.5946, 12.9716, 77.5946, 0)).toThrow('Invalid geofence radius');
    });
  });
});
