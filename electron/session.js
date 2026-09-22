// electron/session.js
// Guarda servidor + usuario + token. El token se cifra con el almacén del sistema
// (DPAPI en Windows) vía safeStorage; si no está disponible, vive sólo en memoria.

import fs from 'fs';
import path from 'path';
import { app, safeStorage } from 'electron';

const file = () => path.join(app.getPath('userData'), 'session.json');

export function createSession() {
  let current = null; // { baseUrl, username, token }

  try {
    const raw = JSON.parse(fs.readFileSync(file(), 'utf8'));
    let token = '';
    if (raw.token && safeStorage.isEncryptionAvailable()) {
      token = safeStorage.decryptString(Buffer.from(raw.token, 'base64'));
    }
    if (raw.baseUrl) current = { baseUrl: raw.baseUrl, username: raw.username || '', token };
  } catch {
    /* primera vez o archivo ilegible */
  }

  function persist() {
    if (!current) {
      fs.rmSync(file(), { force: true });
      return;
    }
    const out = { baseUrl: current.baseUrl, username: current.username };
    if (current.token && safeStorage.isEncryptionAvailable()) {
      out.token = safeStorage.encryptString(current.token).toString('base64');
    }
    fs.writeFileSync(file(), JSON.stringify(out));
  }

  return {
    get: () => current,
    set(next) {
      current = next;
      persist();
    },
    /** Conserva servidor y usuario pero descarta el token (sesión vencida). */
    dropToken() {
      if (current) {
        current = { ...current, token: '' };
        persist();
      }
    },
    clear() {
      current = null;
      persist();
    },
  };
}
