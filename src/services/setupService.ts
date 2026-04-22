/**
 * Setup Service — Manages the first-run wizard state and Ollama installation.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { SetupStatus } from '../types';

const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

export async function getSetupStatus(ollamaUrl: string): Promise<SetupStatus> {
  if (isDesktop) {
    return invoke<SetupStatus>('get_setup_status', { ollamaUrl });
  }
  // Browser mode — return mock "all good" for demo
  return {
    ollama_installed: false,
    ollama_running: false,
    default_model_downloaded: false,
    vision_model_downloaded: false,
    accessibility_granted: true,
    screen_recording_granted: true,
  };
}

export async function installOllama(
  onProgress: (status: string, message: string) => void
): Promise<void> {
  if (!isDesktop) return;

  const unlisten = await listen<{ status: string; message: string }>(
    'ollama-install-progress',
    (event) => {
      onProgress(event.payload.status, event.payload.message);
    }
  );

  try {
    await invoke('ollama_install');
  } finally {
    unlisten();
  }
}

export async function startOllama(ollamaUrl: string): Promise<boolean> {
  if (!isDesktop) return false;
  return invoke<boolean>('ollama_start', { ollamaUrl });
}

export async function checkAccessibilityPermission(): Promise<boolean> {
  if (!isDesktop) return true;
  return invoke<boolean>('check_accessibility_permission');
}

export async function requestAccessibilityPermission(): Promise<void> {
  if (!isDesktop) return;
  await invoke('request_accessibility_permission');
}

export async function checkScreenRecordingPermission(): Promise<boolean> {
  if (!isDesktop) return true;
  return invoke<boolean>('check_screen_recording_permission');
}

export async function requestScreenRecordingPermission(): Promise<void> {
  if (!isDesktop) return;
  await invoke('request_screen_recording_permission');
}
