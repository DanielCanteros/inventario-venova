import React from 'react';
import Icon from './Icon.jsx';
import TextSizeControl from './TextSizeControl.jsx';
import { fmtTime } from '../utils.js';

// Estado de conexión en una frase corta. "Conectando…" = todavía no se intentó sincronizar.
function ConnectionPill({ status }) {
  const tried = !!status.error || !!status.lastSync;
  if (status.needsLogin) return <span className="pill pill-warn"><Icon name="alert" /> Sesión vencida</span>;
  if (status.syncing) return <span className="pill pill-info"><Icon name="refresh" className="spin" /> Actualizando…</span>;
  if (!status.online && tried) return <span className="pill pill-off"><Icon name="wifiOff" /> Sin internet</span>;
  if (!status.online) return <span className="pill pill-off"><Icon name="wifi" /> Conectando…</span>;
  return (
    <span className="pill pill-ok">
      <Icon name="wifi" /> Conectado{status.lastSync ? ` · ${fmtTime(status.lastSync)}` : ''}
    </span>
  );
}

export default function Nav({ page, status, session, textSize, onSync, onLogout }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="brand-mark"><Icon name="box" size="1.6em" /></span>
          <span className="brand-name">Inventario <strong>Venova</strong></span>
        </div>

        <div className="topbar-tools">
          <ConnectionPill status={status} />
          {!status.needsLogin && (
            <button type="button" className="btn btn-sm" onClick={onSync} disabled={status.syncing} title="Trae los datos más recientes y envía lo pendiente">
              <Icon name="refresh" className={status.syncing ? 'spin' : ''} /> Actualizar
            </button>
          )}
          <TextSizeControl textSize={textSize} />
          <span className="whoami"><Icon name="user" /> {session.username}</span>
          <button type="button" className="btn btn-sm" onClick={onLogout}>
            <Icon name="logout" /> Salir
          </button>
        </div>
      </div>

      <nav className="tabs" aria-label="Secciones">
        <a href="#/products" className="tab" aria-current={page === 'products' ? 'page' : undefined}>
          <Icon name="box" size="1.4em" /> Productos
        </a>
        <a href="#/movements" className="tab" aria-current={page === 'movements' ? 'page' : undefined}>
          <Icon name="swap" size="1.4em" /> Entradas y salidas
        </a>
      </nav>
    </header>
  );
}

// Avisos que explican qué pasa y qué se puede hacer. Solo aparecen cuando hay algo que decir.
export function StatusBanners({ status, onSync, onLogin }) {
  const tried = !!status.error || !!status.lastSync;
  const offline = !status.online && !status.needsLogin && tried;
  const otherError = status.online && !status.needsLogin && status.error;

  return (
    <div className="banners">
      {status.needsLogin && (
        <div className="banner banner-warn" role="alert">
          <Icon name="alert" size="1.6em" />
          <div className="banner-text">
            <strong>Tu sesión venció.</strong>
            <span>Inicia sesión otra vez para actualizar los datos. Mientras tanto puedes seguir registrando movimientos: quedan guardados en este equipo.</span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onLogin}>Iniciar sesión</button>
        </div>
      )}

      {offline && (
        <div className="banner banner-warn" role="status">
          <Icon name="wifiOff" size="1.6em" />
          <div className="banner-text">
            <strong>No hay conexión con el servidor.</strong>
            <span>
              {status.pending > 0
                ? `Tienes ${status.pending === 1 ? '1 movimiento guardado' : `${status.pending} movimientos guardados`} en este equipo: se enviará${status.pending === 1 ? '' : 'n'} solo${status.pending === 1 ? '' : 's'} cuando vuelva internet. `
                : 'Puedes seguir registrando entradas y salidas: se enviarán solas cuando vuelva internet. '}
              Para crear o editar productos sí hace falta conexión.
            </span>
          </div>
          <button type="button" className="btn" onClick={onSync} disabled={status.syncing}>Reintentar</button>
        </div>
      )}

      {otherError && (
        <div className="banner banner-err" role="alert">
          <Icon name="alert" size="1.6em" />
          <div className="banner-text">
            <strong>No se pudieron actualizar los datos.</strong>
            <span>{status.error}</span>
          </div>
          <button type="button" className="btn" onClick={onSync} disabled={status.syncing}>Reintentar</button>
        </div>
      )}

      {status.pending > 0 && !offline && (
        <div className="banner banner-info" role="status">
          <Icon name="clock" size="1.6em" />
          <div className="banner-text">
            <strong>{status.pending === 1 ? '1 movimiento está esperando para enviarse.' : `${status.pending} movimientos están esperando para enviarse.`}</strong>
            <span>Están guardados en este equipo y no se pierden. Se envían solos cuando hay conexión.</span>
          </div>
        </div>
      )}

      {status.rejected > 0 && (
        <div className="banner banner-err" role="alert">
          <Icon name="alert" size="1.6em" />
          <div className="banner-text">
            <strong>{status.rejected === 1 ? 'El servidor rechazó 1 movimiento.' : `El servidor rechazó ${status.rejected} movimientos.`}</strong>
            <span>No se aplicaron al stock. Puedes ver el motivo en el «Historial» del producto correspondiente.</span>
          </div>
        </div>
      )}
    </div>
  );
}
