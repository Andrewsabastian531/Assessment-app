import { cn } from '@/lib/utils';
import type { SidebarSchool } from './sidebar';

/** The school crest. */
export function SchoolCrest({ school, className }: { school: SidebarSchool; className?: string }) {
  if (school.crestUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={school.crestUrl}
        alt=""
        className={cn('size-8 shrink-0 rounded-full object-cover', className)}
      />
    );
  }

  return (
    <span
      className={cn(
        'bg-success-50 ring-success-100 flex size-8 shrink-0 items-center justify-center rounded-full ring-1',
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none">
        <path
          d="M12 3 4.5 6.2v5.1c0 4.4 3.1 8.4 7.5 9.5 4.4-1.1 7.5-5.1 7.5-9.5V6.2L12 3Z"
          className="fill-success-100 stroke-success-600"
          strokeWidth="1.3"
        />
        <path
          d="M9 12.2h6M12 9.2v6"
          className="stroke-success-600"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function SchoolCard({ school }: { school: SidebarSchool }) {
  return (
    <div className="rounded-card border-ink-200 shadow-card flex items-center gap-2.5 border bg-white px-2.5 py-2">
      <SchoolCrest school={school} />
      <span className="min-w-0">
        <span className="text-ink-900 block truncate text-[12.5px] font-semibold leading-tight">
          {school.name}
        </span>
        {school.city && (
          <span className="text-ink-500 block truncate text-[11px] leading-tight">
            {school.city}
          </span>
        )}
      </span>
    </div>
  );
}
