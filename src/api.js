// Envoltorio del puente de Electron (window.api): los canales responden
// { ok:true, data } o { ok:false, error }; aquí se convierten en promesas normales.

const unwrap = async (promise) => {
  const res = await promise;
  if (!res?.ok) throw new Error(res?.error || 'Error desconocido');
  return res.data;
};

export const api = {
  getSession: () => unwrap(window.api.getSession()),
  login: (creds) => unwrap(window.api.login(creds)),
  logout: () => unwrap(window.api.logout()),
  listProducts: () => unwrap(window.api.listProducts()),
  addProduct: (p) => unwrap(window.api.addProduct(p)),
  updateProduct: (id, p) => unwrap(window.api.updateProduct(id, p)),
  addMovement: (m) => unwrap(window.api.addMovement(m)),
  getKardex: (id) => unwrap(window.api.getKardex(id)),
  getSyncStatus: () => unwrap(window.api.getSyncStatus()),
  syncNow: () => unwrap(window.api.syncNow()),
  onSyncStatus: (cb) => window.api.onSyncStatus(cb),
};
