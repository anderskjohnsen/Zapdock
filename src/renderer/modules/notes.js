'use strict';
/* global ZD, zdIcon */
// Huskeliste + fritekstnotater.
window.ZD_MODULES = window.ZD_MODULES || {};

window.ZD_MODULES.notes = ({ init, body, action }) => {
  const root = document.createElement('div');
  root.className = 'notes';
  body.appendChild(root);
  root.innerHTML = `
    <div class="tabs"><button class="tab on" data-tab="todo">Huskeliste</button><button class="tab" data-tab="text">Notater</button></div>
    <div class="pane p-todo on">
      <form class="add"><input class="inp" placeholder="Legg til … (Enter)" maxlength="200"><button class="hbtn" title="Legg til">${zdIcon('plus')}</button></form>
      <div class="todos scroll"></div>
      <button class="link clear">Fjern ferdige</button>
    </div>
    <div class="pane p-text"><textarea spellcheck="true" placeholder="Skriv notater her. Lagres automatisk."></textarea></div>`;
  const $ = (s) => root.querySelector(s);
  root.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    root.querySelectorAll('.tab, .pane').forEach((n) => n.classList.remove('on'));
    t.classList.add('on');
    $(`.pane.p-${t.dataset.tab}`).classList.add('on');
  }));
  const input = $('.add input');
  $('.add').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    action('add', { text: input.value });
    input.value = '';
  });
  $('.clear').addEventListener('click', () => action('clearDone'));
  $('.todos').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) return void action('remove', { id: Number(rm.dataset.rm) });
    const row = e.target.closest('[data-id]');
    if (row) action('toggle', { id: Number(row.dataset.id) });
  });
  const ta = $('textarea');
  let t = null;
  ta.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => action('text', { text: ta.value }), 400);
  });
  ta.value = (init.data && init.data.text) || '';

  return {
    update(d) {
      if (!d) return;
      const open = d.todos.filter((x) => !x.done);
      const done = d.todos.filter((x) => x.done);
      $('.todos').innerHTML = [...open, ...done].map((x) => `<div class="todo ${x.done ? 'done' : ''}" data-id="${x.id}">
        <span class="cb">${x.done ? zdIcon('check') : ''}</span><span class="tt">${ZD.esc(x.text)}</span>
        <button class="hbtn rm" data-rm="${x.id}" title="Slett">${zdIcon('trash')}</button></div>`).join('')
        || '<div class="empty">Ingenting på lista. 👌</div>';
      $('.clear').style.display = done.length ? '' : 'none';
      if (document.activeElement !== ta && ta.value !== d.text) ta.value = d.text;
    },
  };
};
