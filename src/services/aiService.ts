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

/** Geeft het prompt-formaat terug op basis van het model-ID. */
function getPromptTemplate(modelId: string): string {
  if (modelId.includes('qwen')) return 'qwen_fim';
  if (modelId.includes('llama')) return 'llama';
  if (modelId.includes('mistral')) return 'mistral';
  return 'gemma';
}

/** FIM-modellen (bijv. Qwen) kunnen mid-word completions aan; instructie-modellen niet. */
export function modelSupportsFim(modelId: string): boolean {
  return modelId.includes('qwen');
}

function buildMessages(
  text: string,
  modelId: string,
  screenContext: string,
  clipboardContext: string,
  historyContext: string,
): { system: string; userMessage: string; promptTemplate: string } {
  const promptTemplate = getPromptTemplate(modelId);

  // FIM-modellen (Qwen) hebben geen systeem-prompt nodig — de FIM-tokens doen het werk.
  if (promptTemplate === 'qwen_fim') {
    const tail = text.length > 500 ? text.slice(-500) : text;
    return { system: '', userMessage: tail, promptTemplate };
  }

  const contextParts: string[] = [];
  if (screenContext)    contextParts.push(`Screen: ${screenContext}`);
  if (clipboardContext) contextParts.push(`Clipboard: ${clipboardContext}`);
  if (historyContext)   contextParts.push(`Style: ${historyContext.slice(0, 200)}`);

  const system = `You are an autocomplete engine. Continue the given text naturally in the same language.
Output ONLY the next 3-5 words. No explanations, no greetings, no preamble.
The input always ends at a word boundary. Match the tone and style.${contextParts.length ? '\n' + contextParts.join(' | ') : ''}`;

  const tail = text.length > 400 ? text.slice(-400) : text;
  const userMessage = `Continue: ${tail}`;

  return { system, userMessage, promptTemplate };
}

// ─────────────────────────── Result Cache ─────────────────────────────────────

const completionCache = new Map<string, string>();

function cacheKey(text: string): string {
  return text.slice(-300);
}

function getCached(text: string): string | undefined {
  return completionCache.get(cacheKey(text));
}

function setCached(text: string, result: string) {
  const key = cacheKey(text);
  completionCache.set(key, result);
  if (completionCache.size > 30) {
    completionCache.delete(completionCache.keys().next().value!);
  }
}

// ─────────────────────────── Smart Spacing ────────────────────────────────────

/**
 * Verwerkt een ruwe model-suggestie naar een display-klare aanvulling.
 * @param isFim  true voor FIM-modellen (Qwen): het model geeft de exacte suffix terug,
 *               dus GEEN automatische spatie toevoegen — dat zou "Maken" in "Ma ken" veranderen.
 *               false voor instructie-modellen: spatie wel toevoegen bij nieuwe woorden.
 */
