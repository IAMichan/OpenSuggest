// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{command, AppHandle, Emitter, Manager, State, Window};

// ── In-process LLM engine imports ────────────────────────────────────────────
use llama_cpp_2::{
    context::{LlamaContext, params::LlamaContextParams},
    llama_backend::LlamaBackend,
    llama_batch::LlamaBatch,
    model::{params::LlamaModelParams, AddBos, LlamaModel},
    sampling::LlamaSampler,
};
#[allow(deprecated)]
use llama_cpp_2::model::Special;
use std::num::NonZeroU32;
use std::sync::mpsc;
use tokio::sync::oneshot;

// ─────────────────────────────────── LLM State ───────────────────────────────

/// Berichten naar de inference thread.
enum LlmMsg {
    Load {
        path: String,
        reply: oneshot::Sender<Result<(), String>>,
    },
    Complete {
        prompt: String,
        max_tokens: usize,
        reply: oneshot::Sender<Result<String, String>>,
    },
}

/// Start een dedicated inference thread die het model in geheugen houdt.
/// De LlamaContext wordt eenmalig aangemaakt bij het laden en hergebruikt voor alle completions,
/// zodat de 500+ MiB Metal compute buffer niet bij elke suggestie opnieuw gealloceerd hoeft.
fn spawn_llm_thread() -> mpsc::SyncSender<LlmMsg> {
    let (tx, rx) = mpsc::sync_channel::<LlmMsg>(4);

    std::thread::Builder::new()
        .name("llm-inference".into())
        .spawn(move || {
            let backend = match LlamaBackend::init() {
                Ok(b) => b,
                Err(e) => { eprintln!("LLM: backend init mislukt: {e}"); return; }
            };

            let n_ctx_val = 512u32;
            let cpu_threads = std::thread::available_parallelism()
                .map(|n| n.get() as i32).unwrap_or(4).min(8);

            // SAFETY: `cached_ctx` wordt ALTIJD gedropped vóór `loaded` wordt aangepast.
            // We verlengen de lifetime handmatig; de pointer blijft geldig zolang `loaded`
            // het model bevat en wij de invariant handhaven.
            let mut loaded: Option<Box<LlamaModel>> = None;
            let mut cached_ctx: Option<LlamaContext<'static>> = None;

            while let Ok(msg) = rx.recv() {
                match msg {
                    LlmMsg::Load { path, reply } => {
                        drop(cached_ctx.take()); // ctx EERST droppen, dan model

                        let params = LlamaModelParams::default()
                            .with_n_gpu_layers(1_000_000);

                        let result = LlamaModel::load_from_file(
                            &backend,
                            std::path::Path::new(&path),
                            &params,
                        ).map_err(|e| e.to_string());

                        match result {
                            Ok(model) => {
                                loaded = Some(Box::new(model));
                                // SAFETY: Box<LlamaModel> leeft op de heap — stabiel adres.
                                // cached_ctx wordt altijd gedropped vóór loaded wordt gewijzigd.
                                let model_ref: &'static LlamaModel = unsafe {
                                    &*(&**loaded.as_ref().unwrap() as *const LlamaModel)
                                };
                                let ctx_params = LlamaContextParams::default()
                                    .with_n_ctx(Some(NonZeroU32::new(n_ctx_val).unwrap()))
                                    .with_n_threads(cpu_threads)
                                    .with_n_threads_batch(cpu_threads);
                                if let Ok(ctx) = model_ref.new_context(&backend, ctx_params) {
                                    // SAFETY: zie bovenstaande invariant
                                    cached_ctx = Some(unsafe {
                                        std::mem::transmute::<LlamaContext<'_>, LlamaContext<'static>>(ctx)
                                    });
                                }
                                let _ = reply.send(Ok(()));
                            }
                            Err(e) => { let _ = reply.send(Err(e)); }
                        }
                    }

                    LlmMsg::Complete { prompt, max_tokens, reply } => {
                        let result = match (&loaded, &mut cached_ctx) {
                            (Some(model), Some(ctx)) => {
                                llm_run_reuse(model, ctx, n_ctx_val as usize, &prompt, max_tokens)
                            }
                            _ => Err("Geen model geladen".to_string()),
                        };
                        let _ = reply.send(result);
                    }
                }
            }

            // Juiste drop-volgorde bij thread exit
            drop(cached_ctx);
            drop(loaded);
        })
        .expect("kan inference thread niet starten");

    tx
}

/// Voert één completion uit met een hergebruikte context (geen heralloc van Metal buffers).
/// Elke aanroep start vanaf positie 0 zodat de KV-cache impliciet wordt overschreven.
#[allow(deprecated)]
fn llm_run_reuse(
    model: &LlamaModel,
    ctx: &mut LlamaContext<'_>,
    n_ctx: usize,
    prompt: &str,
    max_tokens: usize,
) -> Result<String, String> {
    let tokens = model.str_to_token(prompt, AddBos::Always).map_err(|e| e.to_string())?;
    if tokens.is_empty() { return Ok(String::new()); }

    let n_prompt = tokens.len();
    if n_prompt >= n_ctx { return Err("Prompt te lang".to_string()); }

    // Wis de KV-cache zodat de nieuwe sequentie vanaf positie 0 kan starten
    ctx.clear_kv_cache();

    let mut batch = LlamaBatch::new(n_ctx, 1);

    // Verwerk alle prompt-tokens in één batch (één forward pass)
    for (i, &tok) in tokens.iter().enumerate() {
        batch.add(tok, i as i32, &[0], i == n_prompt - 1).map_err(|e| e.to_string())?;
    }
    ctx.decode(&mut batch).map_err(|e| e.to_string())?;

    let mut output = String::new();
    let mut sampler = LlamaSampler::greedy();
    let mut pos = n_prompt;

    for _ in 0..max_tokens {
        let token = sampler.sample(ctx, -1);
        sampler.accept(token);

        if model.is_eog_token(token) { break; }

        let piece = model.token_to_str(token, Special::Tokenize).unwrap_or_default();

        if piece.contains("\n\n") || piece.contains("<end_of_turn>") || piece.contains("<|") { break; }
        output.push_str(&piece);

        // Stop na een volledige zin (check op de geaccumuleerde output, niet op de losse token)
        if output.len() > 20 {
            let t = output.trim_end();
            if t.ends_with('.') || t.ends_with('!') || t.ends_with('?') { break; }
        }

        if pos >= n_ctx - 1 { break; }
        batch.clear();
        batch.add(token, pos as i32, &[0], true).map_err(|e| e.to_string())?;
        ctx.decode(&mut batch).map_err(|e| e.to_string())?;
        pos += 1;
    }

    Ok(output.trim().to_string())
}

