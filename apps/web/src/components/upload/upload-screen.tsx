'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { UI_PREVIEW, api } from '@/lib/api-client';
import { useBreadcrumb } from '@/components/shell/app-shell';
import { useFileUpload } from '@/hooks/use-file-upload';
import { Dropzone } from './dropzone';
import { FileChip } from './file-chip';
import { UploadIllustration } from './upload-illustration';

export function UploadScreen({ assessmentId }: { assessmentId: string }) {
  useBreadcrumb('Exams');
  const router = useRouter();
  const [starting, setStarting] = React.useState(false);

  const questionPaper = useFileUpload({ assessmentId, kind: 'QUESTION_PAPER' });
  const answerSheet = useFileUpload({ assessmentId, kind: 'ANSWER_SHEET' });

  const canStart = questionPaper.isReady && answerSheet.isReady && !starting;

  const handleStart = async () => {
    if (!questionPaper.file || !answerSheet.file) return;
    setStarting(true);

    if (UI_PREVIEW) {
      router.push(`/exams/${assessmentId}/extracting?job=preview`);
      return;
    }

    try {
      const { jobId, submissionId } = await api.startMapping(assessmentId, {
        questionPaperAssetId: questionPaper.file.id,
        answerSheetAssetId: answerSheet.file.id,
      });
      router.push(`/exams/${assessmentId}/extracting?job=${jobId}&submission=${submissionId}`);
    } catch (error) {
      setStarting(false);
      toast.error('Could not start mapping', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col items-center px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-ink-900 text-center text-[22px] font-bold leading-tight tracking-tight sm:text-[38px]">
        Upload{' '}
        <span className="headline-underline text-brand-500">
          Question Paper &amp; Answer Sheets
        </span>
      </h1>
      <p className="text-ink-600 mt-2 text-center text-[13px] sm:text-[15px]">
        Upload both files to get started
      </p>

      <UploadIllustration className="mt-6 sm:mt-8" />

      <div className="mt-6 grid w-full grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-5">
        <Slot slot={questionPaper} label="Upload" accent="Question Paper" disabled={starting} />
        <Slot slot={answerSheet} label="Upload" accent="Answer Sheet" disabled={starting} />
      </div>

      <button
        type="button"
        disabled={!canStart}
        onClick={handleStart}
        className="enabled:bg-ink-900 enabled:hover:bg-ink-800 disabled:bg-ink-200 disabled:text-ink-400 mt-7 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-colors enabled:text-white disabled:cursor-not-allowed"
      >
        {starting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Starting…
          </>
        ) : (
          <>
            Start Mapping
            <ArrowRight className="size-4" />
          </>
        )}
      </button>

      <p className="text-ink-400 mt-2.5 text-center text-[11.5px]">
        Once both files are uploaded, you&apos;ll be able to map answers with questions
      </p>
    </div>
  );
}

/** A dropzone that swaps to a file chip once something has been picked. */
function Slot({
  slot,
  label,
  accent,
  disabled,
}: {
  slot: ReturnType<typeof useFileUpload>;
  label: string;
  accent: string;
  disabled: boolean;
}) {
  if (slot.file) {
    return <FileChip file={slot.file} onRemove={slot.remove} />;
  }
  return (
    <Dropzone label={label} accent={accent} disabled={disabled} onFileSelected={slot.upload} />
  );
}
