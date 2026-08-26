import { Global, Module } from '@nestjs/common';
import { AiEngineService } from './ai-engine.service';
import { ImageService } from './image.service';
import { MappingService } from './mapping.service';

@Global()
@Module({
  providers: [AiEngineService, ImageService, MappingService],
  exports: [AiEngineService, ImageService, MappingService],
})
export class AiEngineModule {}
