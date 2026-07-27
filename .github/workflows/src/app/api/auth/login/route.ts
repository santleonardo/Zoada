import { NextResponse } from 'next/server';

// POST /api/auth/login
// Login with email/password — delegates to Supabase Auth
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    // TODO: Replace with real Supabase Auth
    // const supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
    // const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    // if (error) return NextResponse.json({ error: error.message }, { status: 401 });
    // return NextResponse.json({ user: data.user, session: data.session });

    return NextResponse.json({
      message: 'Supabase não configurado. Use o demo login.',
    });
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
