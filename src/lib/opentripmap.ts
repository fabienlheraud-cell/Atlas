import { Attraction, AttractionCategory } from '@/types';

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

function safeMinMax(values: number[]): [number, number] {
  let min = values[0];
  let max = values[0];
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

// Split geometry into N equal segments, return one representative bbox per segment
function getSegmentBboxes(
  routePoints: [number, number][],
  segments: number,
  padDeg = 0.4
): Array<{ latMin: number; latMax: number; lonMin: number; lonMax: number }> {
  const segSize = Math.ceil(routePoints.length / segments);
  const boxes = [];

  for (let i = 0; i < segments; i++) {
    const slice = routePoints.slice(i * segSize, (i + 1) * segSize + 1);
    if (slice.length === 0) continue;

    const lats = slice.map((p) => p[0]);
    const lngs = slice.map((p) => p[1]);
    const [latMin, latMax] = safeMinMax(lats);
    const [lonMin, lonMax] = safeMinMax(lngs);

    boxes.push({
      latMin: latMin - padDeg,
      latMax: latMax + padDeg,
      lonMin: lonMin - padDeg,
      lonMax: lonMax + padDeg,
    });
  }

  return boxes;
}

async function fetchBbox(
  latMin: number, latMax: number,
  lonMin: number, lonMax: number,
  kinds: string,
  apiKey: string,
  limit = 30
): Promise<OTMListPlace[]> {
  const params = new URLSearchParams({
    lon_min: lonMin.toString(),
    lat_min: latMin.toString(),
    lon_max: lonMax.toString(),
    lat_max: latMax.toString(),
    kinds,
    limit: limit.toString(),
    apikey: apiKey,
  });

  const res = await fetch(`${BASE_URL}/places/bbox?${params}`);
  if (!res.ok) {
    console.error(`OTM bbox error ${res.status}: ${lonMin},${latMin} → ${lonMax},${latMax}`);
    return [];
  }

  const data = await res.json();
  return (data.features ?? []).map(
    (f: { properties: OTMListPlace; geometry: { coordinates: [number, number] } }) => ({
      ...f.properties,
      point: { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] },
    })
  );
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

// Fetch attractions along a route by splitting it into manageable segments
export async function fetchAttractionsBySegments(
  routePoints: [number, number][],
  categories: AttractionCategory[],
  days: number,
  stopsPerDay: number
): Promise<Attraction[]> {
  const apiKey = process.env.OPENTRIPMAP_API_KEY;
  if (!apiKey) throw new Error('OPENTRIPMAP_API_KEY is not set');

  const kinds = categories.join(',');
  // One segment per day, capped at 5 to limit API calls
  const numSegments = Math.min(days, 5);
  const perSegment = Math.ceil(stopsPerDay * 2.5); // 2.5× needed per segment for filtering margin

  const bboxes = getSegmentBboxes(routePoints, numSegments, 0.4);
  console.log(`OTM: querying ${bboxes.length} segments, ${perSegment} places each`);

  // Fetch each segment bbox sequentially to respect rate limits
  const allPlaces: OTMListPlace[] = [];
  const seenXids = new Set<string>();

  for (const box of bboxes) {
    const places = await fetchBbox(box.latMin, box.latMax, box.lonMin, box.lonMax, kinds, apiKey, perSegment);
    for (const p of places) {
      if (!seenXids.has(p.xid)) {
        seenXids.add(p.xid);
        allPlaces.push(p);
      }
    }
  }

  console.log(`OTM: ${allPlaces.length} unique candidates across all segments`);

  // Sort by rate and take top candidates for detail fetch
  const candidates = allPlaces
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
    .slice(0, Math.min(allPlaces.length, 60));

  // Fetch details in batches of 8
  const results: Attraction[] = [];
  for (let i = 0; i < candidates.length; i += 8) {
    const batch = candidates.slice(i, i + 8);
    const batchDetails = await Promise.all(batch.map((p) => fetchPlaceDetail(p.xid, apiKey)));
    results.push(...batchDetails.filter((a): a is Attraction => a !== null));
  }

  console.log(`OTM: ${results.length} valid attractions after detail fetch`);
  return results;
}
