import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { deleteFromR2 } from '@/lib/r2';
import { isR2Configured } from '@/lib/config';

// DELETE /api/storage/delete?key=xxx
// Delete a file from Cloudflare R2
export async function DELETE(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'key é obrigatório' }, { status: 400 });
    }

    if (!isR2Configured) {
      return NextResponse.json({ error: 'R2 não configurado' }, { status: 503 });
    }

    // Verify user owns this file
    if (!key.includes(userId)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    await deleteFromR2(key);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[STORAGE DELETE]', error);
    return NextResponse.json({ error: 'Erro ao deletar arquivo' }, { status: 500 });
  }
}
