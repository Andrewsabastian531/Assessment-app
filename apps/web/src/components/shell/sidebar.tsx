'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo, LogoMark } from './logo';
import { PRIMARY_NAV, isNavItemActive } from './nav-config';
import { SchoolCard, SchoolCrest } from './school-card';

export interface SidebarSchool {
  name: string;
  city: string | null;
  crestUrl: string | null;
}

interface SidebarProps {
  collapsed: boolean;
  school: SidebarSchool | null;
}

/**
 * The persistent left rail. Two visual states, both present in the designs:
 *  - expanded (232px) on the upload screens
 *  - icon-only (64px) on the "Extracting…" screen
 */
export function Sidebar({ collapsed, school }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'hidden shrink-0 flex-col border-r border-ink-200 bg-white transition-[width] duration-200 ease-out lg:flex',
        collapsed ? 'w-rail' : 'w-sidebar',
      )}
    >
      {/* ---------------- brand row ---------------- */}
      <div
        className={cn(
          'flex h-topbar items-center',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        {collapsed ? <LogoMark /> : <Logo />}
      </div>

      {/* ---------------- primary CTA ---------------- */}
      <div className={cn('pb-2', collapsed ? 'px-2' : 'px-3')}>
        {collapsed ? (
          <button
            type="button"
            aria-label="AI Teachers Toolkit"
            className="flex size-10 items-center justify-center rounded-full border-2 border-brand-200 bg-ink-900 text-white transition-transform hover:scale-105"
          >
            <Sparkles className="size-4 text-brand-400" />
          </button>
        ) : (
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-ink-900 px-4 py-2.5 text-[13px] font-semibold text-white ring-2 ring-brand-500/70 transition-colors hover:bg-ink-800"
          >
            <Sparkles className="size-4 text-brand-400" />
            AI Teacher&apos;s Toolkit
          </button>
        )}
      </div>

      {/* ---------------- navigation ---------------- */}
      <nav className={cn('flex flex-1 flex-col gap-0.5 pt-2', collapsed ? 'px-2' : 'px-3')}>
        {PRIMARY_NAV.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center rounded-nav text-[13.5px] font-medium transition-colors',
                collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2',
                active
                  ? 'bg-ink-100 text-ink-900'
                  : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
              )}
            >
              <Icon className={cn('size-[17px]', active ? 'text-ink-900' : 'text-ink-500')} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* ---------------- footer ---------------- */}
      <div className={cn('flex flex-col gap-3 pb-4', collapsed ? 'px-2' : 'px-3')}>
        {!collapsed && (
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-nav px-3 py-2 text-[13.5px] font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
          >
            <Settings className="size-[17px] text-ink-500" />
            Settings
          </Link>
        )}

        {school &&
          (collapsed ? (
            <div className="flex justify-center">
              <SchoolCrest school={school} />
            </div>
          ) : (
            <SchoolCard school={school} />
          ))}
      </div>
    </aside>
  );
}
