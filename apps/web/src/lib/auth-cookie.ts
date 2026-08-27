import type { NextResponse } from 'next/server';

export const TOKEN_COOKIE = 'vedaai.token';

/**
 * `lax` only reaches the API when both apps share a registrable domain
 * (localhost:3000 -> localhost:4000, or app.example.com -> api.example.com).
 * Hosting the web app on vercel.app and the API on onrender.com puts them on
 * different sites, and the browser drops the cookie — login succeeds and the
 * next request is anonymous. Set COOKIE_SAMESITE=none there.
 */
function cookieOptions(maxAgeSeconds: number) {
  const sameSite = (process.env.COOKIE_SAMESITE ?? 'lax').toLowerCase() as
    | 'lax'
    | 'none'
    | 'strict';

  return {
    httpOnly: true,
    sameSite,
    // `none` is rejected by browsers unless the cookie is also Secure.
    secure: sameSite === 'none' || process.env.NODE_ENV === 'production',
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function setSessionCookie(response: NextResponse, token: string, maxAgeSeconds: number) {
  response.cookies.set(TOKEN_COOKIE, token, cookieOptions(maxAgeSeconds));
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(TOKEN_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
}
