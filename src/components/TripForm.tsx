'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AttractionCategory, TripFilters } from '@/types';

const CATEGORIES: { id: AttractionCategory; label: string; emoji: string }[] = [
  { id: 'interesting_places', label: 'Lieux insolites', emoji: '✨' },
  { id: 'historic', label: 'Sites historiques', emoji: '🏛️' },
  { id: 'natural', label: 'Nature & paysages', emoji: '🌲' },
  { id: 'architecture', label: 'Architecture', emoji: '🏗️' },
  { id: 'cultural', label: 'Culture & art', emoji: '🎨' },
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export default function TripForm() {
  const router = useRouter();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [estimatedKm, setEstimatedKm] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [maxDaily, setMaxDaily] = useState(350);
  const [kmBetweenStops, setKmBetweenStops] = useState(100);
  const [categories, setCategories] = useState<AttractionCategory[]>(['interesting_places', 'historic', 'natural']);
  const [freeOnly, setFreeOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dérivés automatiquement
  const days = estimatedKm ? Math.max(1, Math.ceil(estimatedKm / maxDaily)) : null;
  const stopsPerDay = Math.max(1, Math.floor(maxDaily / kmBetweenStops));

  const estimateDistance = useCallback(async (startVal: string, endVal: string) => {
    if (!startVal.trim() || !endVal.trim()) return;
    setEstimating(true);
    setEstimatedKm(null);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/geocode?q=${encodeURIComponent(startVal)}`).then((r) => r.json()),
        fetch(`/api/geocode?q=${encodeURIComponent(endVal)}`).then((r) => r.json()),
      ]);
      if (r1.coordinates && r2.coordinates) {
        const straight = haversineKm(
          r1.coordinates.lat, r1.coordinates.lng,
          r2.coordinates.lat, r2.coordinates.lng
        );
        setEstimatedKm(Math.round(straight * 1.25));
      }
    } catch { /* silently ignore */ }
    setEstimating(false);
  }, []);

  function toggleCategory(cat: AttractionCategory) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!start.trim() || !end.trim()) return;

    setLoading(true);
    setError(null);

    const tripDays = days ?? Math.max(1, Math.ceil((estimatedKm ?? 500) / maxDaily));

    const filters: TripFilters = {
      categories,
      maxDailyDistanceKm: maxDaily,
      stopsPerDay,
      freePlacesOnly: freeOnly,
    };

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startAddress: start, endAddress: end, days: tripDays, filters }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Une erreur est survenue');
        return;
      }

      sessionStorage.setItem('currentTrip', JSON.stringify(data));

      const params = new URLSearchParams({
        start: encodeURIComponent(start),
        end: encodeURIComponent(end),
        days: tripDays.toString(),
        cats: categories.join(','),
        maxDist: maxDaily.toString(),
        stops: stopsPerDay.toString(),
        kmStop: kmBetweenStops.toString(),
        free: freeOnly ? '1' : '0',
      });

      router.push(`/trip?${params}`);
    } catch {
      setError('Impossible de contacter le serveur. Vérifie ta connexion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full bg-white rounded-2xl shadow-2xl p-8 space-y-6">

      {/* Villes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Départ</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🚗</span>
            <input
              type="text"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              onBlur={() => estimateDistance(start, end)}
              placeholder="ex. Montréal, QC"
              required
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-800 placeholder-gray-400"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Arrivée</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🏁</span>
            <input
              type="text"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              onBlur={() => estimateDistance(start, end)}
              placeholder="ex. Toronto, ON"
              required
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-800 placeholder-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Distance estimée */}
      {(estimating || estimatedKm) && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-xl">📏</span>
          {estimating ? (
            <span className="text-sm text-amber-700 animate-pulse">Calcul de la distance…</span>
          ) : estimatedKm ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="font-bold text-amber-700">~{estimatedKm.toLocaleString()} km</span>
              {days && (
                <span className="text-gray-600">
                  → <span className="font-semibold text-gray-800">{days} jour{days > 1 ? 's' : ''}</span> de voyage
                </span>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Distance max/jour → détermine le nombre de jours */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-semibold text-gray-700">Distance max par jour</label>
          <div className="text-right">
            <span className="text-amber-600 font-bold">{maxDaily} km/jour</span>
            {days && (
              <span className="text-xs text-gray-400 block">
                = {days} jour{days > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <input
          type="range"
          min={100}
          max={700}
          step={50}
          value={maxDaily}
          onChange={(e) => setMaxDaily(Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>100 km/jour</span>
          <span>700 km/jour</span>
        </div>
      </div>

      {/* Fréquence des arrêts */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-semibold text-gray-700">Un arrêt tous les</label>
          <div className="text-right">
            <span className="text-amber-600 font-bold">{kmBetweenStops} km</span>
            <span className="text-xs text-gray-400 block">
              = {stopsPerDay} arrêt{stopsPerDay > 1 ? 's' : ''}/jour
            </span>
          </div>
        </div>
        <input
          type="range"
          min={50}
          max={300}
          step={25}
          value={kmBetweenStops}
          onChange={(e) => setKmBetweenStops(Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>50 km (fréquent)</span>
          <span>300 km (espacé)</span>
        </div>
      </div>

      {/* Types de lieux */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">Types de lieux</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggleCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                categories.includes(cat.id)
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-amber-400'
              }`}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Entrée gratuite */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="freeOnly"
          checked={freeOnly}
          onChange={(e) => setFreeOnly(e.target.checked)}
          className="w-4 h-4 accent-amber-500"
        />
        <label htmlFor="freeOnly" className="text-sm font-semibold text-gray-700 cursor-pointer">
          Entrée gratuite uniquement
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !start.trim() || !end.trim()}
        className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-bold text-lg rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <><span className="animate-spin">⟳</span> Génération en cours…</>
        ) : (
          <>🗺️ Générer mon road trip</>
        )}
      </button>
    </form>
  );
}
