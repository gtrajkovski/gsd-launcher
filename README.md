# GSD Launcher

Desktop app for launching and managing [GSD (Get Shit Done)](https://www.npmjs.com/package/get-shit-done-cc) projects with Claude Code.

![Electron](https://img.shields.io/badge/Electron-40-blue) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

## What It Does

- Scans your home directory for GSD projects (folders with `.planning/` or `PROJECT.md`)
- Shows project status, current phase, and milestone info
- One-click launch into Terminal (with Claude Code) or VS Code
- Install/update GSD directly from the app
- Search and filter across all your projects

## Prerequisites

- **Node.js** 18+ — [nodejs.org](https://nodejs.org)
- **Claude Code** — `npm install -g @anthropic-ai/claude-code`
- **GSD** (optional, can install from the app) — `npx get-shit-done-cc@latest`

## Quick Start

```bash
git clone https://github.com/gpt30/gsd-launcher.git
cd gsd-launcher
npm install
npm start
```

That's it. The app will open and scan for GSD projects automatically.

## Where It Looks for Projects

The launcher scans these directories (if they exist) for folders containing `.planning/` or `PROJECT.md`:

| Directory | Notes |
|-----------|-------|
| `~/` | Home directory |
| `~/Documents` | |
| `~/Desktop` | |
| `~/Projects` | |
| `~/repos` | |
| `~/src` | |
| `~/dev` | |
| `~/code` | |
| `~/github_repos` | |
| `~/OneDrive/Desktop` | Windows OneDrive |

## Platform Support

| Feature | Windows | macOS | Linux |
|---------|---------|-------|-------|
| Project scanning | Yes | Yes | Yes |
| Terminal launch | Windows Terminal / cmd | Terminal.app | gnome-terminal / konsole / xterm |
| VS Code launch | Yes | Yes | Yes |
| GSD install/update | Yes | Yes | Yes |

## License

MIT
