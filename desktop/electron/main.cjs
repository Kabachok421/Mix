'use strict';
const { app, BrowserWindow, Tray, Menu, shell, session, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer } = require('./server.cjs');
const { initUpdater } = require('./updater.cjs');

const APP_ID = 'com.m3lts.mix';
const PREFERRED_PORT = 47831; // фиксированный порт: у входа Firebase и у IndexedDB origin один и тот же
const startHidden = process.argv.includes('--hidden');
const iconPath = path.join(__dirname, 'icon.png');

let mainWindow = null;
let tray = null;
let localOrigin = '';
let updater = null;
let isQuitting = false;

app.setAppUserModelId(APP_ID); // нужен Windows для уведомлений

// Журнал: %APPDATA%\Mix\mix.log (порт, ошибки страницы). Нужен для разбора проблем.
let logFile = '';
let rendererLogBudget = 300;
function log(msg) {
  try {
    if (!logFile) return;
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}
function initLog() {
  logFile = path.join(app.getPath('userData'), 'mix.log');
  try {
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1024 * 1024) {
      fs.renameSync(logFile, path.join(app.getPath('userData'), 'mix.old.log'));
    }
  } catch {}
}

// Перед выходом сообщаем «offline»: после закрытия окна страница уже не успеет
async function goOffline() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    await Promise.race([
      mainWindow.webContents.executeJavaScript(
        "window.dispatchEvent(new Event('pagehide')); new Promise(function (r) { setTimeout(r, 700); })"
      ),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {}
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

// Настройки: config.default.json (внутри приложения) < %APPDATA%\Mix\config.json < переменная MIX_API_BASE
function loadConfig() {
  const cfg = { apiBase: '' };
  Object.assign(cfg, readJson(path.join(app.getAppPath(), 'config.default.json')) || {});
  Object.assign(cfg, readJson(path.join(app.getPath('userData'), 'config.json')) || {});
  if (process.env.MIX_API_BASE) cfg.apiBase = process.env.MIX_API_BASE;
  return cfg;
}

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function saveState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const maximized = mainWindow.isMaximized();
    const b = maximized ? mainWindow.getNormalBounds() : mainWindow.getBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized }));
  } catch {}
}

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function isAuthPopup(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.pathname.startsWith('/__/auth/') || u.hostname === 'accounts.google.com');
  } catch {
    return false;
  }
}

function setupSession(ses) {
  // Google блокирует вход во встроенных браузерах с «Electron» в User-Agent.
  const ua = ses
    .getUserAgent()
    .replace(/\sElectron\/[\d.]+/i, '')
    .replace(/\s(?:mix-messenger|Mix)\/[\d.]+/i, '');
  ses.setUserAgent(ua);

  const allowed = new Set(['media', 'audioCapture', 'videoCapture', 'notifications', 'clipboard-sanitized-write', 'fullscreen']);
  const fromApp = (url) => typeof url === 'string' && url.startsWith(localOrigin);
  ses.setPermissionRequestHandler((_wc, permission, cb, details) => cb(allowed.has(permission) && fromApp(details.requestingUrl)));
  ses.setPermissionCheckHandler((_wc, permission, origin) => allowed.has(permission) && fromApp(origin));

  try {
    ses.setSpellCheckerLanguages(['ru', 'en-US']);
  } catch {}
}

