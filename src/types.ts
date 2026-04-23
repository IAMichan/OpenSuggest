export interface AIModel {
  id: string;
  name: string;
  size: string;
  description: string;
  type: 'speed' | 'balanced' | 'power';
  status: 'available' | 'downloading' | 'downloaded';
  progress?: number;
  downloadStatus?: string;
  downloadedBytes?: number;
  totalBytes?: number;
  ollamaId?: string;
  diskSize?: number;
  minRamGb?: number;
  recommended?: boolean;
  ggufFilename?: string;
  ggufUrl?: string;
  requiresAuth?: boolean;
}

export type AppStatus = 'ready' | 'loading' | 'error' | 'paused';

export interface BlocklistEntry {
  id: string;
  type: 'app' | 'website' | 'domain';
  value: string;
  label: string;
}

export interface DailyStats {
  date: string;
  suggestions: number;
  accepted: number;
  words: number;
}

export interface TotalStats {
  suggestions: number;
  accepted: number;
  words: number;
}

export interface AllStats {
  today: DailyStats;
  week: DailyStats[];
  total: TotalStats;
}

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

export interface SetupStatus {
  ollama_installed: boolean;
  ollama_running: boolean;
  default_model_downloaded: boolean;
  vision_model_downloaded: boolean;
  accessibility_granted: boolean;
  screen_recording_granted: boolean;
}

export interface AppSettings {
  version: number;
  // Engine
  modelId: string;
  visionModelId: string;
  ollamaUrl: string;
  contextLength: number;
  isEnabled: boolean;
  triggerDelayMs: number;
  minCharsForSuggestion: number;
  maxSuggestionLength: number;
  // Theme
  theme: 'dark' | 'light';
  // Permissions
  clipboardEnabled: boolean;
  screenContextEnabled: boolean;
  // System-wide suggestions (works in any app / browser)
  globalEnabled: boolean;
  // Privacy & Personalization
  collectInputs: boolean;
  storeUnaccepted: boolean;
  personalizationStrength: number;
  // Stats (in-memory)
  historyCount: number;
  autocompletedCount: number;
  // Blocklist
  blocklist: BlocklistEntry[];
  // Downloaded models
  downloadedModelIds: string[];
  // HuggingFace token voor gated modellen
  huggingFaceToken: string;
  // Setup
  setupComplete: boolean;
}
