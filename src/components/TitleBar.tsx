import React, { useState } from 'react';
import { X, Minus, Square } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);

export const TitleBar: React.FC = () => {
  if (!isDesktop) return null;

  const handleMinimize = () => { getCurrentWindow().minimize(); };
  const handleMaximize = () => { getCurrentWindow().toggleMaximize(); };
  const handleClose = () => { getCurrentWindow().close(); };

  // On macOS: render custom traffic lights absolutely positioned over the sidebar
  if (isMac) {
    return (
      <MacTrafficLights
        onClose={handleClose}
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
      />
    );
  }

  // Windows / Linux: classic top bar with controls on the right
  return (
    <div
      className="h-9 w-full flex items-center justify-between bg-black border-b border-white/4 select-none shrink-0"
      data-tauri-drag-region
    >
      <div
        className="flex items-center h-full px-4 gap-2 pointer-events-none"
        data-tauri-drag-region
      >
        <div className="w-3.5 h-3.5 rounded-md bg-white/5 flex items-center justify-center">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1 7L7 1M1 1l6 6" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">
          OpenSuggest
        </span>
      </div>

      <div className="flex-1" data-tauri-drag-region />

      <div className="flex h-full">
        <button
          onClick={handleMinimize}
          className="w-10 h-full flex items-center justify-center hover:bg-white/10 transition-colors text-white/40 hover:text-white/80"
          title="Minimize"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={handleMaximize}
          className="w-10 h-full flex items-center justify-center hover:bg-white/10 transition-colors text-white/40 hover:text-white/80"
          title="Maximize"
        >
          <Square size={9} />
        </button>
        <button
          onClick={handleClose}
          className="w-10 h-full flex items-center justify-center hover:bg-red-500 transition-colors text-white/40 hover:text-white group"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
};

// ── macOS traffic lights ───────────────────────────────────────────────────────
interface MacTrafficLightsProps {
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}

const MacTrafficLights: React.FC<MacTrafficLightsProps> = ({ onClose, onMinimize, onMaximize }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="fixed top-0 left-0 z-50 flex items-center gap-[8px] px-[18px]"
      style={{ height: '52px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Close - red */}
      <button
        onClick={onClose}
        title="Sluiten"
        className="w-[13px] h-[13px] rounded-full bg-[#ff5f57] border border-[#e0443e] flex items-center justify-center transition-all hover:brightness-90 focus:outline-none"
        style={{ boxShadow: '0 0 0 0.5px rgba(0,0,0,0.2)' }}
      >
        {hovered && (
          <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
            <path d="M1 1l4 4M5 1L1 5" stroke="#4d0000" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Minimize - yellow */}
      <button
        onClick={onMinimize}
        title="Minimaliseren"
        className="w-[13px] h-[13px] rounded-full bg-[#febc2e] border border-[#d9a026] flex items-center justify-center transition-all hover:brightness-90 focus:outline-none"
        style={{ boxShadow: '0 0 0 0.5px rgba(0,0,0,0.2)' }}
      >
        {hovered && (
          <svg width="6" height="2" viewBox="0 0 6 2" fill="none">
            <path d="M1 1h4" stroke="#4d3000" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Maximize - green */}
      <button
        onClick={onMaximize}
        title="Maximize"
        className="w-[13px] h-[13px] rounded-full bg-[#28c840] border border-[#1aab29] flex items-center justify-center transition-all hover:brightness-90 focus:outline-none"
        style={{ boxShadow: '0 0 0 0.5px rgba(0,0,0,0.2)' }}
      >
        {hovered && (
          <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
            <path d="M1 3.5L3.5 1L6 3.5M6 3.5L3.5 6M6 3.5H1" stroke="#003d00" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  );
};
