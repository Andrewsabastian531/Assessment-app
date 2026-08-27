'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useBreadcrumb, useShellCollapse } from '@/components/shell/app-shell';
import { useJobProgress } from '@/hooks/use-job-progress';
import { Button } from '@/components/ui/button';

interface ExtractingScreenProps {
  assessmentId: string;
  jobId: string | null;
  submissionId: string | null;
}

export function ExtractingScreen({ assessmentId, jobId, submissionId }: ExtractingScreenProps) {
  useBreadcrumb('Exams');
  // The design collapses the sidebar to an icon rail on this screen.
  useShellCollapse(true);

  const router = useRouter();
  const { percent, message, completed, failed } = useJobProgress(jobId);

  React.useEffect(() => {
    const target = completed?.submissionId ?? submissionId;
    if (completed && target) {
      router.replace(`/exams/${assessmentId}/review/${target}`);
    }
  }, [completed, submissionId, assessmentId, router]);

  return (
    <div className="h-full p-3 sm:p-4">
      <div className="rounded-card border-ink-200 flex h-full flex-col items-center justify-center border bg-white">
        {failed ? (
          <FailedState
            error={failed.error}
            onRetry={() => router.replace(`/exams/${assessmentId}/upload`)}
          />
        ) : (
          <>
            <SparkleGlyph />
            <h2 className="text-ink-900 mt-5 text-[22px] font-bold tracking-tight sm:text-[24px]">
              Extracting…
            </h2>
            <p className="text-ink-600 mt-1 text-[13px]">{message}</p>

            {percent > 0 && (
              <div className="mt-5 w-full max-w-[220px]">
                <div className="bg-ink-100 h-1 overflow-hidden rounded-full">
                  <div
                    className="bg-brand-500 h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-ink-400 mt-1.5 text-center text-[11px] tabular-nums">
                  {Math.round(percent)}%
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The four-point sparkle from the design — one large glyph with a smaller one tucked at
 * the lower left, both pulsing out of phase.
 */
function SparkleGlyph() {
  return (
    <div className="relative size-[72px]" aria-hidden="true">
      <svg
        viewBox="0 0 100 100"
        className="animate-sparkle text-brand-500 absolute inset-0 size-full"
      >
        <path
          d="M58 12c2.2 14.6 6.4 21.2 20 24.5-13.6 3.3-17.8 9.9-20 24.5-2.2-14.6-6.4-21.2-20-24.5 13.6-3.3 17.8-9.9 20-24.5Z"
          fill="currentColor"
        />
      </svg>
      <svg
        viewBox="0 0 100 100"
        className="animate-sparkle text-brand-500 absolute inset-0 size-full [animation-delay:600ms]"
      >
        <path
          d="M31 55c1.4 9.2 4 13.3 12.5 15.4C35 72.5 32.4 76.6 31 85.8c-1.4-9.2-4-13.3-12.5-15.4C27 68.3 29.6 64.2 31 55Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

function FailedState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex max-w-sm flex-col items-center px-6 text-center">
      <span className="bg-danger-100 flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="text-danger-600 size-6" />
      </span>
      <h2 className="text-ink-900 mt-4 text-lg font-bold">Extraction failed</h2>
      <p className="text-ink-600 mt-1.5 text-[13px]">{error}</p>
      <Button onClick={onRetry} className="mt-5" size="sm">
        <RotateCcw className="size-4" />
        Try again
      </Button>
    </div>
  );
}