// ─────────────────────────────────── State ────────────────────────────────────

struct AppState {
    db: Mutex<Option<Connection>>,
    screen_context: Mutex<String>,
    blocklist: Mutex<Vec<BlocklistEntry>>,
    /// Gebundelde Ollama server (fallback, wordt uitgefaseerd)
    ollama_process: Mutex<Option<std::process::Child>>,
    /// In-process LLM inference thread
    infer_tx: Mutex<Option<mpsc::SyncSender<LlmMsg>>>,
    /// Bestandsnaam van het geladen model (None = nog niets geladen)
    loaded_model: Mutex<Option<String>>,
}

// ────────────────────────────────── Types ─────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BlocklistEntry {
    pub id: String,
    #[serde(rename = "type")]
    pub entry_type: String,
    pub value: String,
    pub label: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct OllamaModel {
    pub name: String,
    pub size: u64,
    pub digest: String,
    #[serde(rename = "modified_at")]
    pub modified_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SetupStatus {
    pub ollama_installed: bool,
    pub ollama_running: bool,
    pub default_model_downloaded: bool,
    pub vision_model_downloaded: bool,
    pub accessibility_granted: bool,
    pub screen_recording_granted: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DailyStats {
    pub date: String,
    pub suggestions: u32,
    pub accepted: u32,
    pub words: u32,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TotalStats {
    pub suggestions: u32,
    pub accepted: u32,
    pub words: u32,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AllStats {
    pub today: DailyStats,
    pub week: Vec<DailyStats>,
    pub total: TotalStats,
}

// ─────────────────────────────── Ollama Commands ──────────────────────────────

#[command]
async fn ollama_check(ollama_url: String) -> bool {
    reqwest::Client::new()
        .get(format!("{}/api/tags", ollama_url))
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
        .is_ok()
}

#[command]
async fn ollama_list_models(ollama_url: String) -> Result<Vec<OllamaModel>, String> {
    let resp = reqwest::Client::new()
        .get(format!("{}/api/tags", ollama_url))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let models = json["models"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|m| OllamaModel {
            name: m["name"].as_str().unwrap_or("").to_string(),
            size: m["size"].as_u64().unwrap_or(0),
            digest: m["digest"].as_str().unwrap_or("").to_string(),
            modified_at: m["modified_at"].as_str().unwrap_or("").to_string(),
        })
        .collect();

    Ok(models)
}

#[command]
async fn ollama_pull_model(
    model_id: String,
    ollama_url: String,
    window: Window,
) -> Result<(), String> {
    use futures_util::StreamExt;

    let payload = serde_json::json!({ "name": model_id, "stream": true });

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(60))
        .timeout(std::time::Duration::from_secs(7200))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post(format!("{}/api/pull", ollama_url))
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            let msg = format!("Kan Ollama niet bereiken: {}", e);
            let _ = window.emit("ollama-pull-progress", serde_json::json!({
                "model": model_id, "status": "error", "error": msg, "progress": 0,
            }));
            msg
        })?;

    if !response.status().is_success() {
        let status_code = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        let error_msg = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|j| j["error"].as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| format!("HTTP {}", status_code));
        let _ = window.emit("ollama-pull-progress", serde_json::json!({
            "model": model_id, "status": "error", "error": error_msg, "progress": 0,
        }));
        return Err(error_msg);
    }

    let mut stream = response.bytes_stream();
    // Buffer to handle NDJSON lines that span multiple HTTP chunks
    let mut line_buf = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        line_buf.push_str(&String::from_utf8_lossy(&chunk));

        // Process all complete lines (split on newline, keep remainder in buffer)
        while let Some(newline_pos) = line_buf.find('\n') {
            let line = line_buf[..newline_pos].trim().to_string();
            line_buf = line_buf[newline_pos + 1..].to_string();

            if line.is_empty() { continue; }
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                // Ollama can send {"error":"..."} without a "status" field
                if let Some(err) = json["error"].as_str() {
                    let _ = window.emit("ollama-pull-progress", serde_json::json!({
                        "model": model_id, "status": "error", "error": err, "progress": 0,
                    }));
                    return Err(err.to_string());
                }

                let status = json["status"].as_str().unwrap_or("").to_string();
                let completed = json["completed"].as_u64();
                let total = json["total"].as_u64();

                let progress = match (completed, total) {
                    (Some(c), Some(t)) if t > 0 => (c as f64 / t as f64 * 100.0) as u32,
                    _ => 0,
                };

                let _ = window.emit(
                    "ollama-pull-progress",
                    serde_json::json!({
                        "model": model_id,
                        "status": status,
                        "progress": progress,
                        "completed": completed,
                        "total": total,
                    }),
                );

                if status == "success" {
                    return Ok(());
                }
            }
        }
    }

    Ok(())
}

