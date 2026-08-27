'use client';

import * as React from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import type { Evaluation, Question } from '@vedaai/shared';
import { cn } from '@/lib/utils';
import { ScorePill } from './score-pill';
import { ScoreOverride } from './score-override';

interface QuestionRowProps {
  index: number;
  question: Question;
  evaluation: Evaluation | undefined;
  expanded: boolean;
  active: boolean;
  onToggle: () => void;
  onOverride: (evaluationId: string, marks: number) => Promise<void>;
}

export function QuestionRow({
  index,
  question,
  evaluation,
  expanded,
  active,
  onToggle,
  onOverride,
}: QuestionRowProps) {
  return (
    <div className={cn('border-ink-100 border-b transition-colors', active && 'bg-brand-50/40')}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left"
      >
        {/* index badge — filled orange when this row is the active one */}
        <span
          className={cn(
            'mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
            active ? 'bg-brand-500 text-white' : 'border-ink-300 text-ink-600 border bg-white',
          )}
        >
          {index + 1}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'text-ink-800 block text-[12.5px] leading-snug',
              !expanded && 'line-clamp-2',
            )}
          >
            {question.text}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          <ScorePill
            awarded={evaluation?.awardedMarks ?? null}
            max={question.maxMarks}
            overridden={evaluation?.isOverridden ?? false}
          />
          <ChevronDown
            className={cn('text-ink-400 size-3.5 transition-transform', expanded && 'rotate-180')}
          />
        </span>
      </button>

      {expanded && evaluation && (
        <div className="px-3 pb-3 pl-[42px]">
          <div className="bg-brand-50 rounded-lg p-2.5">
            <p className="text-brand-700 flex items-center gap-1.5 text-[11px] font-bold">
              <Sparkles className="size-3" />
              AI Feedback
            </p>
            <p className="text-ink-700 mt-1 text-[12px] leading-relaxed">{evaluation.feedback}</p>

            {evaluation.steps.length > 0 && (
              <ul className="border-brand-200/60 mt-2 flex flex-col gap-1 border-t pt-2">
                {evaluation.steps.map((step) => (
                  <li key={step.id} className="flex items-start gap-2 text-[11.5px]">
                    <span
                      className={cn(
                        'mt-px shrink-0 rounded px-1 font-bold tabular-nums',
                        step.marksDelta >= 0
                          ? 'bg-success-100 text-success-600'
                          : 'bg-danger-100 text-danger-600',
                      )}
                    >
                      {step.marksDelta >= 0 ? '+' : ''}
                      {step.marksDelta}
                    </span>
                    <span className="text-ink-600">{step.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ScoreOverride
            evaluation={evaluation}
            max={question.maxMarks}
            onSubmit={(marks) => onOverride(evaluation.id, marks)}
          />
        </div>
      )}

      {expanded && !evaluation && (
        <p className="text-ink-400 px-3 pb-3 pl-[42px] text-[11.5px]">
          This question has not been graded yet.
        </p>
      )}
    </div>
  );
}
