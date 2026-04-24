'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TripPlan } from '@/types';

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const startIcon = new L.DivIcon({
  html: '<div style="background:#22c55e;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.4)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  className: '',
});

const endIcon = new L.DivIcon({
  html: '<div style="background:#ef4444;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.4)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  className: '',
});

function makeStopIcon(day: number) {
  return new L.DivIcon({
    html: `<div style="background:#f59e0b;color:white;width:26px;height:26px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold">${day}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    className: '',
  });
}

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, bounds]);
  return null;
}

interface Props {
  trip: TripPlan;
}

export default function MapView({ trip }: Props) {
  const allCoords: [number, number][] = [
    [trip.startLocation.coordinates.lat, trip.startLocation.coordinates.lng],
    ...trip.days.flatMap((d) =>
      d.stops.map((s): [number, number] => [s.attraction.coordinates.lat, s.attraction.coordinates.lng])
    ),
    [trip.endLocation.coordinates.lat, trip.endLocation.coordinates.lng],
  ];

  const bounds = L.latLngBounds(allCoords);

  return (
    <MapContainer
      center={[trip.startLocation.coordinates.lat, trip.startLocation.coordinates.lng]}
      zoom={6}
      scrollWheelZoom
      style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds bounds={bounds} />

      {/* Route polyline */}
      {trip.routeGeometry.length > 0 && (
        <Polyline
          positions={trip.routeGeometry}
          pathOptions={{ color: '#f59e0b', weight: 4, opacity: 0.7 }}
        />
      )}

      {/* Start */}
      <Marker position={[trip.startLocation.coordinates.lat, trip.startLocation.coordinates.lng]} icon={startIcon}>
        <Popup>
          <strong>Départ</strong><br />{trip.startLocation.displayName}
        </Popup>
      </Marker>

      {/* End */}
      <Marker position={[trip.endLocation.coordinates.lat, trip.endLocation.coordinates.lng]} icon={endIcon}>
        <Popup>
          <strong>Arrivée</strong><br />{trip.endLocation.displayName}
        </Popup>
      </Marker>

      {/* Stops */}
      {trip.days.map((day) =>
        day.stops.map((stop) => (
          <Marker
            key={stop.attraction.id}
            position={[stop.attraction.coordinates.lat, stop.attraction.coordinates.lng]}
            icon={makeStopIcon(day.day)}
          >
            <Popup>
              <strong>{stop.attraction.name}</strong>
              {stop.attraction.description && (
                <p className="text-xs mt-1">{stop.attraction.description.slice(0, 120)}…</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Jour {day.day}</p>
            </Popup>
          </Marker>
        ))
      )}
    </MapContainer>
  );
}