#[command]
async fn ollama_delete_model(model_id: String, ollama_url: String) -> Result<(), String> {
    reqwest::Client::new()
        .delete(format!("{}/api/delete", ollama_url))
        .json(&serde_json::json!({ "name": model_id }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}


// ──────────────────── Chat API — works with ALL Ollama models ────────────────

/// Uses /api/chat so each model applies its own chat template.
/// This is the correct approach — better than /api/generate for instruction-tuned models.
#[command]
async fn ollama_chat(
    user_message: String,
    model_id: String,
    ollama_url: String,
    system_prompt: String,
    images: Vec<String>,
) -> Result<String, String> {
    // Bouw berichten array op
    let mut messages = Vec::new();

    if !system_prompt.is_empty() {
        messages.push(serde_json::json!({
            "role": "system",
            "content": system_prompt
        }));
    }

    // Attach images to the user message when vision is active
    if images.is_empty() {
        messages.push(serde_json::json!({
            "role": "user",
            "content": user_message
        }));
    } else {
        messages.push(serde_json::json!({
            "role": "user",
            "content": user_message,
            "images": images
        }));
    }

    let payload = serde_json::json!({
        "model": model_id,
        "messages": messages,
        "stream": false,
        "keep_alive": "10m",
        "options": {
            "temperature": 0.15,
            "num_predict": 80,
            "top_p": 0.9,
            "repeat_penalty": 1.2,
            "num_gpu": -1,
            "num_ctx": 2048,
            "stop": ["<end_of_turn>", "\n\n", "###", "<|"]
        }
    });

    let response = reqwest::Client::new()
        .post(format!("{}/api/chat", ollama_url))
        .json(&payload)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Verbinding met Ollama mislukt: {}", e))?;

    let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

    // /api/chat response zit in message.content
    let raw = json["message"]["content"].as_str().unwrap_or("").to_string();

    // Strip cursor annotation if model echoed it back
    let raw = raw.replace("[COMPLETE FROM HERE]", "");

    // Collapse whitespace/newlines into single spaces
    let collapsed = raw
        .replace('\n', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    // Strip common model artifacts
    let cleaned = collapsed
        .trim_start_matches(|c: char| c == '.' || c == '\u{2026}')
        .trim_start_matches(|c: char| c == ',' || c == ';')
        .trim_start_matches(|c: char| c == '"' || c == '\'' || c == '\u{201C}' || c == '\u{2018}')
        .trim_start_matches('*')
        .trim_start()
        .to_string();

    // Reject output that looks like the model is explaining itself
    let lower = cleaned.to_lowercase();
    if lower.starts_with("sure") || lower.starts_with("here") || lower.starts_with("of course")
        || lower.starts_with("i'll") || lower.starts_with("i will") || lower.starts_with("as an ai")
    {
        return Ok(String::new());
    }

    Ok(cleaned)
}

// Achterwaartse compatibiliteit — wordt intern herleid naar ollama_chat
#[command]
async fn ollama_generate(
    prompt: String,
    model_id: String,
    ollama_url: String,
    images: Vec<String>,
    system_context: String,
) -> Result<String, String> {
    ollama_chat(prompt, model_id, ollama_url, system_context, images).await
}

// ──────────────────────────────── Ollama Install ──────────────────────────────

#[command]
async fn ollama_install(window: Window) -> Result<(), String> {
    let _ = window.emit(
        "ollama-install-progress",
        serde_json::json!({ "status": "starting", "message": "Ollama installatie voorbereiden..." }),
    );

    #[cfg(target_os = "macos")]
    {
        let _ = window.emit(
            "ollama-install-progress",
            serde_json::json!({ "status": "downloading", "message": "Installing Ollama (may require password)..." }),
        );

        let output = std::process::Command::new("osascript")
            .arg("-e")
            .arg("do shell script \"curl -fsSL https://ollama.com/install.sh | sh\" with administrator privileges")
            .output()
            .map_err(|e| format!("Installatie mislukt: {}", e))?;

        if output.status.success() {
            let _ = window.emit(
                "ollama-install-progress",
                serde_json::json!({ "status": "complete", "message": "Ollama geïnstalleerd!" }),
            );
            Ok(())
        } else {
            let err = String::from_utf8_lossy(&output.stderr).to_string();
            Err(format!("Installatie mislukt: {}", err))
        }
    }

    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("sh")
            .arg("-c")
            .arg("curl -fsSL https://ollama.com/install.sh | sh")
            .output()
            .map_err(|e| format!("Installatie mislukt: {}", e))?;

        if output.status.success() {
            let _ = window.emit(
                "ollama-install-progress",
                serde_json::json!({ "status": "complete", "message": "Ollama geïnstalleerd!" }),
            );
            Ok(())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }

    #[cfg(target_os = "windows")]
    {
        let client = reqwest::Client::new();
        let bytes = client
            .get("https://ollama.ai/download/OllamaSetup.exe")
            .timeout(std::time::Duration::from_secs(300))
            .send()
            .await
            .map_err(|e| e.to_string())?
            .bytes()
            .await
            .map_err(|e| e.to_string())?;

        let temp_path = std::env::temp_dir().join("OllamaSetup.exe");
        std::fs::write(&temp_path, &bytes).map_err(|e| e.to_string())?;

        std::process::Command::new(&temp_path)
            .arg("/S")
            .output()
            .map_err(|e| e.to_string())?;

        let _ = window.emit(
            "ollama-install-progress",
            serde_json::json!({ "status": "complete", "message": "Ollama geïnstalleerd!" }),
        );
        Ok(())
    }
}

/// Start de gebundelde Ollama server op poort 11435.
/// Gebruikt een schrijfbaare AppData map voor modellen en symlinks voor de gebundelde bestanden.
#[command]
async fn start_bundled_ollama(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    use std::fs;
    use std::process::{Command, Stdio};
    #[cfg(unix)]
    use std::os::unix::fs::symlink;

    const BUNDLED_URL: &str = "http://127.0.0.1:11435";

    // Al draaiend? Geef URL meteen terug.
    if reqwest::Client::new()
        .get(format!("{}/api/tags", BUNDLED_URL))
        .timeout(std::time::Duration::from_secs(1))
        .send()
        .await
        .is_ok()
    {
        return Ok(BUNDLED_URL.to_string());
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Kan resource-map niet vinden: {}", e))?;

    let binary_path = resource_dir.join("ollama");

    // Gebruik ~/.ollama/models — de standaardlocatie van Ollama.
    // Alle eerder gedownloade modellen staan hier al.
    let home_dir = std::env::var("HOME")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| app.path().app_data_dir().unwrap_or_default());
    let models_dir = home_dir.join(".ollama/models");

    // Zorg dat de mappenstructuur bestaat
    fs::create_dir_all(models_dir.join("blobs")).unwrap_or(());
    fs::create_dir_all(models_dir.join("manifests/registry.ollama.ai/library/gemma2")).unwrap_or(());

    // Symlink de meegebundelde gemma2:2b bestanden als ze er nog niet zijn
    let bundled_blobs = resource_dir.join("ollama_models/blobs");
    let bundled_manifests = resource_dir.join("ollama_models/manifests/registry.ollama.ai/library/gemma2");

    if bundled_blobs.exists() {
        if let Ok(entries) = fs::read_dir(&bundled_blobs) {
            for entry in entries.flatten() {
                let target = models_dir.join("blobs").join(entry.file_name());
                if !target.exists() {
                    #[cfg(unix)]
                    let _ = symlink(entry.path(), &target);
                }
            }
        }
    }

    let gemma_manifest_src = bundled_manifests.join("2b");
    let gemma_manifest_dest = models_dir.join("manifests/registry.ollama.ai/library/gemma2/2b");
    if gemma_manifest_src.exists() && !gemma_manifest_dest.exists() {
        #[cfg(unix)]
        let _ = symlink(&gemma_manifest_src, &gemma_manifest_dest);
    }

    // Zorg dat de binary uitvoerbaar is
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = fs::metadata(&binary_path) {
            let mut perms = metadata.permissions();
            perms.set_mode(0o755);
            let _ = fs::set_permissions(&binary_path, perms);
        }
    }

    // Stop een eventuele oude instantie
    {
        let mut process_lock = state.ollama_process.lock().map_err(|e| e.to_string())?;
        if let Some(mut child) = process_lock.take() {
            let _ = child.kill();
        }
    }

    // Start de nieuwe instantie op poort 11435 met de standaard ~/.ollama/models map
    let child = Command::new(&binary_path)
        .arg("serve")
        .env("OLLAMA_HOST", "127.0.0.1:11435")
        .env("OLLAMA_MODELS", &models_dir)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Fout bij starten van gebundelde Ollama: {}", e))?;

    // Bewaar het proces in de state
    {
        let mut process_lock = state.ollama_process.lock().map_err(|e| e.to_string())?;
        *process_lock = Some(child);
    }

    // Wacht maximaal 8 seconden op de server
    for _ in 0..16 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        if reqwest::Client::new()
            .get(format!("{}/api/tags", BUNDLED_URL))
            .timeout(std::time::Duration::from_millis(500))
            .send()
            .await
            .is_ok()
        {
            return Ok(BUNDLED_URL.to_string());
        }
    }

    Err("Ollama server startte niet op tijd.".to_string())
}

#[command]
async fn ollama_start(app: AppHandle, ollama_url: String, state: State<'_, AppState>) -> Result<bool, String> {
    // Controleer of de gevraagde URL al draait
    if reqwest::Client::new()
        .get(format!("{}/api/tags", ollama_url))
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
        .is_ok()
    {
        return Ok(true);
    }

    // Probeer eerst de gebundelde binary te starten
    if let Ok(url) = start_bundled_ollama(app, state).await {
        // Gebundelde server succesvol gestart
        let _ = url; // url is http://127.0.0.1:11435
        return Ok(true);
    }

    // Fallback: zoek naar systeem-Ollama
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        let _ = std::process::Command::new("sh")
            .arg("-c")
            .arg("export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin && nohup ollama serve > /dev/null 2>&1 &")
            .spawn()
            .map_err(|e| e.to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "/B", "ollama", "serve"])
            .spawn();
    }

    // Wacht maximaal 15 seconden op systeem-Ollama
    for _ in 0..30 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        if reqwest::Client::new()
            .get(format!("{}/api/tags", ollama_url))
            .timeout(std::time::Duration::from_secs(1))
            .send()
            .await
            .is_ok()
        {
            return Ok(true);
        }
    }

    Ok(false)
}

