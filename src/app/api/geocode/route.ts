import { NextRequest, NextResponse } from 'next/server';
import { geocode } from '@/lib/nominatim';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  if (!q) return NextResponse.json({ error: 'q is required' }, { status: 400 });

  const result = await geocode(q);
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(result);
}
