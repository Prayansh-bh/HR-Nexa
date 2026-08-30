import { Module } from '@nestjs/common';
import { EmployeesService } from './services/employees.service';
import { EmployeesController } from './controllers/employees.controller';
import { EmployeesRepository } from './repositories/employees.repository';
import { EmployeeUserLinkService } from './services/employee-user-link.service';
import { EmployeeDepartmentSyncService } from './services/employee-department-sync.service';

import { AuthModule } from '../auth/auth.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [AuthModule, SubscriptionsModule, PrismaModule],
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    EmployeesRepository,
    EmployeeUserLinkService,
    EmployeeDepartmentSyncService,
  ],
  exports: [
    EmployeesService,
    EmployeesRepository,
    EmployeeDepartmentSyncService,
    EmployeeUserLinkService,
  ],
})
export class EmployeesModule {}
