import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { API_URL } from '@/lib/api-client';
import { TOKEN_COOKIE } from '@/lib/session';

interface AssessmentSummary {
  id: string;
  updatedAt: string;
}

/**
 * The exam list UI is not designed yet, so this lands on the most recently
 * updated exam's upload screen — the flow the Figma screens actually cover.
 */
export default async function ExamsPage() {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;

  const assessments = await fetch(`${API_URL}/api/v1/assessments`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
    .then((response) => (response.ok ? (response.json() as Promise<AssessmentSummary[]>) : []))
    .catch(() => [] as AssessmentSummary[]);

  const target = assessments[0];
  redirect(target ? `/exams/${target.id}/upload` : '/exams/new');
}
