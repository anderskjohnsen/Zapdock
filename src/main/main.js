'use strict';
const { app, BrowserWindow, ipcMain, screen, Menu, shell, globalShortcut, Notification } = require('electron');
const path = require('path');
const win32 = require('./win32');
const { loadConfig, createStateStore, writeJson, readJson, WEB_PRESETS, DEFAULT_MODULES, DEFAULT_CONFIG, CONFIG_VERSION } = require('./config');
const PROVIDERS = require('./providers');
const { WinHelper } = require('./services/winhelper');

if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

app.setAppUserModelId('xyz.zapdock.app');
// Google/YouTube/Discord blokkerer innlogging fra "Electron"-useragent.
app.userAgentFallback = app.userAgentFallback
  .replace(/\sElectron\/\S+/i, '')
  .replace(/\szapdock\/\S+/i, '');

const RENDERER = path.join(__dirname, '..', 'renderer');
const PRELOAD = path.join(__dirname, 'preload.js');
const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');
const APPBAR_MSG = 0x0400 + 0x101; // WM_USER + n
const ABN_POSCHANGED = 1;
const ABN_FULLSCREENAPP = 2;
const GRIP = 22; // høyden på tittelstripen i forhåndsvisningen (DIP)

let config;
let configFile;
let store;
let dock = null;
let appbar = null;
let settingsWin = null;
let quitting = false;
let fullscreenApp = false;
const winhelper = new WinHelper();
const panels = new Map(); // id -> { win, mod, mode, lastBlurHide, anchor, playing, dragging }
const providers = new Map(); // id -> provider
const moduleData = new Map(); // id -> siste data
const previews = new Map(); // id -> { target, thumb, thumbDest, suppressed, minimized, running }
const iconCache = new Map();
const taskbar = { windows: [], json: '', foreground: 0, lastExternal: 0 };

// ---------------------------------------------------------------------------
// Hjelpere

const send = (wc, channel, payload) => {
  if (wc && !wc.isDestroyed()) wc.send(channel, payload);
};
const sendDock = (channel, payload) => dock && send(dock.webContents, channel, payload);
const enabledModules = () => config.modules.filter((m) => m.enabled !== false);
const getModule = (id) => enabledModules().find((m) => m.id === id);
const modState = (id) => (store.data.modules[id] ||= { mode: 'docked' });

function ownHandles() {
  const set = new Set();
  if (!win32.available) return set;
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) set.add(win32.hwndOf(w));
  return set;
}

const DEFAULT_SIZES = {
  claude: [420, 600], media: [360, 480], preview: [400, 247], calendar: [380, 560], weather: [400, 520],
  timer: [340, 440], notes: [400, 520], clipboard: [420, 540], system: [380, 440], web: [960, 600],
};
function defaultSize(mod) {
  if (Array.isArray(mod.size)) return mod.size;
  return DEFAULT_SIZES[mod.type] || [400, 520];
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function notify({ title, body, onClick, urgent }) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body: body || '', silent: false, urgency: urgent ? 'critical' : 'normal', icon: ICON });
  if (onClick) n.on('click', onClick);
  n.show();
}

// ---------------------------------------------------------------------------
// Windows-oppgavelinjen

function applyTaskbarVisibility() {
  if (!win32.available) return;
  const t = store.data.taskbar;
  if (config.bar.hideWindowsTaskbar) {
    if (!t.hiddenByZapdock) {
      t.prevState = win32.hideTaskbar();
      t.hiddenByZapdock = true;
      store.save(true);
    } else {
      win32.hideTaskbar();
    }
  } else if (t.hiddenByZapdock) {
    restoreTaskbar();
  }
}

function restoreTaskbar() {
  if (!win32.available || !store) return;
  const t = store.data.taskbar;
  if (!t.hiddenByZapdock) return;
  try {
    win32.showTaskbar(t.prevState);
  } catch (err) {
    console.error('[zapdock] kunne ikke vise oppgavelinjen:', err);
  }
  t.hiddenByZapdock = false;
  store.save(true);
}

// ---------------------------------------------------------------------------
// Docken

