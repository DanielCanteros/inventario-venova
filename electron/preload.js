// CommonJS preload para Electron (funciona aunque tu package.json tenga "type": "module")

const { contextBridge, ipcRenderer } = require('electron');

// Helper para invocar canales IPC de forma segura.
// Todos los canales responden { ok:true, data } o { ok:false, error }.
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

// API expuesta al renderer (window.api)
contextBridge.exposeInMainWorld('api', {
  getSession:   () => invoke('session:get'),
  login:        (creds) => invoke('auth:login', creds),
  logout:       () => invoke('auth:logout'),

  listProducts: () => invoke('products:list'),
  addProduct:   (p) => invoke('products:create', p),
  updateProduct: (id, p) => invoke('products:update', id, p),
  addMovement:  (m) => invoke('movements:create', m),
  getKardex:    (id) => invoke('kardex:get', id),

  getSyncStatus: () => invoke('sync:status'),
  syncNow:       () => invoke('sync:now'),
  // Suscripción a cambios de estado de sincronización; devuelve la función para cancelar
  onSyncStatus: (cb) => {
    const listener = (_e, status) => cb(status);
    ipcRenderer.on('sync:status', listener);
    return () => ipcRenderer.removeListener('sync:status', listener);
  },
});

// Bandera simple para detectar Electron desde el renderer
contextBridge.exposeInMainWorld('env', { isElectron: true });

// Logs de errores del preload (útil para depurar)
process.on('uncaughtException', (err) => {
  // Se verá en la consola del proceso main
  console.error('[preload] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[preload] unhandledRejection:', reason);
});
