import { NextResponse } from 'next/server';
import { registerSchema } from '@vedaai/shared';
import { API_URL } from '@/lib/api-client';
import { setSessionCookie } from '@/lib/auth-cookie';

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Check the form and try again' },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed.data),
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json(
      { message: `Could not reach the API at ${API_URL}. Is it running?` },
      { status: 503 },
    );
  }

  const payload = await upstream.json();
  if (!upstream.ok) {
    return NextResponse.json(
      { message: payload.message ?? 'Could not create the account' },
      { status: upstream.status },
    );
  }

  const response = NextResponse.json({ user: payload.user });
  setSessionCookie(response, payload.accessToken, payload.expiresIn);
  return response;
}
