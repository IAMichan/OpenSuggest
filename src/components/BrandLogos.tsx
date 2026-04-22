import React from 'react';

/**
 * Official Apple and Windows Brand Logos as high-quality SVGs.
 * These are used for the download buttons to provide a "Verified" and "Official" feel.
 */

export const AppleLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 384 512" className={className} fill="currentColor">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.4-84.7-43.8-38.3-2.6-73.1 24.3-93 24.3-19.7 0-48.5-23.2-79.6-22.6-39.1.5-75.1 23.3-95.1 58-40.2 70.1-10.2 173.8 28.6 230 19 27.5 41.8 58.2 71.4 57.1 28.5-1.1 39.3-18.3 73.8-18.3 34.4 0 44.4 18.3 74.4 17.7 30.2-1.1 49.3-27.7 67.8-55.4 21.4-31.2 30.1-61.4 30.5-63.1-.7-.3-58.8-22.6-59.1-85.2zM249.1 80.4c17.2-21.2 28.9-50.5 25.7-79.9-25.2 1-55.7 16.9-73.8 38.4-16.2 19.1-30.6 48.7-26.8 77.2 27.9 2.1 58.1-14.8 74.9-35.7z"/>
  </svg>
);

export const WindowsLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 448 512" className={className} fill="currentColor">
    <path d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V266.3H0v152zm203.8 28.1L448 480V266.3H203.8v180.1zm0-380.6v180.1H448V32L203.8 65.9z"/>
  </svg>
);
