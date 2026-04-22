/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { SettingsView } from './components/SettingsView';
import { GhostEditor } from './components/GhostEditor';
import { StatusIndicator } from './components/StatusIndicator';
import { DownloadView } from './components/DownloadView';
import { WelcomePage } from './components/WelcomePage';
import { TitleBar } from './components/TitleBar';
import { AppSettings, AppStatus, AIModel } from './types';
import { DEFAULT_SETTINGS, MODELS } from './constants';
import { getNativeEngineState, startNativeModelDownload } from './services/aiService';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, Type, Settings as SettingsIcon, Shield, Zap, MonitorSmartphone } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

// Detect if we are running in the native desktop client (Tauri)
const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

const STORAGE_KEY = 'opensuggest_settings';

export default function App() {
  const [activeTab, setActiveTab] = useState('web');
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Force reset if version is outdated (fixes the persistent 124 record bug)
        if (parsed.version !== DEFAULT_SETTINGS.version) {
          localStorage.removeItem(STORAGE_KEY);
          return DEFAULT_SETTINGS;
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });
  const [status, setStatus] = useState<AppStatus>('loading');
  const [models, setModels] = useState<AIModel[]>(MODELS);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    // 🚀 ZERO-CONFIG AUTO-START
    const autoSetup = async () => {
      setStatus('loading');
      
      // Perform initial sync with native Rust engine if available
      const nativeState = await getNativeEngineState();
      if (nativeState) {
        setSettings(prev => ({
          ...prev,
          isEnabled: nativeState.isEnabled,
          modelId: nativeState.activeModelId,
          downloadedModelIds: nativeState.downloadedIds,
          historyCount: nativeState.historyCount
        }));
        
        // Update local models status based on native state
        setModels(prev => prev.map(m => ({
          ...m,
          status: nativeState.downloadedIds.includes(m.id) ? 'downloaded' : 'available'
        })));
      }

      // Detect GPU / Connect sequences
      try {
        if (isDesktop) {
          await invoke('toggle_engine', { isEnabled: true });
        }
        
        // Wait a bit to simulate scanning hardware
        await new Promise(r => setTimeout(r, 1200));
        setStatus('ready');
      } catch (e) {
        console.error("Auto-Setup Failed:", e);
        setStatus('ready');
      }
    };
    
    autoSetup();
  }, [isDesktop]);

  const handleSettingsChange = async (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));

    // 🦀 Rust OS level updates
    if (isDesktop) {
       if (newSettings.modelId) {
         await invoke('set_active_model', { modelId: newSettings.modelId }).catch(console.error);
       }
       if (newSettings.isEnabled !== undefined) {
         await invoke('toggle_engine', { isEnabled: newSettings.isEnabled }).catch(console.error);
       }
    }
  };

  const handleDownloadModel = async (modelId: string) => {
    setModels(prev => prev.map(m => 
      m.id === modelId ? { ...m, status: 'downloading', progress: 0 } : m
    ));

    // 🦀 Trigger Native Download
    if (isDesktop) {
      try {
        // We simulate progress in frontend while Rust does the work
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 8;
          if (progress >= 95) {
             clearInterval(interval);
          } else {
            setModels(prev => prev.map(m => m.id === modelId ? { ...m, progress } : m));
          }
        }, 300);

        await startNativeModelDownload(modelId);
        
        clearInterval(interval);
        setModels(prev => prev.map(m => 
          m.id === modelId ? { ...m, status: 'downloaded', progress: 100 } : m
        ));
        setSettings(prev => ({
          ...prev,
          downloadedModelIds: [...prev.downloadedModelIds, modelId]
        }));
      } catch (e) {
        console.error("Model Download Failed:", e);
        setModels(prev => prev.map(m => m.id === modelId ? { ...m, status: 'available' } : m));
      }
    } else {
      // Browser Mock
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setModels(prev => prev.map(m => 
            m.id === modelId ? { ...m, status: 'downloaded', progress: 100 } : m
          ));
          setSettings(prev => ({ ...prev, downloadedModelIds: [...prev.downloadedModelIds, modelId] }));
        } else {
          setModels(prev => prev.map(m => m.id === modelId ? { ...m, progress } : m));
        }
      }, 600);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden font-sans select-none">
      {!isDesktop ? (
        <div className="h-full w-full overflow-y-auto">
          <WelcomePage onStart={() => {
            const el = document.getElementById('download');
            el?.scrollIntoView({ behavior: 'smooth' });
          }} />
        </div>
      ) : (
        <>
          <TitleBar />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
              isEnabled={settings.isEnabled}
              onToggle={() => handleSettingsChange({ isEnabled: !settings.isEnabled })}
            />
            
            <main className="flex-1 flex flex-col min-w-0 bg-background">
              {/* Navbar */}
              <header className="h-20 border-b border-white/5 flex items-center justify-between px-12 bg-black sticky top-0 z-40">
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-3 group">
                    <Zap className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-display font-black uppercase tracking-[0.4em] text-white/30">System Status // Active Inference</span>
                  </div>
                </div>

                <StatusIndicator status={status} />
              </header>

              {/* Content Area */}
              <div className="flex-1 relative overflow-hidden">
              <AnimatePresence mode="wait">
                {activeTab === 'web' ? (
                  <motion.div
                    key="web"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full overflow-y-auto"
                  >
                    <WelcomePage 
                      onStart={setActiveTab} 
                      settings={settings} 
                      onSettingsChange={handleSettingsChange} 
                    />
                  </motion.div>
                ) : activeTab === 'demo' ? (
                  <motion.div
                    key="demo"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="h-full overflow-y-auto flex flex-col p-8 lg:p-12 max-w-5xl mx-auto space-y-12"
                  >
                    <header>
                      <h2 className="text-3xl font-bold tracking-tight text-foreground">Live Simulation</h2>
                      <p className="text-sm text-muted-foreground mt-2">Test the desktop-level Rust engine performance in a sandboxed editor.</p>
                    </header>

                    <div className="w-full glass-card overflow-hidden">
                       <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between bg-muted/30">
                          <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-bold">Native Input Buffer</div>
                          <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-border" />
                            <div className="w-2.5 h-2.5 rounded-full bg-border" />
                            <div className="w-2.5 h-2.5 rounded-full bg-border" />
                          </div>
                       </div>
                       
                       <div className="p-8">
                         <GhostEditor settings={settings} onSettingsChange={handleSettingsChange} />
                       </div>

                       <div className="px-6 py-4 bg-muted/20 flex gap-4">
                         <div className="text-[10px] font-bold text-muted-foreground uppercase border border-border/50 px-2.5 py-1 rounded">Tab to Accept</div>
                         <div className="text-[10px] font-bold text-muted-foreground uppercase border border-border/50 px-2.5 py-1 rounded">Esc to Dismiss</div>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-20">
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Throughput</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">Sub-300ms response times powered by local Rust engine acceleration.</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Privacy</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">System-level isolation ensures your keystrokes never leave your memory.</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Native Bridge</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">Direct interaction with local models via secure Unix/Windows sockets.</p>
                      </div>
                    </div>
                  </motion.div>
                ) : activeTab === 'settings' || activeTab === 'models' || activeTab === 'appearance' || activeTab === 'shortcuts' || activeTab === 'privacy' || activeTab === 'personalization' || activeTab === 'stats' ? (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full"
                  >
                    <SettingsView 
                      settings={settings} 
                      onSettingsChange={handleSettingsChange} 
                      models={models}
                      onDownloadModel={handleDownloadModel}
                      activeSection={activeTab}
                    />
                  </motion.div>
                ) : activeTab === 'download' ? (
                  <motion.div
                    key="download"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full"
                  >
                    <DownloadView />
                  </motion.div>
                ) : (
                  <div className="h-full flex items-center justify-center text-white/20 font-mono text-xs italic">
                    {activeTab} module is loading...
                  </div>
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>
      </>
    )}
  </div>
);
}
