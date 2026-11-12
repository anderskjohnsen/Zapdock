'use strict';
/* global zapdock, zdIcon, ZD */

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

let config = null;
let activeHwnd = 0;
let windows = [];
const iconCache = new Map();
const mods = new Map(); // id -> { mod, root, tile, widget, data }
const firstSeen = new Map(); // gruppe-nøkkel -> rekkefølge
let seq = 0;

async function iconFor(exe) {
  if (!exe) return null;
  if (!iconCache.has(exe)) iconCache.set(exe, zapdock.invoke('taskbar:icon', exe));
  return iconCache.get(exe);
}

// ---------------------------------------------------------------------------
// Start, festede, klokke, volum

function renderStatic() {
  const start = $('#start');
  start.innerHTML = `<span class="ico">${zdIcon('start')}</span>`;
  start.addEventListener('click', () => zapdock.send('shell:start'));

  const pinned = $('#pinned');
  config.pinned.forEach((item, idx) => {
    const b = el('button', 'tile', `<span class="ico">${zdIcon('app')}</span>`);
    b.title = item.name || item.path;
    iconFor(item.path).then((url) => {
      if (url) b.querySelector('.ico').innerHTML = `<img src="${url}" alt="">`;
    });
    b.addEventListener('click', () => zapdock.send('pinned:launch', idx));
    pinned.appendChild(b);
  });

  const settings = $('#settings');
  settings.innerHTML = `<span class="ico">${zdIcon('settings')}</span>`;
  settings.addEventListener('click', () => zapdock.send('settings:open'));

  $('#desktop').addEventListener('click', () => zapdock.send('shell:desktop'));
  $('#clock').addEventListener('click', () => zapdock.send('shell:notifications'));
  document.body.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.tile, .widget, .pill')) return;
    e.preventDefault();
    zapdock.send('menu:bar');
  });
  tickClock();
  setInterval(tickClock, 1000);
}

function tickClock() {
  const now = new Date();
  $('#time').textContent = now.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  $('#date').textContent = now.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  $('#clock').title = now.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

let audio = null;
let volTimer = null;
function renderVolume() {
  const b = $('#volume');
  if (!audio || audio.volume == null) {
    b.hidden = true;
    return;
  }
  b.hidden = false;
  const v = audio.volume;
  const icon = audio.muted || v === 0 ? 'vol0' : v < 0.5 ? 'vol1' : 'vol2';
  b.innerHTML = `<span class="ico">${zdIcon(icon)}</span><span class="vol-bar"><b style="height:${audio.muted ? 0 : Math.round(v * 100)}%"></b></span>`;
  b.title = `Volum ${Math.round(v * 100)} %${audio.muted ? ' (dempet)' : ''}\nScroll: juster · Klikk: demp · Høyreklikk: hurtiginnstillinger`;
}
function initVolume() {
  const b = $('#volume');
  b.addEventListener('click', () => zapdock.send('audio:mute'));
  b.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    zapdock.send('shell:quicksettings');
  });
  b.addEventListener('wheel', (e) => {
    if (!audio || audio.volume == null) return;
    e.preventDefault();
    const step = e.deltaY < 0 ? 0.02 : -0.02;
    audio = { ...audio, volume: Math.max(0, Math.min(1, Math.round((audio.volume + step) * 50) / 50)), muted: false };
    renderVolume();
    clearTimeout(volTimer);
    volTimer = setTimeout(() => zapdock.send('audio:set', audio.volume), 40);
  }, { passive: false });
  zapdock.on('audio', (a) => {
    audio = a;
    renderVolume();
  });
}

// ---------------------------------------------------------------------------
// Åpne vinduer (gruppert per program)

function groupKey(w) {
  return config.bar.groupWindows !== false && w.exe ? w.exe.toLowerCase() : `h${w.hwnd}`;
}

