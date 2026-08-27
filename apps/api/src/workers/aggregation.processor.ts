import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { EventsPublisher } from '@/modules/events/events.publisher';
import { FailureReporter } from './failure-reporter.service';
import { QUEUES, type PipelineJobData } from '@/modules/queue/queue.constants';

/** Stage 6. */
@Processor(QUEUES.AGGREGATION)
export class AggregationProcessor extends WorkerHost {
  private readonly logger = new Logger(AggregationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsPublisher,
    private readonly failures: FailureReporter,
  ) {
    super();
  }

  async process(job: Job<PipelineJobData>) {
    const { jobId, assessmentId, submissionId } = job.data;

    await this.prisma.job.update({
      where: { id: jobId },
      data: { stage: 'AGGREGATION' },
    });
    this.events.progress(jobId, 'AGGREGATION', 0, 1, 'Finalising results');

    const totals = await this.prisma.evaluation.aggregate({
      where: { submissionId },
      _sum: { awardedMarks: true, maxMarks: true },
    });

    const totalAwarded = round2(totals._sum.awardedMarks ?? 0);
    const totalMax = round2(totals._sum.maxMarks ?? 0);

    await this.prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'READY_FOR_REVIEW', totalAwarded, totalMax },
    });
    await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { status: 'GRADED' },
    });

    const jobRow = await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', progress: 100, finishedAt: new Date() },
    });

    const durationMs = jobRow.startedAt
      ? jobRow.finishedAt!.getTime() - jobRow.startedAt.getTime()
      : 0;

    this.logger.log(
      `Submission ${submissionId} graded: ${totalAwarded}/${totalMax} in ${Math.round(durationMs / 1000)}s`,
    );

    this.events.progress(jobId, 'AGGREGATION', 1, 1, 'Done');
    this.events.completed({
      jobId,
      submissionId,
      assessmentId,
      totalAwarded,
      totalMax,
      durationMs,
    });

    return { totalAwarded, totalMax };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PipelineJobData>, error: Error) {
    void this.failures.report(job, error, 'AGGREGATION');
  }
}

const round2 = (value: number) => Math.round(value * 100) / 100;
