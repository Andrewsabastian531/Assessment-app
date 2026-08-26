import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { overrideEvaluationSchema } from '@vedaai/shared';
import { CurrentUser, type AuthenticatedUser } from '@/common/current-user.decorator';
import { ZodValidationPipe } from '@/common/zod-validation.pipe';
import { SubmissionsService } from './submissions.service';

@Controller()
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Get('submissions/:id')
  getReview(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.submissions.getReviewPayload(user, id);
  }

  @Get('submissions/:id/pages/:pageIndex/url')
  getPageUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('pageIndex', ParseIntPipe) pageIndex: number,
  ) {
    return this.submissions.getPageUrl(user, id, pageIndex);
  }

  @Patch('evaluations/:evaluationId/override')
  override(
    @CurrentUser() user: AuthenticatedUser,
    @Param('evaluationId') evaluationId: string,
    @Body(new ZodValidationPipe(overrideEvaluationSchema)) body: unknown,
  ) {
    return this.submissions.override(user, evaluationId, body as never);
  }

  @Post('submissions/:id/finalize')
  finalize(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.submissions.finalize(user, id);
  }
}