function renderWindows() {
  const root = $('#windows');
  const groups = new Map();
  windows.forEach((w, z) => {
    const k = groupKey(w);
    if (!groups.has(k)) groups.set(k, { key: k, exe: w.exe, items: [] });
    groups.get(k).items.push({ ...w, z });
  });
  for (const k of groups.keys()) if (!firstSeen.has(k)) firstSeen.set(k, seq++);
  for (const k of [...firstSeen.keys()]) if (!groups.has(k)) firstSeen.delete(k);
  const ordered = [...groups.values()].sort((a, b) => firstSeen.get(a.key) - firstSeen.get(b.key));

  const existing = new Map([...root.children].map((n) => [n.dataset.key, n]));
  ordered.forEach((g, i) => {
    let b = existing.get(g.key);
    if (!b) {
      b = el('button', 'tile win', `<span class="ico">${zdIcon('app')}</span>`);
      b.dataset.key = g.key;
      b.addEventListener('click', () => onGroupClick(b._group));
      b.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        zapdock.send('menu:window', b._group.items.map((x) => x.hwnd));
      });
      if (config.bar.showWindowTitles) b.appendChild(el('span', 'label'));
      iconFor(g.exe).then((url) => {
        if (url) b.querySelector('.ico').innerHTML = `<img src="${url}" alt="">`;
      });
    }
    b._group = g;
    const top = [...g.items].sort((a, c) => a.z - c.z)[0];
    b.title = g.items.map((x) => x.title).join('\n');
    const label = b.querySelector('.label');
    if (label) label.textContent = top.title;
    b.classList.toggle('multi', g.items.length > 1);
    b.classList.toggle('minimized', g.items.every((x) => x.minimized));
    b.classList.toggle('active', g.items.some((x) => x.hwnd === activeHwnd));
    if (root.children[i] !== b) root.insertBefore(b, root.children[i] || null);
  });
  for (const [k, n] of existing) if (!groups.has(k)) n.remove();
}

function onGroupClick(g) {
  const items = [...g.items].sort((a, b) => a.z - b.z);
  if (items.length === 1) {
    zapdock.send('taskbar:click', items[0].hwnd);
    return;
  }
  const activeIdx = items.findIndex((x) => x.hwnd === activeHwnd);
  if (activeIdx === -1) {
    zapdock.send('taskbar:click', items[0].hwnd);
    return;
  }
  // Bla gjennom vinduene i gruppen (eldste først i Z-rekkefølge).
  const next = items[items.length - 1];
  zapdock.send('taskbar:click', next.hwnd === activeHwnd ? items[0].hwnd : next.hwnd);
}

// ---------------------------------------------------------------------------
// Moduler + widgets

function renderModules() {
  const root = $('#modules');
  for (const mod of config.modules) {
    const wrap = el('div', 'mod');
    wrap.dataset.id = mod.id;
    wrap.dataset.icon = mod.icon || mod.type;
    const tile = el('button', 'tile mod-tile', `<span class="ico">${zdIcon(mod.icon || mod.type)}</span>`);
    tile.title = `${mod.title}\nKlikk: åpne · Dra opp: løsne til eget vindu${mod.type === 'web' ? ' · Midtklikk: spill av/pause' : ''}`;
    const widget = el('div', 'widget');
    wrap.append(tile, widget);
    root.appendChild(wrap);
    const entry = { mod, root: wrap, tile, widget, data: config.data[mod.id] || null };
    mods.set(mod.id, entry);
    attachModuleHandlers(entry);
    renderWidget(entry);
  }
}

function anchorOf(node) {
  const r = node.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
}

function attachModuleHandlers(entry) {
  const { mod, tile, root, widget } = entry;
  let drag = null;
  let suppressClick = false;
  const toggle = () => zapdock.send('module:toggle', { id: mod.id, anchor: anchorOf(root) });

  tile.addEventListener('click', () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    toggle();
  });
  widget.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    toggle();
  });
  tile.addEventListener('auxclick', (e) => {
    if (e.button !== 1) return;
    if (mod.type === 'web') zapdock.send('media:toggle', mod.id);
    if (mod.type === 'media') ZD.action(mod.id, 'toggle');
  });
  root.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    zapdock.send('menu:module', mod.id);
  });

  // Dra ikonet ut av docken -> modulen blir et eget "alltid øverst"-vindu som følger musa.
  tile.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    tile.setPointerCapture(e.pointerId);
    drag = { x: e.screenX, y: e.screenY, active: false, raf: 0, last: null };
  });
  tile.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const outside = e.clientY < 0 || e.clientY > window.innerHeight;
    if (!drag.active && outside && Math.hypot(e.screenX - drag.x, e.screenY - drag.y) > 24) {
      drag.active = true;
      tile.classList.add('dragging');
      zapdock.send('module:drag', { id: mod.id, phase: 'start', x: e.screenX, y: e.screenY });
    }
    if (drag.active) {
      drag.last = { x: e.screenX, y: e.screenY };
      if (!drag.raf) {
        drag.raf = requestAnimationFrame(() => {
          if (!drag) return;
          drag.raf = 0;
          zapdock.send('module:drag', { id: mod.id, phase: 'move', ...drag.last });
        });
      }
    }
  });
  const finish = (e) => {
    if (!drag) return;
    if (drag.active) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 300);
      zapdock.send('module:drag', { id: mod.id, phase: 'end', x: e.screenX, y: e.screenY });
    }
    tile.classList.remove('dragging');
    if (drag.raf) cancelAnimationFrame(drag.raf);
    drag = null;
  };
  tile.addEventListener('pointerup', finish);
  tile.addEventListener('pointercancel', finish);
}

