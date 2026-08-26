import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { loadConfiguration } from './config/configuration';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { AiEngineModule } from './modules/ai-engine/ai-engine.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { AuthModule } from './modules/auth/auth.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { QueueModule } from './modules/queue/queue.module';
import { StorageModule } from './modules/storage/storage.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Validates the whole environment once, at boot, with a readable error.
      load: [loadConfiguration],
      cache: true,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),

    PrismaModule,
    StorageModule,
    AiEngineModule,
    EventsModule,
    QueueModule,

    AuthModule,
    AssessmentsModule,
    SubmissionsModule,
    HealthModule,
  ],
  providers: [
    // Every route is authenticated unless it opts out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
