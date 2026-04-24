import { Coordinates, GeocodedLocation } from '@/types';

const BASE_URL = 'https://nominatim.openstreetmap.org';
const HEADERS = { 'User-Agent': 'AtlasRoadTrip/1.0 (contact@atlas-roadtrip.app)' };

export async function geocode(address: string): Promise<GeocodedLocation | null> {
  const params = new URLSearchParams({
    q: address,
    format: 'json',
    limit: '1',
    countrycodes: 'ca,us',
  });

  const res = await fetch(`${BASE_URL}/search?${params}`, { headers: HEADERS });
  if (!res.ok) return null;

  const results = await res.json();
  if (!results.length) return null;

  const r = results[0];
  return {
    name: r.name || address,
    displayName: r.display_name,
    coordinates: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) },
  };
}

export async function reverseGeocode(coords: Coordinates): Promise<string> {
  const params = new URLSearchParams({
    lat: coords.lat.toString(),
    lon: coords.lng.toString(),
    format: 'json',
  });

  const res = await fetch(`${BASE_URL}/reverse?${params}`, { headers: HEADERS });
  if (!res.ok) return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;

  const data = await res.json();
  return data.display_name || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
}
