// electron/service.js
// Lógica de negocio del inventario: trabaja contra la API de Venova y, si no hay
// internet, contra la caché local, dejando los movimientos en cola para sincronizar.

import crypto from 'crypto';
import { NetworkError, AuthError, ApiError } from './api.js';

const SYNC_INTERVAL_MS = 30_000;
const BATCH_SIZE = 100;

export function createService({ store, api, session, onStatus }) {
  const status = {
    online: false,
    needsLogin: false,
    syncing: false,
    lastSync: null,
    error: null,
    pending: 0,
    rejected: 0,
  };
  let running = null;
  let timer = null;

  const emit = () => {
    Object.assign(status, store.counts());
    onStatus({ ...status });
  };

  /** Actualiza el estado de conexión según el error; los ApiError no cambian la conexión. */
  function noteError(err) {
    if (err instanceof NetworkError) {
      status.online = false;
      status.error = err.message;
    } else if (err instanceof AuthError) {
      status.online = true; // el servidor respondió: hay internet, pero la sesión no sirve
      status.needsLogin = true;
      status.error = 'Sesión vencida: inicia sesión para sincronizar';
    } else {
      status.error = err?.message || String(err);
    }
  }

  const toWire = (m) => ({
    clientId: m.client_id,
    product: m.product_id,
    talla: m.talla,
    type: m.type,
    qty: m.qty,
    unitCost: m.unit_cost,
    note: m.note,
    occurredAt: m.occurred_at,
    // Lo hecho sin conexión ya ocurrió físicamente: el servidor lo registra aunque deje la talla en negativo
    force: !!m.forced,
    source: 'inventario',
  });

  async function push() {
    const pending = store.pendingMovements();
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const { results } = await api.createMovementsBatch(pending.slice(i, i + BATCH_SIZE).map(toWire));
      for (const r of results) {
        if (r.ok) store.markSynced(r.clientId);
        else if (r.status >= 400 && r.status < 500) store.markRejected(r.clientId, r.message);
        // 5xx: se deja pendiente y se reintenta en la próxima sincronización
      }
    }
  }

  /** Envía la cola y luego trae el catálogo. Nunca corre dos veces a la vez. */
  function sync() {
    if (running) return running;
    if (!session.get()?.token) {
      emit();
      return Promise.resolve();
    }
    running = (async () => {
      status.syncing = true;
      emit();
      try {
        await push(); // primero enviar: así el pull no pisa cambios propios
        const { data } = await api.getProducts();
        store.replaceProducts(data);
        Object.assign(status, { online: true, needsLogin: false, error: null, lastSync: new Date().toISOString() });
      } catch (err) {
        noteError(err);
      } finally {
        status.syncing = false;
        emit();
        running = null;
      }
    })();
    return running;
  }

  // ── Sesión ───────────────────────────────────────────────────
  function sessionInfo() {
    const s = session.get();
    return s ? { baseUrl: s.baseUrl, username: s.username, loggedIn: !!s.token } : null;
  }

  async function login({ baseUrl, username, password }) {
    let url = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!url) throw new Error('Indica la dirección del servidor');
    if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
    if (!username || !password) throw new Error('Usuario y contraseña requeridos');

    const res = await api.login(url, String(username).trim(), password);
    session.set({ baseUrl: url, username: res.user.username, token: res.token });
    status.needsLogin = false;
    await sync();
    return sessionInfo();
  }

  function logout() {
    session.dropToken();
    emit();
  }

  // ── Operaciones ──────────────────────────────────────────────
  async function createMovement(input) {
    const type = String(input?.type || '').toUpperCase();
    if (!['IN', 'OUT', 'ADJ'].includes(type)) throw new Error('Tipo inválido');
    const product_id = String(input?.product_id || '').trim();
    if (!product_id || !store.getProduct(product_id)) throw new Error('Producto no encontrado');
    const talla = String(input?.talla || '').trim();
    if (!talla) throw new Error('La talla es obligatoria');
    const qty = Number(input?.qty);
    if (!Number.isInteger(qty) || qty === 0) throw new Error('La cantidad debe ser un entero distinto de 0');
    if (type !== 'ADJ' && qty < 0) throw new Error('La cantidad debe ser positiva (usa Ajuste para restar)');

    const m = {
      client_id: crypto.randomUUID(),
      product_id,
      talla,
      type,
      qty,
      unit_cost: Number(input?.unit_cost) || 0,
      note: input?.note ? String(input.note).trim() : '',
      occurred_at: new Date().toISOString(),
    };

    try {
      // Si hay cola pendiente, va primero para conservar el orden (p. ej. una entrada que este movimiento necesita)
      if (store.counts().pending) await push();
      const res = await api.createMovement({ ...toWire({ ...m, forced: 0 }) });
      store.addMovement({ ...m, status: 'synced' });
      if (res.product) store.putProduct(res.product);
      Object.assign(status, { online: true, needsLogin: false, error: null });
      emit();
      return { synced: true };
    } catch (err) {
      if (err instanceof ApiError) throw err; // rechazo real (stock insuficiente…): nada se guarda
      noteError(err);
      store.queueMovement(m);
      emit();
      return { synced: false, queued: true };
    }
  }

  /** Campos editables de un producto a partir del formulario. El stock NO va aquí: sólo cambia con movimientos. */
  function productFields(input) {
    const name = String(input?.name || '').trim();
    if (!name) throw new Error('El nombre es obligatorio');
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const price = num(input?.price);
    const costoPrenda = num(input?.costoPrenda);
    return {
      name,
      categoriaPrenda: String(input?.categoriaPrenda || '').trim(),
      sexo: ['F', 'M', 'U'].includes(input?.sexo) ? input.sexo : 'U',
      sku: String(input?.sku || '').trim(),
      barcode: String(input?.barcode || '').trim(),
      price,
      costoPrenda,
      margenGanancia: price - costoPrenda,
      minStock: num(input?.minStock),
    };
  }

  /** Crear/editar productos necesita servidor: traduce los errores de conexión y sesión a mensajes claros. */
  async function writeOnline(action, verb) {
    try {
      const res = await action();
      store.putProduct(res.data);
      Object.assign(status, { online: true, needsLogin: false, error: null });
      emit();
      return res.data;
    } catch (err) {
      if (err instanceof NetworkError) throw new Error(`Necesitas conexión a internet para ${verb} productos`);
      if (err instanceof AuthError) {
        noteError(err);
        emit();
        throw new Error('Sesión vencida: inicia sesión de nuevo');
      }
      throw err;
    }
  }

  async function createProduct(input) {
    const fields = productFields(input);
    const created = await writeOnline(
      () => api.createProduct({
        ...fields,
        desc: input?.desc || '',
        proveedor: input?.proveedor || '',
        tallas: [],
        stock: 0,
      }),
      'crear'
    );
    return { id: created._id };
  }

  async function updateProduct(id, input) {
    if (!store.getProduct(id)) throw new Error('Producto no encontrado');
    const fields = productFields(input);
    if (typeof input?.active === 'boolean') fields.active = input.active;
    const updated = await writeOnline(() => api.updateProduct(id, fields), 'editar');
    return { id: updated._id };
  }

  async function kardex(productId) {
    if (session.get()?.token) {
      try {
        const { data } = await api.getMovements(productId);
        store.mergeServerMovements(data);
      } catch (err) {
        noteError(err); // sin conexión: se muestra lo que hay en la caché local
        emit();
      }
    }
    return store.kardex(productId);
  }

  return {
    status: () => ({ ...status, ...store.counts() }),
    sessionInfo,
    login,
    logout,
    sync,
    createMovement,
    createProduct,
    updateProduct,
    kardex,
    listProducts: () => store.listProducts(),
    start() {
      sync();
      timer = setInterval(sync, SYNC_INTERVAL_MS);
    },
    stop() {
      clearInterval(timer);
    },
  };
}
