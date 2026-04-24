import TripForm from '@/components/TripForm';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-amber-900 text-white py-20 px-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 rounded-full px-4 py-1.5 text-amber-300 text-sm font-medium mb-2">
            🌎 Canada & Amérique du Nord
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Découvrez les routes
            <span className="text-amber-400"> extraordinaires</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Générez un road trip optimisé avec des lieux insolites, cachés et fascinants.
            Loin des sentiers battus, loin du tourisme de masse.
          </p>
        </div>

        {/* Decorative road */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-60" />
      </div>

      {/* Form section */}
      <div className="flex-1 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 -mt-8 pb-16">
          <TripForm />
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white py-16 px-4 border-t border-gray-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-10">
            Comment ça marche ?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                emoji: '📍',
                title: 'Définis ton trajet',
                desc: 'Entre ton point de départ, ton arrivée et la durée de ton voyage.',
              },
              {
                emoji: '🔍',
                title: 'Atlas explore pour toi',
                desc: 'On scanne des milliers de lieux insolites le long de ta route.',
              },
              {
                emoji: '🗺️',
                title: 'Pars à l\'aventure',
                desc: 'Reçois un itinéraire optimisé jour par jour. Partage-le d\'un clic.',
              },
            ].map((step) => (
              <div key={step.title} className="text-center space-y-3">
                <div className="text-5xl">{step.emoji}</div>
                <h3 className="font-bold text-gray-800 text-lg">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 text-center py-6 text-sm">
        <p>Atlas — Données : OpenTripMap · OpenStreetMap · Wikidata · OpenRouteService</p>
      </footer>
    </div>
  );
}
