import React from 'react';
import { X, Minus, Square } from 'lucide-react';
import { window as tauriWindow } from '@tauri-apps/api';

const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

export const TitleBar: React.FC = () => {
  if (!isDesktop) return null;

  const handleMinimize = () => tauriWindow.getCurrentWindow().minimize();
  const handleMaximize = () => tauriWindow.getCurrentWindow().toggleMaximize();
  const handleClose = () => tauriWindow.getCurrentWindow().close();

  // Detect platform for button placement (macOS vs Windows)
  const isMac = navigator.userAgent.toLowerCase().includes('mac');

  return (
    <div 
      className="h-8 w-full flex items-center justify-between bg-black/50 backdrop-blur-md border-b border-white/5 select-none"
      data-tauri-drag-region
    >
      {/* Platform-specific spacing handles */}
      {isMac ? (
        <div className="flex gap-2 ml-3 no-drag">
          {/* macOS traffic lights will be injected by OS if decorations were true, 
              but since we hide them for total control, we leave space or mock them.
              With titleBarStyle: "Transparent", macOS typically keeps native lights on the left.
          */}
          <div className="w-12 h-full" /> 
        </div>
      ) : (
        <div className="flex items-center h-full px-4 text-[10px] font-bold text-white/30 uppercase tracking-widest pointer-events-none">
          OpenSuggest Control
        </div>
      )}

      {/* Windows Style Controls (Hidden on Mac) */}
      {!isMac && (
        <div className="flex h-full no-drag">
          <button 
            onClick={handleMinimize}
            className="w-10 h-full flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <Minus size={14} className="text-white/60" />
          </button>
          <button 
            onClick={handleMaximize}
            className="w-10 h-full flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <Square size={10} className="text-white/60" />
          </button>
          <button 
            onClick={handleClose}
            className="w-10 h-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
          >
            <X size={14} className="text-white/60 group-hover:text-white" />
          </button>
        </div>
      )}
    </div>
  );
};
