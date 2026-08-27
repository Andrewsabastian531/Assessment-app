import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { BoundingBox, OverrideEvaluationInput, ReviewPayload } from '@vedaai/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { AuthenticatedUser } from '@/common/current-user.decorator';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Everything the review screen needs, in a single round-trip. */
  async getReviewPayload(user: AuthenticatedUser, submissionId: string): Promise<ReviewPayload> {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        assessment: { select: { id: true, teacherId: true } },
        pages: { orderBy: { pageIndex: 'asc' }, include: { regions: true } },
        evaluations: {
          include: { steps: { orderBy: { orderIndex: 'asc' } } },
        },
        _count: { select: { pages: true } },
      },
    });

    if (!submission) throw new NotFoundException('Submission not found');
    this.assertOwner(user, submission.assessment.teacherId);

    const questions = await this.prisma.question.findMany({
      where: { assessmentId: submission.assessmentId },
      orderBy: { orderIndex: 'asc' },
      include: { criteria: { orderBy: { orderIndex: 'asc' } } },
    });

    // Page images are private objects; mint short-lived signed GETs per request
    // rather than storing public URLs.
    const pages = await Promise.all(
      submission.pages.map(async (page) => ({
        id: page.id,
        pageIndex: page.pageIndex,
        imageKey: page.imageKey,
        imageUrl: await this.storage.presignGet(page.imageKey),
        width: page.width,
        height: page.height,
      })),
    );

    const regions = submission.pages.flatMap((page) =>
      page.regions.map((region) => ({
        id: region.id,
        pageId: region.pageId,
        pageIndex: page.pageIndex,
        questionId: region.questionId,
        bbox: region.bbox as BoundingBox,
        transcript: region.transcript,
        isPrintedLabel: region.isPrintedLabel,
        confidence: region.confidence,
      })),
    );

    return {
      submission: {
        id: submission.id,
        assessmentId: submission.assessmentId,
        studentName: submission.studentName,
        studentRollNo: submission.studentRollNo,
        status: submission.status,
        totalAwarded: submission.totalAwarded,
        totalMax: submission.totalMax,
        pageCount: submission._count.pages,
        createdAt: submission.createdAt.toISOString(),
      },
      questions: questions.map((question) => ({
        id: question.id,
        assessmentId: question.assessmentId,
        parentId: question.parentId,
        label: question.label,
        text: question.text,
        type: question.type,
        maxMarks: question.maxMarks,
        orderIndex: question.orderIndex,
        sourcePage: question.sourcePage,
        sourceBBox: (question.sourceBBox as BoundingBox | null) ?? null,
        expectedAnswer: question.expectedAnswer,
        criteria: question.criteria.map((criterion) => ({
          id: criterion.id,
          description: criterion.description,
          marks: criterion.marks,
          orderIndex: criterion.orderIndex,
        })),
      })),
      pages,
      regions,
      evaluations: submission.evaluations.map((evaluation) => ({
        id: evaluation.id,
        submissionId: evaluation.submissionId,
        questionId: evaluation.questionId,
        aiMarks: evaluation.aiMarks,
        awardedMarks: evaluation.awardedMarks,
        maxMarks: evaluation.maxMarks,
        isOverridden: evaluation.isOverridden,
        verdict: evaluation.verdict,
        feedback: evaluation.feedback,
        modelId: evaluation.modelId,
        steps: evaluation.steps.map((step) => ({
          id: step.id,
          orderIndex: step.orderIndex,
          description: step.description,
          marksDelta: step.marksDelta,
          regionId: step.regionId,
        })),
      })),
    };
  }

  async getPageUrl(user: AuthenticatedUser, submissionId: string, pageIndex: number) {
    const page = await this.prisma.submissionPage.findUnique({
      where: { submissionId_pageIndex: { submissionId, pageIndex } },
      include: {
        submission: { include: { assessment: { select: { teacherId: true } } } },
      },
    });
    if (!page) throw new NotFoundException('Page not found');
    this.assertOwner(user, page.submission.assessment.teacherId);

    return {
      url: await this.storage.presignGet(page.imageKey),
      width: page.width,
      height: page.height,
    };
  }

  /** Manual mark override, with an audit row so the change is attributable. */
  async override(user: AuthenticatedUser, evaluationId: string, input: OverrideEvaluationInput) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: {
        submission: { include: { assessment: { select: { teacherId: true } } } },
      },
    });
    if (!evaluation) throw new NotFoundException('Evaluation not found');
    this.assertOwner(user, evaluation.submission.assessment.teacherId);

    const awardedMarks = Math.min(evaluation.maxMarks, Math.max(0, input.awardedMarks));

    const [updated] = await this.prisma.$transaction([
      this.prisma.evaluation.update({
        where: { id: evaluationId },
        data: { awardedMarks, isOverridden: true },
        include: { steps: { orderBy: { orderIndex: 'asc' } } },
      }),
      this.prisma.override.create({
        data: {
          evaluationId,
          userId: user.id,
          previousMarks: evaluation.awardedMarks,
          newMarks: awardedMarks,
          note: input.note,
        },
      }),
    ]);

    await this.recalculateTotals(evaluation.submissionId);
    return updated;
  }

  async finalize(user: AuthenticatedUser, submissionId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { assessment: { select: { teacherId: true } } },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    this.assertOwner(user, submission.assessment.teacherId);

    await this.recalculateTotals(submissionId);

    return this.prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'FINALIZED', finalizedAt: new Date() },
    });
  }

  private async recalculateTotals(submissionId: string) {
    const totals = await this.prisma.evaluation.aggregate({
      where: { submissionId },
      _sum: { awardedMarks: true, maxMarks: true },
    });
    await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        totalAwarded: round2(totals._sum.awardedMarks ?? 0),
        totalMax: round2(totals._sum.maxMarks ?? 0),
      },
    });
  }

  private assertOwner(user: AuthenticatedUser, teacherId: string) {
    if (user.role !== 'ADMIN' && teacherId !== user.id) {
      throw new ForbiddenException('You do not have access to this submission');
    }
  }
}

const round2 = (value: number) => Math.round(value * 100) / 100;
