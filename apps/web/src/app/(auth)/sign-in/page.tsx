'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Logo } from '@/components/shell/logo';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = React.useState('madhur@vedaai.test');
  const [password, setPassword] = React.useState('vedaai123');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.message ?? 'Sign in failed');
      setPending(false);
      return;
    }

    // Full navigation, not router.push — the shell is a server component and
    // must re-render with the new session cookie.
    window.location.href = searchParams.get('next') ?? '/exams';
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-card border border-ink-200 bg-white p-6 shadow-card">
          <h1 className="text-[20px] font-bold tracking-tight text-ink-900">
            Sign in to <span className="text-brand-500">VedaAI</span>
          </h1>
          <p className="mt-1 text-[13px] text-ink-600">
            Grade a paper with AI in minutes.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-ink-700">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-10 rounded-lg border border-ink-200 px-3 text-[14px] outline-none transition-colors focus:border-brand-400"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-ink-700">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-10 rounded-lg border border-ink-200 px-3 text-[14px] outline-none transition-colors focus:border-brand-400"
              />
            </label>

            {error && (
              <p className="flex items-start gap-1.5 text-[12px] text-danger-600">
                <AlertCircle className="mt-px size-3.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-ink-900 text-[13px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:bg-ink-300"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Sign in
            </button>
          </form>

          <p className="mt-4 border-t border-ink-100 pt-3 text-[11.5px] text-ink-400">
            Seeded demo account is pre-filled. Google sign-in can be enabled by
            setting GOOGLE_CLIENT_ID in .env.
          </p>
        </div>
      </div>
    </div>
  );
}
