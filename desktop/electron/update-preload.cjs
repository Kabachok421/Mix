'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('updater', {
  onState: (cb) => ipcRenderer.on('updater:state', (_e, s) => cb(s)),
  download: () => ipcRenderer.send('updater:download'),
  restart: () => ipcRenderer.send('updater:restart'),
  dismiss: () => ipcRenderer.send('updater:dismiss'),
});
