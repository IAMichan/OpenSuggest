import React from 'react';
import { Zap, ArrowRight, ShieldCheck, Cpu, Terminal, Download, Command, Lock, Sparkles, Keyboard, Settings2, Apple, Monitor } from 'lucide-react';
import { motion } from 'motion/react';
import { DOWNLOAD_LINKS } from '../constants';
import { AppleLogo, WindowsLogo } from './BrandLogos';
import { AppSettings } from '../types';

// Linux SVG logo
const LinuxLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.504 0C12.504 0 6.975 0 6.975 7.044c0 1.78.336 3.43.965 4.867C7.14 13.09 6.61 14.49 6.61 14.49s.41.02.75.02c.21 0 .43-.01.66-.04.86 3.53 3.52 6.01 3.52 6.01s-1.12.46-1.43 1.47c-.32 1.02.56 2 1.89 2 1.32 0 2.21-.98 1.89-2-.32-1.01-1.43-1.47-1.43-1.47s2.66-2.48 3.52-6.01c.23.03.45.04.66.04.34 0 .75-.02.75-.02s-.53-1.4-1.33-2.58c.63-1.44.97-3.08.97-4.868C17.03 0 12.504 0 12.504 0z"/>
  </svg>
);

// Playground with keyword-based suggestions
const Playground: React.FC<{ settings?: AppSettings; onSettingsChange?: (s: Partial<AppSettings>) => void }> = ({ settings, onSettingsChange }) => {
  const [content, setContent] = React.useState('');
  const [suggestion, setSuggestion] = React.useState('');
  const [acceptedCount, setAcceptedCount] = React.useState(0);
  const editorRef = React.useRef<HTMLDivElement>(null);

  const triggers: Record<string, string> = {
    'implement': 'ing a local neural engine for speed.',
    'privacy': ' is built into the architecture.',
    'local ai': ' ensures your data never leaves your RAM.',
    'fast': ' inference running directly on your GPU.',
    'download': ' the binary for complete typing sovereignty.',
    'open': 'Suggest delivers AI completions with zero cloud.',
    'we': ' believe privacy is a fundamental right.',
    'the': ' model runs entirely on your local hardware.',
  };

  const findSuggestion = (text: string) => {
    const lower = text.toLowerCase().trim();
    for (const [trigger, sug] of Object.entries(triggers)) {
      if (lower.endsWith(trigger)) return sug;
    }
    return '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      setContent((p) => p + suggestion);
      setSuggestion('');
      setAcceptedCount((p) => p + 1);
      if (onSettingsChange && settings) {
        const wc = suggestion.trim().split(/\s+/).filter(Boolean).length;
        onSettingsChange({ autocompletedCount: settings.autocompletedCount + wc });
      }
    } else if (e.key === 'Escape') {
      setSuggestion('');
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.innerText;
    setContent(text);
    const found = findSuggestion(text);
    setTimeout(() => setSuggestion(found), 80);
  };

  React.useEffect(() => {
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

  return (
    <div className="w-full">
      <div className="relative h-[200px] md:h-[260px] bg-white/[0.02] border border-white/5 rounded-3xl p-8 md:p-10 overflow-hidden hover:border-white/10 transition-all duration-500 group">
        {acceptedCount > 0 && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-4 left-4 bg-white text-black text-[9px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Zap size={9} className="fill-black" /> {acceptedCount} synced
          </motion.div>
        )}
        <div ref={editorRef} contentEditable suppressContentEditableWarning
          onInput={handleInput} onKeyDown={handleKeyDown}
          className="relative z-10 w-full h-full outline-none text-xl md:text-3xl text-white whitespace-pre-wrap break-words font-sans selection:bg-white/20 caret-white"
          spellCheck={false} data-placeholder="Type any word to begin..." />
        <div className="absolute top-8 md:top-10 left-8 md:left-10 w-[calc(100%-64px)] md:w-[calc(100%-80px)] pointer-events-none">
          {suggestion && (
            <div className="flex flex-wrap">
              <span className="invisible select-none h-0 overflow-hidden block">{content}</span>
              <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="text-white/20 italic text-xl md:text-3xl">
                {suggestion}
                <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} className="inline-block w-1.5 h-7 md:h-9 bg-white/30 ml-1.5 align-middle rounded-sm" />
              </motion.span>
            </div>
          )}
        </div>
        {content.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-white/8 text-sm uppercase tracking-[0.4em] font-black">Type to begin</p>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `[contentEditable]:empty:before{content:attr(data-placeholder);color:rgba(255,255,255,0.08)}` }} />
    </div>
  );
};

// WelcomePage — works in both web (browser) and desktop (inside app) mode
export const WelcomePage: React.FC<{
  onStart: (tab?: string) => void;
  settings?: AppSettings;
  onSettingsChange?: (s: Partial<AppSettings>) => void;
}> = ({ onStart, settings, onSettingsChange }) => {
  const features = [
    { icon: Command, title: 'GLOBAL HOOK', desc: 'Deep OS accessibility integration — suggestions appear in every app.' },
    { icon: Cpu, title: 'RUST KERNEL', desc: 'Sub-10ms inference cycles powered by memory-safe Rust and local silicon.' },
    { icon: Lock, title: 'SOVEREIGN DATA', desc: 'Training, inference and feedback happen entirely in your local RAM.' },
  ];

  const steps = [
    { step: '01', icon: Settings2, title: 'SELECT MODEL', desc: 'Choose from Gemma, Mistral, Llama, Phi and more.' },
    { step: '02', icon: Keyboard, title: 'TYPE FREELY', desc: 'Write in Slack, Mail, VS Code, or any other app.' },
    { step: '03', icon: Sparkles, title: 'GHOST FEED', desc: 'Contextual predictions appear as ghost text at your cursor.' },
    { step: '04', icon: Zap, title: 'TAB SYNC', desc: 'Instantly accept with TAB. Native, fast, effortless.' },
  ];

  return (
    <div className="min-h-full bg-black text-white overflow-hidden" id="welcome-page">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-white/4 to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 pt-20 pb-32">
        {/* Nav */}
        <nav className="flex items-center justify-between mb-24 md:mb-32">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 fill-white" />
            <span className="text-sm font-black uppercase tracking-[0.3em]">OpenSuggest</span>
          </div>
          <div className="hidden md:flex items-center gap-10 text-[10px] font-bold uppercase tracking-widest text-white/30">
            <a href="#features" className="hover:text-white transition-colors">Technology</a>
            <a href="#demo" className="hover:text-white transition-colors">Demo</a>
            <a href="#download" className="hover:text-white transition-colors">Download</a>
          </div>
          <button onClick={() => onStart('download')}
            className="px-5 py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform">
            Get the App
          </button>
        </nav>

        {/* Hero */}
        <div className="max-w-5xl mb-40 md:mb-60">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-white/70 uppercase tracking-[0.3em] mb-10">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            v1.0.0 — Zero Cloud, Zero Telemetry
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.8 }}
            className="text-6xl sm:text-8xl md:text-[10rem] font-display font-black tracking-[-0.07em] leading-[0.82] mb-12 uppercase">
            RADICAL <br />
            <span className="text-white/10">PRIVACY.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="text-xl md:text-2xl text-white/35 font-display font-bold leading-tight max-w-2xl mb-14 tracking-tight">
            No cloud. No telemetry. Your keystrokes never leave your machine. OpenSuggest runs local LLMs on your hardware.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex flex-wrap gap-4">
            <button onClick={() => onStart('download')}
              className="h-16 px-10 bg-white text-black font-display font-black uppercase tracking-[0.2em] text-sm rounded-2xl flex items-center gap-4 hover:scale-[1.02] transition-all shadow-2xl active:scale-[0.98]">
              Get Local Access <ArrowRight className="w-5 h-5" />
            </button>
            {settings && (
              <button onClick={() => onStart('demo')}
                className="h-16 px-10 bg-white/5 border border-white/10 text-white font-display font-black uppercase tracking-[0.2em] text-sm rounded-2xl hover:bg-white/8 transition-all flex items-center gap-4">
                Try Playground <Terminal className="w-5 h-5 opacity-30" />
              </button>
            )}
          </motion.div>
        </div>

        {/* Feature Grid */}
        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/8 border border-white/8 rounded-[32px] overflow-hidden mb-32 md:mb-40">
          {features.map((f, i) => (
            <div key={i} className="bg-black p-12 hover:bg-white/[0.025] transition-all duration-500 group">
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-8 group-hover:bg-white group-hover:text-black transition-all duration-500 ring-1 ring-white/8">
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-display font-black mb-4 tracking-tight uppercase">{f.title}</h3>
              <p className="text-sm text-white/30 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Steps */}
        <div className="mb-32 md:mb-40 text-center">
          <h2 className="text-5xl md:text-7xl font-display font-black tracking-tighter mb-16 uppercase">
            FOUR STEPS TO <span className="text-white/10">SOVEREIGNTY</span>
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 px-4">
            {steps.map((s, i) => (
              <div key={i} className="text-left group">
                <div className="text-7xl font-display font-black text-white/[0.03] mb-6">{s.step}</div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center ring-1 ring-white/8">
                    <s.icon className="w-5 h-5 text-white/70" />
                  </div>
                  <h4 className="font-display font-black text-base tracking-tight uppercase">{s.title}</h4>
                </div>
                <p className="text-sm text-white/30 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Playground */}
        <div id="demo" className="mb-32 md:mb-40">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-display font-black tracking-tighter mb-4 uppercase">
              SYSTEM <span className="text-white/10">PLAYGROUND</span>
            </h2>
            <p className="text-white/25 text-xs font-black uppercase tracking-[0.4em]">Interactive Neural Terminal</p>
          </div>
          <div className="max-w-4xl mx-auto glass-card border-white/8 rounded-[40px] overflow-hidden bg-black">
            <div className="h-12 bg-white/[0.025] border-b border-white/5 flex items-center px-6 gap-3">
              <div className="flex gap-2"><div className="w-2.5 h-2.5 rounded-full bg-white/10" /><div className="w-2.5 h-2.5 rounded-full bg-white/10" /><div className="w-2.5 h-2.5 rounded-full bg-white/10" /></div>
              <div className="flex items-center gap-2 mx-auto px-3 py-1 bg-white/5 rounded-full border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/35">Local Inference Active</span>
              </div>
            </div>
            <div className="p-10 md:p-16">
              <Playground settings={settings} onSettingsChange={onSettingsChange} />
            </div>
            <div className="px-10 py-6 bg-white/[0.01] border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-display font-black uppercase tracking-widest text-white/25">
                <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]" />Local Core
              </div>
              <div className="text-xs font-display font-black uppercase tracking-widest text-white/20 flex items-center gap-2">
                <kbd className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/8 font-mono text-xs text-white/60">TAB</kbd>
                to accept
              </div>
            </div>
          </div>
        </div>

        {/* Download CTA */}
        <div id="download" className="glass-card bg-white/[0.015] border-white/5 p-16 md:p-24 rounded-[48px] text-center relative overflow-hidden mb-24">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-[150px] pointer-events-none translate-x-1/2 -translate-y-1/2" />
          <h2 className="text-5xl md:text-8xl font-display font-black mb-8 tracking-tighter uppercase leading-[0.85]">
            EVOLVE YOUR <br /><span className="text-white/10">WORKFLOW</span>
          </h2>
          <p className="text-lg text-white/25 font-display font-bold max-w-xl mx-auto mb-14 tracking-tight">
            Get the native binary for your operating system. Ollama installs automatically on first launch.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* macOS */}
            <a href={DOWNLOAD_LINKS.macos} className="flex items-center gap-3 px-5 py-3.5 bg-white text-black rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all">
              <AppleLogo className="w-5 h-5" />
              <div className="text-left">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Download for</p>
                <p className="text-sm font-black tracking-tight">macOS</p>
              </div>
            </a>
            {/* Windows */}
            <a href={DOWNLOAD_LINKS.windows} className="flex items-center gap-3 px-5 py-3.5 bg-[#0078D4] text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all">
              <WindowsLogo className="w-5 h-5" />
              <div className="text-left">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Download for</p>
                <p className="text-sm font-black tracking-tight">Windows</p>
              </div>
            </a>
            {/* Linux */}
            <a href={DOWNLOAD_LINKS.linux_appimage} className="flex items-center gap-3 px-5 py-3.5 bg-orange-500/20 border border-orange-500/30 text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all">
              <LinuxLogo className="w-5 h-5 text-orange-400" />
              <div className="text-left">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Download for</p>
                <p className="text-sm font-black tracking-tight">Linux</p>
              </div>
            </a>
          </div>
          <p className="text-[10px] text-white/15 mt-8 font-mono uppercase tracking-widest">
            v1.0.0 • macOS 12+ • Windows 10/11 • Ubuntu/Debian/Arch
          </p>
        </div>
      </div>

      <footer className="py-16 border-t border-white/5 text-center text-[10px] font-bold uppercase tracking-[0.4em] text-white/15">
        Engineered for total sovereignty • OpenSuggest 2026 • Open Source
      </footer>
    </div>
  );
};
