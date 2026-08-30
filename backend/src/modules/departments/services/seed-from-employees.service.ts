import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SeedFromEmployeesService {
  private readonly logger = new Logger(SeedFromEmployeesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedOrgDataFromEmployees() {
    this.logger.log('Seeding disabled.');
  }
}
