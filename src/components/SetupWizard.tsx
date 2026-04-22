import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, Circle, Loader2, ChevronRight, Download, ShieldCheck,
  Monitor, Clipboard, Cpu, AlertTriangle, RefreshCw, Zap, Eye
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { SetupStatus } from '../types';
import { OLLAMA_TEXT_MODEL, OLLAMA_VISION_MODEL } from '../constants';

const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error';

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  badge?: string;
  skippable?: boolean;
  progress?: number;
}

interface SetupWizardProps {
  ollamaUrl: string;
  onComplete: () => void;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: StepStatus; badge?: string; progress?: number }> = ({
  status, badge, progress
}) => {
  if (status === 'running') {
    return (
      <div className="flex items-center gap-2 min-w-30 justify-end">
        {progress !== undefined && progress > 0 && (
          <span className="text-xs font-mono text-white/50">{progress}%</span>
        )}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
          <Loader2 className="w-3 h-3 animate-spin text-white/60" />
          <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
            {progress !== undefined && progress > 0 ? 'Downloading' : 'Installing'}
          </span>
        </div>
      </div>
    );
  }
  if (status === 'done') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 min-w-25 justify-center">
        <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">
          {badge ?? 'Done'}
        </span>
      </div>
    );
  }
  if (status === 'skipped') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 min-w-25 justify-center">
        <span className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Skipped</span>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 min-w-25 justify-center">
        <AlertTriangle className="w-3 h-3 text-red-400" />
        <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">Failed</span>
      </div>
    );
  }
  // pending
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/3 border border-white/5 min-w-25 justify-center opacity-50">
      <span className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Waiting</span>
    </div>
  );
};

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const ProgressBar: React.FC<{ progress?: number }> = ({ progress }) => (
  <div className="w-full h-0.5 bg-white/5 rounded-full overflow-hidden mt-3 relative">
    {progress !== undefined && progress > 0 ? (
      <motion.div
        className="h-full bg-white/40 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ ease: 'linear' }}
      />
    ) : (
      <motion.div
        className="absolute h-full w-1/3 bg-white/40 rounded-full"
        initial={{ left: '-33%' }}
        animate={{ left: '100%' }}
        transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
      />
    )}
  </div>
);

// ─── Setup Row ────────────────────────────────────────────────────────────────

