import React from 'react';
import { Zap, ArrowRight, Terminal, Command, Sparkles, Keyboard, ShieldCheck, Cpu, Monitor } from 'lucide-react';
import { motion } from 'motion/react';
import { DOWNLOAD_LINKS } from '../constants';
import { AppleLogo, WindowsLogo } from './BrandLogos';
import { AppIcon } from './AppIcon';
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
  const highlights = [
    { icon: Sparkles, title: 'Less rewriting', desc: 'OpenSuggest catches repetitive phrasing and proposes cleaner continuations.' },
    { icon: Command, title: 'Less context switching', desc: 'Suggestions follow your active app, so you stay in the same writing loop.' },
    { icon: ShieldCheck, title: 'More private flow', desc: 'Everything runs locally with your own model and local context layers.' },
  ];

  const testimonialCards = [
    { quote: "I write faster and the suggestions feel surprisingly natural.", author: "Nina Verhoeven", role: "Product Designer" },
    { quote: "Finally a writing assistant that feels native across apps.", author: "Lucas van Wijk", role: "Founder" },
    { quote: "The local-first setup was exactly what we needed for privacy.", author: "Emma de Vries", role: "Engineering Lead" },
    { quote: "TAB accept is so smooth it disappears into muscle memory.", author: "Sam Rood", role: "Indie Developer" },
  ];

  const flowFeatures = [
    { icon: Sparkles, title: 'Heads-up suggestions', desc: 'See ghost text early so completions never feel abrupt.' },
    { icon: Keyboard, title: 'One key accept', desc: 'Accept instantly with TAB and keep momentum while writing.' },
    { icon: Command, title: 'System-wide context', desc: 'Suggestions adapt to the app and task you are currently in.' },
  ];

  const pauseContexts = [
    { icon: Monitor, label: 'Slack' },
    { icon: Cpu, label: 'VS Code' },
    { icon: Keyboard, label: 'Gmail' },
    { icon: Sparkles, label: 'Notion' },
    { icon: Command, label: 'Browser forms' },
  ];

  const customization = [
    { title: 'Model and tone control', desc: 'Choose your local model and tune completion style for every writing mode.' },
    { title: 'Local intelligence layers', desc: 'Blend screen context, clipboard context and history in one private pipeline.' },
    { title: 'Native desktop feel', desc: 'Fast startup, system-level integration and a UI that stays out of your way.' },
  ];

  const updates = [
    { title: 'OpenSuggest 1.1', desc: 'Faster cold starts, better local model detection and smoother overlay behavior.' },
    { title: 'OpenSuggest 1.0', desc: 'Global ghost text, cross-app suggestions and local-first setup launched.' },
    { title: 'Next up', desc: 'More presets, richer usage insights and deeper per-app controls.' },
  ];

  return (
    <div className="min-h-full bg-[#07070a] text-white overflow-hidden" id="welcome-page">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_22%_36%,rgba(255,255,255,0.10),transparent_34%),radial-gradient(circle_at_74%_28%,rgba(118,255,207,0.14),transparent_40%),radial-gradient(circle_at_56%_70%,rgba(130,170,220,0.12),transparent_36%),linear-gradient(to_bottom,rgba(5,5,7,0.72),rgba(5,5,7,1))]" />

      <div className="relative z-10 max-w-6xl mx-auto px-5 md:px-8 pt-5 md:pt-8 pb-18 md:pb-24">
        <section className="mb-12 md:mb-16">
          <div className="flex justify-center mb-10">
            <nav className="h-14 px-6 rounded-full border border-white/12 bg-white/[0.04] backdrop-blur-md inline-flex items-center gap-7 text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <AppIcon size={20} variant="full" />
                OpenSuggest
              </div>
              <a href="#welcome-page" className="text-white font-semibold">Home</a>
              <a href="#updates" className="text-white/70 hover:text-white transition-colors hidden md:block">Updates</a>
              <a href="#features" className="text-white/70 hover:text-white transition-colors hidden md:block">Features</a>
              <button onClick={() => onStart('download')} className="inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors font-semibold">
                <AppleLogo className="w-4 h-4" />
                Download
              </button>
            </nav>
          </div>

          <div className="text-center flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/[0.05] text-[13px] text-white/90 mb-8">
              <span className="px-2 py-0.5 rounded-full bg-[linear-gradient(to_right,#2b2f35,#4c6b62)] text-white text-[11px] font-semibold">OpenSuggest 1.0</span>
              Local writing, inside and out
              <ArrowRight className="w-3.5 h-3.5 opacity-70" />
            </div>

            <div className="mb-8 drop-shadow-[0_20px_60px_rgba(100,40,200,0.45)]">
              <AppIcon size={112} variant="full" />
            </div>

            <h1 className="text-[2.45rem] md:text-[4.4rem] leading-[0.98] font-display font-black max-w-4xl mb-6">
              The desktop app
              <br />
              your writing workflow thanks you for
            </h1>
            <p className="text-[1.15rem] md:text-[2rem] leading-[1.38] text-white/88 max-w-3xl mb-10">
              Smart completions, local context, and private-by-default ghost text that quietly helps you write better while you work.
            </p>

            <button
              onClick={() => onStart('download')}
              className="h-13 px-8 rounded-full bg-white text-black font-black text-[1.08rem] inline-flex items-center gap-3 hover:scale-[1.02] transition-transform"
            >
              <AppleLogo className="w-5 h-5" />
              Download for Desktop
            </button>
            <p className="mt-4 text-sm text-white/50 font-mono">v1.0.0 • macOS 12+ • Windows 10/11 • Linux</p>
          </div>
        </section>

        <div className="h-[240px] md:h-[330px] rounded-[36px] bg-[linear-gradient(to_bottom,#c5d2de,#aebecf)] border border-white/20 shadow-[0_30px_120px_rgba(120,136,160,0.28)] overflow-hidden mb-[-96px] md:mb-[-120px] relative z-20">
          <div className="absolute left-1/2 -translate-x-1/2 bottom-5 w-[82%] h-12 rounded-2xl bg-black/70 border border-white/15" />
        </div>
      </div>

      <div className="relative z-10 bg-[radial-gradient(circle_at_82%_0%,rgba(118,255,207,0.12),transparent_34%),radial-gradient(circle_at_20%_10%,rgba(130,170,220,0.08),transparent_28%),#07070a] text-white pt-32 md:pt-40 pb-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 -translate-y-full bg-[linear-gradient(to_bottom,rgba(7,7,10,0),#07070a_85%)]" />
        <div className="max-w-6xl mx-auto px-5 md:px-8">

        <section className="mb-16 md:mb-20">
          <h2 className="text-4xl md:text-5xl font-display font-black leading-[1.02] mb-7">
            Faster writing. Less doubt.
            <br />
            More flow in every app.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {highlights.map((item) => (
              <article key={item.title} className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6 min-h-[190px]">
                <item.icon className="w-5 h-5 mb-3 text-white/75" />
                <h3 className="text-lg font-display font-black mb-2">{item.title}</h3>
                <p className="text-white/68 text-sm leading-relaxed">{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-20 md:mb-24">
          <h2 className="text-3xl md:text-5xl font-display font-black mb-7">Loved by focused builders</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {testimonialCards.map((item) => (
              <article key={item.quote} className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                <p className="text-lg text-white mb-4 leading-relaxed">"{item.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[linear-gradient(to_bottom_right,#334249,#6ba895)] border border-white/12 flex items-center justify-center text-[11px] font-black text-white/85">
                    {item.author.split(' ').map((part) => part[0]).join('')}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-white/76">{item.author}</p>
                    <p className="text-xs text-white/48">{item.role}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="flow" className="mb-20 md:mb-24">
          <h2 className="text-4xl md:text-6xl font-display font-black leading-tight mb-4">
            Suggestions that do not break your flow
          </h2>
          <p className="text-white/72 max-w-3xl mb-8 text-lg">
            OpenSuggest waits for the right moment, gives a subtle heads-up and lets you decide instantly whether to accept, skip or continue typing.
          </p>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8 mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1.08fr_0.92fr] gap-6 items-center">
              <div>
                <div className="rounded-xl border border-[#121212]/12 bg-[#101111] p-5">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/45 mb-3">Context live</p>
                  <p className="text-2xl font-display font-black mb-2 text-white">Suggestion ready for your current sentence</p>
                  <p className="text-white/55 mb-4">OpenSuggest reads local context and proposes the next phrase without breaking your typing rhythm.</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button className="px-4 py-2 rounded-lg bg-white text-[#121212] text-xs font-black uppercase tracking-[0.1em]">Accept</button>
                    <button className="px-4 py-2 rounded-lg bg-white/8 border border-white/15 text-white text-xs font-black uppercase tracking-[0.1em]">Skip</button>
                    <button className="px-4 py-2 rounded-lg bg-white/8 border border-white/15 text-white text-xs font-black uppercase tracking-[0.1em]">Rewrite</button>
                  </div>
                  <div className="h-[150px] rounded-lg border border-white/10 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-4 flex items-end">
                    <p className="text-sm text-white/65">Ghost text appears exactly at your cursor in the app you are using.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {flowFeatures.map((f) => (
                  <article key={f.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 min-h-[104px]">
                    <div className="flex items-center gap-3 mb-2">
                      <f.icon className="w-4 h-4 text-white/75" />
                      <h3 className="font-display font-black text-sm">{f.title}</h3>
                    </div>
                    <p className="text-sm text-white/68">{f.desc}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {pauseContexts.map((item) => (
              <div key={item.label} className="px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-xs uppercase tracking-[0.1em] text-white/65 flex items-center gap-2">
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </div>
            ))}
          </div>
        </section>

        <section id="demo" className="mb-20 md:mb-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-display font-black mb-4">
              System Playground
            </h2>
            <p className="text-white/55 text-xs font-black uppercase tracking-[0.12em]">Interactive local completion sandbox</p>
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
        </section>

        <section id="features" className="mb-20 md:mb-24">
          <h2 className="text-4xl md:text-6xl font-display font-black leading-tight mb-8">
            Fits your workflow like a glove
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {customization.map((item) => (
              <article key={item.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                <div className="h-28 rounded-lg border border-white/10 bg-[linear-gradient(to_right,rgba(118,255,207,0.22),rgba(130,170,220,0.16))] mb-4" />
                <h3 className="font-display font-black text-base mb-2">{item.title}</h3>
                <p className="text-sm text-white/68 leading-relaxed">{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-20 md:mb-24">
          <div className="rounded-2xl border border-[#121212]/10 bg-[#121212] text-white px-7 md:px-10 py-10 md:py-12">
            <p className="text-xs uppercase tracking-[0.12em] text-white/45 mb-3">Designed for desktop</p>
            <h2 className="text-4xl md:text-5xl font-display font-black mb-4">Built for Mac, Windows and Linux</h2>
            <p className="text-white/65 max-w-2xl mb-7">
              OpenSuggest is a native desktop app with fast global shortcuts, local model control and smooth overlay performance across your daily tools.
            </p>
            <button
              onClick={() => onStart('download')}
              className="h-11 px-5 bg-white text-[#121212] rounded-xl text-xs font-black uppercase tracking-[0.12em] inline-flex items-center gap-2"
            >
              Download OpenSuggest
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        <section id="updates" className="mb-20 md:mb-24">
          <h2 className="text-3xl md:text-5xl font-display font-black mb-7">Recent updates</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {updates.map((update) => (
              <article key={update.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                <p className="text-lg font-display font-black mb-3 text-white">{update.title}</p>
                <p className="text-white/68 text-sm leading-relaxed">{update.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="download" className="glass-card bg-[#121212] border-[#121212]/10 p-10 md:p-14 rounded-3xl text-center relative overflow-hidden mb-18 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(159,247,208,0.24),transparent_48%)]" />
          <h2 className="relative text-4xl md:text-6xl font-display font-black mb-6 leading-tight">
            Download OpenSuggest
          </h2>
          <p className="relative text-base text-white/65 max-w-2xl mx-auto mb-10">
            Install the native app for your platform and run local completions with no cloud dependency by default.
          </p>
          <div className="relative flex flex-wrap items-center justify-center gap-3">
            <a href={DOWNLOAD_LINKS.macos} className="flex items-center gap-3 px-5 py-3.5 bg-white text-black rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all">
              <AppleLogo className="w-5 h-5" />
              <div className="text-left">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Download for</p>
                <p className="text-sm font-black tracking-tight">macOS</p>
              </div>
            </a>
            <a href={DOWNLOAD_LINKS.windows} className="flex items-center gap-3 px-5 py-3.5 bg-[#0078D4] text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all">
              <WindowsLogo className="w-5 h-5" />
              <div className="text-left">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Download for</p>
                <p className="text-sm font-black tracking-tight">Windows</p>
              </div>
            </a>
            <a href={DOWNLOAD_LINKS.linux_appimage} className="flex items-center gap-3 px-5 py-3.5 bg-[#1f2823] border border-white/10 text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all">
              <LinuxLogo className="w-5 h-5 text-[#9ff7d0]" />
              <div className="text-left">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Download for</p>
                <p className="text-sm font-black tracking-tight">Linux</p>
              </div>
            </a>
          </div>
          <p className="relative text-[10px] text-white/35 mt-8 font-mono uppercase tracking-[0.12em]">
            v1.0.0 • macOS 12+ • Windows 10/11 • Ubuntu/Debian/Arch
          </p>
        </section>
      </div>

      <footer className="py-12 border-t border-white/8 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
        OpenSuggest 2026 • Local-first writing system
      </footer>
    </div>
    </div>
  );
};
