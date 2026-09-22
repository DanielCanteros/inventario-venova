import React, { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import ProductForm from '../components/ProductForm.jsx';
import KardexDialog from '../components/KardexDialog.jsx';
import { useToast } from '../components/Toast.jsx';
import { LEVELS, money, stockLevel } from '../utils.js';

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'low', label: 'Poco stock' },
  { id: 'zero', label: 'Sin stock' },
];

const matchesFilter = (p, filter) => {
  const level = stockLevel(p);
  if (filter === 'low') return level === 'low';
  if (filter === 'zero') return level === 'zero' || level === 'neg';
  return true;
};

export default function Products({ products, onChanged, onMove }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [formFor, setFormFor] = useState(null); // null = cerrado, 'new' = producto nuevo, o el producto a editar
  const [kardexOf, setKardexOf] = useState(null);

  const counts = useMemo(() => ({
    all: products.length,
    low: products.filter((p) => matchesFilter(p, 'low')).length,
    zero: products.filter((p) => matchesFilter(p, 'zero')).length,
  }), [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) =>
      matchesFilter(p, filter) &&
      (!q || [p.name, p.sku, p.barcode, p.categoriaPrenda].some((v) => String(v || '').toLowerCase().includes(q))));
  }, [products, query, filter]);

  const saved = ({ id, name, isNew }) => {
    setFormFor(null);
    onChanged();
    if (isNew) {
      toast(`«${name}» quedó creado. Ahora falta cargar sus unidades.`, {
        action: { label: 'Cargar unidades', onClick: () => onMove(id) },
      });
    } else {
      toast(`Guardamos los cambios de «${name}».`);
    }
  };

  const clearFilters = () => { setQuery(''); setFilter('all'); };
  const filtering = query.trim() !== '' || filter !== 'all';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Productos</h1>
          <p className="muted">
            {products.length === 0 ? 'Todavía no hay productos.' : `${products.length} en total. Usa «Entradas y salidas» para sumar o restar unidades.`}
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => setFormFor('new')}>
          <Icon name="plus" size="1.4em" /> Nuevo producto
        </button>
      </div>

      <section className="card">
        <div className="toolbar">
          <div className="search">
            <Icon name="search" size="1.4em" className="search-icon" />
            <input
              type="search"
              aria-label="Buscar productos"
              placeholder="Buscar por nombre, categoría, SKU o código…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" className="btn btn-sm search-clear" onClick={() => setQuery('')}>
                <Icon name="x" /> Borrar
              </button>
            )}
          </div>

          <div className="filters" role="group" aria-label="Filtrar por stock">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`btn filter ${filter === f.id ? 'is-on' : ''}`}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label} <span className="count">{counts[f.id]}</span>
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="empty">
            <Icon name={products.length === 0 ? 'box' : 'search'} size="3em" />
            {products.length === 0 ? (
              <>
                <p><strong>Aún no cargaste ningún producto.</strong></p>
                <p className="muted">Empieza creando el primero. Después podrás registrar cuántas unidades tienes.</p>
                <button type="button" className="btn btn-primary btn-lg" onClick={() => setFormFor('new')}>
                  <Icon name="plus" size="1.4em" /> Crear mi primer producto
                </button>
              </>
            ) : (
              <>
                <p><strong>No encontramos productos{query.trim() ? ` con «${query.trim()}»` : ' en este filtro'}.</strong></p>
                <p className="muted">Revisa que esté bien escrito o prueba con otra palabra.</p>
                {filtering && <button type="button" className="btn btn-lg" onClick={clearFilters}>Ver todos los productos</button>}
              </>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table-cards">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Costo</th>
                  <th className="num">Precio</th>
                  <th>Unidades por talla</th>
                  <th className="num">Total</th>
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const level = stockLevel(p);
                  const info = LEVELS[level];
                  const inactive = p.active === false;
                  return (
                    <tr key={p._id} className={inactive ? 'is-inactive' : ''}>
                      <td data-label="Producto">
                        <div className="prod-name">{p.name}{inactive && <span className="pill pill-off" title="No se muestra en la tienda">Oculto en la tienda</span>}</div>
                        <div className="muted">{[p.categoriaPrenda, p.sku && `SKU ${p.sku}`].filter(Boolean).join(' · ') || 'Sin categoría'}</div>
                      </td>
                      <td data-label="Costo" className="num muted-cell">{money(p.costoPrenda)}</td>
                      <td data-label="Precio" className="num"><strong>{money(p.price)}</strong></td>
                      <td data-label="Unidades por talla">
                        <div className="chips">
                          {(p.tallas || []).length === 0 && <span className="muted">Sin unidades cargadas</span>}
                          {(p.tallas || []).map((t) => (
                            <span key={t.talla} className={`chip ${t.cantidad <= 0 ? 'chip-zero' : ''}`}>{t.talla}<b>{t.cantidad}</b></span>
                          ))}
                        </div>
                      </td>
                      <td data-label="Total" className="num">
                        <div className={`stock stock-${info.tone}`}>{p.stock}</div>
                        {level !== 'ok' && <span className={`pill pill-${info.tone}`}>{info.label}</span>}
                      </td>
                      <td className="actions">
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => onMove(p._id)}>
                          <Icon name="swap" /> Entradas y salidas
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setKardexOf(p)}>
                          <Icon name="clock" /> Historial
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setFormFor(p)}>
                          <Icon name="edit" /> Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formFor && (
        <ProductForm
          product={formFor === 'new' ? null : formFor}
          products={products}
          onClose={() => setFormFor(null)}
          onSaved={saved}
        />
      )}
      {kardexOf && <KardexDialog product={kardexOf} onClose={() => setKardexOf(null)} />}
    </>
  );
}
