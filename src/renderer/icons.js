'use strict';
// SVG-ikoner (currentColor) for moduler og knapper.
(() => {
const S = (body, extra = '') => `<svg viewBox="0 0 24 24" ${extra}>${body}</svg>`;
const L = (d, w = 2) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

window.ZD_ICONS = {
  start: S('<path fill="currentColor" d="M3 3h8.5v8.5H3zM12.5 3H21v8.5h-8.5zM3 12.5h8.5V21H3zM12.5 12.5H21V21h-8.5z"/>'),
  claude: S('<path fill="currentColor" d="M12 2l1.6 6.1L19.8 6l-4.3 4.6L22 12l-6.5 1.4 4.3 4.6-6.2-2.1L12 22l-1.6-6.1L4.2 18l4.3-4.6L2 12l6.5-1.4L4.2 6l6.2 2.1z"/>'),
  youtube: S('<rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor"/><path d="M10 9l5 3-5 3z" fill="#0f1116"/>'),
  stremio: S('<path fill="currentColor" d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M10 8.5l5 3.5-5 3.5z" fill="#0f1116"/>'),
  spotify: S('<circle cx="12" cy="12" r="10" fill="currentColor"/>' +
    '<path d="M6.5 9.3c3.8-1.1 7.9-.8 11 1M7.2 12.4c3.1-.9 6.4-.6 9 .9M7.9 15.3c2.5-.6 4.9-.4 6.9.7" fill="none" stroke="#0f1116" stroke-width="1.7" stroke-linecap="round"/>'),
  music: S('<circle cx="12" cy="12" r="10" fill="currentColor"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#0f1116" stroke-width="1.6"/><path d="M10.5 9.5l3.5 2.5-3.5 2.5z" fill="#0f1116"/>'),
  wow: S('<path fill="currentColor" d="M3 5h18a1 1 0 011 1v10a1 1 0 01-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 01-1-1V6a1 1 0 011-1zm1 2v8h16V7z"/><circle cx="12" cy="11" r="2.4" fill="currentColor"/>'),
  calendar: S(L('M4 6.5A1.5 1.5 0 015.5 5h13A1.5 1.5 0 0120 6.5v12a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5zM4 10h16M8 3v4M16 3v4') + '<rect x="7" y="13" width="3" height="3" rx=".6" fill="currentColor"/>'),
  weather: S('<circle cx="9" cy="9" r="3.5" fill="currentColor"/>' + L('M9 2.5v1.2M3.3 9H2.1M4.6 4.6l.8.8M13.4 4.6l-.8.8', 1.8) +
    '<path d="M8 20h9.5a3.5 3.5 0 000-7 5 5 0 00-9.6 1A3 3 0 008 20z" fill="currentColor" stroke="#0f1116" stroke-width="1.4"/>'),
  timer: S(L('M12 21a8 8 0 100-16 8 8 0 000 16zM12 9v4l2.5 2.5M9.5 2.5h5')),
  notes: S(L('M6 3h9l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM15 3v4h4M8.5 12h7M8.5 16h5')),
  clipboard: S(L('M9 4h6v3H9zM9 5.5H6.5A1.5 1.5 0 005 7v12.5A1.5 1.5 0 006.5 21h11a1.5 1.5 0 001.5-1.5V7a1.5 1.5 0 00-1.5-1.5H15M8.5 12h7M8.5 16h5')),
  system: S(L('M7 7h10v10H7zM10 2.5V5M14 2.5V5M10 19v2.5M14 19v2.5M2.5 10H5M2.5 14H5M19 10h2.5M19 14h2.5') + '<rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="currentColor"/>'),
  twitch: S('<path fill="currentColor" d="M4 3l-1 4v13h5v2h3l2-2h4l4-4V3zm15 10l-3 3h-4l-2 2v-2H6V5h13z"/><path fill="currentColor" d="M11 8h2v5h-2zM15 8h2v5h-2z"/>'),
  discord: S('<path fill="currentColor" d="M19.3 5.3A16.6 16.6 0 0015.2 4l-.5 1a15.4 15.4 0 00-5.4 0L8.8 4a16.6 16.6 0 00-4.1 1.3C2.1 9.2 1.4 13 1.8 16.7a16.7 16.7 0 005 2.6l1.1-1.7a10.8 10.8 0 01-1.7-.8l.4-.3a11.9 11.9 0 0010.8 0l.4.3-1.7.8 1.1 1.7a16.6 16.6 0 005-2.6c.5-4.3-.7-8.1-2.9-11.4zM8.7 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/>'),
  chat: S(L('M4 5h16v11H9l-5 4z')),
  mail: S(L('M3.5 6h17v12h-17zM3.5 6.5l8.5 7 8.5-7')),
  web: S('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>' + L('M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18', 1.6)),
  app: S(L('M3 5a1 1 0 011-1h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1zM3 8h18')),
  detach: S(L('M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5')),
  dock: S(L('M12 4v11M7 10l5 5 5-5M4 20h16')),
  close: S(L('M6 6l12 12M18 6L6 18')),
  back: S(L('M15 5l-7 7 7 7')),
  forward: S(L('M9 5l7 7-7 7')),
  reload: S(L('M20 12a8 8 0 11-2.3-5.6M20 4v5h-5')),
  home: S(L('M4 11l8-7 8 7v9h-5v-6H9v6H4z')),
  playpause: S('<path d="M4 5l8 7-8 7zM15 5h2v14h-2zM19 5h2v14h-2z" fill="currentColor"/>'),
  play: S('<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>'),
  pause: S('<path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" fill="currentColor"/>'),
  next: S('<path d="M5 5l9 7-9 7zM16 5h2.5v14H16z" fill="currentColor"/>'),
  prev: S('<path d="M19 5l-9 7 9 7zM8 5H5.5v14H8z" fill="currentColor"/>'),
  vol0: S('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>' + L('M17 9l4 6M21 9l-4 6', 1.8)),
  vol1: S('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>' + L('M16.5 9.5a3.5 3.5 0 010 5', 1.8)),
  vol2: S('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>' + L('M16.5 9.5a3.5 3.5 0 010 5M19 7a7 7 0 010 10', 1.8)),
  settings: S(L('M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z') + L('M19.4 13.5l1.6 1.2-2 3.4-1.9-.8a7.6 7.6 0 01-2.2 1.3l-.3 2h-4l-.3-2a7.6 7.6 0 01-2.2-1.3l-1.9.8-2-3.4 1.6-1.2a7.7 7.7 0 010-3L2.2 9.3l2-3.4 1.9.8a7.6 7.6 0 012.2-1.3l.3-2h4l.3 2a7.6 7.6 0 012.2 1.3l1.9-.8 2 3.4-1.6 1.2a7.7 7.7 0 010 3z', 1.6)),
  pin: S(L('M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7')),
  trash: S(L('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3')),
  plus: S(L('M12 5v14M5 12h14')),
  check: S(L('M5 12.5l4.5 4.5L19 7.5')),
  copy: S(L('M9 9h11v11H9zM5 15H4V4h11v1')),
  folder: S(L('M3 6.5A1.5 1.5 0 014.5 5H9l2 2.5h8.5A1.5 1.5 0 0121 9v9.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5z')),
  external: S(L('M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5')),
  up: S(L('M6 15l6-6 6 6')),
  down: S(L('M6 9l6 6 6-6')),
};
window.zdIcon = (name) => window.ZD_ICONS[name] || window.ZD_ICONS.web;
})();
