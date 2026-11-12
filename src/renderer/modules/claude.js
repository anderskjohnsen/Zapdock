'use strict';
/* global ZD, zdIcon */
// Claude Code: aktive økter (med fargeforløp for de som venter på svar) og bruk.
window.ZD_MODULES = window.ZD_MODULES || {};

window.ZD_MODULES.claude = ({ init, body, action, toolButton }) => {
  const root = document.createElement('div');
  root.className = 'claude scroll';
  body.appendChild(root);
  let data = init.data;

  function sessionsHtml(d) {
    const darken = d.waitDarkenMinutes || 20;
    const now = Date.now();
    const rows = [...d.sessions].sort((a, b) => (b.needsAnswer - a.needsAnswer) || (b.lastActivity - a.lastActivity)).map((s) => {
      let style = '';
      let badge = '';
      if (s.needsAnswer) {
        const waited = now - (s.waitingSince || now);
        const c = ZD.waitColor(waited, darken);
        style = `style="--wait:${c.css};--wait-text:${c.text}"`;
        badge = `<span class="wait-badge">${ZD.shortDur(waited)}</span>`;
      }
      return `<div class="sess ${s.needsAnswer ? 'needs' : ''}" ${style} data-id="${ZD.esc(s.id)}" title="${ZD.esc(s.cwd || '')}">
        <span class="dot ${s.status}"></span>
        <span class="name">${ZD.esc(s.project)}</span>
        <span class="right">${badge}<span class="tok">${ZD.fmtTokens(s.blockTokens || s.tokens.total)}</span>
          ${s.needsAnswer ? `<button class="x" data-dismiss="${ZD.esc(s.id)}" title="Skjul til neste gang den trenger svar">${zdIcon('close')}</button>` : ''}</span>
        ${s.title ? `<span class="ttl">${ZD.esc(s.title)}</span>` : ''}
        <span class="meta">${ZD.STATUS[s.status] || s.status} · ${ZD.ago(s.lastActivity)}${s.model ? ` · ${ZD.esc(s.model.replace(/^claude-/, ''))}` : ''}${s.dismissed ? ' · skjult' : ''}</span>
      </div>`;
    }).join('');
    return `<div class="card"><h3>Økter ${d.needsAnswerCount ? `<span class="pill-count">${d.needsAnswerCount} venter</span>` : ''}</h3>
      ${rows || '<div class="empty">Ingen aktive Claude Code-økter.</div>'}</div>`;
  }

  function blockHtml(d) {
    if (!d.block) return '<div class="card"><h3>5-timersblokk</h3><div class="empty">Ingen aktiv blokk – ingen bruk siste 5 timer.</div></div>';
    const b = d.block;
    const timePct = Math.min(100, ((Date.now() - b.start) / (b.end - b.start)) * 100);
    const left = Math.max(0, Math.round((b.end - Date.now()) / 60000));
    const models = Object.entries(b.models).sort((x, y) => y[1] - x[1])
      .map(([m, t]) => `<span class="chip">${ZD.esc(m.replace(/^claude-/, ''))} · ${ZD.fmtTokens(t)}</span>`).join('');
    return `<div class="card">
      <h3>5-timersblokk</h3>
      <div class="big">${ZD.fmtTokens(b.tokens.total)} <small>tokens</small></div>
      ${b.pct != null ? `<div class="progress"><div style="width:${b.pct.toFixed(1)}%"></div></div><div class="row"><span>${b.pct.toFixed(0)} % av ${ZD.fmtTokens(b.limit)}</span></div>` : ''}
      <div class="progress time"><div style="width:${timePct.toFixed(1)}%"></div></div>
      <div class="row"><span>${ZD.clock(b.start)} – ${ZD.clock(b.end)}</span><span>nullstilles om <b>${left >= 60 ? `${Math.floor(left / 60)} t ${left % 60} min` : `${left} min`}</b></span></div>
      <div class="row" style="margin-top:6px"><span>Inn <b>${ZD.fmtTokens(b.tokens.input)}</b> · Ut <b>${ZD.fmtTokens(b.tokens.output)}</b></span><span>Cache <b>${ZD.fmtTokens(b.tokens.cacheCreate + b.tokens.cacheRead)}</b></span></div>
      <div class="row"><span><b>${b.messages}</b> svar</span><span><b>${ZD.fmtTokens(b.burnPerMin)}</b> tokens/min</span></div>
      <div class="models">${models}</div>
    </div>`;
  }

  function daysHtml(d) {
    const max = Math.max(1, ...d.days.map((x) => x.tokens.total));
    const bars = d.days.map((x, i) => {
      const day = new Date(`${x.date}T12:00:00`).toLocaleDateString('nb-NO', { weekday: 'short' }).replace('.', '');
      return `<div class="b ${i === d.days.length - 1 ? 'today' : ''}" title="${x.date}: ${ZD.fmtTokens(x.tokens.total)} tokens, ${x.messages} svar">
        <i style="height:${((x.tokens.total / max) * 100).toFixed(1)}%"></i><span>${day}</span></div>`;
    }).join('');
    return `<div class="card"><h3>I dag</h3>
      <div class="row"><span><b style="font-size:16px">${ZD.fmtTokens(d.today.tokens.total)}</b> tokens</span><span><b>${d.today.messages}</b> svar</span></div>
      <div class="bars">${bars}</div></div>`;
  }

  function render() {
    const d = data;
    if (!d) {
      root.innerHTML = '<div class="card empty">Henter data …</div>';
      return;
    }
    const scroll = root.scrollTop;
    let html = sessionsHtml(d) + blockHtml(d) + daysHtml(d);
    if (!d.dirsFound.length) {
      html += `<div class="card empty">Fant ingen Claude Code-data. Søkte i:<br>${d.dirs.map(ZD.esc).join('<br>')}<br><br>
        Legg til flere mapper (f.eks. WSL) under Innstillinger → Claude.</div>`;
    }
    root.innerHTML = html;
    root.scrollTop = scroll;
  }

  root.addEventListener('click', (e) => {
    const x = e.target.closest('[data-dismiss]');
    if (x) {
      e.stopPropagation();
      action('dismiss', { id: x.dataset.dismiss });
      return;
    }
    const row = e.target.closest('.sess');
    if (row) action('focus', { id: row.dataset.id });
  });
  toolButton('reload', 'Oppdater', () => action('refresh'));
  setInterval(render, 5000); // fargeforløp og "x min siden"
  return { update(d) { data = d; render(); } };
};
