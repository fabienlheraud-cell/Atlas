import { Attraction, AttractionCategory, Coordinates, DayPlan, TripFilters, TripPlan, TripStop } from '@/types';
import { fetchAttractionsBySegments } from './opentripmap';
import { geocode } from './nominatim';
import { getRoute } from './openroute';

function haversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Downsample geometry to at most maxPoints for performance
function downsampleGeometry(points: [number, number][], maxPoints = 300): [number, number][] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, i) => i % step === 0);
}

// Check if an attraction is within maxDistKm of any route point — uses early exit
function isNearRoute(coords: Coordinates, routePoints: [number, number][], maxDistKm: number): boolean {
  for (const p of routePoints) {
    if (haversineKm(coords, { lat: p[0], lng: p[1] }) <= maxDistKm) return true;
  }
  return false;
}

function filterByProximityToRoute(
  attractions: Attraction[],
  routePoints: [number, number][],
  maxDistKm = 50
): Attraction[] {
  const sampled = downsampleGeometry(routePoints, 300);
  return attractions.filter((a) => isNearRoute(a.coordinates, sampled, maxDistKm));
}

function deduplicateAttractions(attractions: Attraction[], minDistKm = 10): Attraction[] {
  const result: Attraction[] = [];
  for (const a of attractions) {
    const tooClose = result.some((b) => haversineKm(a.coordinates, b.coordinates) < minDistKm);
    if (!tooClose) result.push(a);
  }
  return result;
}

function getBestRouteIndex(coords: Coordinates, routePoints: [number, number][]): number {
  let minDist = Infinity;
  let bestIndex = 0;
  for (let i = 0; i < routePoints.length; i++) {
    const d = haversineKm(coords, { lat: routePoints[i][0], lng: routePoints[i][1] });
    if (d < minDist) { minDist = d; bestIndex = i; }
  }
  return bestIndex;
}

function sortByRouteProgress(attractions: Attraction[], routePoints: [number, number][]): Attraction[] {
  const sampled = downsampleGeometry(routePoints, 300);
  const len = sampled.length - 1 || 1;
  return [...attractions].sort(
    (a, b) =>
      getBestRouteIndex(a.coordinates, sampled) / len -
      getBestRouteIndex(b.coordinates, sampled) / len
  );
}

function buildDayPlans(
  orderedAttractions: Attraction[],
  days: number,
  totalDistanceKm: number,
  stopsPerDay: number
): DayPlan[] {
  const avgDailyDistanceKm = Math.round(totalDistanceKm / days);
  const avgSpeedKmh = 90;
  const dayPlans: DayPlan[] = [];

  for (let day = 1; day <= days; day++) {
    const slice = orderedAttractions.splice(0, stopsPerDay);
    if (slice.length === 0) continue;

    const stops: TripStop[] = [];
    let prev: Coordinates | null = null;

    for (const attraction of slice) {
      const dist = prev ? Math.round(haversineKm(prev, attraction.coordinates)) : 0;
      const time = Math.round((dist / avgSpeedKmh) * 60);
      stops.push({ attraction, distanceFromPrevious: dist, driveTimeFromPrevious: time });
      prev = attraction.coordinates;
    }

    dayPlans.push({
      day,
      stops,
      totalDistance: avgDailyDistanceKm,
      totalDriveTime: Math.round((avgDailyDistanceKm / avgSpeedKmh) * 60),
    });
  }

  return dayPlans;
}

export async function planTrip(
  startAddress: string,
  endAddress: string,
  days: number,
  filters: TripFilters
): Promise<TripPlan> {
  const [startLoc, endLoc] = await Promise.all([
    geocode(startAddress),
    geocode(endAddress),
  ]);

  if (!startLoc) throw new Error(`Impossible de géocoder : "${startAddress}"`);
  if (!endLoc) throw new Error(`Impossible de géocoder : "${endAddress}"`);

  const route = await getRoute(startLoc.coordinates, endLoc.coordinates);
  if (!route) throw new Error('Impossible de calculer un itinéraire entre ces deux points');

  const stopsPerDay = filters.stopsPerDay ?? 3;
  const totalStopsNeeded = days * stopsPerDay;

  const categories: AttractionCategory[] =
    filters.categories.length > 0
      ? filters.categories
      : ['interesting_places', 'historic', 'natural'];

  // Segment-based fetch: one small bbox per day, avoids large-bbox API limits
  let allAttractions = await fetchAttractionsBySegments(route.geometry, categories, days, stopsPerDay);

  // Proximity filter: 50km for short routes, 80km for long routes
  const proximityKm = route.distanceKm > 1000 ? 80 : 50;
  allAttractions = filterByProximityToRoute(allAttractions, route.geometry, proximityKm);

  if (filters.freePlacesOnly) {
    allAttractions = allAttractions.filter((a) => a.entryCost !== 'paid');
  }

  allAttractions = deduplicateAttractions(allAttractions, 10);
  allAttractions = sortByRouteProgress(allAttractions, route.geometry);

  console.log(`planTrip: ${allAttractions.length} attractions after filtering, need ${totalStopsNeeded}`);

  const selected = allAttractions.slice(0, totalStopsNeeded);
  const dayPlans = buildDayPlans([...selected], days, route.distanceKm, stopsPerDay);

  return {
    startLocation: startLoc,
    endLocation: endLoc,
    totalDays: days,
    days: dayPlans,
    totalDistanceKm: Math.round(route.distanceKm),
    routeGeometry: route.geometry,
  };
}
