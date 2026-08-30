import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { CheckoutService } from '../services/checkout.service';
import { CreateCheckoutOrderDto } from '../dto/create-checkout-order.dto';
import { VerifyCheckoutPaymentDto } from '../dto/verify-checkout-payment.dto';

@Controller('public')
@UseGuards(ThrottlerGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  /**
   * Public Checkout Order Creation
   * Rate limited: 10 requests per minute per IP
   */
  @Post('checkout/order')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async createCheckoutOrder(@Body() body: CreateCheckoutOrderDto) {
    return this.checkoutService.createCheckoutOrder(body);
  }

  /**
   * Public Checkout Payment Verification (Frontend Callback)
   * Rate limited: 20 requests per minute per IP
   */
  @Post('checkout/verify')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async verifyPayment(@Body() body: VerifyCheckoutPaymentDto) {
    return this.checkoutService.verifyPayment(body);
  }

  /**
   * Razorpay Webhook Endpoint
   * Uses raw body and X-Razorpay-Signature for asynchronous payment settlement and fallback provisioning.
   */
  @Post('webhooks/razorpay')
  @HttpCode(HttpStatus.OK)
  async handleRazorpayWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature?: string,
    @Body() body?: any,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing X-Razorpay-Signature header');
    }

    const rawPayload = req.rawBody || JSON.stringify(body || {});
    return this.checkoutService.handleWebhook(rawPayload, signature);
  }
}
