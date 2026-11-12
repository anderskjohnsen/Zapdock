'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const SEND = new Set([
  'taskbar:click', 'pinned:launch', 'shell:start', 'shell:desktop', 'shell:notifications',
  'module:toggle', 'module:drag', 'panel:setMode', 'panel:hide', 'preview:activate',
  'media:state', 'media:toggle', 'menu:module', 'menu:window', 'menu:bar', 'shell:quicksettings',
  'audio:set', 'audio:mute', 'settings:open', 'settings:relaunch', 'settings:openFile',
]);
const INVOKE = new Set(['config:get', 'panel:init', 'taskbar:icon', 'module:action', 'settings:get', 'settings:save']);
const ON = new Set([
  'taskbar:windows', 'taskbar:active', 'modules:state', 'panel:mode', 'preview:status',
  'module:data', 'audio', 'media:toggle', 'web:reload',
]);

contextBridge.exposeInMainWorld('zapdock', {
  send(channel, payload) {
    if (SEND.has(channel)) ipcRenderer.send(channel, payload);
  },
  invoke(channel, payload) {
    if (!INVOKE.has(channel)) return Promise.reject(new Error(`ukjent kanal ${channel}`));
    return ipcRenderer.invoke(channel, payload);
  },
  on(channel, cb) {
    if (!ON.has(channel)) return () => {};
    const fn = (e, payload) => cb(payload);
    ipcRenderer.on(channel, fn);
    return () => ipcRenderer.removeListener(channel, fn);
  },
});
