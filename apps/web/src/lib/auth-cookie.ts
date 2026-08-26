import type { NextResponse } from 'next/server';

export const TOKEN_COOKIE = 'vedaai.token';

/**
 * Stores the API JWT in an httpOnly cookie. It is never exposed to client JS, so
 * an XSS cannot read it, and the browser replays it to the API automatically —
 * localhost:3000 and localhost:4000 are the same site, so a Lax cookie crosses
 * the port boundary.
 */
export function setSessionCookie(
  response: NextResponse,
  token: string,
  maxAgeSeconds: number,
) {
  response.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(TOKEN_COOKIE, '', { path: '/', maxAge: 0 });
}
