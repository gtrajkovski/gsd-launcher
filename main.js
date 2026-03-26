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

// Check if GSD is installed and get version info
function getGsdStatus() {
  const status = { installed: false, version: null, claudeAvailable: false };

  // Check if Claude Code is available
  try {
    execSync('claude --version', { encoding: 'utf-8', timeout: 10000 });
    status.claudeAvailable = true;
  } catch (_) {}

  // Check for GSD commands globally
  const globalGsdPath = path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude', 'commands', 'gsd');
  try {
    if (fs.existsSync(globalGsdPath)) {
      status.installed = true;
      status.location = 'global';
    }
  } catch (_) {}

  // Try to get version from npm
  try {
    const raw = execSync('npm view get-shit-done-cc version', { encoding: 'utf-8', timeout: 10000 });
    status.latestVersion = raw.trim();
  } catch (_) {}

  return status;
}

// Scan for projects that have .planning/ directory (GSD projects)
function findGsdProjects() {
  const projects = [];
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const searchDirs = [
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
  ].filter(d => { try { return fs.existsSync(d); } catch (_) { return false; } });

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

ipcMain.handle('install-gsd', async () => {
  try {
    execSync('npx get-shit-done-cc@latest', {
      encoding: 'utf-8',
      timeout: 120000,
      input: '\n' // auto-accept defaults
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
