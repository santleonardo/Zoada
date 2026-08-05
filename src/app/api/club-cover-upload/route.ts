import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { isR2Configured, isNeonConfigured } from '@/lib/config';
import { uploadToR2 } from '@/lib/r2';
import { db } from '@/lib/db';
import crypto from 'crypto';

// POST /api/club-cover-upload
// Faz upload da foto de capa de um clube. Só o admin do clube pode trocar
// a capa — o form precisa vir com `file` e `club_id`.
// - Se R2 estiver configurado: envia pro R2 e retorna a URL pública.
// - Se não: salva localmente em public/clubs/ e retorna /clubs/filename.
export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const clubId = formData.get('club_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }
    if (!clubId) {
      return NextResponse.json({ error: 'club_id é obrigatório' }, { status: 400 });
    }

    if (isNeonConfigured) {
      const meuVinculo = await db.membroClube.findUnique({
        where: { clubeId_usuarioId: { clubeId: clubId, usuarioId: userId } },
      });
      if (!meuVinculo || meuVinculo.papel !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Só o admin do clube pode trocar a capa' },
          { status: 403 }
        );
      }
    }

    // Mesma validação de tipo do avatar-upload — SVG fica de fora de
    // propósito (formato de texto/XML que pode conter <script> embutido).
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido. Use JPG, PNG, GIF ou WebP.' },
        { status: 400 }
      );
    }

    // Validar tamanho (5MB máximo)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Imagem muito grande (máx 5MB)' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
    const filename = `${clubId}-${crypto.randomBytes(8).toString('hex')}.${safeExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    if (isR2Configured) {
      // Upload para R2
      const key = `clubs/${clubId}/${filename}`;
      const publicUrl = await uploadToR2(key, buffer, file.type);
      return NextResponse.json({ url: publicUrl, key });
    }

    // Fallback local: salva em public/clubs/
    const clubsDir = join(process.cwd(), 'public', 'clubs');
    await mkdir(clubsDir, { recursive: true });
    const filePath = join(clubsDir, filename);
    await writeFile(filePath, buffer);

    const publicUrl = `/clubs/${filename}`;
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('[CLUB COVER UPLOAD]', error);
    return NextResponse.json({ error: 'Erro ao fazer upload da capa' }, { status: 500 });
  }
}
