import React from 'react';

interface AppIconProps {
  /** Grootte in pixels (breedte = hoogte) */
  size?: number;
  className?: string;
  /**
   * "full"   — met donkere achtergrond + afgeronde hoeken (voor hero / standalone gebruik)
   * "symbol" — alleen cursor+lijnen, transparante achtergrond (voor nav / sidebar)
   */
  variant?: 'full' | 'symbol';
}

/**
 * OpenSuggest app-icoon als schaalbare SVG.
 * Cursor (|) met drie uitfadende ghost-tekstregels en een sparkle — exact het app-concept.
 */
export const AppIcon: React.FC<AppIconProps> = ({ size = 36, className, variant = 'full' }) => {
  const id = React.useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Achtergrond: diepzwart */}
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#080808" />
          <stop offset="100%" stopColor="#111111" />
        </linearGradient>

        {/* Cursor gradient: wit boven → lichtgrijs onder */}
        <linearGradient id={`cur-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#c0c0c0" />
        </linearGradient>

        {/* Ghost-lijn fade-out (links opaque → rechts transparant) */}
        <linearGradient id={`l1-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.80" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`l2-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.50" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`l3-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Achtergrond — alleen voor variant="full" */}
      {variant === 'full' && (
        <rect width="100" height="100" rx="22" fill={`url(#bg-${id})`} />
      )}

      {/* Cursor bar */}
      <rect
        x="34" y="22" width="5" height="57"
        rx="2.5"
        fill={`url(#cur-${id})`}
        opacity={variant === 'symbol' ? 0.9 : 1}
      />

      {/* Ghost-tekstregels */}
      <rect x="44" y="33" width="32" height="4"  rx="2" fill={`url(#l1-${id})`} />
      <rect x="44" y="42" width="25" height="4"  rx="2" fill={`url(#l2-${id})`} />
      <rect x="44" y="51" width="28" height="4"  rx="2" fill={`url(#l3-${id})`} />

    </svg>
  );
};
