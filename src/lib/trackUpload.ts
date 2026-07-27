import { apiFetch } from '@/lib/api';

// ============================================================
// Upload de músicas: pega o arquivo de áudio, sobe pro R2
// (via /api/storage/upload) e cria a faixa no banco
// (via /api/tracks), associada a um "artista" que representa
// o usuário logado.
// ============================================================

const MY_ARTIST_ID_KEY = 'zoada-my-artist-id';

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

/**
 * Garante que existe um "artista" no banco representando o usuário logado
 * (reaproveita se já existir; cria se for a primeira vez) e guarda o id
 * em localStorage para não recriar a cada upload.
 */
export async function getOrCreateMyArtistId(userName: string): Promise<string> {
  if (typeof window === 'undefined') throw new Error('Só funciona no navegador');

  const cached = localStorage.getItem(MY_ARTIST_ID_KEY);
  if (cached) return cached;

  // Tenta achar um artista já existente com esse nome (ex: você já subiu música antes
  // em outro navegador, ou o artista foi criado manualmente).
  const listRes = await fetch('/api/artists');
  if (listRes.ok) {
    const data = await listRes.json();
    const existing = (data.artists || []).find(
      (a: { id: string; name: string }) => a.name === userName
    );
    if (existing) {
      localStorage.setItem(MY_ARTIST_ID_KEY, existing.id);
      return existing.id;
    }
  }

  // Não existe ainda -> cria
  const createRes = await apiFetch('/api/artists', {
    method: 'POST',
    body: JSON.stringify({ nome: userName || 'Artista Zôada', genero: '' }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error || 'Não foi possível criar seu perfil de artista');
  }

  const artist = await createRes.json();
  localStorage.setItem(MY_ARTIST_ID_KEY, artist.id);
  return artist.id;
}

/** Sobe um arquivo de áudio pro R2 e cria a faixa correspondente no banco. */
export async function uploadTrackFile(file: File, artistaId: string): Promise<void> {
  const duracao = await readAudioDuration(file);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', 'tracks');

  const uploadRes = await apiFetch('/api/storage/upload', {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao enviar o arquivo para o R2');
  }

  const { url } = await uploadRes.json();
  const titulo = file.name.replace(/\.[^/.]+$/, '');

  const trackRes = await apiFetch('/api/tracks', {
    method: 'POST',
    body: JSON.stringify({ titulo, artistaId, audioUrl: url, duracao }),
  });

  if (!trackRes.ok) {
    const err = await trackRes.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao salvar a faixa no banco');
  }
}
