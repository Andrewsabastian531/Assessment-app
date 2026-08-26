import type { Metadata } from 'next';
import { UploadScreen } from '@/components/upload/upload-screen';

export const metadata: Metadata = { title: 'Upload' };

export default async function UploadPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  return <UploadScreen assessmentId={assessmentId} />;
}
