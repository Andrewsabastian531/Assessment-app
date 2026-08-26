import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { getSession } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/sign-in');

  return <AppShell user={session}>{children}</AppShell>;
}
