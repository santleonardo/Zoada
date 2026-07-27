import { NextResponse } from 'next/server';
import { DEMO_TRACKS } from '@/lib/demo-data';

// GET /api/tracks
// Return all tracks (or filtered by artist)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const artistId = searchParams.get('artist_id');

  let tracks = DEMO_TRACKS;

  if (artistId) {
    tracks = tracks.filter((t) => t.artist_id === artistId);
  }

  return NextResponse.json({ tracks });
}
