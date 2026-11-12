'use strict';
// Utklippstavle-historikk (kun tekst, kun i minnet – festede elementer lagres).
const { clipboard } = require('electron');

module.exports = function clipboardProvider(ctx) {
  const max = ctx.mod.maxItems || 40;
  const state = ctx.store.data;
  state.clipboardPinned = state.clipboardPinned || [];
  let items = [];
  let last = '';
  let timer = null;
  let nextId = 1;

  const publish = () => ctx.publish({ items, pinned: state.clipboardPinned });

  function poll() {
    let text = '';
    try { text = clipboard.readText(); } catch (_) { return; }
    if (!text || text === last) return;
    last = text;
    if (text.length > 20000 || !text.trim()) return;
    items = [{ id: nextId++, text, ts: Date.now() }, ...items.filter((i) => i.text !== text)].slice(0, max);
    publish();
  }

  const find = (id) => items.find((i) => i.id === id) || state.clipboardPinned.find((i) => i.id === id);

  return {
    start() {
      try { last = clipboard.readText(); } catch (_) { /* ignorer */ }
      timer = setInterval(poll, 800);
      publish();
    },
    stop() { clearInterval(timer); },
    data: () => ({ items, pinned: state.clipboardPinned }),
    action(name, p = {}) {
      const item = find(p.id);
      if (name === 'copy' && item) {
        clipboard.writeText(item.text);
        last = item.text;
        return true;
      }
      if (name === 'pin' && item) {
        if (!state.clipboardPinned.some((i) => i.text === item.text)) {
          state.clipboardPinned.unshift({ id: `p${Date.now()}`, text: item.text, ts: Date.now() });
          ctx.store.save();
        }
      } else if (name === 'unpin') {
        state.clipboardPinned = state.clipboardPinned.filter((i) => i.id !== p.id);
        ctx.store.save();
      } else if (name === 'delete') {
        items = items.filter((i) => i.id !== p.id);
      } else if (name === 'clear') {
        items = [];
      }
      publish();
      return true;
    },
  };
};
