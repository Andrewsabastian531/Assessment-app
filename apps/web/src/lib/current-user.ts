import type { SidebarSchool } from '@/components/shell/sidebar';
import type { TopbarUser } from '@/components/shell/topbar';

export interface CurrentIdentity {
  user: TopbarUser;
  school: SidebarSchool;
}

/**
 * Identity shown in the shell.
 *
 * Currently returns the seeded demo teacher so the UI is fully renderable
 * before the auth flow is wired. Once AuthModule lands this is replaced by the
 * Auth.js session lookup — the return shape stays identical, so no component
 * that consumes it needs to change.
 */
export async function getCurrentIdentity(): Promise<CurrentIdentity> {
  return {
    user: { name: 'Madhur Rastogi', avatarUrl: null },
    school: { name: 'Delhi Public School', city: 'Bokaro Steel City', crestUrl: null },
  };
}
