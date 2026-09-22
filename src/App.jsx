import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Nav, { StatusBanners } from './components/Nav.jsx';
import Modal from './components/Modal.jsx';
import Icon from './components/Icon.jsx';
import { ToastProvider } from './components/Toast.jsx';
import Login from './pages/Login.jsx';
import Products from './pages/Products.jsx';
import Movements from './pages/Movements.jsx';
import { useTextSize } from './useTextSize.js';
import './inventario.css';

const EMPTY_STATUS = { online: false, needsLogin: false, syncing: false, lastSync: null, error: null, pending: 0, rejected: 0 };

// Routing simple por hash: 'products' (por defecto) o 'movements'
const routeFromHash = () => ((window.location.hash || '#/products').replace(/^#\/?/, '').startsWith('movements') ? 'movements' : 'products');

export default function App() {
  const textSize = useTextSize();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null); // { baseUrl, username, loggedIn } | null
  const [showLogin, setShowLogin] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(routeFromHash());
  const [moveProductId, setMoveProductId] = useState(null); // producto con el que se abre "Entradas y salidas"

  const loadProducts = useCallback(async () => setProducts(await api.listProducts()), []);

  useEffect(() => {
    const onHash = () => setPage(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Al cambiar de sección se empieza desde arriba; al volver a Productos se olvida el producto preelegido
  useEffect(() => {
    window.scrollTo(0, 0);
    if (page === 'products') setMoveProductId(null);
  }, [page]);

  useEffect(() => {
    (async () => {
      setSession(await api.getSession());
      setStatus(await api.getSyncStatus());
      await loadProducts();
      setReady(true);
    })();
    // Cada cambio de estado de sincronización puede haber traído datos nuevos
    return api.onSyncStatus((s) => {
      setStatus(s);
      loadProducts();
    });
  }, [loadProducts]);

  const onLoggedIn = async (info) => {
    setSession(info);
    setShowLogin(false);
    setStatus(await api.getSyncStatus());
    await loadProducts();
  };

  const logout = async () => {
    setConfirmLogout(false);
    await api.logout();
    setSession(await api.getSession());
  };

  const goMove = (productId) => {
    setMoveProductId(productId);
    window.location.hash = '#/movements';
  };

  if (!ready) {
    return (
      <div className="splash" role="status">
        <Icon name="refresh" size="2.5em" className="spin" />
        <p>Cargando tu inventario…</p>
      </div>
    );
  }

  if (!session?.loggedIn || showLogin) {
    return (
      <Login session={session} textSize={textSize} onDone={onLoggedIn} onCancel={session?.loggedIn ? () => setShowLogin(false) : null} />
    );
  }

  return (
    <ToastProvider>
      <Nav
        page={page}
        status={status}
        session={session}
        textSize={textSize}
        onSync={() => api.syncNow()}
        onLogout={() => setConfirmLogout(true)}
      />
      <main className="page">
        <StatusBanners status={status} onSync={() => api.syncNow()} onLogin={() => setShowLogin(true)} />
        {page === 'products' && <Products products={products} onChanged={loadProducts} onMove={goMove} />}
        {page === 'movements' && <Movements key={moveProductId || 'libre'} products={products} initialProductId={moveProductId} onChanged={loadProducts} />}
      </main>

      {confirmLogout && (
        <Modal
          title="¿Quieres salir?"
          size="sm"
          onClose={() => setConfirmLogout(false)}
          footer={
            <>
              <button type="button" className="btn btn-primary btn-lg" onClick={logout}><Icon name="logout" /> Sí, salir</button>
              <button type="button" className="btn btn-lg" onClick={() => setConfirmLogout(false)}>No, quedarme</button>
            </>
          }
        >
          <p>Tendrás que volver a ingresar tu usuario y contraseña.</p>
          {status.pending > 0 && (
            <p className="alert alert-warn">
              <Icon name="clock" size="1.4em" />
              <span>Tienes {status.pending === 1 ? '1 movimiento' : `${status.pending} movimientos`} sin enviar. Siguen guardados y se enviarán cuando vuelvas a ingresar.</span>
            </p>
          )}
        </Modal>
      )}
    </ToastProvider>
  );
}
