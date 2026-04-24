import { NextRequest, NextResponse } from 'next/server';
import { planTrip } from '@/lib/tripPlanner';
import { PlanTripRequest } from '@/types';

export const runtime = 'edge';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body: PlanTripRequest = await req.json();
    const { startAddress, endAddress, days, filters } = body;

    if (!startAddress || !endAddress) {
      return NextResponse.json({ error: 'Les adresses de départ et d\'arrivée sont requises' }, { status: 400 });
    }

    if (!days || days < 1 || days > 30) {
      return NextResponse.json({ error: 'Le nombre de jours doit être entre 1 et 30' }, { status: 400 });
    }

    const trip = await planTrip(startAddress, endAddress, days, filters);
    return NextResponse.json(trip);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
