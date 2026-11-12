'use strict';
/* global zapdock, zdIcon */

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
const moduleButtons = new Map();

async function iconFor(exe) {
  if (!exe) return null;
  if (!iconCache.has(exe)) iconCache.set(exe, zapdock.invoke('taskbar:icon', exe));
  return iconCache.get(exe);
}

// ----- Start, festede, klokke -----

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

  $('#desktop').addEventListener('click', () => zapdock.send('shell:desktop'));
  $('#clock').addEventListener('click', () => zapdock.send('shell:notifications'));
  document.body.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.tile')) return;
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

// ----- Åpne vinduer -----

function renderWindows() {
  const root = $('#windows');
  const existing = new Map([...root.children].map((n) => [Number(n.dataset.hwnd), n]));
  const seen = new Set();
  windows.forEach((w) => {
    seen.add(w.hwnd);
    let b = existing.get(w.hwnd);
    if (!b) {
      b = el('button', 'tile win', `<span class="ico">${zdIcon('app')}</span>`);
      b.dataset.hwnd = w.hwnd;
      b.addEventListener('click', () => zapdock.send('taskbar:click', w.hwnd));
      b.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        zapdock.send('menu:window', w.hwnd);
      });
      if (config.bar.showWindowTitles) b.appendChild(el('span', 'label'));
      iconFor(w.exe).then((url) => {
        if (url) b.querySelector('.ico').innerHTML = `<img src="${url}" alt="">`;
      });
    }
    b.title = w.title;
    const label = b.querySelector('.label');
    if (label) label.textContent = w.title;
    b.classList.toggle('minimized', !!w.minimized);
    b.classList.toggle('active', w.hwnd === activeHwnd);
    // Bevar rekkefølgen etter når vinduet dukket opp (som Windows), ikke Z-orden.
    if (!b.isConnected) root.appendChild(b);
  });
  for (const [h, n] of existing) if (!seen.has(h)) n.remove();
}

// ----- Moduler -----

function renderModules() {
  const root = $('#modules');
  for (const mod of config.modules) {
    const b = el('button', 'tile mod', `<span class="ico">${zdIcon(mod.icon || mod.type)}</span>`);
    b.dataset.id = mod.id;
    b.dataset.icon = mod.icon || mod.type;
    b.title = `${mod.title}\nKlikk: åpne · Dra opp: løsne til eget vindu${mod.type === 'web' ? ' · Midtklikk: spill av/pause' : ''}`;
    attachModuleHandlers(b, mod);
    root.appendChild(b);
    moduleButtons.set(mod.id, b);
  }
}

function anchorOf(b) {
  const r = b.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
}

function attachModuleHandlers(b, mod) {
  let drag = null;
  let suppressClick = false;

  b.addEventListener('click', () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    zapdock.send('module:toggle', { id: mod.id, anchor: anchorOf(b) });
  });
  b.addEventListener('auxclick', (e) => {
    if (e.button === 1 && mod.type === 'web') zapdock.send('media:toggle', mod.id);
  });
  b.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    zapdock.send('menu:module', mod.id);
  });

  // Dra ikonet ut av docken -> modulen blir et eget "alltid øverst"-vindu som følger musa.
  b.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    b.setPointerCapture(e.pointerId);
    drag = { x: e.screenX, y: e.screenY, active: false, raf: 0, last: null };
  });
  b.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const outside = e.clientY < 0 || e.clientY > window.innerHeight;
    if (!drag.active && outside && Math.hypot(e.screenX - drag.x, e.screenY - drag.y) > 24) {
      drag.active = true;
      b.classList.add('dragging');
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
    b.classList.remove('dragging');
    if (drag.raf) cancelAnimationFrame(drag.raf);
    drag = null;
  };
  b.addEventListener('pointerup', finish);
  b.addEventListener('pointercancel', finish);
}

function applyModuleState(state) {
  for (const [id, s] of Object.entries(state)) {
    const b = moduleButtons.get(id);
    if (!b) continue;
    b.classList.toggle('open', s.visible && s.mode === 'docked');
    b.classList.toggle('floating', s.mode === 'floating' && s.visible);
    if ('running' in s) b.classList.toggle('dim', !s.running);
    let badge = b.querySelector('.badge');
    if (s.badge) {
      if (!badge) b.appendChild((badge = el('span', 'badge')));
      badge.textContent = s.badge;
    } else if (badge) badge.remove();
    let dot = b.querySelector('.playing-dot');
    if (s.playing && !dot) b.appendChild(el('span', 'playing-dot'));
    else if (!s.playing && dot) dot.remove();
  }
}

// ----- Oppstart -----

(async () => {
  config = await zapdock.invoke('config:get');
  document.body.dataset.platform = config.platform;
  renderStatic();
  renderModules();
  zapdock.on('taskbar:windows', (list) => {
    windows = list;
    renderWindows();
  });
  zapdock.on('taskbar:active', (h) => {
    activeHwnd = h;
    for (const n of document.querySelectorAll('.win')) n.classList.toggle('active', Number(n.dataset.hwnd) === h);
  });
  zapdock.on('modules:state', applyModuleState);
})();
