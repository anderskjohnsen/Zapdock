'use strict';
// Systemmonitor: CPU, minne, disker, oppetid.
const os = require('os');
const fs = require('fs');

function cpuTimes() {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    for (const v of Object.values(c.times)) total += v;
    idle += c.times.idle;
  }
  return { idle, total };
}

function listDrives() {
  if (process.platform !== 'win32') return ['/'];
  const out = [];
  for (let c = 67; c <= 90; c++) { // C..Z
    const d = `${String.fromCharCode(c)}:\\`;
    try {
      fs.accessSync(d);
      out.push(d);
    } catch (_) { /* finnes ikke */ }
  }
  return out;
}

module.exports = function systemProvider(ctx) {
  let prev = cpuTimes();
  const history = [];
  let drives = listDrives();
  let data = null;
  let timer = null;
  let n = 0;

  function sample() {
    const cur = cpuTimes();
    const dt = cur.total - prev.total;
    const cpu = dt > 0 ? Math.round((1 - (cur.idle - prev.idle) / dt) * 100) : 0;
    prev = cur;
    history.push(cpu);
    if (history.length > 60) history.shift();
    if (n++ % 30 === 0) drives = listDrives();
    const disks = [];
    for (const d of drives) {
      try {
        const s = fs.statfsSync(d);
        const total = s.blocks * s.bsize;
        if (total > 0) disks.push({ name: d.replace(/\\$/, ''), total, used: total - s.bavail * s.bsize });
      } catch (_) { /* utilgjengelig (f.eks. tom kortleser) */ }
    }
    const total = os.totalmem();
    data = {
      cpu,
      history: [...history],
      cores: os.cpus().length,
      cpuModel: (os.cpus()[0] || {}).model || '',
      mem: { total, used: total - os.freemem() },
      disks,
      uptime: os.uptime(),
      host: os.hostname(),
    };
    ctx.publish(data);
  }

  return {
    start() {
      sample();
      timer = setInterval(sample, (ctx.mod.intervalSeconds || 2) * 1000);
    },
    stop() { clearInterval(timer); },
    data: () => data,
    action(name) {
      if (name === 'taskmgr' && process.platform === 'win32') require('child_process').spawn('taskmgr.exe', [], { detached: true, stdio: 'ignore' }).unref();
      return null;
    },
  };
};
