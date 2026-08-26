'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Sparkles } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { PRIMARY_NAV, isNavItemActive } from './nav-config';
import { SchoolCard } from './school-card';
import type { SessionUser } from '@vedaai/shared';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

interface ShellContextValue {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  setBreadcrumb: (value: string) => void;
}

const ShellContext = React.createContext<ShellContextValue | null>(null);

/**
 * Lets a route drive the shell chrome. The "Extracting…" screen calls
 * `useShellCollapse(true)` to reproduce the icon-rail state in the design.
 */
export function useShell() {
  const ctx = React.useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used inside <AppShell>');
  return ctx;
}

/** Collapses the sidebar while the calling route is mounted, then restores it. */
export function useShellCollapse(collapsed: boolean) {
  const { setCollapsed } = useShell();
  React.useEffect(() => {
    setCollapsed(collapsed);
    return () => setCollapsed(false);
  }, [collapsed, setCollapsed]);
}

export function useBreadcrumb(label: string) {
  const { setBreadcrumb } = useShell();
  React.useEffect(() => {
    setBreadcrumb(label);
  }, [label, setBreadcrumb]);
}

interface AppShellProps {
  /** The signed-in teacher. Everything in the chrome renders from this. */
  user: SessionUser;
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const school = user.school;
  const [collapsed, setCollapsed] = React.useState(false);
  const [breadcrumb, setBreadcrumb] = React.useState('Exams');
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const pathname = usePathname();

  // Close the drawer whenever navigation happens, otherwise it stays open over
  // the new route on mobile.
  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const value = React.useMemo(
    () => ({ collapsed, setCollapsed, setBreadcrumb }),
    [collapsed],
  );

  return (
    <ShellContext.Provider value={value}>
      <div className="flex h-dvh overflow-hidden bg-surface-muted">
        <Sidebar collapsed={collapsed} school={school} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            breadcrumb={breadcrumb}
            user={user}
            sidebarCollapsed={collapsed}
            onToggleSidebar={() => setCollapsed((prev) => !prev)}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>

      {/* Mobile: the sidebar becomes an off-canvas drawer behind the hamburger. */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-topbar items-center px-4">
            <Logo />
          </div>
          <div className="px-3 pb-2">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-ink-900 px-4 py-2.5 text-[13px] font-semibold text-white ring-2 ring-brand-500/70"
            >
              <Sparkles className="size-4 text-brand-400" />
              AI Teacher&apos;s Toolkit
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-3 pt-2">
            {PRIMARY_NAV.map((item) => {
              const active = isNavItemActive(item, pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-nav px-3 py-2 text-[13.5px] font-medium transition-colors',
                    active ? 'bg-ink-100 text-ink-900' : 'text-ink-600 hover:bg-ink-50',
                  )}
                >
                  <Icon
                    className={cn('size-[17px]', active ? 'text-ink-900' : 'text-ink-500')}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex flex-col gap-3 px-3 pb-4">
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-nav px-3 py-2 text-[13.5px] font-medium text-ink-600"
            >
              <Settings className="size-[17px] text-ink-500" />
              Settings
            </Link>
            {school && <SchoolCard school={school} />}
          </div>
        </SheetContent>
      </Sheet>
    </ShellContext.Provider>
  );
}
