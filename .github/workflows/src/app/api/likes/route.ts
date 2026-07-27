import { NextResponse } from 'next/server';

// GET /api/likes?track_id=xxx&user_id=xxx
// POST /api/likes { user_id, track_id }
// DELETE /api/likes?id=xxx

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get('track_id');
  const userId = searchParams.get('user_id');

  // TODO: Replace with Supabase query
  // const supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
  // let query = supabase.from('curtidas').select('*');
  // if (trackId) query = query.eq('track_id', trackId);
  // if (userId) query = query.eq('user_id', userId);
  // const { data } = await query;

  return NextResponse.json({ likes: [], message: 'Supabase não configurado' });
}

export async function POST(request: Request) {
  const { user_id, track_id } = await request.json();

  if (!user_id || !track_id) {
    return NextResponse.json({ error: 'user_id e track_id são obrigatórios' }, { status: 400 });
  }

  // TODO: Replace with Supabase insert
  // const supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
  // const { data, error } = await supabase.from('curtidas').insert({ user_id, track_id }).select().single();

  return NextResponse.json({ message: 'Supabase não configurado' });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  // TODO: Replace with Supabase delete
  // const supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
  // await supabase.from('curtidas').delete().eq('id', id);

  return NextResponse.json({ message: 'Supabase não configurado' });
}
