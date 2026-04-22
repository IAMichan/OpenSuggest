import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    import('react-dom/client').then(({ createRoot }) => {
      createRoot(root).render(
        <React.StrictMode>
          <div className="bg-transparent font-sans">
            <OverlayWindow />
          </div>
        </React.StrictMode>
      );
    });
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

  // Boot sequence
  useEffect(() => {
    const boot = async () => {
      setStatus('loading');
      try {
        // Haal RAM op voor modelaanbevelingen
        if (isDesktop) {
          const ram = await getSystemRamGb();
          setRamGb(ram);

          // Pas standaard model aan op basis van RAM als nog niet ingesteld
          const savedSettings = localStorage.getItem(STORAGE_KEY);
          if (!savedSettings || JSON.parse(savedSettings || '{}').modelId === DEFAULT_SETTINGS.modelId) {
            const bestModel = getDefaultModelId(ram);
            setSettings((prev) => ({ ...prev, modelId: bestModel }));
          }

          // Mark recommended models
          const recommended = getRecommendedModelIds(ram);
          setModels((prev) =>
            prev.map((m) => ({ ...m, recommended: recommended.includes(m.id) }))
          );

          // ── Start de gebundelde Ollama engine ──────────────────────────────
          try {
            const bundledUrl = await invoke<string>('start_bundled_ollama');
            // Update ollamaUrl naar de gebundelde poort
            setSettings((prev) => ({ ...prev, ollamaUrl: bundledUrl }));

            // Sync geïnstalleerde modellen via de gebundelde server
            const installed = await getInstalledModels(bundledUrl).catch(() => []);
            const installedNames = installed.map((m) => m.name);
            setModels((prev) =>
              prev.map((m) => ({
                ...m,
                status: installedNames.some(
                  (n) => m.ollamaId && (n === m.ollamaId || n === `${m.ollamaId}:latest`)
                )
                  ? 'downloaded'
                  : m.status,
                recommended: getRecommendedModelIds(ram).includes(m.id),
              }))
            );
          } catch (e) {
            console.warn('Gebundelde Ollama kon niet starten, probeer systeem-Ollama:', e);
            // Fallback: probeer systeem-Ollama te starten op de geconfigureerde URL
            const running = await checkOllama(settings.ollamaUrl);
            if (!running && settings.setupComplete) {
              await invoke('ollama_start', { ollamaUrl: settings.ollamaUrl }).catch(() => {});
            }
            // Sync modellen via systeem-Ollama
            const installed = await getInstalledModels(settings.ollamaUrl).catch(() => []);
            const installedNames = installed.map((m) => m.name);
            setModels((prev) =>
              prev.map((m) => ({
                ...m,
                status: installedNames.some(
                  (n) => m.ollamaId && (n === m.ollamaId || n === `${m.ollamaId}:latest`)
                )
                  ? 'downloaded'
                  : m.status,
                recommended: getRecommendedModelIds(ram).includes(m.id),
              }))
            );
          }
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
    const { emit } = await import('@tauri-apps/api/event');
    await emit('overlay-show-suggestion', {
      suggestion,
      context: text.slice(-60),
      modelId: settings.modelId,
    });

    // Show overlay window
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const overlay = WebviewWindow.getByLabel('overlay');
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
          const { emit } = await import('@tauri-apps/api/event');
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
    const unlistenAccepted = import('@tauri-apps/api/event').then(({ listen }) =>
      listen('overlay-accepted', () => { overlayVisible.current = false; })
    );
    const unlistenDismissed = import('@tauri-apps/api/event').then(({ listen }) =>
      listen('overlay-dismissed', () => { overlayVisible.current = false; })
    );

    return () => {
      if (globalPollInterval.current) clearInterval(globalPollInterval.current);
      if (globalDebounce.current) clearTimeout(globalDebounce.current);
      unlistenAccepted.then((p) => p.then((u) => u()));
      unlistenDismissed.then((p) => p.then((u) => u()));
    };
  }, [settings.globalEnabled, settings.setupComplete, settings.isEnabled, settings.triggerDelayMs, generateGlobalSuggestion]);

  // Luister naar tray-menu navigatie-events (bijv. "Instellingen" in de menubalk)
  useEffect(() => {
    if (!isDesktop) return;
    let cleanup: (() => void) | undefined;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<string>('navigate-to', (e) => {
        setActiveTab(e.payload);
        localStorage.setItem('opensuggest_active_tab', e.payload);
      }).then((unlisten) => { cleanup = unlisten; });
    });
    return () => { cleanup?.(); };
  }, []);

  const handleSettingsChange = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleDownloadModel = async (modelId: string) => {
    const model = models.find((m) => m.id === modelId);
    if (!model?.ollamaId) {
      console.error('Model niet gevonden of geen ollamaId:', modelId);
      return;
    }

    console.log(`Download starten voor ${model.ollamaId} via ${settings.ollamaUrl}...`);
    setModels((prev) => prev.map((m) => m.id === modelId ? { ...m, status: 'downloading', progress: 0 } : m));

    if (isDesktop) {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const unlisten = await listen<{ model: string; progress: number; status: string }>('ollama-pull-progress', (e) => {
          if (e.payload.model === model.ollamaId) {
            setModels((prev) => prev.map((m) => m.id === modelId ? { ...m, progress: e.payload.progress } : m));
          }
        });

        await invoke('ollama_pull_model', { modelId: model.ollamaId, ollamaUrl: settings.ollamaUrl });
        unlisten();

        setModels((prev) => prev.map((m) => m.id === modelId ? { ...m, status: 'downloaded', progress: 100 } : m));
        setSettings((prev) => ({ ...prev, downloadedModelIds: [...prev.downloadedModelIds, modelId] }));
        console.log(`Download van ${model.ollamaId} voltooid.`);
      } catch (e) {
        console.error('Download mislukt:', e);
        setModels((prev) => prev.map((m) => m.id === modelId ? { ...m, status: 'available', progress: 0 } : m));
      }
    } else {
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
        onComplete={() => handleSettingsChange({ setupComplete: true })}
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
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center gap-8">
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
    <div className="flex flex-col h-screen w-screen bg-black overflow-hidden font-sans select-none">
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
            <AnimatePresence mode="wait">
              {activeTab === 'web' && (
                <motion.div key="web" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto">
                  <WelcomePage onStart={handleTabChange} settings={settings} onSettingsChange={handleSettingsChange} />
                </motion.div>
              )}
              {activeTab === 'demo' && (
                <motion.div key="demo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto p-10 max-w-4xl mx-auto">
                  <h2 className="text-3xl font-display font-black text-white uppercase tracking-tight mb-3">Playground</h2>
                  <p className="text-sm text-white/30 mb-10">Type below and watch the AI complete your sentences in real time.</p>
                  <GhostEditor settings={settings} onSettingsChange={handleSettingsChange} screenContext={screenContext} />
                </motion.div>
              )}
              {settingsTabs.includes(activeTab) && (
                <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                  <SettingsView
                    settings={settings}
                    onSettingsChange={handleSettingsChange}
                    models={models}
                    onDownloadModel={handleDownloadModel}
                    onDeleteModel={handleDeleteModel}
                    activeSection={activeTab}
                    ramGb={ramGb}
                  />
                </motion.div>
              )}
              {activeTab === 'download' && (
                <motion.div key="download" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
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
