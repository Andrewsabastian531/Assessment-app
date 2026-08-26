import type { Metadata } from 'next';
import { ExtractingScreen } from '@/components/upload/extracting-screen';

export const metadata: Metadata = { title: 'Extracting' };

export default async function ExtractingPage({
  params,
  searchParams,
}: {
  params: Promise<{ assessmentId: string }>;
  searchParams: Promise<{ job?: string; submission?: string }>;
}) {
  const { assessmentId } = await params;
  const { job, submission } = await searchParams;

  return (
    <ExtractingScreen
      assessmentId={assessmentId}
      jobId={job ?? null}
      submissionId={submission ?? null}
    />
  );
}
