import { apiFetch, getAuthToken } from '@/lib/api';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

// ============================================================
// Upload de músicas: pega o arquivo de áudio, sobe pro R2
// (via /api/storage/upload) e cria a faixa no banco
// (via /api/tracks), associada a um "artista" que representa
// o usuário logado.
// ============================================================

// ------------------------------------------------------------
// Qualidade de áudio: gera uma segunda versão da faixa, em
// bitrate mais baixo, direto no navegador (ffmpeg.wasm) — sem
// depender de nenhum processamento no servidor (que não teria
// ffmpeg disponível em ambiente serverless). A versão "alta"
// continua sendo o arquivo original, sem recodificar, pra não
// perder qualidade recomprimindo duas vezes.
// ------------------------------------------------------------

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

// Núcleo do ffmpeg.wasm (build single-thread, não precisa de
// SharedArrayBuffer nem de cabeçalhos COOP/COEP no servidor).
const FFMPEG_CORE_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

async function getFFmpeg(onProgress?: (message: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      onProgress?.('Carregando conversor de áudio...');
      const ffmpeg = new FFmpeg();
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
        toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
      ]);
      await ffmpeg.load({ coreURL, wasmURL });
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })().catch((err) => {
      // Se o carregamento falhar (ex: sem internet pro CDN, navegador
      // incompatível), não deixa a promise "presa" em erro pra sempre —
      // libera pra tentar de novo na próxima música.
      ffmpegLoadPromise = null;
      throw err;
    });
  }
  return ffmpegLoadPromise;
}

const ECONOMY_BITRATE_KBPS = 96;

/**
 * Recodifica o arquivo pra MP3 a ~96kbps (bom equilíbrio entre tamanho e
 * qualidade audível pra "economia de dados"). Roda inteiramente no
 * navegador de quem está enviando a música.
 */
async function transcodeToEconomyMp3(file: File, onProgress?: (message: string) => void): Promise<File> {
  const ffmpeg = await getFFmpeg(onProgress);
  onProgress?.('Gerando versão economia de dados...');

  const inputName = `input-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const outputName = `${inputName}-out.mp3`;

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  try {
    await ffmpeg.exec(['-i', inputName, '-b:a', `${ECONOMY_BITRATE_KBPS}k`, '-map_metadata', '-1', outputName]);
    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data as BlobPart], { type: 'audio/mpeg' });
    const economyName = `${file.name.replace(/\.[^/.]+$/, '')}-economia.mp3`;
    return new File([blob], economyName, { type: 'audio/mpeg' });
  } finally {
    // Limpa o sistema de arquivos virtual do ffmpeg pra não acumular
    // memória quando várias músicas são enviadas em sequência.
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}

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

/**
 * Estima o bitrate do arquivo (kbps), a partir do tamanho em bytes e da
 * duração real. Não é um valor exato (varia em arquivos VBR), mas serve
 * como aviso pro artista antes de subir a música — não bloqueia o envio.
 */
export async function estimateBitrateKbps(file: File): Promise<number | null> {
  const duration = await readAudioDuration(file);
  if (!duration || duration <= 0) return null;
  const bits = file.size * 8;
  return Math.round(bits / duration / 1000);
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

/**
 * Sobe um áudio de mensagem de voz (gravado no navegador com MediaRecorder)
 * direto pro R2, igual ao upload de música — sem passar pelo Vercel, já que
 * o corpo de uma Serverless Function tem limite de ~4.5MB.
 */
export async function uploadVoiceMessage(file: File): Promise<string> {
  return uploadFileDirectToR2(file, 'voice-messages');
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
  coverUrl?: string,
  onProgress?: (message: string) => void
): Promise<void> {
  const duracao = await readAudioDuration(file);

  onProgress?.('Enviando música...');
  const url = await uploadFileDirectToR2(file, 'tracks');

  // Gera e sobe a versão "economia de dados". Isso é best-effort: se o
  // navegador não conseguir rodar o conversor (ex: sem internet pro CDN
  // do ffmpeg.wasm, navegador muito antigo), a faixa continua sendo
  // enviada normalmente, só que sem a opção de economia — o player cai de
  // volta pra versão em alta qualidade nesse caso.
  let lowUrl: string | null = null;
  try {
    const economyFile = await transcodeToEconomyMp3(file, onProgress);
    onProgress?.('Enviando versão economia de dados...');
    lowUrl = await uploadFileDirectToR2(economyFile, 'tracks');
  } catch (err) {
    console.warn(
      '[trackUpload] Não foi possível gerar a versão economia de dados; a faixa ficará só com a versão em alta qualidade.',
      err
    );
  }

  onProgress?.('Salvando faixa...');
  const trackRes = await apiFetch('/api/tracks', {
    method: 'POST',
    body: JSON.stringify({
      titulo,
      artistaId,
      audioUrl: url,
      audioUrlLow: lowUrl,
      coverUrl: coverUrl || null,
      duracao,
    }),
  });

  if (!trackRes.ok) {
    const err = await trackRes.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao salvar a faixa no banco');
  }
}
