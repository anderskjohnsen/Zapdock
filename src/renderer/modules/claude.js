'use strict';
/* global zapdock, zdIcon */
// Claude Code-bruk: nåværende 5-timersblokk, aktive økter, i dag og siste 7 dager.
window.ZD_MODULES = window.ZD_MODULES || {};

(() => {
  const fmt = (n) => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
    return String(n);
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clock = (ts) => new Date(ts).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  const ago = (ts) => {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return `${s} s siden`;
    if (s < 3600) return `${Math.round(s / 60)} min siden`;
    return `${Math.floor(s / 3600)} t siden`;
  };
  const left = (ts) => {
    const m = Math.max(0, Math.round((ts - Date.now()) / 60000));
    return m >= 60 ? `${Math.floor(m / 60)} t ${m % 60} min` : `${m} min`;
  };
  const STATUS = {
    working: 'jobber',
    waiting: 'ferdig – venter på deg',
    blocked: 'venter (tillatelse?)',
    idle: 'inaktiv',
  };
  const shortModel = (m) => (m || '').replace(/^claude-/, '').replace(/-\d{8}$/, '');

  function render(root, d) {
    if (!d) {
      root.innerHTML = '<div class="card empty">Henter data …</div>';
      return;
    }
    const parts = [];

    // 5-timersblokk
    if (d.block) {
      const b = d.block;
      const timePct = Math.min(100, ((Date.now() - b.start) / (b.end - b.start)) * 100);
      const models = Object.entries(b.models).sort((x, y) => y[1] - x[1])
        .map(([m, t]) => `<span class="chip">${esc(shortModel(m))} · ${fmt(t)}</span>`).join('');
      parts.push(`<div class="card">
        <h3>Nåværende 5-timersblokk</h3>
        <div class="big">${fmt(b.tokens.total)} <span style="font-size:13px;color:var(--muted);font-weight:400">tokens</span></div>
        ${b.pct != null ? `<div class="progress"><div style="width:${b.pct.toFixed(1)}%"></div></div>
        <div class="row"><span>${b.pct.toFixed(0)} % av ${fmt(b.limit)}</span><span></span></div>` : ''}
        <div class="progress time"><div style="width:${timePct.toFixed(1)}%"></div></div>
        <div class="row"><span>${clock(b.start)} – ${clock(b.end)}</span><span>nullstilles om <b>${left(b.end)}</b></span></div>
        <div class="row" style="margin-top:6px"><span>Inn <b>${fmt(b.tokens.input)}</b> · Ut <b>${fmt(b.tokens.output)}</b></span><span>Cache <b>${fmt(b.tokens.cacheCreate + b.tokens.cacheRead)}</b></span></div>
        <div class="row"><span><b>${b.messages}</b> svar</span><span><b>${fmt(b.burnPerMin)}</b> tokens/min</span></div>
        <div class="models">${models}</div>
      </div>`);
    } else {
      parts.push('<div class="card"><h3>Nåværende 5-timersblokk</h3><div class="empty">Ingen aktiv blokk – ingen bruk siste 5 timer.</div></div>');
    }

    // Økter
    const sess = d.sessions.map((s) => `<div class="sess" title="${esc(s.cwd || '')}">
        <span class="dot ${s.status}"></span>
        <span class="name">${esc(s.project)}</span>
        <span class="tok">${fmt(s.blockTokens || s.tokens.total)}</span>
        <span class="meta">${STATUS[s.status] || s.status} · ${ago(s.lastActivity)}${s.model ? ` · ${esc(shortModel(s.model))}` : ''}</span>
      </div>`).join('');
    parts.push(`<div class="card"><h3>Claude Code-økter</h3>${sess || '<div class="empty">Ingen aktive økter.</div>'}</div>`);

    // I dag + 7 dager
    const max = Math.max(1, ...d.days.map((x) => x.tokens.total));
    const bars = d.days.map((x, i) => {
      const day = new Date(`${x.date}T12:00:00`).toLocaleDateString('nb-NO', { weekday: 'short' }).replace('.', '');
      return `<div class="b ${i === d.days.length - 1 ? 'today' : ''}" title="${x.date}: ${fmt(x.tokens.total)} tokens, ${x.messages} svar">
        <i style="height:${((x.tokens.total / max) * 100).toFixed(1)}%"></i><span>${day}</span></div>`;
    }).join('');
    parts.push(`<div class="card">
      <h3>I dag</h3>
      <div class="row"><span><b style="font-size:16px">${fmt(d.today.tokens.total)}</b> tokens</span><span><b>${d.today.messages}</b> svar</span></div>
      <div class="bars">${bars}</div>
    </div>`);

    if (!d.dirsFound.length) {
      parts.push(`<div class="card empty">Fant ingen Claude Code-data. Søkte i:<br>${d.dirs.map(esc).join('<br>')}<br><br>
        Legg til flere mapper (f.eks. WSL) under <code>claude.dirs</code> i config.json.</div>`);
    }
    root.innerHTML = parts.join('');
  }

  window.ZD_MODULES.claude = ({ init, body, tools }) => {
    const root = document.createElement('div');
    root.className = 'claude';
    body.appendChild(root);
    let data = init.claude;
    render(root, data);

    const b = document.createElement('button');
    b.className = 'hbtn';
    b.title = 'Oppdater';
    b.innerHTML = zdIcon('reload');
    b.addEventListener('click', async () => {
      data = await zapdock.invoke('claude:refresh');
      render(root, data);
    });
    tools.appendChild(b);

    zapdock.on('claude:summary', (d) => {
      data = d;
      render(root, data);
    });
    // Oppdater "x min siden"/nedtelling selv om dataene ikke endres.
    setInterval(() => render(root, data), 30000);
  };
})();
