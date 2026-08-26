import type { Metadata } from 'next';
import { ReviewScreen } from '@/components/mapping/review-screen';

export const metadata: Metadata = { title: 'Review' };

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  return <ReviewScreen submissionId={submissionId} />;
}
