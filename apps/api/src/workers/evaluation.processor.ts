import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import type { BoundingBox } from '@vedaai/shared';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { AiEngineService } from '@/modules/ai-engine/ai-engine.service';
import { ImageService } from '@/modules/ai-engine/image.service';
import { EventsPublisher } from '@/modules/events/events.publisher';
import { FailureReporter } from './failure-reporter.service';
import { QUEUES,
  WORKER_OPTIONS, type EvaluationJobData } from '@/modules/queue/queue.constants';

/** How many cropped regions to send per question — enough context, bounded cost. */
const MAX_REGION_IMAGES = 3;

/** Stage 5. */
@Processor(QUEUES.EVALUATION, WORKER_OPTIONS)
export class EvaluationProcessor extends WorkerHost {
  private readonly logger = new Logger(EvaluationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly images: ImageService,
    private readonly ai: AiEngineService,
    private readonly events: EventsPublisher,
    private readonly failures: FailureReporter,
  ) {
    super();
  }

  async process(job: Job<EvaluationJobData>): Promise<{ awardedMarks: number }> {
    const { jobId, submissionId, questionId } = job.data;

    await this.prisma.job.update({ where: { id: jobId }, data: { stage: 'EVALUATION' } });

    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id: questionId },
      include: { criteria: { orderBy: { orderIndex: 'asc' } } },
    });

    const regions = await this.prisma.answerRegion.findMany({
      where: { questionId, page: { submissionId } },
      include: { page: true },
      orderBy: [{ page: { pageIndex: 'asc' } }],
    });

    // Nothing was matched to this question — record it as unattempted rather
    // than asking the model to grade an empty string.
    if (regions.length === 0) {
      const evaluation = await this.persist({
        submissionId,
        questionId,
        maxMarks: question.maxMarks,
        aiMarks: 0,
        verdict: 'UNATTEMPTED',
        feedback: 'No answer was found on the answer sheet for this question.',
        confidence: 1,
        steps: [],
        modelId: null,
        tokensIn: null,
        tokensOut: null,
      });
      await this.emitGraded(job.data, question.label, 0, question.maxMarks);
      this.logger.log(`Q${question.label}: unattempted`);
      return { awardedMarks: evaluation.awardedMarks };
    }

    const transcript = regions.map((region) => region.transcript).join('\n\n');
    const crops = await this.cropRegions(regions);

    const result = await this.ai.gradeAnswer({
      label: question.label,
      text: question.text,
      type: question.type,
      maxMarks: question.maxMarks,
      expectedAnswer: question.expectedAnswer,
      criteria: question.criteria.map((criterion) => ({
        description: criterion.description,
        marks: criterion.marks,
      })),
      transcript,
      images: crops,
    });

    const primaryRegionId = regions[0]?.id ?? null;

    await this.persist({
      submissionId,
      questionId,
      maxMarks: question.maxMarks,
      aiMarks: result.awardedMarks,
      verdict: result.verdict,
      feedback: result.feedback,
      confidence: result.confidence,
      steps: result.steps.map((step, index) => ({
        orderIndex: index,
        description: step.description,
        marksDelta: step.marksDelta,
        regionId: primaryRegionId,
      })),
      modelId: result.modelId,
      tokensIn: result.inputTokens,
      tokensOut: result.outputTokens,
    });

    this.logger.log(
      `Q${question.label}: ${result.awardedMarks}/${question.maxMarks} (${result.verdict})`,
    );
    await this.emitGraded(
      job.data,
      question.label,
      result.awardedMarks,
      question.maxMarks,
      result.verdict,
    );

    return { awardedMarks: result.awardedMarks };
  }

  private async cropRegions(regions: Array<{ bbox: unknown; page: { imageKey: string } }>) {
    const crops: Array<{ data: Buffer; mimeType: string }> = [];

    for (const region of regions.slice(0, MAX_REGION_IMAGES)) {
      try {
        const pageImage = await this.storage.download(region.page.imageKey);
        const cropped = await this.images.cropRegion(pageImage, region.bbox as BoundingBox);
        if (cropped) crops.push({ data: cropped, mimeType: 'image/png' });
      } catch (error) {
        // A failed crop degrades to transcript-only grading; it should not fail
        // the question.
        this.logger.warn(`Could not crop region: ${(error as Error).message}`);
      }
    }

    return crops;
  }

  private async persist(input: {
    submissionId: string;
    questionId: string;
    maxMarks: number;
    aiMarks: number;
    verdict: 'CORRECT' | 'PARTIAL' | 'INCORRECT' | 'UNATTEMPTED';
    feedback: string;
    confidence: number;
    steps: Array<{
      orderIndex: number;
      description: string;
      marksDelta: number;
      regionId: string | null;
    }>;
    modelId: string | null;
    tokensIn: number | null;
    tokensOut: number | null;
  }) {
    // Upsert keyed on (submissionId, questionId) so a retry overwrites rather
    // than duplicating. Steps are replaced wholesale.
    const existing = await this.prisma.evaluation.findUnique({
      where: {
        submissionId_questionId: {
          submissionId: input.submissionId,
          questionId: input.questionId,
        },
      },
      select: { id: true, isOverridden: true, awardedMarks: true },
    });

    if (existing) {
      await this.prisma.evaluationStep.deleteMany({
        where: { evaluationId: existing.id },
      });
    }

    return this.prisma.evaluation.upsert({
      where: {
        submissionId_questionId: {
          submissionId: input.submissionId,
          questionId: input.questionId,
        },
      },
      create: {
        submissionId: input.submissionId,
        questionId: input.questionId,
        aiMarks: input.aiMarks,
        awardedMarks: input.aiMarks,
        maxMarks: input.maxMarks,
        verdict: input.verdict,
        feedback: input.feedback,
        confidence: input.confidence,
        modelId: input.modelId,
        tokensIn: input.tokensIn,
        tokensOut: input.tokensOut,
        steps: { create: input.steps },
      },
      update: {
        aiMarks: input.aiMarks,
        // Never clobber a mark the teacher has already set by hand.
        awardedMarks: existing?.isOverridden ? existing.awardedMarks : input.aiMarks,
        maxMarks: input.maxMarks,
        verdict: input.verdict,
        feedback: input.feedback,
        confidence: input.confidence,
        modelId: input.modelId,
        tokensIn: input.tokensIn,
        tokensOut: input.tokensOut,
        steps: { create: input.steps },
      },
    });
  }

  private async emitGraded(
    data: EvaluationJobData,
    label: string,
    awardedMarks: number,
    maxMarks: number,
    verdict: 'CORRECT' | 'PARTIAL' | 'INCORRECT' | 'UNATTEMPTED' = 'UNATTEMPTED',
  ) {
    this.events.questionGraded({
      jobId: data.jobId,
      submissionId: data.submissionId,
      questionId: data.questionId,
      questionLabel: label,
      awardedMarks,
      maxMarks,
      verdict,
    });

    // Grading jobs run concurrently, so progress is derived from how many
    // evaluations exist rather than from this job's position in a sequence.
    const [graded, total] = await Promise.all([
      this.prisma.evaluation.count({ where: { submissionId: data.submissionId } }),
      this.prisma.question.count({
        where: { assessmentId: data.assessmentId, children: { none: {} } },
      }),
    ]);

    this.events.progress(
      data.jobId,
      'EVALUATION',
      graded,
      total,
      `Graded ${graded} of ${total} questions`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EvaluationJobData>, error: Error) {
    void this.failures.report(job, error, 'EVALUATION');
  }
}
