import React, { useMemo, useState } from 'react';
import { api } from '../api.js';
import Modal from './Modal.jsx';
import Choice from './Choice.jsx';
import Icon from './Icon.jsx';
import { money } from '../utils.js';

const EMPTY = { name: '', categoriaPrenda: '', sexo: 'U', sku: '', barcode: '', costoPrenda: '', price: '', minStock: '' };
const SEXOS = [
  { id: 'U', label: 'Unisex' },
  { id: 'F', label: 'Mujer' },
  { id: 'M', label: 'Hombre' },
];

const fromProduct = (p) => ({
  name: p.name || '',
  categoriaPrenda: p.categoriaPrenda || '',
  sexo: p.sexo || 'U',
  sku: p.sku || '',
  barcode: p.barcode || '',
  costoPrenda: p.costoPrenda ?? '',
  price: p.price ?? '',
  minStock: p.minStock ?? '',
});

// Sirve para crear (product = null) y para editar un producto existente.
export default function ProductForm({ product = null, products, onClose, onSaved }) {
  const editing = !!product;
  const [form, setForm] = useState(editing ? fromProduct(product) : EMPTY);
  const [active, setActive] = useState(product ? product.active !== false : true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Sugiere las categorías que ya existen para no escribir "Remera" de tres maneras distintas
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.categoriaPrenda).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [products],
  );

  const hasPrices = form.price !== '' && form.costoPrenda !== '';
  const profit = Number(form.price) - Number(form.costoPrenda);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { id } = editing
        ? await api.updateProduct(product._id, { ...form, active })
        : await api.addProduct(form);
      onSaved({ id, name: form.name.trim(), isNew: !editing });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={editing ? 'Editar producto' : 'Nuevo producto'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="submit" form="product-form" className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? <><Icon name="refresh" className="spin" /> Guardando…</> : <><Icon name="check" /> {editing ? 'Guardar cambios' : 'Guardar producto'}</>}
          </button>
          <button type="button" className="btn btn-lg" onClick={onClose}>Cancelar</button>
        </>
      }
    >
      <form id="product-form" className="form-stack" onSubmit={save}>
        <p className="alert alert-info">
          <Icon name="info" size="1.4em" />
          {editing ? (
            <span>Las <strong>unidades</strong> no se cambian aquí: usa «Entradas y salidas». Para guardar cambios hace falta conexión a internet.</span>
          ) : (
            <span>El producto se crea <strong>sin unidades</strong>. Después, en «Entradas y salidas», registras cuántas llegaron. Para crearlo hace falta conexión a internet.</span>
          )}
        </p>

        <fieldset className="section">
          <legend>Datos del producto</legend>
          <div className="field">
            <label htmlFor="pf-name">Nombre <span className="req">obligatorio</span></label>
            <input id="pf-name" value={form.name} onChange={set('name')} placeholder="Ej.: Remera básica de algodón" autoFocus required />
          </div>
          <div className="field">
            <label htmlFor="pf-cat">Categoría</label>
            <input id="pf-cat" list="pf-cats" value={form.categoriaPrenda} onChange={set('categoriaPrenda')} placeholder="Ej.: Remera, Buzo, Pantalón" />
            <datalist id="pf-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="field">
            <span className="label" id="pf-sexo-label">¿Para quién es?</span>
            <div className="choice-row" role="radiogroup" aria-labelledby="pf-sexo-label">
              {SEXOS.map((s) => (
                <Choice key={s.id} name="sexo" value={s.id} checked={form.sexo === s.id} onChange={set('sexo')}>{s.label}</Choice>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="section">
          <legend>Precios</legend>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="pf-cost">Lo que te cuesta</label>
              <input id="pf-cost" type="number" inputMode="decimal" min="0" step="any" value={form.costoPrenda} onChange={set('costoPrenda')} placeholder="0" />
            </div>
            <div className="field">
              <label htmlFor="pf-price">Precio de venta <span className="req">obligatorio</span></label>
              <input id="pf-price" type="number" inputMode="decimal" min="0" step="any" value={form.price} onChange={set('price')} placeholder="0" required />
            </div>
          </div>
          {hasPrices && (
            <p className={`alert ${profit >= 0 ? 'alert-ok' : 'alert-err'}`}>
              <Icon name={profit >= 0 ? 'checkCircle' : 'alert'} size="1.4em" />
              <span>{profit >= 0 ? 'Ganancia por unidad' : 'Ojo: vendes por debajo del costo'}: <strong>{money(profit)}</strong></span>
            </p>
          )}
        </fieldset>

        <fieldset className="section">
          <legend>Control (opcional)</legend>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="pf-min">Avisarme cuando queden</label>
              <input id="pf-min" type="number" inputMode="numeric" min="0" step="1" value={form.minStock} onChange={set('minStock')} placeholder="Ej.: 3" />
              <span className="hint">Si el total baja de esa cantidad, verás «Poco stock».</span>
            </div>
            <div className="field">
              <label htmlFor="pf-sku">Código interno (SKU)</label>
              <input id="pf-sku" value={form.sku} onChange={set('sku')} />
            </div>
            <div className="field">
              <label htmlFor="pf-barcode">Código de barras</label>
              <input id="pf-barcode" value={form.barcode} onChange={set('barcode')} />
            </div>
          </div>
        </fieldset>

        {editing && (
          <fieldset className="section">
            <legend>Tienda</legend>
            <label className="switch">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              <span className="switch-box" aria-hidden="true"><Icon name="check" /></span>
              <span>
                <strong>Visible en la tienda</strong>
                <span className="hint block">Si lo desmarcas, el producto deja de mostrarse en la tienda.</span>
              </span>
            </label>
          </fieldset>
        )}

        {error && <p className="alert alert-err" role="alert"><Icon name="alert" size="1.4em" /> <span>{error}</span></p>}
      </form>
    </Modal>
  );
}
