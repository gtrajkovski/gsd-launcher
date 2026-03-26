# GSD Launcher

Desktop app for launching and managing [GSD (Get Shit Done)](https://www.npmjs.com/package/get-shit-done-cc) projects with Claude Code.

![Electron](https://img.shields.io/badge/Electron-40-blue) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

## Download

Go to the [Releases page](https://github.com/gtrajkovski/gsd-launcher/releases) and download the installer for your platform:

| Platform | File |
|----------|------|
| Windows | `GSD-Launcher-Setup-x.x.x.exe` |
| macOS | `GSD-Launcher-x.x.x.dmg` |
| Linux | `GSD-Launcher-x.x.x.AppImage` |

Just download, install, and run. No terminal or Node.js required.

> **Note:** You still need [Claude Code](https://www.npmjs.com/package/@anthropic-ai/claude-code) installed to actually use GSD projects. The launcher helps you manage and open them.

## What It Does

- Scans your home directory for GSD projects (folders with `.planning/` or `PROJECT.md`)
- Shows project status, current phase, and milestone info
- One-click launch into Terminal (with Claude Code) or VS Code
- Install/update GSD directly from the app
- Search and filter across all your projects
- Add custom scan folders via the "+" button

## Run From Source

If you prefer running from source instead of the installer:

```bash
git clone https://github.com/gtrajkovski/gsd-launcher.git
cd gsd-launcher
npm install
npm start
```

## Where It Looks for Projects

The launcher scans these directories (if they exist) for folders containing `.planning/` or `PROJECT.md`:

| Directory | Notes |
|-----------|-------|
| `~/` | Home directory |
| `~/Documents` | |
| `~/Desktop` | |
| `~/Projects` | |
| `~/repos`, `~/src`, `~/dev`, `~/code` | Common dev folders |
| `~/github_repos` | |
| `~/OneDrive/Desktop` | Windows OneDrive |
| `C:\`, `D:\`, `E:\` | Windows drive roots |
| Custom folders | Added via "+" button in the app |

## Platform Support

| Feature | Windows | macOS | Linux |
|---------|---------|-------|-------|
| Project scanning | Yes | Yes | Yes |
| Terminal launch | Windows Terminal / cmd | Terminal.app | gnome-terminal / konsole / xterm |
| VS Code launch | Yes | Yes | Yes |
| GSD install/update | Yes | Yes | Yes |

## License

MIT
