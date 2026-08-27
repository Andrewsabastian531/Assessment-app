import type { NextResponse } from 'next/server';

export const TOKEN_COOKIE = 'vedaai.token';

/** Stores the API JWT in an httpOnly cookie. */
export function setSessionCookie(response: NextResponse, token: string, maxAgeSeconds: number) {
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
