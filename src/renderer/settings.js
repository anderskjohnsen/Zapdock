'use strict';
/* global zapdock, zdIcon, ZD */

const WIDGET_TYPES = new Set(['claude', 'media', 'weather', 'calendar', 'timer', 'system']);
const TYPE_NAMES = {
  claude: 'Claude Code-økter og bruk', media: 'Spilles nå + volum', web: 'Innebygd nettside', preview: 'Live forhåndsvisning av spill/vindu',
  calendar: 'Kalender (iCal)', weather: 'Vær (yr.no)', timer: 'Timere', notes: 'Notater og huskeliste', clipboard: 'Utklippstavle-historikk', system: 'Systemmonitor',
};
const PLACES = [
  ['Avaldsnes', 59.3503, 5.2759], ['Kopervik', 59.2833, 5.3069], ['Haugesund', 59.4138, 5.268], ['Stavanger', 58.97, 5.7331],
  ['Bergen', 60.3913, 5.3221], ['Oslo', 59.9139, 10.7522], ['Trondheim', 63.4305, 10.3951],
];

let S = null; // svar fra settings:get
let cfg = null; // konfig som redigeres
let autostart = false;
let dirty = false;

const $ = (s) => document.querySelector(s);
const esc = ZD.esc;
const markDirty = () => {
  dirty = true;
  $('#dirty').textContent = 'Ulagrede endringer';
};

function field(label, hint, control) {
  return `<div class="field"><label><b>${label}</b>${hint ? `<span>${hint}</span>` : ''}</label><div>${control}</div></div>`;
}
const sw = (key, checked) => `<label class="switch"><input type="checkbox" data-k="${key}" ${checked ? 'checked' : ''}><i></i></label>`;
const num = (key, v, min, max, step = 1) => `<input type="number" data-k="${key}" value="${v ?? ''}" min="${min}" max="${max}" step="${step}">`;
const txt = (key, v, ph = '') => `<input type="text" data-k="${key}" value="${esc(v ?? '')}" placeholder="${esc(ph)}">`;

function get(path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), cfg);
}
function set(path, value) {
  const keys = path.split('.');
  let o = cfg;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys[keys.length - 1]] = value;
}

