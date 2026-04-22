/**
 * AI Service — local Ollama integration for real-time autocomplete.
 * Uses /api/chat for better compatibility with all models.
 */
import { invoke } from '@tauri-apps/api/core';
import { MODELS, VISION_MODELS } from '../constants';
import { OllamaModel } from '../types';

const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

// ─────────────────────────── Ollama Status ────────────────────────────────────

export async function checkOllama(ollamaUrl: string): Promise<boolean> {
  if (isDesktop) {
    return invoke<boolean>('ollama_check', { ollamaUrl });
  }
  try {
    const resp = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function getInstalledModels(ollamaUrl: string): Promise<OllamaModel[]> {
  if (isDesktop) {
    return invoke<OllamaModel[]>('ollama_list_models', { ollamaUrl });
  }
  return [];
}

// ─────────────────────────── Model Download ───────────────────────────────────

export async function pullModel(
  ollamaId: string,
  ollamaUrl: string,
  onProgress: (progress: number, status: string) => void
): Promise<void> {
  if (!isDesktop) {
    return new Promise((resolve) => {
      let p = 0;
      const iv = setInterval(() => {
        p = Math.min(100, p + Math.random() * 12);
        onProgress(Math.round(p), p >= 100 ? 'Downloaded' : 'Downloading...');
        if (p >= 100) { clearInterval(iv); resolve(); }
      }, 400);
    });
  }

  const { listen } = await import('@tauri-apps/api/event');
  const unlisten = await listen<{ model: string; status: string; progress: number }>(
    'ollama-pull-progress',
    (event) => {
      if (event.payload.model === ollamaId) {
        onProgress(event.payload.progress, event.payload.status);
      }
    }
  );

  try {
    await invoke('ollama_pull_model', { modelId: ollamaId, ollamaUrl });
  } finally {
    unlisten();
  }
}

export async function deleteModel(modelId: string, ollamaUrl: string): Promise<void> {
  if (isDesktop) {
    await invoke('ollama_delete_model', { modelId, ollamaUrl });
  }
}

// ─────────────────────────── Prompt Engineering ───────────────────────────────

/**
 * Bouwt een sterk autocomplete-prompt dat het model stuurt naar korte,
 * inline vervolgingen — geen uitleg, geen aanhalingstekens, geen labels.
 */
function buildMessages(
  text: string,
  screenContext: string,
  clipboardContext: string,
  historyContext: string,
  isMidWord: boolean
): { system: string; userMessage: string } {
  const contextLines: string[] = [];
  if (screenContext)    contextLines.push(`Schermcontext: ${screenContext}`);
  if (clipboardContext) contextLines.push(`Klembord: ${clipboardContext}`);
  if (historyContext)   contextLines.push(`Schrijfstijl gebruiker: ${historyContext}`);

  // Extract the partial word at the end so we can name it explicitly
  const partialWordMatch = text.match(/\S+$/);
  const partialWord = partialWordMatch ? partialWordMatch[0] : '';

  const system = [
    'Je bent een low-latency autocomplete engine.',
    '',
    'Taak: Voltooi de tekst van de gebruiker direct vanaf het laatste karakter.',
    '',
    'Beperkingen:',
    '- GEEN uitleg, GEEN beleefdheden, GEEN markdown.',
    '- Output is alleen de tekstuele aanvulling.',
    '- Stop onmiddellijk bij een punt (.) of nieuwe regel.',
    isMidWord
      ? `- Het laatste woord "${partialWord}" is ONVOLLEDIG. Geef ALLEEN de ontbrekende letters om het woord af te maken, dan eventueel een paar woorden verder.`
      : '- Geef maximaal 3 tot 5 woorden terug voor maximale snelheid.',
    '- Als de context onduidelijk is, geef dan geen output (leeg laten).',
    '- Begin NOOIT met "...", "\u2026" of een andere ellips.',
    '- Begin NOOIT met een spatie \u2014 spati\u00ebring wordt extern afgehandeld.',
    '',
    'Stijl: Kopieer exact het vocabulaire en de grammatica van de input.',
    ...(contextLines.length
      ? ['', ...contextLines]
      : []),
  ].join('\n');

  // Stuur de laatste 300 tekens voor betere kwaliteit
  const contextWindow = text.length > 300 ? '\u2026' + text.slice(-300) : text;

  return {
    system,
    userMessage: contextWindow,
  };
}

// ─────────────────────────── Smart Spacing ────────────────────────────────────

/**
 * Determines the correct prefix to prepend to an AI suggestion so that it
 * connects naturally to the text the user has already typed.
 *
 * isMidWord = true  → the text ends on a partial word (e.g. "ka").
 *   The suggestion completes that word, so NO leading space is added.
 *
 * Examples:
 *   "En het"   + "is ook handig"  (midWord=false) → " is ook handig"
 *   "En het "  + "is ook handig"  (midWord=false) → "is ook handig"   (space already present)
 *   "teksten en ka" + "tten zijn"  (midWord=true)  → "tten zijn"       (completing the word)
 *   "klaar"    + ","              (midWord=false) → ","               (punctuation, no space)
 */
export function smartPrefix(existingText: string, suggestion: string, isMidWord = false): string {
  if (!suggestion) return suggestion;

  // Strip any accidental leading whitespace from the suggestion
  const trimmed = suggestion.trimStart();
  if (!trimmed) return suggestion;

  // Mid-word: the suggestion directly continues the partial word — no space ever
  if (isMidWord) return trimmed;

  // If the suggestion starts with punctuation, no space before it
  const startsWithPunctuation = /^[,\.!\?;:\-\u2026)]/.test(trimmed);
  if (startsWithPunctuation) return trimmed;

  // If the existing text already ends with whitespace, no extra space needed
  if (/[\s\n\t]$/.test(existingText)) return trimmed;

  // If the existing text ends with an opening bracket/quote, no space needed
  if (/[([{"'\u00ab]$/.test(existingText)) return trimmed;

  // Otherwise prepend a space (text ends on a complete word/punctuation)
  return ' ' + trimmed;
}

// ─────────────────────────── Browser Fallback ─────────────────────────────────

const BROWSER_SUGGESTIONS: Record<string, string> = {
  implement: 'ing a local neural engine for speed.',
  privacy: ' is built into the architecture of the app.',
  'local ai': ' ensures your data never leaves your device.',
  fast: ' inference running directly on your GPU.',
  open: 'Suggest provides AI completions locally.',
  we: ' believe privacy is a fundamental right.',
  i: ' am working on a project that',
  the: ' quick brown fox jumps over the lazy dog.',
};

function getBrowserFallback(text: string): string {
  const lower = text.toLowerCase().trim();
  for (const [trigger, suggestion] of Object.entries(BROWSER_SUGGESTIONS)) {
    if (lower.endsWith(trigger)) return suggestion;
  }
  return '';
}

// ─────────────────────────── Completion ───────────────────────────────────────

export async function getCompletion(
  text: string,
  modelId: string,
  ollamaUrl: string,
  options: {
    screenContext?: string;
    clipboardContext?: string;
    historyContext?: string;
    images?: string[];
  } = {}
): Promise<string> {
  if (!text.trim()) return '';

  if (isDesktop) {
    const model = MODELS.find((m) => m.id === modelId) || VISION_MODELS.find((m) => m.id === modelId);
    const ollamaModelId = model?.ollamaId ?? modelId;

    // Detect whether the cursor is in the middle of a word
    // (last char is a word character AND is not preceded by whitespace at the very end)
    const isMidWord = /\S$/.test(text) && !/\s/.test(text.slice(-1));

    const { system, userMessage } = buildMessages(
      text,
      options.screenContext ?? '',
      options.clipboardContext ?? '',
      options.historyContext ?? '',
      isMidWord
    );

    try {
      const raw = await invoke<string>('ollama_chat', {
        userMessage,
        modelId: ollamaModelId,
        ollamaUrl,
        systemPrompt: system,
        images: options.images ?? [],
      });
      // Apply smart spacing — skip leading space when completing a mid-word
      return smartPrefix(text, raw, isMidWord);
    } catch (e) {
      console.error('Ollama fout:', e);
      return '';
    }
  }

  return getBrowserFallback(text);
}

// ─────────────────────────── System Info ──────────────────────────────────────

export async function getSystemRamGb(): Promise<number> {
  if (!isDesktop) return 8; // redelijke standaard voor browser
  try {
    return await invoke<number>('get_system_ram_gb');
  } catch {
    return 8;
  }
}

// ─────────────────────────── Installed Models Sync ───────────────────────────

export async function getNativeEngineState(): Promise<{
  isEnabled: boolean;
  activeModelId: string;
  downloadedIds: string[];
  historyCount: number;
} | null> {
  if (!isDesktop) return null;
  try {
    const models = await getInstalledModels('http://127.0.0.1:11435');
    const downloadedIds = models.map((m) => {
      const match = MODELS.find(
        (appModel) => appModel.ollamaId && (m.name === appModel.ollamaId || m.name === `${appModel.ollamaId}:latest`)
      );
      return match?.id ?? m.name;
    });
    return { isEnabled: true, activeModelId: 'llama3.2-3b', downloadedIds, historyCount: 0 };
  } catch {
    return null;
  }
}
