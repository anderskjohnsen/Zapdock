'use strict';
// Enkel test av ClaudeUsage mot syntetiske Claude Code-transkripsjoner.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ClaudeUsage } = require('../src/main/claudeUsage');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zapdock-test-'));
const proj = path.join(root, 'projects', '-home-anders-zapdock');
fs.mkdirSync(path.join(proj, 'sess-b', 'subagents'), { recursive: true });

const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
const asst = (id, msAgo, session, usage, stop = 'tool_use', model = 'claude-opus-5-5') => JSON.stringify({
  type: 'assistant', sessionId: session, cwd: '/home/anders/zapdock', timestamp: iso(msAgo), requestId: `req_${id}`,
  message: { id: `msg_${id}`, model, stop_reason: stop, usage },
});
const u = (i, o, cc = 0, cr = 0) => ({ input_tokens: i, output_tokens: o, cache_creation_input_tokens: cc, cache_read_input_tokens: cr });

// Økt A: ferdig, venter på bruker
const fileA = path.join(proj, 'sess-a.jsonl');
fs.writeFileSync(fileA, [
  JSON.stringify({ type: 'user', sessionId: 'sess-a', cwd: '/home/anders/zapdock', timestamp: iso(120000), message: { role: 'user', content: 'hei' } }),
  asst('1', 110000, 'sess-a', u(100, 50, 1000, 2000)),
  asst('1', 110000, 'sess-a', u(100, 50, 1000, 2000)), // duplikat (samme melding logget to ganger)
  asst('2', 100000, 'sess-a', u(10, 200), 'end_turn'),
].join('\n') + '\n');

// Økt B: jobber nå, med subagent
const fileB = path.join(proj, 'sess-b.jsonl');
const line6 = asst('6', 1000, 'sess-b', u(7, 3), 'end_turn');
fs.writeFileSync(fileB, asst('3', 5000, 'sess-b', u(1, 1)) + '\n' + line6.slice(0, 40)); // halvskrevet linje
fs.writeFileSync(path.join(proj, 'sess-b', 'subagents', 'agent-1.jsonl'), asst('4', 4000, 'sess-b', u(5, 5), 'end_turn', 'claude-haiku-5-5') + '\n');

// Gammel bruk (2 dager siden) – skal ikke være med i blokken
const fileOld = path.join(proj, 'old.jsonl');
fs.writeFileSync(fileOld, asst('5', 2 * 24 * 3600 * 1000, 'sess-old', u(1000, 1000)) + '\n');
const oldT = new Date(now - 2 * 24 * 3600 * 1000);
fs.utimesSync(fileOld, oldT, oldT);

const usage = new ClaudeUsage({ dirs: [root], activeMinutes: 15, blockTokenLimit: 100000 });
usage.dirs = [root];
let s = usage.scan(now);

assert.ok(s.block, 'skal ha aktiv blokk');
assert.strictEqual(s.block.messages, 4, 'duplikater fjernes, gammel bruk er utenfor blokken');
assert.strictEqual(s.block.tokens.total, 100 + 50 + 1000 + 2000 + 210 + 2 + 10);
assert.ok(s.block.pct > 0 && s.block.pct < 100);
assert.strictEqual(s.sessions.length, 2, 'gammel økt er ikke aktiv');
const a = s.sessions.find((x) => x.id === 'sess-a');
const b = s.sessions.find((x) => x.id === 'sess-b');
assert.strictEqual(a.status, 'waiting');
assert.strictEqual(b.status, 'working', 'subagent skal ikke styre status for hovedøkta');
assert.strictEqual(b.project, 'zapdock');
assert.strictEqual(b.tokens.total, 12);
assert.strictEqual(s.days.length, 7);
assert.strictEqual(s.activeCount, 1);

// Inkrementell lesing: resten av den halve linja skrives
fs.appendFileSync(fileB, line6.slice(40) + '\n');
s = usage.scan(now);
const b2 = s.sessions.find((x) => x.id === 'sess-b');
assert.strictEqual(b2.tokens.total, 22, 'halvskrevet linje fullføres');
assert.strictEqual(b2.status, 'waiting');
fs.appendFileSync(fileB, asst('7', 500, 'sess-b', u(1, 1), 'tool_use') + '\n');
s = usage.scan(now);
assert.strictEqual(s.sessions.find((x) => x.id === 'sess-b').tokens.total, 24, 'nye linjer leses inkrementelt');
// Fil som blir kortere (omskrevet) leses på nytt fra start
fs.writeFileSync(fileB, asst('3', 5000, 'sess-b', u(1, 1)) + '\n');
s = usage.scan(now);
assert.strictEqual(s.sessions.find((x) => x.id === 'sess-b').tokens.total, 12);

fs.rmSync(root, { recursive: true, force: true });
console.log('claude-usage: alle tester OK');
