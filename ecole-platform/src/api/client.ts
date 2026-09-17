/**
 * Client HTTP bas niveau vers l'API Django (backend/).
 * Gère le stockage des tokens JWT, le rafraîchissement automatique sur 401,
 * et la pagination DRF (page_size=50) via getAll().
 */

export const API_BASE: string = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api';

const STORAGE_KEY = 'edumanage-auth-tokens';

export interface Tokens {
  access: string;
  refresh: string;
}

export function getTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setTokens(tokens: Tokens | null) {
  if (tokens) localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(STORAGE_KEY);
}

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(typeof body === 'string' ? body : JSON.stringify(body));
    this.status = status;
    this.body = body;
  }
}

/** Levée quand une écriture échoue faute de réseau, sur un endpoint qui n'est
 * PAS mis en file d'attente par le service worker (voir src/sw.ts) — toute
 * écriture hors Notes/Présences/Paiements. */
export class OfflineError extends Error {
  constructor() {
    super("Vous êtes hors connexion. Cette action nécessite une connexion internet.");
  }
}

/** Vrai si la réponse provient du service worker parce que la requête a été
 * mise en file d'attente hors-ligne (statut 202, voir src/sw.ts) plutôt que
 * d'une vraie réponse du serveur Django. */
export function isQueuedResponse(body: unknown): body is { queued: true } {
  return !!body && typeof body === 'object' && (body as any).queued === true;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens?.refresh) return null;

  // Évite les rafraîchissements concurrents multiples (plusieurs requêtes en 401 en même temps).
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: tokens.refresh }),
    })
      .then(async res => {
        if (!res.ok) {
          setTokens(null);
          return null;
        }
        const data = await res.json();
        setTokens({ access: data.access, refresh: tokens.refresh });
        return data.access as string;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, allowRetry = true): Promise<T> {
  const tokens = getTokens();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> | undefined) };
  if (tokens?.access) headers['Authorization'] = `Bearer ${tokens.access}`;

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (networkErr) {
    // Échec réseau réel (pas intercepté par le service worker — les endpoints
    // Notes/Présences/Paiements sont eux mis en file, voir src/sw.ts, et ne
    // passent jamais par ce chemin même hors-ligne).
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new OfflineError();
    }
    throw networkErr;
  }

  if (res.status === 401 && allowRetry && tokens?.refresh) {
    const newAccess = await refreshAccessToken();
    if (newAccess) return request<T>(path, options, false);
  }

  if (!res.ok) {
    let body: any = null;
    try { body = await res.json(); } catch { /* pas de corps JSON */ }
    throw new ApiError(res.status, body ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Récupère toutes les pages d'un endpoint liste DRF et concatène les résultats. */
async function getAll<T>(path: string): Promise<T[]> {
  let next: string | null = path;
  let out: T[] = [];
  while (next) {
    const data: Paginated<T> = await request<Paginated<T>>(next);
    out = out.concat(data.results);
    next = data.next;
  }
  return out;
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  getAll: <T>(path: string) => getAll<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
};

/** Extrait un message d'erreur lisible d'une ApiError (ou d'une erreur générique). */
export function errorMessage(err: unknown): string {
  if (err instanceof OfflineError) return err.message;
  if (err instanceof ApiError) {
    const b = err.body;
    if (typeof b === 'string') return b;
    if (b?.non_field_errors) return b.non_field_errors.join(' ');
    if (b?.detail) return b.detail;
    if (b && typeof b === 'object') {
      const firstKey = Object.keys(b)[0];
      const val = b[firstKey];
      return Array.isArray(val) ? `${firstKey}: ${val.join(' ')}` : String(val);
    }
    return `Erreur ${err.status}`;
  }
  return err instanceof Error ? err.message : 'Erreur inconnue';
}
