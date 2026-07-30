'use client';

import React, { useState, useEffect } from 'react';
import { COVER_COLORS } from '@/lib/demo-data';

interface CoverArtProps {
  title: string;
  artistName: string;
  coverUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  showEqualizer?: boolean;
  isPlaying?: boolean;
}

const CoverArt: React.FC<CoverArtProps> = ({
  title,
  artistName,
  coverUrl,
  size = 'md',
  className = '',
  showEqualizer = false,
  isPlaying = false,
}) => {
  // If the image fails to load, fall back to the generated gradient cover
  const [imageFailed, setImageFailed] = useState(false);

  // Reset the failure flag whenever we get a new image to try
  useEffect(() => {
    setImageFailed(false);
  }, [coverUrl]);

  // Generate deterministic colors based on title
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = COVER_COLORS[hash % COVER_COLORS.length];

  const sizes = {
    sm: 'w-12 h-12',
    md: 'w-full aspect-square max-w-[200px]',
    lg: 'w-full aspect-[3/4] max-w-[280px]',
    xl: 'w-full aspect-[3/4] max-w-[340px]',
    full: 'w-full aspect-[9/16] max-w-[360px]',
  };

  const fontSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
    full: 'text-5xl',
  };

  return (
    <div
      className={`${sizes[size]} rounded-2xl overflow-hidden relative flex items-center justify-center shadow-2xl ${className}`}
      style={{
        background: `linear-gradient(135deg, ${colors[0]}dd, ${colors[1]}dd)`,
      }}
    >
      {coverUrl && !imageFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={`Capa de ${title}`}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImageFailed(true)}
        />
      )}

      {/* Decorative circles */}
      {(!coverUrl || imageFailed) && (
        <>
          <div
            className="absolute w-1/2 h-1/2 rounded-full opacity-10"
            style={{
              background: colors[0],
              top: '-20%',
              right: '-20%',
            }}
          />
          <div
            className="absolute w-1/3 h-1/3 rounded-full opacity-10"
            style={{
              background: colors[1],
              bottom: '-10%',
              left: '-10%',
            }}
          />
        </>
      )}

      {(!coverUrl || imageFailed) && (
        <div className="text-center z-10 p-4">
          <p className={`${fontSizes[size]} font-bold text-white leading-tight drop-shadow-lg`}>
            {title}
          </p>
          <p className="text-white/60 text-sm mt-1 font-medium">
            {artistName}
          </p>
        </div>
      )}

      {showEqualizer && isPlaying && (
        <div
          className={`absolute z-10 flex justify-center ${
            coverUrl && !imageFailed ? 'bottom-3 left-0 right-0' : ''
          }`}
        >
          <div className="flex items-end gap-1 h-6">
            {[40, 70, 100, 55, 85].map((h, i) => (
              <div
                key={i}
                className="w-1 rounded-full"
                style={{
                  height: `${h}%`,
                  background: 'linear-gradient(to top, rgba(255,255,255,0.6), rgba(255,255,255,0.9))',
                  animation: `equalizer-bar ${0.4 + (i * 0.15)}s ease-in-out ${i * 0.1}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoverArt;
