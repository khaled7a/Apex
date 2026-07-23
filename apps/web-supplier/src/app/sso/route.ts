import { NextRequest, NextResponse } from 'next/server';
import { setSessionCookies } from '@/lib/session';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

/**
 * Consumes a one-time handoff code minted by apps/web-landing's unified
 * login page — see AuthService.consumeSsoHandoffCode. Called
 * server-to-server only (this Route Handler calling the API directly), so
 * nothing sensitive ever travels through the browser's address bar: the
 * code itself is single-use and 60s-lived, never the actual JWT/refresh
 * token.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=sso_expired', request.url));
  }

  const res = await fetch(`${API_URL}/auth/sso/consume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorType: 'SUPPLIER', code }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.redirect(new URL('/login?error=sso_expired', request.url));
  }

  const { token, refreshToken } = (await res.json()) as { token: string; refreshToken: string };
  await setSessionCookies(token, refreshToken);
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
