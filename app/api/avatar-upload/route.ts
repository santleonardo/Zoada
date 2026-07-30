import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { isR2Configured } from '@/lib/config';
import { uploadToR2 } from '@/lib/r2';
import crypto from 'crypto';

// POST /api/avatar-upload
// Faz upload de uma foto de perfil.
// - Se R2 estiver configurado: envia pro R2 e retorna a URL pública.
// - Se não: salva localmente em public/avatars/ e retorna /avatars/filename.
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido. Use JPG, PNG, GIF ou WebP.' },
        { status: 400 }
      );
    }

    // Validar tamanho (5MB máximo para avatares)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Imagem muito grande (máx 5MB)' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
    const filename = `${userId}-${crypto.randomBytes(8).toString('hex')}.${safeExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    if (isR2Configured) {
      // Upload para R2
      const key = `avatars/${userId}/${filename}`;
      const publicUrl = await uploadToR2(key, buffer, file.type);
      return NextResponse.json({ url: publicUrl, key });
    }

    // Fallback local: salva em public/avatars/
    const avatarsDir = join(process.cwd(), 'public', 'avatars');
    await mkdir(avatarsDir, { recursive: true });
    const filePath = join(avatarsDir, filename);
    await writeFile(filePath, buffer);

    const publicUrl = `/avatars/${filename}`;
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('[AVATAR UPLOAD]', error);
    return NextResponse.json({ error: 'Erro ao fazer upload do avatar' }, { status: 500 });
  }
}
