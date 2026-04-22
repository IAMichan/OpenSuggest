import React from 'react';
import { 
  Zap, 
  ArrowRight, 
  ShieldCheck, 
  Cpu, 
  Terminal, 
  Download, 
  ChevronRight,
  Monitor,
  Apple,
  Globe,
  Sparkles,
  Command,
  Lock,
  ArrowDown,
  Focus,
  Keyboard,
  Settings2,
  Share2,
  MousePointer2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DOWNLOAD_LINKS } from '../constants';
import { AppleLogo, WindowsLogo } from './BrandLogos';
import { AppSettings } from '../types';

const playgroundSuggestions: Record<string, string> = {
  "implement": "ing a local neural engine for speed.",
  "privacy": " is built into the architecture of the app.",
  "local ai": " ensures your data never leaves your RAM.",
  "world's": " fastest autocomplete for desktop natively.",
  "fast": " inference running directly on your GPU.",
  "download": " the binary for absolute typing sovereignty.",
};

const Playground: React.FC<{ settings: AppSettings; onSettingsChange: (s: Partial<AppSettings>) => void }> = ({ settings, onSettingsChange }) => {
  const [content, setContent] = React.useState("");
  const [suggestion, setSuggestion] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(false);
  const [acceptedCount, setAcceptedCount] = React.useState(0);
  const editorRef = React.useRef<HTMLDivElement>(null);

  const findSuggestion = (text: string) => {
    const lower = text.toLowerCase().trim();
    for (const [trigger, suggest] of Object.entries(playgroundSuggestions)) {
      if (lower.endsWith(trigger)) return suggest;
    }
    return "";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      setContent(prev => prev + suggestion);
      setSuggestion("");
      setAcceptedCount(prev => prev + 1);

      // Update global stats
      const wordCount = suggestion.trim().split(/\s+/).filter(Boolean).length;
      onSettingsChange({ autocompletedCount: settings.autocompletedCount + wordCount });
    } else if (e.key === 'Escape') {
      setSuggestion("");
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newText = e.currentTarget.innerText;
    setContent(newText);
    setIsTyping(true);
    
    const found = findSuggestion(newText);
    if (found) {
      setTimeout(() => {
        setSuggestion(found);
        setIsTyping(false);
      }, 100); // Faster response
    } else {
      setSuggestion("");
    }
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
    <div className="w-full relative group">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          {acceptedCount > 0 && (
             <motion.div 
               initial={{ scale: 0, opacity: 0 }} 
               animate={{ scale: 1, opacity: 1 }} 
               className="bg-white text-black text-[8px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1.5"
             >
                <Zap size={8} className="fill-black" />
                {acceptedCount} Tokens Synced
             </motion.div>
          )}
        </div>
        <div className="flex gap-4 text-[9px] font-bold uppercase tracking-[0.2em] text-white/20">
          <span className="flex items-center gap-1.5"><kbd className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-white/50 font-mono">TAB</kbd> ACCEPT</span>
          <span className="flex items-center gap-1.5"><kbd className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-white/50 font-mono">ESC</kbd> WIPE</span>
        </div>
      </div>

      <div className="relative text-xl md:text-4xl font-medium tracking-tight h-[240px] bg-white/[0.02] border border-white/5 rounded-3xl p-10 overflow-hidden group-hover:border-white/15 transition-all duration-500 shadow-inner">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className="relative z-10 w-full h-full outline-none text-white whitespace-pre-wrap break-words font-sans selection:bg-white/20 caret-white"
          spellCheck={false}
          data-placeholder="Type any word to begin..."
        />
        
        <div className="absolute top-10 left-10 w-[calc(100%-80px)] pointer-events-none text-white/20">
            {suggestion && !isTyping && (
              <div className="flex flex-wrap">
                <span className="invisible select-none overflow-hidden h-0 block">{content}</span>
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-white/25 italic font-normal"
                >
                  {suggestion}
                  <motion.span 
                    animate={{ opacity: [1, 0, 1] }} 
                    transition={{ duration: 1, repeat: Infinity }}
                    className="inline-block w-1.5 h-8 md:h-10 bg-white/40 ml-1.5 align-middle" 
                  />
                </motion.span>
              </div>
            )}
        </div>

        {content.length === 0 && (
           <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-4">
              <motion.div 
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-white/5 uppercase tracking-[0.5em] text-[10px] font-black"
              >
                 Inference Standby // Input Required
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-6 py-2 rounded-full border border-white/5 bg-white/[0.02] text-[11px] font-bold text-white/30 uppercase tracking-widest backdrop-blur-sm"
              >
                Type a word to start suggestions
              </motion.div>
           </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        [contentEditable]:empty:before {
          content: attr(data-placeholder);
          color: rgba(255, 255, 255, 0.15);
        }
      `}} />
    </div>
  );
};

export const WelcomePage: React.FC<{ 
  onStart: (tab: string) => void;
  settings: AppSettings;
  onSettingsChange: (s: Partial<AppSettings>) => void;
}> = ({ onStart, settings, onSettingsChange }) => {
  const [showGuide, setShowGuide] = React.useState(false);

  const handleDownload = (platform: 'macos' | 'windows') => {
    const link = DOWNLOAD_LINKS[platform];
    if (link.startsWith('#')) {
      setShowGuide(true);
    } else {
      window.location.href = link;
    }
  };

  return (
    <div className="min-h-full bg-black text-white relative overflow-hidden" id="welcome-page">
      <AnimatePresence>
        {showGuide && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-neutral-900 border border-white/10 p-12 rounded-[32px] text-center"
            >
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-8">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-bold mb-6">Build-stap vereist</h3>
              <p className="text-white/40 mb-10 leading-relaxed text-sm">
                Je codebase is macOS-ready, maar als AI kan ik geen gecompileerde <code className="text-white">.dmg</code> versturen. <br/><br/>
                <strong>Zo maak je hem:</strong> Export het project via de knop rechtsboven, open de map op je Mac en run <code className="text-white">npm run tauri build</code>.
              </p>
              <button 
                onClick={() => setShowGuide(false)}
                className="w-full h-14 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl"
              >
                Ik ga aan de slag
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-8 pt-24 pb-32">
        {/* Nav Header (Landing Style) */}
        <nav className="flex items-center justify-between mb-32">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 fill-white" />
            <span className="text-sm font-black uppercase tracking-[0.3em]">OpenSuggest</span>
          </div>
          <div className="hidden md:flex items-center gap-12 text-[10px] font-bold uppercase tracking-widest text-white/40">
            <a href="#features" className="hover:text-white transition-colors">Technology</a>
            <a href="#security" className="hover:text-white transition-colors">Privacy</a>
            <a href="#download" className="hover:text-white transition-colors">OS Support</a>
          </div>
          <button 
            onClick={() => onStart('download')}
            className="px-6 py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform"
          >
            Get the App
          </button>
        </nav>

        {/* Hero Section */}
        <div className="max-w-5xl mb-60">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-white/80 uppercase tracking-[0.3em] mb-12"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            V2.1 Production Core is LIVE
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.8 }}
            className="text-8xl md:text-[11rem] font-display font-black tracking-[-0.07em] leading-[0.8] mb-16 uppercase"
          >
            RADICAL <br/> 
            <span className="text-white/10">PRIVACY.</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl md:text-3xl text-white/40 font-display font-bold leading-tight max-w-3xl mb-20 tracking-tight"
          >
            No cloud. No telemetry. Your keystrokes never leave your machine. OpenSuggest runs state-of-the-art LLMs natively on your hardware.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap gap-8"
          >
            <button 
              onClick={() => onStart('download')}
              className="h-20 px-12 bg-white text-black font-display font-black uppercase tracking-[0.2em] text-sm rounded-3xl flex items-center gap-6 hover:scale-[1.03] transition-all shadow-2xl active:scale-[0.98]"
            >
              Get Local Access
              <ArrowRight className="w-6 h-6" />
            </button>
            <button 
               onClick={() => onStart('settings')}
               className="h-20 px-12 bg-white/5 border border-white/10 text-white font-display font-black uppercase tracking-[0.2em] text-sm rounded-3xl hover:bg-white/10 transition-all flex items-center gap-6 active:scale-[0.98]"
            >
              Control Center
              <Terminal className="w-6 h-6 opacity-30" />
            </button>
          </motion.div>
        </div>

        {/* Feature Grid */}
        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-[40px] overflow-hidden mb-40 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]">
          {[
            { 
              icon: Command, 
              title: "GLOBAL HOOK", 
              desc: "Deep integration into the OS accessibility layer allows autocomplete to function in every single text area natively." 
            },
            { 
              icon: Cpu, 
              title: "RUST KERNEL", 
              desc: "Engineered with memory-safe Rust for sub-10ms inference cycles directly on your local silicon." 
            },
            { 
              icon: Lock, 
              title: "SOVEREIGN DATA", 
              desc: "Training, inference, and feedback loops happen entirely in your local RAM. We physically cannot see your data." 
            }
          ].map((feature, i) => (
            <div key={i} className="bg-black p-16 hover:bg-white/[0.03] transition-all duration-500 group relative">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-10 group-hover:bg-white group-hover:text-black transition-all duration-500 overflow-hidden ring-1 ring-white/10">
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-display font-black mb-6 tracking-tight uppercase">{feature.title}</h3>
              <p className="text-base text-white/30 leading-relaxed font-medium">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* How It Works Section */}
        <div className="mb-60">
          <div className="text-center mb-32">
            <h2 className="text-6xl md:text-8xl font-display font-black tracking-tighter mb-8 uppercase leading-none">FOUR STEPS TO <br/> <span className="text-white/10">SOVEREIGNTY</span></h2>
            <div className="w-24 h-1 bg-white mx-auto opacity-10" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-20 px-8">
            {[
              {
                step: "01",
                icon: Settings2,
                title: "SELECT CORE",
                desc: "Choose from optimized quantized versions of Llama 3, Mistral, or Google Gemma."
              },
              {
                step: "02",
                icon: Keyboard,
                title: "WRITE FREELY",
                desc: "Type as usual in Slack, Mail, VS Code, or any other application you use."
              },
              {
                step: "03",
                icon: Sparkles,
                title: "GHOST FEED",
                desc: "Contextually relevant predictions appear as non-intrusive overlays at your cursor."
              },
              {
                step: "04",
                icon: Zap,
                title: "TAB SYNC",
                desc: "Instantly merge predictions with your buffer using TAB. Native, fast, effortless."
              }
            ].map((step, i) => (
              <div key={i} className="relative group p-4">
                <div className="text-8xl font-display font-black text-white/[0.03] mb-10 group-hover:text-white/5 transition-all duration-700 leading-none">{step.step}</div>
                <div className="flex items-center gap-5 mb-8">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center ring-1 ring-white/10 group-hover:ring-white/30 transition-all">
                    <step.icon className="w-6 h-6 text-white/80" />
                  </div>
                  <h4 className="font-display font-black text-xl tracking-tight uppercase">{step.title}</h4>
                </div>
                <p className="text-base text-white/30 leading-relaxed font-medium">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Live Preview Demo */}
        <div className="mb-60 relative">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-full h-[800px] bg-primary/5 rounded-full blur-[160px] pointer-events-none opacity-50" />
          
          <div className="text-center mb-24 relative z-10">
             <h2 className="text-5xl md:text-7xl font-display font-black tracking-tighter mb-6 uppercase flex flex-col md:flex-row items-center justify-center gap-4">
                <span>SYSTEM</span>
                <span className="text-white/10">PLAYGROUND</span>
             </h2>
             <p className="text-white/30 uppercase tracking-[0.4em] text-[10px] font-black">Interactive Neural Terminal v2.1</p>
          </div>

          <div className="max-w-5xl mx-auto glass-card border-white/10 rounded-[48px] overflow-hidden shadow-[0_80px_150px_-30px_rgba(0,0,0,0.7)] bg-black relative z-10">
             <div className="h-14 bg-white/[0.03] border-b border-white/5 flex items-center px-8 gap-4">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="flex items-center gap-2 px-4 py-1 bg-white/5 rounded-full border border-white/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Sovereign_Kernel_0xf2</span>
                  </div>
                </div>
             </div>
             
             <div className="p-16 md:p-32 flex flex-col items-center justify-center min-h-[450px]">
                <div className="w-full">
                  <Playground settings={settings} onSettingsChange={onSettingsChange} />
                </div>
             </div>

             <div className="px-12 py-10 bg-white/[0.01] border-t border-white/5 flex flex-wrap items-center justify-between gap-8">
                <div className="flex items-center gap-10">
                   <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                      <span className="text-xs font-display font-black uppercase tracking-widest text-white/70">Local Core</span>
                   </div>
                   <div className="h-6 w-px bg-white/10" />
                   <div className="text-xs font-display font-bold uppercase tracking-widest text-white/30 flex items-center gap-2">
                      <Cpu size={14} />
                      Latency: <span className="text-white/60">08ms</span>
                   </div>
                </div>
                <div className="flex items-center gap-6">
                   <div className="flex items-center gap-3 text-xs font-display font-black uppercase tracking-widest text-white/30">
                      <kbd className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/80 font-mono text-sm leading-none flex items-center justify-center">TAB</kbd>
                      to sync thought
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Interactive Preview Ticker */}
        <div className="mb-40">
           <div className="flex items-center gap-4 mb-8 text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
              <div className="h-px bg-white/10 flex-1" />
              Supported Tech Stack
              <div className="h-px bg-white/10 flex-1" />
           </div>
           <div className="flex flex-wrap items-center justify-center gap-16 opacity-20 grayscale hover:grayscale-0 transition-all">
              <div className="flex items-center gap-3 font-bold text-2xl">Rust</div>
              <div className="flex items-center gap-3 font-bold text-2xl">Ollama</div>
              <div className="flex items-center gap-3 font-bold text-2xl">Tauri</div>
              <div className="flex items-center gap-3 font-bold text-2xl">Mistral</div>
              <div className="flex items-center gap-3 font-bold text-2xl">Gemma</div>
           </div>
        </div>

        {/* Final CTA */}
        <div id="download" className="glass-card bg-white/[0.02] border-white/5 p-32 rounded-[64px] text-center relative overflow-hidden mb-40">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[160px] pointer-events-none opacity-50 translate-x-1/2 -translate-y-1/2" />
          <h2 className="text-6xl md:text-9xl font-display font-black mb-12 tracking-tighter uppercase leading-[0.8]">EVOLVE YOUR <br/> <span className="text-white/10">WORKFLOW</span></h2>
          <p className="text-2xl text-white/30 font-display font-bold max-w-2xl mx-auto mb-20 tracking-tight">
            Join the movement towards decentralized AI. Get the native binaries for your hardware today.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button 
              onClick={() => handleDownload('macos')}
              className="group relative flex items-center gap-4 px-6 py-4 bg-white text-black rounded-xl transition-all hover:scale-[1.02] hover:shadow-[0_15px_30px_rgba(255,255,255,0.15)] active:scale-[0.98]"
            >
              <div className="flex items-center justify-center">
                <AppleLogo className="w-6 h-6 text-black" />
              </div>
              <div className="text-left leading-tight">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-0.5">Download for</p>
                <p className="text-base font-black tracking-tight">macOS Universal</p>
                <p className="text-[8px] font-bold opacity-30 mt-0.5 uppercase tracking-wider">v2.1.0 • 45MB • Universal</p>
              </div>
            </button>

            <button 
               onClick={() => handleDownload('windows')}
               className="group relative flex items-center gap-4 px-6 py-4 bg-[#0078D4] text-white rounded-xl transition-all hover:scale-[1.02] hover:shadow-[0_15px_30px_rgba(0,120,212,0.25)] active:scale-[0.98]"
            >
              <div className="flex items-center justify-center">
                <WindowsLogo className="w-6 h-6 text-white" />
              </div>
              <div className="text-left leading-tight">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5 text-white">Download for</p>
                <p className="text-base font-black tracking-tight">Windows x64</p>
                <p className="text-[8px] font-bold opacity-60 mt-0.5 uppercase tracking-wider">v2.1.0 • 52MB • Win 10/11</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      <footer className="py-20 border-t border-white/5 text-center text-[10px] font-bold uppercase tracking-[0.4em] text-white/20">
        Engineered for total sovereignty • 2026
      </footer>
    </div>
  );
};
