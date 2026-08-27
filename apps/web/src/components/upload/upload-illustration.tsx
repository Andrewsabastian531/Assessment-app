import { cn } from '@/lib/utils';

/** Circular portrait inside two peach rings, with four dots on the outer ring. */
export function UploadIllustration({ src, className }: { src?: string; className?: string }) {
  return (
    <div className={cn('relative size-[74px] shrink-0 sm:size-[86px]', className)}>
      {/* outer ring */}
      <div className="bg-brand-100/70 absolute inset-0 rounded-full" />
      {/* inner ring */}
      <div className="bg-brand-200/60 absolute inset-[7px] rounded-full" />

      {/* portrait */}
      <div className="bg-brand-50 absolute inset-[13px] overflow-hidden rounded-full">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="size-full object-cover" />
        ) : (
          <TeacherGlyph />
        )}
      </div>

      {/* orbit dots at N / E / S / W */}
      {[
        'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2',
        'right-0 top-1/2 -translate-y-1/2 translate-x-1/2',
        'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
        'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2',
      ].map((position) => (
        <span
          key={position}
          aria-hidden="true"
          className={cn('bg-brand-500 absolute size-[7px] rounded-full', position)}
        />
      ))}
    </div>
  );
}

function TeacherGlyph() {
  return (
    <svg viewBox="0 0 64 64" className="size-full" aria-hidden="true">
      {/* head */}
      <circle cx="32" cy="24" r="10" className="fill-brand-300" />
      {/* hair */}
      <path
        d="M21.5 24c0-6.5 4.7-11.5 10.5-11.5S42.5 17.5 42.5 24c0-3-2-4.5-5-5.2-2.6-.6-4.4-2-5.5-3.6-1.4 2.4-4.4 4-7.3 4.4-2 .3-3.2 1.9-3.2 4.4Z"
        className="fill-ink-800"
      />
      {/* body */}
      <path d="M14 58c0-9.4 8-15 18-15s18 5.6 18 15H14Z" className="fill-brand-500" />
      {/* collar */}
      <path d="M28 43.5 32 49l4-5.5-4-1.5-4 1.5Z" className="fill-white" />
      {/* held book */}
      <rect x="20" y="46" width="24" height="12" rx="1.5" className="fill-white" />
      <path d="M32 46v12" className="stroke-brand-200" strokeWidth="1.2" />
    </svg>
  );
}
