import React, { useEffect, useId, useRef } from 'react';
import Icon from './Icon.jsx';

// Diálogo nativo (<dialog>): atrapa el foco, se cierra con Esc y bloquea lo que hay detrás.
export default function Modal({ title, onClose, children, footer, size = 'md' }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal modal-${size}`}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          <Icon name="x" /> Cerrar
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-foot">{footer}</div>}
    </dialog>
  );
}
