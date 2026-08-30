import { Module, forwardRef } from '@nestjs/common';
import { BillingController } from './controllers/billing.controller';
import { BillingService } from './services/billing.service';
import { BillingRepository } from './repositories/billing.repository';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentsService } from './services/payments.service';
import { PaymentsRepository } from './repositories/payments.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { CheckoutModule } from '../checkout/checkout.module';

@Module({
  imports: [PrismaModule, forwardRef(() => CheckoutModule)],
  controllers: [BillingController, PaymentsController],
  providers: [
    BillingService,
    BillingRepository,
    PaymentsService,
    PaymentsRepository,
  ],
  exports: [
    BillingService,
    BillingRepository,
    PaymentsService,
    PaymentsRepository,
  ],
})
export class BillingModule {}
