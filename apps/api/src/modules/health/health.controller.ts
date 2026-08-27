import { Controller, Get } from '@nestjs/common';
import { AiEngineService } from '../ai-engine/ai-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { Public } from '../auth/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiEngineService,
    private readonly storage: StorageService,
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
  /** Verifies the object store is actually reachable with the configured settings. */
  @Public()
  @Get('storage')
  checkStorage() {
    return this.storage.check();
  }

  @Public()
  @Get('ai')
  checkAi() {
    return this.ai.ping();
  }
}
