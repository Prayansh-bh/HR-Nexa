import { Injectable } from '@nestjs/common';
import { BillingRepository } from '../repositories/billing.repository';

@Injectable()
export class BillingService {
  constructor(private readonly billingRepository: BillingRepository) {}

  async getInvoices(companyId?: string | null, options?: { page?: number; limit?: number }) {
    return this.billingRepository.findAll(companyId, options);
  }

  async createInvoice(data: any) {
    return this.billingRepository.create(data);
  }
}
