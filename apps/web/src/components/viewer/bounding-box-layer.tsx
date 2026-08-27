'use client';

import * as React from 'react';
import type { AnswerRegion } from '@vedaai/shared';
import { cn } from '@/lib/utils';

interface BoundingBoxLayerProps {
  regions: AnswerRegion[];
  /** Maps a questionId to its display label ("Q1", "Q2"). */
  labelFor: (questionId: string) => string;
  activeQuestionId: string | null;
  onSelect: (questionId: string) => void;
}

/** Draws the green answer boxes over the page image. */
export function BoundingBoxLayer({
  regions,
  labelFor,
  activeQuestionId,
  onSelect,
}: BoundingBoxLayerProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {regions.map((region) => {
        if (!region.questionId) return null;
        const active = region.questionId === activeQuestionId;

        return (
          <button
            key={region.id}
            type="button"
            data-region-id={region.id}
            onClick={() => onSelect(region.questionId!)}
            className={cn(
              'pointer-events-auto absolute rounded-[3px] border-2 transition-all',
              active
                ? 'border-success-600 bg-success-500/25 z-10 shadow-[0_0_0_3px_rgba(22,163,74,0.15)]'
                : 'border-success-600/70 bg-success-500/10 hover:bg-success-500/20',
            )}
            style={{
              left: `${region.bbox.x * 100}%`,
              top: `${region.bbox.y * 100}%`,
              width: `${region.bbox.width * 100}%`,
              height: `${region.bbox.height * 100}%`,
            }}
          >
            <span
              className={cn(
                'absolute -top-[1px] left-0 -translate-y-full rounded-t-[3px] px-1.5 py-[1px] text-[10px] font-bold leading-tight text-white',
                active ? 'bg-success-600' : 'bg-success-600/80',
              )}
            >
              {labelFor(region.questionId)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
