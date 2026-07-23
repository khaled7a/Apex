import { cookies } from 'next/headers';

/**
 * The access-token JWT (1h expiry) lives only in this httpOnly cookie, set
 * server-side by actions/auth.ts. It never reaches browser JS, which is the
 * only mitigation available against token theft. A separate, longer-lived
 * refresh-token cookie (below) lets proxy.ts silently mint a new access
 * token before this one expires, so the user is never forced to re-login
 * mid-session — see apps/api/src/auth/auth.service.ts's refresh()/logout().
 */
export const SESSION_COOKIE = 'apex_customer_token';
export const REFRESH_COOKIE = 'apex_customer_refresh';
export const ACCESS_MAX_AGE_SECONDS = 60 * 60; // matches the backend's issueCustomerToken expiresIn: '1h'
export const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // matches REFRESH_TOKEN_TTL_MS in auth.service.ts

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export async function getToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value;
}

export async function setSessionCookies(token: string, refreshToken: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(ACCESS_MAX_AGE_SECONDS));
  store.set(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_MAX_AGE_SECONDS));
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(REFRESH_COOKIE);
}
