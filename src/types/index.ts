export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodedLocation {
  name: string;
  displayName: string;
  coordinates: Coordinates;
}

export type AttractionCategory =
  | 'interesting_places'
  | 'historic'
  | 'natural'
  | 'architecture'
  | 'cultural';

export interface Attraction {
  id: string;
  name: string;
  description?: string;
  coordinates: Coordinates;
  categories: AttractionCategory[];
  imageUrl?: string;
  wikiUrl?: string;
  rating?: number;
  entryCost: 'free' | 'paid' | 'unknown';
  address?: string;
  distanceFromRoute?: number; // km
}

export interface TripStop {
  attraction: Attraction;
  driveTimeFromPrevious: number; // minutes
  distanceFromPrevious: number; // km
}

export interface DayPlan {
  day: number;
  stops: TripStop[];
  totalDriveTime: number; // minutes
  totalDistance: number; // km
}

export interface TripPlan {
  startLocation: GeocodedLocation;
  endLocation: GeocodedLocation;
  totalDays: number;
  days: DayPlan[];
  totalDistanceKm: number;
  routeGeometry: [number, number][];
}

export interface TripFilters {
  categories: AttractionCategory[];
  maxDailyDistanceKm: number;
  stopsPerDay: number;
  freePlacesOnly: boolean;
}

export interface PlanTripRequest {
  startAddress: string;
  endAddress: string;
  days: number;
  filters: TripFilters;
}
