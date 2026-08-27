import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AcceptedMimeType,
  ConfirmUploadInput,
  CreateAssessmentInput,
  PresignRequest,
  PresignResponse,
  StartMappingInput,
  StartMappingResponse,
  UpdateQuestionInput,
} from '@vedaai/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PipelineService } from '../queue/pipeline.service';
import type { AuthenticatedUser } from '@/common/current-user.decorator';

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly pipeline: PipelineService,
  ) {}

  async list(user: AuthenticatedUser) {
    const assessments = await this.prisma.assessment.findMany({
      where: { teacherId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        assets: true,
        _count: { select: { questions: true, submissions: true } },
      },
    });

    return assessments.map((assessment) => this.toDto(assessment));
  }

  async create(user: AuthenticatedUser, input: CreateAssessmentInput) {
    const assessment = await this.prisma.assessment.create({
      data: {
        title: input.title,
        subject: input.subject,
        grade: input.grade,
        teacherId: user.id,
        schoolId: user.schoolId,
      },
      include: {
        assets: true,
        _count: { select: { questions: true, submissions: true } },
      },
    });
    return this.toDto(assessment);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        assets: true,
        _count: { select: { questions: true, submissions: true } },
      },
    });
    if (!assessment) throw new NotFoundException('Exam not found');
    this.assertOwner(user, assessment.teacherId);
    return this.toDto(assessment);
  }

  /** Issues a pre-signed PUT so the browser uploads straight to object storage. */
  async presignUpload(
    user: AuthenticatedUser,
    assessmentId: string,
    input: PresignRequest,
  ): Promise<PresignResponse> {
    await this.assertOwns(user, assessmentId);

    const storageKey = this.storage.buildKey(
      assessmentId,
      input.kind,
      input.mimeType as AcceptedMimeType,
    );

    const asset = await this.prisma.asset.create({
      data: {
        kind: input.kind,
        storageKey,
        originalName: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        assessmentId,
      },
    });

    const presigned = await this.storage.presignPut(storageKey, input.mimeType, input.sizeBytes);

    return {
      assetId: asset.id,
      storageKey: presigned.storageKey,
      uploadUrl: presigned.uploadUrl,
      expiresInSeconds: presigned.expiresInSeconds,
      requiredHeaders: presigned.requiredHeaders,
    };
  }

  async confirmUpload(user: AuthenticatedUser, assessmentId: string, input: ConfirmUploadInput) {
    await this.assertOwns(user, assessmentId);
    await this.prisma.asset.update({
      where: { id: input.assetId },
      data: { uploaded: true, pageCount: input.pageCount ?? undefined },
    });
    return { ok: true };
  }

  async deleteAsset(user: AuthenticatedUser, assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      include: { assessment: { select: { teacherId: true } } },
    });
    if (!asset) throw new NotFoundException('File not found');
    this.assertOwner(user, asset.assessment.teacherId);

    await this.prisma.asset.delete({ where: { id: assetId } });
    await this.storage.delete(asset.storageKey);
  }

  async startMapping(
    user: AuthenticatedUser,
    assessmentId: string,
    input: StartMappingInput,
  ): Promise<StartMappingResponse> {
    await this.assertOwns(user, assessmentId);

    const assets = await this.prisma.asset.findMany({
      where: {
        id: { in: [input.questionPaperAssetId, input.answerSheetAssetId] },
        assessmentId,
      },
    });

    if (assets.length !== 2) {
      throw new BadRequestException('Both files must belong to this exam');
    }
    if (assets.some((asset) => !asset.uploaded)) {
      throw new BadRequestException('Both files must finish uploading first');
    }

    const submission = await this.prisma.submission.create({
      data: {
        assessmentId,
        assetId: input.answerSheetAssetId,
        studentName: input.studentName,
        studentRollNo: input.studentRollNo,
        status: 'UPLOADED',
      },
    });

    return this.pipeline.start({
      assessmentId,
      submissionId: submission.id,
      questionPaperAssetId: input.questionPaperAssetId,
      answerSheetAssetId: input.answerSheetAssetId,
    });
  }

  async listQuestions(user: AuthenticatedUser, assessmentId: string) {
    await this.assertOwns(user, assessmentId);
    const questions = await this.prisma.question.findMany({
      where: { assessmentId },
      orderBy: { orderIndex: 'asc' },
      include: { criteria: { orderBy: { orderIndex: 'asc' } } },
    });
    return questions.map((question) => ({
      ...question,
      sourceBBox: question.sourceBBox ?? null,
      createdAt: question.createdAt.toISOString(),
      updatedAt: question.updatedAt.toISOString(),
    }));
  }

  async updateQuestion(user: AuthenticatedUser, questionId: string, input: UpdateQuestionInput) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { assessment: { select: { teacherId: true } } },
    });
    if (!question) throw new NotFoundException('Question not found');
    this.assertOwner(user, question.assessment.teacherId);

    // Criteria are replaced wholesale — the editor sends the full list.
    if (input.criteria) {
      await this.prisma.rubricCriterion.deleteMany({ where: { questionId } });
    }

    return this.prisma.question.update({
      where: { id: questionId },
      data: {
        label: input.label,
        text: input.text,
        type: input.type,
        maxMarks: input.maxMarks,
        expectedAnswer: input.expectedAnswer,
        criteria: input.criteria
          ? {
              create: input.criteria.map((criterion, index) => ({
                description: criterion.description,
                marks: criterion.marks,
                orderIndex: criterion.orderIndex ?? index,
              })),
            }
          : undefined,
      },
      include: { criteria: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  private async assertOwns(user: AuthenticatedUser, assessmentId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { teacherId: true },
    });
    if (!assessment) throw new NotFoundException('Exam not found');
    this.assertOwner(user, assessment.teacherId);
  }

  private assertOwner(user: AuthenticatedUser, teacherId: string) {
    if (user.role !== 'ADMIN' && teacherId !== user.id) {
      throw new ForbiddenException('You do not have access to this exam');
    }
  }

  private toDto(assessment: {
    id: string;
    title: string;
    subject: string | null;
    grade: string | null;
    status: string;
    teacherId: string;
    schoolId: string | null;
    createdAt: Date;
    updatedAt: Date;
    assets: Array<{
      id: string;
      kind: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      pageCount: number | null;
      storageKey: string;
      uploaded: boolean;
      createdAt: Date;
    }>;
    _count: { questions: number; submissions: number };
  }) {
    return {
      id: assessment.id,
      title: assessment.title,
      subject: assessment.subject,
      grade: assessment.grade,
      status: assessment.status,
      teacherId: assessment.teacherId,
      schoolId: assessment.schoolId,
      questionCount: assessment._count.questions,
      submissionCount: assessment._count.submissions,
      assets: assessment.assets.map((asset) => ({
        ...asset,
        createdAt: asset.createdAt.toISOString(),
      })),
      createdAt: assessment.createdAt.toISOString(),
      updatedAt: assessment.updatedAt.toISOString(),
    };
  }
}
