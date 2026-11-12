'use strict';
/* global ZD */
// Vær fra yr.no / MET.
window.ZD_MODULES = window.ZD_MODULES || {};

window.ZD_MODULES.weather = ({ body, action, toolButton }) => {
  const root = document.createElement('div');
  root.className = 'weather scroll';
  body.appendChild(root);
  toolButton('reload', 'Oppdater', () => action('refresh'));
  toolButton('external', 'Åpne på yr.no', () => action('openYr'));

  const windDir = (deg) => (deg == null ? '' : ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'][Math.round(deg / 45) % 8]);

  function render(d) {
    if (!d || d.loading) {
      root.innerHTML = '<div class="card empty">Henter værvarsel …</div>';
      return;
    }
    if (!d.now) {
      root.innerHTML = `<div class="card empty">${ZD.esc(d.error || 'Ingen data')}</div>`;
      return;
    }
    const n = d.now;
    const hours = d.hours.map((h) => `<div class="hr"><span>${new Date(h.time).getHours()}</span><b>${ZD.weatherEmoji(h.symbol)}</b><span class="${h.temp < 0 ? 'cold' : 'warm'}">${ZD.temp(h.temp)}</span><small>${h.precip ? `${h.precip}` : ''}</small></div>`).join('');
    const days = d.days.map((x, i) => {
      const name = i === 0 ? 'I dag' : i === 1 ? 'I morgen' : new Date(x.date).toLocaleDateString('nb-NO', { weekday: 'long' });
      return `<div class="day"><span class="dn">${name}</span><b>${ZD.weatherEmoji(x.symbol)}</b><span class="mm">${x.precip ? `${x.precip} mm` : ''}</span>
        <span class="tmax ${x.max < 0 ? 'cold' : 'warm'}">${ZD.temp(x.max)}</span><span class="tmin">${ZD.temp(x.min)}</span></div>`;
    }).join('');
    root.innerHTML = `
      <div class="card now">
        <div class="now-main"><span class="now-ico">${ZD.weatherEmoji(n.symbol)}</span><span class="now-temp ${n.temp < 0 ? 'cold' : 'warm'}">${ZD.temp(n.temp)}</span></div>
        <div class="now-meta"><b>${ZD.esc(d.name)}</b><span>Vind ${n.wind ?? '–'} m/s ${windDir(n.windDir)}</span><span>Nedbør ${n.precip} mm neste time</span><span>Fuktighet ${Math.round(n.humidity ?? 0)} %</span></div>
      </div>
      <div class="card"><h3>Neste timer</h3><div class="hours">${hours}</div></div>
      <div class="card"><h3>Neste dager</h3>${days}</div>
      <div class="foot">Data fra MET Norway / yr.no · oppdatert ${ZD.clock(d.updatedAt)}${d.error ? ` · ${ZD.esc(d.error)}` : ''}</div>`;
  }
  return { update: render };
};
