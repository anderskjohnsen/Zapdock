'use strict';
/* global ZD, zdIcon */
// Spilles nå: Spotify (eller annen mediespiller) + volum.
window.ZD_MODULES = window.ZD_MODULES || {};

window.ZD_MODULES.media = ({ mod, body, action }) => {
  const root = document.createElement('div');
  root.className = 'media';
  body.appendChild(root);
  let d = null;
  let seekTimer = null;
  let volDrag = false;

  root.innerHTML = `
    <div class="m-art"><img alt=""><div class="m-noart">${zdIcon(mod.icon || 'spotify')}</div></div>
    <div class="m-info"><div class="m-title"></div><div class="m-artist"></div><div class="m-album"></div></div>
    <div class="m-time"><span class="t0"></span><div class="m-bar"><div></div></div><span class="t1"></span></div>
    <div class="m-ctrl">
      <button data-a="prev" title="Forrige">${zdIcon('prev')}</button>
      <button data-a="toggle" class="big" title="Spill av / pause"></button>
      <button data-a="next" title="Neste">${zdIcon('next')}</button>
    </div>
    <div class="m-vol"><button data-a="mute" class="vol-ico"></button><input type="range" min="0" max="100" step="1"><span class="vol-txt"></span></div>
    <div class="m-foot"><span class="m-app"></span><button data-a="openApp" class="link">Åpne ${ZD.esc(mod.preferApp || 'Spotify')}</button></div>
    <div class="m-empty"></div>`;
  const $ = (s) => root.querySelector(s);
  root.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => action(b.dataset.a)));
  const vol = $('.m-vol input');
  vol.addEventListener('input', () => {
    volDrag = true;
    $('.vol-txt').textContent = `${vol.value} %`;
    clearTimeout(seekTimer);
    seekTimer = setTimeout(() => action('volume', { value: vol.value / 100 }), 30);
  });
  vol.addEventListener('change', () => { volDrag = false; });

  const fmt = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  function position() {
    if (!d || !d.active) return 0;
    let p = d.position || 0;
    if (d.status === 'Playing' && d.receivedAt) p += (Date.now() - d.receivedAt) / 1000;
    return Math.min(p, d.duration || p);
  }

  function tick() {
    if (!d || !d.active || !d.duration) {
      $('.m-time').style.visibility = 'hidden';
      return;
    }
    $('.m-time').style.visibility = '';
    const p = position();
    $('.t0').textContent = fmt(p);
    $('.t1').textContent = fmt(d.duration);
    $('.m-bar div').style.width = `${Math.min(100, (p / d.duration) * 100)}%`;
  }

  function render() {
    const active = d && d.active;
    root.classList.toggle('inactive', !active);
    if (!d || !d.supported) {
      $('.m-empty').textContent = 'Spilles nå krever Windows 10/11.';
    } else if (!active) {
      $('.m-empty').textContent = `Ingenting spilles. Start ${mod.preferApp || 'Spotify'} eller en annen mediespiller.`;
    } else $('.m-empty').textContent = '';
    const img = $('.m-art img');
    if (active && d.artwork) {
      if (img.src !== d.artwork) img.src = d.artwork;
      img.style.display = '';
      $('.m-noart').style.display = 'none';
      root.style.setProperty('--art', `url("${d.artwork}")`);
    } else {
      img.style.display = 'none';
      $('.m-noart').style.display = '';
      root.style.removeProperty('--art');
    }
    $('.m-title').textContent = active ? d.title || 'Ukjent' : '';
    $('.m-artist').textContent = active ? d.artist || '' : '';
    $('.m-album').textContent = active ? d.album || '' : '';
    $('.m-app').textContent = active && d.app ? `via ${d.app.replace(/\.exe$/i, '').replace(/^.*[!\\]/, '')}` : '';
    $('[data-a="toggle"]').innerHTML = zdIcon(active && d.status === 'Playing' ? 'pause' : 'play');
    const a = d && d.audio;
    $('.m-vol').style.display = a && a.volume != null ? '' : 'none';
    if (a && a.volume != null) {
      if (!volDrag) vol.value = Math.round(a.volume * 100);
      $('.vol-txt').textContent = `${Math.round(a.volume * 100)} %`;
      $('.vol-ico').innerHTML = zdIcon(a.muted || a.volume === 0 ? 'vol0' : a.volume < 0.5 ? 'vol1' : 'vol2');
    }
    tick();
  }
  setInterval(tick, 500);
  return { update(data) { d = data; render(); } };
};
