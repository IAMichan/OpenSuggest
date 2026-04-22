/**
 * Stats Service — Reads and writes usage statistics.
 * In desktop mode: Rust/SQLite backend.
 * In browser mode: localStorage.
 */
import { invoke } from '@tauri-apps/api/core';
import { AllStats, DailyStats } from '../types';

const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
const LS_KEY = 'opensuggest_stats';

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function emptyDay(date: string): DailyStats {
  return { date, suggestions: 0, accepted: 0, words: 0 };
}

// ─── localStorage fallback ────────────────────────────────────────────────────

function lsGetStats(): AllStats {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as AllStats;
  } catch {}
  return { today: emptyDay(today()), week: [], total: { suggestions: 0, accepted: 0, words: 0 } };
}

function lsSaveStats(stats: AllStats) {
  localStorage.setItem(LS_KEY, JSON.stringify(stats));
}

function lsRecord(accepted: boolean, wordCount: number) {
  const stats = lsGetStats();
  const t = today();
  if (stats.today.date !== t) {
    // Roll over day
    stats.week = [...stats.week.slice(-6), stats.today];
    stats.today = emptyDay(t);
  }
  stats.today.suggestions += 1;
  if (accepted) stats.today.accepted += 1;
  stats.today.words += wordCount;
  stats.total.suggestions += 1;
  if (accepted) stats.total.accepted += 1;
  stats.total.words += wordCount;
  lsSaveStats(stats);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function recordSuggestion(accepted: boolean, wordCount: number): Promise<void> {
  if (isDesktop) {
    await invoke('stats_record', { accepted, wordCount }).catch(console.error);
  } else {
    lsRecord(accepted, wordCount);
  }
}

export async function getAllStats(): Promise<AllStats> {
  if (isDesktop) {
    return invoke<AllStats>('stats_get_all');
  }
  return lsGetStats();
}

export async function resetStats(): Promise<void> {
  if (isDesktop) {
    await invoke('stats_reset');
  } else {
    localStorage.removeItem(LS_KEY);
  }
}

export function estimateMinutesSaved(wordsGenerated: number): number {
  // Average typing speed ~40 WPM; saved time = generated words / 40 * 60s
  return Math.round((wordsGenerated / 40) * 60) / 60;
}
