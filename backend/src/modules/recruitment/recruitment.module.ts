import { Module } from '@nestjs/common';
import { RecruitmentController } from './controllers/recruitment.controller';
import { RecruitmentService } from './services/recruitment.service';
import { RecruitmentRepository } from './repositories/recruitment.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmployeesModule } from '../employees/employees.module';
import { PayrollModule } from '../payroll/payroll.module';
import { DocumentsModule } from '../documents/documents.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { OfferLetterTemplateService } from '../../common/documents/offer-letter-template.service';

@Module({
  imports: [
    PrismaModule,
    EmployeesModule,
    PayrollModule,
    DocumentsModule,
    SubscriptionsModule,
  ],
  controllers: [RecruitmentController],
  providers: [RecruitmentService, RecruitmentRepository, OfferLetterTemplateService],
  exports: [RecruitmentService, RecruitmentRepository, OfferLetterTemplateService],
})
export class RecruitmentModule {}

