'use strict';
// Kalender fra iCal-lenker (Google: Innstillinger -> kalender -> "Hemmelig adresse i iCal-format").
const { net } = require('electron');
const { parseIcs, expandEvents } = require('../lib/ics');

const COLORS = ['#7c9cff', '#46d19a', '#f2b84b', '#ff6b6b', '#b38cff', '#4fc3f7'];

module.exports = function calendarProvider(ctx) {
  const cfg = { sources: [], days: 14, reminderMinutes: 15, ...(ctx.config.calendar || {}) };
  const parsed = new Map(); // url -> events
  const errors = {};
  const reminded = new Set();
  let data = { events: [], sources: [], loading: true };
  let fetchTimer = null;
  let tickTimer = null;

  function sources() {
    return (cfg.sources || []).filter((s) => s && s.url).map((s, i) => ({
      name: s.name || `Kalender ${i + 1}`,
      url: s.url.replace(/^webcal:\/\//i, 'https://'),
      color: s.color || COLORS[i % COLORS.length],
    }));
  }

  async function fetchAll() {
    await Promise.all(sources().map(async (s) => {
      try {
        const res = await net.fetch(s.url, { headers: { 'User-Agent': 'Zapdock/1.0' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        parsed.set(s.url, parseIcs(await res.text()));
        delete errors[s.name];
      } catch (err) {
        errors[s.name] = err.message;
      }
    }));
    rebuild();
  }

  function rebuild() {
    const now = Date.now();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const to = start.getTime() + cfg.days * 24 * 3600000;
    const events = [];
    for (const s of sources()) {
      const evs = parsed.get(s.url);
      if (!evs) continue;
      for (const e of expandEvents(evs, start.getTime(), to)) events.push({ ...e, source: s.name, color: s.color });
    }
    events.sort((a, b) => a.start - b.start || (b.allDay - a.allDay));
    data = {
      loading: false,
      configured: sources().length > 0,
      sources: sources().map(({ name, color }) => ({ name, color, error: errors[name] || null })),
      events: events.filter((e) => e.end > now || e.allDay),
      updatedAt: now,
    };
    ctx.publish(data);
  }

  function checkReminders() {
    if (!cfg.reminderMinutes) return;
    const now = Date.now();
    for (const e of data.events || []) {
      if (e.allDay) continue;
      const key = `${e.uid}|${e.start}`;
      const until = e.start - now;
      if (until > 0 && until <= cfg.reminderMinutes * 60000 && !reminded.has(key)) {
        reminded.add(key);
        const t = new Date(e.start).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
        ctx.notify({ title: `${t} ${e.summary}`, body: [e.location, e.source].filter(Boolean).join(' · '), onClick: () => ctx.openPanel() });
      }
    }
  }

  return {
    start() {
      fetchAll();
      fetchTimer = setInterval(fetchAll, 10 * 60000);
      tickTimer = setInterval(() => {
        checkReminders();
        // Fjern avtaler som er ferdige uten å vente på ny henting.
        if (data.events && data.events.some((e) => !e.allDay && e.end <= Date.now())) rebuild();
      }, 30000);
    },
    stop() {
      clearInterval(fetchTimer);
      clearInterval(tickTimer);
    },
    data: () => data,
    action(name) {
      if (name === 'refresh') return fetchAll();
      if (name === 'openGoogle') return ctx.shell.openExternal('https://calendar.google.com');
      return null;
    },
  };
};