#[allow(dead_code)]
fn ollama_is_installed() -> bool {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("where")
            .arg("ollama")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        if std::process::Command::new("which")
            .arg("ollama")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            return true;
        }
        std::path::Path::new("/usr/local/bin/ollama").exists()
            || std::path::Path::new("/opt/homebrew/bin/ollama").exists()
    }
}

// ─────────────────────── In-Process LLM Commands ─────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LocalModel {
    pub filename: String,
    pub size_gb: f64,
    pub path: String,
}

fn get_models_dir_path(app: &AppHandle) -> std::path::PathBuf {
    let data_dir = app.path().app_data_dir().unwrap_or_default();
    let dir = data_dir.join("Models");
    std::fs::create_dir_all(&dir).unwrap_or(());
    dir
}

#[command]
fn llm_get_models_dir(app: AppHandle) -> String {
    get_models_dir_path(&app).to_string_lossy().to_string()
}

#[command]
fn llm_list_local_models(app: AppHandle) -> Vec<LocalModel> {
    let dir = get_models_dir_path(&app);
    std::fs::read_dir(&dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| {
            let path = e.path();
            let name = path.file_name()?.to_string_lossy().to_string();
            if !name.ends_with(".gguf") { return None; }
            let size = e.metadata().ok()?.len();
            Some(LocalModel {
                filename: name,
                size_gb: size as f64 / 1e9,
                path: path.to_string_lossy().to_string(),
            })
        })
        .collect()
}

