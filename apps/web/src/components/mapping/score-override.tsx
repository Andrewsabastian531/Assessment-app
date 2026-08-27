'use client';

import * as React from 'react';
import { Check, Loader2, RotateCcw } from 'lucide-react';
import type { Evaluation } from '@vedaai/shared';

/** Manual mark entry. */
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
      <label className="text-ink-500 text-[11px] font-medium">Marks</label>
      <input
        type="number"
        min={0}
        max={max}
        step={0.5}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="border-ink-200 focus:border-brand-400 h-7 w-16 rounded-md border px-2 text-[12px] tabular-nums outline-none transition-colors"
      />
      <span className="text-ink-400 text-[11px]">of {max}</span>

      <button
        type="button"
        disabled={!dirty || saving}
        onClick={() => save(Number(value))}
        className="bg-ink-900 hover:bg-ink-800 disabled:bg-ink-200 disabled:text-ink-400 ml-auto inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-white transition-colors"
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
          className="text-ink-500 hover:bg-ink-100 hover:text-ink-900 inline-flex size-7 items-center justify-center rounded-full transition-colors"
        >
          <RotateCcw className="size-3" />
        </button>
      )}
    </div>
  );
}
