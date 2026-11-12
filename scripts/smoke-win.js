'use strict';
// Røyktest på Windows (kjøres i CI): Win32-bindinger via koffi + PowerShell-hjelpeprosessen.
const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');

if (process.platform !== 'win32') {
  console.log('smoke-win: hopper over (ikke Windows)');
  process.exit(0);
}

const win32 = require('../src/main/win32');
assert.ok(win32.available, 'win32-bindinger skal være tilgjengelige');
const wins = win32.listWindows();
assert.ok(Array.isArray(wins));
console.log(`listWindows: ${wins.length} vinduer`, wins.slice(0, 3).map((w) => `${w.title} [${path.basename(w.exe)}]`));
console.log('forgrunn:', win32.getForeground());
console.log('oppgavelinje-håndtak:', win32.taskbarHandles());

const script = path.join(__dirname, '..', 'src', 'main', 'helpers', 'winhelper.ps1');
const ps = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], { windowsHide: true });
let out = '';
let err = '';
ps.stdout.on('data', (d) => { out += d; });
ps.stderr.on('data', (d) => { err += d; });
setTimeout(() => ps.stdin.write('ping\n'), 4000);
setTimeout(() => ps.stdin.end(), 7000); // lukket stdin skal avslutte hjelperen
const killer = setTimeout(() => {
  ps.kill();
  console.error('hjelperen avsluttet ikke etter at stdin ble lukket');
  process.exit(1);
}, 20000);
ps.on('exit', (code) => {
  clearTimeout(killer);
  const msgs = out.split(/\r?\n/).filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch (_) { return { raw: l }; }
  });
  console.log('hjelper-meldinger:', msgs.map((m) => m.type || m.raw));
  if (err) console.log('stderr:', err.trim());
  assert.ok(msgs.some((m) => m.type === 'ready'), 'hjelperen skal melde ready');
  assert.ok(msgs.some((m) => m.type === 'pong'), 'hjelperen skal svare på ping');
  assert.ok(msgs.some((m) => m.type === 'audio'), 'hjelperen skal sende audio-status (evt. med feil)');
  assert.strictEqual(code, 0, `hjelperen skal avslutte rent (kode ${code})`);
  console.log('smoke-win: OK');
});