#[command]
async fn llm_download_gguf(
    url: String,
    filename: String,
    hf_token: String,
    app: AppHandle,
    window: Window,
) -> Result<String, String> {
    use futures_util::StreamExt;

    let dest = get_models_dir_path(&app).join(&filename);
    if dest.exists() {
        return Ok(dest.to_string_lossy().to_string());
    }

    let _ = window.emit("gguf-download-progress", serde_json::json!({
        "filename": &filename, "progress": 0, "status": "connecting"
    }));

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(30))
        .timeout(std::time::Duration::from_secs(7200))
        .build()
        .map_err(|e| e.to_string())?;

    let mut request = client.get(&url).header("User-Agent", "OpenSuggest/2.0");
    if !hf_token.trim().is_empty() {
        request = request.header("Authorization", format!("Bearer {}", hf_token.trim()));
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Verbinding mislukt: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut last_progress: u32 = u32::MAX;

    let tmp = dest.with_extension("gguf.tmp");
    let raw_file = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
    let mut file = std::io::BufWriter::with_capacity(8 * 1024 * 1024, raw_file);

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        std::io::Write::write_all(&mut file, &chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        let progress = if total > 0 { (downloaded * 100 / total) as u32 } else { 0 };
        // Only emit when the integer percentage actually changes — prevents rapid flicker
        if progress != last_progress {
            last_progress = progress;
            let _ = window.emit("gguf-download-progress", serde_json::json!({
                "filename": &filename,
                "progress": progress,
                "downloaded_gb": downloaded as f64 / 1e9,
                "total_gb": total as f64 / 1e9,
                "status": "downloading"
            }));
        }
    }

    std::io::Write::flush(&mut file).map_err(|e| e.to_string())?;
    drop(file);
    std::fs::rename(&tmp, &dest).map_err(|e| e.to_string())?;
    let _ = window.emit("gguf-download-progress", serde_json::json!({
        "filename": &filename, "progress": 100, "status": "complete"
    }));

    Ok(dest.to_string_lossy().to_string())
}

#[command]
async fn llm_load_model(
    filename: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let path = get_models_dir_path(&app).join(&filename);
    if !path.exists() {
        return Err(format!("Model niet gevonden: {}", filename));
    }
    let tx = state.infer_tx.lock().map_err(|e| e.to_string())?
        .clone().ok_or("LLM engine niet gestart")?;
    let (reply_tx, reply_rx) = oneshot::channel();
    tx.send(LlmMsg::Load { path: path.to_string_lossy().to_string(), reply: reply_tx })
        .map_err(|e| e.to_string())?;
    let result = reply_rx.await.map_err(|e| e.to_string())?;
    if result.is_ok() {
        *state.loaded_model.lock().map_err(|e| e.to_string())? = Some(filename);
    }
    result
}

/// Geeft de bestandsnaam van het geladen model terug, of None als er niets geladen is.
#[command]
fn llm_get_loaded_model(state: State<'_, AppState>) -> Option<String> {
    state.loaded_model.lock().ok().and_then(|l| l.clone())
}

#[command]
async fn llm_complete(
    system_prompt: String,
    user_text: String,
    max_tokens: u32,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let tx = state.infer_tx.lock().map_err(|e| e.to_string())?
        .clone().ok_or("LLM engine niet gestart")?;

    // Gemma instruction format
    let prompt = format!(
        "<start_of_turn>user\n{system_prompt}\n\n{user_text}<end_of_turn>\n<start_of_turn>model\n"
    );

    let (reply_tx, reply_rx) = oneshot::channel();
    tx.send(LlmMsg::Complete { prompt, max_tokens: max_tokens as usize, reply: reply_tx })
        .map_err(|e| e.to_string())?;
    reply_rx.await.map_err(|e| e.to_string())?
}

// ─────────────────────────── Reveal Models Folder ────────────────────────────

#[command]
fn reveal_models_folder(app: AppHandle) {
    let path = get_models_dir_path(&app);
    #[cfg(target_os = "macos")]
    { let _ = std::process::Command::new("open").arg(&path).spawn(); }
    #[cfg(target_os = "linux")]
    { let _ = std::process::Command::new("xdg-open").arg(&path).spawn(); }
    #[cfg(target_os = "windows")]
    { let _ = std::process::Command::new("explorer").arg(&path).spawn(); }
}

// ─────────────────────────────── Screen Commands ──────────────────────────────

#[command]
async fn screen_capture_base64() -> Result<String, String> {
    use screenshots::Screen;

    let screens = Screen::all().map_err(|e| format!("Screen capture failed: {}", e))?;
    let screen = screens.first().ok_or("No screen found")?;
    let image = screen.capture().map_err(|e| format!("Capture error: {}", e))?;

    let width = image.width();
    let height = image.height();
    let raw = image.to_vec();

    use image::RgbaImage;
    let img_buf = RgbaImage::from_raw(width, height, raw)
        .ok_or("Kan geen afbeeldingsbuffer maken")?;

    let (new_w, new_h) = if width > 1280 {
        let ratio = 1280.0 / width as f64;
        (1280u32, (height as f64 * ratio) as u32)
    } else {
        (width, height)
    };

    let resized = image::imageops::resize(&img_buf, new_w, new_h, image::imageops::FilterType::Nearest);

    let mut cursor = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgba8(resized)
        .write_to(&mut cursor, image::ImageFormat::Jpeg)
        .map_err(|e| format!("JPEG fout: {}", e))?;

    Ok(BASE64.encode(cursor.into_inner()))
}

