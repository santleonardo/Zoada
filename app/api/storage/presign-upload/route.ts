import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getPresignedUploadUrl, getPublicUrl } from '@/lib/r2';
import { isR2Configured } from '@/lib/config';

// POST /api/storage/presign-upload
// Gera uma URL assinada de PUT para o navegador subir o arquivo DIRETO pro R2.
// Existe porque o Vercel limita o corpo de uma Serverless Function a ~4.5MB —
// arquivos de áudio maiores nunca chegariam vivos em /api/storage/upload.
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
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
    const key = `${safeFolder}/${userId}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}.${ext}`;

    const uploadUrl = await getPresignedUploadUrl(key, contentType);
    const publicUrl = getPublicUrl(key);

    return NextResponse.json({ uploadUrl, publicUrl, key }, { status: 201 });
  } catch (error) {
    console.error('[STORAGE PRESIGN-UPLOAD]', error);
    return NextResponse.json({ error: 'Erro ao gerar URL de upload' }, { status: 500 });
  }
}
