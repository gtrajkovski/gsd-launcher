const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { execSync, exec } = require('child_process');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 950,
    height: 700,
    title: 'GSD Launcher',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// Find an executable by checking common install locations when PATH lookup fails
function findExecutable(name) {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const ext = isWin ? '.exe' : '';

  const candidates = [];
  if (isWin) {
    const pf = process.env.PROGRAMFILES || 'C:\\Program Files';
    const localApp = process.env.LOCALAPPDATA || '';
    const appData = process.env.APPDATA || '';
    candidates.push(
      path.join(pf, 'nodejs', `${name}${ext}`),
      path.join('C:\\Program Files', 'nodejs', `${name}${ext}`),
      path.join('C:\\Program Files (x86)', 'nodejs', `${name}${ext}`),
      // nvm-windows locations
      path.join(appData, 'nvm', 'current', `${name}${ext}`),
      // Volta
      path.join(localApp, 'Volta', 'bin', `${name}${ext}`),
      // Scoop
      path.join(process.env.USERPROFILE || '', 'scoop', 'shims', `${name}${ext}`),
    );
    // npm global installs (for claude, etc.)
    if (name !== 'node' && name !== 'npm') {
      candidates.push(
        path.join(appData, 'npm', `${name}.cmd`),
        path.join(appData, 'npm', `${name}${ext}`),
      );
    }
  } else if (isMac) {
    candidates.push(
      `/usr/local/bin/${name}`,
      `/opt/homebrew/bin/${name}`,
      // nvm
      path.join(process.env.HOME || '', '.nvm', 'current', 'bin', name),
      // Volta
      path.join(process.env.HOME || '', '.volta', 'bin', name),
    );
  } else {
    candidates.push(
      `/usr/local/bin/${name}`,
      `/usr/bin/${name}`,
      // nvm
      path.join(process.env.HOME || '', '.nvm', 'current', 'bin', name),
      // Volta
      path.join(process.env.HOME || '', '.volta', 'bin', name),
    );
  }

  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch (_) {}
  }
  return null;
}

// Run a command, falling back to an absolute path if PATH lookup fails
function tryExec(name, args, opts) {
  // First try via PATH
  try {
    return execSync(`${name} ${args}`, opts).trim();
  } catch (_) {}

  // Fallback: find the executable by known install locations
  const fullPath = findExecutable(name);
  if (fullPath) {
    return execSync(`"${fullPath}" ${args}`, opts).trim();
  }

  return null;
}

// Check all prerequisites
function getGsdStatus() {
  const status = {
    nodeAvailable: false,
    nodeVersion: null,
    npmAvailable: false,
    claudeAvailable: false,
    claudeVersion: null,
    installed: false,
    location: null,
    latestVersion: null,
  };

  const execOpts = { encoding: 'utf-8', timeout: 5000 };

  // Check Node.js
  const nodeVer = tryExec('node', '--version', execOpts);
  if (nodeVer) {
    status.nodeAvailable = true;
    status.nodeVersion = nodeVer;
  }

  // Check npm
  const npmVer = tryExec('npm', '--version', execOpts);
  if (npmVer) {
    status.npmAvailable = true;
  }

  // Check Claude Code
  const claudeVer = tryExec('claude', '--version', { encoding: 'utf-8', timeout: 10000 });
  if (claudeVer) {
    status.claudeAvailable = true;
    status.claudeVersion = claudeVer;
  }

  // Check for GSD commands globally
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const globalGsdPath = path.join(home, '.claude', 'commands', 'gsd');
  try {
    if (fs.existsSync(globalGsdPath)) {
      status.installed = true;
      status.location = 'global';
    }
  } catch (_) {}

  // Try to get latest GSD version from npm
  if (status.npmAvailable) {
    try {
      const raw = execSync('npm view get-shit-done-cc version', { encoding: 'utf-8', timeout: 10000 });
      status.latestVersion = raw.trim();
    } catch (_) {}
  }

  return status;
}

// Config file for user-defined scan directories
function getConfigPath() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  return path.join(home, '.gsd-launcher.json');
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8'));
  } catch (_) {
    return {};
  }
}

function saveConfig(config) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

