<div align="center">

# AMoon Launcher

**A fast, modern Minecraft launcher — built with Tauri + React**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-green.svg)](https://github.com/congmc/amoon-launcher/releases)
[![Platform](https://img.shields.io/badge/platform-linux%20%7C%20windows-lightgrey.svg)](#install)

</div>

---

## Features

- **Multi-version** — launch any Minecraft version with one click
- **Mod loaders** — Forge, Fabric, Quilt, NeoForge out of the box
- **Account support** — Microsoft login & Ely.by (offline-friendly)
- **Mod manager** — browse & install mods directly from Modrinth
- **Shaders & resource packs** — manage from the launcher
- **System check** — RAM / disk / Java verified before launch
- **Auto Java** — downloads the right JRE on first run, no setup needed
- **Tiny footprint** — ~5 MB binary, no Electron

## Install

**Linux / macOS**
```bash
curl -fsSL https://cdn-rcf.anhcong.dev/install.sh | bash
```

**Windows (PowerShell)**
```powershell
irm https://cdn-rcf.anhcong.dev/install.ps1 | iex
```

Or grab the installer from [Releases](https://github.com/congmc/amoon-launcher/releases).

| Platform | Format | Download |
|----------|--------|----------|
| Linux x86_64 | AppImage | [→ cdn](https://cdn-rcf.anhcong.dev/releases/0.1.0/amoon-launcher-0.1.0-linux-x86_64.AppImage) |
| Linux x86_64 | .deb | [→ cdn](https://cdn-rcf.anhcong.dev/releases/0.1.0/amoon-launcher-0.1.0-linux-x86_64.deb) |
| Linux x86_64 | .tar.gz | [→ cdn](https://cdn-rcf.anhcong.dev/releases/0.1.0/amoon-launcher-0.1.0-linux-x86_64.tar.gz) |
| Windows x86_64 | Setup .exe | [→ cdn](https://cdn-rcf.anhcong.dev/releases/0.1.0/amoon-launcher-0.1.0-windows-x86_64-setup.exe) |
| Windows x86_64 | .zip | [→ cdn](https://cdn-rcf.anhcong.dev/releases/0.1.0/amoon-launcher-0.1.0-windows-x86_64.zip) |

## Build from source

**Requirements:** [Rust](https://rustup.rs) · [Node.js](https://nodejs.org) · [pnpm](https://pnpm.io)

```bash
git clone https://github.com/congmc/amoon-launcher.git
cd amoon-launcher
pnpm install
pnpm tauri build
```

Output lands in `src-tauri/target/release/bundle/`.

## Tech stack

| Layer | Tech |
|-------|------|
| Shell | [Tauri 2](https://tauri.app) (Rust) |
| UI | React 19 + Vite |
| State | Zustand |
| Icons | Phosphor Icons |
| System info | `sysinfo` crate |
| CDN | Cloudflare R2 |

## Contributing

PRs are welcome. Open an issue first for large changes.

## License

MIT — see [LICENSE](LICENSE).  
Copyright © 2026 AMoon Team
