'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AttractionCategory, TripFilters } from '@/types';

const CATEGORIES: { id: AttractionCategory; label: string; emoji: string }[] = [
  { id: 'interesting_places', label: 'Lieux insolites', emoji: '✨' },
  { id: 'historic', label: 'Sites historiques', emoji: '🏛️' },
  { id: 'natural', label: 'Nature & paysages', emoji: '🌲' },
  { id: 'architecture', label: 'Architecture', emoji: '🏗️' },
  { id: 'cultural', label: 'Culture & art', emoji: '🎨' },
];

export default function TripForm() {
  const router = useRouter();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [days, setDays] = useState(3);
  const [categories, setCategories] = useState<AttractionCategory[]>(['interesting_places', 'historic', 'natural']);
  const [maxDaily, setMaxDaily] = useState(350);
  const [freeOnly, setFreeOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const filters: TripFilters = {
      categories,
      maxDailyDistanceKm: maxDaily,
      freePlacesOnly: freeOnly,
    };

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startAddress: start, endAddress: end, days, filters }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Une erreur est survenue');
        return;
      }

      // Store trip in sessionStorage and redirect
      sessionStorage.setItem('currentTrip', JSON.stringify(data));

      const params = new URLSearchParams({
        start: encodeURIComponent(start),
        end: encodeURIComponent(end),
        days: days.toString(),
        cats: categories.join(','),
        maxDist: maxDaily.toString(),
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
    <form
      onSubmit={handleSubmit}
      className="w-full bg-white rounded-2xl shadow-2xl p-8 space-y-6"
    >
      {/* Locations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Départ</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🚗</span>
            <input
              type="text"
              value={start}
              onChange={(e) => setStart(e.target.value)}
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
              placeholder="ex. Toronto, ON"
              required
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-800 placeholder-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Days */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-semibold text-gray-700">Durée du voyage</label>
          <span className="text-amber-600 font-bold text-lg">{days} jour{days > 1 ? 's' : ''}</span>
        </div>
        <input
          type="range"
          min={1}
          max={21}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>1 jour</span>
          <span>21 jours</span>
        </div>
      </div>

      {/* Categories */}
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

      {/* Advanced */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-gray-700">Distance max/jour</label>
            <span className="text-amber-600 font-bold">{maxDaily} km</span>
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
        </div>
        <div className="flex items-center gap-3 mt-4">
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
          <>
            <span className="animate-spin">⟳</span>
            Génération en cours…
          </>
        ) : (
          <>
            🗺️ Générer mon road trip
          </>
        )}
      </button>
    </form>
  );
}
