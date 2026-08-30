import { Module } from '@nestjs/common';
import { DepartmentsService } from './services/departments.service';
import { DepartmentsController } from './controllers/departments.controller';
import { DepartmentsRepository } from './repositories/departments.repository';
import { SeedFromEmployeesService } from './services/seed-from-employees.service';

@Module({
  controllers: [DepartmentsController],
  providers: [
    DepartmentsService,
    DepartmentsRepository,
    SeedFromEmployeesService,
  ],
  exports: [
    DepartmentsService,
    DepartmentsRepository,
    SeedFromEmployeesService,
  ],
})
export class DepartmentsModule {}
