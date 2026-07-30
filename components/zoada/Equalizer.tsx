'use client';

import React from 'react';

interface EqualizerProps {
  barCount?: number;
  height?: number;
  barWidth?: number;
  gap?: number;
  animated?: boolean;
  className?: string;
}

const Equalizer: React.FC<EqualizerProps> = ({
  barCount = 5,
  height = 32,
  barWidth = 4,
  gap = 3,
  animated = true,
  className = '',
}) => {
  const heights = [40, 70, 100, 55, 85, 65, 90, 50, 75, 60];

  return (
    <div
      className={`flex items-end ${className}`}
      style={{ height, gap }}
      role="img"
      aria-label="Equalizador de áudio"
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: barWidth,
            height: animated ? undefined : `${heights[i % heights.length]}%`,
            background: `linear-gradient(to top, #FF8C42, #E84393, #6C5CE7)`,
            animation: animated ? `equalizer-bar ${0.4 + (i * 0.15)}s ease-in-out ${i * 0.1}s infinite` : 'none',
            transition: 'height 0.3s ease',
          }}
        />
      ))}
    </div>
  );
};

export default Equalizer;