#[command]
async fn screen_analyze(vision_model: String, ollama_url: String) -> Result<String, String> {
    let base64_image = screen_capture_base64().await?;

    let messages = serde_json::json!([{
        "role": "user",
        "content": "Beschrijf in één zin wat de gebruiker doet, met focus op het actieve tekstveld.",
        "images": [base64_image]
    }]);

    let payload = serde_json::json!({
        "model": vision_model,
        "messages": messages,
        "stream": false,
        "options": { "num_predict": 60, "temperature": 0.1 }
    });

    let response = reqwest::Client::new()
        .post(format!("{}/api/chat", ollama_url))
        .json(&payload)
        .timeout(std::time::Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(json["message"]["content"].as_str().unwrap_or("").trim().to_string())
}

// ───────────────── System-wide text reading & injection (macOS) ──────────────

/// Reads the text of the focused input field in any application (Chrome, Word, etc.)
/// Requires Accessibility permission.
#[command]
fn get_focused_field_text() -> String {
    #[cfg(target_os = "macos")]
    {
        let script = r#"
try
    tell application "System Events"
        set frontApp to first application process whose frontmost is true
        tell frontApp
            set focEl to focused UI element
            try
                set theVal to value of focEl
                if theVal is missing value then
                    return ""
                end if
                return theVal as text
            on error
                return ""
            end try
        end tell
    end tell
on error
    return ""
end try"#;
        std::process::Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default()
    }
    #[cfg(not(target_os = "macos"))]
    {
        String::new()
    }
}

/// Injects text via clipboard + Cmd+V into the active input field.
/// Saves and restores the original clipboard contents.
#[command]
async fn inject_text_at_cursor(text: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // Schrijf tekst naar tijdelijk bestand om escape-problemen te vermijden
        let temp_path = std::env::temp_dir().join("opensuggest_inject.txt");
        std::fs::write(&temp_path, text.as_bytes()).map_err(|e| e.to_string())?;
        let path_str = temp_path.to_string_lossy().to_string();

        let script = format!(
            r#"set prevClip to do shell script "pbpaste 2>/dev/null || echo ''"
do shell script "pbcopy < '{}'"
tell application "System Events"
    keystroke "v" using command down
end tell
delay 0.15
if prevClip is not "" then
    do shell script "printf '%s' " & quoted form of prevClip & " | pbcopy"
end if"#,
            path_str
        );

        std::process::Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output()
            .map_err(|e| e.to_string())?;

        Ok(())
    }
    #[cfg(target_os = "windows")]
    {
        // Windows: use PowerShell for clipboard injection
        let escaped = text.replace('"', "\"\"");
        let script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; \
             [System.Windows.Forms.Clipboard]::SetText(\"{}\"); \
             [System.Windows.Forms.SendKeys]::SendWait('^v')",
            escaped
        );
        std::process::Command::new("powershell")
            .args(["-Command", &script])
            .output()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        // Linux: gebruik xdotool + xclip
        let temp_path = std::env::temp_dir().join("opensuggest_inject.txt");
        std::fs::write(&temp_path, text.as_bytes()).map_err(|e| e.to_string())?;
        let path_str = temp_path.to_string_lossy().to_string();

        std::process::Command::new("sh")
            .arg("-c")
            .arg(format!("xclip -selection clipboard < '{}' && xdotool key ctrl+v", path_str))
            .output()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

// ─────────────────────────────── Permissions ──────────────────────────────────

#[command]
fn check_accessibility_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("osascript")
            .arg("-e")
            .arg("tell application \"System Events\" to get name of first application process whose frontmost is true")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

#[command]
fn request_accessibility_permission() {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .spawn();
    }
}

#[command]
fn check_screen_recording_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        use screenshots::Screen;
        match Screen::all() {
            Ok(screens) => screens.first().map(|s| s.capture().is_ok()).unwrap_or(false),
            Err(_) => false,
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

#[command]
fn request_screen_recording_permission() {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
            .spawn();
    }
}

#[command]
fn get_active_window_name() -> String {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("osascript")
            .arg("-e")
            .arg("tell application \"System Events\" to get name of first application process whose frontmost is true")
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default()
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("sh")
            .arg("-c")
            .arg("xdotool getactivewindow getwindowname 2>/dev/null || echo ''")
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default()
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("powershell")
            .args(["-Command", "(Get-Process | Where-Object {$_.MainWindowHandle -ne 0} | Sort-Object -Property CPU -Descending | Select-Object -First 1).MainWindowTitle"])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default()
    }
}

// ────────────────────────── Systeem RAM detectie ──────────────────────────────

/// Geeft het totale RAM van het systeem in GB.
/// Gebruikt voor modelaanbevelingen in de UI.
#[command]
fn get_system_ram_gb() -> u64 {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("sysctl")
            .args(["-n", "hw.memsize"])
            .output()
            .map(|o| {
                String::from_utf8_lossy(&o.stdout)
                    .trim()
                    .parse::<u64>()
                    .unwrap_or(0)
                    / 1024 / 1024 / 1024
            })
            .unwrap_or(0)
    }
    #[cfg(target_os = "linux")]
    {
        std::fs::read_to_string("/proc/meminfo")
            .map(|s| {
                for line in s.lines() {
                    if line.starts_with("MemTotal:") {
                        let kb: u64 = line
                            .split_whitespace()
                            .nth(1)
                            .and_then(|v| v.parse().ok())
                            .unwrap_or(0);
                        return kb / 1024 / 1024;
                    }
                }
                0
            })
            .unwrap_or(0)
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("powershell")
            .args(["-Command", "([math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB))"])
            .output()
            .map(|o| {
                String::from_utf8_lossy(&o.stdout)
                    .trim()
                    .parse::<u64>()
                    .unwrap_or(0)
            })
            .unwrap_or(0)
    }
}

// ──────────────────────────────── Setup Status ────────────────────────────────

