'use strict';
// Nedtellinger (pizza i ovnen, skjermtid, pomodoro …). Overlever omstart.
module.exports = function timerProvider(ctx) {
  const state = ctx.store.data;
  state.timers = state.timers || [];
  let interval = null;

  const publish = () => ctx.publish({ timers: state.timers, now: Date.now() });
  const persist = () => ctx.store.save();

  function tick() {
    const now = Date.now();
    let changed = false;
    for (const t of state.timers) {
      if (!t.paused && !t.done && t.endsAt <= now) {
        t.done = true;
        changed = true;
        ctx.notify({ title: `⏰ ${t.label || 'Tiden er ute'}`, body: `${formatDur(t.duration)} er gått.`, onClick: () => ctx.openPanel(), urgent: true });
      }
    }
    if (changed) persist();
    publish();
  }

  function formatDur(ms) {
    const m = Math.round(ms / 60000);
    return m >= 60 ? `${Math.floor(m / 60)} t ${m % 60} min` : `${m} min`;
  }

  return {
    start() {
      tick();
      interval = setInterval(tick, 1000);
    },
    stop() { clearInterval(interval); },
    data: () => ({ timers: state.timers, now: Date.now() }),
    action(name, p = {}) {
      const t = state.timers.find((x) => x.id === p.id);
      const now = Date.now();
      if (name === 'start') {
        const ms = Math.max(1, Number(p.minutes) || 0) * 60000;
        state.timers.push({ id: now, label: p.label || '', duration: ms, endsAt: now + ms, paused: false, left: 0, done: false });
      } else if (name === 'pause' && t && !t.paused && !t.done) {
        t.paused = true;
        t.left = Math.max(0, t.endsAt - now);
      } else if (name === 'resume' && t && t.paused) {
        t.paused = false;
        t.endsAt = now + t.left;
      } else if (name === 'add' && t) {
        const ms = (Number(p.minutes) || 1) * 60000;
        if (t.done) {
          t.done = false;
          t.endsAt = now + ms;
        } else if (t.paused) t.left += ms;
        else t.endsAt += ms;
        t.duration += ms;
      } else if (name === 'remove') {
        state.timers = state.timers.filter((x) => x.id !== p.id);
      } else if (name === 'clearDone') {
        state.timers = state.timers.filter((x) => !x.done);
      }
      persist();
      publish();
      return true;
    },
  };
};
