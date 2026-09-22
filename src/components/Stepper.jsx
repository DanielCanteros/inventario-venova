import React from 'react';
import Icon from './Icon.jsx';

// Cantidad con botones − / + grandes (más fáciles que un campo numérico con flechitas).
export default function Stepper({ value, onChange, min = 1, label }) {
  const n = Number(value);
  const valid = Number.isFinite(n);
  const step = (d) => onChange(String(Math.max(min, (valid ? Math.trunc(n) : min) + d)));

  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="btn btn-lg stepper-btn" onClick={() => step(-1)} disabled={valid && n <= min} aria-label="Restar uno">
        <Icon name="minus" size="1.5em" />
      </button>
      <input
        className="stepper-input"
        type="number"
        inputMode="numeric"
        min={min}
        step="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        aria-label={label}
      />
      <button type="button" className="btn btn-lg stepper-btn" onClick={() => step(1)} aria-label="Sumar uno">
        <Icon name="plus" size="1.5em" />
      </button>
    </div>
  );
}
