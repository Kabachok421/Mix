'use strict';
// Настройки самого приложения, доступные из окна настроек: запуск вместе с Windows.
const { app, ipcMain } = require('electron');

const AUTOSTART_ARGS = ['--hidden']; // при автозапуске Mix стартует свёрнутым в трей

function initAppSettings({ getWindow }) {
  // Команды принимаем только от главного окна приложения
  const fromMain = (e) => {
    const w = getWindow();
    return !!w && !w.isDestroyed() && e.sender === w.webContents;
  };
  const read = () => app.getLoginItemSettings({ args: AUTOSTART_ARGS }).openAtLogin === true;

  ipcMain.handle('app:get-autostart', (e) => (fromMain(e) ? read() : null));

  ipcMain.handle('app:set-autostart', (e, enabled) => {
    if (!fromMain(e) || typeof enabled !== 'boolean') return null;
    // Не установленная версия (npm run dev) в автозапуск не записывается: иначе туда попал бы electron.exe
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: enabled, args: AUTOSTART_ARGS });
    return read();
  });
}

module.exports = { initAppSettings };
