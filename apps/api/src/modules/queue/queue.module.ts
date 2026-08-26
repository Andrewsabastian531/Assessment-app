import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IngestProcessor } from '@/workers/ingest.processor';
import { QuestionExtractionProcessor } from '@/workers/question-extraction.processor';
import { LayoutAnalysisProcessor } from '@/workers/layout-analysis.processor';
import { MappingProcessor } from '@/workers/mapping.processor';
import { EvaluationProcessor } from '@/workers/evaluation.processor';
import { AggregationProcessor } from '@/workers/aggregation.processor';
import { ALL_QUEUES, PIPELINE_FLOW, QUEUES } from './queue.constants';
import { PipelineService } from './pipeline.service';
import { FailureReporter } from '@/workers/failure-reporter.service';

/**
 * Redis connection options derived from REDIS_URL. `maxRetriesPerRequest: null`
 * is required by BullMQ — without it ioredis aborts in-flight blocking commands
 * and workers die on the first reconnect.
 */
function redisOptions(config: ConfigService) {
  const url = new URL(config.getOrThrow<string>('REDIS_URL'));
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ connection: redisOptions(config) }),
    }),
    BullModule.registerQueue(...ALL_QUEUES.map((name) => ({ name }))),
    BullModule.registerFlowProducerAsync({
      name: PIPELINE_FLOW,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ connection: redisOptions(config) }),
    }),
  ],
  providers: [
    PipelineService,
    FailureReporter,
    IngestProcessor,
    QuestionExtractionProcessor,
    LayoutAnalysisProcessor,
    MappingProcessor,
    EvaluationProcessor,
    AggregationProcessor,
  ],
  exports: [PipelineService, BullModule],
})
export class QueueModule {}

export { PIPELINE_FLOW, QUEUES };
