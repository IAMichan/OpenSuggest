import { AIModel, AppSettings } from './types';

export const APP_VERSION = '2.0.0';

export const OLLAMA_TEXT_MODEL = 'llama3.2:3b';
export const OLLAMA_VISION_MODEL = 'moondream';

// Verified working HuggingFace download URLs (no authentication required)
const HF = 'https://huggingface.co';

export const MODELS: AIModel[] = [
  {
    id: 'qwen2.5-1.5b',
    ollamaId: 'qwen2.5:1.5b',
    name: 'Qwen 2.5 1.5B',
    size: '1.1 GB',
    description: 'Ultra-lightweight. Best for older hardware (< 8 GB RAM).',
    type: 'speed',
    status: 'available',
    minRamGb: 4,
    ggufFilename: 'Qwen2.5-1.5B-Instruct-Q5_K_M.gguf',
    ggufUrl: `${HF}/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q5_K_M.gguf`,
  },
  {
    id: 'llama3.2-3b',
    ollamaId: 'llama3.2:3b',
    name: 'Llama 3.2 3B',
    size: '2.2 GB',
    description: "Meta's efficient 3B model. Fast and capable.",
    type: 'speed',
    status: 'available',
    minRamGb: 6,
    ggufFilename: 'Llama-3.2-3B-Instruct-Q5_K_M.gguf',
    ggufUrl: `${HF}/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q5_K_M.gguf`,
  },
  {
    id: 'gemma3-4b',
    ollamaId: 'gemma3:4b',
    name: 'Gemma 3 4B',
    size: '2.7 GB',
    description: "Google's Gemma 3 4B — best quality for everyday typing. Recommended.",
    type: 'balanced',
    status: 'available',
    minRamGb: 8,
    ggufFilename: 'gemma-3-4b-it-UD-Q5_K_XL.gguf',
    ggufUrl: `${HF}/unsloth/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-UD-Q5_K_XL.gguf`,
  },
  {
    id: 'gemma3-4b-q4',
    ollamaId: 'gemma3:4b-q4',
    name: 'Gemma 3 4B (Light)',
    size: '2.3 GB',
    description: "Gemma 3 4B Q4 — smaller download, still very capable.",
    type: 'balanced',
    status: 'available',
    minRamGb: 6,
    ggufFilename: 'gemma-3-4b-it-Q4_K_M.gguf',
    ggufUrl: `${HF}/unsloth/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf`,
  },
  {
    id: 'gemma4-e4b',
    ollamaId: 'gemma3:4b',
    name: 'Gemma 4 E4B',
    size: '6.2 GB',
    description: "Google's Gemma 4 — exact same model as Cotypist. Best quality.",
    type: 'power',
    status: 'available',
    minRamGb: 12,
    ggufFilename: 'gemma-4-E4B-it-UD-Q5_K_XL.gguf',
    ggufUrl: `${HF}/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-UD-Q5_K_XL.gguf`,
  },
  {
    id: 'mistral-7b',
    ollamaId: 'mistral:7b',
    name: 'Mistral 7B',
    size: '4.8 GB',
    description: 'Industry-standard 7B model. Excellent reasoning and writing.',
    type: 'power',
    status: 'available',
    minRamGb: 12,
    ggufFilename: 'Mistral-7B-Instruct-v0.3-Q5_K_M.gguf',
    ggufUrl: `${HF}/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q5_K_M.gguf`,
  },
];

export const VISION_MODELS: AIModel[] = [
  {
    id: 'moondream',
    ollamaId: 'moondream',
    name: 'Moondream',
    size: '1.7 GB',
    description: 'Small but capable vision model. Fast screen analysis.',
    type: 'speed',
    status: 'available',
    minRamGb: 6,
  },
  {
    id: 'llava-phi3',
    ollamaId: 'llava-phi3',
    name: 'LLaVA-Phi3',
    size: '2.9 GB',
    description: 'Higher accuracy for screen understanding.',
    type: 'balanced',
    status: 'available',
    minRamGb: 10,
  },
];

/** Returns recommended model IDs based on available system RAM */
export function getRecommendedModelIds(ramGb: number): string[] {
  if (ramGb >= 12) return ['gemma4-e4b', 'gemma3-4b', 'llama3.2-3b'];
  if (ramGb >= 8)  return ['gemma3-4b', 'llama3.2-3b'];
  if (ramGb >= 6)  return ['gemma3-4b-q4', 'llama3.2-3b'];
  return ['qwen2.5-1.5b'];
}

/** Returns the best default model for the given RAM amount */
export function getDefaultModelId(ramGb: number): string {
  if (ramGb >= 12) return 'gemma4-e4b';
  if (ramGb >= 8)  return 'gemma3-4b';
  if (ramGb >= 6)  return 'llama3.2-3b';
  return 'qwen2.5-1.5b';
}

export const DEFAULT_SETTINGS: AppSettings = {
  version: 7,
  // Engine — gebundelde Ollama op poort 11435 (geen conflict met systeem-Ollama)
  modelId: 'gemma2-2b',
  visionModelId: 'moondream',
  ollamaUrl: 'http://127.0.0.1:11435',
  contextLength: 200,
  isEnabled: true,
  triggerDelayMs: 100,
  minCharsForSuggestion: 3,
  maxSuggestionLength: 80,
  // Theme
  theme: 'dark',
  // Permissions
  clipboardEnabled: false,
  screenContextEnabled: false,
  // System-wide
  globalEnabled: false,
  // Privacy
  collectInputs: true,
  storeUnaccepted: false,
  personalizationStrength: 0.5,
  // Stats
  historyCount: 0,
  autocompletedCount: 0,
  // Blocklist
  blocklist: [],
  // Models — gemma2:2b is meegeleverd in de app-bundle (zero download)
  downloadedModelIds: ['gemma2-2b'],
  // HuggingFace token voor gated modellen (optioneel)
  huggingFaceToken: '',
  // Setup
  setupComplete: false,
};

export const DOWNLOAD_LINKS = {
  macos: 'https://github.com/opensuggest/opensuggest/releases/latest/download/OpenSuggest.dmg',
  windows: 'https://github.com/opensuggest/opensuggest/releases/latest/download/OpenSuggest_Setup.exe',
  linux_appimage: 'https://github.com/opensuggest/opensuggest/releases/latest/download/OpenSuggest.AppImage',
  linux_deb: 'https://github.com/opensuggest/opensuggest/releases/latest/download/OpenSuggest.deb',
};

export const STORAGE_KEY = 'opensuggest_settings_v7';
