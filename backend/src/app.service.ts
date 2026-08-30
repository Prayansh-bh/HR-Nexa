import { Injectable, OnModuleInit } from '@nestjs/common';
import { SeedFromEmployeesService } from './modules/departments/services/seed-from-employees.service';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(private readonly seedService: SeedFromEmployeesService) {}

  /** Seed Department and Designation tables from employees on every startup (idempotent). */
  async onModuleInit() {
    await this.seedService.seedOrgDataFromEmployees();
  }

  getHello(): string {
    return 'Hello World!';
  }
}
