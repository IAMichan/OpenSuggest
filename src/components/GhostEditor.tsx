import React, { useState, useRef, useEffect } from 'react';
import { getAutocompleteSuggestion } from '../services/aiService';
import { AppSettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Command } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

// Detect if we are running in the native desktop client (Tauri)
const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

interface GhostEditorProps {
  settings: AppSettings;
  onSettingsChange?: (settings: Partial<AppSettings>) => void;
}

export const GhostEditor: React.FC<GhostEditorProps> = ({ settings, onSettingsChange }) => {
  const [content, setContent] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      const acceptedText = suggestion;
      setContent(prev => prev + acceptedText);
      setSuggestion('');

      // Update global autocomplete stats
      if (onSettingsChange) {
        const wordCount = acceptedText.trim().split(/\s+/).filter(Boolean).length;
        onSettingsChange({ autocompletedCount: settings.autocompletedCount + wordCount });
      }

      // 🦀 Record accepted completion for personalization
      if (settings.collectInputs && isDesktop) {
        invoke('save_typing_fragment', { fragment: acceptedText })
          .then((newCount) => {
            if (onSettingsChange) onSettingsChange({ historyCount: newCount as number });
          })
          .catch(console.error);
      }
    } else if (e.key === 'Escape') {
      setSuggestion('');
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newText = e.currentTarget.innerText;
    
    // 🦀 Record unaccepted inputs if enabled
    if (settings.collectInputs && settings.storeUnaccepted && isDesktop && newText.length > content.length) {
      const lastChar = newText.slice(-1);
      if (lastChar === ' ') {
        const words = newText.trim().split(' ');
        const lastWord = words[words.length - 1];
        if (lastWord) {
          invoke('save_typing_fragment', { fragment: lastWord })
            .then((newCount) => {
              if (onSettingsChange) onSettingsChange({ historyCount: newCount as number });
            })
            .catch(console.error);
        }
      }
    }

    setContent(newText);
    setSuggestion('');
    setIsTyping(true);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (settings.isEnabled && newText.trim().length > 3) {
      timeoutRef.current = setTimeout(async () => {
        setIsTyping(false);
        const result = await getAutocompleteSuggestion(newText, settings.modelId, settings.personalizationStrength);
        setSuggestion(result);
      }, 300);
    }
  };

  // Restore cursor position after state-driven content update
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerText !== content) {
      // Small hack to keep cursor at end for simplicity in this demo
      editorRef.current.innerText = content;
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [content]);

  return (
    <div className="w-full max-w-2xl mx-auto glass-card p-8 relative" id="ghost-editor">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Engine Active</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Global Input monitoring</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-mono">
          <span className="flex items-center gap-1 font-bold"><kbd className="bg-muted px-1 rounded border border-border">TAB</kbd> Accept</span>
        </div>
      </div>

      <div className="relative text-base leading-relaxed min-h-[140px] outline-none">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className="relative z-10 w-full min-h-[140px] outline-none text-foreground whitespace-pre-wrap break-words font-sans selection:bg-primary/20"
          spellCheck={false}
          data-placeholder="Start typing in any app to see Rust-powered suggestions..."
        />
        
        {/* Ghost Overlay simulation */}
        <div className="absolute top-0 left-0 w-full pointer-events-none text-muted-foreground/30 whitespace-pre-wrap">
           <AnimatePresence>
            {suggestion && !isTyping && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-muted-foreground/30 inline"
              >
                {/* Visual hack: we just show the suggestion at the end of the content hidden area if possible, 
                    but in this simple demo we just show it floating for effect */}
                <span className="invisible select-none overflow-hidden h-0 block">{content}</span>
                <span className="bg-primary/5 rounded px-1 border-b border-primary/30 text-primary/40 ml-1">
                  {suggestion}
                  <motion.span 
                    animate={{ opacity: [1, 0, 1] }} 
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="inline-block w-[1.5px] h-4 bg-primary ml-0.5 align-middle" 
                  />
                </span>
              </motion.span>
            )}
           </AnimatePresence>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        [contentEditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--color-muted-foreground);
          opacity: 0.3;
        }
      `}} />
    </div>
  );
};
