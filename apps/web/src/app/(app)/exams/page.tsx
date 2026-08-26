import { redirect } from 'next/navigation';

/**
 * The exam list is not built yet. Until it is, land on the seeded demo
 * assessment so the upload flow is reachable from the sidebar.
 */
export default function ExamsPage() {
  redirect('/exams/assessment_demo/upload');
}
