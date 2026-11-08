'use strict';
// Автообновление Mix через GitHub Releases (electron-updater).
// Поток: проверка -> всплывающее окно «Download» -> прогресс -> «Restart».
// Скачиваются только изменившиеся блоки установщика (differential download, .blockmap).

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

const FIRST_CHECK_MS = 10 * 1000;
const CHECK_EVERY_MS = 30 * 60 * 1000;
const POPUP_W = 380;
const POPUP_H = 148;

let autoUpdater = null;
let popup = null;
let popupReady = false;
let state = { phase: 'idle' }; // idle | available | downloading | downloaded | uptodate | error
let dismissedVersion = null;
let manualCheck = false;
let hideTimer = null;
let beforeInstall = () => {};

function send() {
  if (popup && !popup.isDestroyed() && popupReady) popup.webContents.send('updater:state', state);
}

function setState(next) {
  state = next;
  send();
}

function ensurePopup() {
  if (popup && !popup.isDestroyed()) return popup;
  popupReady = false;
  popup = new BrowserWindow({
    width: POPUP_W,
    height: POPUP_H,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    title: 'Mix: обновление',
    webPreferences: {
      preload: path.join(__dirname, 'update-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  popup.setAlwaysOnTop(true, 'screen-saver');
  popup.webContents.on('did-finish-load', () => {
    popupReady = true;
    send();
  });
  popup.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  popup.webContents.on('will-navigate', (e) => e.preventDefault());
  popup.on('closed', () => {
    popup = null;
    popupReady = false;
  });
  popup.loadFile(path.join(__dirname, 'update-popup.html'));
  return popup;
}

function placePopup() {
  const wa = screen.getPrimaryDisplay().workArea;
  popup.setBounds({
    x: wa.x + wa.width - POPUP_W - 8,
    y: wa.y + wa.height - POPUP_H - 8,
    width: POPUP_W,
    height: POPUP_H,
  });
}

function showPopup() {
  clearTimeout(hideTimer);
  const w = ensurePopup();
  placePopup();
  send();
  if (!w.isVisible()) w.showInactive(); // не перехватываем фокус у того, что делает пользователь
}

function hidePopup() {
  clearTimeout(hideTimer);
  if (popup && !popup.isDestroyed()) popup.hide();
}

function shortMessage(err) {
  const m = String((err && err.message) || err || 'неизвестная ошибка').split('\n')[0];
  return m.length > 90 ? m.slice(0, 87) + '...' : m;
}

function startDownload() {
  if (!autoUpdater) return;
  setState({ phase: 'downloading', version: state.version, percent: 0, speed: 0 });
  showPopup();
  autoUpdater.downloadUpdate().catch((err) => {
    setState({ phase: 'error', version: state.version, message: shortMessage(err) });
    showPopup();
  });
}

function checkNow(manual = false) {
  if (!autoUpdater) return;
  if (state.phase === 'downloading') {
    if (manual) showPopup();
    return;
  }
  if (state.phase === 'downloaded') {
    if (manual) showPopup();
    return;
  }
  manualCheck = manual;
  if (manual) dismissedVersion = null;
  autoUpdater.checkForUpdates().catch((err) => {
    console.warn('[updater] проверка не удалась:', err && err.message);
    if (manual) {
      setState({ phase: 'error', message: shortMessage(err) });
      showPopup();
    }
  });
}

function restartToUpdate() {
  if (!autoUpdater || state.phase !== 'downloaded') return;
  // isSilent = true, isForceRunAfter = true: установка без окон и сразу перезапуск
  Promise.resolve()
    .then(() => beforeInstall())
    .catch(() => {})
    .then(() => autoUpdater.quitAndInstall(true, true));
}

function initUpdater(opts = {}) {
  beforeInstall = opts.beforeInstall || beforeInstall;

  const api = {
    getState: () => state,
    checkNow,
    restart: restartToUpdate,
    showPopup: () => showPopup(),
  };

  // В режиме разработки (не установленная версия) обновлять нечего
  if (!app.isPackaged) return api;

  ({ autoUpdater } = require('electron-updater'));
  autoUpdater.autoDownload = false; // качаем только после нажатия Download
  autoUpdater.autoInstallOnAppQuit = true; // если загрузили, а потом вышли, обновление поставится при выходе
  autoUpdater.logger = console;

  autoUpdater.on('update-available', (info) => {
    if (state.phase === 'downloading' || state.phase === 'downloaded') return;
    setState({ phase: 'available', version: info.version });
    if (manualCheck || dismissedVersion !== info.version) showPopup();
    manualCheck = false;
  });

  autoUpdater.on('update-not-available', () => {
    if (manualCheck) {
      setState({ phase: 'uptodate', version: app.getVersion() });
      showPopup();
      hideTimer = setTimeout(() => {
        if (state.phase === 'uptodate') setState({ phase: 'idle' });
        hidePopup();
      }, 4000);
    }
    manualCheck = false;
  });

  autoUpdater.on('download-progress', (p) => {
    setState({
      phase: 'downloading',
      version: state.version,
      percent: Math.max(0, Math.min(100, Math.round(p.percent || 0))),
      speed: p.bytesPerSecond || 0,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setState({ phase: 'downloaded', version: info.version || state.version });
    showPopup(); // даже если окно скрывали на этапе загрузки
  });

  autoUpdater.on('error', (err) => {
    console.warn('[updater] ошибка:', err && err.message);
    // Фоновые сбои сети не показываем, только ошибки загрузки и ручной проверки
    if (state.phase === 'downloading' || manualCheck) {
      setState({ phase: 'error', version: state.version, message: shortMessage(err) });
      showPopup();
    }
    manualCheck = false;
  });

  const fromPopup = (e) => popup && !popup.isDestroyed() && e.sender === popup.webContents;

  ipcMain.on('updater:download', (e) => {
    if (!fromPopup(e)) return;
    if (state.phase === 'available' || (state.phase === 'error' && state.version)) startDownload();
    else if (state.phase === 'error') checkNow(true);
  });
  ipcMain.on('updater:restart', (e) => {
    if (fromPopup(e)) restartToUpdate();
  });
  ipcMain.on('updater:dismiss', (e) => {
    if (!fromPopup(e)) return;
    if (state.phase === 'available') dismissedVersion = state.version;
    if (state.phase === 'error' || state.phase === 'uptodate') setState({ phase: 'idle' });
    hidePopup();
  });

  setTimeout(() => checkNow(false), FIRST_CHECK_MS);
  setInterval(() => checkNow(false), CHECK_EVERY_MS);

  return api;
}

module.exports = { initUpdater };
