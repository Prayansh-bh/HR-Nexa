import { Module, Global } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueProcessor } from './queue.processor';
import { OutboxProcessor } from './outbox.processor';
import { AsyncActorValidatorService } from './async-actor.validator';
import { BullMQModule } from './bullmq.module';
import { BullMQQueueService } from './bullmq.queue.service';

import { OutboxBullMQBridge } from './outbox-bullmq.bridge';
import { BullMQObservabilityService } from './bullmq.observability.service';
import { BullMQDLQService } from './bullmq.dlq.service';
import { OutboxPublisherService } from './outbox-publisher.service';

@Global()
@Module({
  imports: [BullMQModule],
  providers: [
    QueueService,
    QueueProcessor,
    OutboxProcessor,
    AsyncActorValidatorService,
    BullMQQueueService,
    OutboxBullMQBridge,
    BullMQObservabilityService,
    BullMQDLQService,
    OutboxPublisherService,
  ],
  exports: [
    QueueService,
    QueueProcessor,
    OutboxProcessor,
    AsyncActorValidatorService,
    BullMQModule,
    BullMQQueueService,
    OutboxBullMQBridge,
    BullMQObservabilityService,
    BullMQDLQService,
    OutboxPublisherService,
  ],
})
export class QueueModule {}

