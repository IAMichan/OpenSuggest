import React from 'react';
import { Apple, Monitor, Download, ArrowRight, ShieldCheck, Zap, Terminal, Globe } from 'lucide-react';
import { motion } from 'motion/react';
import { DOWNLOAD_LINKS } from '../constants';

const platforms = [
  {
    id: 'macos',
    name: 'macOS',
    subtitle: 'Apple Silicon & Intel',
    icon: Apple,
    ext: '.dmg',
    size: '~48 MB',
    color: 'bg-white/5',
    borderColor: 'border-white/10 hover:border-white/20',
    description: 'Universal binary for Apple Silicon (M1–M4) and Intel Macs. Requires macOS 12.0 or later.',
    downloadUrl: DOWNLOAD_LINKS.macos,
  },
  {
    id: 'windows',
    name: 'Windows',
    subtitle: 'Windows 10 / 11 (64-bit)',
    icon: Monitor,
    ext: '.exe',
    size: '~54 MB',
    color: 'bg-[#0078D4]/10',
    borderColor: 'border-[#0078D4]/20 hover:border-[#0078D4]/40',
    description: 'NSIS installer for Windows 10 and 11. MSI available for enterprise deployment.',
    downloadUrl: DOWNLOAD_LINKS.windows,
  },
  {
    id: 'linux',
    name: 'Linux',
    subtitle: 'AppImage & .deb',
    icon: Terminal,
    ext: '.AppImage',
    size: '~62 MB',
    color: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20 hover:border-orange-500/30',
    description: 'AppImage works on any distro. Debian/Ubuntu users can also install the .deb package.',
    downloadUrl: DOWNLOAD_LINKS.linux_appimage,
    secondaryUrl: DOWNLOAD_LINKS.linux_deb,
    secondaryExt: '.deb',
  },
];

export const DownloadView: React.FC = () => {
  const handleDownload = (url: string) => {
    if (url.startsWith('http')) {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 lg:p-16 max-w-5xl mx-auto" id="download-view">
      {/* Header */}
      <header className="mb-16 text-center max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-white/60 uppercase tracking-widest mb-6"
        >
          <Zap className="w-3 h-3" />
          Native Installers
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl lg:text-7xl font-display font-black text-white tracking-tight leading-none mb-6 uppercase"
        >
          Download <span className="text-white/15">Center</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-white/30 text-lg leading-relaxed"
        >
          Available for macOS, Windows, and Linux. Ollama installs automatically on first launch.
        </motion.p>
      </header>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {platforms.map((platform, i) => (
          <motion.div
            key={platform.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`glass-card p-8 border transition-all duration-300 flex flex-col ${platform.borderColor}`}
          >
            <div className={`w-14 h-14 ${platform.color} rounded-2xl flex items-center justify-center mb-6`}>
              <platform.icon className="w-7 h-7 text-white/70" />
            </div>
            <h3 className="text-xl font-display font-black text-white uppercase tracking-tight mb-1">
              {platform.name}
            </h3>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-4">
              {platform.subtitle}
            </p>
            <p className="text-sm text-white/30 leading-relaxed mb-8 flex-1">
              {platform.description}
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleDownload(platform.downloadUrl)}
                className="w-full h-12 flex items-center justify-center gap-2 bg-white text-black rounded-xl font-display font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Download className="w-4 h-4" />
                Download {platform.ext}
              </button>
              {platform.secondaryUrl && (
                <button
                  onClick={() => handleDownload(platform.secondaryUrl!)}
                  className="w-full h-10 flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white/50 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download {platform.secondaryExt}
                </button>
              )}
            </div>
            <p className="text-center text-[10px] text-white/20 mt-3 font-mono">
              v1.0.0 • {platform.size}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Build from source */}
      <div className="glass-card p-10 border border-white/5 text-center mb-8">
        <Globe className="w-8 h-8 text-white/20 mx-auto mb-4" />
        <h2 className="text-xl font-display font-black text-white uppercase tracking-tight mb-3">
          Build from Source
        </h2>
        <p className="text-white/30 text-sm mb-8 max-w-lg mx-auto leading-relaxed">
          OpenSuggest is fully open source. Clone the repo, install dependencies, and build a native installer for your platform.
        </p>
        <div className="bg-black/40 border border-white/5 rounded-xl p-5 text-left font-mono text-xs space-y-2 max-w-md mx-auto">
          <p><span className="text-white/20"># 1. Clone</span></p>
          <p className="text-white/70">git clone https://github.com/opensuggest/opensuggest</p>
          <p><span className="text-white/20"># 2. Install</span></p>
          <p className="text-white/70">npm install</p>
          <p><span className="text-white/20"># 3. Build</span></p>
          <p className="text-white/70">npm run tauri:build</p>
        </div>
      </div>
    </div>
  );
};
