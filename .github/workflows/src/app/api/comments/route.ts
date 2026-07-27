import { NextResponse } from 'next/server';
import { DEMO_COMMENTS } from '@/lib/demo-data';

// GET /api/comments?track_id=xxx
// POST /api/comments { user_id, track_id, content }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get('track_id');

  if (!trackId) {
    return NextResponse.json({ error: 'track_id é obrigatório' }, { status: 400 });
  }

  const comments = DEMO_COMMENTS.filter((c) => c.track_id === trackId);

  // TODO: Replace with Supabase query
  // const supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
  // const { data } = await supabase.from('comentarios').select('*, user:usuarios(*)').eq('track_id', trackId).order('created_at', { ascending: true });

  return NextResponse.json({ comments });
}

export async function POST(request: Request) {
  const { user_id, track_id, content } = await request.json();

  if (!user_id || !track_id || !content) {
    return NextResponse.json({ error: 'user_id, track_id e content são obrigatórios' }, { status: 400 });
  }

  // TODO: Replace with Supabase insert
  // const supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
  // const { data } = await supabase.from('comentarios').insert({ user_id, track_id, content }).select('*, user:usuarios(*)').single();

  return NextResponse.json({ message: 'Supabase não configurado' });
}
