import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ExpenseClaimRepository } from '../repositories/expense-claim.repository';
import { ExpenseTaxTreatment } from '../dto/expense-claim.dto';

@Injectable()
export class ExpensePolicyService {
  constructor(private readonly expenseClaimRepository: ExpenseClaimRepository) {}

  async validateAndEnforceCategoryPolicy(
    companyId: string,
    items: Array<{ categoryId: string; amount: number; receiptDocumentId?: string }>,
    employeeId?: string,
  ) {
    const validatedItems: Array<{
      categoryId: string;
      amount: number;
      receiptDocumentId?: string;
      taxTreatment: ExpenseTaxTreatment;
    }> = [];

    for (const item of items) {
      const category = await this.expenseClaimRepository.findCategoryByIdAndTenant(item.categoryId, companyId);
      if (!category) {
        throw new NotFoundException(`Expense category ID "${item.categoryId}" not found or inactive`);
      }
      if (!category.isActive) {
        throw new BadRequestException(`Expense category '${category.name}' is inactive. Cannot submit claims under inactive categories.`);
      }

      if (category.maxLimit && item.amount > category.maxLimit) {
        throw new BadRequestException(
          `Claim item amount ₹${item.amount} exceeds category '${category.name}' policy limit of ₹${category.maxLimit}.`,
        );
      }

      if (category.requireReceipt && !item.receiptDocumentId) {
        throw new BadRequestException(`Category '${category.name}' requires a valid proof receipt document.`);
      }

      if (item.receiptDocumentId) {
        const doc = await this.expenseClaimRepository.findDocumentByIdAndTenant(
          item.receiptDocumentId,
          companyId,
        );
        if (!doc) {
          throw new BadRequestException(
            `Receipt document ID "${item.receiptDocumentId}" not found or belongs to another tenant.`,
          );
        }

        if (!employeeId) {
          throw new BadRequestException('Employee context is required to validate expense receipt attachment.');
        }

        if (doc.category !== 'EXPENSE_RECEIPT') {
          throw new BadRequestException(
            `Attached document ID "${item.receiptDocumentId}" is not categorized as an EXPENSE_RECEIPT.`,
          );
        }

        if (doc.employeeId !== employeeId) {
          throw new BadRequestException(
            `Receipt document ID "${item.receiptDocumentId}" does not belong to the claiming employee.`,
          );
        }
      }

      const taxTreatment: ExpenseTaxTreatment = category.isTaxable ? 'TAXABLE' : 'NON_TAXABLE';

      validatedItems.push({
        ...item,
        taxTreatment,
      });
    }

    return validatedItems;
  }
}
