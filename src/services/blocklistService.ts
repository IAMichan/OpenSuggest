/**
 * Blocklist Service — Manage which apps/sites should NOT receive suggestions.
 */
import { invoke } from '@tauri-apps/api/core';
import { BlocklistEntry } from '../types';

const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

export async function getBlocklist(): Promise<BlocklistEntry[]> {
  if (isDesktop) {
    return invoke<BlocklistEntry[]>('blocklist_get');
  }
  return [];
}

export async function addToBlocklist(
  type: 'app' | 'website' | 'domain',
  value: string,
  label: string
): Promise<BlocklistEntry[]> {
  if (isDesktop) {
    return invoke<BlocklistEntry[]>('blocklist_add', { entryType: type, value, label });
  }
  return [];
}

export async function removeFromBlocklist(id: string): Promise<BlocklistEntry[]> {
  if (isDesktop) {
    return invoke<BlocklistEntry[]>('blocklist_remove', { id });
  }
  return [];
}

export async function isCurrentWindowBlocked(): Promise<boolean> {
  if (!isDesktop) return false;
  const windowName = await invoke<string>('get_active_window_name');
  return invoke<boolean>('blocklist_check', { windowName });
}
