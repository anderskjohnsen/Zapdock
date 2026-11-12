'use strict';
// Starter og overvåker PowerShell-hjelpeprosessen (media + volum). Restartes automatisk ved feil.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

const SCRIPT = path.join(__dirname, '..', 'helpers', 'winhelper.ps1').replace('app.asar', 'app.asar.unpacked');

class WinHelper extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.buf = '';
    this.media = { supported: false, active: false };
    this.audio = { volume: null, muted: false };
    this.ready = false;
    this.failures = 0;
    this.stopped = false;
    this.prefer = 'Spotify';
  }

  get available() {
    return process.platform === 'win32' && fs.existsSync(SCRIPT);
  }

  start() {
    if (!this.available || this.proc) return;
    this.stopped = false;
    const ps = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    this.proc = spawn(ps, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk) => this._onData(chunk));
    this.proc.stderr.on('data', (d) => console.error('[zapdock] winhelper:', String(d).trim()));
    this.proc.on('error', (err) => console.error('[zapdock] winhelper start feilet:', err.message));
    this.proc.on('exit', (code) => {
      this.proc = null;
      this.ready = false;
      if (this.stopped) return;
      this.failures++;
      const delay = Math.min(60000, 1000 * 2 ** Math.min(this.failures, 6));
      console.error(`[zapdock] winhelper avsluttet (${code}), starter på nytt om ${delay} ms`);
      setTimeout(() => this.start(), delay);
    });
  }

  stop() {
    this.stopped = true;
    if (this.proc) {
      try { this.proc.stdin.end(); } catch (_) { /* ignorer */ }
      const p = this.proc;
      setTimeout(() => { try { p.kill(); } catch (_) { /* ignorer */ } }, 1000);
    }
  }

  send(line) {
    if (this.proc && this.proc.stdin.writable) {
      this.proc.stdin.write(`${line}\n`);
      return true;
    }
    return false;
  }

  setPreferredApp(name) {
    this.prefer = name || '';
    this.send(`media prefer ${this.prefer}`);
  }

  _onData(chunk) {
    this.buf += chunk;
    let nl;
    while ((nl = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, nl).trim();
      this.buf = this.buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch (_) {
        continue;
      }
      if (msg.type === 'ready') {
        this.ready = true;
        this.failures = 0;
        if (this.prefer) this.send(`media prefer ${this.prefer}`);
      } else if (msg.type === 'media') {
        msg.receivedAt = Date.now();
        this.media = msg;
        this.emit('media', msg);
      } else if (msg.type === 'audio') {
        this.audio = msg;
        this.emit('audio', msg);
      } else if (msg.type === 'error') {
        console.error(`[zapdock] winhelper ${msg.scope}:`, msg.message);
      }
    }
  }
}

module.exports = { WinHelper };
