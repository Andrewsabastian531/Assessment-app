'use client';

import { X } from 'lucide-react';
import { cn, formatFileSize, formatPageCount } from '@/lib/utils';

export interface UploadedFile {
  id: string;
  name: string;
  sizeBytes: number;
  pageCount: number | null;
  /** 0-100 while the browser PUTs to storage; 100 once confirmed. */
  progress: number;
  error?: string | null;
}

/**
 * The filled-state card from the design: a red PDF badge, the filename, and a "2MB • 2
 * Pages" meta line, with a remove control in the corner.
 */
export function FileChip({ file, onRemove }: { file: UploadedFile; onRemove: () => void }) {
  const pages = formatPageCount(file.pageCount);
  const uploading = file.progress < 100 && !file.error;

  return (
    <div className="rounded-drop border-ink-300 relative flex h-[104px] w-full items-center justify-center border border-dashed bg-white px-4 sm:h-[118px]">
      <div className="flex min-w-0 items-center gap-2.5">
        <FileBadge name={file.name} />

        <div className="min-w-0">
          <p className="text-ink-900 truncate text-[13px] font-semibold">{file.name}</p>
          <p className="text-ink-400 mt-0.5 text-[11.5px]">
            {file.error ? (
              <span className="text-danger-600">{file.error}</span>
            ) : (
              <>
                {formatFileSize(file.sizeBytes)}
                {pages && <span className="mx-1">•</span>}
                {pages}
              </>
            )}
          </p>

          {uploading && (
            <span className="bg-ink-100 mt-1.5 block h-1 w-full overflow-hidden rounded-full">
              <span
                className="bg-brand-500 block h-full rounded-full transition-[width] duration-200"
                style={{ width: `${file.progress}%` }}
              />
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="bg-ink-900 hover:bg-ink-700 absolute right-2.5 top-2.5 flex size-[18px] items-center justify-center rounded-full text-white transition-colors"
      >
        <X className="size-3" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/** Red PDF glyph, or a neutral one for image uploads. */
function FileBadge({ name }: { name: string }) {
  const isPdf = name.toLowerCase().endsWith('.pdf');
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md',
        isPdf ? 'bg-danger-100' : 'bg-ink-100',
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden="true">
        <path
          d="M6 2.75h7.5L19 8.25V21a.75.75 0 0 1-.75.75H6a.75.75 0 0 1-.75-.75V3.5A.75.75 0 0 1 6 2.75Z"
          className={isPdf ? 'fill-danger-600' : 'fill-ink-400'}
        />
        <path d="M13.25 2.75 19 8.5h-5.75V2.75Z" className="fill-white/40" />
        <text
          x="12"
          y="17.5"
          textAnchor="middle"
          className="fill-white"
          style={{ font: '700 6px system-ui' }}
        >
          {isPdf ? 'PDF' : 'IMG'}
        </text>
      </svg>
    </span>
  );
}
