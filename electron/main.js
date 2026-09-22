import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createStore } from './store.js';
import { createApi } from './api.js';
import { createSession } from './session.js';
import { createService } from './service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let service;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    icon: path.join(__dirname, '../public/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Al volver a la ventana, sincroniza sin esperar al temporizador
  mainWindow.on('focus', () => service?.sync());
}

/** Envuelve un handler para devolver siempre { ok, data } | { ok:false, error }. */
function handle(channel, fn) {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      console.error(channel, err);
      return { ok: false, error: String(err?.message || err) };
    }
  });
}

app.whenReady().then(() => {
  // El catálogo local es sólo una caché del servidor. Archivo nuevo a propósito:
  // el antiguo "inventario.db" (esquema previo) queda intacto en la carpeta del usuario.
  const store = createStore(path.join(app.getPath('userData'), 'venova-cache.db'));
  const session = createSession();

  // Servidor por defecto para la primera vez (se puede cambiar en la pantalla de login)
  if (!session.get() && process.env.VENOVA_API_URL) {
    session.set({ baseUrl: process.env.VENOVA_API_URL, username: '', token: '' });
  }

  const api = createApi(() => session.get());
  service = createService({
    store,
    api,
    session,
    onStatus: (s) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('sync:status', s);
    }
  });

  handle('session:get', () => service.sessionInfo());
  handle('auth:login', (creds) => service.login(creds));
  handle('auth:logout', () => service.logout());
  handle('sync:status', () => service.status());
  handle('sync:now', async () => { await service.sync(); return service.status(); });
  handle('products:list', () => service.listProducts());
  handle('products:create', (data) => service.createProduct(data));
  handle('products:update', (id, data) => service.updateProduct(id, data));
  handle('movements:create', (data) => service.createMovement(data));
  handle('kardex:get', (productId) => service.kardex(productId));

  createWindow();
  service.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on('before-quit', () => service.stop());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
