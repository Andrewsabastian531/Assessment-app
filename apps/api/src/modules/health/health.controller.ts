import { Controller, Get } from '@nestjs/common';
import { AiEngineService } from '../ai-engine/ai-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiEngineService,
  ) {}

  @Public()
  @Get()
  async check() {
    const database = await this.prisma.$queryRaw`SELECT 1`
      .then(() => ({ ok: true }))
      .catch((error: Error) => ({ ok: false, error: error.message }));

    return { status: database.ok ? 'ok' : 'degraded', database };
  }

  /** Separate from /health because it costs a real API call. */
  @Public()
  @Get('ai')
  checkAi() {
    return this.ai.ping();
  }
}
