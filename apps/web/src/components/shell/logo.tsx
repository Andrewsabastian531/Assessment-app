import { cn } from '@/lib/utils';

/**
 * The VedaAI mark: a near-black rounded square holding a white glyph that reads as a
 * stylised "V" / open book.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'bg-ink-900 inline-flex size-7 shrink-0 items-center justify-center rounded-[7px]',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
        <path
          d="M4 5.5h5.2c1.6 0 2.8.9 2.8 2.4V19c0-1.2-1-2-2.5-2H4V5.5Z"
          fill="white"
          fillOpacity="0.95"
        />
        <path
          d="M20 5.5h-5.2c-1.6 0-2.8.9-2.8 2.4V19c0-1.2 1-2 2.5-2H20V5.5Z"
          fill="white"
          fillOpacity="0.6"
        />
      </svg>
    </span>
  );
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      {!collapsed && (
        <span className="text-ink-900 text-[15px] font-bold tracking-tight">VedaAI</span>
      )}
    </span>
  );
}
