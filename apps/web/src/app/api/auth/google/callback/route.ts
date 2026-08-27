import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api-client';
import { setSessionCookie } from '@/lib/auth-cookie';
import { googleRedirectUri } from '@/lib/oauth';

const fail = (request: Request, reason: string) =>
  NextResponse.redirect(new URL(`/sign-in?error=${reason}`, request.url));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (url.searchParams.get('error')) return fail(request, 'google-cancelled');
  if (!code || !state) return fail(request, 'google-missing-code');

  // The state cookie must match, or this callback did not originate from us.
  const cookieState = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === 'vedaai.oauth_state')?.[1];

  if (!cookieState || cookieState !== state) return fail(request, 'google-bad-state');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: googleRedirectUri(request),
      grant_type: 'authorization_code',
    }),
  }).catch(() => null);

  const tokens = (await tokenResponse?.json().catch(() => null)) as { id_token?: string } | null;

  if (!tokenResponse?.ok || !tokens?.id_token) {
    return fail(request, 'google-token-exchange-failed');
  }

  // The API re-verifies this token with Google; the web app never decides who
  // the user is on its own.
  const exchange = await fetch(`${API_URL}/api/v1/auth/oauth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'google', idToken: tokens.id_token }),
  }).catch(() => null);

  const payload = await exchange?.json().catch(() => null);
  if (!exchange?.ok || !payload?.accessToken) {
    return fail(request, 'google-exchange-rejected');
  }

  const response = NextResponse.redirect(new URL('/exams', request.url));
  setSessionCookie(response, payload.accessToken, payload.expiresIn);
  response.cookies.set('vedaai.oauth_state', '', { path: '/', maxAge: 0 });
  return response;
}