function render() {
  const c = cfg;
  const m = $('#main');
  m.innerHTML = `
  <section id="general">
    <h2>Generelt</h2><p class="lead">Utseende og oppførsel for docken.</p>
    ${field('Skjul Windows-oppgavelinjen', 'Zapdock erstatter den. Nødbryter: Ctrl+Alt+Shift+Z', sw('bar.hideWindowsTaskbar', c.bar.hideWindowsTaskbar))}
    ${field('Plassering', '', `<select data-k="bar.edge"><option value="bottom" ${c.bar.edge !== 'top' ? 'selected' : ''}>Nederst</option><option value="top" ${c.bar.edge === 'top' ? 'selected' : ''}>Øverst</option></select>`)}
    ${field('Høyde', 'Piksler (36–72)', num('bar.height', c.bar.height, 36, 72))}
    ${field('Grupper vinduer per program', 'Som Windows: ett ikon per program', sw('bar.groupWindows', c.bar.groupWindows !== false))}
    ${field('Vis vindustitler', 'Tekst ved siden av ikonene', sw('bar.showWindowTitles', c.bar.showWindowTitles))}
    ${field('Start med Windows', '', `<label class="switch"><input type="checkbox" id="autostart" ${autostart ? 'checked' : ''}><i></i></label>`)}
  </section>

  <section id="modules">
    <h2>Moduler</h2><p class="lead">Slå av/på, sorter og gi nytt navn. «Widget» viser info direkte i docken. Alle moduler kan dras ut av docken til egne vinduer som alltid ligger øverst.</p>
    <div class="mods">${c.modules.map(moduleRow).join('')}</div>
    <div class="add-row">
      <select id="preset"><option value="">Legg til nettside …</option>${S.presets.map((p, i) => `<option value="${i}">${esc(p.title)}</option>`).join('')}</select>
      <button class="small" id="add-preset">Legg til</button>
    </div>
    <div class="add-row">
      <input type="text" id="custom-title" placeholder="Navn (f.eks. Visma Flyt)">
      <input type="url" id="custom-url" placeholder="https://…">
      <button class="small" id="add-custom">Legg til egen nettside</button>
    </div>
    <div class="add-row">
      <input type="text" id="game-title" placeholder="Spill (f.eks. Diablo IV)">
      <input type="text" id="game-exe" placeholder="exe-navn (f.eks. diablo iv.exe)">
      <button class="small" id="add-game">Legg til live forhåndsvisning</button>
    </div>
    <p class="muted">Spotify i nettleser støttes ikke (krever DRM). Spotify-modulen styrer i stedet Spotify-appen og viser hva som spilles.</p>
  </section>

  <section id="claude">
    <h2>Claude Code</h2><p class="lead">Leser Claude Code sine lokale logger (ingen innlogging). Økter som venter på svar får en farge som gradvis blir mørkere jo lenger de venter.</p>
    ${field('Varsle når en økt trenger svar', 'Windows-varsel når Claude er ferdig eller venter på tillatelse', sw('claude.notify', c.claude.notify !== false))}
    ${field('Fargeforløp', 'Minutter fra lys gul til mørk rød', num('claude.waitDarkenMinutes', c.claude.waitDarkenMinutes, 1, 240))}
    ${field('Antall økter i docken', '', num('claude.maxDockSessions', c.claude.maxDockSessions, 0, 10))}
    ${field('Tillatelse-terskel', 'Sekunder et verktøykall kan stå uten resultat før økten regnes som «venter på tillatelse»', num('claude.permissionSeconds', c.claude.permissionSeconds, 5, 600))}
    ${field('Vis aktive økter i', 'Minutter etter siste aktivitet', num('claude.activeMinutes', c.claude.activeMinutes, 1, 240))}
    ${field('Vis ventende økter i', 'Timer', num('claude.waitingVisibleHours', c.claude.waitingVisibleHours, 1, 48))}
    ${field('Tak for 5-timersblokk', 'Tokens, for fremdriftslinje (0 = av)', num('claude.blockTokenLimit', c.claude.blockTokenLimit, 0, 1e10, 1000))}
    ${field('Ekstra mapper', 'Én per linje, f.eks. WSL: <code>\\\\wsl$\\Ubuntu\\home\\anders\\.claude</code>', `<textarea data-k="claude.dirs" data-lines>${esc((c.claude.dirs || []).join('\n'))}</textarea>`)}
  </section>

  <section id="media">
    <h2>Spotify / media</h2><p class="lead">Viser hva som spilles i Spotify (eller andre spillere som støtter Windows sine mediekontroller), med kontroller og volum.</p>
    ${field('Foretrukket app', 'Vises først når flere spiller', `<select id="prefer">${['Spotify', 'Chrome', 'msedge', 'Firefox', 'VLC', 'Tidal', 'iTunes'].map((a) => `<option ${mediaMod() && (mediaMod().preferApp || 'Spotify') === a ? 'selected' : ''}>${a}</option>`).join('')}</select>`)}
  </section>

  <section id="calendar">
    <h2>Kalender</h2><p class="lead">Viser avtaler i docken og varsler før de starter.</p>
    <div class="hint"><b>Google Kalender:</b><ol><li>calendar.google.com på PC → ⚙ Innstillinger</li><li>Velg kalenderen under «Innstillinger for mine kalendere»</li><li>Kopier <b>«Hemmelig adresse i iCal-format»</b> og lim inn under</li></ol>Fungerer også med Outlook/iCloud (publisert .ics-lenke).</div>
    <div id="cal-list">${(c.calendar.sources || []).map(calRow).join('')}</div>
    <button class="small" id="add-cal">+ Legg til kalender</button>
    ${field('Påminnelse', 'Minutter før start (0 = av)', num('calendar.reminderMinutes', c.calendar.reminderMinutes, 0, 1440))}
    ${field('Vis dager fremover', '', num('calendar.days', c.calendar.days, 1, 60))}
  </section>

  <section id="weather">
    <h2>Vær</h2><p class="lead">Værvarsel fra MET Norway (yr.no).</p>
    ${field('Hurtigvalg', '', `<select id="place"><option value="">Velg sted …</option>${PLACES.map((p, i) => `<option value="${i}">${p[0]}</option>`).join('')}</select>`)}
    ${field('Stedsnavn', '', txt('weather.name', c.weather.name))}
    ${field('Breddegrad', '', num('weather.lat', c.weather.lat, -90, 90, 0.0001))}
    ${field('Lengdegrad', '', num('weather.lon', c.weather.lon, -180, 180, 0.0001))}
  </section>

  <section id="pinned">
    <h2>Festede programmer</h2><p class="lead">Snarveier til venstre i docken.</p>
    <div id="pin-list">${(c.pinned || []).map(pinRow).join('')}</div>
    <button class="small" id="add-pin">+ Legg til program</button>
  </section>`;
  bind();
}

function mediaMod() {
  return cfg.modules.find((x) => x.type === 'media');
}

