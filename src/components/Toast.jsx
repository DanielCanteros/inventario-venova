import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const ToastContext = createContext(() => {});

const ICONS = { ok: 'checkCircle', warn: 'alert', err: 'alert', info: 'info' };
const DURATION_MS = 8000;

// Avisos breves abajo de la pantalla. Uso: const toast = useToast(); toast('Listo', { tone: 'ok' })
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback((text, { tone = 'ok', action = null } = {}) => {
    const id = nextId.current++;
    setItems((list) => [...list, { id, text, tone, action }]);
    setTimeout(() => dismiss(id), DURATION_MS);
  }, [dismiss]);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <Icon name={ICONS[t.tone]} size="1.5em" />
            <span className="toast-text">{t.text}</span>
            {t.action && (
              <button type="button" className="btn btn-light" onClick={() => { t.action.onClick(); dismiss(t.id); }}>
                {t.action.label}
              </button>
            )}
            <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso">
              <Icon name="x" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
