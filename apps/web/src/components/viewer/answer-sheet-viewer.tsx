'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import type { AnswerRegion, SubmissionPage } from '@vedaai/shared';
import { cn } from '@/lib/utils';
import { BoundingBoxLayer } from './bounding-box-layer';

const ZOOM_STEPS = [40, 60, 80, 100, 125, 150, 200];

interface AnswerSheetViewerProps {
  pages: SubmissionPage[];
  regions: AnswerRegion[];
  labelFor: (questionId: string) => string;
  activeQuestionId: string | null;
  onSelectQuestion: (questionId: string) => void;
}

export function AnswerSheetViewer({
  pages,
  regions,
  labelFor,
  activeQuestionId,
  onSelectQuestion,
}: AnswerSheetViewerProps) {
  const [zoomIndex, setZoomIndex] = React.useState(1); // 60%, as in the design
  const [pageIndex, setPageIndex] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const zoom = ZOOM_STEPS[zoomIndex] ?? 60;
  const page = pages[pageIndex];
  const pageRegions = React.useMemo(
    () => regions.filter((region) => region.pageIndex === pageIndex),
    [regions, pageIndex],
  );

  // Selecting a question on the left should reveal its box on the right, which
  // may live on a different page.
  React.useEffect(() => {
    if (!activeQuestionId) return;
    const match = regions.find((region) => region.questionId === activeQuestionId);
    if (match && match.pageIndex !== pageIndex) {
      setPageIndex(match.pageIndex);
      return;
    }
    if (!match) return;
    const node = scrollRef.current?.querySelector(`[data-region-id="${match.id}"]`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeQuestionId, regions, pageIndex]);

  if (!page) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-ink-500">
        No answer sheet pages
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-ink-200 px-3">
        <span className="text-[12.5px] font-semibold text-ink-900">Answer Sheet</span>

        <div className="flex items-center gap-1">
          <div className="flex items-center rounded-full border border-ink-200">
            <IconButton
              label="Zoom out"
              disabled={zoomIndex === 0}
              onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
            >
              <Minus className="size-3.5" />
            </IconButton>
            <span className="min-w-[42px] text-center text-[11.5px] font-medium tabular-nums text-ink-700">
              {zoom}%
            </span>
            <IconButton
              label="Zoom in"
              disabled={zoomIndex === ZOOM_STEPS.length - 1}
              onClick={() =>
                setZoomIndex((index) => Math.min(ZOOM_STEPS.length - 1, index + 1))
              }
            >
              <Plus className="size-3.5" />
            </IconButton>
          </div>

          <div className="ml-1 flex items-center rounded-full border border-ink-200">
            <IconButton
              label="Previous page"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
            >
              <ChevronLeft className="size-3.5" />
            </IconButton>
            <span className="whitespace-nowrap px-1 text-[11.5px] font-medium tabular-nums text-ink-700">
              Page {pageIndex + 1} of {pages.length}
            </span>
            <IconButton
              label="Next page"
              disabled={pageIndex >= pages.length - 1}
              onClick={() => setPageIndex((index) => Math.min(pages.length - 1, index + 1))}
            >
              <ChevronRight className="size-3.5" />
            </IconButton>
          </div>
        </div>
      </div>

      {/* canvas */}
      <div ref={scrollRef} className="scrollbar-slim min-h-0 flex-1 overflow-auto bg-ink-100 p-4">
        <div
          className="relative mx-auto bg-white shadow-card"
          style={{ width: `${zoom}%`, aspectRatio: `${page.width} / ${page.height}` }}
        >
          {page.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={page.imageUrl}
              alt={`Answer sheet page ${pageIndex + 1}`}
              className="block size-full object-contain"
            />
          )}
          <BoundingBoxLayer
            regions={pageRegions}
            labelFor={labelFor}
            activeQuestionId={activeQuestionId}
            onSelect={onSelectQuestion}
          />
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded-full text-ink-600 transition-colors',
        disabled ? 'opacity-30' : 'hover:bg-ink-100 hover:text-ink-900',
      )}
    >
      {children}
    </button>
  );
}
