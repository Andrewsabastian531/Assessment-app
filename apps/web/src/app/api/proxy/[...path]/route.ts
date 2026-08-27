import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api-client';
import { TOKEN_COOKIE } from '@/lib/auth-cookie';

/**
 * Same-origin proxy to the API.
 *
 * The session lives in an httpOnly cookie set by this app, and a cookie is
 * scoped to the domain that set it — SameSite=none permits a cookie to travel
 * on cross-site requests *to its own domain*, it does not send a vercel.app
 * cookie to onrender.com. So the browser cannot authenticate against the API
 * directly when the two are on different domains.
 *
 * Routing through here fixes that: the browser calls this app, the cookie is
 * read server-side, and the token is forwarded as a bearer header. It also
 * removes CORS from the picture, since the browser only ever talks to its own
 * origin.
 *
 * Deploying both on one domain (app.example.com + api.example.com) makes this
 * unnecessary — set COOKIE_DOMAIN and call the API directly.
 */

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

async function forward(request: Request, path: string[]) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const search = new URL(request.url).search;
  const target = `${API_URL}/api/v1/${path.join('/')}${search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  // The API never sees the cookie; it gets the token it issued instead.
  headers.delete('cookie');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const hasBody = !['GET', 'HEAD'].includes(request.method);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { message: `Could not reach the API at ${API_URL}.` },
      { status: 502 },
    );
  }

  // 204 and 304 must not carry a body.
  const body = upstream.status === 204 || upstream.status === 304 ? null : upstream.body;

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) responseHeaders.set('content-type', contentType);

  return new NextResponse(body, { status: upstream.status, headers: responseHeaders });
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, { params }: Context) {
  return forward(request, (await params).path);
}
export async function POST(request: Request, { params }: Context) {
  return forward(request, (await params).path);
}
export async function PATCH(request: Request, { params }: Context) {
  return forward(request, (await params).path);
}
export async function PUT(request: Request, { params }: Context) {
  return forward(request, (await params).path);
}
export async function DELETE(request: Request, { params }: Context) {
  return forward(request, (await params).path);
}
