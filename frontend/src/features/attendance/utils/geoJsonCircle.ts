export interface GeoJSONPolygonFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: [number, number][][];
  };
  properties: {
    radiusMeters: number;
    [key: string]: any;
  };
}

/**
 * Generates a GeoJSON Polygon representing a geodesic circle on Earth.
 *
 * @param center - [longitude, latitude] in MapLibre coordinate order
 * @param radiusInMeters - Radius in meters
 * @param points - Number of polygon vertices (default: 64 for smooth circle)
 */
export function createGeoJSONCircle(
  center: [number, number],
  radiusInMeters: number,
  points = 64,
): GeoJSONPolygonFeature {
  const [lng, lat] = center;
  const coords: [number, number][] = [];

  const earthRadius = 6371000; // WGS-84 mean earth radius in meters
  const dByR = radiusInMeters / earthRadius;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  for (let i = 0; i <= points; i++) {
    const bearing = (i * 2 * Math.PI) / points;

    const pLat = Math.asin(
      Math.sin(latRad) * Math.cos(dByR) +
        Math.cos(latRad) * Math.sin(dByR) * Math.cos(bearing),
    );

    const pLng =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(dByR) * Math.cos(latRad),
        Math.cos(dByR) - Math.sin(latRad) * Math.sin(pLat),
      );

    coords.push([(pLng * 180) / Math.PI, (pLat * 180) / Math.PI]);
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
    properties: {
      radiusMeters: radiusInMeters,
    },
  };
}

/**
 * Calculates a bounding box around [lng, lat] for a given radius in meters.
 * Returns [[minLng, minLat], [maxLng, maxLat]] as required by MapLibre map.fitBounds().
 */
export function getBoundingBoxForRadius(
  center: [number, number],
  radiusMeters: number,
): [[number, number], [number, number]] {
  const [lng, lat] = center;
  const dLat = radiusMeters / 111320;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLng = radiusMeters / (111320 * (cosLat === 0 ? 1 : Math.abs(cosLat)));

  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat + dLat],
  ];
}
