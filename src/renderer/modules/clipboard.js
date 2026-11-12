'use strict';
/* global ZD, zdIcon */
// Utklippstavle-historikk med søk og festing.
window.ZD_MODULES = window.ZD_MODULES || {};

window.ZD_MODULES.clipboard = ({ body, action, toolButton }) => {
  const root = document.createElement('div');
  root.className = 'clip';
  body.appendChild(root);
  root.innerHTML = '<input class="inp search" placeholder="Søk i utklipp …"><div class="clip-list scroll"></div>';
  const search = root.querySelector('.search');
  const list = root.querySelector('.clip-list');
  toolButton('trash', 'Tøm historikk (festede beholdes)', () => action('clear'));
  let data = null;

  const item = (x, pinned) => `<div class="clip-item" data-id="${x.id}">
      <div class="clip-text">${ZD.esc(x.text.length > 400 ? `${x.text.slice(0, 400)} …` : x.text)}</div>
      <div class="clip-meta"><span>${ZD.ago(x.ts)}${x.text.length > 400 ? ` · ${x.text.length} tegn` : ''}</span>
        <span><button class="hbtn" data-act="${pinned ? 'unpin' : 'pin'}" title="${pinned ? 'Løsne' : 'Fest'}">${zdIcon(pinned ? 'close' : 'pin')}</button>
        ${pinned ? '' : `<button class="hbtn" data-act="delete" title="Fjern">${zdIcon('trash')}</button>`}</span></div></div>`;

  function render() {
    if (!data) return;
    const q = search.value.trim().toLowerCase();
    const f = (x) => !q || x.text.toLowerCase().includes(q);
    const pinned = data.pinned.filter(f);
    const items = data.items.filter(f);
    list.innerHTML = (pinned.length ? `<h4>Festet</h4>${pinned.map((x) => item(x, true)).join('')}` : '')
      + (items.length ? `<h4>Nylig kopiert</h4>${items.map((x) => item(x, false)).join('')}` : '')
      || '<div class="empty">Ingenting kopiert ennå. Klikk på et element for å kopiere det igjen.</div>';
  }
  list.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const idRaw = row.dataset.id;
    const id = /^\d+$/.test(idRaw) ? Number(idRaw) : idRaw;
    const b = e.target.closest('[data-act]');
    if (b) return void action(b.dataset.act, { id });
    await action('copy', { id });
    row.classList.add('copied');
    setTimeout(() => row.classList.remove('copied'), 700);
  });
  search.addEventListener('input', render);
  return { update(d) { data = d; render(); } };
};
