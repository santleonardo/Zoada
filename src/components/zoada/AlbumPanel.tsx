'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Images,
  Plus,
  Trash2,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  GripVertical,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  fetchAlbumPhotos,
  uploadAlbumPhoto,
  deleteAlbumPhoto,
  reorderAlbumPhotos,
  type AlbumPhoto,
} from '@/lib/api';
import { ALBUM_MAX_PHOTOS, IMAGE_INPUT_ACCEPT } from '@/lib/imageLimits';
import {
  optimizeImageClient,
  validateImageFileClient,
  ClientImageError,
} from '@/lib/clientImageOptimize';
import { toast } from 'sonner';


interface AlbumPanelProps {
  userId: string;
  isOwner: boolean;
  /** Se true, perfil privado e visitante não-seguidor — não mostra o álbum. */
  locked?: boolean;
}

function SortableThumb({
  photo,
  isOwner,
  onRemove,
  onOpen,
  removing,
}: {
  photo: AlbumPhoto;
  isOwner: boolean;
  onRemove: (id: string) => void;
  onOpen: (id: string) => void;
  removing: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.id, disabled: !isOwner });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative aspect-square rounded-xl overflow-hidden bg-black/5 group"
    >
      <button
        type="button"
        onClick={() => onOpen(photo.id)}
        className="absolute inset-0 w-full h-full"
        aria-label="Ver foto em tela cheia"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt="Foto do álbum"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </button>

      {isOwner && (
        <>
          <button
            type="button"
            className="absolute top-1 left-1 w-7 h-7 rounded-lg bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity touch-none"
            aria-label="Reordenar foto"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(photo.id);
            }}
            disabled={removing}
            className="absolute top-1 right-1 w-7 h-7 rounded-lg bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-50"
            aria-label="Remover foto"
          >
            {removing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </>
      )}
    </div>
  );
}

const AlbumPanel: React.FC<AlbumPanelProps> = ({ userId, isOwner, locked }) => {
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );

  const load = useCallback(async () => {
    setLoading(true);
    const list = await fetchAlbumPhotos(userId);
    setPhotos(list);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (locked) {
      setPhotos([]);
      setLoading(false);
      return;
    }
    load();
  }, [load, locked]);

  const atLimit = photos.length >= ALBUM_MAX_PHOTOS;

  const handlePick = () => {
    if (!isOwner || atLimit || uploading) return;
    inputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validationError = validateImageFileClient(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (photos.length >= ALBUM_MAX_PHOTOS) {
      toast.error(`Limite de ${ALBUM_MAX_PHOTOS} fotos no álbum atingido.`);
      return;
    }

    setUploading(true);
    try {
      let toSend = file;
      try {
        toSend = await optimizeImageClient(file, 'album');
      } catch (err) {
        if (err instanceof ClientImageError) {
          toast.error(err.message);
          setUploading(false);
          return;
        }
      }
      const result = await uploadAlbumPhoto(toSend);
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      setPhotos((prev) => [...prev, result.photo]);
      toast.success('Foto adicionada ao álbum');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!isOwner || removingId) return;
    setRemovingId(id);
    const result = await deleteAlbumPhoto(id);
    setRemovingId(null);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    setPhotos((prev) => {
      const next = prev.filter((p) => p.id !== id);
      return next.map((p, i) => ({ ...p, sort_order: i }));
    });
    if (lightboxId === id) setLightboxId(null);
    toast.success('Foto removida');
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = photos.findIndex((p) => p.id === active.id);
    const newIndex = photos.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = photos;
    const next = arrayMove(photos, oldIndex, newIndex).map((p, i) => ({
      ...p,
      sort_order: i,
    }));
    setPhotos(next);

    const result = await reorderAlbumPhotos(next.map((p) => p.id));
    if ('error' in result) {
      setPhotos(previous);
      toast.error(result.error);
      return;
    }
    setPhotos(result.photos);
  };

  const lightboxIndex = lightboxId
    ? photos.findIndex((p) => p.id === lightboxId)
    : -1;
  const lightboxPhoto = lightboxIndex >= 0 ? photos[lightboxIndex] : null;

  const goLightbox = (dir: -1 | 1) => {
    if (lightboxIndex < 0) return;
    const next = (lightboxIndex + dir + photos.length) % photos.length;
    setLightboxId(photos[next].id);
  };

  if (locked) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Images size={18} className="text-[#6C5CE7]" />
          <h3 className="text-lg font-semibold text-[#1A1B25]">Álbum</h3>
          {!loading && (
            <span className="text-sm text-black/40">
              {photos.length}/{ALBUM_MAX_PHOTOS}
            </span>
          )}
        </div>
        {isOwner && (
          <button
            type="button"
            onClick={handlePick}
            disabled={atLimit || uploading}
            aria-label="Adicionar foto"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-[#F2F2F8] hover:bg-[#E4E5EE] text-[#1A1B25] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            {uploading ? 'Enviando…' : 'Adicionar'}
          </button>
        )}
      </div>

      {isOwner && atLimit && (
        <p className="text-xs text-black/40 mb-2">
          Limite de {ALBUM_MAX_PHOTOS} fotos atingido. Remova uma para adicionar outra.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_INPUT_ACCEPT}
        className="hidden"
        onChange={handleFile}
      />

      {loading ? (
        <div className="rounded-2xl bg-white shadow-sm p-8 flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-black/30" />
        </div>
      ) : photos.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-sm p-8 text-center">
          <Images size={40} className="text-black/15 mx-auto mb-3" />
          <p className="text-black/40 text-sm">Nenhuma foto no álbum ainda</p>
          {isOwner && (
            <button
              type="button"
              onClick={handlePick}
              disabled={uploading}
              className="mt-3 text-sm text-[#FF8C42] hover:text-[#FFB074] transition-colors"
            >
              Adicionar a primeira foto →
            </button>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((photo) => (
                <SortableThumb
                  key={photo.id}
                  photo={photo}
                  isOwner={isOwner}
                  onRemove={handleRemove}
                  onOpen={setLightboxId}
                  removing={removingId === photo.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Lightbox simples */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Visualizar foto"
          onClick={() => setLightboxId(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
            aria-label="Fechar"
            onClick={() => setLightboxId(null)}
          >
            <X size={20} />
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                aria-label="Foto anterior"
                onClick={(e) => {
                  e.stopPropagation();
                  goLightbox(-1);
                }}
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                aria-label="Próxima foto"
                onClick={(e) => {
                  e.stopPropagation();
                  goLightbox(1);
                }}
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxPhoto.url}
            alt="Foto do álbum em tela cheia"
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default AlbumPanel;
