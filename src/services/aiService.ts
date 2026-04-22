import { GoogleGenAI } from "@google/genai";
import { invoke } from "@tauri-apps/api/core";

// Detect if we are running in the native desktop client (Tauri)
const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

/**
 * Fetches the current engine state directly from the Rust process.
 */
export async function getNativeEngineState(): Promise<{ 
  isEnabled: boolean, 
  activeModelId: string, 
  downloadedIds: string[], 
  historyCount: number 
} | null> {
  if (!isDesktop) return null;
  try {
    const [isEnabled, activeModelId, downloadedIds, historyCount]: [boolean, string, string[], number] = await invoke("get_engine_state");
    return { isEnabled, activeModelId, downloadedIds, historyCount };
  } catch (error) {
    console.error("Failed to sync with Rust Engine:", error);
    return null;
  }
}

/**
 * Initiates a local model download in the Rust backend.
 */
export async function startNativeModelDownload(modelId: string): Promise<void> {
  if (!isDesktop) return;
  try {
     console.log("Requesting native download for:", modelId);
     await invoke("download_model", { modelId });
  } catch (error) {
    console.error("Rust Download Error:", error);
    throw error;
  }
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getAutocompleteSuggestion(text: string, modelId: string, personalizationStrength: number): Promise<string> {
  // 🦀 Desktop-level Rust execution
  if (isDesktop) {
    try {
      const result: string = await invoke("get_ghost_text", { 
        context: text, 
        modelId,
        personalizationStrength 
      });
      return result;
    } catch (error) {
      console.error("Rust Engine Error:", error);
    }
  }

  // Web Fallback
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [{ text: `Continue the following text naturally and concisely. Provide ONLY the continuation, no extra text, explanations, or quotes. Max 10-15 words.\n\nText: ${text}` }],
        }
      ],
      config: {
        maxOutputTokens: 20,
        temperature: 0.1,
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("AI Service Error:", error);
    return "";
  }
}
