import { cn } from '@/lib/utils';

/** The "3/3" chip. */
export function ScorePill({
  awarded,
  max,
  overridden,
}: {
  awarded: number | null;
  max: number;
  overridden?: boolean;
}) {
  if (awarded === null) {
    return (
      <span className="text-ink-300 rounded px-1.5 py-px text-[11px] font-bold tabular-nums">
        –/{formatMarks(max)}
      </span>
    );
  }

  const ratio = max > 0 ? awarded / max : 0;

  return (
    <span
      title={overridden ? 'Manually adjusted' : undefined}
      className={cn(
        'rounded px-1.5 py-px text-[11px] font-bold tabular-nums',
        ratio >= 1
          ? 'bg-success-100 text-success-600'
          : ratio > 0
            ? 'bg-warning-100 text-warning-600'
            : 'bg-danger-100 text-danger-600',
        overridden && 'ring-ink-300 ring-1',
      )}
    >
      {formatMarks(awarded)}/{formatMarks(max)}
    </span>
  );
}

/** Marks are floats but almost always whole — do not render "3.0/3.0". */
function formatMarks(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
