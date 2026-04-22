import { AIModel, AppSettings } from './types';

export const MODELS: AIModel[] = [
  {
    id: 'qwen-3-1.7b',
    name: 'Qwen 3 1.7B',
    size: '1.0 GB',
    description: 'Fast and lightweight for basic completions.',
    type: 'speed',
    status: 'available',
  },
  {
    id: 'gemma-3-1b',
    name: 'Gemma 3 1B',
    size: '0.8 GB',
    description: 'Ultra-lightweight model for mobile-grade performance.',
    type: 'speed',
    status: 'available',
  },
  {
    id: 'gemma-4-e2b',
    name: 'Gemma 4 E2B',
    size: '3.2 GB',
    description: 'Perfect balance of speed and reasoning.',
    type: 'balanced',
    status: 'available',
  },
  {
    id: 'llama-3-8b',
    name: 'Llama 3 8B',
    size: '4.7 GB',
    description: 'State-of-the-art broad knowledge model.',
    type: 'power',
    status: 'available',
  },
  {
    id: 'mistral-7b-v0.3',
    name: 'Mistral 7B v0.3',
    size: '4.1 GB',
    description: 'Highly efficient and versatile model.',
    type: 'balanced',
    status: 'available',
  },
  {
    id: 'phi-3-mini',
    name: 'Phi-3 Mini',
    size: '2.3 GB',
    description: 'Microsoft small language model with high capabilities.',
    type: 'speed',
    status: 'available',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  version: 2, // Incrementing version to force reset of legacy 124-record cache
  modelId: 'gemma-4-e2b',
  ollamaUrl: 'http://localhost:11434',
  contextLength: 50,
  isEnabled: true,
  theme: 'dark',
  downloadedModelIds: [],
  collectInputs: true,
  storeUnaccepted: false,
  personalizationStrength: 0.5,
  historyCount: 0,
  autocompletedCount: 0,
};

export const DOWNLOAD_LINKS = {
  macos: "#download-info", // User can replace with "https://.../opensuggest.dmg"
  windows: "#download-info", // User can replace with "https://.../opensuggest_setup.msi"
};
