'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Logo } from '@/components/shell/logo';
import { OAUTH_ERRORS } from '@/lib/oauth';
import { cn } from '@/lib/utils';

type Mode = 'signin' | 'signup';

export function AuthForm({ googleEnabled }: { googleEnabled: boolean }) {
  const searchParams = useSearchParams();
  const [mode, setMode] = React.useState<Mode>('signin');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(
    OAUTH_ERRORS[searchParams.get('error') ?? ''] ?? null,
  );

  const [form, setForm] = React.useState({
    firstName: '',
    lastName: '',
    schoolName: '',
    email: '',
    password: '',
  });

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const endpoint = mode === 'signin' ? '/api/auth/login' : '/api/auth/register';
    const body =
      mode === 'signin'
        ? { email: form.email, password: form.password }
        : form;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);

    if (!response?.ok) {
      const payload = await response?.json().catch(() => ({}));
      setError(payload?.message ?? 'Something went wrong. Please try again.');
      setPending(false);
      return;
    }

    // Hard navigation, not router.push — the shell is a server component and has
    // to re-render with the new session cookie.
    window.location.href = searchParams.get('next') ?? '/exams';
  };

  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>

      <div className="rounded-card border border-ink-200 bg-white p-6 shadow-card">
        {/* mode switch */}
        <div className="mb-5 flex gap-1 rounded-full bg-ink-100 p-1">
          {(['signin', 'signup'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setError(null);
              }}
              className={cn(
                'flex-1 rounded-full py-1.5 text-[12.5px] font-semibold transition-colors',
                mode === value
                  ? 'bg-white text-ink-900 shadow-card'
                  : 'text-ink-500 hover:text-ink-800',
              )}
            >
              {value === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <h1 className="text-[19px] font-bold tracking-tight text-ink-900">
          {mode === 'signin' ? (
            <>
              Sign in to <span className="text-brand-500">VedaAI</span>
            </>
          ) : (
            <>
              Create your <span className="text-brand-500">VedaAI</span> account
            </>
          )}
        </h1>
        <p className="mt-1 text-[12.5px] text-ink-600">
          {mode === 'signin'
            ? 'Grade a paper with AI in minutes.'
            : 'Tell us who you are and where you teach.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
          {mode === 'signup' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="First name"
                  value={form.firstName}
                  onChange={set('firstName')}
                  autoComplete="given-name"
                  required
                />
                <Field
                  label="Last name"
                  value={form.lastName}
                  onChange={set('lastName')}
                  autoComplete="family-name"
                  required
                />
              </div>
              <Field
                label="School name"
                value={form.schoolName}
                onChange={set('schoolName')}
                autoComplete="organization"
                placeholder="e.g. Delhi Public School"
                required
              />
            </>
          )}

          <Field
            label="Email address"
            type="email"
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
            required
          />
          <Field
            label="Password"
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            hint={mode === 'signup' ? 'At least 8 characters' : undefined}
            required
          />

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
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {googleEnabled && (
          <>
            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-ink-200" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
                or
              </span>
              <span className="h-px flex-1 bg-ink-200" />
            </div>

            <a
              href="/api/auth/google/start"
              className="flex h-10 items-center justify-center gap-2.5 rounded-full border border-ink-200 text-[13px] font-semibold text-ink-800 transition-colors hover:bg-ink-50"
            >
              <GoogleMark />
              Continue with Google
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-ink-700">{label}</span>
      <input
        {...props}
        className="h-10 rounded-lg border border-ink-200 px-3 text-[14px] outline-none transition-colors focus:border-brand-400"
      />
      {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
    </label>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.26-2.09 3.56-5.17 3.56-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.28a12 12 0 0 0 0 10.76l3.99-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}
