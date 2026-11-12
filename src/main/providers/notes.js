'use strict';
// Notater + huskeliste, lagret lokalt i notes.json.
const fs = require('fs');
const path = require('path');

module.exports = function notesProvider(ctx) {
  const file = path.join(ctx.userData, 'notes.json');
  let data = { text: '', todos: [] };
  try { data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch (_) { /* ny fil */ }
  let saveTimer = null;

  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
      fs.renameSync(`${file}.tmp`, file);
    }, 300);
  };
  const publish = () => ctx.publish({ ...data, open: data.todos.filter((t) => !t.done).length });

  return {
    start: publish,
    stop() {
      clearTimeout(saveTimer);
      try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (_) { /* ignorer */ }
    },
    data: () => ({ ...data, open: data.todos.filter((t) => !t.done).length }),
    action(name, p = {}) {
      if (name === 'text') data.text = String(p.text || '');
      else if (name === 'add' && p.text && p.text.trim()) data.todos.push({ id: Date.now(), text: p.text.trim(), done: false });
      else if (name === 'toggle') data.todos = data.todos.map((t) => (t.id === p.id ? { ...t, done: !t.done } : t));
      else if (name === 'remove') data.todos = data.todos.filter((t) => t.id !== p.id);
      else if (name === 'clearDone') data.todos = data.todos.filter((t) => !t.done);
      save();
      if (name !== 'text') publish();
      return true;
    },
  };
};
