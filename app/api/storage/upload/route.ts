import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { uploadToR2, getPresignedUrl, getPublicUrl } from '@/lib/r2';
import { isR2Configured } from '@/lib/config';

// POST /api/storage/upload
// Upload a file to Cloudflare R2 (multipart/form-data)
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!isR2Configured) {
      return NextResponse.json({ error: 'R2 não configurado. Defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY no .env' }, { status: 503 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Arquivo muito grande (máx 50MB)' }, { status: 400 });
    }

    // Generate key with user folder and timestamp
    const ext = file.name.split('.').pop() || 'bin';
    const key = `${folder}/${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}.${ext}`;

    // Upload to R2
    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await uploadToR2(key, buffer, file.type);

    return NextResponse.json({
      key,
      url: publicUrl,
      name: file.name,
      size: file.size,
      type: file.type,
    }, { status: 201 });
  } catch (error) {
    console.error('[STORAGE UPLOAD]', error);
    return NextResponse.json({ error: 'Erro ao fazer upload' }, { status: 500 });
  }
}

// GET /api/storage/presign?key=xxx&expires=3600
// Generate a presigned URL for private files
export async function GET(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const expires = parseInt(searchParams.get('expires') || '3600', 10);

    if (!key) {
      return NextResponse.json({ error: 'key é obrigatório' }, { status: 400 });
    }

    if (!isR2Configured) {
      return NextResponse.json({ error: 'R2 não configurado' }, { status: 503 });
    }

    // Verify user has access to this key (must contain their userId in path)
    if (!key.includes(userId)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const presignedUrl = await getPresignedUrl(key, expires);

    return NextResponse.json({ url: presignedUrl, expiresIn: expires });
  } catch (error) {
    console.error('[STORAGE PRESIGN]', error);
    return NextResponse.json({ error: 'Erro ao gerar URL assinada' }, { status: 500 });
  }
}
