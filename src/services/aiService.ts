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

function buildMessages(
  text: string,
  screenContext: string,
  clipboardContext: string,
  historyContext: string,
): { system: string; userMessage: string } {
  // Analyse de huidige tekst zodat het model weet waar het zit
  const trimmed = text.trimEnd();
  const lastSentenceMatch = trimmed.match(/[.!?]\s+([^.!?]*)$/);
  const currentSentence = lastSentenceMatch ? lastSentenceMatch[1] : trimmed;
  const isMidSentence = currentSentence.length > 0 && !/[.!?]$/.test(trimmed);
  const endsWithSpace = text.endsWith(' ');

  const contextParts: string[] = [];
  if (screenContext)    contextParts.push(`Screen context: ${screenContext}`);
  if (clipboardContext) contextParts.push(`Clipboard: ${clipboardContext}`);
  if (historyContext)   contextParts.push(`Writing style: ${historyContext.slice(0, 120)}`);

  const task = isMidSentence
    ? 'The user is mid-sentence. Output only the words that complete the current sentence.'
    : 'The user finished a sentence. Write the next sentence only.';

  const system = [
    'You are a text autocomplete engine. ' + task,
    'Critical: output ONLY the raw continuation text. No preamble, no labels, no markdown.',
    'Match the exact language (Dutch/English/etc) and writing style of the input. Maximum 25 words.',
    ...(contextParts.length ? [contextParts.join(' | ')] : []),
  ].join('\n');

  // Last 500 chars — gives enough semantic context without overloading the prompt
  const contextWindow = text.length > 500 ? '…' + text.slice(-500) : text;
  // Send the text as-is; the model naturally continues from the end
  const userMessage = contextWindow;

  return { system, userMessage };
}

// ─────────────────────────── Smart Spacing ────────────────────────────────────

export function smartPrefix(existingText: string, suggestion: string): string {
  if (!suggestion) return suggestion;

  // Verwijder overlappende tekst (bijv. als de AI de input herhaalt)
  const maxOverlap = Math.min(existingText.length, suggestion.length, 150);
  const existingLower = existingText.toLowerCase();
  const suggestionLower = suggestion.toLowerCase();

  let overlapLength = 0;
  for (let i = maxOverlap; i > 0; i--) {
    if (existingLower.slice(-i) === suggestionLower.slice(0, i)) {
      overlapLength = i;
      break;
    }
  }

  let processedSuggestion = suggestion;
  if (overlapLength > 0) {
    processedSuggestion = suggestion.slice(overlapLength);
  }

  // Strip [COMPLETE FROM HERE] als het model dit in de output meeneemt
  processedSuggestion = processedSuggestion.replace(/\[COMPLETE FROM HERE\]/gi, '').trim();

  const trimmed = processedSuggestion.trimStart();
  if (!trimmed) return '';

  // Geen spatie voor leestekens
  const startsWithPunctuation = /^[,\.!\?;:\-…)]/.test(trimmed);
  if (startsWithPunctuation) return trimmed;

  // Bestaande tekst eindigt al met whitespace
  if (/[\s\n\t]$/.test(existingText)) return trimmed;

  // Na openend haakje/aanhalingsteken geen spatie
  if (/[([{"'«]$/.test(existingText)) return trimmed;

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

    const { system, userMessage } = buildMessages(
      text,
      options.screenContext ?? '',
      options.clipboardContext ?? '',
      options.historyContext ?? ''
    );

    try {
      // Probeer eerst in-process llama.cpp (geen server nodig)
      const raw = await invoke<string>('llm_complete', {
        systemPrompt: system,
        userText: userMessage,
        maxTokens: 40,
      });
      if (raw) return smartPrefix(text, raw);
    } catch {
      // Fallback naar Ollama als llm_complete niet beschikbaar is
    }

    try {
      const raw = await invoke<string>('ollama_chat', {
        userMessage,
        modelId: ollamaModelId,
        ollamaUrl,
        systemPrompt: system,
        images: options.images ?? [],
      });
      return smartPrefix(text, raw);
    } catch (e) {
      console.error('AI fout:', e);
      return '';
    }
  }

  return getBrowserFallback(text);
}

// ─────────────────────────── System Info ──────────────────────────────────────

export async function getSystemRamGb(): Promise<number> {
  if (!isDesktop) return 8;
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
