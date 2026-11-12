'use strict';
// Vær fra MET Norway (yr.no) – locationforecast 2.0. Gratis, ingen nøkkel.
const { net } = require('electron');

module.exports = function weatherProvider(ctx) {
  const cfg = { name: 'Avaldsnes', lat: 59.35, lon: 5.28, ...(ctx.config.weather || {}) };
  let data = { name: cfg.name, loading: true };
  let timer = null;
  let expires = 0;
  let lastModified = null;
  let raw = null;

  async function fetchForecast(force = false) {
    if (!force && Date.now() < expires && raw) return summarize();
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${Number(cfg.lat).toFixed(4)}&lon=${Number(cfg.lon).toFixed(4)}`;
    try {
      const headers = { 'User-Agent': cfg.userAgent || 'Zapdock/1.0 (Windows desktop dock)' };
      if (lastModified && raw) headers['If-Modified-Since'] = lastModified;
      const res = await net.fetch(url, { headers });
      if (res.status === 304) {
        expires = Date.parse(res.headers.get('expires')) || Date.now() + 30 * 60000;
        return summarize();
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      raw = await res.json();
      lastModified = res.headers.get('last-modified');
      expires = Date.parse(res.headers.get('expires')) || Date.now() + 30 * 60000;
      return summarize();
    } catch (err) {
      data = { ...data, loading: false, error: `Kunne ikke hente vær: ${err.message}` };
      ctx.publish(data);
      return data;
    }
  }

  function summarize() {
    const series = (raw && raw.properties && raw.properties.timeseries) || [];
    const now = Date.now();
    const pick = (t) => {
      const d = t.data || {};
      const next = d.next_1_hours || d.next_6_hours || d.next_12_hours || {};
      return {
        time: Date.parse(t.time),
        temp: d.instant?.details?.air_temperature,
        wind: d.instant?.details?.wind_speed,
        windDir: d.instant?.details?.wind_from_direction,
        humidity: d.instant?.details?.relative_humidity,
        symbol: next.summary?.symbol_code || null,
        precip: next.details?.precipitation_amount ?? 0,
      };
    };
    const upcoming = series.filter((t) => Date.parse(t.time) >= now - 3600000);
    const hours = upcoming.slice(0, 13).map(pick);
    const days = new Map();
    for (const t of series) {
      const p = pick(t);
      const d = new Date(p.time);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      if (!days.has(key)) days.set(key, { date: p.time, min: Infinity, max: -Infinity, precip: 0, symbol: null });
      const day = days.get(key);
      if (typeof p.temp === 'number') {
        day.min = Math.min(day.min, p.temp);
        day.max = Math.max(day.max, p.temp);
      }
      const h = d.getHours();
      if (t.data?.next_1_hours) day.precip += t.data.next_1_hours.details?.precipitation_amount || 0;
      else if (t.data?.next_6_hours && h % 6 === 0) day.precip += t.data.next_6_hours.details?.precipitation_amount || 0;
      if (!day.symbol || (h >= 12 && h <= 14 && p.symbol)) day.symbol = p.symbol || day.symbol;
    }
    data = {
      name: cfg.name,
      loading: false,
      error: null,
      now: hours[0] || null,
      hours: hours.slice(1),
      days: [...days.values()].filter((d) => d.min !== Infinity).slice(0, 7)
        .map((d) => ({ ...d, precip: Math.round(d.precip * 10) / 10 })),
      updatedAt: Date.now(),
    };
    ctx.publish(data);
    return data;
  }

  return {
    start() {
      fetchForecast();
      timer = setInterval(() => fetchForecast(), 10 * 60000);
    },
    stop() { clearInterval(timer); },
    data: () => data,
    action(name) {
      if (name === 'refresh') return fetchForecast(true);
      if (name === 'openYr') return ctx.shell.openExternal(`https://www.yr.no/nb/værvarsel/daglig-tabell/${cfg.lat},${cfg.lon}`);
      return null;
    },
  };
};
