import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { StartMappingResponse } from '@vedaai/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EventsPublisher } from '../events/events.publisher';
import { DEFAULT_JOB_OPTIONS, QUEUES, type PipelineJobData } from './queue.constants';

/** Entry point for the whole grading pipeline — called by "Start Mapping". */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    @InjectQueue(QUEUES.INGEST) private readonly ingestQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly events: EventsPublisher,
  ) {}

  async start(input: {
    assessmentId: string;
    submissionId: string;
    questionPaperAssetId: string;
    answerSheetAssetId: string;
  }): Promise<StartMappingResponse> {
    const jobRow = await this.prisma.job.create({
      data: {
        type: 'INGEST',
        status: 'QUEUED',
        assessmentId: input.assessmentId,
        submissionId: input.submissionId,
      },
    });

    const data: PipelineJobData = {
      jobId: jobRow.id,
      assessmentId: input.assessmentId,
      submissionId: input.submissionId,
      questionPaperAssetId: input.questionPaperAssetId,
      answerSheetAssetId: input.answerSheetAssetId,
    };

    const bullJob = await this.ingestQueue.add('ingest', data, DEFAULT_JOB_OPTIONS);

    await this.prisma.job.update({
      where: { id: jobRow.id },
      data: { bullJobId: String(bullJob.id) },
    });

    this.logger.log(`Pipeline started: job=${jobRow.id} submission=${input.submissionId}`);

    this.events.queued({
      jobId: jobRow.id,
      submissionId: input.submissionId,
      assessmentId: input.assessmentId,
      status: 'QUEUED',
    });

    return {
      jobId: jobRow.id,
      submissionId: input.submissionId,
      assessmentId: input.assessmentId,
    };
  }
}
