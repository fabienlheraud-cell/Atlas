import { Attraction, AttractionCategory, Coordinates, DayPlan, TripFilters, TripPlan, TripStop } from '@/types';
import { fetchAttractionsByBbox } from './opentripmap';
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

// Keep only attractions within maxDistKm of the route geometry
function filterByProximityToRoute(
  attractions: Attraction[],
  routePoints: [number, number][],
  maxDistKm = 40
): Attraction[] {
  return attractions.filter((a) => {
    const minDist = Math.min(
      ...routePoints.map((p) =>
        haversineKm(a.coordinates, { lat: p[0], lng: p[1] })
      )
    );
    return minDist <= maxDistKm;
  });
}

function deduplicateAttractions(attractions: Attraction[], minDistKm = 10): Attraction[] {
  const result: Attraction[] = [];
  for (const a of attractions) {
    const tooClose = result.some(
      (b) => haversineKm(a.coordinates, b.coordinates) < minDistKm
    );
    if (!tooClose) result.push(a);
  }
  return result;
}

// Sort attractions by position along the route (A → B order)
function sortByRouteProgress(
  attractions: Attraction[],
  routePoints: [number, number][]
): Attraction[] {
  return [...attractions].sort((a, b) => {
    const progressA = bestRouteIndex(a.coordinates, routePoints);
    const progressB = bestRouteIndex(b.coordinates, routePoints);
    return progressA - progressB;
  });
}

function bestRouteIndex(coords: Coordinates, routePoints: [number, number][]): number {
  let minDist = Infinity;
  let bestIndex = 0;
  for (let i = 0; i < routePoints.length; i++) {
    const d = haversineKm(coords, { lat: routePoints[i][0], lng: routePoints[i][1] });
    if (d < minDist) { minDist = d; bestIndex = i; }
  }
  return bestIndex;
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

  // One bbox call to fetch all candidates along the route
  let allAttractions = await fetchAttractionsByBbox(route.geometry, categories, totalStopsNeeded);

  // Filter to attractions actually close to the route
  allAttractions = filterByProximityToRoute(allAttractions, route.geometry, 40);

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
