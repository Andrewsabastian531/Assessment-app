import { cookies } from 'next/headers';
import type { SessionUser } from '@vedaai/shared';
import { API_URL } from './api-client';
import { TOKEN_COOKIE } from './auth-cookie';

export { TOKEN_COOKIE };

/** Reads the current teacher from the API using the httpOnly cookie set at login. */
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return null;

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as SessionUser;
  } catch {
    // API not reachable — treat as signed out rather than crashing the render.
    return null;
  }
}
