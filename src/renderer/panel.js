'use strict';
/* global zapdock, zdIcon, ZD_MODULES */

(async () => {
  const id = new URLSearchParams(location.search).get('id');
  const init = await zapdock.invoke('panel:init', id);
  const mod = init.mod;
  if (!mod) return;

  document.title = mod.title;
  document.body.dataset.icon = mod.icon || mod.type;
  document.body.classList.add(`type-${mod.type}`);
  document.getElementById('head-ico').innerHTML = zdIcon(mod.icon || mod.type);
  document.getElementById('head-title').textContent = mod.title;
  document.getElementById('btn-close').innerHTML = zdIcon('close');

  const btnMode = document.getElementById('btn-mode');
  let mode = init.mode;
  const applyMode = (m) => {
    mode = m;
    document.body.classList.toggle('floating', m === 'floating');
    btnMode.innerHTML = zdIcon(m === 'floating' ? 'dock' : 'detach');
    btnMode.title = m === 'floating' ? 'Fest til docken' : 'Løsne til eget vindu (alltid øverst)';
  };
  applyMode(mode);
  zapdock.on('panel:mode', applyMode);
  btnMode.addEventListener('click', () => zapdock.send('panel:setMode', { id, mode: mode === 'floating' ? 'docked' : 'floating' }));
  document.getElementById('btn-close').addEventListener('click', () => zapdock.send('panel:hide', id));

  const factory = ZD_MODULES[mod.type];
  if (factory) {
    factory({
      mod,
      init,
      body: document.getElementById('body'),
      tools: document.getElementById('head-tools'),
    });
  }
})();
