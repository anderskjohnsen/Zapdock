'use strict';
// Spilles nå (Spotify og andre mediespillere via Windows sine mediekontroller) + volum.
const VK_MEDIA = { next: 0xb0, prev: 0xb1, toggle: 0xb3 };

module.exports = function mediaProvider(ctx) {
  const helper = ctx.winhelper;
  const cfg = ctx.mod;
  const snapshot = () => ({
    supported: helper.available,
    ...helper.media,
    audio: helper.audio,
    preferApp: cfg.preferApp || 'Spotify',
  });
  const onChange = () => ctx.publish(snapshot());

  return {
    start() {
      helper.on('media', onChange);
      helper.on('audio', onChange);
      helper.setPreferredApp(cfg.preferApp || 'Spotify');
      onChange();
    },
    stop() {
      helper.off('media', onChange);
      helper.off('audio', onChange);
    },
    data: snapshot,
    action(name, p = {}) {
      if (['toggle', 'next', 'prev', 'play', 'pause'].includes(name)) {
        if (!helper.send(`media ${name}`) && VK_MEDIA[name]) ctx.win32.pressKeys([VK_MEDIA[name]]);
        return true;
      }
      if (name === 'volume') return helper.send(`audio set ${Math.max(0, Math.min(1, Number(p.value) || 0)).toFixed(3)}`);
      if (name === 'mute') return helper.send('audio togglemute');
      if (name === 'openApp') {
        const app = (cfg.preferApp || 'Spotify').toLowerCase();
        return ctx.shell.openExternal(app === 'spotify' ? 'spotify:' : `${app}:`).catch(() => {});
      }
      return null;
    },
  };
};
