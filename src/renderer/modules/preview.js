'use strict';
/* global zapdock */
// Live forhåndsvisning av et annet vindu (WoW). Bildet tegnes av Windows (DWM-miniatyr) over vinduet;
// her vises bare statusmeldinger og klikk fanges.
window.ZD_MODULES = window.ZD_MODULES || {};

window.ZD_MODULES.preview = ({ mod, init, body }) => {
  const msg = document.createElement('div');
  msg.className = 'pv-msg';
  body.appendChild(msg);
  body.title = `Klikk for å gå til ${mod.title}`;
  const render = (s) => {
    if (!s.supported) msg.textContent = 'Live forhåndsvisning krever Windows.';
    else if (!s.running) msg.textContent = `${mod.title} kjører ikke.`;
    else if (s.minimized) msg.textContent = `${mod.title} er minimert. Bruk Alt+Tab i stedet for å minimere for å se live bilde.`;
    else msg.textContent = '';
  };
  render(init.preview);
  zapdock.on('preview:status', render);
  body.addEventListener('click', () => zapdock.send('preview:activate', mod.id));
};
