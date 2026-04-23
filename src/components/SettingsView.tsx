import React, { useEffect, useState } from 'react';
import { AppSettings, AIModel, BlocklistEntry, AllStats } from '../types';
import {
  Shield, Download, CheckCircle2, Loader2, HardDrive, Trash2,
  Plus, X, BarChart2, Clock, Keyboard, Cpu, Monitor,
  Clipboard, Globe, Star, Zap, AlertCircle, ChevronDown, FolderOpen, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { invoke } from '@tauri-apps/api/core';
import { getAllStats, resetStats } from '../services/statsService';
import { addToBlocklist, removeFromBlocklist } from '../services/blocklistService';
import { MODELS, VISION_MODELS } from '../constants';

const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

interface SettingsViewProps {
  settings: AppSettings;
  onSettingsChange: (s: Partial<AppSettings>) => void;
  models: AIModel[];
  onDownloadModel: (id: string) => void;
  onDeleteModel: (id: string) => void;
  activeSection: string;
  ramGb?: number;
  onEngineStarted?: () => void;
}

// ── Toggle ────────────────────────────────────────────────────────────────────
const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!value)}
    disabled={disabled}
    style={{ height: 22, width: 42 }}
    className={`rounded-full relative transition-colors duration-200 border shrink-0 ${
      disabled ? 'opacity-30 cursor-not-allowed' :
      value ? 'bg-white border-white/30' : 'bg-white/5 border-white/10 hover:border-white/20'
    }`}
  >
    <div className={`absolute w-4 h-4 rounded-full top-0.75 transition-all duration-200 ${
      value ? 'right-0.75 bg-black' : 'left-0.75 bg-white/40'
    }`} />
  </button>
);

