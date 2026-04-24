import { Attraction, AttractionCategory, Coordinates } from '@/types';

const BASE_URL = 'https://api.opentripmap.com/0.1/en';

interface OTMPlace {
  xid: string;
  name: string;
  rate: number;
  kinds: string;
  point: { lon: number; lat: number };
}

interface OTMPlaceDetail {
  xid: string;
  name: string;
  kinds: string;
  point: { lon: number; lat: number };
  address?: {
    road?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  preview?: { source: string };
  wikipedia_extracts?: { text: string };
  wikipedia?: string;
  url?: string;
  rate?: string;
}

export async function fetchAttractionsNear(
  center: Coordinates,
  radiusM: number,
  categories: AttractionCategory[],
  limit = 20
): Promise<Attraction[]> {
  const apiKey = process.env.OPENTRIPMAP_API_KEY;
  if (!apiKey) throw new Error('OPENTRIPMAP_API_KEY is not set');

  const kinds = categories.join(',');
  const params = new URLSearchParams({
    radius: radiusM.toString(),
    lon: center.lng.toString(),
    lat: center.lat.toString(),
    kinds,
    limit: limit.toString(),
    rate: '2', // minimum interest rating
    apikey: apiKey,
  });

  const res = await fetch(`${BASE_URL}/places/radius?${params}`);
  if (!res.ok) return [];

  const data = await res.json();
  const places: OTMPlace[] = data.features?.map((f: { properties: OTMPlace; geometry: { coordinates: [number, number] } }) => ({
    ...f.properties,
    point: { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] },
  })) ?? [];

  // Fetch details for the top places (limit API calls)
  const top = places.filter((p) => p.name && p.name.trim()).slice(0, 10);
  const detailed = await Promise.all(top.map((p) => fetchPlaceDetail(p.xid, apiKey)));

  return detailed.filter((a): a is Attraction => a !== null);
}

async function fetchPlaceDetail(xid: string, apiKey: string): Promise<Attraction | null> {
  const res = await fetch(`${BASE_URL}/places/xid/${xid}?apikey=${apiKey}`);
  if (!res.ok) return null;

  const d: OTMPlaceDetail = await res.json();
  if (!d.name || !d.point) return null;

  const address = d.address
    ? [d.address.road, d.address.city, d.address.state].filter(Boolean).join(', ')
    : undefined;

  const categories = (d.kinds || '')
    .split(',')
    .filter((k) =>
      ['interesting_places', 'historic', 'natural', 'architecture', 'cultural'].includes(k)
    ) as AttractionCategory[];

  return {
    id: d.xid,
    name: d.name,
    description: d.wikipedia_extracts?.text?.slice(0, 300),
    coordinates: { lat: d.point.lat, lng: d.point.lon },
    categories: categories.length ? categories : ['interesting_places'],
    imageUrl: d.preview?.source,
    wikiUrl: d.wikipedia,
    rating: d.rate ? parseFloat(d.rate) : undefined,
    entryCost: 'unknown',
    address,
  };
}
