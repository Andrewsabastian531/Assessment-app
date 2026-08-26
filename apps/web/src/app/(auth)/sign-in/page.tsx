import { Suspense } from 'react';
import type { Metadata } from 'next';
import { API_URL } from '@/lib/api-client';
import { AuthForm } from './auth-form';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Asks the API which social providers it can actually serve, so the page never
 * shows a Google button that would fail the moment it is clicked.
 */
async function googleEnabled(): Promise<boolean> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return false;
  try {
    const response = await fetch(`${API_URL}/api/v1/auth/providers`, {
      cache: 'no-store',
    });
    if (!response.ok) return false;
    const providers = (await response.json()) as { google?: boolean };
    return Boolean(providers.google);
  } catch {
    return false;
  }
}

export default async function SignInPage() {
  const google = await googleEnabled();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-muted px-4 py-10">
      <Suspense>
        <AuthForm googleEnabled={google} />
      </Suspense>
    </div>
  );
}
