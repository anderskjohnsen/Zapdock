'use strict';
/* global ZD, zdIcon */
// Nedtellinger med hurtigvalg.
window.ZD_MODULES = window.ZD_MODULES || {};

window.ZD_MODULES.timer = ({ body, action }) => {
  const root = document.createElement('div');
  root.className = 'timer scroll';
  body.appendChild(root);
  root.innerHTML = `
    <div class="card">
      <h3>Ny timer</h3>
      <div class="presets">${[1, 3, 5, 10, 15, 20, 25, 30, 45, 60].map((m) => `<button class="chip-btn" data-m="${m}">${m < 60 ? `${m} min` : '1 t'}</button>`).join('')}</div>
      <form class="custom"><input class="inp" name="label" placeholder="Navn (f.eks. Pizza i ovnen)" maxlength="40"><input class="inp num" name="min" type="number" min="1" max="1440" value="10"><span class="w-muted">min</span><button class="btn">Start</button></form>
    </div>
    <div class="list"></div>`;
  const form = root.querySelector('form');
  root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
    action('start', { minutes: Number(b.dataset.m), label: form.label.value.trim() });
    form.label.value = '';
  }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    action('start', { minutes: Number(form.min.value) || 1, label: form.label.value.trim() });
    form.label.value = '';
  });
  const list = root.querySelector('.list');
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b) action(b.dataset.act, { id: Number(b.dataset.id), minutes: 1 });
  });
  let data = null;

  function render() {
    if (!data) return;
    const now = Date.now();
    const timers = [...data.timers].sort((a, b) => (b.done - a.done) || ((a.paused ? a.left : a.endsAt - now) - (b.paused ? b.left : b.endsAt - now)));
    list.innerHTML = timers.map((t) => {
      const left = t.done ? 0 : t.paused ? t.left : t.endsAt - now;
      const pct = t.duration ? Math.max(0, Math.min(100, 100 - (left / t.duration) * 100)) : 100;
      return `<div class="card tm ${t.done ? 'done' : ''} ${t.paused ? 'paused' : ''}">
        <div class="tm-top"><span class="tm-label">${ZD.esc(t.label || 'Timer')}</span><span class="tm-left">${t.done ? 'Ferdig!' : ZD.countdown(left)}</span></div>
        <div class="progress time"><div style="width:${pct}%"></div></div>
        <div class="tm-btns">
          ${t.done ? '' : t.paused ? `<button class="hbtn" data-act="resume" data-id="${t.id}" title="Fortsett">${zdIcon('play')}</button>` : `<button class="hbtn" data-act="pause" data-id="${t.id}" title="Pause">${zdIcon('pause')}</button>`}
          <button class="chip-btn" data-act="add" data-id="${t.id}">+1 min</button>
          <button class="hbtn" data-act="remove" data-id="${t.id}" title="Fjern">${zdIcon('trash')}</button>
        </div></div>`;
    }).join('') || '<div class="empty" style="padding:4px 2px">Ingen timere. Velg en tid over.</div>';
  }
  setInterval(render, 1000);
  return { update(d) { data = d; render(); } };
};
