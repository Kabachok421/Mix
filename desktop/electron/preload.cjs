'use strict';
// Мост между веб-клиентом и обновлением приложения: окно настроек читает состояние и жмёт кнопки.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mixUpdater', {
  getState: () => ipcRenderer.invoke('updater:get-state'),
  onState: (cb) => {
    const handler = (_e, state) => cb(state);
    ipcRenderer.on('updater:state', handler);
    return () => ipcRenderer.removeListener('updater:state', handler);
  },
  check: () => ipcRenderer.send('updater:check'),
  download: () => ipcRenderer.send('updater:download'),
  restart: () => ipcRenderer.send('updater:restart'),
});

// Настройки приложения (запуск вместе с Windows)
contextBridge.exposeInMainWorld('mixApp', {
  getAutostart: () => ipcRenderer.invoke('app:get-autostart'),
  setAutostart: (enabled) => ipcRenderer.invoke('app:set-autostart', enabled === true),
});
