import React from 'react';

// Opción seleccionable con aspecto de botón grande. Usa <input type="radio"> nativo, así
// las flechas del teclado y los lectores de pantalla funcionan sin trabajo extra.
export default function Choice({ name, checked, onChange, className = '', children, ...rest }) {
  return (
    <label className={`choice ${className}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} {...rest} />
      <span className="choice-body">{children}</span>
    </label>
  );
}
