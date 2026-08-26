import { cookies } from 'next/headers';
import type { SessionUser } from '@vedaai/shared';
import { API_URL } from './api-client';
import { TOKEN_COOKIE } from './auth-cookie';

export { TOKEN_COOKIE };

/**
 * Reads the current teacher from the API using the httpOnly cookie set at login.
 *
 * The same cookie is sent automatically by the browser on client-side calls to
 * the API (localhost:3000 and localhost:4000 are the same site, so a Lax cookie
 * crosses the port boundary), which is why no token has to reach client JS.
 */
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
