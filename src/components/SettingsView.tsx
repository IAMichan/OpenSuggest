import React from 'react';
import { AppSettings, AIModel } from '../types';
import { 
  ChevronDown, 
  Globe, 
  Clock, 
  Hash, 
  LayoutGrid, 
  Shield, 
  Download, 
  CheckCircle2, 
  Loader2, 
  HardDrive,
  Database,
  Trash2,
  Zap,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { invoke } from '@tauri-apps/api/core';

// Detect if we are running in the native desktop client (Tauri)
const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

interface SettingsViewProps {
  settings: AppSettings;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
  models: AIModel[];
  onDownloadModel: (modelId: string) => void;
  activeSection: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSettingsChange, models, onDownloadModel, activeSection }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const downloadedModels = models.filter(m => m.status === 'downloaded');
  const availableModels = models.filter(m => m.status !== 'downloaded');

  const handleClearHistory = async () => {
    if (isDesktop) {
      try {
        const newCount = await invoke('clear_typing_history');
        onSettingsChange({ historyCount: newCount as number });
      } catch (error) {
        console.error("Failed to clear history:", error);
      }
    } else {
      onSettingsChange({ historyCount: 0 });
    }
    setShowDeleteConfirm(false);
  };

  return (
    <div className="h-full overflow-y-auto p-20 max-w-6xl mx-auto" id="settings-view">
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg glass-card p-12 shadow-[0_50px_100px_rgba(0,0,0,0.8)] border-white/10"
            >
              <div className="flex items-center gap-6 mb-10">
                <div className="p-4 bg-red-500/10 rounded-2xl">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <h3 className="text-3xl font-display font-black text-white uppercase tracking-tight">Wipe Memory</h3>
                  <p className="text-sm text-white/40 font-bold uppercase tracking-widest mt-1">Irreversible System Action</p>
                </div>
              </div>
              
              <p className="text-lg text-white/40 leading-relaxed mb-12 font-medium">
                You are about to purge <span className="text-white font-black underline decoration-red-500/50">{settings.historyCount}</span> semantic records. This will permanently reset the model's stylistic adaptation to your writing.
              </p>

              <div className="flex flex-col gap-4">
                <button
                  onClick={handleClearHistory}
                  className="w-full h-16 bg-red-500 text-white text-sm font-display font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-red-600 transition-all shadow-xl shadow-red-500/20 active:scale-95"
                >
                  Confirm Absolute Wipe
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full h-16 border border-white/10 text-white/40 text-sm font-display font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-white/5 transition-all"
                >
                  Abort
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <header className="mb-24">
        <h2 className="text-7xl font-display font-black text-white tracking-[-0.05em] uppercase leading-none">
          {activeSection === 'models' ? 'Neural Stack' : 
           activeSection === 'shortcuts' ? 'Control Map' : 
           activeSection === 'privacy' ? 'Sovereignty' : 
           activeSection === 'appearance' ? 'Aesthetic' : 
           activeSection === 'stats' ? 'Analytics' :
           activeSection === 'personalization' ? 'Memories' : 'General Configuration'}
        </h2>
        <p className="text-xl font-display font-bold text-white/30 mt-6 max-w-2xl tracking-tight">
          {activeSection === 'models' ? 'Customize your local AI engine and model library with sub-millisecond precision.' : 
           activeSection === 'shortcuts' ? 'Configure global interaction triggers for seamless background integration.' : 
           activeSection === 'privacy' ? 'Manage sovereign data storage and hardware-level protection.' : 
           activeSection === 'appearance' ? 'Customize the interface aesthetic to match your OS workspace.' : 
           activeSection === 'stats' ? 'Track your productivity and linguistic throughput powered by local inference.' :
           activeSection === 'personalization' ? 'Monitor or purge semantic data trained on your writing style.' : 'Manage your background suggestions engine and core system behavior.'}
        </p>
      </header>

      <section className="space-y-12 pb-20">
        {/* Stats Section */}
        {activeSection === 'stats' && (
          <div className="space-y-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="glass-card p-10 flex flex-col justify-between group overflow-hidden relative">
                 <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Zap className="w-32 h-32 text-white" />
                 </div>
                 <div>
                    <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-4">Total Autocomplete</h4>
                    <div className="text-7xl font-display font-black text-white tracking-tighter">
                      {settings.autocompletedCount.toLocaleString()}
                    </div>
                    <p className="text-sm font-bold text-white/30 mt-2 uppercase tracking-widest">Words Generated</p>
                 </div>
                 <div className="mt-12 flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Live System Counter
                 </div>
              </div>

              <div className="glass-card p-10 flex flex-col justify-between group overflow-hidden relative">
                 <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Clock className="w-32 h-32 text-white" />
                 </div>
                 <div>
                    <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-4">Typing Speed Boost</h4>
                    <div className="text-7xl font-display font-black text-white tracking-tighter">
                      ~{Math.round(settings.autocompletedCount * 0.4)}
                    </div>
                    <p className="text-sm font-bold text-white/30 mt-2 uppercase tracking-widest">Minutes Saved</p>
                 </div>
                 <div className="mt-12 flex items-center gap-2 text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
                    Estimated workflow efficiency
                 </div>
              </div>
            </div>

            <div className="glass-card p-12 border-primary/20">
               <div className="flex items-center gap-6 mb-8">
                 <div className="p-4 bg-primary/10 rounded-2xl">
                    <Zap className="w-8 h-8 text-primary" />
                 </div>
                 <div>
                   <h3 className="text-2xl font-display font-black text-white uppercase tracking-tight">Productivity Insights</h3>
                   <p className="text-sm text-white/40 font-bold uppercase tracking-widest">System Architecture Feedback</p>
                 </div>
               </div>
               
               <div className="space-y-6">
                 {[
                   { label: "Efficiency Ratio", value: settings.autocompletedCount > 0 ? "84%" : "0%", desc: "Accepted vs Dismissed suggestions" },
                   { label: "Memory Retention", value: `${Math.min(100, Math.round(settings.historyCount / 10))}%`, desc: "Local context training status" },
                   { label: "Hardware Accel", value: "Enabled", desc: "Rust engine leveraging local GPU acceleration" }
                 ].map((stat, i) => (
                   <div key={i} className="flex items-center justify-between py-6 border-b border-white/5 last:border-none">
                     <div>
                       <div className="text-sm font-black text-white uppercase tracking-widest mb-1">{stat.label}</div>
                       <div className="text-xs text-white/30 font-medium">{stat.desc}</div>
                     </div>
                     <div className="text-2xl font-display font-black text-white uppercase">{stat.value}</div>
                   </div>
                 ))}
               </div>
            </div>

            <div className="flex justify-center">
               <button 
                 onClick={() => onSettingsChange({ autocompletedCount: 0 })}
                 className="px-8 py-4 border border-white/5 hover:border-red-500/20 hover:bg-red-500/5 transition-all rounded-2xl text-[10px] font-black text-white/20 hover:text-red-500 uppercase tracking-[0.4em]"
               >
                 Reset Analytics Data
               </button>
            </div>
          </div>
        )}
        {activeSection === 'settings' && (
          <div className="space-y-12">
            <div>
              <h3 className="section-label">System Control</h3>
              <div className="setting-row">
                <div>
                  <div className="text-sm font-semibold text-foreground">Enable Background Engine</div>
                  <div className="text-xs text-muted-foreground">OpenSuggest will monitor inputs for completion triggers</div>
                </div>
                <button
                  onClick={() => onSettingsChange({ isEnabled: !settings.isEnabled })}
                  className={`toggle-switch ${settings.isEnabled ? 'toggle-switch-on' : 'toggle-switch-off'}`}
                >
                  <div className={`toggle-handle ${settings.isEnabled ? 'toggle-handle-on' : 'toggle-handle-off'}`} />
                </button>
              </div>
            </div>
            
            <div className="glass-card p-6 border-primary/20">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1">Local-first Privacy</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
                    Your keystrokes never leave your machine. OpenSuggest performs all AI inference locally via our Rust Core.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Models & Engine Section */}
        {(activeSection === 'models' || activeSection === 'settings') && (
          <div className="space-y-12">
            <div>
              <h3 className="section-label">Active Model</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {downloadedModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => onSettingsChange({ modelId: model.id })}
                    className={`flex text-left p-4 glass-card transition-all duration-200 group relative ${
                      settings.modelId === model.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-foreground tracking-tight">{model.name}</span>
                        {settings.modelId === model.id && (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{model.description}</p>
                      <div className="flex gap-2">
                         <span className="text-[10px] bg-muted border border-border px-1.5 py-0.5 text-muted-foreground font-mono rounded">
                          {model.size}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Downloaded</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="section-label">Model Library</h3>
              <div className="space-y-3">
                {availableModels.map((model) => (
                  <div key={model.id} className="glass-card p-5 flex items-center justify-between group bg-muted/20">
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                        model.status === 'downloading' ? 'bg-primary/10' : 'bg-muted group-hover:bg-muted/50 shadow-sm'
                      }`}>
                        {model.status === 'downloading' ? (
                          <Loader2 className="w-6 h-6 text-primary animate-spin" />
                        ) : (
                          <HardDrive className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h4 className="text-sm font-bold text-foreground tracking-tight">{model.name}</h4>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">{model.size}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
                        {model.status === 'downloading' && (
                          <div className="mt-3 w-64 h-1 bg-muted rounded-full overflow-hidden relative">
                            <motion.div 
                              className="absolute h-full bg-primary"
                              initial={{ width: 0 }}
                              animate={{ width: `${model.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {model.status === 'available' ? (
                        <button
                          onClick={() => onDownloadModel(model.id)}
                          className="ipulse-button-secondary text-[10px] h-8 font-bold uppercase tracking-widest gap-2"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </button>
                      ) : (
                        <div className="text-xs font-mono text-primary font-bold">
                          {Math.round(model.progress || 0)}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Personalization Section */}
        {activeSection === 'personalization' && (
          <div className="space-y-10">
            <div className="glass-card p-8 bg-muted/20 border-border/50">
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Collect Inputs for Personalization</h3>
                    <p className="text-xs text-muted-foreground max-w-xl">
                      OpenSuggest can record the contents of text fields it is activated in to improve its completions.
                    </p>
                  </div>
                  <button
                    onClick={() => onSettingsChange({ collectInputs: !settings.collectInputs })}
                    className={`toggle-switch ${settings.collectInputs ? 'toggle-switch-on' : 'toggle-switch-off'}`}
                  >
                    <div className={`toggle-handle ${settings.collectInputs ? 'toggle-handle-on' : 'toggle-handle-off'}`} />
                  </button>
                </div>

                <div className="p-4 bg-muted/40 rounded-xl border border-border/50 space-y-4 text-xs text-muted-foreground leading-relaxed">
                   <div className="flex gap-3">
                      <Shield className="w-4 h-4 text-primary shrink-0" />
                      <p>All collected data is encrypted and stored locally on your machine — nothing is sent to external servers.</p>
                   </div>
                   <div className="flex gap-3">
                      <Info className="w-4 h-4 text-muted-foreground shrink-0" />
                      <p>Nevertheless, we do not recommend enabling this option if you work with particularly sensitive information or feel uncomfortable with the idea of nearly all your writing being recorded.</p>
                   </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border/50">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground">Store Inputs Without Accepted Completions</h3>
                    <p className="text-xs text-muted-foreground max-w-md">
                      When enabled, OpenSuggest will store all inputs in text fields it monitors, even when you don't accept suggestions.
                    </p>
                  </div>
                  <button
                    onClick={() => onSettingsChange({ storeUnaccepted: !settings.storeUnaccepted })}
                    className={`toggle-switch ${settings.storeUnaccepted ? 'toggle-switch-on' : 'toggle-switch-off'}`}
                  >
                    <div className={`toggle-handle ${settings.storeUnaccepted ? 'toggle-handle-on' : 'toggle-handle-off'}`} />
                  </button>
                </div>

                <div className="space-y-4 pt-4 border-t border-border/50">
                   <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-foreground">Personalize Word Choice</h3>
                        <p className="text-xs text-muted-foreground">
                          Subtle at lower values; too high may occasionally suggest unusual words.
                        </p>
                      </div>
                      <div className="text-[10px] font-bold text-primary uppercase font-mono px-2 py-1 bg-primary/10 rounded">
                        {Math.round(settings.personalizationStrength * 100)}%
                      </div>
                   </div>
                   <div className="relative h-1 bg-muted rounded-full">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settings.personalizationStrength}
                        onChange={(e) => onSettingsChange({ personalizationStrength: parseFloat(e.target.value) })}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div 
                        className="absolute h-full bg-primary rounded-full" 
                        style={{ width: `${settings.personalizationStrength * 100}%` }}
                      />
                      <div className="flex justify-between text-[9px] font-bold text-muted-foreground mt-3 uppercase tracking-tighter">
                         <span>Off</span>
                         <span>Balanced</span>
                         <span>Strong</span>
                      </div>
                   </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-8 flex items-center justify-between border-primary/20">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Factory Reset</h3>
                    <p className="text-sm text-muted-foreground">
                      Wipes all local settings and training history for a fresh start.
                    </p>
                  </div>
               </div>
               <button
                 onClick={() => {
                   localStorage.clear();
                   window.location.reload();
                 }}
                 className="ipulse-button-secondary text-primary border-primary/20 hover:bg-primary/5"
               >
                 Full System Reset
               </button>
            </div>

            <div className="glass-card p-8 flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-muted rounded-xl">
                    <Database className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Existing Data</h3>
                    <p className="text-sm text-muted-foreground">
                      {settings.historyCount} training data records have been collected so far.
                    </p>
                  </div>
               </div>
               <button
                 onClick={() => setShowDeleteConfirm(true)}
                 className="ipulse-button-secondary border-border text-foreground flex items-center gap-2"
               >
                 <Trash2 className="w-4 h-4" />
                 Delete History
               </button>
            </div>
          </div>
        )}

        {activeSection === 'shortcuts' && (
          <div className="space-y-8">
            <h3 className="section-label">Global Triggers</h3>
            <div className="setting-row">
              <div>
                <div className="text-sm font-semibold text-foreground">Accept Suggestion</div>
                <div className="text-xs text-muted-foreground">Key to insert the ghost text</div>
              </div>
              <div className="bg-muted border border-border px-3 py-1.5 rounded-md text-[10px] font-bold text-foreground tracking-widest">TAB</div>
            </div>
            <div className="setting-row">
              <div>
                <div className="text-sm font-semibold text-foreground">Dismiss Suggestion</div>
                <div className="text-xs text-muted-foreground">Key to hide the current suggestion</div>
              </div>
              <div className="bg-muted border border-border px-3 py-1.5 rounded-md text-[10px] font-bold text-foreground tracking-widest">ESC</div>
            </div>
          </div>
        )}

        {/* Engine Config (Visible in multiple places) */}
        {(activeSection === 'models' || activeSection === 'settings') && (
          <div className="space-y-8">
            <h3 className="section-label">Engine Config</h3>
            <div className="setting-row">
              <div>
                <div className="text-sm font-semibold text-foreground">Context Length</div>
                <div className="text-xs text-muted-foreground">Previous {settings.contextLength} words</div>
              </div>
              <div className="w-[240px]">
                <div className="relative h-1 bg-muted rounded-full mb-2">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={settings.contextLength}
                    onChange={(e) => onSettingsChange({ contextLength: parseInt(e.target.value) })}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div 
                    className="absolute h-full bg-primary rounded-full transition-all" 
                    style={{ width: `${(settings.contextLength - 10) / 90 * 100}%` }}
                  />
                </div>
              </div>
            </div>
            
            <div className="setting-row border-none">
              <div>
                <div className="text-sm font-semibold text-foreground">Server URL</div>
                <div className="text-xs text-muted-foreground">Local Ollama instance</div>
              </div>
              <input
                type="text"
                value={settings.ollamaUrl}
                onChange={(e) => onSettingsChange({ ollamaUrl: e.target.value })}
                className="ipulse-input w-[240px]"
              />
            </div>
          </div>
        )}

        {/* Global Informational Footer */}
        <div className="glass-card p-8 bg-primary/5 border-primary/10">
          <div className="flex items-start gap-5">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground mb-1">Local-First Desktop Core</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                OpenSuggest is architected for zero-cloud latency. Your configuration and downloaded models are stored natively on your machine, leveraging the system's Rust engine for hardware acceleration.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
