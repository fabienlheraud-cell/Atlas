import { Attraction, AttractionCategory, Coordinates } from '@/types';

const BASE_URL = 'https://api.opentripmap.com/0.1/en';

interface OTMListPlace {
  xid: string;
  name?: string;
  rate: number;
  kinds: string;
  point: { lon: number; lat: number };
}

interface OTMDetail {
  xid: string;
  name: string;
  kinds: string;
  point: { lon: number; lat: number };
  address?: { road?: string; city?: string; state?: string };
  preview?: { source: string };
  wikipedia_extracts?: { text: string };
  wikipedia?: string;
  rate?: string;
}

// Fetch all attractions within a bounding box — one API call instead of many
export async function fetchAttractionsByBbox(
  routePoints: [number, number][], // [lat, lng]
  categories: AttractionCategory[],
  neededCount: number
): Promise<Attraction[]> {
  const apiKey = process.env.OPENTRIPMAP_API_KEY;
  if (!apiKey) throw new Error('OPENTRIPMAP_API_KEY is not set');

  // Compute bounding box from route with 0.5° padding
  const lats = routePoints.map((p) => p[0]);
  const lngs = routePoints.map((p) => p[1]);
  const pad = 0.5;
  const latMin = Math.min(...lats) - pad;
  const latMax = Math.max(...lats) + pad;
  const lonMin = Math.min(...lngs) - pad;
  const lonMax = Math.max(...lngs) + pad;

  const kinds = categories.join(',');
  const params = new URLSearchParams({
    lon_min: lonMin.toString(),
    lat_min: latMin.toString(),
    lon_max: lonMax.toString(),
    lat_max: latMax.toString(),
    kinds,
    limit: '100',
    apikey: apiKey,
  });

  const res = await fetch(`${BASE_URL}/places/bbox?${params}`);
  if (!res.ok) {
    console.error(`OTM bbox error ${res.status}`);
    return [];
  }

  const data = await res.json();
  const places: OTMListPlace[] = data.features?.map(
    (f: { properties: OTMListPlace; geometry: { coordinates: [number, number] } }) => ({
      ...f.properties,
      point: { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] },
    })
  ) ?? [];

  console.log(`OTM bbox: ${places.length} candidates found`);

  // Take best candidates by rate — neededCount already accounts for the selection margin
  const candidates = places
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
    .slice(0, Math.min(neededCount, 80));

  // Fetch details in batches of 10 to avoid overwhelming the API
  const results: Attraction[] = [];
  for (let i = 0; i < candidates.length; i += 10) {
    const batch = candidates.slice(i, i + 10);
    const batchDetails = await Promise.all(batch.map((p) => fetchPlaceDetail(p.xid, apiKey)));
    results.push(...batchDetails.filter((a): a is Attraction => a !== null));
  }

  console.log(`OTM: ${results.length} valid attractions after detail fetch`);
  return results;
}

async function fetchPlaceDetail(xid: string, apiKey: string): Promise<Attraction | null> {
  try {
    const res = await fetch(`${BASE_URL}/places/xid/${xid}?apikey=${apiKey}`);
    if (!res.ok) return null;

    const d: OTMDetail = await res.json();
    if (!d.name?.trim() || !d.point) return null;

    const address = d.address
      ? [d.address.road, d.address.city, d.address.state].filter(Boolean).join(', ')
      : undefined;

    const cats = (d.kinds || '')
      .split(',')
      .filter((k) =>
        ['interesting_places', 'historic', 'natural', 'architecture', 'cultural'].includes(k)
      ) as AttractionCategory[];

    return {
      id: d.xid,
      name: d.name,
      description: d.wikipedia_extracts?.text?.slice(0, 300),
      coordinates: { lat: d.point.lat, lng: d.point.lon },
      categories: cats.length ? cats : ['interesting_places'],
      imageUrl: d.preview?.source,
      wikiUrl: d.wikipedia,
      rating: d.rate ? parseFloat(d.rate) : undefined,
      entryCost: 'unknown',
      address,
    };
  } catch {
    return null;
  }
}
