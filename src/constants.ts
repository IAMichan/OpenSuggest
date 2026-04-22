import { AIModel, AppSettings } from './types';

export const APP_VERSION = '2.0.0';

export const OLLAMA_TEXT_MODEL = 'llama3.2:3b';
export const OLLAMA_VISION_MODEL = 'moondream';

export const MODELS: AIModel[] = [
  {
    id: 'qwen2.5-1.5b',
    ollamaId: 'qwen2.5:1.5b',
    name: 'Qwen 2.5 1.5B',
    size: '1.0 GB',
    description: 'Ultra-lightweight. Runs on low-spec hardware (< 8 GB RAM).',
    type: 'speed',
    status: 'available',
    minRamGb: 4,
  },
  {
    id: 'gemma2-2b',
    ollamaId: 'gemma2:2b',
    name: 'Gemma 2 2B',
    size: '1.6 GB',
    description: "Google's fastest small model. Best for everyday typing.",
    type: 'speed',
    status: 'available',
    minRamGb: 6,
  },
  {
    id: 'llama3.2-3b',
    ollamaId: 'llama3.2:3b',
    name: 'Llama 3.2 3B',
    size: '2.0 GB',
    description: "Meta's efficient model. Great balance of speed and quality.",
    type: 'balanced',
    status: 'available',
    minRamGb: 8,
  },
  {
    id: 'phi4-mini',
    ollamaId: 'phi4-mini',
    name: 'Phi-4 Mini',
    size: '2.5 GB',
    description: "Microsoft's highly capable small model. Excellent reasoning.",
    type: 'balanced',
    status: 'available',
    minRamGb: 8,
  },
  {
    id: 'gemma4-e4b',
    ollamaId: 'gemma3:4b',
    name: 'Gemma 4 E4B',
    size: '6.2 GB',
    description: "Google's Gemma 4 (4B). Excellent quality with modern architecture.",
    type: 'balanced',
    status: 'available',
    minRamGb: 12,
  },
  {
    id: 'mistral-7b',
    ollamaId: 'mistral:7b',
    name: 'Mistral 7B',
    size: '4.1 GB',
    description: 'Industry-leading balance of speed and reasoning.',
    type: 'balanced',
    status: 'available',
    minRamGb: 12,
  },
  {
    id: 'gemma2-9b',
    ollamaId: 'gemma2:9b',
    name: 'Gemma 2 9B',
    size: '5.5 GB',
    description: 'Premium quality completions for power users.',
    type: 'power',
    status: 'available',
    minRamGb: 16,
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
  if (ramGb >= 32) return ['gemma2-9b', 'mistral-7b', 'gemma4-e4b'];
  if (ramGb >= 16) return ['gemma4-e4b', 'mistral-7b', 'llama3.2-3b'];
  if (ramGb >= 12) return ['gemma4-e4b', 'llama3.2-3b', 'phi4-mini'];
  if (ramGb >= 8)  return ['llama3.2-3b', 'phi4-mini', 'gemma2-2b'];
  if (ramGb >= 6)  return ['gemma2-2b', 'qwen2.5-1.5b'];
  return ['qwen2.5-1.5b'];
}

/** Returns the best default model for the given RAM amount */
export function getDefaultModelId(ramGb: number): string {
  if (ramGb >= 16) return 'gemma4-e4b';
  if (ramGb >= 8)  return 'llama3.2-3b';
  if (ramGb >= 6)  return 'gemma2-2b';
  return 'qwen2.5-1.5b';
}

export const DEFAULT_SETTINGS: AppSettings = {
  version: 6,
  // Engine — gebundelde Ollama op poort 11435 (geen conflict met systeem-Ollama)
  modelId: 'gemma2-2b',
  visionModelId: 'moondream',
  ollamaUrl: 'http://127.0.0.1:11435',
  contextLength: 200,
  isEnabled: true,
  triggerDelayMs: 150,
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
  // Setup
  setupComplete: false,
};

export const DOWNLOAD_LINKS = {
  macos: 'https://github.com/opensuggest/opensuggest/releases/latest/download/OpenSuggest.dmg',
  windows: 'https://github.com/opensuggest/opensuggest/releases/latest/download/OpenSuggest_Setup.exe',
  linux_appimage: 'https://github.com/opensuggest/opensuggest/releases/latest/download/OpenSuggest.AppImage',
  linux_deb: 'https://github.com/opensuggest/opensuggest/releases/latest/download/OpenSuggest.deb',
};

export const STORAGE_KEY = 'opensuggest_settings_v6';
