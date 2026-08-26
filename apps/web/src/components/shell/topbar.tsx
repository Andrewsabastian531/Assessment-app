'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  ClipboardList,
  HelpCircle,
  Menu,
  PanelLeft,
  Sparkles,
} from 'lucide-react';
import type { SessionUser } from '@vedaai/shared';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { ProfileMenu } from './profile-menu';

interface TopbarProps {
  breadcrumb: string;
  user: SessionUser | null;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  hasNotifications?: boolean;
  onOpenMobileNav: () => void;
}

export function Topbar({
  breadcrumb,
  user,
  sidebarCollapsed,
  onToggleSidebar,
  hasNotifications = true,
  onOpenMobileNav,
}: TopbarProps) {
  const router = useRouter();

  return (
    <header className="relative z-30 flex h-topbar shrink-0 items-center justify-between border-b border-ink-200 bg-white px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-1.5">
        {/*
          The sidebar toggle lives here rather than inside the sidebar itself.
          Inside the rail it had nowhere to go once collapsed — 64px cannot hold
          both the logo and the control, so the button ended up underneath the
          logo and became unclickable. In the topbar it is always visible and
          always in the same place, in both states.
        */}
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={!sidebarCollapsed}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden rounded-md p-1.5 text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 lg:inline-flex"
        >
          <PanelLeft
            className={cn('size-[18px] transition-transform', sidebarCollapsed && 'rotate-180')}
          />
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="rounded-md p-1.5 text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
        >
          <ArrowLeft className="size-[18px]" />
        </button>

        <span className="hidden items-center gap-1.5 text-[13px] font-medium text-ink-600 lg:flex">
          <ClipboardList className="size-4 text-ink-500" />
          {breadcrumb}
        </span>

        <span className="lg:hidden">
          <Logo />
        </span>
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1">
        <ComingSoonTooltip label="Help">
          <HelpCircle className="size-[18px]" />
        </ComingSoonTooltip>

        <IconAction label="Notifications">
          <span className="relative">
            <Bell className="size-[18px]" />
            {hasNotifications && (
              <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-brand-500 ring-2 ring-white" />
            )}
          </span>
        </IconAction>

        <IconAction label="AI assistant" className="hidden sm:inline-flex">
          <Sparkles className="size-[18px]" />
        </IconAction>

        {user && <ProfileMenu user={user} />}

        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open menu"
          className="ml-0.5 rounded-md p-1.5 text-ink-700 transition-colors hover:bg-ink-100 lg:hidden"
        >
          <Menu className="size-[18px]" />
        </button>
      </div>
    </header>
  );
}

/**
 * Wraps an action that is not built yet. Uses hover and focus rather than the
 * `title` attribute so the copy appears immediately and is keyboard reachable.
 */
function ComingSoonTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? 'coming-soon-tip' : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center rounded-md p-1.5 text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
      >
        {children}
      </button>

      {open && (
        <span
          id="coming-soon-tip"
          role="tooltip"
          className="pointer-events-none absolute right-0 top-[calc(100%+6px)] z-50 whitespace-nowrap rounded-md bg-ink-900 px-2.5 py-1.5 text-[11.5px] font-medium text-white shadow-pop"
        >
          Will be released soon
          <span className="ml-1.5 text-ink-400">v1.1.0</span>
        </span>
      )}
    </span>
  );
}

function IconAction({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md p-1.5 text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900',
        className,
      )}
    >
      {children}
    </button>
  );
}
