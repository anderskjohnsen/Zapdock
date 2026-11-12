'use strict';
// Leser Claude Code sine lokale transkripsjoner (~/.claude/projects/**/*.jsonl)
// og regner ut bruk: aktive økter, nåværende 5-timersblokk, i dag og siste 7 dager.
// Filene leses inkrementelt, så polling er billig også med store økter.

const fs = require('fs');
const os = require('os');
const path = require('path');

const HOUR = 3600 * 1000;
const BLOCK_MS = 5 * HOUR;
const LOOKBACK_MS = 8 * 24 * HOUR;

function defaultDirs(extra = []) {
  const dirs = [];
  if (process.env.CLAUDE_CONFIG_DIR) dirs.push(...process.env.CLAUDE_CONFIG_DIR.split(/[,;]/));
  dirs.push(path.join(os.homedir(), '.claude'), path.join(os.homedir(), '.config', 'claude'));
  dirs.push(...extra);
  return [...new Set(dirs.filter(Boolean).map((d) => path.resolve(d)))];
}

function walkJsonl(dir, depth, out, minMtime) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth > 0) walkJsonl(p, depth - 1, out, minMtime);
    } else if (e.isFile() && e.name.endsWith('.jsonl')) {
      try {
        const st = fs.statSync(p);
        if (st.mtimeMs >= minMtime) out.push({ file: p, size: st.size, mtimeMs: st.mtimeMs });
      } catch (_) { /* fil forsvant */ }
    }
  }
}

