import { apiFetch, getAuthToken } from '@/lib/api';

// ============================================================
// Upload de músicas: pega o arquivo de áudio, sobe pro R2
// (via /api/storage/upload) e cria a faixa no banco
// (via /api/tracks), associada a um "artista" que representa
// o usuário logado.
// ============================================================

/**
 * DIAGNÓSTICO TEMPORÁRIO: sobe o arquivo passando pelo próprio servidor
 * (/api/storage/upload) em vez de ir direto pro R2. Serve pra descobrir
 * o erro real que o R2 devolve, já que erros direto no navegador ficam
 * escondidos atrás de CORS. Depois de resolver o 403, isso pode ser
 * removido e voltar a usar uploadFileDirectToR2 pra tudo (o upload
 * direto é necessário pra músicas grandes, por causa do limite de ~4.5MB
 * do corpo de uma Serverless Function na Vercel).
 */
async function uploadFileViaServer(file: File, folder: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const res = await apiFetch('/api/storage/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Falha ao enviar o arquivo (status ${res.status})`);
  }

  const data = await res.json();
  return data.url as string;
}

/** Lê a duração real do arquivo de áudio no navegador, sem precisar subir nada. */
export function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';

    const cleanup = () => URL.revokeObjectURL(url);

    audio.onloadedmetadata = () => {
      const duration = isFinite(audio.duration) ? Math.round(audio.duration) : 0;
      cleanup();
      resolve(duration);
    };
    audio.onerror = () => {
      cleanup();
      resolve(0);
    };

    audio.src = url;
  });
}

export interface ArtistProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string;
  genre: string;
}

/**
 * Lista TODOS os artistas do usuário logado (uma conta pode ter vários —
 * ex: alguém populando o catálogo com diferentes artistas fictícios).
 */
export async function listMyArtists(): Promise<ArtistProfile[]> {
  const res = await apiFetch('/api/artists?mine=1');
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Você precisa estar logado com uma conta real para enviar músicas.');
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Não foi possível carregar seus artistas');
  }
  const data = await res.json();
  return (data.artists || []) as ArtistProfile[];
}

/**
 * Cria um artista NOVO (sempre um registro novo — nunca reaproveita um já
 * existente). É isso que garante que subir música como "Jamba Jô" não
 * reescreve o "Rick Tropical" que você já tinha criado antes: cada nome
 * novo vira seu próprio artista, com seu próprio id e foto.
 */
export async function createArtist(fields: {
  nome: string;
  genero?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
}): Promise<ArtistProfile> {
  const res = await apiFetch('/api/artists', {
    method: 'POST',
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Não foi possível criar o artista');
  }
  return (await res.json()) as ArtistProfile;
}

/**
 * Sobe um arquivo direto pro R2 (navegador -> R2, sem passar pelo Vercel),
 * usando uma URL pré-assinada. Necessário porque o Vercel corta o corpo de
 * uma Serverless Function em ~4.5MB, e músicas costumam passar disso.
 */
async function uploadFileDirectToR2(file: File, folder: string): Promise<string> {
  if (!getAuthToken()) {
    // Modo demo (sem token real) — a rota de upload exige autenticação
    // de verdade, então avisamos antes de tentar, em vez de deixar
    // estourar 401 e derrubar a sessão do usuário.
    throw new Error(
      'Upload de música precisa de uma conta real. Você está no modo demo — crie uma conta ou faça login para poder subir músicas.'
    );
  }

  const presignRes = await apiFetch('/api/storage/presign-upload', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream', folder }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao gerar link de upload');
  }

  const { uploadUrl, publicUrl } = await presignRes.json();

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error(
      `Falha ao enviar o arquivo pro R2 (status ${putRes.status}). ` +
      `Confira se o bucket tem uma política de CORS liberando PUT para o domínio do site.`
    );
  }

  return publicUrl as string;
}

/** Sobe uma imagem (avatar/capa) pro R2 e devolve a URL pública. */
export async function uploadImageFile(file: File, folder: 'avatars' | 'covers' | 'track-covers'): Promise<string> {
  // TEMPORÁRIO (diagnóstico do 403 no upload direto): usando a rota do
  // servidor em vez do upload direto pro R2. Reverter para
  // `return uploadFileDirectToR2(file, folder);` depois de resolver.
  return uploadFileViaServer(file, folder);
}

/** Apaga uma faixa já enviada (remove do banco e tenta apagar os arquivos no R2). */
export async function deleteTrackFile(trackId: string): Promise<void> {
  const res = await apiFetch(`/api/tracks?id=${encodeURIComponent(trackId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao apagar a faixa');
  }
}

/** Edita o título e/ou a capa de uma faixa já publicada. */
export async function updateTrackInfo(
  trackId: string,
  fields: { titulo?: string; coverUrl?: string }
): Promise<void> {
  const res = await apiFetch(`/api/tracks?id=${encodeURIComponent(trackId)}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao editar a faixa');
  }
}

export interface ArtistProfileFields {
  nome?: string;
  genero?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
}

/** Atualiza nome/gênero/bio/avatar/capa do artista que representa o usuário logado. */
export async function updateMyArtistProfile(artistaId: string, fields: ArtistProfileFields): Promise<void> {
  const res = await apiFetch('/api/artists', {
    method: 'PATCH',
    body: JSON.stringify({ id: artistaId, ...fields }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao atualizar perfil de artista');
  }
}

/**
 * Apaga um artista inteiro (e, junto, todas as músicas dele — a exclusão
 * cascateia no banco). Só o dono do artista pode apagar.
 */
export async function deleteArtistProfile(artistaId: string): Promise<void> {
  const res = await apiFetch(`/api/artists?id=${encodeURIComponent(artistaId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao apagar o artista');
  }
}

/** Sobe um arquivo de áudio direto pro R2 e cria a faixa correspondente no banco. */
export async function uploadTrackFile(
  file: File,
  artistaId: string,
  titulo: string,
  coverUrl?: string
): Promise<void> {
  const duracao = await readAudioDuration(file);
  const url = await uploadFileDirectToR2(file, 'tracks');

  const trackRes = await apiFetch('/api/tracks', {
    method: 'POST',
    body: JSON.stringify({ titulo, artistaId, audioUrl: url, coverUrl: coverUrl || null, duracao }),
  });

  if (!trackRes.ok) {
    const err = await trackRes.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao salvar a faixa no banco');
  }
}
