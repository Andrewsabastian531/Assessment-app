'use client';

import * as React from 'react';
import Link from 'next/link';
import { BookMarked, ChevronDown, LogOut, Settings, SquarePen, UserRound } from 'lucide-react';
import type { SessionUser } from '@vedaai/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, initials } from '@/lib/utils';

const MENU_ITEMS = [
  { label: 'My Profile', href: '/profile', icon: UserRound },
  { label: 'Edit Profile', href: '/profile/edit', icon: SquarePen },
  { label: 'My Library', href: '/library', icon: BookMarked },
  { label: 'Settings', href: '/settings', icon: Settings },
];

/**
 * Avatar button that toggles a dropdown with the signed-in identity, account links and
 * a logout action.
 */
export function ProfileMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape — a dropdown that only closes by
  // clicking the trigger again feels broken.
  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleLogout = async () => {
    setSigningOut(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    // Hard navigation so every server component re-renders without the session.
    window.location.href = '/sign-in';
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'ml-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition-colors sm:pr-2',
          open ? 'bg-ink-100' : 'hover:bg-ink-100',
        )}
      >
        <Avatar>
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <span className="text-ink-900 hidden max-w-[140px] truncate text-[13px] font-medium lg:inline">
          {user.name}
        </span>
        <ChevronDown
          className={cn(
            'text-ink-500 hidden size-4 transition-transform lg:inline',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="rounded-card border-ink-200 shadow-pop absolute right-0 top-[calc(100%+8px)] z-50 w-[248px] overflow-hidden border bg-white"
        >
          {/* identity header */}
          <div className="border-ink-100 flex items-center gap-2.5 border-b px-3 py-3">
            <Avatar className="size-9">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="text-ink-900 block truncate text-[13px] font-semibold">
                {user.name}
              </span>
              <span className="text-ink-500 block truncate text-[11.5px]">{user.email}</span>
            </span>
          </div>

          <div className="py-1">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="text-ink-700 hover:bg-ink-50 hover:text-ink-900 flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors"
                >
                  <Icon className="text-ink-500 size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="border-ink-100 border-t p-2">
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={handleLogout}
              className="border-ink-200 text-ink-700 hover:bg-danger-100 hover:text-danger-600 flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-[12px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-60"
            >
              <LogOut className="size-3.5" />
              {signingOut ? 'Signing out…' : 'Logout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
