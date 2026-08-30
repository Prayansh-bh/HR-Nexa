/**
 * Authoritative Pure Geographic & Distance Utility
 *
 * Implements deterministic Haversine geodesic distance calculation using WGS-84 mean radius.
 * All coordinates must be finite decimal degrees within canonical geographic bounds.
 */

export const EARTH_RADIUS_METERS = 6371000; // 6,371 km

/**
 * Validates that latitude and longitude are finite numbers within physical geographic bounds.
 * Latitude: [-90, +90]
 * Longitude: [-180, +180]
 */
export function isValidCoordinate(lat: any, lon: any): boolean {
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  return true;
}

/**
 * Validates that radius is a finite positive number within reasonable limits (1m to 10,000m).
 */
export function isValidRadius(radiusMeters: any): boolean {
  if (typeof radiusMeters !== 'number' || !Number.isFinite(radiusMeters)) {
    return false;
  }
  return radiusMeters > 0 && radiusMeters <= 10000;
}

/**
 * Converts degrees to radians.
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Computes the geodesic distance in meters between two coordinates using the Haversine formula.
 *
 * Throws an Error if any coordinate is invalid, non-numeric, NaN, or out of bounds.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (!isValidCoordinate(lat1, lon1)) {
    throw new Error(
      `Invalid origin coordinates: latitude=${lat1}, longitude=${lon1}`,
    );
  }
  if (!isValidCoordinate(lat2, lon2)) {
    throw new Error(
      `Invalid destination coordinates: latitude=${lat2}, longitude=${lon2}`,
    );
  }

  // Exact point equality short-circuit
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  // Safeguard against floating-point inaccuracy exceeding 1.0
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Evaluates whether an employee's coordinates fall within a GeoZone's boundary.
 *
 * Boundary condition: distance <= radiusMeters (inclusive boundary).
 */
export function isWithinGeofence(
  employeeLatitude: number,
  employeeLongitude: number,
  zoneLatitude: number,
  zoneLongitude: number,
  radiusMeters: number,
): boolean {
  if (!isValidRadius(radiusMeters)) {
    throw new Error(`Invalid geofence radius: ${radiusMeters}`);
  }

  const distance = calculateDistanceMeters(
    employeeLatitude,
    employeeLongitude,
    zoneLatitude,
    zoneLongitude,
  );

  return distance <= radiusMeters;
}
