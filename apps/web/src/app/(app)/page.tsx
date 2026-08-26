import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getSession } from '@/lib/session';

export default async function HomePage() {
  const session = await getSession();

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-20 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-ink-900">
        Welcome back,{' '}
        <span className="text-brand-500">{session?.firstName ?? 'there'}</span>
      </h1>
      <p className="mt-2 text-[15px] text-ink-600">
        {session?.school
          ? `Grading for ${session.school.name}.`
          : 'Grade a paper with AI in a few minutes.'}
      </p>
      <Link
        href="/exams"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink-800"
      >
        Go to Exams
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
