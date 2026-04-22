import React from 'react';
import { Apple, Monitor, Download, ArrowRight, ShieldCheck, Zap, Share2, Terminal, Info, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const DownloadView: React.FC = () => {
  const [showExportGuide, setShowExportGuide] = React.useState(false);

  const platforms = [
    { 
      id: 'macos', 
      name: 'macOS (Apple Silicon/Intel)', 
      icon: Apple, 
      ext: '.dmg',
      status: 'Ready to Build',
      color: 'bg-primary/20',
      description: 'Zodra je dit op je Mac bouwt, kun je de .dmg hier aan de knop koppelen.'
    },
    { 
      id: 'windows', 
      name: 'Windows 10/11', 
      icon: Monitor, 
      ext: '.msi',
      status: 'Ready to Build',
      color: 'bg-blue-500/10',
      description: 'De Windows MSI-configuratie staat 100% klaar in de broncode.'
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-16 max-w-6xl mx-auto" id="download-view">
      <AnimatePresence>
        {showExportGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/95 backdrop-blur-3xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl glass-card p-12 shadow-2xl border-primary/40 text-left"
            >
              <div className="flex items-start justify-between mb-8">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-primary" />
                </div>
                <button 
                  onClick={() => setShowExportGuide(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-2"
                >
                  <ArrowRight className="w-6 h-6 rotate-180" />
                </button>
              </div>

              <h3 className="text-3xl font-bold text-foreground mb-6">Installatie op jouw Laptop</h3>
              <div className="space-y-6 text-muted-foreground mb-10 leading-relaxed text-left">
                <p>
                  Omdat je een <strong>Apple laptop</strong> hebt, ben jij degene die de "verzegeling" op de app zet. Zodra je de export hieronder doet, heb je maar 1 commando nodig om je eigen <code className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-xs">.dmg</code> te krijgen.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-muted/50 p-6 rounded-2xl border border-border">
                    <p className="text-xs font-bold text-primary uppercase mb-2">Stap 1</p>
                    <p className="text-sm text-foreground mb-2">Export ZIP</p>
                    <p className="text-xs">Download alle code die ik voor je geschreven heb via de knop rechtsboven.</p>
                  </div>
                  <div className="bg-muted/50 p-6 rounded-2xl border border-border">
                    <p className="text-xs font-bold text-primary uppercase mb-2">Stap 2 (Op je Mac)</p>
                    <p className="text-sm text-foreground mb-2">Build .dmg</p>
                    <p className="text-xs italic text-emerald-500">npm run tauri build</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowExportGuide(false)}
                className="ipulse-button-primary w-full h-14"
              >
                Start de Export
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <header className="mb-20 text-center max-w-3xl mx-auto">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-widest mb-6"
        >
          <Zap className="w-3 h-3" />
          Native Hub
        </motion.div>
        <h1 className="text-5xl lg:text-7xl font-bold text-foreground tracking-tight leading-tight mb-8">
          Download <span className="text-primary italic">Center</span>
        </h1>
        <p className="text-xl text-muted-foreground leading-relaxed">
          Zodra je het project bouwt op je Mac, heb je een volledige Windows en macOS installer.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
        {platforms.map((platform) => (
          <div key={platform.id} className="glass-card p-10 border-border/50 hover:border-primary/20 transition-all duration-300">
             <div className="flex items-center gap-4 mb-8">
                <div className={`p-4 ${platform.color} rounded-2xl`}>
                  <platform.icon size={32} className="text-foreground" />
                </div>
                <div>
                   <h3 className="text-2xl font-bold text-foreground">{platform.name}</h3>
                   <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Native Installer {platform.ext}</p>
                </div>
             </div>
             
             <p className="text-sm text-muted-foreground mb-12 leading-relaxed">
               {platform.description}
             </p>

             <div className="flex gap-4 mb-10 overflow-x-auto pb-2">
                <div className="flex flex-col gap-1 shrink-0">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground/50">Status</span>
                  <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3" /> Ready
                  </span>
                </div>
                <div className="flex flex-col gap-1 shrink-0 px-4 border-l border-border/30">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground/50">Engine</span>
                  <span className="text-xs font-bold text-foreground">Rust 2.0.0</span>
                </div>
                <div className="flex flex-col gap-1 shrink-0 px-4 border-l border-border/30">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground/50">Architecture</span>
                  <span className="text-xs font-bold text-foreground">Universal</span>
                </div>
             </div>

             <button
                onClick={() => setShowExportGuide(true)}
                className="ipulse-button-primary w-full h-16 relative group"
              >
                <div className="flex items-center justify-center gap-3">
                  <Download className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
                  <span className="text-xs uppercase tracking-[0.2em] font-black underline underline-offset-4 decoration-primary/30">Download {platform.ext}</span>
                </div>
              </button>
          </div>
        ))}
      </div>

      <div className="glass-card bg-muted/20 border-primary/10 p-12 text-center mb-32 relative overflow-hidden">
        <div className="absolute left-0 top-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <h2 className="text-2xl font-bold text-foreground mb-4">Direct Koppelen</h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-10">
          Ben je klaar met bouwen op je Mac? Je kunt je eigen <code className="text-foreground">.dmg</code> of <code className="text-foreground">.msi</code> hosten op een plek naar keuze (bijv. Google Drive of Github) en de link in de code zetten zodat deze buttons direct werken voor je gebruikers.
        </p>
        <button 
          onClick={() => setShowExportGuide(true)}
          className="ipulse-button-primary h-12 px-10 text-[10px]"
        >
          Bekijk Code instructies
        </button>
      </div>
    </div>
  );
};
