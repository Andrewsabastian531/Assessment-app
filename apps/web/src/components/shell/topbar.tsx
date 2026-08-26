'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  ClipboardList,
  HelpCircle,
  Menu,
  Sparkles,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, initials } from '@/lib/utils';
import { Logo } from './logo';

export interface TopbarUser {
  name: string;
  avatarUrl: string | null;
}

interface TopbarProps {
  breadcrumb: string;
  user: TopbarUser | null;
  hasNotifications?: boolean;
  onOpenMobileNav: () => void;
}

export function Topbar({
  breadcrumb,
  user,
  hasNotifications = true,
  onOpenMobileNav,
}: TopbarProps) {
  const router = useRouter();

  return (
    <header className="flex h-topbar shrink-0 items-center justify-between border-b border-ink-200 bg-white px-3 sm:px-4">
      {/* ---- left: back + breadcrumb (desktop) / logo (mobile) ---- */}
      <div className="flex min-w-0 items-center gap-2">
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

      {/* ---- right: actions ---- */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        <IconAction label="Help" className="hidden sm:inline-flex">
          <HelpCircle className="size-[18px]" />
        </IconAction>

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

        {user && (
          <button
            type="button"
            className="ml-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-ink-100 sm:pr-2"
          >
            <Avatar>
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
            <span className="hidden text-[13px] font-medium text-ink-900 lg:inline">
              {user.name}
            </span>
            <ChevronDown className="hidden size-4 text-ink-500 lg:inline" />
          </button>
        )}

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
