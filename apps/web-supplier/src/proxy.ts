import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, REFRESH_COOKIE, ACCESS_MAX_AGE_SECONDS, REFRESH_MAX_AGE_SECONDS } from './lib/session';

// Renamed from Middleware in Next.js 16 — runs on the Node.js runtime by
// default (16.0+), so a plain fetch() to the backend below is unremarkable,
// no Edge-runtime constraints apply.
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];
const REFRESH_ENDPOINT = '/auth/supplier/refresh';
const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const REFRESH_THRESHOLD_SECONDS = 5 * 60;
const REFRESH_TIMEOUT_MS = 1500;

function decodeExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/**
 * Proactively refreshes the access token before it expires — this is what
 * lets the 1h access token (see apps/api/src/auth/auth.service.ts) be
 * invisible to the user instead of forcing a re-login every hour. Runs on
 * every navigation *including prefetches*, per Next's own auth guide, so it
 * must stay cheap: skip on prefetch requests, and fail open (never force a
 * logout) on anything but a definitive rejection from the backend — a
 * timeout or a momentary backend blip must not log a real session out.
 */
async function refreshSessionIfNeeded(request: NextRequest): Promise<NextResponse | null> {
  if (request.headers.get('next-router-prefetch') !== null) return null;

  const accessToken = request.cookies.get(SESSION_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const exp = accessToken ? decodeExp(accessToken) : null;
  const nearExpiry = exp === null || exp - Date.now() / 1000 < REFRESH_THRESHOLD_SECONDS;
  if (!nearExpiry) return null;

  try {
    const res = await fetch(`${API_URL}${REFRESH_ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });

    if (res.status === 401) {
      // Definitive rejection (expired/revoked refresh token, or a deactivated account) —
      // clear both cookies so the redirect-to-login logic below takes over cleanly.
      request.cookies.delete(SESSION_COOKIE);
      request.cookies.delete(REFRESH_COOKIE);
      return null;
    }
    if (!res.ok) return null; // ambiguous failure — fail open, leave cookies untouched

    const { token, refreshToken: newRefreshToken } = (await res.json()) as { token: string; refreshToken: string };
    request.cookies.set(SESSION_COOKIE, token);
    request.cookies.set(REFRESH_COOKIE, newRefreshToken);
    const response = NextResponse.next({ request });
    response.cookies.set(SESSION_COOKIE, token, cookieOptions(ACCESS_MAX_AGE_SECONDS));
    response.cookies.set(REFRESH_COOKIE, newRefreshToken, cookieOptions(REFRESH_MAX_AGE_SECONDS));
    return response;
  } catch {
    return null; // network error/timeout — fail open, a genuinely expired token will 401 downstream
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path);

  const refreshed = await refreshSessionIfNeeded(request);

  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!isPublic && !hasSession) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (isPublic && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return refreshed ?? NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
