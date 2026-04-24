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
  stopsPerDay: number
): DayPlan[] {
  const avgDailyDistanceKm = Math.round(totalDistanceKm / days);
  // Average driving speed for estimation
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
      stops.push({
        attraction,
        distanceFromPrevious: dist,
        driveTimeFromPrevious: time,
      });
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

  // Sample ~1 point per 60km along the route
  const sampleCount = Math.max(4, Math.ceil(route.distanceKm / 60));
  const samplePoints = sampleRoutePoints(route.geometry, sampleCount);

  const categories: AttractionCategory[] =
    filters.categories.length > 0 ? filters.categories : ['interesting_places', 'historic', 'natural'];

  // Fetch attractions around each sample point (radius 35km)
  const attractionSets = await Promise.all(
    samplePoints.map((p) =>
      fetchAttractionsNear({ lat: p[0], lng: p[1] }, 35000, categories, 20)
    )
  );

  let allAttractions = attractionSets.flat();

  if (filters.freePlacesOnly) {
    allAttractions = allAttractions.filter((a) => a.entryCost !== 'paid');
  }

  // Deduplicate (min 10km between attractions)
  allAttractions = deduplicateAttractions(allAttractions, 10);

  // Sort by position along the route
  allAttractions.sort(
    (a, b) =>
      getRouteProgress(a.coordinates, route.geometry) -
      getRouteProgress(b.coordinates, route.geometry)
  );

  // Take only what we need
  const selected = allAttractions.slice(0, totalStopsNeeded);

  // buildDayPlans mutates selected via splice — pass a copy
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
