/**
 * Clipboard Service — Read/write clipboard for context-aware suggestions.
 */

const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

export async function readClipboard(): Promise<string> {
  if (isDesktop) {
    try {
      const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
      return (await readText()) ?? '';
    } catch {
      return '';
    }
  }
  // Browser clipboard API
  try {
    return await navigator.clipboard.readText();
  } catch {
    return '';
  }
}

export async function writeClipboard(text: string): Promise<void> {
  if (isDesktop) {
    try {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(text);
    } catch {
      console.error('Clipboard write failed');
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    console.error('Clipboard write failed');
  }
}
