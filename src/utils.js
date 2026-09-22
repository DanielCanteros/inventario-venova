// Formatos y etiquetas compartidas por las pantallas.

// useGrouping 'always': el locale "es" omite el separador en números de 4 cifras ($ 4500 vs $ 12.000)
export const money = (n) => `$ ${Number(n || 0).toLocaleString('es', { maximumFractionDigits: 0, useGrouping: 'always' })}`;

export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });

export const fmtTime = (iso) =>
  (iso ? new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : null);

export const units = (n) => `${n} ${Math.abs(n) === 1 ? 'unidad' : 'unidades'}`;

// Nivel de stock de un producto. El color nunca va solo: cada nivel tiene texto propio.
export function stockLevel(p) {
  const stock = Number(p.stock) || 0;
  if (stock < 0) return 'neg';
  if (stock === 0) return 'zero';
  if ((Number(p.minStock) || 0) > 0 && stock <= p.minStock) return 'low';
  return 'ok';
}

export const LEVELS = {
  ok: { label: 'Bien', tone: 'ok' },
  low: { label: 'Poco stock', tone: 'warn' },
  zero: { label: 'Sin stock', tone: 'err' },
  neg: { label: 'Stock negativo', tone: 'err' },
};

export const MOVE_TYPES = {
  IN: { label: 'Entrada', title: 'Entró mercadería', desc: 'Llegó una compra, una devolución…', icon: 'arrowDown', tone: 'ok', verb: 'Registrar entrada' },
  OUT: { label: 'Salida', title: 'Salió mercadería', desc: 'Se vendió, se regaló, se dañó…', icon: 'arrowUp', tone: 'warn', verb: 'Registrar salida' },
  ADJ: { label: 'Corrección', title: 'Corregir el conteo', desc: 'Contaste y no coincide con el sistema', icon: 'edit', tone: 'info', verb: 'Guardar corrección' },
};

export const SYNC_STATES = {
  pending: { label: 'Por enviar', tone: 'warn' },
  synced: { label: 'Enviado', tone: 'ok' },
  rejected: { label: 'Rechazado', tone: 'err' },
};

export const SIZE_SUGGESTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Única'];
