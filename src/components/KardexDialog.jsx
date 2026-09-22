import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import ResponsiveTable from './ResponsiveTable.jsx';
import { MOVE_TYPES, SYNC_STATES, fmtDateTime } from '../utils.js';

// Historial de movimientos de un producto (el "kardex"), del más reciente al más antiguo.
export default function KardexDialog({ product, onClose }) {
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.getKardex(product._id)
      .then((r) => { if (!cancelled) setRows([...r].reverse()); })
      .catch((err) => { if (!cancelled) setLoadError(err.message); });
    return () => { cancelled = true; };
  }, [product._id]);

  return (
    <Modal
      title={`Historial de ${product.name}`}
      onClose={onClose}
      size="xl"
      footer={<button type="button" className="btn btn-lg" onClick={onClose}>Cerrar</button>}
    >
      <div className="kardex-summary">
        <div><span className="muted">Total en stock</span><strong className="big">{product.stock}</strong></div>
        <div className="chips">
          {(product.tallas || []).map((t) => (
            <span key={t.talla} className={`chip ${t.cantidad <= 0 ? 'chip-zero' : ''}`}>{t.talla}<b>{t.cantidad}</b></span>
          ))}
        </div>
      </div>

      {loadError && <p className="alert alert-err" role="alert"><Icon name="alert" size="1.4em" /> <span>{loadError}</span></p>}
      {!loadError && rows === null && <p className="loading"><Icon name="refresh" className="spin" /> Cargando historial…</p>}
      {rows && rows.length === 0 && (
        <div className="empty">
          <Icon name="clock" size="2.5em" />
          <p><strong>Todavía no hay movimientos.</strong></p>
          <p className="muted">Cuando registres entradas o salidas de este producto aparecerán aquí.</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <ResponsiveTable>
          <table className="table table-cards">
            <thead>
              <tr><th>Fecha</th><th>Qué pasó</th><th>Talla</th><th className="num">Cantidad</th><th>Nota</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {rows.map((k) => {
                const type = MOVE_TYPES[k.type];
                const sync = SYNC_STATES[k.status];
                const signed = k.type === 'OUT' ? -k.qty : k.qty;
                return (
                  <tr key={k.client_id}>
                    <td data-label="Fecha">{fmtDateTime(k.occurred_at)}</td>
                    <td data-label="Qué pasó"><span className={`pill pill-${type.tone}`}><Icon name={type.icon} /> {type.label}</span></td>
                    <td data-label="Talla"><strong>{k.talla}</strong></td>
                    <td data-label="Cantidad" className={`num qty ${signed < 0 ? 'neg' : 'pos'}`}>{signed > 0 ? `+${signed}` : signed}</td>
                    <td data-label="Nota">{k.note || <span className="muted">—</span>}</td>
                    <td data-label="Estado">
                      <span className={`pill pill-${sync.tone}`}>{sync.label}</span>
                      {k.error && <div className="row-error">{k.error}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ResponsiveTable>
      )}
    </Modal>
  );
}
