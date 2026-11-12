'use strict';
const fs = require('fs');
const path = require('path');

const CONFIG_VERSION = 2;

const DEFAULT_MODULES = [
  { id: 'claude', type: 'claude', title: 'Claude Code', icon: 'claude', enabled: true, widget: true },
  { id: 'media', type: 'media', title: 'Spotify', icon: 'spotify', enabled: true, widget: true, preferApp: 'Spotify' },
  { id: 'youtube', type: 'web', title: 'YouTube', icon: 'youtube', enabled: true, url: 'https://www.youtube.com', size: [960, 600] },
  { id: 'stremio', type: 'web', title: 'Stremio', icon: 'stremio', enabled: true, url: 'https://web.stremio.com', size: [1000, 620] },
  {
    id: 'wow',
    type: 'preview',
    title: 'World of Warcraft',
    icon: 'wow',
    enabled: true,
    // Exe-navn (små bokstaver) eller vindustittel som identifiserer spillet.
    match: ['wow.exe', 'wowclassic.exe', 'wow-64.exe', 'wowt.exe', 'wowb.exe'],
    titleMatch: 'World of Warcraft',
    autoShow: true,
    size: [400, 247],
  },
  { id: 'calendar', type: 'calendar', title: 'Kalender', icon: 'calendar', enabled: true, widget: true },
  { id: 'weather', type: 'weather', title: 'Vær', icon: 'weather', enabled: true, widget: true },
  { id: 'timer', type: 'timer', title: 'Timer', icon: 'timer', enabled: true, widget: true },
  { id: 'notes', type: 'notes', title: 'Notater', icon: 'notes', enabled: true },
  { id: 'clipboard', type: 'clipboard', title: 'Utklippstavle', icon: 'clipboard', enabled: true },
  { id: 'system', type: 'system', title: 'System', icon: 'system', enabled: true, widget: true },
];

const DEFAULT_CONFIG = {
  version: CONFIG_VERSION,
  bar: {
    height: 48,
    edge: 'bottom', // 'bottom' | 'top'
    hideWindowsTaskbar: true,
    showWindowTitles: false,
    groupWindows: true,
  },
  // Festede programmer: { "name": "Steam", "path": "C:\\Program Files (x86)\\Steam\\steam.exe" }
  pinned: [],
  modules: DEFAULT_MODULES,
  claude: {
    // Ekstra mapper med Claude Code-data, f.eks. fra WSL: "\\\\wsl$\\Ubuntu\\home\\anders\\.claude"
    dirs: [],
    blockTokenLimit: 0, // tak for 5-timersblokk (tokens) for fremdriftslinje; 0 = av
    activeMinutes: 15, // hvor lenge en økt vises etter siste aktivitet
    waitingVisibleHours: 4, // hvor lenge en økt som venter på svar fortsatt vises
    waitDarkenMinutes: 20, // hvor lang tid fargen bruker på å gå fra lys til mørk
    permissionSeconds: 30, // verktøykall uten resultat så lenge = venter trolig på tillatelse
    refreshSeconds: 5,
    notify: true,
    maxDockSessions: 4,
  },
  weather: { name: 'Avaldsnes', lat: 59.3503, lon: 5.2759 },
  calendar: {
    // { "name": "Familie", "url": "https://calendar.google.com/calendar/ical/.../basic.ics", "color": "#46d19a" }
    sources: [],
    days: 14,
    reminderMinutes: 15,
  },
};

// Ferdige web-moduler som kan legges til fra innstillingene.
const WEB_PRESETS = [
  { title: 'YouTube', icon: 'youtube', url: 'https://www.youtube.com' },
  { title: 'YouTube Music', icon: 'music', url: 'https://music.youtube.com' },
  { title: 'Stremio', icon: 'stremio', url: 'https://web.stremio.com' },
  { title: 'Twitch', icon: 'twitch', url: 'https://www.twitch.tv' },
  { title: 'Discord', icon: 'discord', url: 'https://discord.com/app' },
  { title: 'Claude', icon: 'claude', url: 'https://claude.ai' },
  { title: 'ChatGPT', icon: 'chat', url: 'https://chatgpt.com' },
  { title: 'Gmail', icon: 'mail', url: 'https://mail.google.com' },
  { title: 'Google Kalender', icon: 'calendar', url: 'https://calendar.google.com' },
  { title: 'Spond', icon: 'web', url: 'https://spond.com/client' },
  { title: 'Wowhead', icon: 'wow', url: 'https://www.wowhead.com' },
  { title: 'Raider.IO', icon: 'wow', url: 'https://raider.io' },
];

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, over) {
  if (!isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = isObj(v) && isObj(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`[zapdock] Kunne ikke lese ${file}:`, err.message);
    return null;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function loadConfig(dir) {
  const file = path.join(dir, 'config.json');
  let user = readJson(file);
  if (!user) {
    user = DEFAULT_CONFIG;
    writeJson(file, user);
  } else if ((user.version || 1) < CONFIG_VERSION) {
    user = migrate(user);
    writeJson(file, user);
  }
  const cfg = deepMerge(DEFAULT_CONFIG, user);
  cfg.modules = (cfg.modules || []).filter((m) => m && m.id && m.type);
  return { file, config: cfg };
}

/** v1 -> v2: legg til nye standardmoduler som mangler, behold brukerens egne. */
function migrate(user) {
  const out = { ...user, version: CONFIG_VERSION };
  const mods = Array.isArray(user.modules) ? [...user.modules] : [];
  for (const def of DEFAULT_MODULES) {
    const existing = mods.find((m) => m.id === def.id);
    if (!existing) mods.push(def);
    else if (existing.enabled === undefined) existing.enabled = true;
  }
  out.modules = mods;
  return out;
}

function createStateStore(dir) {
  const file = path.join(dir, 'state.json');
  const data = deepMerge({ modules: {}, taskbar: { hiddenByZapdock: false, prevState: null } }, readJson(file) || {});
  let timer = null;
  return {
    data,
    save(immediate = false) {
      clearTimeout(timer);
      if (immediate) return writeJson(file, data);
      timer = setTimeout(() => writeJson(file, data), 400);
    },
  };
}

module.exports = { DEFAULT_CONFIG, DEFAULT_MODULES, WEB_PRESETS, CONFIG_VERSION, deepMerge, loadConfig, createStateStore, writeJson, readJson };
