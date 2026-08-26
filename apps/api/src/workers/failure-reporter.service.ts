import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { PipelineStage } from '@vedaai/shared';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { EventsPublisher } from '@/modules/events/events.publisher';
import type { PipelineJobData } from '@/modules/queue/queue.constants';

/**
 * Shared terminal-failure handling for every pipeline stage.
 *
 * Without this, a stage that exhausts its retries leaves its flow parent
 * permanently unfulfilled: BullMQ never runs the parent, no event is emitted,
 * and the "Extracting…" screen spins forever. Each processor forwards its
 * `failed` worker event here so exactly one job.failed reaches the client.
 */
@Injectable()
export class FailureReporter {
  private readonly logger = new Logger(FailureReporter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsPublisher,
  ) {}

  async report(job: Job<PipelineJobData> | undefined, error: Error, stage: PipelineStage) {
    const data = job?.data;
    if (!data?.jobId) return;

    const attempts = job?.opts?.attempts ?? 1;
    const exhausted = (job?.attemptsMade ?? 0) >= attempts;

    // Intermediate attempts will be retried by BullMQ — do not tell the user the
    // job is dead while it still has lives left.
    if (!exhausted) {
      this.logger.warn(
        `${stage} attempt ${job?.attemptsMade}/${attempts} failed, will retry: ${error.message}`,
      );
      return;
    }

    this.logger.error(`${stage} failed permanently: ${error.message}`);

    const existing = await this.prisma.job.findUnique({
      where: { id: data.jobId },
      select: { status: true },
    });
    // Several sibling children can fail at once; only the first one reports.
    if (existing?.status === 'FAILED') return;

    await this.prisma.job.update({
      where: { id: data.jobId },
      data: {
        status: 'FAILED',
        stage,
        error: error.message,
        finishedAt: new Date(),
      },
    });

    if (data.submissionId) {
      await this.prisma.submission
        .update({ where: { id: data.submissionId }, data: { status: 'FAILED' } })
        .catch(() => undefined);
    }
    if (data.assessmentId) {
      await this.prisma.assessment
        .update({ where: { id: data.assessmentId }, data: { status: 'FAILED' } })
        .catch(() => undefined);
    }

    this.events.failed({
      jobId: data.jobId,
      submissionId: data.submissionId ?? null,
      stage,
      error: error.message,
      retryable: true,
    });
  }
}