function createWindow() {
  const st = readJson(stateFile()) || {};
  mainWindow = new BrowserWindow({
    width: st.width || 1100,
    height: st.height || 740,
    x: st.x,
    y: st.y,
    minWidth: 820,
    minHeight: 560,
    show: false,
    title: 'Mix',
    icon: iconPath,
    backgroundColor: '#0b0b10',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      backgroundThrottling: false, // звонки и обновления работают, пока окно в трее
    },
  });
  if (st.maximized) mainWindow.maximize();

  mainWindow.once('ready-to-show', () => {
    if (!startHidden) mainWindow.show();
  });

  // Окно входа Google/Firebase открываем как дочернее, остальные ссылки как внешние
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAuthPopup(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          parent: mainWindow,
          autoHideMenuBar: true,
          icon: iconPath,
          title: 'Вход',
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
        },
      };
    }
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(localOrigin)) {
      e.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  const wc = mainWindow.webContents;
  wc.on('console-message', (event, level, message) => {
    const msg = event && event.message !== undefined ? event.message : message;
    const lvl = event && event.level !== undefined ? event.level : level;
    const important = lvl === 'error' || lvl === 'warning' || (typeof lvl === 'number' && lvl >= 2);
    if (!important || rendererLogBudget <= 0) return;
    rendererLogBudget--;
    log('page ' + (typeof lvl === 'number' ? lvl : String(lvl)) + ': ' + String(msg).slice(0, 400));
  });
  wc.on('did-fail-load', (_e, code, desc, url) => log(`did-fail-load ${code} ${desc} ${url}`));
  wc.on('render-process-gone', (_e, d) => log('render-process-gone ' + JSON.stringify(d)));
  wc.on('unresponsive', () => log('страница не отвечает'));
  // Окно в трее считается «скрытым», и сайт ставил бы статус offline, хотя Mix работает.
  // Для статуса считаем страницу видимой, пока приложение запущено.
  wc.on('dom-ready', () => {
    wc.executeJavaScript(
      "try{Object.defineProperty(Document.prototype,'visibilityState',{configurable:true,get:function(){return 'visible'}})}catch(e){}"
    ).catch(() => {});
  });

  mainWindow.webContents.on('context-menu', (_e, p) => {
    const tpl = [];
    if (p.isEditable) {
      tpl.push(
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectAll', label: 'Выделить всё' }
      );
    } else if (p.selectionText) {
      tpl.push({ role: 'copy', label: 'Копировать' });
    }
    if (tpl.length) Menu.buildFromTemplate(tpl).popup();
  });

  // Закрытие окна сворачивает в трей, выход через меню трея
  mainWindow.on('close', (e) => {
    saveState();
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.loadURL(localOrigin);
}

function createTray() {
  const img = nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 });
  tray = new Tray(img);
  tray.setToolTip('Mix ' + app.getVersion());
  const build = () =>
    Menu.buildFromTemplate([
      { label: 'Открыть Mix', click: showWindow },
      updater && updater.getState().phase === 'downloaded'
        ? { label: 'Перезапустить для обновления', click: () => updater.restart() }
        : { label: 'Проверить обновления', click: () => updater && updater.checkNow(true) },
      {
        label: 'Запускать при входе в Windows',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] }),
      },
      { type: 'separator' },
      { label: 'Открыть журнал (mix.log)', click: () => shell.showItemInFolder(logFile) },
      {
        label: 'Выход',
        click: async () => {
          isQuitting = true;
          await goOffline();
          app.quit();
        },
      },
    ]);
  tray.setContextMenu(build());
  tray.on('click', showWindow);
  tray.on('right-click', () => tray.setContextMenu(build()));
}

async function boot() {
  if (app.isPackaged) Menu.setApplicationMenu(null);

  initLog();
  const cfg = loadConfig();
  const { port, fellBack } = await startServer({
    webDir: path.join(app.getAppPath(), 'web'),
    uploadDir: path.join(app.getPath('userData'), 'uploads'),
    apiBase: cfg.apiBase,
    port: PREFERRED_PORT,
    retryMs: 8000,
  });
  log(`запуск Mix ${app.getVersion()}, порт ${port}${fellBack ? ' (ЗАПАСНОЙ: ' + PREFERRED_PORT + ' занят)' : ''}, apiBase="${cfg.apiBase}"`);
  // Именно localhost, не 127.0.0.1: домен localhost есть в разрешённых доменах Firebase Auth по умолчанию
  localOrigin = `http://localhost:${port}`;

  setupSession(session.defaultSession);
  createWindow();
  updater = initUpdater({
    beforeInstall: async () => {
      isQuitting = true; // иначе закрытие окна лишь свернёт его в трей и установка не начнётся
      await goOffline();
    },
  });
  createTray();
  if (fellBack) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Mix',
      message: `Порт ${PREFERRED_PORT} занят другой программой.`,
      detail: 'В этом запуске вход в аккаунт не сохранится. Закройте программу, которая занимает порт, и перезапустите Mix.',
    });
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('before-quit', () => {
    isQuitting = true;
  });
  app.whenReady().then(boot).catch((err) => {
    dialog.showErrorBox('Mix', 'Не удалось запустить приложение:\n' + (err && err.message ? err.message : err));
    app.quit();
  });
}