#[command]
async fn get_setup_status(ollama_url: String) -> SetupStatus {
    let ollama_running = reqwest::Client::new()
        .get(format!("{}/api/tags", ollama_url))
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
        .is_ok();

    let (default_model, vision_model) = if ollama_running {
        match reqwest::Client::new()
            .get(format!("{}/api/tags", ollama_url))
            .send()
            .await
        {
            Ok(resp) => match resp.json::<serde_json::Value>().await {
                Ok(json) => {
                    let names: Vec<String> = json["models"]
                        .as_array()
                        .unwrap_or(&vec![])
                        .iter()
                        .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                        .collect();

                    let has_text = names.iter().any(|n| {
                        n.contains("gemma") || n.contains("llama") || n.contains("mistral")
                            || n.contains("phi") || n.contains("qwen") || n.contains("deepseek")
                    });
                    let has_vision = names
                        .iter()
                        .any(|n| n.contains("moondream") || n.contains("llava") || n.contains("vision"));

                    (has_text, has_vision)
                }
                Err(_) => (false, false),
            },
            Err(_) => (false, false),
        }
    } else {
        (false, false)
    };

    SetupStatus {
        // Altijd true: we hebben de binary gebundeld in de app
        ollama_installed: true,
        ollama_running,
        default_model_downloaded: default_model,
        vision_model_downloaded: vision_model,
        accessibility_granted: check_accessibility_permission(),
        screen_recording_granted: check_screen_recording_permission(),
    }
}

// ─────────────────────────────── Database (SQLite) ────────────────────────────

#[command]
fn db_get_count(state: State<AppState>) -> u32 {
    state
        .db.lock().unwrap()
        .as_ref()
        .and_then(|conn| {
            conn.query_row("SELECT COUNT(*) FROM fragments", [], |row| row.get::<_, u32>(0)).ok()
        })
        .unwrap_or(0)
}

#[command]
fn db_save_fragment(text: String, accepted: bool, context: String, state: State<AppState>) -> u32 {
    let db = state.db.lock().unwrap();
    if let Some(conn) = db.as_ref() {
        let _ = conn.execute(
            "INSERT INTO fragments (text, accepted, context) VALUES (?1, ?2, ?3)",
            rusqlite::params![text, accepted, context],
        );
        conn.query_row("SELECT COUNT(*) FROM fragments", [], |row| row.get::<_, u32>(0))
            .unwrap_or(0)
    } else {
        0
    }
}

#[command]
fn db_get_history(limit: u32, state: State<AppState>) -> Vec<String> {
    state
        .db.lock().unwrap()
        .as_ref()
        .map(|conn| {
            let mut stmt = conn
                .prepare("SELECT text FROM fragments WHERE accepted = 1 ORDER BY timestamp DESC LIMIT ?1")
                .unwrap();
            stmt.query_map([limit], |row| row.get::<_, String>(0))
                .unwrap()
                .filter_map(|r| r.ok())
                .collect()
        })
        .unwrap_or_default()
}

#[command]
fn db_clear(state: State<AppState>) {
    if let Some(conn) = state.db.lock().unwrap().as_ref() {
        let _ = conn.execute("DELETE FROM fragments", []);
    }
}

// ─────────────────────────────────── Stats ────────────────────────────────────

fn db_get_total_words(conn: &Connection) -> u32 {
    conn.query_row("SELECT COALESCE(SUM(words), 0) FROM stats", [], |row| row.get(0))
        .unwrap_or(0)
}

#[command]
fn stats_record(accepted: bool, word_count: u32, state: State<AppState>, app: tauri::AppHandle) {
    if let Some(conn) = state.db.lock().unwrap().as_ref() {
        let _ = conn.execute(
            "INSERT INTO stats (date, suggestions, accepted, words) VALUES (date('now'), 1, ?1, ?2)
             ON CONFLICT(date) DO UPDATE SET
               suggestions = suggestions + 1,
               accepted    = accepted + ?1,
               words       = words + ?2",
            rusqlite::params![if accepted { 1u32 } else { 0u32 }, word_count],
        );
        let total = db_get_total_words(conn);
        if let Some(tray) = app.tray_by_id("main") {
            let _ = tray.set_title(Some(format!(" {} words saved", total)));
        }
    }
}

#[command]
fn stats_get_all(state: State<AppState>) -> AllStats {
    let empty_today = DailyStats { date: "today".into(), suggestions: 0, accepted: 0, words: 0 };

    state
        .db.lock().unwrap()
        .as_ref()
        .map(|conn| {
            let today = conn
                .query_row(
                    "SELECT date, suggestions, accepted, words FROM stats WHERE date = date('now')",
                    [],
                    |row| Ok(DailyStats { date: row.get(0)?, suggestions: row.get(1)?, accepted: row.get(2)?, words: row.get(3)? }),
                )
                .unwrap_or_else(|_| empty_today.clone());

            let week = {
                let mut stmt = conn.prepare(
                    "SELECT date, suggestions, accepted, words FROM stats WHERE date >= date('now', '-6 days') ORDER BY date ASC"
                ).unwrap();
                stmt.query_map([], |row| Ok(DailyStats { date: row.get(0)?, suggestions: row.get(1)?, accepted: row.get(2)?, words: row.get(3)? }))
                    .unwrap()
                    .filter_map(|r| r.ok())
                    .collect()
            };

            let total = conn
                .query_row(
                    "SELECT COALESCE(SUM(suggestions),0), COALESCE(SUM(accepted),0), COALESCE(SUM(words),0) FROM stats",
                    [],
                    |row| Ok(TotalStats { suggestions: row.get(0)?, accepted: row.get(1)?, words: row.get(2)? }),
                )
                .unwrap_or(TotalStats { suggestions: 0, accepted: 0, words: 0 });

            AllStats { today, week, total }
        })
        .unwrap_or(AllStats { today: empty_today, week: vec![], total: TotalStats { suggestions: 0, accepted: 0, words: 0 } })
}

