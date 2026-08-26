'use client';

import * as React from 'react';
import { toast } from 'sonner';
import type { AcceptedMimeType, AssetKind } from '@vedaai/shared';
import { UI_PREVIEW, api, putToStorage } from '@/lib/api-client';
import type { UploadedFile } from '@/components/upload/file-chip';

interface UseFileUploadOptions {
  assessmentId: string;
  kind: AssetKind;
}

/**
 * Drives one dropzone slot: pre-sign → direct PUT to storage → confirm.
 * The API never touches the file bytes.
 */
export function useFileUpload({ assessmentId, kind }: UseFileUploadOptions) {
  const [file, setFile] = React.useState<UploadedFile | null>(null);

  const upload = React.useCallback(
    async (selected: File) => {
      const optimistic: UploadedFile = {
        id: `pending-${Date.now()}`,
        name: selected.name,
        sizeBytes: selected.size,
        pageCount: null,
        progress: 0,
      };
      setFile(optimistic);

      if (UI_PREVIEW) {
        await simulateUpload((progress) =>
          setFile((prev) => (prev ? { ...prev, progress } : prev)),
        );
        setFile((prev) =>
          prev ? { ...prev, progress: 100, pageCount: estimatePages(selected) } : prev,
        );
        return;
      }

      try {
        const presigned = await api.presignUpload(assessmentId, {
          filename: selected.name,
          mimeType: selected.type as AcceptedMimeType,
          sizeBytes: selected.size,
          kind,
        });

        setFile((prev) => (prev ? { ...prev, id: presigned.assetId } : prev));

        await putToStorage(
          presigned.uploadUrl,
          selected,
          presigned.requiredHeaders,
          (progress) => setFile((prev) => (prev ? { ...prev, progress } : prev)),
        );

        await api.confirmUpload(assessmentId, { assetId: presigned.assetId });
        setFile((prev) => (prev ? { ...prev, progress: 100 } : prev));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        setFile((prev) => (prev ? { ...prev, error: message } : prev));
        toast.error(`Could not upload ${selected.name}`, { description: message });
      }
    },
    [assessmentId, kind],
  );

  const remove = React.useCallback(async () => {
    const current = file;
    setFile(null);
    if (!current || UI_PREVIEW || current.id.startsWith('pending-')) return;
    try {
      await api.deleteAsset(current.id);
    } catch {
      // The chip is already gone from the UI; a stale object in storage is
      // cleaned up by the lifecycle rule rather than blocking the teacher.
    }
  }, [file]);

  return {
    file,
    upload,
    remove,
    /** True only once the bytes are safely in storage. */
    isReady: Boolean(file && file.progress === 100 && !file.error),
  };
}

function simulateUpload(onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve) => {
    let percent = 0;
    const timer = setInterval(() => {
      percent = Math.min(100, percent + 12);
      onProgress(percent);
      if (percent >= 100) {
        clearInterval(timer);
        resolve();
      }
    }, 90);
  });
}

/** Rough page count for the preview mode; the real count comes from the API. */
function estimatePages(file: File): number {
  if (file.type !== 'application/pdf') return 1;
  return Math.max(1, Math.round(file.size / (1024 * 1024)));
}