// ── Stats Bar Chart ───────────────────────────────────────────────────────────
const StatsChart: React.FC<{ week: AllStats['week'] }> = ({ week }) => {
  const max = Math.max(...week.map((d) => d.suggestions), 1);
  return (
    <div className="flex items-end gap-1.5 h-20">
      {week.map((day, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex flex-col justify-end" style={{ height: 64 }}>
            <div
              className="w-full rounded-t bg-white/20 transition-all duration-500"
              style={{ height: `${(day.suggestions / max) * 100}%`, minHeight: day.suggestions > 0 ? 4 : 0 }}
            />
          </div>
          <span className="text-[8px] text-white/20 font-mono">{day.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Row ───────────────────────────────────────────────────────────────────────
const Row: React.FC<{ label: string; desc?: string; children: React.ReactNode }> = ({ label, desc, children }) => (
  <div className="flex items-center justify-between py-4 border-b border-white/6 last:border-0 gap-6">
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold text-white/80">{label}</div>
      {desc && <div className="text-xs text-white/30 mt-0.5 leading-relaxed">{desc}</div>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

// ── Model Selector Dropdown ───────────────────────────────────────────────────

const ModelOption: React.FC<{
  model: AIModel;
  selected: boolean;
  onSelect: () => void;
  onDownload: (id: string) => void;
}> = ({ model, selected, onSelect, onDownload }) => {
  const isDownloaded = model.status === 'downloaded';
  const isDownloading = model.status === 'downloading';
  const handleClick = () => {
    if (isDownloaded) { onSelect(); return; }
    if (isDownloading) return;
    onDownload(model.id);
  };

  return (
    <button
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        selected && isDownloaded ? 'bg-blue-500/15' : 'hover:bg-white/5'
      }`}
      onClick={handleClick}
    >
      <div className="w-4 h-4 shrink-0 flex items-center justify-center">
        {selected && isDownloaded ? (
          <CheckCircle2 className="w-4 h-4 text-blue-400" />
        ) : isDownloading ? (
          <Loader2 className="w-3.5 h-3.5 text-white/40 animate-spin" />
        ) : isDownloaded ? (
          <div className="w-2.5 h-2.5 rounded-full border border-white/20" />
        ) : (
          <Download className="w-3.5 h-3.5 text-white/25" />
        )}
      </div>
      <span className={`text-sm flex-1 ${
        selected && isDownloaded ? 'text-white font-semibold' :
        isDownloaded ? 'text-white/70' : 'text-white/50'
      }`}>
        {model.name}
      </span>
      {isDownloading && model.progress !== undefined && model.progress > 0 ? (
        <span className="text-[10px] font-mono text-white/30">{model.progress}%</span>
      ) : (
        <span className="text-[10px] font-mono text-white/25">{model.size}</span>
      )}
    </button>
  );
};

const ModelSelector: React.FC<{
  models: AIModel[];
  selectedId: string;
  ramGb: number;
  onSelect: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (model: AIModel) => void;
}> = ({ models, selectedId, ramGb, onSelect, onDownload, onDelete }) => {
  const [open, setOpen] = useState(false);

  const recommended = models.filter((m) => m.recommended);
  const others = models.filter((m) => !m.recommended);
  const selected = models.find((m) => m.id === selectedId);

  // Close on outside click
  const ref = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-9 px-4 bg-white/5 border border-white/10 rounded-xl text-sm hover:border-white/25 transition-all min-w-52"
      >
        <span className="text-white/80 font-medium flex-1 text-left truncate">{selected?.name ?? 'Select model'}</span>
        <span className="text-white/25 font-mono text-[11px] shrink-0">{selected?.size}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-white/30 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-[#181818] border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1">
          {recommended.length > 0 && (
            <>
              <p className="px-4 py-1.5 text-[10px] font-bold text-white/25 uppercase tracking-widest">Recommended</p>
              {recommended.map((m) => (
                <ModelOption key={m.id} model={m} selected={m.id === selectedId}
                  onSelect={() => { onSelect(m.id); setOpen(false); }} onDownload={onDownload} />
              ))}
            </>
          )}
          {others.length > 0 && (
            <>
              <div className="border-t border-white/5 mt-1" />
              <p className="px-4 py-1.5 text-[10px] font-bold text-white/25 uppercase tracking-widest">Other Models</p>
              {others.map((m) => (
                <ModelOption key={m.id} model={m} selected={m.id === selectedId}
                  onSelect={() => { onSelect(m.id); setOpen(false); }} onDownload={onDownload} />
              ))}
            </>
          )}
          {/* Delete downloaded model (non-bundled) */}
          {selected && selected.status === 'downloaded' && selected.id !== 'gemma2-2b' && (
            <>
              <div className="border-t border-white/5 mt-1" />
              <button
                onClick={() => { onDelete(selected); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-sm">Delete {selected.name}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings, onSettingsChange, models, onDownloadModel, onDeleteModel, activeSection, ramGb = 8, onEngineStarted,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteModelTarget, setDeleteModelTarget] = useState<AIModel | null>(null);
  const [isDeletingModel, setIsDeletingModel] = useState(false);
  const [stats, setStats] = useState<AllStats | null>(null);
  const [blocklistInput, setBlocklistInput] = useState('');
  const [blocklist, setBlocklist] = useState<BlocklistEntry[]>(settings.blocklist ?? []);
  const [engineRunning, setEngineRunning] = useState<boolean | null>(null);
  const [engineStarting, setEngineStarting] = useState(false);

  useEffect(() => {
    if (activeSection === 'stats') {
      getAllStats().then(setStats).catch(() => {});
    }
  }, [activeSection]);

  // Check welk model geladen is (in-process engine, geen server nodig)
  useEffect(() => {
    if (!isDesktop) { setEngineRunning(true); return; }
    const check = async () => {
      const model = await invoke<string | null>('llm_get_loaded_model').catch(() => null);
      setEngineRunning(model !== null);
    };
    check();
    const iv = setInterval(check, 3000);
    return () => clearInterval(iv);
  }, []);

  const startEngine = async () => {
    // Niet van toepassing bij in-process inference — engine start automatisch met de app
  };

  const downloadedModels = models.filter((m) => m.status === 'downloaded');
  const availableModels = models.filter((m) => m.status !== 'downloaded');

  const sectionTitle: Record<string, string> = {
    models: 'Models & Engine',
    shortcuts: 'Key Shortcuts',
    privacy: 'Privacy & Security',
    appearance: 'Appearance',
    stats: 'Statistics',
    personalization: 'Typing History',
    settings: 'General Settings',
  };

  const ramLabel = ramGb >= 32 ? '32+ GB' : ramGb >= 16 ? '16 GB' : ramGb >= 8 ? '8 GB' : ramGb >= 6 ? '6 GB' : '< 6 GB';

  const addBlockEntry = async () => {
    if (!blocklistInput.trim()) return;
    const isUrl = blocklistInput.includes('.');
    const updated = await addToBlocklist(isUrl ? 'website' : 'app', blocklistInput.trim(), blocklistInput.trim());
    if (updated.length) {
      setBlocklist(updated);
    } else {
      const entry: BlocklistEntry = {
        id: Date.now().toString(),
        type: isUrl ? 'website' : 'app',
        value: blocklistInput.trim(),
        label: blocklistInput.trim(),
      };
      const newList = [...blocklist, entry];
      setBlocklist(newList);
      onSettingsChange({ blocklist: newList });
    }
    setBlocklistInput('');
  };

  const removeBlockEntry = async (id: string) => {
    const updated = await removeFromBlocklist(id);
    const newList = updated.length ? updated : blocklist.filter((e) => e.id !== id);
    setBlocklist(newList);
    onSettingsChange({ blocklist: newList });
  };

  return (
    <div className="h-full overflow-y-auto px-10 py-12 max-w-4xl mx-auto" id="settings-view">
      {/* Wipe memory confirm modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card p-10 max-w-md w-full border-white/10"
            >
              <Trash2 className="w-8 h-8 text-red-400 mb-6" />
              <h3 className="text-2xl font-display font-black text-white uppercase mb-3">Wipe Memory</h3>
              <p className="text-white/40 text-sm mb-8 leading-relaxed">
                This will permanently delete {settings.historyCount} training records. The model's adaptation to your writing style will be reset.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    if (isDesktop) await invoke('db_clear');
                    onSettingsChange({ historyCount: 0 });
                    setShowDeleteConfirm(false);
                  }}
                  className="flex-1 h-12 bg-red-500 text-white font-black uppercase text-xs tracking-widest rounded-xl"
                >
                  Confirm Wipe
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 h-12 border border-white/10 text-white/40 font-black uppercase text-xs tracking-widest rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete model confirm modal */}
      <AnimatePresence>
        {deleteModelTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card p-10 max-w-md w-full border-white/10"
            >
              <Trash2 className="w-8 h-8 text-red-400 mb-6" />
              <h3 className="text-2xl font-display font-black text-white uppercase mb-3">Delete Model</h3>
              <p className="text-white/40 text-sm mb-2 leading-relaxed">
                Are you sure you want to delete <span className="text-white font-bold">{deleteModelTarget.name}</span>?
              </p>
              <p className="text-white/25 text-xs mb-8 leading-relaxed">
                The model ({deleteModelTarget.size}) will be permanently removed from Ollama. You can re-download it later.
              </p>
              <div className="flex gap-3">
                <button
                  disabled={isDeletingModel}
                  onClick={async () => {
                    setIsDeletingModel(true);
                    await onDeleteModel(deleteModelTarget.id);
                    setIsDeletingModel(false);
                    setDeleteModelTarget(null);
                  }}
                  className="flex-1 h-12 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase text-xs tracking-widest rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  {isDeletingModel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {isDeletingModel ? 'Deleting...' : 'Confirm Delete'}
                </button>
                <button
                  disabled={isDeletingModel}
                  onClick={() => setDeleteModelTarget(null)}
                  className="flex-1 h-12 border border-white/10 text-white/40 font-black uppercase text-xs tracking-widest rounded-xl hover:border-white/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <header className="mb-10">
        <h2 className="text-5xl font-display font-black text-white tracking-tight uppercase leading-none">
          {sectionTitle[activeSection] ?? 'Settings'}
        </h2>
      </header>

      <div className="space-y-8 pb-20">

        {/* ── GENERAL ─────────────────────────────────────────────────── */}
        {activeSection === 'settings' && (
          <>
            <div className="glass-card p-8">
              <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em] mb-6">Engine Control</h3>
              <Row label="System-wide Suggestions" desc="Shows suggestions in ANY app — Chrome, Google, Word, etc. Requires Accessibility permission.">
                <Toggle value={settings.globalEnabled} onChange={(v) => onSettingsChange({ globalEnabled: v })} />
              </Row>
              {settings.globalEnabled && (
                <div className="mt-3 mb-1 flex items-start gap-3 p-4 rounded-xl bg-white/3 border border-white/5">
                  <Globe className="w-4 h-4 text-white/40 mt-0.5 shrink-0" />
                  <p className="text-xs text-white/40 leading-relaxed">
                    OpenSuggest reads the focused text field every 500ms. Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">Tab</kbd> in the suggestion bar to insert. Works in Chrome, Safari, Google Docs, Notes, etc.
                  </p>
                </div>
              )}
              <Row label="Trigger Delay" desc={`Wait ${settings.triggerDelayMs}ms after typing before generating.`}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-white/40">{settings.triggerDelayMs}ms</span>
                  <input type="range" min={100} max={800} step={50} value={settings.triggerDelayMs}
                    onChange={(e) => onSettingsChange({ triggerDelayMs: +e.target.value })}
                    className="w-28 accent-white" />
                </div>
              </Row>
              <Row label="Minimum Characters" desc="Don't suggest until this many characters are typed.">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-white/40">{settings.minCharsForSuggestion}</span>
                  <input type="range" min={2} max={15} value={settings.minCharsForSuggestion}
                    onChange={(e) => onSettingsChange({ minCharsForSuggestion: +e.target.value })}
                    className="w-28 accent-white" />
                </div>
              </Row>

            </div>

            {/* RAM info */}
            <div className="glass-card p-6 bg-white/2 border-white/5 flex items-center gap-4">
              <Cpu className="w-5 h-5 text-white/20 shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-white/40">Detected RAM: <span className="text-white/60 font-bold">{ramLabel}</span></p>
                <p className="text-xs text-white/20 mt-0.5">Models with a star ★ are recommended for your system.</p>
              </div>
            </div>
          </>
        )}

        {/* ── MODELS ──────────────────────────────────────────────────── */}
        {(activeSection === 'models' || activeSection === 'settings') && (
          <div className="space-y-6">
            {/* AI Settings — Cotypist-style model picker */}
            <div className="glass-card p-8">
              <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em] mb-6">AI Settings</h3>

              {/* Model status (in-process — geen server nodig) */}
              <Row
                label="Model Status"
                desc={engineRunning
                  ? 'Model is geladen en klaar voor gebruik.'
                  : 'Geen model geladen. Download een model hieronder.'}
              >
                {engineRunning === null ? (
                  <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />
                ) : engineRunning ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-xs text-white/50">Ready</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                    <span className="text-xs text-white/30">No model</span>
                  </div>
                )}
              </Row>

              <Row label="AI Model" desc="Select the model used for completions.">
                <ModelSelector
                  models={models}
                  selectedId={settings.modelId}
                  ramGb={ramGb}
                  onSelect={(id) => onSettingsChange({ modelId: id })}
                  onDownload={onDownloadModel}
                  onDelete={(m) => setDeleteModelTarget(m)}
                />
              </Row>

              {/* Recommended indicator */}
              {(() => {
                const rec = models.find((m) => m.recommended && m.id !== settings.modelId);
                const cur = models.find((m) => m.id === settings.modelId);
                if (cur?.recommended) return (
                  <div className="flex items-center gap-1.5 mt-1 ml-0.5">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <p className="text-xs text-white/40">Recommended for your system: <span className="text-white/60">{cur.name}</span></p>
                  </div>
                );
                if (rec) return (
                  <div className="flex items-center gap-1.5 mt-1 ml-0.5">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <p className="text-xs text-white/40">Recommended for your system: <span className="text-white/60">{rec.name}</span></p>
                  </div>
                );
                return null;
              })()}

              {/* Download error messages */}
              {models.filter((m) => m.status === 'available' && m.downloadStatus).map((m) => {
                const isAuthError = m.downloadStatus?.includes('401') || m.downloadStatus?.includes('Unauthorized');
                return (
                  <div key={m.id} className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-800/30">
                    <p className="text-[11px] font-bold text-red-400 mb-1">{m.name} — download mislukt</p>
                    {isAuthError ? (
                      <p className="text-[10px] text-red-400/70 leading-relaxed">
                        Dit model vereist een HuggingFace token. Maak een gratis account op{' '}
                        <button
                          onClick={() => window.open('https://huggingface.co/settings/tokens', '_blank')}
                          className="underline hover:text-red-300"
                        >
                          huggingface.co
                        </button>
                        , accepteer de Gemma-licentie, en plak je token in het "HuggingFace Token" veld hierboven.
                      </p>
                    ) : (
                      <p className="text-[10px] text-red-400/60 font-mono break-all">{m.downloadStatus}</p>
                    )}
                  </div>
                );
              })}

              {/* Downloading model progress bar (shown outside dropdown) */}
              {models.filter((m) => m.status === 'downloading').map((m) => (
                <div key={m.id} className="mt-4 p-4 rounded-xl bg-white/3 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 text-white/40 animate-spin" />
                      <span className="text-xs font-semibold text-white/60">{m.name}</span>
                    </div>
                    <span className="text-xs font-mono text-white/30">{m.progress ?? 0}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-white/40 rounded-full"
                      animate={{ width: `${m.progress ?? 0}%` }}
                      transition={{ duration: 0.4, ease: 'linear' }}
                    />
                  </div>
                  {m.totalBytes && m.totalBytes > 0 && m.downloadedBytes !== undefined && (
                    <p className="text-[10px] text-white/20 font-mono mt-1.5">
                      {(m.downloadedBytes / 1e9).toFixed(2)} / {(m.totalBytes / 1e9).toFixed(2)} GB
                    </p>
                  )}
                </div>
              ))}

              <div className="border-t border-white/5 mt-5 pt-5">
                <Row label="Model Files" desc="Open the folder containing downloaded models.">
                  <button
                    onClick={() => invoke('reveal_models_folder')}
                    className="flex items-center gap-2 h-9 px-4 border border-white/10 rounded-xl text-xs font-bold text-white/50 hover:text-white/80 hover:border-white/25 transition-all"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Reveal in Finder
                  </button>
                </Row>
              </div>
            </div>

            {/* Vision model */}
            <div className="glass-card p-8">
              <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em] mb-2">Vision Model</h3>
              <p className="text-xs text-white/30 mb-6">For screen context analysis. Requires Screen Recording permission.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {VISION_MODELS.map((m) => (
                  <button key={m.id} onClick={() => onSettingsChange({ visionModelId: m.id })}
                    className={`text-left p-4 rounded-xl border transition-all ${settings.visionModelId === m.id ? 'bg-white/10 border-white/30' : 'bg-white/3 border-white/5 hover:border-white/15'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-white">{m.name}</span>
                      {settings.visionModelId === m.id && <CheckCircle2 className="w-4 h-4 text-white/60" />}
                    </div>
                    <span className="text-xs text-white/30">{m.size} • {m.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PRIVACY ─────────────────────────────────────────────────── */}
        {activeSection === 'privacy' && (
          <div className="space-y-6">
            <div className="glass-card p-8">
              <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em] mb-6">Permissions</h3>
              <Row label="Screen Recording" desc="Analyze screen content for context-aware suggestions. Images stay local.">
                <Toggle value={settings.screenContextEnabled} onChange={(v) => onSettingsChange({ screenContextEnabled: v })} />
              </Row>
              <Row label="Clipboard Context" desc="Read clipboard to improve suggestion relevance. Never stored.">
                <Toggle value={settings.clipboardEnabled} onChange={(v) => onSettingsChange({ clipboardEnabled: v })} />
              </Row>
            </div>

            <div className="glass-card p-8">
              <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em] mb-2">App & Site Blocklist</h3>
              <p className="text-xs text-white/30 mb-6">OpenSuggest will not show suggestions when these apps or websites are active.</p>
              <div className="flex gap-2 mb-5">
                <input
                  type="text"
                  placeholder="App name or domain (e.g. Finder, bank.com)"
                  value={blocklistInput}
                  onChange={(e) => setBlocklistInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBlockEntry()}
                  className="flex-1 h-10 px-4 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 outline-none focus:border-white/30 transition-colors font-mono"
                />
                <button onClick={addBlockEntry}
                  className="h-10 px-5 bg-white text-black font-black text-xs uppercase rounded-xl hover:scale-[1.02] transition-transform flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              {blocklist.length === 0 ? (
                <p className="text-xs text-white/20 text-center py-6">No blocked apps or sites yet.</p>
              ) : (
                <div className="space-y-2">
                  {blocklist.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between px-4 py-3 bg-white/3 border border-white/5 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${entry.type === 'app' ? 'border-white/10 text-white/30' : 'border-blue-500/20 text-blue-400/60'}`}>
                          {entry.type}
                        </span>
                        <span className="text-sm text-white/70 font-mono">{entry.label}</span>
                      </div>
                      <button onClick={() => removeBlockEntry(entry.id)} className="w-7 h-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center text-white/30 hover:text-red-400 transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card p-8">
              <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em] mb-6">Local Data</h3>
              <Row label="Collect Inputs" desc="Store accepted completions to personalize future suggestions.">
                <Toggle value={settings.collectInputs} onChange={(v) => onSettingsChange({ collectInputs: v })} />
              </Row>
              <Row label="Store Unaccepted Inputs" desc="Also save text you typed but didn't accept.">
                <Toggle value={settings.storeUnaccepted} onChange={(v) => onSettingsChange({ storeUnaccepted: v })} />
              </Row>
              <Row label="Training Records" desc={`${settings.historyCount} fragments stored locally.`}>
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 h-9 px-4 border border-white/10 rounded-lg text-xs text-white/40 hover:border-red-500/30 hover:text-red-400 transition-all">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </Row>
            </div>
          </div>
        )}

        {/* ── PERSONALIZATION ─────────────────────────────────────────── */}
        {activeSection === 'personalization' && (
          <div className="space-y-6">
            <div className="glass-card p-8">
              <Row label="Personalize Word Choice" desc="How strongly the model adapts to your writing style.">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-white/40">{Math.round(settings.personalizationStrength * 100)}%</span>
                  <input type="range" min={0} max={1} step={0.1} value={settings.personalizationStrength}
                    onChange={(e) => onSettingsChange({ personalizationStrength: parseFloat(e.target.value) })}
                    className="w-28 accent-white" />
                </div>
              </Row>
            </div>
            <div className="glass-card p-8 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white/80">Factory Reset</p>
                <p className="text-xs text-white/30 mt-1">Wipe all local settings and training history.</p>
              </div>
              <button onClick={() => { localStorage.clear(); window.location.reload(); }}
                className="h-10 px-5 border border-white/10 rounded-xl text-xs font-bold text-white/40 hover:border-red-500/20 hover:text-red-400 transition-all">
                Full Reset
              </button>
            </div>
          </div>
        )}

        {/* ── STATISTICS ───────────────────────────────────────────────── */}
        {activeSection === 'stats' && (
          <div className="space-y-6">
            {stats ? (
              <>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Today', value: stats.today.suggestions, sub: 'suggestions' },
                    { label: 'Accepted', value: stats.today.accepted, sub: 'completions' },
                    { label: 'Words', value: stats.today.words, sub: 'generated today' },
                  ].map((s) => (
                    <div key={s.label} className="glass-card p-6">
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-2">{s.label}</p>
                      <p className="text-4xl font-display font-black text-white">{s.value.toLocaleString()}</p>
                      <p className="text-xs text-white/30 mt-1">{s.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="glass-card p-8">
                  <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em] mb-6">Last 7 Days</h3>
                  {stats.week.length > 0 ? <StatsChart week={stats.week} /> : (
                    <p className="text-xs text-white/20 text-center py-8">No data yet. Start using suggestions to see stats.</p>
                  )}
                </div>

                <div className="glass-card p-8">
                  <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em] mb-4">All Time</h3>
                  <div className="grid grid-cols-3 gap-6">
                    <div><p className="text-3xl font-display font-black text-white">{stats.total.suggestions.toLocaleString()}</p><p className="text-xs text-white/30 mt-1">Total suggestions</p></div>
                    <div><p className="text-3xl font-display font-black text-white">{stats.total.words.toLocaleString()}</p><p className="text-xs text-white/30 mt-1">Words generated</p></div>
                    <div><p className="text-3xl font-display font-black text-white">{Math.round((stats.total.words / 40) * 60 / 60)}</p><p className="text-xs text-white/30 mt-1">Minutes saved (est.)</p></div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={() => resetStats().then(() => getAllStats().then(setStats))}
                    className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-red-400 transition-colors">
                    Reset Statistics
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* ── SHORTCUTS ────────────────────────────────────────────────── */}
        {activeSection === 'shortcuts' && (
          <div className="space-y-6">
            <div className="glass-card p-8">
              <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em] mb-6">Playground (in-app)</h3>
              {[
                { label: 'Accept Suggestion', desc: 'Insert the ghost text at cursor', key: 'TAB' },
                { label: 'Dismiss Suggestion', desc: 'Hide the current suggestion', key: 'ESC' },
              ].map((item) => (
                <Row key={item.label} label={item.label} desc={item.desc}>
                  <kbd className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white/60">
                    {item.key}
                  </kbd>
                </Row>
              ))}
            </div>
            <div className="glass-card p-8">
              <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em] mb-6">System-wide Overlay</h3>
              {[
                { label: 'Insert Suggestion', desc: 'Injects text into the active field', key: 'TAB' },
                { label: 'Dismiss Overlay', desc: 'Hide the suggestion bar', key: 'ESC' },
              ].map((item) => (
                <Row key={item.label} label={item.label} desc={item.desc}>
                  <kbd className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white/60">
                    {item.key}
                  </kbd>
                </Row>
              ))}
            </div>
          </div>
        )}

        {/* ── APPEARANCE ───────────────────────────────────────────────── */}
        {activeSection === 'appearance' && (
          <div className="glass-card p-8">
            <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em] mb-6">Interface</h3>
            <Row label="Theme" desc="Dark mode recommended for late-night coding sessions.">
              <div className="flex gap-2">
                {(['dark', 'light'] as const).map((t) => (
                  <button key={t} onClick={() => onSettingsChange({ theme: t })}
                    className={`h-8 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${settings.theme === t ? 'bg-white text-black' : 'bg-white/5 text-white/40 border border-white/10'}`}>
                    {t === 'dark' ? 'Dark' : 'Light'}
                  </button>
                ))}
              </div>
            </Row>
          </div>
        )}

        {/* Privacy footer */}
        <div className="glass-card p-6 bg-white/2 border-white/5 flex items-start gap-4">
          <Shield className="w-5 h-5 text-white/20 mt-0.5 shrink-0" />
          <p className="text-xs text-white/25 leading-relaxed">
            All data is stored locally on your device via Ollama. OpenSuggest never sends your text, images, or training data to any external server.
          </p>
        </div>
      </div>
    </div>
  );
};
