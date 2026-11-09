'use strict';
// Автообновление Mix через GitHub Releases (electron-updater).
// Без всплывающих окон: фоновая проверка идёт тихо, а состояние и кнопки
// (Проверить / Download / Restart) показываются в настройках приложения.
// Скачиваются только изменившиеся блоки установщика (differential download, .blockmap).

const { app, ipcMain } = require('electron');

const FIRST_CHECK_MS = 10 * 1000;
const CHECK_EVERY_MS = 30 * 60 * 1000;

let autoUpdater = null;
let getWindow = () => null;
let beforeInstall = () => {};
let manualCheck = false;

// phase: idle | checking | available | downloading | downloaded | uptodate | error
let state = { phase: 'idle', currentVersion: app.getVersion(), lastChecked: 0 };

function broadcast() {
  const w = getWindow();
  if (w && !w.isDestroyed()) w.webContents.send('updater:state', state);
}

function setState(patch) {
  // Прошлые version/percent/message не тянем в новое состояние
  state = {
    phase: patch.phase,
    currentVersion: app.getVersion(),
    lastChecked: patch.lastChecked !== undefined ? patch.lastChecked : state.lastChecked,
    version: patch.version,
    percent: patch.percent,
    speed: patch.speed,
    message: patch.message,
  };
  broadcast();
}

function shortMessage(err) {
  const m = String((err && err.message) || err || 'неизвестная ошибка').split('\n')[0];
  return m.length > 140 ? m.slice(0, 137) + '...' : m;
}

function checkNow(manual = false) {
  if (!autoUpdater) {
    if (manual) {
      setState({ phase: 'error', message: 'Проверка обновлений работает только в установленной версии Mix', lastChecked: Date.now() });
    }
    return;
  }
  if (state.phase === 'downloading' || state.phase === 'downloaded' || state.phase === 'checking') {
    if (manual) broadcast();
    return;
  }
  manualCheck = manual;
  if (manual) setState({ phase: 'checking' });
  autoUpdater.checkForUpdates().catch((err) => {
    console.warn('[updater] проверка не удалась:', err && err.message);
    if (manual) setState({ phase: 'error', message: shortMessage(err), lastChecked: Date.now() });
    manualCheck = false;
  });
}

function startDownload() {
  if (!autoUpdater) return;
  if (state.phase !== 'available' && !(state.phase === 'error' && state.version)) return;
  const version = state.version;
  setState({ phase: 'downloading', version, percent: 0, speed: 0 });
  autoUpdater.downloadUpdate().catch((err) => {
    setState({ phase: 'error', version, message: shortMessage(err) });
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
  getWindow = opts.getWindow || getWindow;
  beforeInstall = opts.beforeInstall || beforeInstall;

  // Команды принимаем только от главного окна приложения
  const fromMain = (e) => {
    const w = getWindow();
    return !!w && !w.isDestroyed() && e.sender === w.webContents;
  };
  ipcMain.handle('updater:get-state', (e) => (fromMain(e) ? state : null));
  ipcMain.on('updater:check', (e) => fromMain(e) && checkNow(true));
  ipcMain.on('updater:download', (e) => fromMain(e) && startDownload());
  ipcMain.on('updater:restart', (e) => fromMain(e) && restartToUpdate());

  const api = { getState: () => state, checkNow, restart: restartToUpdate };

  // В режиме разработки (не установленная версия) обновлять нечего
  if (!app.isPackaged) return api;

  ({ autoUpdater } = require('electron-updater'));
  autoUpdater.autoDownload = false; // качаем только после нажатия Download
  autoUpdater.autoInstallOnAppQuit = true; // если загрузили, а потом вышли, обновление поставится при выходе
  autoUpdater.logger = console;

  autoUpdater.on('update-available', (info) => {
    if (state.phase === 'downloading' || state.phase === 'downloaded') return;
    setState({ phase: 'available', version: info.version, lastChecked: Date.now() });
    manualCheck = false;
  });

  autoUpdater.on('update-not-available', () => {
    if (state.phase === 'downloading' || state.phase === 'downloaded') return;
    setState({ phase: 'uptodate', lastChecked: Date.now() });
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
  });

  autoUpdater.on('error', (err) => {
    console.warn('[updater] ошибка:', err && err.message);
    // Фоновые сбои сети молчат; показываем ошибки загрузки и ручной проверки
    if (state.phase === 'downloading' || manualCheck) {
      setState({ phase: 'error', version: state.version, message: shortMessage(err), lastChecked: Date.now() });
    }
    manualCheck = false;
  });

  setTimeout(() => checkNow(false), FIRST_CHECK_MS);
  setInterval(() => checkNow(false), CHECK_EVERY_MS);

  return api;
}

module.exports = { initUpdater };
