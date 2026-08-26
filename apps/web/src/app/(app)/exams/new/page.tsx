import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_URL } from '@/lib/api-client';
import { TOKEN_COOKIE } from '@/lib/session';

/** Creates a fresh exam and drops the teacher straight onto its upload screen. */
export default async function NewExamPage() {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;

  const response = await fetch(`${API_URL}/api/v1/assessments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title: 'Untitled exam' }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Could not create a new exam. Is the API running?');
  }

  const assessment = (await response.json()) as { id: string };
  redirect(`/exams/${assessment.id}/upload`);
}