// Scan for projects that have .planning/ directory (GSD projects)
function findGsdProjects() {
  const projects = [];
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const config = loadConfig();

  // Default scan locations — common project directories
  const defaultDirs = [
    home,
    path.join(home, 'Documents'),
    path.join(home, 'Desktop'),
    path.join(home, 'Projects'),
    path.join(home, 'repos'),
    path.join(home, 'src'),
    path.join(home, 'dev'),
    path.join(home, 'code'),
    path.join(home, 'github_repos'),
    path.join(home, 'OneDrive', 'Desktop'),
  ];

  // On Windows, also scan drive roots (C:\, D:\, etc.) for top-level projects
  if (process.platform === 'win32') {
    for (const letter of ['C', 'D', 'E']) {
      const root = `${letter}:\\`;
      if (fs.existsSync(root)) defaultDirs.push(root);
      const projDir = `${letter}:\\Projects`;
      if (fs.existsSync(projDir)) defaultDirs.push(projDir);
    }
  }

  // Merge with user-added custom directories
  const customDirs = config.scanDirs || [];
  const allDirs = [...new Set([...defaultDirs, ...customDirs])];
  const searchDirs = allDirs.filter(d => { try { return fs.existsSync(d); } catch (_) { return false; } });

  for (const baseDir of searchDirs) {
    try {
      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(baseDir, entry.name);
        const planningDir = path.join(fullPath, '.planning');
        const projectMd = path.join(fullPath, 'PROJECT.md');
        const hasGsd = fs.existsSync(planningDir) || fs.existsSync(projectMd);
        const hasGit = fs.existsSync(path.join(fullPath, '.git'));

        if (hasGsd) {
          let projectName = entry.name;
          let milestone = null;
          let state = null;

          // Try to read PROJECT.md for project name
          try {
            const content = fs.readFileSync(projectMd, 'utf-8');
            const nameMatch = content.match(/^#\s+(.+)/m);
            if (nameMatch) projectName = nameMatch[1];
          } catch (_) {}

          // Try to read STATE.md for current state
          const statePath = path.join(fullPath, 'STATE.md');
          try {
            const content = fs.readFileSync(statePath, 'utf-8');
            const phaseMatch = content.match(/phase[:\s]+(\d+)/i);
            if (phaseMatch) state = `Phase ${phaseMatch[1]}`;
          } catch (_) {}

          // Try to read ROADMAP.md for milestone
          const roadmapPath = path.join(fullPath, 'ROADMAP.md');
          try {
            const content = fs.readFileSync(roadmapPath, 'utf-8');
            const msMatch = content.match(/milestone[:\s]+(.+)/i);
            if (msMatch) milestone = msMatch[1].trim();
          } catch (_) {}

          projects.push({
            name: projectName,
            folder: entry.name,
            path: fullPath,
            hasGit,
            hasPlanning: fs.existsSync(planningDir),
            state,
            milestone
          });
        }
      }
    } catch (_) {}
  }

  // Deduplicate by path
  const seen = new Set();
  return projects.filter(p => {
    if (seen.has(p.path)) return false;
    seen.add(p.path);
    return true;
  });
}

ipcMain.handle('get-status', async () => {
  try {
    const status = getGsdStatus();
    const projects = findGsdProjects();
    return { status, projects };
  } catch (e) {
    return { error: e.message };
  }
});

// Install Node.js via system package manager
ipcMain.handle('install-node', async () => {
  try {
    if (process.platform === 'win32') {
      // Try winget first (built into Windows 10+)
      try {
        execSync('winget --version', { encoding: 'utf-8', timeout: 5000 });
        execSync('winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements', {
          encoding: 'utf-8', timeout: 300000
        });
        return { ok: true };
      } catch (_) {
        // Winget not available — open download page
        exec('start https://nodejs.org', { shell: true });
        return { ok: true, manual: true, message: 'Opening nodejs.org — please download and install, then restart this app.' };
      }
    } else if (process.platform === 'darwin') {
      // Try brew
      try {
        execSync('brew --version', { encoding: 'utf-8', timeout: 5000 });
        execSync('brew install node', { encoding: 'utf-8', timeout: 300000 });
        return { ok: true };
      } catch (_) {
        exec('open https://nodejs.org');
        return { ok: true, manual: true, message: 'Opening nodejs.org — please download and install, then restart this app.' };
      }
    } else {
      // Linux — try apt, then dnf, then link
      for (const [check, cmd] of [['apt', 'sudo apt install -y nodejs npm'], ['dnf', 'sudo dnf install -y nodejs npm']]) {
        try {
          execSync(`which ${check}`, { encoding: 'utf-8', timeout: 5000 });
          execSync(cmd, { encoding: 'utf-8', timeout: 300000 });
          return { ok: true };
        } catch (_) {}
      }
      exec('xdg-open https://nodejs.org');
      return { ok: true, manual: true, message: 'Opening nodejs.org — please download and install, then restart this app.' };
    }
  } catch (e) {
    return { error: e.message };
  }
});

