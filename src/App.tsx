import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Sidebar } from './components/Sidebar';
import { SettingsView } from './components/SettingsView';
import { GhostEditor } from './components/GhostEditor';
import { DownloadView } from './components/DownloadView';
import { WelcomePage } from './components/WelcomePage';
import { TitleBar } from './components/TitleBar';
import { SetupWizard } from './components/SetupWizard';
import { OverlayWindow } from './components/OverlayWindow';
import { AppSettings, AppStatus, AIModel } from './types';
import {
  DEFAULT_SETTINGS, MODELS, STORAGE_KEY,
  getRecommendedModelIds, getDefaultModelId
} from './constants';
import { motion, AnimatePresence } from 'motion/react';
import { Zap } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { checkOllama, getInstalledModels, getCompletion, getSystemRamGb } from './services/aiService';
import { readClipboard } from './services/clipboardService';

const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

// Detect if this is the overlay window via the Tauri window label
const currentWindowLabel = isDesktop
  ? ((window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label ?? 'main')
  : 'main';

// ─── Overlay window entry-point ───────────────────────────────────────────────
if (currentWindowLabel === 'overlay') {
  // Render only the overlay — no main app logic needed
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(
      <React.StrictMode>
        <div className="bg-transparent font-sans">
          <OverlayWindow />
        </div>
      </React.StrictMode>
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  // Return nothing if this is the overlay window (rendered separately above)
  if (currentWindowLabel === 'overlay') return null;

  return <MainApp />;
}

function MainApp() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('opensuggest_active_tab') || 'demo';
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem('opensuggest_active_tab', tab);
  };
  const [status, setStatus] = useState<AppStatus>('loading');
  const [screenContext, setScreenContext] = useState('');
  const [ramGb, setRamGb] = useState(8);
  const screenContextInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const globalPollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const globalDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGlobalText = useRef('');
  const overlayVisible = useRef(false);

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.version !== DEFAULT_SETTINGS.version) {
          localStorage.removeItem(STORAGE_KEY);
          return DEFAULT_SETTINGS;
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {}
    return DEFAULT_SETTINGS;
  });

  const [models, setModels] = useState<AIModel[]>(MODELS);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const syncInstalledModels = useCallback(async (url: string, ram: number) => {
    const installed = await getInstalledModels(url).catch(() => []);
    const installedNames = installed.map((m) => m.name);
    setModels((prev) =>
      prev.map((m) => ({
        ...m,
        // Overschrijf nooit een model dat momenteel gedownload wordt
        status: m.status === 'downloading' ? m.status :
          installedNames.some(
            (n) => m.ollamaId && (n === m.ollamaId || n === `${m.ollamaId}:latest`)
          ) ? 'downloaded' : m.status,
        recommended: getRecommendedModelIds(ram).includes(m.id),
      }))
    );
  }, []);

  const initOllama = useCallback((ram: number) => {
    invoke<string>('start_bundled_ollama')
      .then(async (bundledUrl) => {
        setSettings((prev) => ({ ...prev, ollamaUrl: bundledUrl }));
        await syncInstalledModels(bundledUrl, ram);
      })
      .catch(async (e) => {
        console.warn('Gebundelde Ollama kon niet starten, probeer systeem-Ollama:', e);
        const systemUrl = 'http://localhost:11434';
        const running = await checkOllama(systemUrl);
        if (running) {
          setSettings((prev) => ({ ...prev, ollamaUrl: systemUrl }));
          await syncInstalledModels(systemUrl, ram);
        } else {
          await invoke('ollama_start', { ollamaUrl: systemUrl }).catch(() => {});
          await syncInstalledModels(systemUrl, ram);
        }
      });
  }, [syncInstalledModels]);

  // Boot sequence
  useEffect(() => {
    const boot = async () => {
      setStatus('loading');
      try {
        if (isDesktop) {
          const ram = await getSystemRamGb();
          setRamGb(ram);

          // Pas standaard model aan op basis van RAM als nog niet ingesteld
          const savedSettings = localStorage.getItem(STORAGE_KEY);
          if (!savedSettings || JSON.parse(savedSettings || '{}').modelId === DEFAULT_SETTINGS.modelId) {
            setSettings((prev) => ({ ...prev, modelId: getDefaultModelId(ram) }));
          }

          // Markeer aanbevolen modellen meteen (geen Ollama nodig)
          setModels((prev) =>
            prev.map((m) => ({ ...m, recommended: getRecommendedModelIds(ram).includes(m.id) }))
          );

          // Sync lokale GGUF-modellen en laad het geselecteerde model
          const localModels = await invoke<{ filename: string; size_gb: number; path: string }[]>(
            'llm_list_local_models'
          ).catch(() => []);

          if (localModels.length > 0) {
            const localFilenames = new Set(localModels.map((m) => m.filename));

            // Markeer aanwezige GGUF-bestanden als gedownload
            setModels((prev) =>
              prev.map((m) => ({
                ...m,
                status: m.ggufFilename && localFilenames.has(m.ggufFilename) ? 'downloaded' : m.status,
              }))
            );

            // Laad het geselecteerde model, of het eerste beschikbare lokale model
            const currentModelId = savedSettings ? JSON.parse(savedSettings).modelId : settings.modelId;
            const toLoad =
              MODELS.find((m) => m.id === currentModelId && m.ggufFilename && localFilenames.has(m.ggufFilename)) ??
              MODELS.find((m) => m.ggufFilename && localFilenames.has(m.ggufFilename ?? ''));

            if (toLoad?.ggufFilename) {
              invoke('llm_load_model', { filename: toLoad.ggufFilename }).catch(() => {});
              setSettings((prev) => ({ ...prev, modelId: toLoad.id }));
            }
          }

          // Start Ollama op de achtergrond — blokkeert de UI niet
          initOllama(ram);
        }
        await new Promise((r) => setTimeout(r, 600));
        setStatus('ready');
      } catch {
        setStatus('ready');
      }
    };
    boot();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Screen context polling (every 8s when enabled)
  useEffect(() => {
    if (!isDesktop || !settings.screenContextEnabled || !settings.setupComplete) {
      if (screenContextInterval.current) clearInterval(screenContextInterval.current);
      return;
    }
    const poll = async () => {
      try {
        const ctx = await invoke<string>('screen_analyze', {
          visionModel: settings.visionModelId || 'moondream',
          ollamaUrl: settings.ollamaUrl,
        });
        if (ctx) {
          setScreenContext(ctx);
          invoke('set_screen_context', { context: ctx }).catch(() => {});
        }
      } catch {}
    };
    poll();
    screenContextInterval.current = setInterval(poll, 8000);
    return () => { if (screenContextInterval.current) clearInterval(screenContextInterval.current); };
  }, [settings.screenContextEnabled, settings.setupComplete, settings.visionModelId, settings.ollamaUrl]);

  // ── System-wide suggestions (works in any app, including Chrome/Google) ──────
  const generateGlobalSuggestion = useCallback(async (text: string) => {
    if (!text.trim() || text.trim().length < settings.minCharsForSuggestion) return;

    const clipboardCtx = settings.clipboardEnabled ? await readClipboard().catch(() => '') : '';
    const historyCtx = isDesktop
      ? await invoke<string[]>('db_get_history', { limit: 8 })
          .then((items) => items.slice(0, 4).join('. '))
          .catch(() => '')
      : '';

    const suggestion = await getCompletion(text, settings.modelId, settings.ollamaUrl, {
      screenContext: settings.screenContextEnabled ? screenContext : '',
      clipboardContext: clipboardCtx,
      historyContext: historyCtx,
    });

    if (!suggestion || !settings.globalEnabled) return;

    // Send suggestion to the overlay window
    await emit('overlay-show-suggestion', {
      suggestion,
      context: text.slice(-60),
      modelId: settings.modelId,
    });

    // Show overlay window
    try {
      const overlay = await WebviewWindow.getByLabel('overlay');
      if (overlay) {
        await overlay.show();
        overlayVisible.current = true;
      }
    } catch {}
  }, [settings, screenContext]);

  useEffect(() => {
    if (!isDesktop || !settings.globalEnabled || !settings.setupComplete || !settings.isEnabled) {
      if (globalPollInterval.current) clearInterval(globalPollInterval.current);
      return;
    }

    const poll = async () => {
      try {
        // Skip if the active window is OpenSuggest itself
        const activeWindow = await invoke<string>('get_active_window_name').catch(() => '');
        if (activeWindow.toLowerCase().includes('opensuggest')) return;

        // Check blocklist
        const blocked = await invoke<boolean>('blocklist_check', { windowName: activeWindow }).catch(() => false);
        if (blocked) return;

        // Lees gefocuste tekst uit elk programma
        const focusedText = await invoke<string>('get_focused_field_text').catch(() => '');
        if (!focusedText || focusedText === lastGlobalText.current) return;

        lastGlobalText.current = focusedText;

        // Verberg huidige overlay als tekst veranderd is
        if (overlayVisible.current) {
          await emit('overlay-hide', {});
          overlayVisible.current = false;
        }

        // Debounce: wacht tot typen pauzeert
        if (globalDebounce.current) clearTimeout(globalDebounce.current);
        globalDebounce.current = setTimeout(() => {
          generateGlobalSuggestion(focusedText);
        }, settings.triggerDelayMs + 100);

      } catch {}
    };

    globalPollInterval.current = setInterval(poll, 300);

    // Luister naar overlay-events
    const unlistenAccepted = listen('overlay-accepted', () => { overlayVisible.current = false; });
    const unlistenDismissed = listen('overlay-dismissed', () => { overlayVisible.current = false; });

    return () => {
      if (globalPollInterval.current) clearInterval(globalPollInterval.current);
      if (globalDebounce.current) clearTimeout(globalDebounce.current);
      unlistenAccepted.then((u) => u());
      unlistenDismissed.then((u) => u());
    };
  }, [settings.globalEnabled, settings.setupComplete, settings.isEnabled, settings.triggerDelayMs, generateGlobalSuggestion]);

  // Luister naar tray-menu navigatie-events (bijv. "Instellingen" in de menubalk)
  useEffect(() => {
    if (!isDesktop) return;
    let cleanup: (() => void) | undefined;
    listen<string>('navigate-to', (e) => {
      setActiveTab(e.payload);
      localStorage.setItem('opensuggest_active_tab', e.payload);
    }).then((unlisten) => { cleanup = unlisten; });
    return () => { cleanup?.(); };
  }, []);

  const handleSettingsChange = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleDownloadModel = async (modelId: string) => {
    const model = models.find((m) => m.id === modelId);
    if (!model) return;

    setModels((prev) => prev.map((m) => m.id === modelId ? { ...m, status: 'downloading', progress: 0 } : m));

    if (!isDesktop) {
      // Browser demo
      let p = 0;
      const iv = setInterval(() => {
        p = Math.min(100, p + Math.random() * 15);
        setModels((prev) => prev.map((m) => m.id === modelId ? { ...m, progress: Math.round(p) } : m));
        if (p >= 100) {
          clearInterval(iv);
          setModels((prev) => prev.map((m) => m.id === modelId ? { ...m, status: 'downloaded', progress: 100 } : m));
          setSettings((prev) => ({ ...prev, downloadedModelIds: [...prev.downloadedModelIds, modelId] }));
        }
      }, 400);
      return;
    }

    // In-process: directe GGUF download van HuggingFace (geen Ollama server nodig)
    if (model.ggufUrl && model.ggufFilename) {
      const unlisten = await listen<{
        filename: string; progress: number;
        downloaded_gb: number; total_gb: number; status: string;
      }>('gguf-download-progress', (e) => {
        if (e.payload.filename === model.ggufFilename) {
          setModels((prev) => prev.map((m) => m.id === modelId ? {
            ...m,
            progress: e.payload.progress,
            downloadStatus: e.payload.status,
            downloadedBytes: Math.round(e.payload.downloaded_gb * 1e9),
            totalBytes: Math.round(e.payload.total_gb * 1e9),
          } : m));
        }
      });

      try {
        await invoke('llm_download_gguf', {
          url: model.ggufUrl,
          filename: model.ggufFilename,
          hfToken: settings.huggingFaceToken ?? '',
        });
        unlisten();

        // Model direct laden na download
        await invoke('llm_load_model', { filename: model.ggufFilename });

        setModels((prev) => prev.map((m) => m.id === modelId ? {
          ...m, status: 'downloaded', progress: 100, downloadStatus: undefined,
        } : m));
        setSettings((prev) => ({
          ...prev,
          modelId,
          downloadedModelIds: [...new Set([...prev.downloadedModelIds, modelId])],
        }));
      } catch (e) {
        unlisten();
        const errMsg = String(e);
        console.error('[Download] mislukt:', errMsg, '\nURL:', model.ggufUrl);
        setModels((prev) => prev.map((m) => m.id === modelId ? {
          ...m, status: 'available', progress: 0,
          downloadStatus: errMsg.slice(0, 120),
          downloadedBytes: undefined, totalBytes: undefined,
        } : m));
      }
      return;
    }

    // Fallback: Ollama pull voor modellen zonder ggufUrl
    if (model.ollamaId) {
      try {
        const unlisten = await listen<{ model: string; progress: number; status: string; error?: string }>(
          'ollama-pull-progress',
          (e) => {
            if (e.payload.model === model.ollamaId) {
              if (e.payload.status === 'error' || e.payload.error) {
                setModels((prev) => prev.map((m) => m.id === modelId ? { ...m, status: 'available', progress: 0 } : m));
              } else {
                setModels((prev) => prev.map((m) => m.id === modelId ? { ...m, progress: e.payload.progress } : m));
              }
            }
          }
        );
        await invoke('ollama_pull_model', { modelId: model.ollamaId, ollamaUrl: settings.ollamaUrl });
        unlisten();
        setModels((prev) => prev.map((m) => m.id === modelId ? { ...m, status: 'downloaded', progress: 100 } : m));
        setSettings((prev) => ({ ...prev, downloadedModelIds: [...new Set([...prev.downloadedModelIds, modelId])] }));
      } catch {
        setModels((prev) => prev.map((m) => m.id === modelId ? { ...m, status: 'available', progress: 0 } : m));
      }
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    const model = models.find((m) => m.id === modelId);
    if (!model?.ollamaId) return;
    try {
      if (isDesktop) {
        await invoke('ollama_delete_model', { modelId: model.ollamaId, ollamaUrl: settings.ollamaUrl });
      }
      setModels((prev) => prev.map((m) => m.id === modelId ? { ...m, status: 'available', progress: undefined } : m));
      setSettings((prev) => ({
        ...prev,
        downloadedModelIds: prev.downloadedModelIds.filter((id) => id !== modelId),
        modelId: prev.modelId === modelId
          ? (models.find((m) => m.id !== modelId && m.status === 'downloaded')?.id ?? prev.modelId)
          : prev.modelId,
      }));
    } catch (e) {
      console.error('Model delete failed:', e);
    }
  };

  // Show setup wizard on first launch

  if (isDesktop && !settings.setupComplete && status !== 'loading') {
    return (
      <SetupWizard
        ollamaUrl={settings.ollamaUrl}
        onComplete={() => {
          handleSettingsChange({ setupComplete: true });
          // Sync modellen na setup zodat net-gedownloade modellen zichtbaar worden
          syncInstalledModels(settings.ollamaUrl, ramGb);
          // Stel het beste model in op basis van RAM
          setSettings((prev) => ({ ...prev, modelId: getDefaultModelId(ramGb) }));
        }}
      />
    );
  }

  // Web landing page
  if (!isDesktop) {
    return (
      <div className="h-screen w-screen bg-black overflow-y-auto font-sans">
        <WelcomePage onStart={() => {
          document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' });
        }} />
      </div>
    );
  }

  // Loading splash
  if (status === 'loading') {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center gap-8 rounded-xl">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center gap-5"
        >
          <div className="w-20 h-20 rounded-[28px] bg-white flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.12)]">
            <Zap className="w-10 h-10 text-black fill-black" />
          </div>

          <div className="flex flex-col items-center gap-1">
            <h1 className="text-lg font-display font-black tracking-tighter text-white uppercase">
              OpenSuggest
            </h1>
            <p className="text-[9px] text-white/20 uppercase tracking-[0.45em] font-bold">
              AI Autocomplete
            </p>
          </div>
        </motion.div>

        {/* Animated dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-1.5"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1 h-1 rounded-full bg-white/20"
              animate={{ opacity: [0.2, 0.8, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </motion.div>
      </div>
    );
  }

  const settingsTabs = ['settings', 'models', 'appearance', 'shortcuts', 'privacy', 'personalization', 'stats'];

  return (
    <div className="flex flex-col h-screen w-screen bg-black overflow-hidden font-sans select-none rounded-xl">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          isEnabled={settings.isEnabled}
          onToggle={() => handleSettingsChange({ isEnabled: !settings.isEnabled })}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence>
              {activeTab === 'web' && (
                <motion.div key="web" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="h-full overflow-y-auto absolute inset-0">
                  <WelcomePage onStart={handleTabChange} settings={settings} onSettingsChange={handleSettingsChange} />
                </motion.div>
              )}
              {activeTab === 'demo' && (
                <motion.div key="demo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="h-full overflow-y-auto p-10 max-w-4xl mx-auto absolute inset-0">
                  <h2 className="text-3xl font-display font-black text-white uppercase tracking-tight mb-3">Playground</h2>
                  <p className="text-sm text-white/30 mb-10">Type below and watch the AI complete your sentences in real time.</p>
                  <GhostEditor settings={settings} onSettingsChange={handleSettingsChange} screenContext={screenContext} />
                </motion.div>
              )}
              {settingsTabs.includes(activeTab) && (
                <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="h-full absolute inset-0">
                  <SettingsView
                    settings={settings}
                    onSettingsChange={handleSettingsChange}
                    models={models}
                    onDownloadModel={handleDownloadModel}
                    onDeleteModel={handleDeleteModel}
                    activeSection={activeTab}
                    ramGb={ramGb}
                    onEngineStarted={() => syncInstalledModels(settings.ollamaUrl, ramGb)}
                  />
                </motion.div>
              )}
              {activeTab === 'download' && (
                <motion.div key="download" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="h-full absolute inset-0">
                  <DownloadView />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
