'use strict';
// Felles hjelpere for dock, paneler og innstillinger.
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fmtTokens = (n) => {
    n = n || 0;
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
    return String(n);
  };
  const fmtBytes = (b) => {
    if (!b && b !== 0) return '–';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return `${b.toFixed(b >= 100 || i === 0 ? 0 : 1)} ${u[i]}`;
  };
  const clock = (ts) => new Date(ts).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  const ago = (ts) => {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return `${s} s siden`;
    if (s < 3600) return `${Math.round(s / 60)} min siden`;
    return `${Math.floor(s / 3600)} t ${Math.round((s % 3600) / 60)} min siden`;
  };
  const shortDur = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}t${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
  };
  const countdown = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  };

  // ---- Claude: fargen går gradvis fra lys gul -> oransje -> rust -> mørk vinrød jo lenger en økt venter ----
  const WAIT_STOPS = [
    [0, [246, 196, 83]],
    [0.3, [236, 140, 64]],
    [0.6, [196, 78, 38]],
    [0.85, [136, 36, 24]],
    [1, [88, 18, 16]],
  ];
  function waitColor(ms, darkenMinutes = 20) {
    const t = Math.max(0, Math.min(1, ms / (darkenMinutes * 60000)));
    for (let i = 1; i < WAIT_STOPS.length; i++) {
      const [t1, c1] = WAIT_STOPS[i];
      const [t0, c0] = WAIT_STOPS[i - 1];
      if (t <= t1) {
        const k = (t - t0) / (t1 - t0);
        const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
        return { rgb: c, css: `rgb(${c.join(',')})`, text: luminance(c) > 0.45 ? '#1b1308' : '#fff4ee', t };
      }
    }
    const c = WAIT_STOPS[WAIT_STOPS.length - 1][1];
    return { rgb: c, css: `rgb(${c.join(',')})`, text: '#fff4ee', t: 1 };
  }
  function luminance([r, g, b]) {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  const STATUS = {
    working: 'jobber',
    waiting: 'venter på svar',
    blocked: 'venter på tillatelse?',
    idle: 'inaktiv',
  };

  // ---- Vær (MET symbolkoder) ----
  function weatherEmoji(code) {
    if (!code) return '·';
    const night = code.endsWith('_night');
    const c = code.replace(/_(day|night|polartwilight)$/, '');
    if (c.includes('thunder')) return '⛈️';
    if (c.includes('snow')) return c.includes('showers') ? '🌨️' : '❄️';
    if (c.includes('sleet')) return '🌨️';
    if (c.includes('rainshowers')) return '🌦️';
    if (c.includes('rain')) return '🌧️';
    if (c === 'fog') return '🌫️';
    if (c === 'cloudy') return '☁️';
    if (c === 'partlycloudy') return night ? '☁️' : '⛅';
    if (c === 'fair') return night ? '🌙' : '🌤️';
    if (c === 'clearsky') return night ? '🌙' : '☀️';
    return '🌡️';
  }
  const temp = (t) => (typeof t === 'number' ? `${Math.round(t)}°` : '–');

  const action = (id, name, payload) => window.zapdock.invoke('module:action', { id, action: name, payload });

  window.ZD = { esc, fmtTokens, fmtBytes, clock, ago, shortDur, countdown, waitColor, STATUS, weatherEmoji, temp, action };
})();
