import { Controller, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { PlansService } from '../services/plans.service';

@Controller('public/plans')
@UseGuards(ThrottlerGuard)
export class PublicPlansController {
  constructor(private readonly plansService: PlansService) {}

  /**
   * Public Read-Only Plans API
   * Exposes published SaaS plans and published versions for the landing page & checkout selection.
   * Rate limited: 60 requests per minute per IP.
   */
  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async getPublicPlans() {
    return this.plansService.getPublicPlans();
  }
}
