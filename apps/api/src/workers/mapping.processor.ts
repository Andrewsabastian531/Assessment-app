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
  type EvaluationJobData,
  type PipelineJobData,
} from '@/modules/queue/queue.constants';

/**
 * Stage 4. Runs once every page has been analysed and the rubric extracted
 * (BullMQ holds it until all children of this flow node succeed).
 *
 * Pairs each answer region with the question it answers, then fans out one
 * grading job per question.
 */
@Processor(QUEUES.MAPPING)
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

    const unmatched = questions.length - new Set(
      matches.filter((match) => match.questionId).map((match) => match.questionId),
    ).size;

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

    await this.fanOut(job.data, questions.map((question) => question.id));

    return { matched };
  }

  /**
   * One grading job per question, with aggregation as their parent so it runs
   * only after every question has a verdict.
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
