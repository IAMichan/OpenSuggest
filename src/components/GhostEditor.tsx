import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getCompletion } from '../services/aiService';
import { recordSuggestion } from '../services/statsService';
import { readClipboard } from '../services/clipboardService';
import { AppSettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Clipboard, Copy } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

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

  const triggerSuggestion = useCallback(
    async (text: string) => {
      if (!settings.isEnabled || text.trim().length < settings.minCharsForSuggestion) {
        setSuggestion('');
        return;
      }

      setIsGenerating(true);

      // Gather context
      const clipboardCtx = settings.clipboardEnabled ? await readClipboard() : '';

      const historyCtx = isDesktop
        ? await invoke<string[]>('db_get_history', { limit: 10 })
            .then((items) => items.slice(0, 5).join('. '))
            .catch(() => '')
        : '';

      const result = await getCompletion(text, settings.modelId, settings.ollamaUrl, {
        screenContext: settings.screenContextEnabled ? screenContext : '',
        clipboardContext: clipboardCtx,
        historyContext: historyCtx,
      });

      setIsGenerating(false);
      if (result) setSuggestion(result);
    },
    [settings, screenContext]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();

      // Find the boundary between the first word and the rest of the suggestion.
      const leadingSpace = suggestion.startsWith(' ') ? 1 : 0;
      const splitIdx = suggestion.indexOf(' ', leadingSpace + 1);

      if (splitIdx === -1) {
        // Last (or only) word — accept everything, then immediately ask for the next suggestion
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

        // Immediately think ahead — no debounce after Tab
        triggerSuggestion(newContent);
      } else {
        // Accept first word, keep the rest, AND immediately re-generate based on new content
        const firstWord = suggestion.slice(0, splitIdx);
        const rest = suggestion.slice(splitIdx); // starts with ' '
        const newContent = content + firstWord;
        setContent(newContent);
        setSuggestion(rest);

        // Proactively generate a fresh follow-up suggestion in the background
        triggerSuggestion(newContent);
      }
    } else if (e.key === 'Escape') {
      setSuggestion('');
      if (suggestion) recordSuggestion(false, 0);
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newText = e.currentTarget.innerText;
    setContent(newText);
    setSuggestion('');
    setIsGenerating(false);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => triggerSuggestion(newText), settings.triggerDelayMs);
  };

  // Sync content to editor div without losing cursor
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
      const { writeClipboard } = await import('../services/clipboardService');
      await writeClipboard(lastAccepted);
    }
  };

  return (
    <div className="w-full relative" id="ghost-editor">

      {/* Editor */}
      <div className="relative min-h-[160px] bg-white/[0.02] border border-white/5 rounded-2xl p-6 overflow-hidden hover:border-white/10 transition-all duration-300 focus-within:border-white/15">
        {/* Generating indicator */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-4 right-4 flex items-center gap-1.5"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.2, 1, 0.2], y: [0, -4, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  className="w-1 h-1 rounded-full bg-white/40"
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Contenteditable input */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className="relative z-10 w-full min-h-[120px] outline-none text-lg text-white whitespace-pre-wrap break-words font-sans leading-relaxed caret-white selection:bg-white/15"
          spellCheck={false}
          data-placeholder="Start typing to see AI-powered suggestions..."
        />

        {/* Ghost suggestion overlay */}
        <div className="absolute top-6 left-6 right-6 pointer-events-none whitespace-pre-wrap text-lg font-sans leading-relaxed">
          <AnimatePresence>
            {suggestion && !isGenerating && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-transparent select-none"
              >
                <span className="invisible">{content}</span>
                <span className="text-white/20 italic">
                  {suggestion}
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                    className="inline-block w-[2px] h-[1.1em] bg-white/30 ml-0.5 align-text-bottom rounded-sm"
                  />
                </span>
              </motion.span>
            )}
          </AnimatePresence>
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
        {lastAccepted && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={handleCopyAccepted}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/30 hover:text-white/70 transition-colors"
          >
            <Copy className="w-3 h-3" />
            Copy accepted
          </motion.button>
        )}
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