function createDock() {
  dock = new BrowserWindow({
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    thickFrame: false,
    backgroundColor: '#0f1116',
    title: 'Zapdock',
    icon: ICON,
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: false },
  });
  dock.setAlwaysOnTop(true, 'pop-up-menu');
  dock.loadFile(path.join(RENDERER, 'dock.html'));
  dock.once('ready-to-show', () => {
    positionDock();
    dock.showInactive();
    // Utvikling/feilsøking: ZAPDOCK_OPEN=claude,youtube:floating åpner moduler ved oppstart.
    for (const spec of (process.env.ZAPDOCK_OPEN || '').split(',').filter(Boolean)) {
      const [id, mode] = spec.split(':');
      if (id === 'settings') {
        openSettings();
        continue;
      }
      if (!getModule(id)) continue;
      if (mode === 'floating') setMode(id, 'floating');
      showPanel(ensurePanel(id));
    }
  });
  dock.on('close', (e) => {
    if (!quitting) e.preventDefault();
  });

  if (win32.available) {
    dock.hookWindowMessage(APPBAR_MSG, (wParam, lParam) => {
      const code = Number(wParam.readBigUInt64LE(0));
      if (code === ABN_POSCHANGED) positionDock();
      else if (code === ABN_FULLSCREENAPP) {
        fullscreenApp = Number(lParam.readBigUInt64LE(0)) !== 0;
        if (fullscreenApp) dock.hide();
        else dock.showInactive();
      }
    });
  }
}

function positionDock() {
  if (!dock) return;
  const display = screen.getPrimaryDisplay();
  const h = config.bar.height;
  const edge = config.bar.edge === 'top' ? 'top' : 'bottom';
  if (win32.available) {
    try {
      if (!appbar) appbar = win32.appbarRegister(win32.hwndOf(dock), edge, APPBAR_MSG);
      const phys = screen.dipToScreenRect(null, display.bounds);
      const rc = win32.appbarSetPos(appbar, phys, Math.round(h * display.scaleFactor));
      dock.setBounds(screen.screenToDipRect(null, rc));
      return;
    } catch (err) {
      console.error('[zapdock] appbar feilet, faller tilbake:', err);
    }
  }
  const wa = display.workArea;
  dock.setBounds({ x: wa.x, y: edge === 'top' ? wa.y : wa.y + wa.height - h, width: wa.width, height: h });
}

// ---------------------------------------------------------------------------
// Modulvinduer (panel over docken, eller frittflytende "alltid øverst")

