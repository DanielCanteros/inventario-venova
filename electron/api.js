// electron/api.js
// Cliente HTTP de la API de Venova. Distingue "sin conexión" de "el servidor dijo que no".

export class NetworkError extends Error {}
export class AuthError extends Error {}
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const TIMEOUT_MS = 15000;

/**
 * @param {() => ({ baseUrl: string, token?: string } | null)} getSession
 */
export function createApi(getSession) {
  async function request(method, path, body, { auth = true, baseUrl } = {}) {
    const session = getSession();
    const base = (baseUrl || session?.baseUrl || '').replace(/\/+$/, '');
    if (!base) throw new NetworkError('No hay servidor configurado');

    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      if (!session?.token) throw new AuthError('Inicia sesión');
      headers.Authorization = `Bearer ${session.token}`;
    }

    let res;
    try {
      res = await fetch(base + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new NetworkError(err?.name === 'TimeoutError' ? 'El servidor no responde' : 'Sin conexión con el servidor');
    }

    let json = null;
    try {
      json = await res.json();
    } catch {
      /* respuesta sin JSON (p. ej. 502 de un proxy) */
    }

    // 502/503/504 = el servidor/proxy no está disponible: se trata como "sin conexión"
    if ([502, 503, 504].includes(res.status)) throw new NetworkError('Servidor no disponible');
    // El login devuelve 401 por credenciales malas: eso es ApiError, no sesión vencida
    if (res.status === 401 && auth) throw new AuthError(json?.message || 'Sesión vencida');
    if (!res.ok || json?.success === false) {
      throw new ApiError(res.status, json?.message || `Error ${res.status}`);
    }
    return json;
  }

  return {
    login: (baseUrl, username, password) =>
      request('POST', '/api/auth/login', { username, password }, { auth: false, baseUrl }),
    getProducts: () => request('GET', '/api/products?active=all'),
    createProduct: (data) => request('POST', '/api/products', data),
    updateProduct: (id, data) => request('PUT', `/api/products/${encodeURIComponent(id)}`, data),
    createMovement: (data) => request('POST', '/api/movements', data),
    createMovementsBatch: (movements) => request('POST', '/api/movements/batch', { movements }),
    getMovements: (productId) => request('GET', `/api/movements?product=${encodeURIComponent(productId)}&limit=500`),
  };
}
