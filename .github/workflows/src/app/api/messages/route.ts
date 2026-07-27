import { NextResponse } from 'next/server';
import { DEMO_CONVERSATIONS, DEMO_MESSAGES } from '@/lib/demo-data';

// GET /api/messages?conversation_id=xxx
// POST /api/messages { sender_id, receiver_id, content }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversation_id');

  if (!conversationId) {
    // Return conversations list
    return NextResponse.json({ conversations: DEMO_CONVERSATIONS });
  }

  const messages = DEMO_MESSAGES[conversationId] || [];

  // TODO: Replace with Supabase queries
  // const supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
  // const { data } = await supabase.from('mensagens').select('*, sender:usuarios!sender_id(*)').eq('conversation_id', conversationId).order('created_at', { ascending: true });

  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  const { sender_id, receiver_id, content } = await request.json();

  if (!sender_id || !receiver_id || !content) {
    return NextResponse.json(
      { error: 'sender_id, receiver_id e content são obrigatórios' },
      { status: 400 }
    );
  }

  // TODO: Replace with Supabase insert
  // const supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
  // const { data } = await supabase.from('mensagens').insert({ sender_id, receiver_id, content }).select('*, sender:usuarios!sender_id(*)').single();

  return NextResponse.json({ message: 'Supabase não configurado' });
}
