import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, X } from 'lucide-react';

interface SuggestionPayload {
  suggestion: string;
  context: string;
  modelId: string;
}

export const OverlayWindow: React.FC = () => {
  const [suggestion, setSuggestion] = useState('');
  const [context, setContext] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [injecting, setInjecting] = useState(false);

  useEffect(() => {
    const unlistenShow = listen<SuggestionPayload>('overlay-show-suggestion', async (event) => {
      const { suggestion: s } = event.payload;
      if (!s) return;
      setSuggestion(s);
      setContext(event.payload.context ?? '');
      setIsVisible(true);
      const win = getCurrentWebviewWindow();
      await win.show();
      await win.setFocus();
    });

    const unlistenHide = listen('overlay-hide', async () => {
      setIsVisible(false);
      setSuggestion('');
      const win = getCurrentWebviewWindow();
      await win.hide();
    });

    const handleKey = async (e: KeyboardEvent) => {
      if (!isVisible) return;

      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        await acceptSuggestion();
      } else if (e.key === 'Escape') {
        await dismissSuggestion();
      }
    };

    window.addEventListener('keydown', handleKey);

    return () => {
      unlistenShow.then((u) => u());
      unlistenHide.then((u) => u());
      window.removeEventListener('keydown', handleKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, suggestion]);

  const acceptSuggestion = async () => {
    if (!suggestion || injecting) return;
    setInjecting(true);
    try {
      // Find first-word boundary (suggestion may have leading space)
      const leadingSpace = suggestion.startsWith(' ') ? 1 : 0;
      const splitIdx = suggestion.indexOf(' ', leadingSpace + 1);

      if (splitIdx === -1) {
        // Last (or only) word — inject and close
        await invoke('inject_text_at_cursor', { text: suggestion });
        const { emit } = await import('@tauri-apps/api/event');
        await emit('overlay-accepted', { suggestion });
        setIsVisible(false);
        setSuggestion('');
        const win = getCurrentWebviewWindow();
        await win.hide();
      } else {
        // Inject first word, keep the rest visible
        const firstWord = suggestion.slice(0, splitIdx);
        const rest = suggestion.slice(splitIdx); // starts with ' '
        await invoke('inject_text_at_cursor', { text: firstWord });
        setSuggestion(rest);
      }
    } catch (e) {
      console.error('Injection failed:', e);
    } finally {
      setInjecting(false);
    }
  };

  const dismissSuggestion = async () => {
    setIsVisible(false);
    setSuggestion('');
    const { emit } = await import('@tauri-apps/api/event');
    await emit('overlay-dismissed', {});
    const win = getCurrentWebviewWindow();
    await win.hide();
  };

  return (
    <div
      className="w-screen h-screen flex items-center justify-center"
      style={{ background: 'transparent' }}
    >
      <AnimatePresence>
        {isVisible && suggestion && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="w-full mx-3 flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              background: 'rgba(10,10,10,0.94)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            {/* Logo */}
            <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 text-black fill-black" />
            </div>

            {/* Suggestion text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/90 truncate font-sans leading-tight">
                {context && (
                  <span className="text-white/35">{context.slice(-40)}</span>
                )}
                <span className="text-white/70 italic">{suggestion}</span>
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {injecting ? (
                <span className="text-[10px] text-white/40 font-mono">Inserting...</span>
              ) : (
                <>
                  <button
                    onClick={acceptSuggestion}
                    className="flex items-center gap-1 h-6 px-2.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <kbd className="text-[10px] font-bold text-white/70">Tab</kbd>
                    <span className="text-[10px] text-white/50">insert</span>
                  </button>
                  <button
                    onClick={dismissSuggestion}
                    className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-white/30" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