function moduleRow(mod, i) {
  const removable = !S.defaults.modules.some((d) => d.id === mod.id);
  return `<div class="mrow ${mod.enabled === false ? 'off' : ''}" data-i="${i}">
    <span class="mm"><button class="icon-btn" data-up="${i}" title="Flytt opp">${zdIcon('up')}</button></span>
    <span class="mm"><button class="icon-btn" data-down="${i}" title="Flytt ned">${zdIcon('down')}</button></span>
    <span class="mi">${zdIcon(mod.icon || mod.type)}</span>
    <div class="mt"><input type="text" data-mod="${i}" data-f="title" value="${esc(mod.title)}">
      ${mod.type === 'web' ? `<input type="url" data-mod="${i}" data-f="url" value="${esc(mod.url || '')}">` : ''}
      ${mod.type === 'preview' ? `<input type="text" data-mod="${i}" data-f="match" value="${esc((mod.match || []).join(', '))}" title="Exe-navn, kommaseparert">` : ''}
      <span class="type">${TYPE_NAMES[mod.type] || mod.type}</span></div>
    <span class="opt">${WIDGET_TYPES.has(mod.type) ? `Widget <label class="switch"><input type="checkbox" data-mod="${i}" data-f="widget" ${mod.widget !== false ? 'checked' : ''}><i></i></label>` : ''}</span>
    <span class="opt">På <label class="switch"><input type="checkbox" data-mod="${i}" data-f="enabled" ${mod.enabled !== false ? 'checked' : ''}><i></i></label></span>
    <span>${removable ? `<button class="icon-btn danger" data-rm="${i}" title="Fjern">${zdIcon('trash')}</button>` : ''}</span>
  </div>`;
}
const calRow = (s, i) => `<div class="list-row" data-cal="${i}">
  <input type="text" data-calf="name" value="${esc(s.name || '')}" placeholder="Navn (Familie)">
  <input type="url" data-calf="url" value="${esc(s.url || '')}" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics">
  <input type="color" data-calf="color" value="${esc(s.color || '#7c9cff')}">
  <button class="icon-btn danger" data-calrm="${i}" title="Fjern">${zdIcon('trash')}</button></div>`;
const pinRow = (p, i) => `<div class="list-row pin" data-pin="${i}">
  <input type="text" data-pinf="name" value="${esc(p.name || '')}" placeholder="Navn">
  <input type="text" data-pinf="path" value="${esc(p.path || '')}" placeholder="C:\\Program Files\\…\\program.exe">
  <button class="icon-btn danger" data-pinrm="${i}" title="Fjern">${zdIcon('trash')}</button></div>`;

function slug(t) {
  const base = t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'modul';
  let id = base;
  let n = 2;
  while (cfg.modules.some((m) => m.id === id)) id = `${base}-${n++}`;
  return id;
}

