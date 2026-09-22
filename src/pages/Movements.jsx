import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import Icon from '../components/Icon.jsx';
import Choice from '../components/Choice.jsx';
import Stepper from '../components/Stepper.jsx';
import { MOVE_TYPES, SIZE_SUGGESTIONS, units } from '../utils.js';

const NOTE_EXAMPLES = {
  IN: 'Ej.: compra a proveedor, devolución de cliente',
  OUT: 'Ej.: venta en feria, regalo, prenda dañada',
  ADJ: 'Ej.: conteo de fin de mes',
};

// Un paso del asistente. Al aparecer se desplaza a la vista para que no quede escondido abajo.
function Step({ n, title, done, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (n > 1) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [n]);
  return (
    <section className="card step" ref={ref}>
      <h2 className="step-title">
        <span className={`step-n ${done ? 'is-done' : ''}`}>{done ? <Icon name="check" /> : n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function Movements({ products, initialProductId, onChanged }) {
  const [productId, setProductId] = useState(initialProductId || '');
  const [search, setSearch] = useState('');
  const [type, setType] = useState(null);
  const [talla, setTalla] = useState(''); // talla ya existente que se eligió
  const [newMode, setNewMode] = useState(false); // "Otra talla"
  const [newTalla, setNewTalla] = useState('');
  const [qty, setQty] = useState('1');
  const [count, setCount] = useState(null); // corrección: null = sin tocar (usa lo que dice el sistema)
  const [cost, setCost] = useState(null); // entrada: null = sin tocar (usa el costo del producto)
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const product = products.find((p) => p._id === productId);
  const tallas = product?.tallas || [];

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => [p.name, p.sku, p.barcode, p.categoriaPrenda].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [products, search]);

  // ── Talla elegida ──
  const noTallas = tallas.length === 0;
  const askNew = type !== 'OUT' && (newMode || noTallas);
  const typed = newTalla.trim();
  // "m" y "M" son la misma talla: si ya existe, se usa el nombre que ya tiene
  const sameAsExisting = tallas.find((t) => String(t.talla).toLowerCase() === typed.toLowerCase());
  const tallaName = askNew ? (sameAsExisting ? String(sameAsExisting.talla) : typed) : talla;
  const current = Number(tallas.find((t) => String(t.talla) === tallaName)?.cantidad) || 0;
  const hasTalla = tallaName !== '';

  // ── Cantidad y efecto sobre el stock ──
  const countText = count ?? String(current);
  let delta = 0;
  let valid = false;
  let sameCount = false;
  if (type === 'ADJ') {
    const c = Number(countText);
    const ok = countText.trim() !== '' && Number.isInteger(c) && c >= 0;
    delta = ok ? c - current : 0;
    sameCount = ok && delta === 0;
    valid = hasTalla && ok && delta !== 0;
  } else if (type) {
    const n = Number(qty);
    valid = hasTalla && qty.trim() !== '' && Number.isInteger(n) && n > 0;
    delta = valid ? (type === 'IN' ? n : -n) : 0;
  }
  const after = current + delta;
  const costText = cost ?? String(product?.costoPrenda ?? '');

  // ── Acciones ──
  const resetEntry = () => {
    setQty('1'); setCount(null); setCost(null); setNote(''); setError('');
  };

  const pickProduct = (id) => {
    setProductId(id);
    setTalla(''); setNewMode(false); setNewTalla('');
    resetEntry();
    setResult(null);
  };

  const pickType = (t) => {
    setType(t);
    setQty('1'); setCount(null); setError('');
    if (t === 'OUT') { setNewMode(false); setNewTalla(''); }
  };

  const pickTalla = (name) => { setTalla(name); setNewMode(false); setNewTalla(''); setCount(null); setError(''); };
  const pickNewTalla = () => { setNewMode(true); setTalla(''); setCount(null); setError(''); };

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.addMovement({
        product_id: productId,
        talla: tallaName,
        type,
        qty: type === 'ADJ' ? delta : Number(qty),
        unit_cost: type === 'IN' ? Number(costText) || 0 : 0,
        note,
      });
      setResult({
        synced: res.synced,
        product: product.name,
        talla: tallaName,
        type,
        delta,
        after,
      });
      // De ahora en más la talla ya existe: la dejamos elegida para el próximo movimiento
      setTalla(tallaName); setNewMode(false); setNewTalla('');
      resetEntry();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => { pickProduct(''); setType(null); setSearch(''); };

  // ── Pantallas ──
  const head = (
    <div className="page-head">
      <div>
        <h1>Entradas y salidas</h1>
        <p className="muted">Anota lo que entró o salió de tu mercadería, paso a paso.</p>
      </div>
    </div>
  );

  if (products.length === 0) {
    return (
      <>
        {head}
        <section className="card empty">
          <Icon name="box" size="3em" />
          <p><strong>Primero necesitas tener un producto.</strong></p>
          <a className="btn btn-primary btn-lg" href="#/products">Ir a Productos</a>
        </section>
      </>
    );
  }

  if (result) {
    const t = MOVE_TYPES[result.type];
    return (
      <>
        {head}
        <section className={`card result result-${result.synced ? 'ok' : 'warn'}`} role="status">
          <Icon name={result.synced ? 'checkCircle' : 'clock'} size="3.5em" />
          <h2>{result.synced ? 'Listo, quedó registrado' : 'Guardado en este equipo'}</h2>
          <p className="result-line">
            <strong>{t.label}</strong> · {result.product} · talla {result.talla}: <strong>{result.delta > 0 ? `+${result.delta}` : result.delta}</strong>
            <br />
            Ahora hay <strong>{result.after}</strong> en esa talla.
          </p>
          {!result.synced && (
            <p className="alert alert-warn">
              <Icon name="wifiOff" size="1.4em" />
              <span>Ahora no hay conexión. No se pierde nada: se enviará solo cuando vuelva internet.</span>
            </p>
          )}
          <div className="result-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setResult(null)}>
              <Icon name="plus" /> Registrar otro de este producto
            </button>
            <button type="button" className="btn btn-lg" onClick={startOver}>Elegir otro producto</button>
            <a className="btn btn-lg" href="#/products">Volver a Productos</a>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      {head}

      {/* Paso 1 · Producto */}
      <Step n={1} title="¿Qué producto?" done={!!product}>
        {product ? (
          <div className="picked">
            <div>
              <div className="prod-name">{product.name}</div>
              <div className="muted">{[product.categoriaPrenda, `Total: ${product.stock}`].filter(Boolean).join(' · ')}</div>
              <div className="chips">
                {tallas.map((t) => <span key={t.talla} className={`chip ${t.cantidad <= 0 ? 'chip-zero' : ''}`}>{t.talla}<b>{t.cantidad}</b></span>)}
              </div>
            </div>
            <button type="button" className="btn" onClick={() => pickProduct('')}>Cambiar producto</button>
          </div>
        ) : (
          <>
            <div className="search">
              <Icon name="search" size="1.4em" className="search-icon" />
              <input
                type="search"
                aria-label="Buscar producto"
                placeholder="Escribe para buscar el producto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {search && <button type="button" className="btn btn-sm search-clear" onClick={() => setSearch('')}><Icon name="x" /> Borrar</button>}
            </div>
            <div className="pick-list">
              {visibleProducts.map((p) => (
                <button key={p._id} type="button" className="pick-item" onClick={() => pickProduct(p._id)}>
                  <span className="pick-main">
                    <span className="prod-name">{p.name}</span>
                    <span className="muted">{p.categoriaPrenda || 'Sin categoría'}</span>
                  </span>
                  <span className="pick-stock">Total <strong>{p.stock}</strong></span>
                  <Icon name="chevronRight" />
                </button>
              ))}
              {visibleProducts.length === 0 && <p className="muted pad">No encontramos ese producto. Prueba con otra palabra.</p>}
            </div>
          </>
        )}
      </Step>

      {/* Paso 2 · Qué pasó */}
      {product && (
        <Step n={2} title="¿Qué pasó?" done={!!type}>
          <div className="choice-grid" role="radiogroup" aria-label="Tipo de movimiento">
            {Object.entries(MOVE_TYPES).map(([id, t]) => (
              <Choice key={id} name="type" value={id} checked={type === id} onChange={() => pickType(id)} className={`choice-big tone-${t.tone}`}>
                <Icon name={t.icon} size="2em" />
                <strong>{t.title}</strong>
                <span>{t.desc}</span>
              </Choice>
            ))}
          </div>
        </Step>
      )}

      {/* Paso 3 · Talla */}
      {product && type && (
        <Step n={3} title="¿De qué talla?" done={hasTalla}>
          {type === 'OUT' && noTallas ? (
            <p className="alert alert-warn">
              <Icon name="alert" size="1.4em" />
              <span>Este producto todavía no tiene unidades cargadas, así que no se puede registrar una salida. Registra primero una <strong>entrada</strong>.</span>
            </p>
          ) : (
            <>
              <div className="choice-row" role="radiogroup" aria-label="Talla">
                {tallas.map((t) => (
                  <Choice key={t.talla} name="talla" value={t.talla} checked={!askNew && talla === String(t.talla)} onChange={() => pickTalla(String(t.talla))} className={`choice-size ${t.cantidad <= 0 ? 'is-zero' : ''}`}>
                    <strong>{t.talla}</strong>
                    <span>hay {t.cantidad}</span>
                  </Choice>
                ))}
                {type !== 'OUT' && !noTallas && (
                  <Choice name="talla" value="__new__" checked={askNew} onChange={pickNewTalla} className="choice-size choice-new">
                    <Icon name="plus" />
                    <span>Otra talla</span>
                  </Choice>
                )}
              </div>

              {askNew && (
                <div className="field new-size">
                  <label htmlFor="mv-newsize">{noTallas ? 'Escribe la talla' : 'Escribe la nueva talla'}</label>
                  <input id="mv-newsize" value={newTalla} onChange={(e) => setNewTalla(e.target.value)} placeholder="Ej.: M, 38, Única" autoFocus />
                  <div className="chips suggest" aria-label="Tallas frecuentes">
                    {SIZE_SUGGESTIONS.filter((s) => !tallas.some((t) => String(t.talla).toLowerCase() === s.toLowerCase())).map((s) => (
                      <button key={s} type="button" className="chip chip-btn" onClick={() => setNewTalla(s)}>{s}</button>
                    ))}
                  </div>
                  {sameAsExisting && <span className="hint">Esa talla ya existe: se sumará a «{sameAsExisting.talla}».</span>}
                </div>
              )}
            </>
          )}
        </Step>
      )}

      {/* Paso 4 · Cantidad + confirmación */}
      {product && type && hasTalla && (
        <Step n={4} title={type === 'ADJ' ? '¿Cuántas hay realmente?' : `¿Cuántas unidades ${type === 'IN' ? 'entraron' : 'salieron'}?`}>
          <form className="form-stack" onSubmit={submit}>
            <div className="qty-row">
              {type === 'ADJ' ? (
                <Stepper value={countText} onChange={setCount} min={0} label="Cantidad contada" />
              ) : (
                <Stepper value={qty} onChange={setQty} min={1} label="Cantidad" />
              )}
              <p className="qty-context">
                {type === 'ADJ'
                  ? <>Cuenta lo que hay en el estante. El sistema dice que hay <strong>{current}</strong> en talla {tallaName}.</>
                  : <>Ahora hay <strong>{current}</strong> en talla {tallaName}.</>}
              </p>
            </div>

            {type === 'IN' && (
              <div className="field">
                <label htmlFor="mv-cost">Costo de cada unidad <span className="opt">opcional</span></label>
                <input id="mv-cost" type="number" inputMode="decimal" min="0" step="any" value={costText} onChange={(e) => setCost(e.target.value)} />
              </div>
            )}

            <div className="field">
              <label htmlFor="mv-note">Nota <span className="opt">opcional</span></label>
              <input id="mv-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={NOTE_EXAMPLES[type]} />
            </div>

            {sameCount && (
              <p className="alert alert-info"><Icon name="info" size="1.4em" /> <span>El conteo coincide con lo que dice el sistema: no hay nada que corregir.</span></p>
            )}

            {valid && (
              <div className={`summary tone-${MOVE_TYPES[type].tone}`}>
                <div className="summary-title">Vas a registrar</div>
                <p className="summary-text">
                  {type === 'IN' && <>Sumar <strong>{units(delta)}</strong> a la talla <strong>{tallaName}</strong> de «{product.name}».</>}
                  {type === 'OUT' && <>Restar <strong>{units(-delta)}</strong> de la talla <strong>{tallaName}</strong> de «{product.name}».</>}
                  {type === 'ADJ' && <>Corregir la talla <strong>{tallaName}</strong> de «{product.name}»: {delta > 0 ? 'se sumarán' : 'se restarán'} <strong>{units(Math.abs(delta))}</strong>.</>}
                </p>
                <p className="summary-after">Después habrá <strong>{after}</strong> en talla {tallaName} · Total del producto: <strong>{(Number(product.stock) || 0) + delta}</strong></p>
                {after < 0 && (
                  <p className="alert alert-warn">
                    <Icon name="alert" size="1.4em" />
                    <span>Ojo: solo hay {current} en esa talla, así que quedaría en negativo. Si estás conectado, el servidor puede rechazar esta salida.</span>
                  </p>
                )}
              </div>
            )}

            {error && <p className="alert alert-err" role="alert"><Icon name="alert" size="1.4em" /> <span>{error}</span></p>}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary btn-lg btn-xl" disabled={!valid || busy}>
                {busy ? <><Icon name="refresh" className="spin" /> Guardando…</> : <><Icon name="check" size="1.4em" /> {MOVE_TYPES[type].verb}</>}
              </button>
            </div>
          </form>
        </Step>
      )}
    </>
  );
}
