import { Body, Controller, Get, HttpCode, Post, UsePipes } from '@nestjs/common';
import { loginSchema, registerSchema } from '@vedaai/shared';
import { ZodValidationPipe } from '@/common/zod-validation.pipe';
import { CurrentUser, type AuthenticatedUser } from '@/common/current-user.decorator';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @UsePipes(new ZodValidationPipe(registerSchema))
  register(@Body() body: unknown) {
    return this.auth.register(body as never);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() body: unknown) {
    return this.auth.login(body as never);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }
}
