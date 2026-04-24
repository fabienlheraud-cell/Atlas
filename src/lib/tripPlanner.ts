import { Attraction, AttractionCategory, Coordinates, DayPlan, TripFilters, TripPlan, TripStop } from '@/types';
import { fetchAttractionsNear } from './opentripmap';
import { geocode } from './nominatim';
import { getRoute, sampleRoutePoints } from './openroute';

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

function deduplicateAttractions(attractions: Attraction[], minDistKm = 5): Attraction[] {
  const result: Attraction[] = [];
  for (const a of attractions) {
    const tooClose = result.some(
      (b) => haversineKm(a.coordinates, b.coordinates) < minDistKm
    );
    if (!tooClose) result.push(a);
  }
  return result;
}

// Project each attraction onto the route and compute its "progress" (0 to 1)
function getRouteProgress(
  coords: Coordinates,
  routePoints: [number, number][]
): number {
  let minDist = Infinity;
  let bestIndex = 0;

  for (let i = 0; i < routePoints.length; i++) {
    const d = haversineKm(coords, { lat: routePoints[i][0], lng: routePoints[i][1] });
    if (d < minDist) {
      minDist = d;
      bestIndex = i;
    }
  }

  return bestIndex / (routePoints.length - 1);
}

function buildDayPlans(
  orderedAttractions: Attraction[],
  days: number,
  totalDistanceKm: number,
  maxDailyDistanceKm: number
): DayPlan[] {
  const targetPerDay = Math.min(totalDistanceKm / days, maxDailyDistanceKm);
  const perDay = Math.max(1, Math.ceil(orderedAttractions.length / days));

  const dayPlans: DayPlan[] = [];
  let idx = 0;

  for (let day = 1; day <= days; day++) {
    const stops: TripStop[] = [];
    const slice = orderedAttractions.slice(idx, idx + perDay);
    idx += perDay;

    let prev: Coordinates | null = null;
    let dayDistance = 0;
    let dayTime = 0;

    for (const attraction of slice) {
      const dist = prev ? haversineKm(prev, attraction.coordinates) : 0;
      const time = (dist / targetPerDay) * 60 * (totalDistanceKm / days / 80); // rough estimate
      stops.push({
        attraction,
        distanceFromPrevious: Math.round(dist),
        driveTimeFromPrevious: Math.round(time),
      });
      dayDistance += dist;
      dayTime += time;
      prev = attraction.coordinates;
    }

    if (stops.length > 0) {
      dayPlans.push({
        day,
        stops,
        totalDistance: Math.round(dayDistance),
        totalDriveTime: Math.round(dayTime),
      });
    }
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

  // Sample ~1 point per 80km along the route
  const sampleCount = Math.max(3, Math.ceil(route.distanceKm / 80));
  const samplePoints = sampleRoutePoints(route.geometry, sampleCount);

  const categories: AttractionCategory[] =
    filters.categories.length > 0 ? filters.categories : ['interesting_places', 'historic', 'natural'];

  // Fetch attractions around each sample point (radius 30km)
  const attractionSets = await Promise.all(
    samplePoints.map((p) =>
      fetchAttractionsNear({ lat: p[0], lng: p[1] }, 30000, categories, 15)
    )
  );

  let allAttractions = attractionSets.flat();

  if (filters.freePlacesOnly) {
    allAttractions = allAttractions.filter((a) => a.entryCost !== 'paid');
  }

  allAttractions = deduplicateAttractions(allAttractions, 8);

  // Sort attractions by their position along the route
  allAttractions.sort(
    (a, b) =>
      getRouteProgress(a.coordinates, route.geometry) -
      getRouteProgress(b.coordinates, route.geometry)
  );

  const maxAttractionsPerDay = 4;
  const maxAttractions = days * maxAttractionsPerDay;
  const selected = allAttractions.slice(0, maxAttractions);

  const dayPlans = buildDayPlans(
    selected,
    days,
    route.distanceKm,
    filters.maxDailyDistanceKm || 400
  );

  return {
    startLocation: startLoc,
    endLocation: endLoc,
    totalDays: days,
    days: dayPlans,
    totalDistanceKm: Math.round(route.distanceKm),
    routeGeometry: route.geometry,
  };
}
