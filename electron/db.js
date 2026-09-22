// electron/db.js
// SQLite embebido con better-sqlite3 + repositorio con validaciones y errores claros.

import Database from 'better-sqlite3';
import fs from 'fs';
import crypto from 'crypto';

/**
 * Crea/abre la base, aplica PRAGMAs y garantiza el esquema.
 * @param {string} dbPath Ruta del archivo .db (usa app.getPath('userData') en main.js)
 */
export function createDb(dbPath) {
  const firstTime = !fs.existsSync(dbPath);

  // Abrimos la DB
  const db = new Database(dbPath);

  // PRAGMAs recomendados
  db.pragma('foreign_keys = ON'); // respeta FKs
  db.pragma('journal_mode = WAL'); // mejor concurrencia/robustez
  db.pragma('synchronous = NORMAL'); // performance razonable sin perder seguridad

  // Esquema
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT UNIQUE,            -- único (opcional)
      barcode TEXT UNIQUE,        -- único (opcional)
      unit TEXT DEFAULT 'u',
      min_stock INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      price REAL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      type TEXT NOT NULL,         -- IN | OUT | ADJ
      qty REAL NOT NULL,
      unit_cost REAL DEFAULT 0,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    -- Índices útiles
    CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(product_id, created_at);
  `);

  // Semilla opcional la primera vez (para probar rápido)
  if (firstTime) {
    const now = new Date().toISOString();
    const pid = crypto.randomUUID();

    db.prepare(`
      INSERT INTO products (id, name, sku, barcode, unit, min_stock, cost, price, created_at)
      VALUES (@id, @name, @sku, @barcode, @unit, @min_stock, @cost, @price, @created_at)
    `).run({
      id: pid,
      name: 'Café en grano 1kg',
      sku: 'CAFE-1KG',
      barcode: '1234567890123',
      unit: 'kg',
      min_stock: 0,
      cost: 8.5,
      price: 15,
      created_at: now
    });

    db.prepare(`
      INSERT INTO movements (id, product_id, type, qty, unit_cost, note, created_at)
      VALUES (@id, @product_id, 'IN', 10, 8.5, 'Stock inicial', @created_at)
    `).run({
      id: crypto.randomUUID(),
      product_id: pid,
      created_at: now
    });
  }

  return db;
}

/**
 * Repositorio: todas las operaciones de datos.
 * Devuelve funciones puras que usan statements preparados y tiran errores claros.
 */
export function repo(db) {
  // Statements preparados
  const qList = db.prepare(`
    SELECT
      p.*,
      COALESCE(SUM(CASE m.type
        WHEN 'IN'  THEN m.qty
        WHEN 'OUT' THEN -m.qty
        ELSE 0
      END), 0) AS stock
    FROM products p
    LEFT JOIN movements m ON m.product_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `);

  const insProduct = db.prepare(`
    INSERT INTO products (id, name, sku, barcode, unit, min_stock, cost, price, created_at)
    VALUES (@id, @name, @sku, @barcode, @unit, @min_stock, @cost, @price, @created_at)
  `);

  const insMovement = db.prepare(`
    INSERT INTO movements (id, product_id, type, qty, unit_cost, note, created_at)
    VALUES (@id, @product_id, @type, @qty, @unit_cost, @note, @created_at)
  `);

  const qKardex = db.prepare(`
    SELECT type, qty, unit_cost, note, created_at
    FROM movements
    WHERE product_id = @product_id
    ORDER BY created_at ASC
  `);

  // Utilidad: normalizar números (0 si string vacío o NaN)
  const num = (v, def = 0) => {
    if (v === '' || v === null || v === undefined) return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };

  return {
    /**
     * Lista productos con stock calculado (entradas - salidas).
     */
    listProducts() {
      try {
        const rows = qList.all();
        // Aseguramos tipos coherentes para la UI
        return rows.map(p => ({
          ...p,
          cost: num(p.cost),
          price: num(p.price),
          min_stock: num(p.min_stock),
          stock: num(p.stock)
        }));
      } catch (e) {
        // Deja que el main.js capture el error y lo muestre
        throw new Error(e.message || String(e));
      }
    },

    /**
     * Crea un producto. Valida campos básicos y UNIQUE en sku/barcode.
     */
    createProduct(p) {
      try {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();

        const name = String(p?.name ?? '').trim();
        if (!name) throw new Error('El nombre es obligatorio');

        const doc = {
          id,
          name,
          sku: p?.sku ? String(p.sku).trim() : null,
          barcode: p?.barcode ? String(p.barcode).trim() : null,
          unit: p?.unit ? String(p.unit).trim() : 'u',
          min_stock: num(p?.min_stock, 0),
          cost: num(p?.cost, 0),
          price: num(p?.price, 0),
          created_at: now
        };

        insProduct.run(doc);
        return { ok: true, id };
      } catch (e) {
        // Propaga mensajes útiles (UNIQUE, NOT NULL, etc.)
        // Ejemplos:
        //  - UNIQUE constraint failed: products.sku
        //  - NOT NULL constraint failed: products.name
        throw new Error(e.message || String(e));
      }
    },

    /**
     * Registra un movimiento de stock (IN | OUT | ADJ).
     */
    createMovement(m) {
      try {
        const type = String(m?.type || '').toUpperCase().trim();
        if (!['IN', 'OUT', 'ADJ'].includes(type)) throw new Error('Tipo inválido (usa IN | OUT | ADJ)');

        const product_id = String(m?.product_id || '').trim();
        if (!product_id) throw new Error('product_id es obligatorio');

        const qty = num(m?.qty, NaN);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error('Cantidad inválida (debe ser > 0)');

        const unit_cost = num(m?.unit_cost, 0);

        const doc = {
          id: crypto.randomUUID(),
          product_id,
          type,
          qty,
          unit_cost,
          note: m?.note ? String(m.note).trim() : null,
          created_at: new Date().toISOString()
        };

        insMovement.run(doc);
        return { ok: true, id: doc.id };
      } catch (e) {
        throw new Error(e.message || String(e));
      }
    },

    /**
     * Devuelve el kardex (historial) del producto en orden cronológico.
     */
    getKardex(product_id) {
      try {
        const id = String(product_id || '').trim();
        if (!id) throw new Error('product_id es obligatorio');

        const rows = qKardex.all({ product_id: id });
        return rows.map(k => ({
          type: String(k.type),
          qty: num(k.qty),
          unit_cost: num(k.unit_cost),
          note: k.note ?? null,
          created_at: k.created_at
        }));
      } catch (e) {
        throw new Error(e.message || String(e));
      }
    }
  };
}
