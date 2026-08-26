import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  confirmUploadSchema,
  createAssessmentSchema,
  presignRequestSchema,
  startMappingSchema,
  updateQuestionSchema,
} from '@vedaai/shared';
import { CurrentUser, type AuthenticatedUser } from '@/common/current-user.decorator';
import { ZodValidationPipe } from '@/common/zod-validation.pipe';
import { AssessmentsService } from './assessments.service';

@Controller()
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get('assessments')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.assessments.list(user);
  }

  @Post('assessments')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createAssessmentSchema)) body: unknown,
  ) {
    return this.assessments.create(user, body as never);
  }

  @Get('assessments/:id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.assessments.findOne(user, id);
  }

  @Post('assessments/:id/uploads/presign')
  presign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(presignRequestSchema)) body: unknown,
  ) {
    return this.assessments.presignUpload(user, id, body as never);
  }

  @Post('assessments/:id/uploads/confirm')
  @HttpCode(200)
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(confirmUploadSchema)) body: unknown,
  ) {
    return this.assessments.confirmUpload(user, id, body as never);
  }

  @Delete('assets/:assetId')
  @HttpCode(204)
  async deleteAsset(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assetId') assetId: string,
  ) {
    await this.assessments.deleteAsset(user, assetId);
  }

  @Post('assessments/:id/start-mapping')
  startMapping(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(startMappingSchema)) body: unknown,
  ) {
    return this.assessments.startMapping(user, id, body as never);
  }

  @Get('assessments/:id/questions')
  listQuestions(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.assessments.listQuestions(user, id);
  }

  @Patch('questions/:questionId')
  updateQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('questionId') questionId: string,
    @Body(new ZodValidationPipe(updateQuestionSchema)) body: unknown,
  ) {
    return this.assessments.updateQuestion(user, questionId, body as never);
  }
}
