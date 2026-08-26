import { Injectable } from '@nestjs/common';
import {
  SERVER_EVENTS,
  STAGE_WEIGHTS,
  jobRoom,
  submissionRoom,
  type EvaluationQuestionCompletedPayload,
  type ExtractionCompletedPayload,
  type JobCompletedPayload,
  type JobFailedPayload,
  type JobQueuedPayload,
  type MappingCompletedPayload,
  type PageRasterizedPayload,
  type PipelineStage,
} from '@vedaai/shared';
import { EventsGateway } from './events.gateway';

const STAGE_ORDER: PipelineStage[] = [
  'INGEST',
  'QUESTION_EXTRACTION',
  'LAYOUT_ANALYSIS',
  'MAPPING',
  'EVALUATION',
  'AGGREGATION',
];

const TOTAL_WEIGHT = STAGE_ORDER.reduce((sum, stage) => sum + STAGE_WEIGHTS[stage], 0);

/**
 * The only place events are emitted. Workers call these rather than touching the
 * gateway, so every payload is typed against the shared contract.
 */
@Injectable()
export class EventsPublisher {
  constructor(private readonly gateway: EventsGateway) {}

  /**
   * Converts stage-local progress into an overall percentage using the stage
   * weights, so the bar advances smoothly instead of resetting each stage.
   */
  progress(
    jobId: string,
    stage: PipelineStage,
    current: number,
    total: number,
    message: string,
  ) {
    const completedWeight = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(stage)).reduce(
      (sum, previous) => sum + STAGE_WEIGHTS[previous],
      0,
    );
    const stageFraction = total > 0 ? Math.min(1, current / total) : 0;
    const percent =
      ((completedWeight + STAGE_WEIGHTS[stage] * stageFraction) / TOTAL_WEIGHT) * 100;

    this.emit(jobRoom(jobId), SERVER_EVENTS.JOB_PROGRESS, {
      jobId,
      stage,
      current,
      total,
      percent: Math.round(percent * 10) / 10,
      message,
    });
  }

  queued(payload: JobQueuedPayload) {
    this.emit(jobRoom(payload.jobId), SERVER_EVENTS.JOB_QUEUED, payload);
  }

  pageRasterized(payload: PageRasterizedPayload) {
    this.emit(jobRoom(payload.jobId), SERVER_EVENTS.PAGE_RASTERIZED, payload);
  }

  extractionCompleted(payload: ExtractionCompletedPayload) {
    this.emit(jobRoom(payload.jobId), SERVER_EVENTS.EXTRACTION_COMPLETED, payload);
  }

  mappingCompleted(payload: MappingCompletedPayload) {
    this.emit(jobRoom(payload.jobId), SERVER_EVENTS.MAPPING_COMPLETED, payload);
  }

  questionGraded(payload: EvaluationQuestionCompletedPayload) {
    this.emit(
      jobRoom(payload.jobId),
      SERVER_EVENTS.EVALUATION_QUESTION_COMPLETED,
      payload,
    );
    this.emit(
      submissionRoom(payload.submissionId),
      SERVER_EVENTS.EVALUATION_QUESTION_COMPLETED,
      payload,
    );
  }

  completed(payload: JobCompletedPayload) {
    this.emit(jobRoom(payload.jobId), SERVER_EVENTS.JOB_COMPLETED, payload);
    this.emit(submissionRoom(payload.submissionId), SERVER_EVENTS.JOB_COMPLETED, payload);
  }

  failed(payload: JobFailedPayload) {
    this.emit(jobRoom(payload.jobId), SERVER_EVENTS.JOB_FAILED, payload);
  }

  private emit(room: string, event: string, payload: unknown) {
    // The gateway server is undefined until Nest has bootstrapped the adapter;
    // a worker that starts first should not crash on it.
    this.gateway.server?.to(room).emit(event, payload);
  }
}
