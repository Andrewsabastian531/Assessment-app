import { Global, Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { EventsPublisher } from './events.publisher';

@Global()
@Module({
  providers: [EventsGateway, EventsPublisher],
  exports: [EventsGateway, EventsPublisher],
})
export class EventsModule {}