function bind() {
  const m = $('#main');
  m.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('change', () => {
    let v;
    if (inp.type === 'checkbox') v = inp.checked;
    else if (inp.type === 'number') v = inp.value === '' ? 0 : Number(inp.value);
    else if (inp.hasAttribute('data-lines')) v = inp.value.split('\n').map((x) => x.trim()).filter(Boolean);
    else v = inp.value;
    set(inp.dataset.k, v);
    markDirty();
  }));
  $('#autostart').addEventListener('change', (e) => { autostart = e.target.checked; markDirty(); });

  m.querySelectorAll('[data-mod]').forEach((inp) => inp.addEventListener('change', () => {
    const mod = cfg.modules[Number(inp.dataset.mod)];
    const f = inp.dataset.f;
    if (inp.type === 'checkbox') mod[f] = inp.checked;
    else if (f === 'match') mod.match = inp.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    else mod[f] = inp.value;
    markDirty();
    if (f === 'enabled') inp.closest('.mrow').classList.toggle('off', !inp.checked);
  }));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= cfg.modules.length) return;
    [cfg.modules[i], cfg.modules[j]] = [cfg.modules[j], cfg.modules[i]];
    markDirty();
    render();
    location.hash = '#modules';
  };
  m.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => move(Number(b.dataset.up), -1)));
  m.querySelectorAll('[data-down]').forEach((b) => b.addEventListener('click', () => move(Number(b.dataset.down), 1)));
  m.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
    cfg.modules.splice(Number(b.dataset.rm), 1);
    markDirty();
    render();
  }));
  $('#add-preset').addEventListener('click', () => {
    const p = S.presets[Number($('#preset').value)];
    if (!$('#preset').value || !p) return;
    cfg.modules.push({ id: slug(p.title), type: 'web', title: p.title, icon: p.icon, url: p.url, enabled: true });
    markDirty();
    render();
  });
  $('#add-custom').addEventListener('click', () => {
    const title = $('#custom-title').value.trim();
    let url = $('#custom-url').value.trim();
    if (!title || !url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    cfg.modules.push({ id: slug(title), type: 'web', title, icon: 'web', url, enabled: true });
    markDirty();
    render();
  });
  $('#add-game').addEventListener('click', () => {
    const title = $('#game-title').value.trim();
    const exe = $('#game-exe').value.trim().toLowerCase();
    if (!title || !exe) return;
    cfg.modules.push({ id: slug(title), type: 'preview', title, icon: 'wow', match: exe.split(',').map((x) => x.trim()), autoShow: true, enabled: true });
    markDirty();
    render();
  });

  $('#prefer').addEventListener('change', (e) => {
    const mm = mediaMod();
    if (mm) {
      mm.preferApp = e.target.value;
      markDirty();
    }
  });

  m.querySelectorAll('[data-cal] input').forEach((inp) => inp.addEventListener('change', () => {
    const i = Number(inp.closest('[data-cal]').dataset.cal);
    cfg.calendar.sources[i][inp.dataset.calf] = inp.value.trim();
    markDirty();
  }));
  m.querySelectorAll('[data-calrm]').forEach((b) => b.addEventListener('click', () => {
    cfg.calendar.sources.splice(Number(b.dataset.calrm), 1);
    markDirty();
    render();
    location.hash = '#calendar';
  }));
  $('#add-cal').addEventListener('click', () => {
    cfg.calendar.sources = cfg.calendar.sources || [];
    cfg.calendar.sources.push({ name: cfg.calendar.sources.length ? '' : 'Familie', url: '', color: ['#46d19a', '#7c9cff', '#f2b84b', '#ff6b6b'][cfg.calendar.sources.length % 4] });
    markDirty();
    render();
    location.hash = '#calendar';
  });

  $('#place').addEventListener('change', (e) => {
    const p = PLACES[Number(e.target.value)];
    if (!e.target.value || !p) return;
    cfg.weather = { ...cfg.weather, name: p[0], lat: p[1], lon: p[2] };
    markDirty();
    render();
    location.hash = '#weather';
  });

  m.querySelectorAll('[data-pin] input').forEach((inp) => inp.addEventListener('change', () => {
    const i = Number(inp.closest('[data-pin]').dataset.pin);
    cfg.pinned[i][inp.dataset.pinf] = inp.value.trim();
    markDirty();
  }));
  m.querySelectorAll('[data-pinrm]').forEach((b) => b.addEventListener('click', () => {
    cfg.pinned.splice(Number(b.dataset.pinrm), 1);
    markDirty();
    render();
    location.hash = '#pinned';
  }));
  $('#add-pin').addEventListener('click', () => {
    cfg.pinned = cfg.pinned || [];
    cfg.pinned.push({ name: '', path: '' });
    markDirty();
    render();
    location.hash = '#pinned';
  });
}

function fillDefaults(c, d) {
  for (const [k, v] of Object.entries(d)) {
    if (k === 'modules' || k === 'pinned') continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) c[k] = fillDefaults(c[k] && typeof c[k] === 'object' ? c[k] : {}, v);
    else if (c[k] === undefined) c[k] = Array.isArray(v) ? [...v] : v;
  }
  return c;
}

(async () => {
  S = await zapdock.invoke('settings:get');
  cfg = fillDefaults(JSON.parse(JSON.stringify(S.config)), S.defaults.config);
  cfg.modules = cfg.modules || JSON.parse(JSON.stringify(S.defaults.modules));
  cfg.pinned = cfg.pinned || [];
  autostart = S.autostart;
  $('#version').textContent = `Versjon ${S.version}`;
  render();

  // Marker aktiv seksjon i menyen.
  const main = $('#main');
  main.addEventListener('scroll', () => {
    let current = 'general';
    for (const sec of main.querySelectorAll('section')) if (sec.offsetTop - 80 <= main.scrollTop) current = sec.id;
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${current}`));
  });

  $('#open-file').addEventListener('click', () => zapdock.send('settings:openFile'));
  $('#save').addEventListener('click', async () => {
    // Valider kalender-URLer og fjern tomme rader.
    cfg.calendar.sources = (cfg.calendar.sources || []).filter((s) => s.url);
    cfg.pinned = (cfg.pinned || []).filter((p) => p.path);
    await zapdock.invoke('settings:save', { ...cfg, autostart });
    dirty = false;
    $('#dirty').textContent = 'Lagret – starter på nytt …';
    setTimeout(() => zapdock.send('settings:relaunch'), 300);
  });
})();
