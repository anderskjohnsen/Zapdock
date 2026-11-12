'use strict';
// Claude Code: bruk + aktive økter. Varsler når en økt trenger svar.
const { ClaudeUsage } = require('../claudeUsage');

module.exports = function claudeProvider(ctx) {
  const cfg = ctx.config.claude || {};
  const usage = new ClaudeUsage(cfg);
  const dismissed = new Map(); // sessionId -> waitingSince som ble avvist
  const prevStatus = new Map();
  let data = null;
  let timer = null;
  let first = true;

  function decorate(summary) {
    for (const s of summary.sessions) {
      if (s.needsAnswer && dismissed.get(s.id) === s.waitingSince) {
        s.needsAnswer = false;
        s.dismissed = true;
      }
    }
    summary.needsAnswerCount = summary.sessions.filter((s) => s.needsAnswer).length;
    summary.waitDarkenMinutes = cfg.waitDarkenMinutes || 20;
    return summary;
  }

  function notifyTransitions(summary) {
    if (cfg.notify === false) return;
    for (const s of summary.sessions) {
      const before = prevStatus.get(s.id);
      prevStatus.set(s.id, s.status);
      if (first || !s.needsAnswer || before === s.status) continue;
      if (before !== 'working' && before !== undefined) continue;
      ctx.notify({
        title: s.status === 'blocked' ? `Claude venter på tillatelse – ${s.project}` : `Claude er ferdig – ${s.project}`,
        body: s.title || 'Økten venter på svar fra deg.',
        onClick: () => focus(s.id),
      });
    }
  }

  function refresh() {
    try {
      data = decorate(usage.scan());
      notifyTransitions(data);
      first = false;
      ctx.publish(data);
    } catch (err) {
      console.error('[zapdock] claude:', err);
    }
    return data;
  }

  function focus(id) {
    const s = data && data.sessions.find((x) => x.id === id);
    if (s) {
      const proj = (s.project || '').toLowerCase();
      const wins = ctx.taskbarWindows();
      const hit = (proj && wins.find((w) => (w.title || '').toLowerCase().includes(proj)))
        || wins.find((w) => /✳|claude/i.test(w.title || '') && /terminal|code|cmd|powershell|pwsh|wezterm|alacritty|warp/i.test(w.exe || ''));
      if (hit) {
        ctx.win32.activate(hit.hwnd);
        return true;
      }
    }
    ctx.openPanel();
    return false;
  }

  return {
    start() {
      refresh();
      timer = setInterval(refresh, Math.max(3, cfg.refreshSeconds || 5) * 1000);
    },
    stop() { clearInterval(timer); },
    data: () => data,
    action(name, p = {}) {
      if (name === 'refresh') return refresh();
      if (name === 'focus') return focus(p.id);
      if (name === 'dismiss') {
        const s = data && data.sessions.find((x) => x.id === p.id);
        if (s) dismissed.set(s.id, s.waitingSince);
        return refresh();
      }
      if (name === 'openDir' && p.dir) return ctx.shell.openPath(p.dir);
      return null;
    },
  };
};
