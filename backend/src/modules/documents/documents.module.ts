import { Module } from '@nestjs/common';
import { DocumentsService } from './services/documents.service';
import { DocumentsController } from './controllers/documents.controller';
import { EmployeesModule } from '../employees/employees.module';
import { SystemModule } from '../system/system.module';
import { PayrollModule } from '../payroll/payroll.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { DocumentsRepository } from './repositories/documents.repository';
import { OfferLetterTemplateService } from '../../common/documents/offer-letter-template.service';

@Module({
  imports: [EmployeesModule, SystemModule, PayrollModule, PrismaModule],
  providers: [DocumentsService, DocumentsRepository, OfferLetterTemplateService],
  controllers: [DocumentsController],
  exports: [DocumentsService, DocumentsRepository, OfferLetterTemplateService],
})
export class DocumentsModule {}