function localDate(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyTokens() {
  return { input: 0, output: 0, cacheCreate: 0, cacheRead: 0, total: 0 };
}

function addTokens(t, e) {
  t.input += e.input;
  t.output += e.output;
  t.cacheCreate += e.cacheCreate;
  t.cacheRead += e.cacheRead;
  t.total += e.input + e.output + e.cacheCreate + e.cacheRead;
}

class ClaudeUsage {
  constructor({ dirs = [], activeMinutes = 15, blockTokenLimit = 0 } = {}) {
    this.dirs = defaultDirs(dirs);
    this.activeMs = activeMinutes * 60 * 1000;
    this.blockTokenLimit = blockTokenLimit;
    this.files = new Map();
  }

  _readFile(info) {
    let st = this.files.get(info.file);
    if (!st || info.size < st.offset) {
      st = { offset: 0, tail: Buffer.alloc(0), entries: [], sessionId: null, cwd: null, lastType: null, lastStop: null, lastTs: 0 };
      this.files.set(info.file, st);
    }
    st.mtimeMs = info.mtimeMs;
    st.isSubagent = /[\\/]subagents[\\/]/.test(info.file);
    if (info.size === st.offset) return st;

    const fd = fs.openSync(info.file, 'r');
    try {
      const len = info.size - st.offset;
      const chunk = Buffer.alloc(len);
      fs.readSync(fd, chunk, 0, len, st.offset);
      st.offset = info.size;
      const buf = st.tail.length ? Buffer.concat([st.tail, chunk]) : chunk;
      const lastNl = buf.lastIndexOf(0x0a);
      if (lastNl === -1) {
        st.tail = buf;
        return st;
      }
      st.tail = Buffer.from(buf.subarray(lastNl + 1));
      const text = buf.toString('utf8', 0, lastNl);
      for (const line of text.split('\n')) this._parseLine(st, line);
    } finally {
      fs.closeSync(fd);
    }
    return st;
  }

  _parseLine(st, line) {
    if (!line || line[0] !== '{') return;
    let o;
    try {
      o = JSON.parse(line);
    } catch (_) {
      return;
    }
    if (o.cwd) st.cwd = o.cwd;
    if (o.sessionId) st.sessionId = o.sessionId;
    const ts = o.timestamp ? Date.parse(o.timestamp) : NaN;
    if (!Number.isNaN(ts)) st.lastTs = Math.max(st.lastTs, ts);
    if (o.type === 'assistant' || o.type === 'user') {
      st.lastType = o.type;
      st.lastStop = o.type === 'assistant' ? o.message?.stop_reason ?? null : null;
    }
    const u = o.message?.usage;
    if (o.type !== 'assistant' || !u || Number.isNaN(ts)) return;
    const model = o.message.model || 'ukjent';
    if (model === '<synthetic>') return;
    st.entries.push({
      key: `${o.message.id || ''}:${o.requestId || o.uuid || ''}`,
      ts,
      model,
      sessionId: o.sessionId || st.sessionId,
      input: u.input_tokens || 0,
      output: u.output_tokens || 0,
      cacheCreate: u.cache_creation_input_tokens || 0,
      cacheRead: u.cache_read_input_tokens || 0,
    });
  }

  scan(now = Date.now()) {
    const found = [];
    const minMtime = now - LOOKBACK_MS;
    const dirsFound = [];
    for (const dir of this.dirs) {
      const projects = path.join(dir, 'projects');
      if (!fs.existsSync(projects)) continue;
      dirsFound.push(dir);
      walkJsonl(projects, 4, found, minMtime);
    }
    const live = new Set();
    for (const info of found) {
      live.add(info.file);
      try {
        this._readFile(info);
      } catch (err) {
        console.error('[zapdock] claude-usage:', info.file, err.message);
      }
    }
    for (const f of [...this.files.keys()]) if (!live.has(f)) this.files.delete(f);
    return this._summarize(now, dirsFound);
  }

  _summarize(now, dirsFound) {
    const byKey = new Map();
    for (const st of this.files.values()) {
      for (const e of st.entries) if (e.ts >= now - LOOKBACK_MS) byKey.set(e.key, e);
    }
    const entries = [...byKey.values()].sort((a, b) => a.ts - b.ts);

    // 5-timersblokker (samme modell som Claude sine bruksvinduer: starter på hel time).
    let block = null;
    for (const e of entries) {
      if (!block || e.ts >= block.start + BLOCK_MS || e.ts - block.lastTs >= BLOCK_MS) {
        block = { start: Math.floor(e.ts / HOUR) * HOUR, lastTs: e.ts, tokens: emptyTokens(), messages: 0, models: {} };
      }
      block.lastTs = e.ts;
      block.messages++;
      addTokens(block.tokens, e);
      block.models[e.model] = (block.models[e.model] || 0) + e.input + e.output + e.cacheCreate + e.cacheRead;
    }
    let activeBlock = null;
    if (block && now < block.start + BLOCK_MS) {
      const elapsedMin = Math.max(1, (now - block.start) / 60000);
      activeBlock = {
        start: block.start,
        end: block.start + BLOCK_MS,
        tokens: block.tokens,
        messages: block.messages,
        models: block.models,
        burnPerMin: Math.round(block.tokens.total / elapsedMin),
        limit: this.blockTokenLimit || 0,
        pct: this.blockTokenLimit ? Math.min(100, (block.tokens.total / this.blockTokenLimit) * 100) : null,
      };
    }

    // Per dag (lokal tid), siste 7 dager.
    const dayTotals = new Map();
    for (let i = 6; i >= 0; i--) dayTotals.set(localDate(now - i * 24 * HOUR), { tokens: emptyTokens(), messages: 0 });
    for (const e of entries) {
      const d = dayTotals.get(localDate(e.ts));
      if (d) {
        addTokens(d.tokens, e);
        d.messages++;
      }
    }
    const days = [...dayTotals.entries()].map(([date, v]) => ({ date, ...v }));

    // Økter
    const sessions = new Map();
    for (const st of this.files.values()) {
      const id = st.sessionId;
      if (!id) continue;
      let s = sessions.get(id);
      if (!s) {
        s = { id, cwd: null, lastActivity: 0, lastType: null, lastStop: null, mainMtime: 0, tokens: emptyTokens(), blockTokens: 0, model: null };
        sessions.set(id, s);
      }
      if (st.cwd && !s.cwd) s.cwd = st.cwd;
      s.lastActivity = Math.max(s.lastActivity, st.mtimeMs, st.lastTs);
      if (!st.isSubagent && st.mtimeMs >= s.mainMtime) {
        s.mainMtime = st.mtimeMs;
        s.lastType = st.lastType;
        s.lastStop = st.lastStop;
        if (st.cwd) s.cwd = st.cwd;
      }
    }
    for (const e of entries) {
      const s = sessions.get(e.sessionId);
      if (!s) continue;
      addTokens(s.tokens, e);
      s.model = e.model;
      if (activeBlock && e.ts >= activeBlock.start) s.blockTokens += e.input + e.output + e.cacheCreate + e.cacheRead;
    }
    const sessionList = [...sessions.values()]
      .filter((s) => now - s.lastActivity <= this.activeMs)
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .map((s) => ({
        id: s.id,
        project: s.cwd ? path.basename(s.cwd.replace(/[\\/]+$/, '')) : s.id.slice(0, 8),
        cwd: s.cwd,
        lastActivity: s.lastActivity,
        status: sessionStatus(s, now),
        model: s.model,
        tokens: s.tokens,
        blockTokens: s.blockTokens,
      }));

    const today = days[days.length - 1];
    return {
      generatedAt: now,
      dirs: this.dirs,
      dirsFound,
      block: activeBlock,
      today,
      days,
      sessions: sessionList,
      activeCount: sessionList.filter((s) => s.status === 'working').length,
    };
  }
}

function sessionStatus(s, now) {
  const idle = now - s.lastActivity;
  if (s.lastType === 'assistant' && s.lastStop === 'end_turn') return 'waiting';
  if (idle < 90 * 1000) return 'working';
  if (s.lastType === 'assistant' && s.lastStop === 'tool_use') return 'blocked'; // venter trolig på tillatelse
  return 'idle';
}

module.exports = { ClaudeUsage, defaultDirs, BLOCK_MS };
