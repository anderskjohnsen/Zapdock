'use strict';
const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  bar: {
    height: 48,
    edge: 'bottom', // 'bottom' | 'top'
    hideWindowsTaskbar: true,
    showWindowTitles: false,
  },
  // Festede programmer: { "name": "Steam", "path": "C:\\Program Files (x86)\\Steam\\steam.exe" }
  pinned: [],
  modules: [
    { id: 'claude', type: 'claude', title: 'Claude Code', icon: 'claude' },
    { id: 'youtube', type: 'web', title: 'YouTube', icon: 'youtube', url: 'https://www.youtube.com', size: [960, 600] },
    { id: 'stremio', type: 'web', title: 'Stremio', icon: 'stremio', url: 'https://web.stremio.com', size: [1000, 620] },
    {
      id: 'wow',
      type: 'preview',
      title: 'World of Warcraft',
      icon: 'wow',
      // Exe-navn (små bokstaver) eller vindustittel som identifiserer spillet.
      match: ['wow.exe', 'wowclassic.exe', 'wow-64.exe', 'wowt.exe', 'wowb.exe'],
      titleMatch: 'World of Warcraft',
      autoShow: true,
      size: [400, 243],
    },
  ],
  claude: {
    // Ekstra mapper med Claude Code-data, f.eks. fra WSL:
    // "\\\\wsl$\\Ubuntu\\home\\anders\\.claude"
    dirs: [],
    // Valgfritt tak for 5-timersblokk (tokens) for å vise fremdriftslinje. 0 = av.
    blockTokenLimit: 0,
    activeMinutes: 15,
    refreshSeconds: 10,
  },
};

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
  const user = readJson(file);
  if (!user) writeJson(file, DEFAULT_CONFIG);
  const cfg = deepMerge(DEFAULT_CONFIG, user || {});
  return { file, config: cfg };
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

module.exports = { DEFAULT_CONFIG, deepMerge, loadConfig, createStateStore };
