import { Body, Controller, Get, HttpCode, Post, UsePipes } from '@nestjs/common';
import { loginSchema, oauthExchangeSchema, registerSchema } from '@vedaai/shared';
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

  /** Completes a social sign-in started by the web app. */
  @Public()
  @Post('oauth/exchange')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(oauthExchangeSchema))
  exchangeOAuth(@Body() body: unknown) {
    return this.auth.exchangeOAuth(body as never);
  }

  /** Lets the sign-in page hide provider buttons the server cannot serve. */
  @Public()
  @Get('providers')
  providers() {
    return { google: this.auth.isGoogleConfigured() };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }
}
