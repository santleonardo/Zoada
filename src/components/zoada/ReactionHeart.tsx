import React from 'react';

/**
 * Coraçãozinho de reação, nas cores da logo (laranja → rosa → roxo). Quando
 * ainda não reagiu, fica só o contorno; ao reagir, preenche com o degradê
 * via <linearGradient> (não dá pra usar classe Tailwind num fill de SVG).
 * Usado tanto na postagem em si (OP) quanto nos comentários da thread.
 */
const ReactionHeart: React.FC<{ id: string; active: boolean; size?: number }> = ({ id, active, size = 14 }) => {
  const gradientId = `zoada-heart-grad-${id}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF8C42" />
          <stop offset="50%" stopColor="#E84393" />
          <stop offset="100%" stopColor="#6C5CE7" />
        </linearGradient>
      </defs>
      <path
        d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
        fill={active ? `url(#${gradientId})` : 'none'}
        stroke={active ? `url(#${gradientId})` : 'currentColor'}
        strokeWidth={active ? 0 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default ReactionHeart;
