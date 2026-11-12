'use strict';
// Liten iCalendar-parser (RFC 5545) med det som trengs for Google/Outlook/iCloud-kalendere:
// heldagsavtaler, tidssoner (TZID), gjentakelser (RRULE), unntak (EXDATE) og flyttede forekomster
// (RECURRENCE-ID).

const DAY = 24 * 3600 * 1000;
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// Windows-tidssonenavn som Outlook/Exchange bruker -> IANA.
const WINDOWS_TZ = {
  'W. Europe Standard Time': 'Europe/Berlin',
  'Romance Standard Time': 'Europe/Paris',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'GMT Standard Time': 'Europe/London',
  'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'FLE Standard Time': 'Europe/Helsinki',
  'E. Europe Standard Time': 'Europe/Chisinau',
  'Eastern Standard Time': 'America/New_York',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Central Standard Time': 'America/Chicago',
  UTC: 'UTC',
};

function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
}

function unescapeText(v) {
  return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

function parseLine(line) {
  const colon = findValueColon(line);
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = head.split(';');
  const name = parts.shift().toUpperCase();
  const params = {};
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name, params, value };
}

function findValueColon(line) {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (c === ':' && !quoted) return i;
  }
  return -1;
}

const tzFormatters = new Map();
function tzFormatter(tz) {
  if (!tzFormatters.has(tz)) {
    let f = null;
    try {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch (_) { /* ukjent sone */ }
    tzFormatters.set(tz, f);
  }
  return tzFormatters.get(tz);
}

function resolveTz(tzid) {
  if (!tzid) return null;
  const clean = tzid.replace(/^\//, '');
  if (WINDOWS_TZ[clean]) return WINDOWS_TZ[clean];
  return tzFormatter(clean) ? clean : null;
}

/** Offset (ms) mellom tidssonen og UTC ved et gitt tidspunkt. */
function tzOffset(ts, tz) {
  const f = tzFormatter(tz);
  if (!f) return -new Date(ts).getTimezoneOffset() * 60000;
  const p = Object.fromEntries(f.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** "Veggklokke"-ms (komponenter tolket som UTC) -> ekte tidspunkt. */
function wallToReal(wall, zone) {
  if (zone === 'UTC') return wall;
  if (!zone) {
    // flytende tid = lokal tid
    const d = new Date(wall);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()).getTime();
  }
  let real = wall - tzOffset(wall, zone);
  real = wall - tzOffset(real, zone);
  return real;
}

/** Tolker DTSTART/DTEND/EXDATE-verdi. Returnerer { wall, zone, allDay }. */
function parseDate(value, params = {}) {
  const v = value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  const allDay = params.VALUE === 'DATE' || h === undefined;
  const wall = Date.UTC(+y, +mo - 1, +d, +(h || 0), +(mi || 0), +(s || 0));
  let zone = null;
  if (allDay) zone = null;
  else if (z) zone = 'UTC';
  else zone = resolveTz(params.TZID);
  return { wall, zone, allDay };
}

function parseDuration(v) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return 0;
  const [, sign, w, d, h, mi, s] = m;
  const ms = ((+w || 0) * 7 * DAY) + ((+d || 0) * DAY) + ((+h || 0) * 3600000) + ((+mi || 0) * 60000) + ((+s || 0) * 1000);
  return sign === '-' ? -ms : ms;
}

function parseRRule(v) {
  const r = {};
  for (const part of v.split(';')) {
    const [k, val] = part.split('=');
    if (k && val !== undefined) r[k.toUpperCase()] = val;
  }
  return {
    freq: r.FREQ,
    interval: Math.max(1, parseInt(r.INTERVAL || '1', 10)),
    count: r.COUNT ? parseInt(r.COUNT, 10) : null,
    until: r.UNTIL ? parseDate(r.UNTIL) : null,
    byDay: r.BYDAY ? r.BYDAY.split(',').map((x) => {
      const mm = /^([+-]?\d+)?([A-Z]{2})$/.exec(x.trim());
      return mm ? { n: mm[1] ? parseInt(mm[1], 10) : 0, wd: WEEKDAYS.indexOf(mm[2]) } : null;
    }).filter((x) => x && x.wd >= 0) : null,
    byMonthDay: r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map((x) => parseInt(x, 10)) : null,
    byMonth: r.BYMONTH ? r.BYMONTH.split(',').map((x) => parseInt(x, 10)) : null,
  };
}

function parseIcs(text) {
  const lines = unfold(text).split('\n');
  const events = [];
  let cur = null;
  let depth = 0;
  for (const raw of lines) {
    if (!raw) continue;
    const line = parseLine(raw);
    if (!line) continue;
    if (line.name === 'BEGIN') {
      if (line.value.toUpperCase() === 'VEVENT') {
        cur = { exdates: [] };
        depth = 0;
      } else if (cur) depth++;
      continue;
    }
    if (line.name === 'END') {
      if (line.value.toUpperCase() === 'VEVENT' && cur) {
        if (cur.start) events.push(cur);
        cur = null;
      } else if (cur) depth--;
      continue;
    }
    if (!cur || depth > 0) continue; // hopp over VALARM o.l.
    switch (line.name) {
      case 'UID': cur.uid = line.value; break;
      case 'SUMMARY': cur.summary = unescapeText(line.value); break;
      case 'LOCATION': cur.location = unescapeText(line.value); break;
      case 'DESCRIPTION': cur.description = unescapeText(line.value); break;
      case 'STATUS': cur.status = line.value.toUpperCase(); break;
      case 'DTSTART': cur.start = parseDate(line.value, line.params); break;
      case 'DTEND': cur.end = parseDate(line.value, line.params); break;
      case 'DURATION': cur.duration = parseDuration(line.value); break;
      case 'RRULE': cur.rrule = parseRRule(line.value); break;
      case 'RECURRENCE-ID': cur.recurrenceId = parseDate(line.value, line.params); break;
      case 'EXDATE':
        for (const v of line.value.split(',')) {
          const d = parseDate(v, line.params);
          if (d) cur.exdates.push(d);
        }
        break;
      default: break;
    }
  }
  return events;
}

function realOf(d) {
  return d.allDay ? wallToReal(d.wall, null) : wallToReal(d.wall, d.zone);
}

function addMonthsWall(wall, n, dayOfMonth) {
  const d = new Date(wall);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const target = new Date(Date.UTC(y, m, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  const dim = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const day = dayOfMonth < 0 ? dim + dayOfMonth + 1 : dayOfMonth;
  if (day < 1 || day > dim) return null;
  target.setUTCDate(day);
  return target.getTime();
}

function nthWeekdayOfMonth(year, month, wd, n, timeMs) {
  const first = new Date(Date.UTC(year, month, 1));
  const dim = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const days = [];
  for (let d = 1; d <= dim; d++) {
    first.setUTCDate(d);
    if (first.getUTCDay() === wd) days.push(d);
  }
  const pick = n > 0 ? days[n - 1] : days[days.length + n];
  return pick ? Date.UTC(year, month, pick) + timeMs : null;
}

/** Genererer "veggklokke"-starttider for en gjentakende avtale. */
function* recurrence(ev, maxWall) {
  const r = ev.rrule;
  const start = ev.start.wall;
  const startDate = new Date(start);
  const timeMs = start - Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
  const untilWall = r.until ? (r.until.zone === 'UTC' && ev.start.zone && ev.start.zone !== 'UTC'
    ? r.until.wall + tzOffset(r.until.wall, ev.start.zone)
    : r.until.wall) : Infinity;
  let emitted = 0;
  const limit = (w) => w > maxWall || w > untilWall || (r.count != null && emitted >= r.count);

  if (r.freq === 'DAILY') {
    for (let w = start; ; w += r.interval * DAY) {
      if (limit(w)) return;
      if (r.byMonth && !r.byMonth.includes(new Date(w).getUTCMonth() + 1)) continue;
      if (r.byDay && !r.byDay.some((b) => b.wd === new Date(w).getUTCDay())) continue;
      emitted++;
      yield w;
    }
  } else if (r.freq === 'WEEKLY') {
    const days = r.byDay ? r.byDay.map((b) => b.wd) : [startDate.getUTCDay()];
    // Uken starter mandag (WKST=MO, som Google/Outlook bruker i Norge).
    const weekStart = start - (((startDate.getUTCDay() + 6) % 7) * DAY) - timeMs;
    for (let wk = 0; ; wk += r.interval) {
      const base = weekStart + wk * 7 * DAY;
      if (base > maxWall || base > untilWall) return;
      const ordered = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      for (const wd of ordered) {
        const w = base + ((wd + 6) % 7) * DAY + timeMs;
        if (w < start) continue;
        if (limit(w)) return;
        emitted++;
        yield w;
      }
    }
  } else if (r.freq === 'MONTHLY') {
    for (let i = 0; i < 1200; i += r.interval) {
      const ref = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + i, 1));
      const y = ref.getUTCFullYear();
      const mo = ref.getUTCMonth();
      if (Date.UTC(y, mo, 1) > maxWall || Date.UTC(y, mo, 1) > untilWall) return;
      const cands = [];
      if (r.byDay) {
        for (const b of r.byDay) {
          if (b.n) {
            const w = nthWeekdayOfMonth(y, mo, b.wd, b.n, timeMs);
            if (w != null) cands.push(w);
          } else {
            const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
            for (let d = 1; d <= dim; d++) if (new Date(Date.UTC(y, mo, d)).getUTCDay() === b.wd) cands.push(Date.UTC(y, mo, d) + timeMs);
          }
        }
      } else {
        for (const md of r.byMonthDay || [startDate.getUTCDate()]) {
          const w = addMonthsWall(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1) + timeMs, i, md);
          if (w != null) cands.push(w);
        }
      }
      for (const w of cands.sort((a, b) => a - b)) {
        if (w < start) continue;
        if (limit(w)) return;
        emitted++;
        yield w;
      }
    }
  } else if (r.freq === 'YEARLY') {
    for (let i = 0; i < 200; i += r.interval) {
      const y = startDate.getUTCFullYear() + i;
      const months = r.byMonth ? r.byMonth.map((m) => m - 1) : [startDate.getUTCMonth()];
      const cands = [];
      for (const mo of months) {
        if (r.byDay && r.byDay.some((b) => b.n)) {
          for (const b of r.byDay) {
            const w = nthWeekdayOfMonth(y, mo, b.wd, b.n || 1, timeMs);
            if (w != null) cands.push(w);
          }
        } else {
          const day = (r.byMonthDay && r.byMonthDay[0]) || startDate.getUTCDate();
          const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
          if (day <= dim) cands.push(Date.UTC(y, mo, day) + timeMs);
        }
      }
      for (const w of cands.sort((a, b) => a - b)) {
        if (w < start) continue;
        if (limit(w)) return;
        emitted++;
        yield w;
      }
      if (Date.UTC(y + 1, 0, 1) > maxWall) return;
    }
  } else {
    yield start;
  }
}

/**
 * Utvider avtaler til konkrete forekomster i [from, to).
 * Returnerer [{ uid, summary, location, start, end, allDay }] sortert på start.
 */
function expandEvents(events, from, to) {
  const out = [];
  const overrides = new Map(); // uid -> Set(real start ms)
  for (const ev of events) {
    if (ev.recurrenceId && ev.uid) {
      if (!overrides.has(ev.uid)) overrides.set(ev.uid, new Set());
      overrides.get(ev.uid).add(realOf(ev.recurrenceId));
    }
  }
  for (const ev of events) {
    if (ev.status === 'CANCELLED') continue;
    const allDay = ev.start.allDay;
    const zone = allDay ? null : ev.start.zone;
    let durWall;
    if (ev.end) durWall = ev.end.wall - ev.start.wall;
    else if (ev.duration) durWall = ev.duration;
    else durWall = allDay ? DAY : 0;

    const push = (wall) => {
      const start = wallToReal(wall, zone);
      const end = allDay ? wallToReal(wall + durWall, null) : start + durWall;
      if (end <= from && !(end === start && start >= from)) return;
      if (start >= to) return;
      out.push({ uid: ev.uid, summary: ev.summary || '(uten tittel)', location: ev.location || '', start, end, allDay });
    };

    if (!ev.rrule || ev.recurrenceId) {
      push(ev.start.wall);
      continue;
    }
    const ex = new Set(ev.exdates.map(realOf));
    const ov = overrides.get(ev.uid) || new Set();
    // Ta med litt slingringsmonn i veggklokke-tid for tidssoneforskjeller.
    const maxWall = to + 2 * DAY;
    let n = 0;
    for (const wall of recurrence(ev, maxWall)) {
      if (++n > 5000) break;
      const real = wallToReal(wall, zone);
      if (ex.has(real) || ov.has(real)) continue;
      if (real + Math.max(durWall, 0) < from - DAY) continue;
      push(wall);
    }
  }
  return out.sort((a, b) => a.start - b.start || (b.allDay - a.allDay));
}

module.exports = { parseIcs, expandEvents, parseDate, wallToReal };
