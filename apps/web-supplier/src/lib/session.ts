import { cookies } from 'next/headers';

/**
 * The JWT itself (12h flat expiry, no refresh token — see apps/api/src/auth/auth.service.ts)
 * lives only in this httpOnly cookie, set server-side by actions/auth.ts. It never reaches
 * browser JS, which is the only mitigation available against token theft since there is no
 * revocation endpoint to fall back on.
 */
export const SESSION_COOKIE = 'apex_supplier_token';

export async function getToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60, // matches the backend's own JWT expiresIn: '12h'
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