// Install Claude Code via npm
ipcMain.handle('install-claude', async () => {
  try {
    execSync('npm install -g @anthropic-ai/claude-code', {
      encoding: 'utf-8',
      timeout: 120000
    });
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('install-gsd', async () => {
  try {
    execSync('npx get-shit-done-cc@latest', {
      encoding: 'utf-8',
      timeout: 120000,
      input: '\n'
    });
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('update-gsd', async () => {
  try {
    execSync('npx get-shit-done-cc@latest', {
      encoding: 'utf-8',
      timeout: 120000,
      input: '\n'
    });
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

// Find VS Code executable (cross-platform)
function getVSCodePath() {
  const isWin = process.platform === 'win32';
  if (isWin) {
    const candidates = [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'bin', 'code'),
      path.join(process.env.PROGRAMFILES || '', 'Microsoft VS Code', 'bin', 'code'),
    ];
    for (const p of candidates) {
      try { if (fs.existsSync(p)) return p; } catch (_) {}
    }
  }
  // Fallback: check PATH
  try {
    const cmd = isWin ? 'where code' : 'which code';
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim().split('\n')[0];
    if (result) return result.trim();
  } catch (_) {}
  return null;
}

// Validate a path is a real directory (prevents command injection)
function validatePath(p) {
  if (typeof p !== 'string' || p.length === 0) return false;
  // Block shell metacharacters
  if (/[;&|`$(){}!<>]/.test(p)) return false;
  try { return fs.statSync(p).isDirectory(); } catch (_) { return false; }
}

// Launch terminal with claude (cross-platform)
function launchInTerminal(projectPath) {
  if (!validatePath(projectPath)) throw new Error('Invalid project path');

  if (process.platform === 'win32') {
    // Prefer Windows Terminal, fall back to cmd
    try {
      execSync('where wt', { encoding: 'utf-8', timeout: 5000 });
      exec(`wt -d "${projectPath}" cmd /k claude`, { shell: true });
      return;
    } catch (_) {}
    exec(`start cmd /k "cd /d ${projectPath} && claude"`, { shell: true });
  } else if (process.platform === 'darwin') {
    exec(`osascript -e 'tell app "Terminal" to do script "cd ${projectPath.replace(/'/g, "\\'")} && claude"'`);
  } else {
    // Linux — try common terminals
    const terminals = ['gnome-terminal', 'konsole', 'xterm'];
    for (const term of terminals) {
      try {
        execSync(`which ${term}`, { encoding: 'utf-8', timeout: 5000 });
        exec(`${term} -- bash -c "cd '${projectPath}' && claude; exec bash"`);
        return;
      } catch (_) {}
    }
    exec(`xterm -e "cd '${projectPath}' && claude; exec bash"`);
  }
}

function launchInVSCode(projectPath) {
  if (!validatePath(projectPath)) return { error: 'Invalid project path' };
  const codePath = getVSCodePath();
  if (!codePath) return { error: 'VS Code not found' };
  exec(`"${codePath}" "${projectPath}"`, { shell: true });
  return { ok: true };
}

ipcMain.handle('launch-terminal', async (_event, projectPath) => {
  try {
    launchInTerminal(projectPath);
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('launch-vscode', async (_event, projectPath) => {
  try {
    return launchInVSCode(projectPath);
  } catch (e) {
    return { error: e.message };
  }
});


ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select a project folder'
  });
  if (result.canceled) return { canceled: true };
  return { path: result.filePaths[0] };
});

// Add a custom scan directory
ipcMain.handle('add-scan-dir', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Add a folder to scan for GSD projects'
  });
  if (result.canceled) return { canceled: true };
  const config = loadConfig();
  if (!config.scanDirs) config.scanDirs = [];
  const dir = result.filePaths[0];
  if (!config.scanDirs.includes(dir)) {
    config.scanDirs.push(dir);
    saveConfig(config);
  }
  return { path: dir };
});

// Remove a custom scan directory
ipcMain.handle('remove-scan-dir', async (_event, dir) => {
  const config = loadConfig();
  if (!config.scanDirs) return { ok: true };
  config.scanDirs = config.scanDirs.filter(d => d !== dir);
  saveConfig(config);
  return { ok: true };
});

// Get current custom scan dirs
ipcMain.handle('get-scan-dirs', async () => {
  const config = loadConfig();
  return config.scanDirs || [];
});
