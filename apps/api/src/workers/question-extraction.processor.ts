import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import type { ExtractedQuestion } from '@vedaai/shared';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { AiEngineService } from '@/modules/ai-engine/ai-engine.service';
import { ImageService } from '@/modules/ai-engine/image.service';
import { EventsPublisher } from '@/modules/events/events.publisher';
import { FailureReporter } from './failure-reporter.service';
import { QUEUES, type PipelineJobData } from '@/modules/queue/queue.constants';

/** Stage 2. */
@Processor(QUEUES.QUESTION_EXTRACTION)
export class QuestionExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(QuestionExtractionProcessor.name);

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

  async process(job: Job<PipelineJobData>): Promise<{ questionCount: number }> {
    const { jobId, assessmentId, questionPaperAssetId } = job.data;

    await this.prisma.job.update({
      where: { id: jobId },
      data: { stage: 'QUESTION_EXTRACTION' },
    });
    await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { status: 'EXTRACTING' },
    });

    this.events.progress(jobId, 'QUESTION_EXTRACTION', 0, 1, 'Reading the question paper');

    const asset = await this.prisma.asset.findUniqueOrThrow({
      where: { id: questionPaperAssetId },
    });
    const file = await this.storage.download(asset.storageKey);
    const pages = await this.images.rasterize(file, asset.mimeType);

    const result = await this.ai.extractQuestions(
      pages.map((page) => ({ data: page.png, mimeType: 'image/png' })),
    );

    // A retry must not append a second copy of the rubric.
    await this.prisma.question.deleteMany({ where: { assessmentId } });

    let orderIndex = 0;
    let created = 0;

    for (const question of result.questions) {
      const parent = await this.createQuestion(assessmentId, question, null, orderIndex);
      orderIndex += 1;
      created += 1;

      for (const child of question.subQuestions) {
        await this.prisma.question.create({
          data: {
            assessmentId,
            parentId: parent.id,
            label: child.label,
            text: child.text,
            type: child.type,
            maxMarks: child.maxMarks,
            orderIndex: orderIndex++,
            sourcePage: question.pageIndex,
          },
        });
        created += 1;
      }
    }

    if (result.detectedSubject || result.detectedGrade) {
      await this.prisma.assessment.update({
        where: { id: assessmentId },
        data: {
          subject: result.detectedSubject ?? undefined,
          grade: result.detectedGrade ?? undefined,
        },
      });
    }

    this.logger.log(`Extracted ${created} questions for assessment ${assessmentId}`);
    this.events.extractionCompleted({ jobId, assessmentId, questionCount: created });
    this.events.progress(jobId, 'QUESTION_EXTRACTION', 1, 1, `Found ${created} questions`);

    return { questionCount: created };
  }

  private createQuestion(
    assessmentId: string,
    question: ExtractedQuestion,
    parentId: string | null,
    orderIndex: number,
  ) {
    return this.prisma.question.create({
      data: {
        assessmentId,
        parentId,
        label: question.label,
        text: question.text,
        type: question.type,
        // When a question has parts, its own marks are the sum of the parts.
        maxMarks:
          question.subQuestions.length > 0
            ? question.subQuestions.reduce((sum, child) => sum + child.maxMarks, 0)
            : question.maxMarks,
        orderIndex,
        sourcePage: question.pageIndex,
        sourceBBox: question.bbox ?? undefined,
        expectedAnswer: question.expectedAnswer,
        criteria: {
          create: question.criteria.map((criterion, index) => ({
            description: criterion.description,
            marks: criterion.marks,
            orderIndex: index,
          })),
        },
      },
      select: { id: true },
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PipelineJobData>, error: Error) {
    void this.failures.report(job, error, 'QUESTION_EXTRACTION');
  }
}