export function smartPrefix(existingText: string, suggestion: string, isFim = false): string {
  if (!suggestion) return suggestion;

  // Strip markdown formatting en model-artifacts
  let processed = suggestion
    .replace(/\*\*/g, '')
    .replace(/\[COMPLETE FROM HERE\]/gi, '');

  if (!processed) return '';

  // Verwijder overlappende tekst (bijv. als de AI de input herhaalt)
  const maxOverlap = Math.min(existingText.length, processed.length, 150);
  const existingLower = existingText.toLowerCase();
  const processedLower = processed.toLowerCase();

  let overlapLength = 0;
  for (let i = maxOverlap; i > 0; i--) {
    if (existingLower.slice(-i) === processedLower.slice(0, i)) {
      overlapLength = i;
      break;
    }
  }

  if (overlapLength > 0) {
    processed = processed.slice(overlapLength);
  }

  if (!processed) return '';

  // Voorkom dubbele spaties
  if (existingText.endsWith(' ') && processed.startsWith(' ')) {
    processed = processed.trimStart();
  }

  // Instructie-modellen retourneren een nieuw woord zonder leading space → voeg die toe.
  // FIM-modellen geven de exacte suffix terug ("ken" voor "Ma") → geen spatie nodig.
  if (!isFim && overlapLength === 0 && /\w$/.test(existingText) && /^\w/.test(processed)) {
    processed = ' ' + processed;
  }

  return processed;
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

  const cached = getCached(text);
  if (cached !== undefined) return cached;

  if (isDesktop) {
    const model = MODELS.find((m) => m.id === modelId) || VISION_MODELS.find((m) => m.id === modelId);
    const ollamaModelId = model?.ollamaId ?? modelId;

    const { system, userMessage, promptTemplate } = buildMessages(
      text,
      modelId,
      options.screenContext ?? '',
      options.clipboardContext ?? '',
      options.historyContext ?? ''
    );

    try {
      const raw = await invoke<string>('llm_complete', {
        systemPrompt: system,
        userText: userMessage,
        maxTokens: 8,
        promptTemplate,
      });
      if (raw) {
        const result = smartPrefix(text, raw, modelSupportsFim(modelId));
        setCached(text, result);
        return result;
      }
    } catch {
      // Fallback naar Ollama
    }

    try {
      const isFimModel = modelSupportsFim(modelId);
      const raw = await invoke<string>('ollama_chat', {
        userMessage,
        modelId: ollamaModelId,
        ollamaUrl,
        // FIM-modellen via Ollama krijgen een lege systemPrompt —
        // de userMessage bevat al het FIM-formaat via de prompt template
        systemPrompt: isFimModel ? '' : system,
        images: options.images ?? [],
      });
      const result = smartPrefix(text, raw, isFimModel);
      setCached(text, result);
      return result;
    } catch (e) {
      console.error('AI fout:', e);
      return '';
    }
  }

  return getBrowserFallback(text);
}

/**
 * Streaming versie van getCompletion voor de in-process LLM.
 * Roept `onToken` aan voor elk gegenereerd token, `onDone` wanneer klaar.
 * Geeft een cancel-functie terug.
 * Valt terug op `getCompletion` (batch) als streaming niet beschikbaar is.
 */
export async function streamCompletion(
  text: string,
  modelId: string,
  ollamaUrl: string,
  requestId: number,
  options: {
    screenContext?: string;
    clipboardContext?: string;
    historyContext?: string;
  },
  onToken: (token: string) => void,
  onDone: (fullText: string) => void,
): Promise<() => void> {
  if (!text.trim()) { onDone(''); return () => {}; }

  const cached = getCached(text);
  if (cached !== undefined) {
    // Simuleer streaming uit cache: toon direct als één stuk
    setTimeout(() => { onToken(cached); onDone(cached); }, 0);
    return () => {};
  }

  if (!isDesktop) {
    const result = getBrowserFallback(text);
    setTimeout(() => { if (result) onToken(result); onDone(result); }, 0);
    return () => {};
  }

  const { system, userMessage, promptTemplate } = buildMessages(
    text, modelId,
    options.screenContext ?? '',
    options.clipboardContext ?? '',
    options.historyContext ?? ''
  );
  const isFim = modelSupportsFim(modelId);

  let cancelled = false;
  let unlisten: (() => void) | null = null;
  let accumulated = '';

  try {
    const { listen } = await import('@tauri-apps/api/event');
    unlisten = await listen<{ id: number; token: string; done: boolean }>('llm-token', (event) => {
      if (cancelled || event.payload.id !== requestId) return;
      if (event.payload.done) {
        const processed = smartPrefix(text, accumulated, isFim);
        setCached(text, processed);
        onDone(processed);
        return;
      }
      accumulated += event.payload.token;
      const processed = smartPrefix(text, accumulated, isFim);
      if (processed) onToken(processed);
    });

    await invoke('llm_complete_stream', {
      systemPrompt: system,
      userText: userMessage,
      maxTokens: 8,
      promptTemplate,
      requestId,
    });
  } catch {
    unlisten?.();
    if (!cancelled) {
      // Fallback naar batch-modus (Ollama of andere fout)
      const result = await getCompletion(text, modelId, ollamaUrl, options);
      if (!cancelled) { onToken(result); onDone(result); }
    }
  }

  return () => {
    cancelled = true;
    unlisten?.();
  };
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
