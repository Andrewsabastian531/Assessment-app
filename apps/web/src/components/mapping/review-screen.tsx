'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Evaluation, ReviewPayload } from '@vedaai/shared';
import { api } from '@/lib/api-client';
import { useBreadcrumb } from '@/components/shell/app-shell';
import { AnswerSheetViewer } from '@/components/viewer/answer-sheet-viewer';
import { QuestionRow } from './question-row';
import { cn } from '@/lib/utils';

export function ReviewScreen({ submissionId }: { submissionId: string }) {
  useBreadcrumb('Exams');
  const queryClient = useQueryClient();
  const queryKey = ['review', submissionId];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => api.getReviewPayload(submissionId),
  });

  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [mobileTab, setMobileTab] = React.useState<'questions' | 'sheet'>('questions');

  // Only leaf questions are answerable; a parent with sub-parts is a heading.
  const questions = React.useMemo(() => {
    if (!data) return [];
    const parentIds = new Set(data.questions.map((question) => question.parentId).filter(Boolean));
    return data.questions.filter((question) => !parentIds.has(question.id));
  }, [data]);

  const evaluationByQuestion = React.useMemo(() => {
    const map = new Map<string, Evaluation>();
    for (const evaluation of data?.evaluations ?? []) {
      map.set(evaluation.questionId, evaluation);
    }
    return map;
  }, [data]);

  const labelByQuestion = React.useMemo(() => {
    const map = new Map<string, string>();
    questions.forEach((question, index) => map.set(question.id, `Q${index + 1}`));
    return map;
  }, [questions]);

  const handleOverride = async (evaluationId: string, marks: number) => {
    try {
      await api.overrideEvaluation(evaluationId, { awardedMarks: marks });
      await queryClient.invalidateQueries({ queryKey });
      toast.success('Marks updated');
    } catch (cause) {
      toast.error('Could not update marks', {
        description: cause instanceof Error ? cause.message : undefined,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="text-brand-500 size-5 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-danger-600 flex h-full items-center justify-center px-6 text-center text-[13px]">
        {error instanceof Error ? error.message : 'Could not load this submission'}
      </div>
    );
  }

  const totals = summarise(data);

  return (
    <div className="flex h-full flex-col">
      {/* mobile tab switcher — the split pane collapses on small screens */}
      <div className="border-ink-200 flex shrink-0 gap-1 border-b bg-white p-1.5 lg:hidden">
        {(['questions', 'sheet'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={cn(
              'flex-1 rounded-full py-1.5 text-[12.5px] font-semibold transition-colors',
              mobileTab === tab ? 'bg-ink-900 text-white' : 'text-ink-600',
            )}
          >
            {tab === 'questions' ? 'Questions' : 'Answer Sheet'}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <section
          className={cn(
            'border-ink-200 flex min-h-0 w-full flex-col border-r bg-white lg:flex lg:w-[42%] lg:max-w-[520px]',
            mobileTab === 'questions' ? 'flex' : 'hidden',
          )}
        >
          <header className="border-ink-200 flex h-11 shrink-0 items-center justify-between border-b px-3">
            <h2 className="text-ink-900 text-[12.5px] font-semibold">
              Extracted Questions{' '}
              <span className="text-ink-500 font-normal">(from question paper)</span>
            </h2>
            <button
              type="button"
              onClick={() =>
                setExpandedId((current) => (current ? null : (questions[0]?.id ?? null)))
              }
              className="text-brand-500 text-[11.5px] font-medium hover:underline"
            >
              {expandedId ? 'Collapse' : 'Expand all'}
            </button>
          </header>

          <div className="scrollbar-slim min-h-0 flex-1 overflow-auto">
            {questions.length === 0 ? (
              <p className="text-ink-500 p-4 text-[12.5px]">
                No questions were extracted from the question paper.
              </p>
            ) : (
              questions.map((question, index) => (
                <QuestionRow
                  key={question.id}
                  index={index}
                  question={question}
                  evaluation={evaluationByQuestion.get(question.id)}
                  expanded={expandedId === question.id}
                  active={expandedId === question.id}
                  onToggle={() =>
                    setExpandedId((current) => (current === question.id ? null : question.id))
                  }
                  onOverride={handleOverride}
                />
              ))
            )}
          </div>

          <footer className="border-ink-200 flex shrink-0 items-center justify-between border-t px-3 py-2.5">
            <span className="text-ink-600 text-[12px]">
              Total{' '}
              <strong className="text-ink-900 tabular-nums">
                {totals.awarded}/{totals.max}
              </strong>
            </span>
            <button
              type="button"
              onClick={async () => {
                await api.finalizeSubmission(submissionId);
                await queryClient.invalidateQueries({ queryKey });
                toast.success('Result finalised');
              }}
              disabled={data.submission.status === 'FINALIZED'}
              className="bg-ink-900 hover:bg-ink-800 disabled:bg-ink-200 disabled:text-ink-400 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-white transition-colors"
            >
              <CheckCircle2 className="size-3.5" />
              {data.submission.status === 'FINALIZED' ? 'Finalised' : 'Finalise'}
            </button>
          </footer>
        </section>

        <section
          className={cn(
            'min-h-0 w-full flex-1 bg-white lg:block',
            mobileTab === 'sheet' ? 'block' : 'hidden',
          )}
        >
          <AnswerSheetViewer
            pages={data.pages}
            regions={data.regions}
            labelFor={(questionId) => labelByQuestion.get(questionId) ?? '?'}
            activeQuestionId={expandedId}
            onSelectQuestion={(questionId) => {
              setExpandedId(questionId);
              setMobileTab('questions');
            }}
          />
        </section>
      </div>
    </div>
  );
}

function summarise(data: ReviewPayload) {
  const awarded = data.evaluations.reduce((sum, evaluation) => sum + evaluation.awardedMarks, 0);
  const max = data.evaluations.reduce((sum, evaluation) => sum + evaluation.maxMarks, 0);
  return { awarded: round2(awarded), max: round2(max) };
}

const round2 = (value: number) => Math.round(value * 100) / 100;
