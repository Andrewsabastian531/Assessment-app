import { InjectFlowProducer, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { FlowProducer, Job } from 'bullmq';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { MappingService } from '@/modules/ai-engine/mapping.service';
import { EventsPublisher } from '@/modules/events/events.publisher';
import { FailureReporter } from './failure-reporter.service';
import {
  DEFAULT_JOB_OPTIONS,
  PIPELINE_FLOW,
  QUEUES,
  WORKER_OPTIONS,
  type EvaluationJobData,
  type PipelineJobData,
} from '@/modules/queue/queue.constants';

/** Stage 4. */
@Processor(QUEUES.MAPPING, WORKER_OPTIONS)
export class MappingProcessor extends WorkerHost {
  private readonly logger = new Logger(MappingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mapping: MappingService,
    private readonly events: EventsPublisher,
    private readonly failures: FailureReporter,
    @InjectFlowProducer(PIPELINE_FLOW) private readonly flow: FlowProducer,
  ) {
    super();
  }

  async process(job: Job<PipelineJobData>): Promise<{ matched: number }> {
    const { jobId, assessmentId, submissionId } = job.data;

    await this.prisma.job.update({ where: { id: jobId }, data: { stage: 'MAPPING' } });
    this.events.progress(jobId, 'MAPPING', 0, 1, 'Matching answers to questions');

    // Only leaf questions are answerable — a parent with sub-parts is a heading.
    const questions = await this.prisma.question.findMany({
      where: { assessmentId, children: { none: {} } },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, label: true, text: true },
    });

    const regions = await this.prisma.answerRegion.findMany({
      where: { page: { submissionId } },
      select: {
        id: true,
        transcript: true,
        labelHint: true,
        isPrintedLabel: true,
      },
    });

    const handwriting = regions.filter((region) => !region.isPrintedLabel);

    // A page that yields nothing was not read, and grading it anyway returns a
    // confident zero for work the student actually did. Failing here is
    // recoverable; a bogus score that looks legitimate is not.
    if (handwriting.length === 0) {
      throw new Error(
        'No handwriting was detected on the answer sheet. The scan may be too faint, ' +
          'rotated, or the wrong file.',
      );
    }

    const matches = await this.mapping.match(
      questions,
      regions.map((region) => ({
        id: region.id,
        transcript: region.transcript,
        questionLabelHint: region.labelHint,
        isPrintedLabel: region.isPrintedLabel,
      })),
    );

    let matched = 0;
    for (const match of matches) {
      await this.prisma.answerRegion.update({
        where: { id: match.regionId },
        data: {
          questionId: match.questionId,
          confidence: match.confidence,
        },
      });
      if (match.questionId) matched += 1;
    }

    const answered = new Set(
      matches.filter((match) => match.questionId).map((match) => match.questionId),
    ).size;
    const unmatched = questions.length - answered;

    if (answered === 0) {
      throw new Error(
        `Found ${handwriting.length} handwritten region(s) but could not match any of them ` +
          `to the ${questions.length} extracted question(s). The question paper and answer ` +
          'sheet may not belong to the same exam.',
      );
    }

    // Some blanks are normal; almost all blank usually means the read failed.
    if (answered < questions.length / 2) {
      this.logger.warn(
        `Only ${answered} of ${questions.length} questions matched an answer from ` +
          `${handwriting.length} region(s). Review the unmatched ones before trusting the total.`,
      );
    }

    await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { status: 'GRADING' },
    });

    this.events.mappingCompleted({ jobId, submissionId, matched, unmatched });
    this.events.progress(
      jobId,
      'MAPPING',
      1,
      1,
      `Matched ${matched} answer${matched === 1 ? '' : 's'}`,
    );

    await this.fanOut(
      job.data,
      questions.map((question) => question.id),
    );

    return { matched };
  }

  /**
   * One grading job per question, with aggregation as their parent so it runs only
   * after every question has a verdict.
   */
  private async fanOut(data: PipelineJobData, questionIds: string[]) {
    await this.flow.add({
      name: 'aggregate-results',
      queueName: QUEUES.AGGREGATION,
      data,
      opts: DEFAULT_JOB_OPTIONS,
      children: questionIds.map((questionId) => ({
        name: `grade-${questionId}`,
        queueName: QUEUES.EVALUATION,
        data: { ...data, questionId } satisfies EvaluationJobData,
        opts: DEFAULT_JOB_OPTIONS,
      })),
    });

    this.logger.log(`Queued ${questionIds.length} grading jobs`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PipelineJobData>, error: Error) {
    void this.failures.report(job, error, 'MAPPING');
  }
}
