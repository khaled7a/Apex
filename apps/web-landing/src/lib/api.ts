const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(typeof (body as { message?: unknown })?.message === 'string' ? (body as { message: string }).message : `API error ${status}`);
  }
}

/**
 * This app never holds a session cookie — every call here is unauthenticated
 * (register/login only), so unlike the 3 portals' apiFetch there is no token
 * to attach. Never throws on a 401 (the expected shape of "wrong password"
 * here) — callers inspect `.ok/.status` themselves, since a single unified
 * login attempt fans out across all three actor-type endpoints and a 401
 * from one or two of them is routine, not exceptional.
 */
export async function tryAuthFetch<T = unknown>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, status: res.status };
  }
  return { ok: true, data: data as T };
}
