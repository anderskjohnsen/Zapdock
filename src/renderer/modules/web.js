'use strict';
/* global zapdock, zdIcon */
// Innebygd nettleser (YouTube, Stremio, hva som helst) med egen innloggingsøkt per modul.
window.ZD_MODULES = window.ZD_MODULES || {};

window.ZD_MODULES.web = ({ mod, body, tools }) => {
  const wv = document.createElement('webview');
  wv.setAttribute('partition', `persist:${mod.id}`);
  wv.setAttribute('allowpopups', '');
  wv.setAttribute('src', mod.url);
  body.appendChild(wv);

  const btn = (icon, title, fn) => {
    const b = document.createElement('button');
    b.className = 'hbtn';
    b.title = title;
    b.innerHTML = zdIcon(icon);
    b.addEventListener('click', fn);
    tools.appendChild(b);
    return b;
  };
  const back = btn('back', 'Tilbake', () => wv.canGoBack() && wv.goBack());
  const fwd = btn('forward', 'Frem', () => wv.canGoForward() && wv.goForward());
  btn('reload', 'Last inn på nytt', () => wv.reload());
  btn('home', 'Hjem', () => wv.loadURL(mod.url));

  const url = document.createElement('input');
  url.className = 'url';
  url.spellcheck = false;
  url.value = mod.url;
  url.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    let v = url.value.trim();
    if (!v) return;
    if (!/^[a-z]+:\/\//i.test(v)) {
      v = /\s/.test(v) || !v.includes('.')
        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(v)}`
        : `https://${v}`;
    }
    wv.loadURL(v);
    wv.focus();
  });
  url.addEventListener('focus', () => url.select());
  tools.appendChild(url);
  btn('playpause', 'Spill av / pause (midtklikk på ikonet i docken)', togglePlay);

  const syncNav = () => {
    back.style.opacity = wv.canGoBack() ? 1 : 0.35;
    fwd.style.opacity = wv.canGoForward() ? 1 : 0.35;
    if (document.activeElement !== url) url.value = wv.getURL();
  };
  wv.addEventListener('did-navigate', syncNav);
  wv.addEventListener('did-navigate-in-page', syncNav);
  wv.addEventListener('dom-ready', syncNav);

  const setPlaying = (playing) => zapdock.send('media:state', { id: mod.id, playing });
  wv.addEventListener('media-started-playing', () => setPlaying(true));
  wv.addEventListener('media-paused', () => setPlaying(false));
  wv.addEventListener('destroyed', () => setPlaying(false));

  function togglePlay() {
    wv.executeJavaScript(`(() => {
      const vids = [...document.querySelectorAll('video')];
      const v = vids.find((x) => !x.paused) || vids.find((x) => x.readyState > 0) || vids[0];
      if (!v) return null;
      if (v.paused) v.play(); else v.pause();
      return !v.paused;
    })()`).catch(() => {});
  }
  zapdock.on('media:toggle', togglePlay);
  zapdock.on('web:reload', () => wv.reload());
};