#[command]
fn stats_reset(state: State<AppState>) {
    if let Some(conn) = state.db.lock().unwrap().as_ref() {
        let _ = conn.execute("DELETE FROM stats", []);
    }
}

// ──────────────────────────────── Blocklist ───────────────────────────────────

#[command]
fn blocklist_get(state: State<AppState>) -> Vec<BlocklistEntry> {
    state.blocklist.lock().unwrap().clone()
}

#[command]
fn blocklist_add(entry_type: String, value: String, label: String, state: State<AppState>) -> Vec<BlocklistEntry> {
    let mut list = state.blocklist.lock().unwrap();
    let id = format!("bl_{}", list.len() + 1);
    list.push(BlocklistEntry { id, entry_type, value, label });
    list.clone()
}

#[command]
fn blocklist_remove(id: String, state: State<AppState>) -> Vec<BlocklistEntry> {
    let mut list = state.blocklist.lock().unwrap();
    list.retain(|e| e.id != id);
    list.clone()
}

#[command]
fn blocklist_check(window_name: String, state: State<AppState>) -> bool {
    let list = state.blocklist.lock().unwrap();
    let lower = window_name.to_lowercase();
    list.iter().any(|e| lower.contains(&e.value.to_lowercase()))
}

// ─────────────────────────── Screen Context Cache ─────────────────────────────

#[command]
fn get_screen_context(state: State<AppState>) -> String {
    state.screen_context.lock().unwrap().clone()
}

#[command]
fn set_screen_context(context: String, state: State<AppState>) {
    *state.screen_context.lock().unwrap() = context;
}

// ───────────────────────────── Database Init ──────────────────────────────────

fn init_database(app: &AppHandle) -> Option<Connection> {
    let data_dir = app.path().app_data_dir().ok()?;
    std::fs::create_dir_all(&data_dir).ok()?;

    let conn = Connection::open(data_dir.join("opensuggest.db")).ok()?;

    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS fragments (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            text      TEXT    NOT NULL,
            accepted  BOOLEAN NOT NULL DEFAULT 0,
            context   TEXT             DEFAULT '',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS stats (
            date        DATE    PRIMARY KEY,
            suggestions INTEGER DEFAULT 0,
            accepted    INTEGER DEFAULT 0,
            words       INTEGER DEFAULT 0
        );
        ",
    ).ok()?;

    Some(conn)
}

// ─────────────────────────────────── Main ─────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let db = init_database(app.handle());
            let total_words = db.as_ref().map(|conn| db_get_total_words(conn)).unwrap_or(0);

            #[cfg(desktop)]
            {
                use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};

                let item_open = MenuItemBuilder::with_id("open", "OpenSuggest openen").build(app)?;
                let item_settings = MenuItemBuilder::with_id("settings", "Instellingen...").build(app)?;
                let item_sep = PredefinedMenuItem::separator(app)?;
                let item_quit = MenuItemBuilder::with_id("quit", "Stoppen").build(app)?;

                let menu = MenuBuilder::new(app)
                    .item(&item_open)
                    .item(&item_settings)
                    .item(&item_sep)
                    .item(&item_quit)
                    .build()?;

                let icon_bytes = include_bytes!("../icons/trayTemplate_32.png");
                let icon = tauri::image::Image::from_bytes(icon_bytes)
                    .unwrap_or_else(|_| app.default_window_icon().unwrap().clone());

                let _ = tauri::tray::TrayIconBuilder::with_id("main")
                    .title(format!(" {} words saved", total_words))
                    .tooltip("OpenSuggest – AI Autocomplete")
                    .icon(icon)
                    .icon_as_template(true)
                    .menu(&menu)
                    .show_menu_on_left_click(true)
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "open" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "settings" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                                let _ = w.emit("navigate-to", "settings");
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .build(app);
            }

            app.manage(AppState {
                db: Mutex::new(db),
                screen_context: Mutex::new(String::new()),
                blocklist: Mutex::new(Vec::new()),
                ollama_process: Mutex::new(None),
                infer_tx: Mutex::new(Some(spawn_llm_thread())),
                loaded_model: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Ollama
            ollama_check,
            ollama_list_models,
            ollama_pull_model,
            ollama_delete_model,
            ollama_chat,
            ollama_generate,
            ollama_install,
            ollama_start,
            start_bundled_ollama,
            // Screen
            screen_capture_base64,
            screen_analyze,
            // Permissions
            check_accessibility_permission,
            request_accessibility_permission,
            check_screen_recording_permission,
            request_screen_recording_permission,
            get_active_window_name,
            // Systeem
            get_system_ram_gb,
            get_focused_field_text,
            inject_text_at_cursor,
            // Setup
            get_setup_status,
            // Database
            db_get_count,
            db_save_fragment,
            db_get_history,
            db_clear,
            // Stats
            stats_record,
            stats_get_all,
            stats_reset,
            // Blocklist
            blocklist_get,
            blocklist_add,
            blocklist_remove,
            blocklist_check,
            // Context Cache
            get_screen_context,
            set_screen_context,
            // Models folder
            reveal_models_folder,
            // In-process LLM engine
            llm_get_models_dir,
            llm_list_local_models,
            llm_download_gguf,
            llm_load_model,
            llm_get_loaded_model,
            llm_complete,
        ])
        .build(tauri::generate_context!())
        .expect("fout bij opstarten van OpenSuggest")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app_handle.state::<AppState>();
                // Gebruik een expliciet blok om de lock scope te beperken
                let mut process_lock = state.ollama_process.lock().expect("Kan ollama_process lock niet verkrijgen");
                if let Some(mut child) = process_lock.take() {
                    println!("Bundled Ollama server afsluiten...");
                    let _ = child.kill();
                }
            }
        });
}
