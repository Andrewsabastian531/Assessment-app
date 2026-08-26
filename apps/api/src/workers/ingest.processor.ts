import { InjectFlowProducer, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { FlowProducer, Job } from 'bullmq';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { ImageService } from '@/modules/ai-engine/image.service';
import { EventsPublisher } from '@/modules/events/events.publisher';
import { FailureReporter } from './failure-reporter.service';
import {
  DEFAULT_JOB_OPTIONS,
  PIPELINE_FLOW,
  QUEUES,
  type PageJobData,
  type PipelineJobData,
} from '@/modules/queue/queue.constants';

/**
 * Stage 1. Turns the uploaded answer sheet into normalised page images in
 * storage, then fans out the rest of the pipeline.
 */
@Processor(QUEUES.INGEST)
export class IngestProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly images: ImageService,
    private readonly events: EventsPublisher,
    private readonly failures: FailureReporter,
    @InjectFlowProducer(PIPELINE_FLOW) private readonly flow: FlowProducer,
  ) {
    super();
  }

  async process(job: Job<PipelineJobData>): Promise<{ pageCount: number }> {
    const { jobId, submissionId, answerSheetAssetId } = job.data;

    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'RUNNING', stage: 'INGEST', startedAt: new Date() },
    });
    await this.prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'PROCESSING' },
    });

    this.events.progress(jobId, 'INGEST', 0, 1, 'Preparing pages');

    const asset = await this.prisma.asset.findUniqueOrThrow({
      where: { id: answerSheetAssetId },
    });

    const file = await this.storage.download(asset.storageKey);
    const pages = await this.images.rasterize(file, asset.mimeType);

    this.logger.log(`Rasterised ${pages.length} page(s) for submission ${submissionId}`);

    // Re-running this job must not duplicate pages, so clear any partial result
    // from a previous attempt first.
    await this.prisma.submissionPage.deleteMany({ where: { submissionId } });

    const created: Array<{ id: string; pageIndex: number }> = [];

    for (const page of pages) {
      const imageKey = this.storage.buildPageKey(submissionId, page.pageIndex);
      await this.storage.upload(imageKey, page.png, 'image/png');

      const row = await this.prisma.submissionPage.create({
        data: {
          submissionId,
          pageIndex: page.pageIndex,
          imageKey,
          width: page.width,
          height: page.height,
        },
        select: { id: true, pageIndex: true },
      });
      created.push(row);

      this.events.pageRasterized({
        jobId,
        submissionId,
        pageIndex: page.pageIndex,
        totalPages: pages.length,
      });
      this.events.progress(
        jobId,
        'INGEST',
        page.pageIndex + 1,
        pages.length,
        `Preparing page ${page.pageIndex + 1} of ${pages.length}`,
      );
    }

    await this.prisma.asset.update({
      where: { id: asset.id },
      data: { pageCount: pages.length },
    });

    await this.fanOut(job.data, created, pages.length);

    return { pageCount: pages.length };
  }

  /**
   * Builds the rest of the pipeline as a BullMQ flow. `mapping` is the parent of
   * question extraction and every per-page layout job, so BullMQ handles the
   * fan-in: mapping only runs once all its children have succeeded.
   */
  private async fanOut(
    data: PipelineJobData,
    pages: Array<{ id: string; pageIndex: number }>,
    totalPages: number,
  ) {
    const children = [
      {
        name: 'extract-questions',
        queueName: QUEUES.QUESTION_EXTRACTION,
        data,
        opts: DEFAULT_JOB_OPTIONS,
      },
      ...pages.map((page) => ({
        name: `analyse-page-${page.pageIndex}`,
        queueName: QUEUES.LAYOUT_ANALYSIS,
        data: {
          ...data,
          pageId: page.id,
          pageIndex: page.pageIndex,
          totalPages,
        } satisfies PageJobData,
        opts: DEFAULT_JOB_OPTIONS,
      })),
    ];

    await this.flow.add({
      name: 'map-answers',
      queueName: QUEUES.MAPPING,
      data,
      opts: DEFAULT_JOB_OPTIONS,
      children,
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PipelineJobData>, error: Error) {
    void this.failures.report(job, error, 'INGEST');
  }
}
