import { DayPlan } from '@/types';

interface Props {
  day: DayPlan;
}

export default function DayItinerary({ day }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
          {day.day}
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Jour {day.day}</h3>
          <p className="text-xs text-gray-400">
            {day.stops.length} arrêt{day.stops.length > 1 ? 's' : ''} · ~{day.totalDistance} km · ~{day.totalDriveTime} min de route
          </p>
        </div>
      </div>

      <div className="ml-4 border-l-2 border-amber-200 pl-4 space-y-4">
        {day.stops.map((stop, i) => (
          <div key={stop.attraction.id} className="relative">
            <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-white" />

            {i > 0 && (
              <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                🚗 {stop.distanceFromPrevious} km · {stop.driveTimeFromPrevious} min
              </div>
            )}

            <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex gap-3">
                {stop.attraction.imageUrl && (
                  <img
                    src={stop.attraction.imageUrl}
                    alt={stop.attraction.name}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-800 text-sm leading-tight">
                    {stop.attraction.name}
                  </h4>
                  {stop.attraction.address && (
                    <p className="text-xs text-gray-400 mt-0.5">{stop.attraction.address}</p>
                  )}
                  {stop.attraction.description && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {stop.attraction.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {stop.attraction.categories.slice(0, 2).map((cat) => (
                      <span
                        key={cat}
                        className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5"
                      >
                        {cat.replace('_', ' ')}
                      </span>
                    ))}
                    {stop.attraction.wikiUrl && (
                      <a
                        href={stop.attraction.wikiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-500 hover:underline"
                      >
                        Wikipedia →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
