/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AIModel {
  id: string;
  name: string;
  size: string;
  description: string;
  type: 'speed' | 'balanced' | 'power';
  status: 'available' | 'downloading' | 'downloaded';
  progress?: number;
}

export type AppStatus = 'ready' | 'loading' | 'error' | 'paused';

export interface AppSettings {
  version: number;
  modelId: string;
  ollamaUrl: string;
  contextLength: number;
  isEnabled: boolean;
  theme: 'dark' | 'light';
  downloadedModelIds: string[];
  collectInputs: boolean;
  storeUnaccepted: boolean;
  personalizationStrength: number;
  historyCount: number;
  autocompletedCount: number;
}
