import { Coordinates } from '@/types';

const BASE_URL = 'https://api.openrouteservice.org/v2';

interface RouteResult {
  distanceKm: number;
  durationMin: number;
  geometry: [number, number][]; // [lat, lng] pairs
}

export async function getRoute(
  start: Coordinates,
  end: Coordinates
): Promise<RouteResult | null> {
  const apiKey = process.env.OPENROUTE_API_KEY;
  if (!apiKey) throw new Error('OPENROUTE_API_KEY is not set');

  const res = await fetch(`${BASE_URL}/directions/driving-car/geojson`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({
      coordinates: [
        [start.lng, start.lat],
        [end.lng, end.lat],
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouteService error: ${err}`);
  }

  const data = await res.json();
  const feature = data.features[0];
  const summary = feature.properties.summary;

  // GeoJSON geometry is [lng, lat], we convert to [lat, lng] for Leaflet
  const geometry: [number, number][] = feature.geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng]
  );

  return {
    distanceKm: summary.distance / 1000,
    durationMin: summary.duration / 60,
    geometry,
  };
}

// Sample N evenly-spaced coordinates along a route
export function sampleRoutePoints(
  geometry: [number, number][],
  numPoints: number
): [number, number][] {
  if (geometry.length === 0) return [];
  if (numPoints >= geometry.length) return geometry;

  const step = (geometry.length - 1) / (numPoints + 1);
  const points: [number, number][] = [];

  for (let i = 1; i <= numPoints; i++) {
    const index = Math.round(i * step);
    points.push(geometry[Math.min(index, geometry.length - 1)]);
  }

  return points;
}
