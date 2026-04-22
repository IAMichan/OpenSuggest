// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{command, State, Window};
use std::sync::Mutex;
use std::collections::HashSet;

// 🦀 Native state held in memory by the Rust runtime
struct EngineState {
    is_enabled: Mutex<bool>,
    active_model: Mutex<String>,
    downloaded_models: Mutex<HashSet<String>>,
    history_count: Mutex<u32>,
}

#[command]
fn get_engine_state(state: State<EngineState>) -> Result<(bool, String, Vec<String>, u32), String> {
    let enabled = *state.is_enabled.lock().unwrap();
    let model = state.active_model.lock().unwrap().clone();
    let downloaded = state.downloaded_models.lock().unwrap().iter().cloned().collect();
    let count = *state.history_count.lock().unwrap();
    Ok((enabled, model, downloaded, count))
}

#[command]
fn toggle_engine(is_enabled: bool, state: State<EngineState>) -> Result<(), String> {
    *state.is_enabled.lock().unwrap() = is_enabled;
    println!("Engine power: {}", is_enabled);
    Ok(())
}

#[command]
fn set_active_model(model_id: String, state: State<EngineState>) -> Result<(), String> {
    *state.active_model.lock().unwrap() = model_id;
    println!("Switched to local model: {}", model_id);
    Ok(())
}

#[command]
async fn download_model(model_id: String, state: State<EngineState>, _window: Window) -> Result<(), String> {
    println!("Rust: Starting background pull for {}", model_id);
    
    // Simulate real download chunks - usually would be a real HTTP request or Ollama pull
    for i in 1..=5 {
        std::thread::sleep(std::time::Duration::from_millis(600));
        println!("Progress for {}: {}%", model_id, i * 20);
    }
    
    state.downloaded_models.lock().unwrap().insert(model_id);
    Ok(())
}

#[command]
async fn get_ghost_text(context: String, model_id: String, personalization_strength: f64) -> Result<String, String> {
    println!("Inference: Context=\"{}\" Model={} Strength={}", context, model_id, personalization_strength);
    std::thread::sleep(std::time::Duration::from_millis(50));
    Ok("...designed for high-performance localized AI.".to_string())
}

#[command]
fn save_typing_fragment(fragment: String, state: State<EngineState>) -> Result<u32, String> {
    let mut count = state.history_count.lock().unwrap();
    *count += 1;
    Ok(*count)
}

#[command]
fn clear_typing_history(state: State<EngineState>) -> Result<u32, String> {
    *state.history_count.lock().unwrap() = 0;
    println!("Personalization data purged.");
    Ok(0)
}

fn main() {
    tauri::Builder::default()
        .manage(EngineState {
            is_enabled: Mutex::new(true),
            active_model: Mutex::new("gemma-4-e2b".to_string()),
            downloaded_models: Mutex::new(HashSet::new()),
            history_count: Mutex::new(0),
        })
        .invoke_handler(tauri::generate_handler![
            get_engine_state,
            toggle_engine,
            set_active_model,
            download_model,
            get_ghost_text,
            save_typing_fragment,
            clear_typing_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
