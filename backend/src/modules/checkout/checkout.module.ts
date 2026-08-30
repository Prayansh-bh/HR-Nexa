import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { BillingModule } from '../billing/billing.module';
import { CheckoutController } from './controllers/checkout.controller';
import { CheckoutService } from './services/checkout.service';
import { RazorpayService } from './services/razorpay.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    SubscriptionsModule,
    IntegrationsModule,
    forwardRef(() => BillingModule),
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService, RazorpayService],
  exports: [CheckoutService, RazorpayService],
})
export class CheckoutModule {}
