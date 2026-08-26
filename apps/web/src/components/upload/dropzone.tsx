'use client';

import * as React from 'react';
import { AlertCircle, Upload } from 'lucide-react';
import {
  ACCEPTED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  type AcceptedMimeType,
} from '@vedaai/shared';
import { cn } from '@/lib/utils';

export interface DropzoneProps {
  /** Rendered as "Upload <accent>" — the accent word is orange in the design. */
  label: string;
  accent: string;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
}

function validate(file: File): string | null {
  if (!ACCEPTED_MIME_TYPES.includes(file.type as AcceptedMimeType)) {
    return 'Upload a PDF, PNG, JPG or HEIC file';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return 'File must be 10MB or smaller';
  }
  return null;
}

export function Dropzone({ label, accent, disabled, onFileSelected }: DropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Nested dragenter/dragleave events fire for every child element, so track
  // depth rather than toggling a boolean or the highlight flickers.
  const dragDepth = React.useRef(0);

  const accept = (file: File | undefined) => {
    if (!file) return;
    const message = validate(file);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    onFileSelected(file);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          accept(event.dataTransfer.files[0]);
        }}
        className={cn(
          'group flex h-[104px] w-full flex-col items-center justify-center gap-1.5 rounded-drop border border-dashed bg-white transition-colors sm:h-[118px]',
          dragging
            ? 'border-brand-500 bg-brand-50'
            : 'border-ink-300 hover:border-brand-300 hover:bg-brand-50/40',
          error && 'border-danger-600',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        <span
          className={cn(
            'flex size-8 items-center justify-center rounded-lg bg-ink-100 transition-colors',
            dragging && 'bg-brand-100',
          )}
        >
          <Upload
            className={cn('size-4 text-ink-600', dragging && 'text-brand-600')}
            strokeWidth={2}
          />
        </span>

        <span className="text-[14px] font-semibold text-ink-900">
          {label} <span className="text-brand-500">{accent}</span>
        </span>
        <span className="text-[11.5px] text-ink-400">{MAX_UPLOAD_LABEL}</span>
      </button>

      {error && (
        <span className="flex items-center gap-1.5 px-1 text-[11.5px] text-danger-600">
          <AlertCircle className="size-3.5" />
          {error}
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={ACCEPTED_MIME_TYPES.join(',')}
        onChange={(event) => {
          accept(event.target.files?.[0]);
          // Reset so picking the same file twice still fires onChange.
          event.target.value = '';
        }}
      />
    </div>
  );
}
