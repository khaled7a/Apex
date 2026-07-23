import { getToken } from './session';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(typeof (body as { message?: unknown })?.message === 'string' ? (body as { message: string }).message : `API error ${status}`);
  }
}

interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  /** Pass null to explicitly skip attaching a bearer token (login/register, before a session exists). Omit to read the session cookie automatically. */
  token?: string | null;
}

export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const token = options.token === undefined ? await getToken() : options.token;

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const contentType = res.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiError(res.status, data);
  }
  return data as T;
}

/** Two-step attach: upload the raw file first, then use the returned URL as `fileUrl` in the actual domain DTO. */
export async function uploadFile(orderId: string, file: File): Promise<{ id: string; url: string }> {
  const token = await getToken();
  const form = new FormData();
  form.set('orderId', orderId);
  form.set('file', file);

  const res = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data);
  }
  return data as { id: string; url: string };
}
