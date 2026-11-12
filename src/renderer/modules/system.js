'use strict';
/* global ZD */
// Systemmonitor.
window.ZD_MODULES = window.ZD_MODULES || {};

window.ZD_MODULES.system = ({ body, action, toolButton }) => {
  const root = document.createElement('div');
  root.className = 'system scroll';
  body.appendChild(root);
  toolButton('system', 'Oppgavebehandling', () => action('taskmgr'));
  let battery = null;
  if (navigator.getBattery) navigator.getBattery().then((b) => { battery = b; }).catch(() => {});

  const bar = (pct, cls = '') => `<div class="progress ${cls}"><div style="width:${Math.min(100, pct).toFixed(1)}%"></div></div>`;
  const uptime = (s) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${d ? `${d} d ` : ''}${h} t ${m} min`;
  };

  return {
    update(d) {
      if (!d) return;
      const ram = (d.mem.used / d.mem.total) * 100;
      const pts = d.history.map((v, i) => `${(i / Math.max(1, d.history.length - 1)) * 100},${40 - (v / 100) * 38}`).join(' ');
      const disks = d.disks.map((x) => {
        const pct = (x.used / x.total) * 100;
        return `<div class="row"><span><b>${ZD.esc(x.name)}</b></span><span>${ZD.fmtBytes(x.total - x.used)} ledig av ${ZD.fmtBytes(x.total)}</span></div>${bar(pct, pct > 90 ? 'bad' : 'disk')}`;
      }).join('');
      const bat = battery && battery.level != null && !(battery.charging && battery.level === 1 && battery.chargingTime === 0)
        ? `<div class="card"><h3>Batteri</h3><div class="row"><span><b>${Math.round(battery.level * 100)} %</b></span><span>${battery.charging ? 'lader' : 'på batteri'}</span></div>${bar(battery.level * 100)}</div>` : '';
      root.innerHTML = `
        <div class="card"><h3>Prosessor</h3>
          <div class="row"><span><b style="font-size:22px">${d.cpu} %</b></span><span>${d.cores} kjerner</span></div>
          <svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="var(--ok)" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>
          <div class="row"><span>${ZD.esc(d.cpuModel)}</span></div></div>
        <div class="card"><h3>Minne</h3>
          <div class="row"><span><b>${ZD.fmtBytes(d.mem.used)}</b> av ${ZD.fmtBytes(d.mem.total)}</span><span>${ram.toFixed(0)} %</span></div>${bar(ram, 'ram')}</div>
        <div class="card"><h3>Disker</h3>${disks || '<div class="empty">–</div>'}</div>
        ${bat}
        <div class="foot">${ZD.esc(d.host)} · oppe i ${uptime(d.uptime)}</div>`;
    },
  };
};
