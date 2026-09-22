// electron/store.js
// Caché local (SQLite) del catálogo de Venova + cola de movimientos.
// La fuente de verdad es MongoDB (vía API); esto permite trabajar sin internet.

import Database from 'better-sqlite3';

/** Movimiento con estado: 'pending' (por enviar) | 'synced' | 'rejected' (el servidor lo rechazó). */

export function createStore(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id  TEXT PRIMARY KEY,
      doc TEXT NOT NULL            -- documento de Venova tal cual (JSON)
    );

    CREATE TABLE IF NOT EXISTS movements (
      client_id   TEXT PRIMARY KEY,   -- UUID (o "srv:<_id>" para los que vienen del servidor)
      product_id  TEXT NOT NULL,
      talla       TEXT NOT NULL,
      type        TEXT NOT NULL,      -- IN | OUT | ADJ
      qty         INTEGER NOT NULL,
      unit_cost   REAL DEFAULT 0,
      note        TEXT DEFAULT '',
      occurred_at TEXT NOT NULL,
      status      TEXT NOT NULL,      -- pending | synced | rejected
      forced      INTEGER DEFAULT 0,  -- 1 = creado sin conexión (ya ocurrió: el servidor no debe rechazarlo por stock)
      error       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_mov_product ON movements(product_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_mov_status  ON movements(status);
  `);

  const delta = (type, qty) => (type === 'OUT' ? -qty : qty);

  // ── Productos ────────────────────────────────────────────────
  const qAllProducts = db.prepare('SELECT doc FROM products');
  const qGetProduct = db.prepare('SELECT doc FROM products WHERE id = ?');
  const upsertProduct = db.prepare(
    'INSERT INTO products (id, doc) VALUES (@id, @doc) ON CONFLICT(id) DO UPDATE SET doc = excluded.doc'
  );
  const delProducts = db.prepare('DELETE FROM products');
  const qPending = db.prepare("SELECT * FROM movements WHERE status = 'pending' ORDER BY occurred_at ASC");
  const qPendingCount = db.prepare("SELECT COUNT(*) AS n FROM movements WHERE status = 'pending'");
  const qRejectedCount = db.prepare("SELECT COUNT(*) AS n FROM movements WHERE status = 'rejected'");

  function putProduct(doc) {
    upsertProduct.run({ id: String(doc._id), doc: JSON.stringify(doc) });
  }

  /** Suma `d` a la talla del producto en caché (crea la talla si no existe). */
  function bumpLocalStock(productId, talla, d) {
    const row = qGetProduct.get(String(productId));
    if (!row) return;
    const doc = JSON.parse(row.doc);
    doc.tallas = Array.isArray(doc.tallas) ? doc.tallas : [];
    const t = doc.tallas.find((x) => x.talla === talla);
    if (t) t.cantidad = (Number(t.cantidad) || 0) + d;
    else doc.tallas.push({ talla, cantidad: d });
    doc.stock = (Number(doc.stock) || 0) + d;
    putProduct(doc);
  }

  return {
    db,

    listProducts() {
      return qAllProducts
        .all()
        .map((r) => JSON.parse(r.doc))
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
    },

    getProduct(id) {
      const row = qGetProduct.get(String(id));
      return row ? JSON.parse(row.doc) : null;
    },

    putProduct,

    /**
     * Reemplaza el catálogo por el del servidor y vuelve a aplicar encima los
     * movimientos aún pendientes, para que el stock que ve el usuario no "salte" atrás.
     */
    replaceProducts(docs) {
      db.transaction(() => {
        delProducts.run();
        for (const d of docs) putProduct(d);
        for (const m of qPending.all()) bumpLocalStock(m.product_id, m.talla, delta(m.type, m.qty));
      })();
    },

    // ── Movimientos ────────────────────────────────────────────
    addMovement(m) {
      db.prepare(
        `INSERT OR REPLACE INTO movements
           (client_id, product_id, talla, type, qty, unit_cost, note, occurred_at, status, forced, error)
         VALUES (@client_id, @product_id, @talla, @type, @qty, @unit_cost, @note, @occurred_at, @status, @forced, @error)`
      ).run({ forced: 0, error: null, unit_cost: 0, note: '', ...m });
    },

    /** Movimiento hecho sin conexión: se guarda en cola y se refleja ya en el stock local. */
    queueMovement(m) {
      db.transaction(() => {
        this.addMovement({ ...m, status: 'pending', forced: 1 });
        bumpLocalStock(m.product_id, m.talla, delta(m.type, m.qty));
      })();
    },

    pendingMovements: () => qPending.all(),

    markSynced(clientId) {
      db.prepare("UPDATE movements SET status = 'synced', error = NULL WHERE client_id = ?").run(clientId);
    },

    markRejected(clientId, error) {
      db.transaction(() => {
        const m = db.prepare('SELECT * FROM movements WHERE client_id = ?').get(clientId);
        if (!m || m.status === 'rejected') return;
        db.prepare("UPDATE movements SET status = 'rejected', error = ? WHERE client_id = ?").run(error, clientId);
        // Deshace el efecto optimista que se había aplicado al stock local
        bumpLocalStock(m.product_id, m.talla, -delta(m.type, m.qty));
      })();
    },

    /** Movimientos de un producto (más antiguos primero). */
    kardex(productId) {
      return db
        .prepare('SELECT * FROM movements WHERE product_id = ? ORDER BY occurred_at ASC')
        .all(String(productId));
    },

    /** Incorpora movimientos que vienen del servidor (idempotente por client_id). */
    mergeServerMovements(list) {
      const ins = db.prepare(
        `INSERT INTO movements
           (client_id, product_id, talla, type, qty, unit_cost, note, occurred_at, status, forced, error)
         VALUES (@client_id, @product_id, @talla, @type, @qty, @unit_cost, @note, @occurred_at, 'synced', 0, NULL)
         ON CONFLICT(client_id) DO UPDATE SET status = 'synced', error = NULL
           WHERE movements.status != 'synced'`
      );
      db.transaction(() => {
        for (const m of list) {
          ins.run({
            client_id: m.clientId || `srv:${m._id}`,
            product_id: String(m.product),
            talla: m.talla,
            type: m.type,
            qty: m.qty,
            unit_cost: m.unitCost || 0,
            note: m.note || '',
            occurred_at: new Date(m.occurredAt || m.createdAt).toISOString(),
          });
        }
      })();
    },

    counts() {
      return { pending: qPendingCount.get().n, rejected: qRejectedCount.get().n };
    },

    close() {
      db.close();
    },
  };
}