function setBadge(tile, value, neutral = false) {
  let badge = tile.querySelector('.badge');
  if (value) {
    if (!badge) tile.appendChild((badge = el('span', 'badge')));
    badge.textContent = value;
    badge.classList.toggle('neutral', neutral);
  } else if (badge) badge.remove();
}

const WIDGETS = {
  claude(entry) {
    const d = entry.data;
    const { widget, tile, mod } = entry;
    tile.style.background = '';
    tile.style.boxShadow = '';
    if (!d) return void (widget.innerHTML = '');
    if (mod.widget === false) {
      setBadge(tile, d.needsAnswerCount || d.activeCount || null, !d.needsAnswerCount);
      return;
    }
    const max = (config.claude && config.claude.maxDockSessions) || 4;
    const darken = d.waitDarkenMinutes || 20;
    const now = Date.now();
    // Økter som venter på svar først (lengst ventetid først), deretter de som jobber.
    const list = d.sessions.filter((s) => s.needsAnswer || s.status === 'working')
      .sort((a, b) => (b.needsAnswer - a.needsAnswer) || ((a.waitingSince || 0) - (b.waitingSince || 0)));
    const shown = list.slice(0, max);
    const existing = new Map([...widget.querySelectorAll('.pill[data-sid]')].map((n) => [n.dataset.sid, n]));
    const keep = new Set();
    let darkest = null;
    shown.forEach((s, i) => {
      keep.add(s.id);
      let p = existing.get(s.id);
      if (!p) {
        p = el('button', 'pill', '<i class="pdot"></i><span></span>');
        p.dataset.sid = s.id;
        p.addEventListener('click', (e) => {
          e.stopPropagation();
          ZD.action(mod.id, 'focus', { id: s.id });
        });
      }
      p.querySelector('span').textContent = s.project;
      p.classList.toggle('needs', !!s.needsAnswer);
      p.classList.toggle('working', !s.needsAnswer);
      if (s.needsAnswer) {
        const waited = now - (s.waitingSince || now);
        const c = ZD.waitColor(waited, darken);
        p.classList.toggle('fresh', waited < 60000);
        p.style.background = c.css;
        p.style.color = c.text;
        if (!darkest || c.t > darkest.t) darkest = c;
        p.title = `${s.project} – ${ZD.STATUS[s.status]} i ${ZD.shortDur(waited)}${s.title ? `\n${s.title}` : ''}\nKlikk: gå til økten`;
      } else {
        p.classList.remove('fresh');
        p.style.background = '';
        p.style.color = '';
        p.title = `${s.project} – jobber${s.title ? `\n${s.title}` : ''}`;
      }
      if (widget.children[i] !== p) widget.insertBefore(p, widget.children[i] || null);
    });
    for (const [sid, n] of existing) if (!keep.has(sid)) n.remove();
    let more = widget.querySelector('.pill.more');
    if (list.length > shown.length) {
      if (!more) widget.appendChild((more = el('span', 'pill more')));
      more.textContent = `+${list.length - shown.length}`;
    } else if (more) more.remove();
    if (darkest) {
      tile.style.background = `rgba(${darkest.rgb.join(',')}, .28)`;
      tile.style.boxShadow = `inset 0 0 0 1px rgba(${darkest.rgb.join(',')}, .7)`;
    }
    setBadge(tile, !shown.length && d.activeCount ? d.activeCount : null, true);
  },

  media(entry) {
    const d = entry.data;
    const { widget, mod } = entry;
    if (!d || !d.active || mod.widget === false) return void (widget.innerHTML = '');
    const playing = d.status === 'Playing';
    widget.classList.add('clickable');
    widget.innerHTML = `${d.artwork ? `<img class="art" src="${d.artwork}" alt="">` : ''}
      <div class="w-two"><span class="a">${ZD.esc(d.title || 'Ukjent')}</span><span class="b">${ZD.esc(d.artist || '')}</span></div>
      <button class="mini-btn" data-a="prev" title="Forrige">${zdIcon('prev')}</button>
      <button class="mini-btn" data-a="toggle" title="${playing ? 'Pause' : 'Spill av'}">${zdIcon(playing ? 'pause' : 'play')}</button>
      <button class="mini-btn" data-a="next" title="Neste">${zdIcon('next')}</button>`;
    widget.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      ZD.action(mod.id, b.dataset.a);
    }));
  },

  weather(entry) {
    const d = entry.data;
    const { widget, mod } = entry;
    if (!d || !d.now || mod.widget === false) return void (widget.innerHTML = '');
    widget.classList.add('clickable');
    widget.innerHTML = `<span style="font-size:17px">${ZD.weatherEmoji(d.now.symbol)}</span><span class="w-text" style="font-weight:600">${ZD.temp(d.now.temp)}</span>`;
    widget.title = `${d.name}: ${ZD.temp(d.now.temp)}, ${d.now.wind ?? '–'} m/s, ${d.now.precip} mm neste time`;
  },

  calendar(entry) {
    const d = entry.data;
    const { widget, mod } = entry;
    if (!d || !d.events || mod.widget === false) return void (widget.innerHTML = '');
    const now = Date.now();
    const next = d.events.find((e) => !e.allDay && e.end > now && e.start - now < 12 * 3600000);
    if (!next) return void (widget.innerHTML = '');
    widget.classList.add('clickable');
    const ongoing = next.start <= now;
    const when = ongoing ? 'nå' : next.start - now < 3600000 ? `om ${Math.ceil((next.start - now) / 60000)} min` : ZD.clock(next.start);
    widget.innerHTML = `<div class="w-two"><span class="a" style="max-width:150px">${ZD.esc(next.summary)}</span><span class="b">${when}${next.location ? ` · ${ZD.esc(next.location)}` : ''}</span></div>`;
  },

  timer(entry) {
    const d = entry.data;
    const { widget, tile, mod } = entry;
    if (!d || mod.widget === false) return void (widget.innerHTML = '');
    const done = d.timers.filter((t) => t.done);
    const running = d.timers.filter((t) => !t.done && !t.paused).sort((a, b) => a.endsAt - b.endsAt);
    if (done.length) {
      widget.classList.add('clickable');
      widget.innerHTML = `<span class="timer-done">⏰ ${ZD.esc(done[0].label || 'Ferdig!')}</span>`;
    } else if (running.length) {
      widget.classList.add('clickable');
      const t = running[0];
      widget.innerHTML = `<span class="w-text" style="font-variant-numeric:tabular-nums;font-weight:600">${ZD.countdown(t.endsAt - Date.now())}</span>${t.label ? `<span class="w-muted w-text" style="max-width:90px">${ZD.esc(t.label)}</span>` : ''}`;
    } else widget.innerHTML = '';
    setBadge(tile, running.length > 1 ? running.length : null, true);
  },

  system(entry) {
    const d = entry.data;
    const { widget, mod } = entry;
    if (!d || mod.widget === false) return void (widget.innerHTML = '');
    const ram = Math.round((d.mem.used / d.mem.total) * 100);
    widget.classList.add('clickable');
    widget.innerHTML = `<div class="meter"><i><b style="width:${d.cpu}%"></b></i><i class="ram"><b style="width:${ram}%"></b></i></div><span class="meter-txt">${d.cpu}%</span>`;
    widget.title = `CPU ${d.cpu} % · Minne ${ram} % (${ZD.fmtBytes(d.mem.used)} av ${ZD.fmtBytes(d.mem.total)})`;
  },

  notes(entry) {
    const d = entry.data;
    setBadge(entry.tile, d && d.open ? d.open : null, true);
  },
};

