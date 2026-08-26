import { AppShell } from '@/components/shell/app-shell';
import { getCurrentIdentity } from '@/lib/current-user';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, school } = await getCurrentIdentity();

  return (
    <AppShell user={user} school={school}>
      {children}
    </AppShell>
  );
}
