import React, { useState, useRef, useEffect, useCallback } from 'react';
import { streamCompletion, smartPrefix, modelSupportsFim } from '../services/aiService';
import { recordSuggestion } from '../services/statsService';
import { readClipboard, writeClipboard } from '../services/clipboardService';
import { AppSettings } from '../types';
import { Copy } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

// Context cache — buiten de component zodat hij de sessie overleeft.
// Clipboard en history worden maximaal eens per 5 seconden opgehaald.
const ctxCache = { clipboard: '', history: '', ts: 0 };

async function loadContext(settings: AppSettings): Promise<{ clipboard: string; history: string }> {
  const now = Date.now();
  if (now - ctxCache.ts < 5000) return ctxCache;

  const [clipboard, history] = await Promise.all([
    settings.clipboardEnabled ? readClipboard().catch(() => '') : Promise.resolve(''),
    isDesktop
      ? invoke<string[]>('db_get_history', { limit: 5 })
          .then((items) => items.join('. '))
          .catch(() => '')
      : Promise.resolve(''),
  ]);

  Object.assign(ctxCache, { clipboard, history, ts: now });
  return ctxCache;
}

interface GhostEditorProps {
  settings: AppSettings;
  onSettingsChange?: (s: Partial<AppSettings>) => void;
  screenContext?: string;
}

export const GhostEditor: React.FC<GhostEditorProps> = ({
  settings,
  onSettingsChange,
  screenContext = '',
}) => {
  const [content, setContent] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastAccepted, setLastAccepted] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const generationRef = useRef(0);
  // Houdt de cancel-functie van de lopende stream bij
  const cancelStreamRef = useRef<(() => void) | null>(null);

  const triggerSuggestion = useCallback(
    async (text: string) => {
      if (!settings.isEnabled || text.trim().length < settings.minCharsForSuggestion) {
        setSuggestion('');
        return;
      }

      // Instructie-modellen (Gemma, Llama, Mistral) kunnen geen mid-word completions aan.
      // Alleen triggeren als de tekst eindigt op een woordgrens (spatie of leesteken).
      // FIM-modellen (Qwen) kunnen wel bij elke letter worden getriggerd.
      if (!modelSupportsFim(settings.modelId) && /\S$/.test(text) && !/[.!?,;:\s]$/.test(text)) {
        // Verouderde suggestie wissen — die was voor een andere woordgrens gegenereerd.
        setSuggestion('');
        setIsGenerating(false);
        return;
      }

      // Annuleer eventuele vorige stream
      cancelStreamRef.current?.();
      cancelStreamRef.current = null;

      const gen = ++generationRef.current;
      setIsGenerating(true);

      // Context parallel laden (gecached, dus vrijwel gratis bij opeenvolgende aanroepen)
      const { clipboard: clipboardCtx, history: historyCtx } = await loadContext(settings);

      if (generationRef.current !== gen) return;

      const cancel = await streamCompletion(
        text,
        settings.modelId,
        settings.ollamaUrl,
        gen,
        {
          screenContext: settings.screenContextEnabled ? screenContext : '',
          clipboardContext: clipboardCtx,
          historyContext: historyCtx,
        },
        // onToken — wordt aangeroepen voor elk binnenkomend token
        (partialSuggestion) => {
          if (generationRef.current !== gen) return;
          if (partialSuggestion) setSuggestion(partialSuggestion);
        },
        // onDone — wordt aangeroepen als de stream klaar is
        (finalSuggestion) => {
          if (generationRef.current !== gen) return;
          setIsGenerating(false);
          if (finalSuggestion) setSuggestion(finalSuggestion);
        },
      );

      if (generationRef.current === gen) {
        cancelStreamRef.current = cancel;
      } else {
        cancel();
      }
    },
    [settings, screenContext]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();

      const leadingSpace = suggestion.startsWith(' ') ? 1 : 0;
      const splitIdx = suggestion.indexOf(' ', leadingSpace + 1);

      if (splitIdx === -1) {
        const newContent = content + suggestion;
        setContent(newContent);
        setSuggestion('');
        setLastAccepted(suggestion);

        const wordCount = suggestion.trim().split(/\s+/).filter(Boolean).length;
        if (onSettingsChange) {
          onSettingsChange({ autocompletedCount: settings.autocompletedCount + wordCount });
        }
        recordSuggestion(true, wordCount);

        if (settings.collectInputs && isDesktop) {
          invoke('db_save_fragment', { text: suggestion, accepted: true, context: screenContext || '' })
            .then((count) => onSettingsChange?.({ historyCount: count as number }))
            .catch(console.error);
        }

        triggerSuggestion(newContent);
      } else {
        const firstWord = suggestion.slice(0, splitIdx);
        const rest = suggestion.slice(splitIdx);
        const newContent = content + firstWord;
        setContent(newContent);
        setSuggestion(rest);
        triggerSuggestion(newContent);
      }
    } else if (e.key === 'Escape') {
      cancelStreamRef.current?.();
      cancelStreamRef.current = null;
      setSuggestion('');
      setIsGenerating(false);
      if (suggestion) recordSuggestion(false, 0);
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newText = e.currentTarget.innerText;
    setContent(newText);

    // Stop de huidige inferentie direct — geen verspilde GPU-cycles op verouderde tekst.
    cancelStreamRef.current?.();
    cancelStreamRef.current = null;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => triggerSuggestion(newText), settings.triggerDelayMs);
  };

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerText !== content) {
      editorRef.current.innerText = content;
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [content]);

  const handleCopyAccepted = async () => {
    if (lastAccepted) {
      await writeClipboard(lastAccepted);
    }
  };

  return (
    <div className="w-full relative" id="ghost-editor">

      {/* Editor */}
      <div className="relative min-h-40 bg-white/2 border border-white/5 rounded-2xl p-6 overflow-hidden hover:border-white/10 transition-colors duration-150 focus-within:border-white/15">

        {/* Generating indicator */}
        {isGenerating && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-white/40 ghost-dot"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}

        {/* Contenteditable input */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className="relative z-10 w-full min-h-30 outline-none text-lg text-white whitespace-pre-wrap wrap-break-word font-sans leading-relaxed caret-white selection:bg-white/15"
          spellCheck={false}
          data-placeholder="Start typing to see AI-powered suggestions..."
        />

        {/* Ghost suggestion overlay */}
        <div className="absolute top-6 left-6 right-6 pointer-events-none whitespace-pre-wrap text-lg font-sans leading-relaxed">
          {suggestion && (
            <span className="text-transparent select-none">
              <span className="invisible">{content}</span>
              <span
                className="italic ghost-suggestion-in"
                style={{ color: isGenerating ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.20)' }}
              >
                {suggestion}
                <span className="ghost-cursor" />
              </span>
            </span>
          )}
        </div>

        {/* Empty placeholder */}
        {content.length === 0 && !isGenerating && !suggestion && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-white/10 text-sm font-medium">Start typing to see AI-powered suggestions...</p>
          </div>
        )}
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between mt-3 px-1">
        <div className="text-[10px] text-white/15 font-mono">
          {content.length > 0 && `${content.split(/\s+/).filter(Boolean).length} words`}
        </div>
        <button
          onClick={handleCopyAccepted}
          className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/30 hover:text-white/70 transition-colors duration-100 ${lastAccepted ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          style={{ transition: 'opacity 200ms, color 100ms' }}
        >
          <Copy className="w-3 h-3" />
          Copy accepted
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        [contentEditable]:empty:before {
          content: attr(data-placeholder);
          color: rgba(255,255,255,0.08);
          pointer-events: none;
        }
      ` }} />
    </div>
  );
};