function renderWidget(entry) {
  const fn = WIDGETS[entry.mod.type];
  if (fn) fn(entry);
}

function applyModuleState(state) {
  for (const [id, s] of Object.entries(state)) {
    const m = mods.get(id);
    if (!m) continue;
    m.root.classList.toggle('open', s.visible && s.mode === 'docked');
    m.root.classList.toggle('floating', s.mode === 'floating' && s.visible);
    if ('running' in s) m.root.classList.toggle('dim', !s.running);
    let dot = m.tile.querySelector('.playing-dot');
    if (s.playing && !dot) m.tile.appendChild(el('span', 'playing-dot'));
    else if (!s.playing && dot) dot.remove();
  }
}

// ---------------------------------------------------------------------------
// Oppstart

(async () => {
  config = await zapdock.invoke('config:get');
  document.body.dataset.platform = config.platform;
  document.body.classList.toggle('edge-top', config.bar.edge === 'top');
  renderStatic();
  initVolume();
  audio = config.audio;
  renderVolume();
  renderModules();
  zapdock.on('taskbar:windows', (list) => {
    windows = list;
    renderWindows();
  });
  zapdock.on('taskbar:active', (h) => {
    activeHwnd = h;
    renderWindows();
  });
  zapdock.on('modules:state', applyModuleState);
  zapdock.on('module:data', ({ id, data }) => {
    const m = mods.get(id);
    if (!m) return;
    m.data = data;
    if (m.mod.type !== 'timer') renderWidget(m); // timer tegnes hvert sekund uansett
  });
  // Fargeforløp (Claude), nedtellinger og "om X min" oppdateres jevnlig.
  setInterval(() => {
    for (const m of mods.values()) if (m.mod.type === 'claude' || m.mod.type === 'timer') renderWidget(m);
  }, 1000);
  setInterval(() => {
    for (const m of mods.values()) if (m.mod.type === 'calendar') renderWidget(m);
  }, 30000);
})();
