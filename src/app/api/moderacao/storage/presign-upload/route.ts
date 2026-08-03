import { NextResponse } from 'next/server';
import { MODERATION_SECRET, isR2Configured } from '@/lib/config';
import { getPresignedUploadUrl, getPublicUrl } from '@/lib/r2';

// POST /api/moderacao/storage/presign-upload
// Igual a /api/storage/presign-upload, mas autenticado via
// MODERATION_SECRET em vez de JWT de usuário. Usado pelo painel de
// moderação pra gerar URLs de upload direto pro R2.
export async function POST(request: Request) {
  try {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${MODERATION_SECRET}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isR2Configured) {
      return NextResponse.json(
        { error: 'R2 não configurado. Defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY no .env' },
        { status: 503 }
      );
    }

    const { filename, contentType, folder } = await request.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'filename e contentType são obrigatórios' }, { status: 400 });
    }

    const safeFolder = (folder as string) || 'uploads';
    const ext = filename.split('.').pop() || 'bin';
    const key = `${safeFolder}/moderacao/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}.${ext}`;

    const uploadUrl = await getPresignedUploadUrl(key, contentType);
    const publicUrl = getPublicUrl(key);

    return NextResponse.json({ uploadUrl, publicUrl, key }, { status: 201 });
  } catch (error) {
    console.error('[MODERACAO STORAGE PRESIGN-UPLOAD]', error);
    return NextResponse.json({ error: 'Erro ao gerar URL de upload' }, { status: 500 });
  }
}
