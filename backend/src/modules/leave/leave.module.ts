import { Module } from '@nestjs/common';
import { LeaveService } from './services/leave.service';
import { LeaveController } from './controllers/leave.controller';
import { LeaveRepository } from './repositories/leave.repository';
import { LeaveTypesRepository } from './repositories/leavetypes.repository';
import { EventsRepository } from './repositories/events.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [LeaveController],
  providers: [
    LeaveService,
    LeaveRepository,
    LeaveTypesRepository,
    EventsRepository,
  ],
  exports: [
    LeaveService,
    LeaveRepository,
    LeaveTypesRepository,
    EventsRepository,
  ],
})
export class LeaveModule {}