const SetupRow: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
  status: StepStatus;
  badge?: string;
  progress?: number;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, description, status, badge, progress, action }) => (
  <motion.div
    layout
    className={`flex items-start justify-between gap-6 py-5 px-6 rounded-2xl border transition-all duration-300 ${
      status === 'done'
        ? 'bg-white/3 border-white/10'
        : status === 'running'
        ? 'bg-white/5 border-white/15'
        : status === 'error'
        ? 'bg-red-500/5 border-red-500/15'
        : 'bg-transparent border-white/5'
    }`}
  >
    <div className="flex items-start gap-4 flex-1 min-w-0">
      <div className={`mt-0.5 p-2 rounded-xl shrink-0 ${
        status === 'done' ? 'bg-white/10' : status === 'running' ? 'bg-white/10' : 'bg-white/5'
      }`}>
        <Icon className={`w-4 h-4 ${status === 'done' ? 'text-white/80' : 'text-white/40'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-white/60 shrink-0" />}
          <p className={`text-sm font-semibold ${status === 'done' ? 'text-white/90' : 'text-white/50'}`}>
            {title}
          </p>
        </div>
        <p className="text-xs text-white/30 leading-relaxed">{description}</p>
        {status === 'running' && (
          <ProgressBar progress={progress} />
        )}
      </div>
    </div>
    <div className="shrink-0 flex flex-col items-end gap-2">
      <StatusBadge status={status} badge={badge} progress={progress} />
      {action}
    </div>
  </motion.div>
);

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export const SetupWizard: React.FC<SetupWizardProps> = ({ ollamaUrl, onComplete }) => {
  const [steps, setSteps] = useState<Step[]>([
    { id: 'ollama_engine', title: 'AI Engine', description: 'Ingebouwde AI engine — klaar.', status: 'done', badge: 'Bundled' },
    { id: 'default_model', title: 'AI Model', description: 'Gemma 2 2B is meegeleverd in de app — geen download nodig.', status: 'done', badge: 'Bundled' },
    { id: 'vision_model', title: 'Vision Model (optional)', description: `Downloads ${OLLAMA_VISION_MODEL} (1.7 GB) for screen-aware suggestions. Can be skipped.`, status: 'pending', progress: 0, skippable: true },
    { id: 'accessibility', title: 'Accessibility Permission', description: 'Required so OpenSuggest can show suggestions in all apps on your system (Chrome, Google, Word, etc.).', status: 'pending' },
    { id: 'screen_recording', title: 'Screen Recording (optional)', description: 'Recommended for context-aware suggestions. OpenSuggest analyzes your screen locally — nothing is sent anywhere.', status: 'pending', skippable: true },
    { id: 'clipboard', title: 'Clipboard Context (optional)', description: 'Allow OpenSuggest to read your clipboard for more relevant completions. Content is never stored.', status: 'pending', skippable: true },
  ]);

  const [allDone, setAllDone] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [clipboardEnabled, setClipboardEnabled] = useState(false);
  const [permissionPolling, setPermissionPolling] = useState<string | null>(null);

  const updateStep = useCallback((id: string, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  // ── Main setup flow ────────────────────────────────────────────────────────

  const runSetup = useCallback(async () => {
    if (!isDesktop) {
      // Browser demo mode — mark everything done
      setSteps((prev) => prev.map((s) => ({ ...s, status: 'done', badge: s.id === 'clipboard' ? 'Enabled' : 'Granted' })));
      setAllDone(true);
      return;
    }

    // Engine + model zijn gebundeld en starten automatisch — sla over, ga direct naar permissions

    // ── Step 2: Vision Model — auto-skip ─────────────────────────────────

    setCurrentStep(2);
    updateStep('vision_model', { status: 'skipped', badge: 'Skipped' });

    // ── Step 3: Accessibility Permission ──────────────────────────────────

    setCurrentStep(3);
    updateStep('accessibility', { status: 'running' });

    const checkA11y = async (): Promise<boolean> => {
      return invoke<boolean>('check_accessibility_permission');
    };

    if (!(await checkA11y())) {
      await invoke('request_accessibility_permission');
      setPermissionPolling('accessibility');
      // Poll until granted (max 60s)
      let granted = false;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        if (await checkA11y()) { granted = true; break; }
      }
      setPermissionPolling(null);
      if (granted) {
        updateStep('accessibility', { status: 'done', badge: 'Granted' });
      } else {
        updateStep('accessibility', { status: 'error' });
        return; // Required — can't continue
      }
    } else {
      updateStep('accessibility', { status: 'done', badge: 'Granted' });
    }

    // ── Step 4: Screen Recording (skippable) ──────────────────────────────

    setCurrentStep(4);
    updateStep('screen_recording', { status: 'running' });

    const checkScreen = async (): Promise<boolean> => {
      return invoke<boolean>('check_screen_recording_permission');
    };

    if (!(await checkScreen())) {
      await invoke('request_screen_recording_permission');
      setPermissionPolling('screen_recording');
      let granted = false;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        if (await checkScreen()) { granted = true; break; }
      }
      setPermissionPolling(null);
      updateStep('screen_recording', {
        status: granted ? 'done' : 'skipped',
        badge: granted ? 'Granted' : 'Skipped',
      });
    } else {
      updateStep('screen_recording', { status: 'done', badge: 'Granted' });
    }

    // ── Step 5: Clipboard (user choice) ──────────────────────────────────

    setCurrentStep(5);
    updateStep('clipboard', {
      status: 'done',
      badge: clipboardEnabled ? 'Enabled' : 'Disabled',
    });

    setAllDone(true);
    setCurrentStep(-1);
  }, [ollamaUrl, clipboardEnabled, updateStep]);

  useEffect(() => {
    runSetup();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allRequired = steps
    .filter((s) => !s.skippable)
    .every((s) => s.status === 'done');

  const stepIcons: Record<string, React.ElementType> = {
    ollama_engine: Cpu,
    default_model: Download,
    vision_model: Eye,
    accessibility: ShieldCheck,
    screen_recording: Monitor,
    clipboard: Clipboard,
  };

  const stepBadgeOverrides: Record<string, string> = {
    ollama_engine: 'Running',
    default_model: 'Downloaded',
    vision_model: 'Skipped',
    accessibility: 'Granted',
    screen_recording: 'Granted',
    clipboard: clipboardEnabled ? 'Enabled' : 'Disabled',
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.15)]">
              <Zap className="w-5 h-5 text-black fill-black" />
            </div>
            <div>
              <h1 className="text-xl font-display font-black tracking-tighter uppercase text-white">OpenSuggest</h1>
              <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold">Setup & Permissions</p>
            </div>
          </div>

          {/* All Set Banner */}
          <AnimatePresence>
            {allRequired && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 mb-6"
              >
                <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                <div>
                  <p className="text-sm font-bold text-white">All Set!</p>
                  <p className="text-xs text-white/40">
                    OpenSuggest is ready to use. You can close this wizard or continue configuring.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!allRequired && (
            <div className="p-4 rounded-2xl bg-white/3 border border-white/5 mb-6">
              <p className="text-sm text-white/50 leading-relaxed">
                Setting up your local AI engine. This happens once and takes a few minutes depending on your internet speed.
              </p>
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-2 mb-8">
          {steps.map((step) => {
            const Icon = stepIcons[step.id] ?? Circle;
            const isPermissionStep = step.id === 'accessibility' || step.id === 'screen_recording';

            return (
              <SetupRow
                key={step.id}
                icon={Icon}
                title={step.title}
                description={step.description}
                status={step.status}
                badge={step.status === 'done' ? stepBadgeOverrides[step.id] : undefined}
                progress={step.progress}
                action={
                  step.id === 'clipboard' && step.status !== 'running' ? (
                    <button
                      onClick={() => {
                        setClipboardEnabled((p) => !p);
                        updateStep('clipboard', {
                          status: 'done',
                          badge: !clipboardEnabled ? 'Enabled' : 'Disabled',
                        });
                      }}
                      className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-all ${
                        clipboardEnabled
                          ? 'bg-white/10 border-white/20 text-white/80'
                          : 'bg-transparent border-white/10 text-white/30'
                      }`}
                    >
                      {clipboardEnabled ? 'Enabled' : 'Enable'}
                    </button>
                  ) : isPermissionStep && step.status === 'error' ? (
                    <button
                      onClick={() => {
                        const cmd =
                          step.id === 'accessibility'
                            ? 'request_accessibility_permission'
                            : 'request_screen_recording_permission';
                        invoke(cmd).catch(console.error);
                      }}
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 transition-all"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Open Settings
                    </button>
                  ) : null
                }
              />
            );
          })}
        </div>

        {/* Footer CTA */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
            {allRequired ? 'All required steps complete' : 'Setting up your local AI...'}
          </p>
          <motion.button
            onClick={onComplete}
            disabled={!allRequired}
            whileHover={allRequired ? { scale: 1.02 } : {}}
            whileTap={allRequired ? { scale: 0.98 } : {}}
            className={`flex items-center gap-3 px-8 py-3 rounded-2xl font-display font-black uppercase tracking-widest text-xs transition-all ${
              allRequired
                ? 'bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.1)] cursor-pointer'
                : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
            }`}
          >
            Continue to App
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Polling indicator */}
        <AnimatePresence>
          {permissionPolling && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-center gap-2 justify-center text-[10px] text-white/20 uppercase tracking-widest"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              Waiting for {permissionPolling === 'accessibility' ? 'Accessibility' : 'Screen Recording'} permission...
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