function ensurePanel(id) {
  let p = panels.get(id);
  if (p && !p.win.isDestroyed()) return p;
  const mod = getModule(id);
  if (!mod) return null;
  const st = modState(id);
  const [w, h] = st.size || defaultSize(mod);
  const isPreview = mod.type === 'preview';
  const win = new BrowserWindow({
    width: w,
    height: h,
    minWidth: isPreview ? 200 : 300,
    minHeight: isPreview ? 120 : 200,
    show: false,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: mod.type === 'web',
    backgroundColor: '#12141b',
    title: mod.title,
    icon: ICON,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      sandbox: false,
      webviewTag: mod.type === 'web',
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.loadFile(path.join(RENDERER, 'panel.html'), { query: { id } });
  p = { win, mod, mode: st.mode === 'floating' ? 'floating' : 'docked', lastBlurHide: 0, anchor: null, playing: false, dragging: false };
  panels.set(id, p);

  win.on('blur', () => {
    if (p.mode === 'docked' && !isPreview && !p.dragging && win.isVisible() && !win.isFullScreen()) {
      p.lastBlurHide = Date.now();
      win.hide();
    }
  });
  win.on('show', pushModuleState);
  win.on('hide', pushModuleState);
  win.on('moved', () => onPanelMoved(id));
  win.on('resized', () => {
    const b = win.getBounds();
    modState(id).size = [b.width, b.height];
    if (p.mode === 'floating') modState(id).bounds = b;
    store.save();
  });
  if (isPreview) win.on('resize', () => updateThumb(id));
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => panels.delete(id));
  return p;
}

function placeDocked(p) {
  if (!dock) return;
  const db = dock.getBounds();
  const disp = screen.getDisplayMatching(db).bounds;
  const [w, h] = modState(p.mod.id).size || defaultSize(p.mod);
  let x;
  if (p.mod.type === 'preview') {
    // Stable flere forhåndsvisninger ved siden av hverandre fra høyre.
    const ids = enabledModules().filter((m) => m.type === 'preview').map((m) => m.id);
    const idx = Math.max(0, ids.indexOf(p.mod.id));
    x = db.x + db.width - (w + 12) * (idx + 1);
  } else if (p.anchor) x = db.x + p.anchor.x + p.anchor.width / 2 - w / 2;
  else x = db.x + db.width / 2 - w / 2;
  x = Math.max(disp.x + 8, Math.min(x, disp.x + disp.width - w - 8));
  const y = config.bar.edge === 'top' ? db.y + db.height + 8 : db.y - h - 8;
  p.win.setBounds({ x: Math.round(x), y: Math.round(y), width: w, height: h });
}

function placeFloating(p) {
  const b = modState(p.mod.id).bounds;
  if (b && screen.getAllDisplays().some((d) => rectsOverlap(d.bounds, b))) p.win.setBounds(b);
  else placeDocked(p);
}

function setMode(id, mode) {
  const p = ensurePanel(id);
  if (!p) return;
  p.mode = mode;
  modState(id).mode = mode;
  if (mode === 'floating') modState(id).bounds = p.win.getBounds();
  else placeDocked(p);
  store.save();
  send(p.win.webContents, 'panel:mode', mode);
  pushModuleState();
}

function showPanel(p, { focus = true } = {}) {
  if (!p) return;
  if (p.mode === 'docked') placeDocked(p);
  else placeFloating(p);
  if (focus) p.win.show();
  else p.win.showInactive();
  p.win.setAlwaysOnTop(true, 'floating');
  if (p.mod.type === 'preview') ensureThumb(p.mod.id);
}

function openPanel(id) {
  const p = ensurePanel(id);
  if (p && !p.win.isVisible()) showPanel(p);
  else if (p) p.win.focus();
}

function togglePanel(id, anchor) {
  const p = ensurePanel(id);
  if (!p) return;
  if (anchor) p.anchor = anchor;
  if (p.mod.type === 'preview') {
    const pv = previewState(id);
    if (p.win.isVisible()) {
      pv.suppressed = true;
      p.win.hide();
    } else {
      pv.suppressed = false;
      showPanel(p, { focus: false });
    }
    return;
  }
  if (p.win.isVisible()) {
    p.win.hide();
    return;
  }
  if (Date.now() - p.lastBlurHide < 300) return; // klikket på ikonet lukket nettopp panelet
  showPanel(p);
}

function onPanelMoved(id) {
  const p = panels.get(id);
  if (!p || p.dragging) return;
  const b = p.win.getBounds();
  const overDock = dock && rectsOverlap(b, dock.getBounds());
  if (p.mode === 'floating') {
    if (overDock) setMode(id, 'docked');
    else {
      modState(id).bounds = b;
      store.save();
    }
  } else if (!overDock) {
    setMode(id, 'floating'); // dratt bort fra docken -> eget vindu
  } else {
    placeDocked(p);
  }
}

function pushModuleState() {
  const out = {};
  for (const mod of enabledModules()) {
    const p = panels.get(mod.id);
    out[mod.id] = {
      visible: !!(p && !p.win.isDestroyed() && p.win.isVisible()),
      mode: p ? p.mode : modState(mod.id).mode || 'docked',
      playing: !!(p && p.playing),
    };
    if (mod.type === 'preview') out[mod.id].running = !!(previews.get(mod.id) || {}).running;
  }
  sendDock('modules:state', out);
}

// ---------------------------------------------------------------------------
// Datatjenester for modulene

function publish(id, data) {
  moduleData.set(id, data);
  sendDock('module:data', { id, data });
  const p = panels.get(id);
  if (p) send(p.win.webContents, 'module:data', data);
}

function startProviders() {
  for (const mod of enabledModules()) {
    const factory = PROVIDERS[mod.type];
    if (!factory) continue;
    const provider = factory({
      mod,
      config,
      store,
      win32,
      winhelper,
      shell,
      userData: app.getPath('userData'),
      publish: (data) => publish(mod.id, data),
      notify,
      openPanel: () => openPanel(mod.id),
      taskbarWindows: () => taskbar.windows,
    });
    providers.set(mod.id, provider);
    try {
      provider.start();
    } catch (err) {
      console.error(`[zapdock] modul ${mod.id} feilet ved start:`, err);
    }
  }
}

function stopProviders() {
  for (const p of providers.values()) {
    try { p.stop(); } catch (_) { /* ignorer */ }
  }
}

// ---------------------------------------------------------------------------
// Live forhåndsvisning (DWM-miniatyr av f.eks. WoW)

function previewState(id) {
  if (!previews.has(id)) previews.set(id, { target: 0, thumb: 0, thumbDest: 0, suppressed: false, minimized: false, running: false });
  return previews.get(id);
}

function findPreviewTarget(mod) {
  const exes = (mod.match || []).map((s) => s.toLowerCase());
  for (const w of taskbar.windows) {
    const exe = path.basename(w.exe || '').toLowerCase();
    if (exes.includes(exe)) return w.hwnd;
  }
  if (mod.titleMatch) {
    const t = mod.titleMatch.toLowerCase();
    const hit = taskbar.windows.find((w) => (w.title || '').toLowerCase() === t);
    if (hit) return hit.hwnd;
  }
  return 0;
}

function releaseThumb(id) {
  const pv = previewState(id);
  if (pv.thumb) win32.thumbUnregister(pv.thumb);
  pv.thumb = 0;
  pv.thumbDest = 0;
}

function ensureThumb(id) {
  const pv = previewState(id);
  const p = panels.get(id);
  if (!p || !pv.target || !win32.available) return;
  const dest = win32.hwndOf(p.win);
  if (!pv.thumb || pv.thumbDest !== dest) {
    releaseThumb(id);
    pv.thumb = win32.thumbRegister(dest, pv.target);
    pv.thumbDest = dest;
  }
  updateThumb(id);
}

function updateThumb(id) {
  const pv = previewState(id);
  const p = panels.get(id);
  if (!pv.thumb || !p || p.win.isDestroyed()) return;
  const [cw, ch] = p.win.getContentSize();
  const scale = screen.getDisplayMatching(p.win.getBounds()).scaleFactor;
  const area = { x: 0, y: GRIP * scale, width: cw * scale, height: (ch - GRIP) * scale };
  const src = win32.thumbSourceSize(pv.thumb);
  let rect = area;
  if (src && src.width > 0 && src.height > 0) {
    const s = Math.min(area.width / src.width, area.height / src.height);
    const w = src.width * s;
    const h = src.height * s;
    rect = { x: area.x + (area.width - w) / 2, y: area.y + (area.height - h) / 2, width: w, height: h };
  }
  rect = { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
  win32.thumbUpdate(pv.thumb, rect, !pv.minimized);
}

function previewTick(fg, own) {
  for (const mod of enabledModules()) {
    if (mod.type !== 'preview') continue;
    const id = mod.id;
    const pv = previewState(id);
    const target = findPreviewTarget(mod);
    if (target !== pv.target) {
      releaseThumb(id);
      pv.target = target;
    }
    const running = !!target;
    const minimized = running && win32.isMinimized(target);
    const p = panels.get(id);
    if (running !== pv.running || minimized !== pv.minimized) {
      pv.running = running;
      pv.minimized = minimized;
      if (p) send(p.win.webContents, 'preview:status', { running, minimized, supported: win32.available });
      updateThumb(id);
      pushModuleState();
    }
    if (!running) {
      if (p && p.win.isVisible() && mod.autoShow !== false) p.win.hide();
      continue;
    }
    if (fg === target) {
      pv.suppressed = false;
      if (p && p.win.isVisible()) p.win.hide();
      continue;
    }
    if (own.has(fg) || !fg || fullscreenApp) continue;
    if (mod.autoShow !== false && !pv.suppressed && !(p && p.win.isVisible())) {
      showPanel(ensurePanel(id), { focus: false });
    }
  }
}

// ---------------------------------------------------------------------------
// Polling (vinduer, forgrunn, forhåndsvisning)

let tickN = 0;
function tick() {
  if (!win32.available) return;
  try {
    const own = ownHandles();
    const fg = win32.getForeground();
    if (fg && !own.has(fg)) taskbar.lastExternal = fg;
    if (tickN % 2 === 0) {
      taskbar.windows = win32.listWindows(own);
      const json = JSON.stringify(taskbar.windows);
      if (json !== taskbar.json) {
        taskbar.json = json;
        sendDock('taskbar:windows', taskbar.windows);
      }
    }
    if (taskbar.foreground !== taskbar.lastExternal) {
      taskbar.foreground = taskbar.lastExternal;
      sendDock('taskbar:active', taskbar.foreground);
    }
    previewTick(fg, own);
    if (tickN % 20 === 0 && config.bar.hideWindowsTaskbar && win32.taskbarIsVisible()) win32.hideTaskbar();
  } catch (err) {
    console.error('[zapdock] tick:', err);
  }
  tickN++;
}

// ---------------------------------------------------------------------------
// Innstillinger

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 860,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    title: 'Zapdock – innstillinger',
    backgroundColor: '#0f1116',
    icon: ICON,
    autoHideMenuBar: true,
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: false },
  });
  settingsWin.setMenu(null);
  settingsWin.loadFile(path.join(RENDERER, 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

function saveSettings(next) {
  const user = readJson(configFile) || {};
  const merged = { ...user, ...next, version: CONFIG_VERSION };
  writeJson(configFile, merged);
  if (typeof next.autostart === 'boolean') {
    app.setLoginItemSettings({ openAtLogin: next.autostart });
    delete merged.autostart;
    writeJson(configFile, merged);
  }
}

function relaunch() {
  app.relaunch();
  quit();
}

// ---------------------------------------------------------------------------
// IPC

function registerIpc() {
  ipcMain.handle('config:get', () => ({
    bar: config.bar,
    modules: enabledModules(),
    pinned: config.pinned,
    claude: config.claude,
    platform: process.platform,
    data: Object.fromEntries(moduleData),
    audio: winhelper.available ? winhelper.audio : null,
  }));

  ipcMain.handle('panel:init', (e, id) => {
    const mod = getModule(id);
    const pv = previews.get(id) || {};
    return {
      mod,
      mode: panels.get(id) ? panels.get(id).mode : 'docked',
      platform: process.platform,
      data: moduleData.get(id) || null,
      preview: { running: !!pv.running, minimized: !!pv.minimized, supported: win32.available },
    };
  });

  ipcMain.handle('module:action', async (e, { id, action, payload }) => {
    const p = providers.get(id);
    if (!p || !p.action) return null;
    try {
      const r = await p.action(action, payload || {});
      return r === undefined ? null : JSON.parse(JSON.stringify(r));
    } catch (err) {
      console.error(`[zapdock] ${id}.${action}:`, err);
      return { error: err.message };
    }
  });

  ipcMain.handle('taskbar:icon', async (e, exe) => {
    if (!exe) return null;
    if (iconCache.has(exe)) return iconCache.get(exe);
    try {
      const img = await app.getFileIcon(exe, { size: 'normal' });
      const url = img.isEmpty() ? null : img.toDataURL();
      iconCache.set(exe, url);
      return url;
    } catch (_) {
      iconCache.set(exe, null);
      return null;
    }
  });

  ipcMain.on('taskbar:click', (e, hwnd) => {
    const w = taskbar.windows.find((x) => x.hwnd === hwnd);
    if (!w) return;
    if (hwnd === taskbar.lastExternal && !w.minimized) win32.minimize(hwnd);
    else win32.activate(hwnd);
  });

  ipcMain.on('pinned:launch', (e, idx) => {
    const item = config.pinned[idx];
    if (item && item.path) shell.openPath(item.path);
  });

  ipcMain.on('shell:start', () => win32.available && win32.pressKeys([win32.VK.LWIN]));
  ipcMain.on('shell:desktop', () => win32.available && win32.pressKeys([win32.VK.LWIN, win32.VK.D]));
  ipcMain.on('shell:notifications', () => win32.available && win32.pressKeys([win32.VK.LWIN, win32.VK.N]));
  ipcMain.on('shell:quicksettings', () => win32.available && win32.pressKeys([win32.VK.LWIN, win32.VK.A]));

  ipcMain.on('audio:set', (e, v) => winhelper.send(`audio set ${Math.max(0, Math.min(1, Number(v) || 0)).toFixed(3)}`));
  ipcMain.on('audio:mute', () => winhelper.send('audio togglemute'));
  winhelper.on('audio', (a) => sendDock('audio', a));

  ipcMain.on('module:toggle', (e, { id, anchor }) => togglePanel(id, anchor));

  ipcMain.on('module:drag', (e, { id, phase, x, y }) => {
    const p = ensurePanel(id);
    if (!p) return;
    if (phase === 'start') {
      p.dragging = true;
      if (p.mode !== 'floating') {
        p.mode = 'floating';
        modState(id).mode = 'floating';
        send(p.win.webContents, 'panel:mode', 'floating');
      }
      if (p.mod.type === 'preview') previewState(id).suppressed = false;
    }
    const [w, h] = p.win.getSize();
    const ny = config.bar.edge === 'top' ? Math.round(y) - 12 : Math.round(y) - h + 12;
    p.win.setBounds({ x: Math.round(x - w / 2), y: ny, width: w, height: h });
    if (!p.win.isVisible()) {
      p.win.showInactive();
      if (p.mod.type === 'preview') ensureThumb(id);
    }
    if (phase === 'end') {
      p.dragging = false;
      modState(id).bounds = p.win.getBounds();
      store.save();
      if (p.mod.type !== 'preview') p.win.focus();
      pushModuleState();
    }
  });

  ipcMain.on('panel:setMode', (e, { id, mode }) => setMode(id, mode));
  ipcMain.on('panel:hide', (e, id) => {
    const p = panels.get(id);
    if (!p) return;
    if (p.mod.type === 'preview') previewState(id).suppressed = true;
    p.win.hide();
  });

  ipcMain.on('preview:activate', (e, id) => {
    const pv = previews.get(id);
    if (pv && pv.target) win32.activate(pv.target);
  });

  ipcMain.on('media:state', (e, { id, playing }) => {
    const p = panels.get(id);
    if (p) p.playing = playing;
    pushModuleState();
  });
  ipcMain.on('media:toggle', (e, id) => {
    const p = panels.get(id);
    if (p) send(p.win.webContents, 'media:toggle');
  });

  ipcMain.on('settings:open', openSettings);
  ipcMain.handle('settings:get', () => ({
    config: readJson(configFile) || DEFAULT_CONFIG,
    defaults: { modules: DEFAULT_MODULES, config: DEFAULT_CONFIG },
    presets: WEB_PRESETS,
    autostart: app.getLoginItemSettings().openAtLogin,
    platform: process.platform,
    configFile,
    version: app.getVersion(),
  }));
  ipcMain.handle('settings:save', (e, next) => {
    saveSettings(next);
    return true;
  });
  ipcMain.on('settings:relaunch', relaunch);
  ipcMain.on('settings:openFile', () => shell.openPath(configFile));

  ipcMain.on('menu:module', (e, id) => {
    const mod = getModule(id);
    if (!mod) return;
    const p = panels.get(id);
    const floating = (p ? p.mode : modState(id).mode) === 'floating';
    const items = [
      floating
        ? { label: 'Fest til docken', click: () => setMode(id, 'docked') }
        : { label: 'Løsne til eget vindu (alltid øverst)', click: () => { setMode(id, 'floating'); showPanel(ensurePanel(id)); } },
    ];
    if (mod.type === 'web') {
      items.push({ label: 'Spill av / pause', click: () => p && send(p.win.webContents, 'media:toggle') });
      items.push({ label: 'Last inn på nytt', click: () => p && send(p.win.webContents, 'web:reload') });
    }
    if (mod.type === 'media') {
      items.push({ label: 'Spill av / pause', click: () => providers.get(id).action('toggle') });
      items.push({ label: 'Neste', click: () => providers.get(id).action('next') });
      items.push({ label: 'Forrige', click: () => providers.get(id).action('prev') });
    }
    if (mod.type === 'preview') {
      items.push({
        label: 'Vis automatisk når spillet ikke er i fokus',
        type: 'checkbox',
        checked: mod.autoShow !== false,
        click: (item) => { mod.autoShow = item.checked; },
      });
    }
    if (p) items.push({ label: 'Lukk', click: () => p.win.hide() });
    items.push({ type: 'separator' }, { label: 'Innstillinger …', click: openSettings });
    Menu.buildFromTemplate(items).popup({ window: dock });
  });

  ipcMain.on('menu:window', (e, hwnds) => {
    const list = Array.isArray(hwnds) ? hwnds : [hwnds];
    const items = [];
    if (list.length === 1) {
      items.push({ label: 'Aktiver', click: () => win32.activate(list[0]) }, { label: 'Minimer', click: () => win32.minimize(list[0]) });
    } else {
      for (const h of list) {
        const w = taskbar.windows.find((x) => x.hwnd === h);
        items.push({ label: (w && w.title ? w.title : String(h)).slice(0, 60), click: () => win32.activate(h) });
      }
    }
    items.push({ type: 'separator' }, {
      label: list.length > 1 ? `Lukk alle (${list.length})` : 'Lukk vindu',
      click: () => list.forEach((h) => win32.closeWindow(h)),
    });
    Menu.buildFromTemplate(items).popup({ window: dock });
  });

  ipcMain.on('menu:bar', () => {
    const login = app.getLoginItemSettings().openAtLogin;
    Menu.buildFromTemplate([
      { label: 'Innstillinger …', click: openSettings },
      { label: 'Last inn på nytt', click: relaunch },
      { type: 'separator' },
      {
        label: 'Skjul Windows-oppgavelinjen',
        type: 'checkbox',
        checked: !!config.bar.hideWindowsTaskbar,
        enabled: win32.available,
        click: (item) => {
          config.bar.hideWindowsTaskbar = item.checked;
          applyTaskbarVisibility();
        },
      },
      { label: 'Start med Windows', type: 'checkbox', checked: login, click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
      { label: 'Oppgavebehandling', enabled: win32.available, click: () => shell.openPath('taskmgr.exe') },
      { type: 'separator' },
      { label: 'Avslutt Zapdock', click: quit },
    ]).popup({ window: dock });
  });
}

// ---------------------------------------------------------------------------
// Livssyklus

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  stopProviders();
  winhelper.stop();
  for (const id of previews.keys()) releaseThumb(id);
  if (appbar) {
    try { win32.appbarRemove(appbar); } catch (_) { /* ignorer */ }
    appbar = null;
  }
  restoreTaskbar();
  globalShortcut.unregisterAll();
}

function quit() {
  quitting = true;
  cleanup();
  app.quit();
}

app.on('web-contents-created', (e, contents) => {
  if (contents.getType() !== 'webview') return;
  contents.setWindowOpenHandler(({ url }) => {
    try {
      const cur = new URL(contents.getURL());
      const next = new URL(url);
      const sameSite = cur.hostname.split('.').slice(-2).join('.') === next.hostname.split('.').slice(-2).join('.');
      if (sameSite) contents.loadURL(url);
      else shell.openExternal(url);
    } catch (_) { /* ugyldig url */ }
    return { action: 'deny' };
  });
});

app.whenReady().then(() => {
  const loaded = loadConfig(app.getPath('userData'));
  config = loaded.config;
  configFile = loaded.file;
  store = createStateStore(app.getPath('userData'));

  registerIpc();
  winhelper.start();
  applyTaskbarVisibility();
  createDock();
  startProviders();
  setInterval(tick, 500);

  screen.on('display-metrics-changed', positionDock);
  screen.on('display-added', positionDock);
  screen.on('display-removed', positionDock);

  // Nødbryter: vis/skjul Windows-oppgavelinjen.
  globalShortcut.register('Control+Alt+Shift+Z', () => {
    config.bar.hideWindowsTaskbar = !config.bar.hideWindowsTaskbar;
    applyTaskbarVisibility();
  });
});

app.on('second-instance', () => {
  if (dock) dock.showInactive();
  openSettings();
});
app.on('before-quit', () => {
  quitting = true;
  cleanup();
});
app.on('window-all-closed', () => { /* docken lever til Avslutt */ });

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, quit);
process.on('uncaughtException', (err) => {
  console.error('[zapdock] uventet feil:', err);
  try { restoreTaskbar(); } catch (_) { /* ignorer */ }
});
