import { NextResponse } from 'next/server';
import { loginSchema } from '@vedaai/shared';
import { API_URL } from '@/lib/api-client';
import { setSessionCookie } from '@/lib/auth-cookie';

/** Exchanges credentials for an API JWT and stores it in an httpOnly cookie. */
export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Invalid credentials' },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed.data),
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json(
      { message: 'Could not reach the API. Is it running on ' + API_URL + '?' },
      { status: 503 },
    );
  }

  const payload = await upstream.json();
  if (!upstream.ok) {
    return NextResponse.json(
      { message: payload.message ?? 'Sign in failed' },
      { status: upstream.status },
    );
  }

  const response = NextResponse.json({ user: payload.user });
  setSessionCookie(response, payload.accessToken, payload.expiresIn);
  return response;
}
