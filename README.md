<div align="center">
  <img src="app-icon.png" alt="OpenSuggest" width="96" />
  <h1>OpenSuggest</h1>
  <p><strong>Open source, privacy-first AI autocomplete that runs entirely on your device.</strong></p>
  <p>No cloud. No subscriptions. No data leaving your machine.</p>

  <p>
    <a href="https://github.com/opensuggest/opensuggest/releases/latest">
      <img src="https://img.shields.io/github/v/release/opensuggest/opensuggest?style=flat-square&label=latest" alt="Latest Release" />
    </a>
    <img src="https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square" alt="License" />
    <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=flat-square" alt="Platforms" />
    <img src="https://img.shields.io/badge/built%20with-Tauri%202%20%2B%20React%2019-informational?style=flat-square" alt="Stack" />
  </p>

  <p>
    <a href="#download">Download</a> ·
    <a href="#features">Features</a> ·
    <a href="#models">Models</a> ·
    <a href="#building-from-source">Build from source</a> ·
    <a href="#contributing">Contributing</a>
  </p>
</div>

---

## What is OpenSuggest?

OpenSuggest brings intelligent, real-time text completions to every app on your computer — powered entirely by local AI models via [Ollama](https://ollama.com). It ships with a bundled Ollama engine and the Gemma 2 2B model so it works out of the box, with zero downloads required.

Whether you're writing an email, coding in your terminal, or filling in a form in your browser, OpenSuggest watches for natural typing pauses and surfaces a ghost-text suggestion you can accept with a single key press.

---

## Features

- **Fully local** — all inference runs on your CPU/GPU. Nothing is ever sent to a server.
- **Zero-setup** — ships with a bundled Ollama engine and Gemma 2 2B pre-installed. Open the app and start typing.
- **System-wide autocomplete** — works in any application (browsers, terminals, editors, chat apps) via a transparent overlay window.
- **Screen context** — optional vision model (Moondream or LLaVA-Phi3) analyzes your screen every 8 seconds to provide richer, context-aware completions.
- **Clipboard awareness** — optionally uses your clipboard content as additional context.
- **RAM-aware model selection** — automatically recommends the best model for your hardware on first launch.
- **Personalization** — learns from accepted completions (stored locally in SQLite) to improve suggestions over time.
- **Blocklist** — exclude specific apps, websites, or domains from receiving suggestions.
- **Privacy controls** — granular opt-in for screen capture and clipboard access; toggle collection of unaccepted suggestions independently.
- **Cross-platform** — macOS, Windows, and Linux.

---

## Download

| Platform | Link |
|---|---|
| **macOS** (Universal) | [OpenSuggest.dmg](https://github.com/opensuggest/opensuggest/releases/latest/download/OpenSuggest.dmg) |
| **Windows** | [OpenSuggest_Setup.exe](https://github.com/opensuggest/opensuggest/releases/latest/download/OpenSuggest_Setup.exe) |
| **Linux** (AppImage) | [OpenSuggest.AppImage](https://github.com/opensuggest/opensuggest/releases/latest/download/OpenSuggest.AppImage) |
| **Linux** (Debian/Ubuntu) | [OpenSuggest.deb](https://github.com/opensuggest/opensuggest/releases/latest/download/OpenSuggest.deb) |

> **macOS users:** macOS 12 Ventura or later is required.

---

## How it works

1. OpenSuggest polls the currently focused text field in the foreground application every 300 ms.
2. When typing pauses for the configured delay (default: 150 ms), the input text is sent to the local Ollama server.
3. The model returns a short completion (up to 80 tokens by default).
4. A transparent, always-on-top overlay appears near the cursor showing the ghost suggestion.
5. Press **Tab** (or your configured shortcut) to accept, or keep typing to dismiss.

All steps happen entirely on-device. The bundled Ollama instance runs on port `11435` so it does not conflict with any existing Ollama installation you may have.

---

## Models

OpenSuggest ships with **Gemma 2 2B** bundled (no download needed). Additional models can be downloaded from within the app.

| Model | Size | Type | Min RAM | Notes |
|---|---|---|---|---|
| Qwen 2.5 1.5B | 1.0 GB | Speed | 4 GB | Ultra-lightweight for low-spec hardware |
| **Gemma 2 2B** | 1.6 GB | Speed | 6 GB | **Bundled — zero download** |
| Llama 3.2 3B | 2.0 GB | Balanced | 8 GB | Meta's efficient model, great all-rounder |
| Phi-4 Mini | 2.5 GB | Balanced | 8 GB | Microsoft's compact reasoning model |
| Gemma 4 E4B | 6.2 GB | Balanced | 12 GB | Modern architecture, excellent quality |
| Mistral 7B | 4.1 GB | Balanced | 12 GB | Industry-leading speed/quality balance |
| Gemma 2 9B | 5.5 GB | Power | 16 GB | Premium completions for power users |

### Vision models (optional, for screen context)

| Model | Size | Min RAM |
|---|---|---|
| Moondream | 1.7 GB | 6 GB |
| LLaVA-Phi3 | 2.9 GB | 10 GB |

---

## Building from source

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- [Rust](https://rustup.rs) (stable toolchain)
- [Tauri CLI prerequisites](https://tauri.app/start/prerequisites/) for your platform

### Steps

```bash
# Clone the repository
git clone https://github.com/opensuggest/opensuggest.git
cd opensuggest

# Install Node dependencies
npm install

# Start the development build (hot-reload)
npm run tauri:dev

# Build a production binary
npm run tauri:build
```

The built binary will be in `src-tauri/target/release/bundle/`.

### Web-only development (no Rust required)

The React frontend can be run in a browser for UI development:

```bash
npm install
npm run dev
# Open http://localhost:3000
```

In browser mode, Tauri APIs are unavailable and the app renders a landing/download page instead of the full desktop interface.

---

## Project structure

```
opensuggest/
├── src/                    # React + TypeScript frontend
│   ├── components/         # UI components (Sidebar, SettingsView, GhostEditor, …)
│   ├── services/           # AI service, clipboard service
│   ├── App.tsx             # Root component & main app logic
│   ├── constants.ts        # Model definitions, default settings
│   └── types.ts            # Shared TypeScript types
├── src-tauri/              # Rust / Tauri backend
│   ├── src/                # Tauri commands (Ollama control, screen capture, SQLite, …)
│   ├── resources/          # Bundled Ollama binary + Gemma 2 2B model
│   └── tauri.conf.json     # Tauri configuration
├── public/                 # Static assets
└── vite.config.ts          # Vite build config
```

---

## Configuration

Settings are persisted in `localStorage` on the desktop app. The following can be configured from the in-app Settings panel:

| Setting | Default | Description |
|---|---|---|
| Active model | Gemma 2 2B | Language model used for completions |
| Trigger delay | 150 ms | Time after last keystroke before requesting a suggestion |
| Min characters | 3 | Minimum input length before a suggestion is requested |
| Max suggestion length | 80 tokens | Maximum length of a generated completion |
| Global suggestions | Off | Enable system-wide suggestions outside the OpenSuggest window |
| Screen context | Off | Enable periodic screen analysis via a vision model |
| Clipboard context | Off | Include clipboard text as additional context |
| Personalization strength | 0.5 | How much prior accepted completions influence new suggestions |

---

## Privacy

OpenSuggest is designed to be private by default:

- **No network requests** are made by the app itself. The only HTTP traffic is local (to `127.0.0.1`).
- **Screen capture** and **clipboard access** are opt-in and can be revoked at any time.
- **Personalization history** is stored in a local SQLite database and never leaves your device.
- **Unaccepted suggestions** are not stored unless you explicitly enable that option.
- There is no analytics, crash reporting, or telemetry of any kind.

---

## Contributing

Contributions are welcome. Please open an issue to discuss significant changes before submitting a pull request.

```bash
# Run type checks
npm run lint

# Build the frontend
npm run build
```

---

## License

OpenSuggest is released under the [Apache 2.0 License](LICENSE).

---

<div align="center">
  <sub>Built with <a href="https://tauri.app">Tauri</a>, <a href="https://react.dev">React</a>, and <a href="https://ollama.com">Ollama</a>.</sub>
</div>
