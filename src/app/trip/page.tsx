'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { TripPlan, TripFilters, AttractionCategory } from '@/types';
import DayItinerary from '@/components/DayItinerary';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl">
      <span className="text-gray-400 text-sm animate-pulse">Chargement de la carte…</span>
    </div>
  ),
});

function TripPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [trip, setTrip] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTrip = useCallback(async () => {
    // Try sessionStorage first (fresh from form)
    const cached = sessionStorage.getItem('currentTrip');
    if (cached) {
      try {
        setTrip(JSON.parse(cached));
        setLoading(false);
        return;
      } catch {
        sessionStorage.removeItem('currentTrip');
      }
    }

    // Recompute from URL params (shared link)
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const days = searchParams.get('days');

    if (!start || !end || !days) {
      router.push('/');
      return;
    }

    const cats = (searchParams.get('cats') || 'interesting_places,historic,natural').split(',') as AttractionCategory[];
    const maxDist = Number(searchParams.get('maxDist') || '350');
    const freeOnly = searchParams.get('free') === '1';

    const filters: TripFilters = {
      categories: cats,
      maxDailyDistanceKm: maxDist,
      freePlacesOnly: freeOnly,
    };

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAddress: decodeURIComponent(start),
          endAddress: decodeURIComponent(end),
          days: Number(days),
          filters,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la génération');
      } else {
        setTrip(data);
      }
    } catch {
      setError('Impossible de charger le trip. Vérifie ta connexion.');
    } finally {
      setLoading(false);
    }
  }, [searchParams, router]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  async function handleShare() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50">
        <div className="text-6xl animate-bounce">🗺️</div>
        <div className="text-center space-y-2">
          <p className="text-xl font-bold text-gray-800">Exploration en cours…</p>
          <p className="text-gray-500 text-sm">On cherche les lieux insolites le long de ta route</p>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <div className="text-5xl">😕</div>
        <h1 className="text-xl font-bold text-gray-800">Une erreur est survenue</h1>
        <p className="text-gray-500 text-sm text-center max-w-sm">{error}</p>
        <Link
          href="/"
          className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-medium transition-colors"
        >
          ← Retour
        </Link>
      </div>
    );
  }

  if (!trip) return null;

  const totalStops = trip.days.reduce((sum, d) => sum + d.stops.length, 0);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-700 transition-colors text-sm font-medium">
              ← Atlas
            </Link>
            <div className="h-4 w-px bg-gray-200" />
            <div>
              <h1 className="font-bold text-gray-800 text-sm leading-tight">
                {trip.startLocation.name} → {trip.endLocation.name}
              </h1>
              <p className="text-xs text-gray-400">
                {trip.totalDays} jour{trip.totalDays > 1 ? 's' : ''} · {trip.totalDistanceKm} km · {totalStops} arrêts
              </p>
            </div>
          </div>

          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-full transition-colors"
          >
            {copied ? '✅ Copié !' : '🔗 Partager'}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6 h-full">
          {/* Itinerary sidebar */}
          <aside className="lg:w-96 flex-shrink-0 space-y-6 overflow-y-auto max-h-[calc(100vh-120px)]">
            {trip.days.map((day) => (
              <DayItinerary key={day.day} day={day} />
            ))}

            {totalStops === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                <p className="text-2xl mb-2">🔍</p>
                Aucun lieu trouvé sur ce trajet.
                <br />Essaie d'autres filtres ou un itinéraire différent.
              </div>
            )}
          </aside>

          {/* Map */}
          <div className="flex-1 min-h-[450px] lg:min-h-0 lg:h-[calc(100vh-120px)] sticky top-[72px]">
            <MapView trip={trip} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TripPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50">
          <div className="text-6xl animate-bounce">🗺️</div>
          <p className="text-xl font-bold text-gray-800">Chargement…</p>
        </div>
      }
    >
      <TripPage />
    </Suspense>
  );
}
