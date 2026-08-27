import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { AiEngineService } from '@/modules/ai-engine/ai-engine.service';
import { EventsPublisher } from '@/modules/events/events.publisher';
import { FailureReporter } from './failure-reporter.service';
import { QUEUES, type PageJobData } from '@/modules/queue/queue.constants';

/** Stage 3. */
@Processor(QUEUES.LAYOUT_ANALYSIS)
export class LayoutAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(LayoutAnalysisProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ai: AiEngineService,
    private readonly events: EventsPublisher,
    private readonly failures: FailureReporter,
  ) {
    super();
  }

  async process(job: Job<PageJobData>): Promise<{ regionCount: number }> {
    const { jobId, pageId, pageIndex, totalPages } = job.data;

    await this.prisma.job.update({
      where: { id: jobId },
      data: { stage: 'LAYOUT_ANALYSIS' },
    });

    const page = await this.prisma.submissionPage.findUniqueOrThrow({
      where: { id: pageId },
    });

    const image = await this.storage.download(page.imageKey);
    const result = await this.ai.analyzeLayout(
      { data: image, mimeType: 'image/png' },
      pageIndex,
      totalPages,
    );

    // Idempotent on retry.
    await this.prisma.answerRegion.deleteMany({ where: { pageId } });

    await this.prisma.answerRegion.createMany({
      data: result.regions.map((region) => ({
        pageId,
        bbox: region.bbox,
        transcript: region.transcript,
        isPrintedLabel: region.isPrintedLabel,
        labelHint: region.questionLabelHint,
        confidence: region.confidence,
      })),
    });

    this.logger.log(`Page ${pageIndex + 1}/${totalPages}: ${result.regions.length} regions`);

    this.events.progress(
      jobId,
      'LAYOUT_ANALYSIS',
      pageIndex + 1,
      totalPages,
      `Reading page ${pageIndex + 1} of ${totalPages}`,
    );

    return { regionCount: result.regions.length };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PageJobData>, error: Error) {
    void this.failures.report(job, error, 'LAYOUT_ANALYSIS');
  }
}
