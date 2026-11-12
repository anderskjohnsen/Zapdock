'use strict';
// Enkle SVG-ikoner (currentColor) for moduler og knapper.
window.ZD_ICONS = {
  start: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 3h8.5v8.5H3zM12.5 3H21v8.5h-8.5zM3 12.5h8.5V21H3zM12.5 12.5H21V21h-8.5z"/></svg>',
  claude: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l1.6 6.1L19.8 6l-4.3 4.6L22 12l-6.5 1.4 4.3 4.6-6.2-2.1L12 22l-1.6-6.1L4.2 18l4.3-4.6L2 12l6.5-1.4L4.2 6l6.2 2.1z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor"/><path d="M10 9l5 3-5 3z" fill="#0f1116"/></svg>',
  stremio: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M10 8.5l5 3.5-5 3.5z" fill="#0f1116"/></svg>',
  wow: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 5h18a1 1 0 011 1v10a1 1 0 01-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 01-1-1V6a1 1 0 011-1zm1 2v8h16V7z"/><circle cx="12" cy="11" r="2.4" fill="currentColor"/></svg>',
  web: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  app: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 8h18" stroke="currentColor" stroke-width="2"/></svg>',
  detach: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  dock: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M4 20h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  forward: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  reload: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 11-2.3-5.6M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  playpause: '<svg viewBox="0 0 24 24"><path d="M5 5l8 7-8 7zM15 5h2v14h-2zM19 5h2v14h-2z" fill="currentColor"/></svg>',
  desktop: '<svg viewBox="0 0 24 24"><path d="M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};
window.zdIcon = (name) => window.ZD_ICONS[name] || window.ZD_ICONS.web;
