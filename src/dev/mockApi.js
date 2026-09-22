// API simulada (window.api) para ver y probar la interfaz en un navegador, sin Electron.
// Solo se carga en desarrollo (ver main.jsx). Los datos viven en memoria.
//
// En la consola del navegador:  __mock.offline(true)  |  __mock.expire()  |  __mock.reset()

const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const ok = async (data) => { await wait(); return { ok: true, data }; };
const fail = async (error) => { await wait(); return { ok: false, error }; };

const seed = () => [
  { _id: 'p1', name: 'Remera básica de algodón', categoriaPrenda: 'Remera', sexo: 'U', sku: 'REM-001', costoPrenda: 4500, price: 12000, minStock: 5, active: true, tallas: [{ talla: 'S', cantidad: 4 }, { talla: 'M', cantidad: 9 }, { talla: 'L', cantidad: 0 }], stock: 13 },
  { _id: 'p2', name: 'Buzo canguro con capucha', categoriaPrenda: 'Buzo', sexo: 'M', sku: 'BUZ-014', costoPrenda: 11000, price: 29500, minStock: 6, active: true, tallas: [{ talla: 'M', cantidad: 2 }, { talla: 'L', cantidad: 1 }], stock: 3 },
  { _id: 'p3', name: 'Jean recto clásico', categoriaPrenda: 'Pantalón', sexo: 'F', sku: 'JEA-220', costoPrenda: 9000, price: 24900, minStock: 4, active: true, tallas: [{ talla: '38', cantidad: 3 }, { talla: '40', cantidad: 5 }, { talla: '42', cantidad: 2 }], stock: 10 },
  { _id: 'p4', name: 'Campera de abrigo invierno', categoriaPrenda: 'Campera', sexo: 'F', sku: 'CAM-090', costoPrenda: 18000, price: 52000, minStock: 3, active: false, tallas: [], stock: 0 },
  { _id: 'p5', name: 'Short deportivo', categoriaPrenda: 'Short', sexo: 'M', sku: '', costoPrenda: 3000, price: 8900, minStock: 0, active: true, tallas: [{ talla: 'M', cantidad: -1 }], stock: -1 },
  { _id: 'p6', name: 'Vestido largo estampado', categoriaPrenda: 'Vestido', sexo: 'F', sku: 'VES-301', costoPrenda: 7000, price: 21000, minStock: 2, active: true, tallas: [{ talla: 'S', cantidad: 6 }, { talla: 'M', cantidad: 6 }], stock: 12 },
];

const state = {
  online: true,
  loggedIn: true,
  needsLogin: false,
  lastSync: new Date().toISOString(),
  products: seed(),
  movements: [
    { client_id: 'm1', product_id: 'p1', talla: 'M', type: 'IN', qty: 12, unit_cost: 4500, note: 'Compra a proveedor', occurred_at: new Date(Date.now() - 6 * 864e5).toISOString(), status: 'synced', error: null },
    { client_id: 'm2', product_id: 'p1', talla: 'M', type: 'OUT', qty: 3, unit_cost: 0, note: 'Venta en feria', occurred_at: new Date(Date.now() - 2 * 864e5).toISOString(), status: 'synced', error: null },
    { client_id: 'm3', product_id: 'p1', talla: 'S', type: 'OUT', qty: 9, unit_cost: 0, note: '', occurred_at: new Date(Date.now() - 864e5).toISOString(), status: 'rejected', error: 'Stock insuficiente en talla S' },
  ],
};

const listeners = new Set();
const pendingCount = () => state.movements.filter((m) => m.status === 'pending').length;
const rejectedCount = () => state.movements.filter((m) => m.status === 'rejected').length;
const status = () => ({
  online: state.needsLogin ? true : state.online, // como el servicio real: sesión vencida = sí hay internet
  needsLogin: state.needsLogin,
  syncing: false,
  lastSync: state.lastSync,
  error: state.online ? null : 'Sin conexión con el servidor',
  pending: pendingCount(),
  rejected: rejectedCount(),
});
const emit = () => listeners.forEach((cb) => cb(status()));

window.api = {
  getSession: () => ok({ baseUrl: 'http://localhost:4000', username: state.loggedIn ? 'admin' : '', loggedIn: state.loggedIn }),
  login: async ({ username, password }) => {
    if (password !== 'venova') return fail('Usuario o contraseña incorrectos (en el mock la clave es «venova»)');
    state.loggedIn = true; state.needsLogin = false;
    return ok({ baseUrl: 'http://localhost:4000', username, loggedIn: true });
  },
  logout: () => { state.loggedIn = false; return ok(null); },
  listProducts: () => ok(structuredClone(state.products)),
  addProduct: async (p) => {
    if (!state.online) return fail('Necesitas conexión a internet para crear productos');
    const id = `p${Date.now()}`;
    state.products.push({ _id: id, name: p.name.trim(), categoriaPrenda: p.categoriaPrenda, sexo: p.sexo, sku: p.sku, costoPrenda: Number(p.costoPrenda) || 0, price: Number(p.price) || 0, minStock: Number(p.minStock) || 0, active: true, tallas: [], stock: 0 });
    state.products.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return ok({ id });
  },
  updateProduct: async (id, p) => {
    if (!state.online) return fail('Necesitas conexión a internet para editar productos');
    const prod = state.products.find((x) => x._id === id);
    Object.assign(prod, { name: p.name.trim(), categoriaPrenda: p.categoriaPrenda, sexo: p.sexo, sku: p.sku, costoPrenda: Number(p.costoPrenda) || 0, price: Number(p.price) || 0, minStock: Number(p.minStock) || 0, active: p.active });
    return ok({ id });
  },
  addMovement: async (m) => {
    const prod = state.products.find((x) => x._id === m.product_id);
    const delta = m.type === 'OUT' ? -m.qty : m.qty;
    let t = prod.tallas.find((x) => x.talla === m.talla);
    if (state.online && m.type === 'OUT' && (t?.cantidad || 0) + delta < 0) return fail(`Stock insuficiente en talla ${m.talla}`);
    if (!t) { t = { talla: m.talla, cantidad: 0 }; prod.tallas.push(t); }
    t.cantidad += delta; prod.stock += delta;
    state.movements.push({ ...m, client_id: `m${Date.now()}`, occurred_at: new Date().toISOString(), status: state.online ? 'synced' : 'pending', error: null });
    emit();
    return ok({ synced: state.online, queued: !state.online });
  },
  getKardex: (id) => ok(state.movements.filter((m) => m.product_id === id)),
  getSyncStatus: () => ok(status()),
  syncNow: async () => {
    if (state.online && !state.needsLogin) {
      state.movements.forEach((m) => { if (m.status === 'pending') m.status = 'synced'; });
      state.lastSync = new Date().toISOString();
    }
    emit();
    return ok(status());
  },
  onSyncStatus: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
};

window.__mock = {
  offline: (v = true) => { state.online = !v; emit(); },
  expire: () => { state.needsLogin = true; emit(); },
  reset: () => { state.products = seed(); state.needsLogin = false; state.online = true; emit(); },
};
