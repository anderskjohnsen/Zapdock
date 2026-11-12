'use strict';
/* global ZD, zapdock */
// Kalender: i dag, i morgen og kommende avtaler fra iCal-lenker.
window.ZD_MODULES = window.ZD_MODULES || {};

window.ZD_MODULES.calendar = ({ body, action, toolButton }) => {
  const root = document.createElement('div');
  root.className = 'calendar scroll';
  body.appendChild(root);
  toolButton('reload', 'Oppdater', () => action('refresh'));
  toolButton('external', 'Åpne Google Kalender', () => action('openGoogle'));
  let data = null;

  const dayKey = (ts) => new Date(ts).toDateString();
  function dayLabel(ts) {
    const d = new Date(ts);
    const today = new Date();
    const tomorrow = new Date(Date.now() + 86400000);
    if (d.toDateString() === today.toDateString()) return 'I dag';
    if (d.toDateString() === tomorrow.toDateString()) return 'I morgen';
    const s = d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function render() {
    const d = data;
    if (!d || d.loading) {
      root.innerHTML = '<div class="card empty">Henter kalender …</div>';
      return;
    }
    if (!d.configured) {
      root.innerHTML = `<div class="card setup"><h3>Koble til kalender</h3>
        <p>Legg inn en <b>hemmelig iCal-adresse</b> for familiekalenderen:</p>
        <ol><li>Åpne Google Kalender på PC → ⚙ Innstillinger</li>
        <li>Velg kalenderen under «Innstillinger for mine kalendere»</li>
        <li>Kopier «Hemmelig adresse i iCal-format»</li>
        <li>Lim den inn i Zapdock → Innstillinger → Kalender</li></ol>
        <button class="btn" id="cal-open-settings">Åpne innstillinger</button></div>`;
      root.querySelector('#cal-open-settings').addEventListener('click', () => zapdock.send('settings:open'));
      return;
    }
    const now = Date.now();
    const groups = new Map();
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    for (const e of d.events) {
      // Avtaler som allerede har startet (flerdagers / pågående) vises under i dag.
      const ts = e.allDay ? Math.max(e.start, today0.getTime()) : Math.max(e.start, Math.min(now, e.end - 1));
      const k = dayKey(ts);
      if (!groups.has(k)) groups.set(k, { ts, items: [] });
      groups.get(k).items.push(e);
    }
    let html = '';
    for (const g of groups.values()) {
      html += `<div class="cal-day"><h4>${dayLabel(g.ts)}</h4>`;
      for (const e of g.items) {
        const ongoing = !e.allDay && e.start <= now && e.end > now;
        const time = e.allDay ? 'Hele dagen' : `${ZD.clock(e.start)}–${ZD.clock(e.end)}`;
        html += `<div class="ev ${ongoing ? 'now' : ''}" style="--c:${e.color}">
          <span class="ev-time">${time}</span>
          <span class="ev-title">${ZD.esc(e.summary)}</span>
          <span class="ev-meta">${[e.location, e.source].filter(Boolean).map(ZD.esc).join(' · ')}${ongoing ? ' · <b>pågår</b>' : ''}</span>
        </div>`;
      }
      html += '</div>';
    }
    if (!d.events.length) html = '<div class="card empty">Ingen avtaler de neste dagene. 🎉</div>';
    const errs = d.sources.filter((s) => s.error).map((s) => `${ZD.esc(s.name)}: ${ZD.esc(s.error)}`);
    if (errs.length) html += `<div class="foot err">Kunne ikke hente: ${errs.join(', ')}</div>`;
    root.innerHTML = html;
  }
  setInterval(render, 60000);
  return { update(x) { data = x; render(); } };
};
