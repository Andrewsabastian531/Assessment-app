import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getSession } from '@/lib/session';

export default async function HomePage() {
  const session = await getSession();

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-20 text-center">
      <h1 className="text-ink-900 text-3xl font-bold tracking-tight">
        Welcome back, <span className="text-brand-500">{session?.firstName ?? 'there'}</span>
      </h1>
      <p className="text-ink-600 mt-2 text-[15px]">
        {session?.school
          ? `Grading for ${session.school.name}.`
          : 'Grade a paper with AI in a few minutes.'}
      </p>
      <Link
        href="/exams"
        className="bg-ink-900 hover:bg-ink-800 mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-colors"
      >
        Go to Exams
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
