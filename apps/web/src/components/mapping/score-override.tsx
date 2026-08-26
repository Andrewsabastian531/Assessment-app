'use client';

import * as React from 'react';
import { Check, Loader2, RotateCcw } from 'lucide-react';
import type { Evaluation } from '@vedaai/shared';

/** Manual mark entry. Clamped to the question maximum on both ends. */
export function ScoreOverride({
  evaluation,
  max,
  onSubmit,
}: {
  evaluation: Evaluation;
  max: number;
  onSubmit: (marks: number) => Promise<void>;
}) {
  const [value, setValue] = React.useState(String(evaluation.awardedMarks));
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setValue(String(evaluation.awardedMarks));
  }, [evaluation.awardedMarks]);

  const dirty = Number(value) !== evaluation.awardedMarks;

  const save = async (marks: number) => {
    setSaving(true);
    try {
      await onSubmit(Math.min(max, Math.max(0, marks)));
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      <label className="text-[11px] font-medium text-ink-500">Marks</label>
      <input
        type="number"
        min={0}
        max={max}
        step={0.5}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-7 w-16 rounded-md border border-ink-200 px-2 text-[12px] tabular-nums outline-none transition-colors focus:border-brand-400"
      />
      <span className="text-[11px] text-ink-400">of {max}</span>

      <button
        type="button"
        disabled={!dirty || saving}
        onClick={() => save(Number(value))}
        className="ml-auto inline-flex h-7 items-center gap-1 rounded-full bg-ink-900 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:bg-ink-200 disabled:text-ink-400"
      >
        {saving ? (
          <Loader2 className="size-3 animate-spin" />
        ) : saved ? (
          <Check className="size-3" />
        ) : null}
        {saved ? 'Saved' : 'Save'}
      </button>

      {evaluation.isOverridden && (
        <button
          type="button"
          title={`Reset to the AI mark (${evaluation.aiMarks})`}
          onClick={() => save(evaluation.aiMarks)}
          className="inline-flex size-7 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
        >
          <RotateCcw className="size-3" />
        </button>
      )}
    </div>
  );
}
