import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ExpenseClaimStatus,
  ExpensePaymentStatus,
  ExpensePaymentMethod,
  ExpenseTaxTreatment,
} from '../dto/expense-claim.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

@Injectable()
export class ExpenseClaimRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get categoryDelegate() {
    return (this.prisma as any).expenseCategory;
  }

  private get claimDelegate() {
    return (this.prisma as any).expenseClaim;
  }

  private get itemDelegate() {
    return (this.prisma as any).expenseClaimItem;
  }

  // --- Category Operations ---
  async findTenantCategories(companyId: string, activeOnly = false) {
    const where: any = { companyId };
    if (activeOnly) where.isActive = true;
    return this.categoryDelegate.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findCategoryByIdAndTenant(id: string, companyId: string) {
    return this.categoryDelegate.findFirst({
      where: { id, companyId },
    });
  }

  async findCategoryByCodeAndTenant(code: string, companyId: string) {
    return this.categoryDelegate.findFirst({
      where: { companyId, code: code.toUpperCase() },
    });
  }

  async createCategory(companyId: string, data: any) {
    return this.categoryDelegate.create({
      data: {
        companyId,
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description || null,
        maxLimit: data.maxLimit !== undefined ? data.maxLimit : null,
        requireReceipt: data.requireReceipt !== undefined ? data.requireReceipt : true,
        isTaxable: data.isTaxable !== undefined ? data.isTaxable : false,
        isActive: true,
      },
    });
  }

  async updateCategory(id: string, companyId: string, data: any) {
    return this.categoryDelegate.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.maxLimit !== undefined && { maxLimit: data.maxLimit }),
        ...(data.requireReceipt !== undefined && { requireReceipt: data.requireReceipt }),
        ...(data.isTaxable !== undefined && { isTaxable: data.isTaxable }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  // --- Claim Number Generation ---
  private async generateClaimNumber(tx: any, companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `EXP-${year}-`;
    
    const lastClaim = await tx.expenseClaim.findFirst({
      where: { companyId, claimNumber: { startsWith: prefix } },
      orderBy: { claimNumber: 'desc' },
      select: { claimNumber: true },
    });

    let nextNum = 1;
    if (lastClaim && lastClaim.claimNumber) {
      const parts = lastClaim.claimNumber.split('-');
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextNum = parsed + 1;
      }
    }

    return `${prefix}${String(nextNum).padStart(6, '0')}`;
  }

  // --- Claim Queries ---
  async findTenantClaims(
    companyId: string,
    options?: { fiscalYearId?: string; employeeId?: string; status?: ExpenseClaimStatus; paymentStatus?: ExpensePaymentStatus; page?: number; limit?: number },
  ): Promise<PaginatedResponse<any>> {
    const rawPage = Number(options?.page);
    const page = !isNaN(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const rawLimit = Number(options?.limit);
    const limit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 50;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (options?.fiscalYearId) where.fiscalYearId = options.fiscalYearId;
    if (options?.employeeId) where.employeeId = options.employeeId;
    if (options?.status) where.status = options.status;
    if (options?.paymentStatus) where.paymentStatus = options.paymentStatus;

    const [total, data] = await Promise.all([
      this.claimDelegate.count({ where }),
      this.claimDelegate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          items: {
            include: {
              category: true,
              receiptDocument: true,
            },
          },
          fiscalYear: true,
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              department: true,
            },
          },
        },
      }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }

  async findByIdAndTenant(id: string, companyId: string) {
    return this.claimDelegate.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: {
            category: true,
            receiptDocument: true,
          },
        },
        fiscalYear: true,
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
      },
    });
  }

  // --- Payroll Integration Queries ---
  async findUnpaidPayrollClaims(companyId: string, employeeId: string) {
    return this.claimDelegate.findMany({
      where: {
        companyId,
        employeeId,
        status: { in: ['APPROVED', 'PAYABLE'] },
        paymentStatus: 'UNPAID',
        paymentMethod: 'PAYROLL',
      },
      include: {
        items: {
          include: { category: true },
        },
      },
    });
  }

  async markClaimsPaidByPayroll(claimIds: string[], companyId: string, payrollId: string, tx?: any) {
    if (!claimIds || claimIds.length === 0) return { count: 0 };
    const delegate = tx ? (tx as any).expenseClaim : this.claimDelegate;

    return delegate.updateMany({
      where: {
        id: { in: claimIds },
        companyId,
        paymentStatus: 'UNPAID',
      },
      data: {
        status: 'PAID',
        paymentStatus: 'PAID',
        paymentMethod: 'PAYROLL',
        paymentReference: `PAYROLL-${payrollId}`,
        paidAt: new Date(),
      },
    });
  }

  // --- Claim Mutations ---
  async createClaim(data: {
    companyId: string;
    employeeId: string;
    fiscalYearId: string;
    title: string;
    description?: string;
    items: Array<{
      categoryId: string;
      amount: number;
      expenseDate: Date;
      merchant?: string;
      description?: string;
      receiptDocumentId?: string;
      remarks?: string;
      taxTreatment?: ExpenseTaxTreatment;
    }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const claimDelegate = (tx as any).expenseClaim;
      const claimNumber = await this.generateClaimNumber(tx, data.companyId);

      const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);

      const created = await claimDelegate.create({
        data: {
          companyId: data.companyId,
          employeeId: data.employeeId,
          fiscalYearId: data.fiscalYearId,
          claimNumber,
          title: data.title,
          description: data.description || null,
          status: 'DRAFT',
          paymentStatus: 'UNPAID',
          totalAmount,
          approvedAmount: 0,
          paidAmount: 0,
          taxableAmount: 0,
          nonTaxableAmount: 0,
          items: {
            create: data.items.map((item) => ({
              categoryId: item.categoryId,
              amount: item.amount,
              approvedAmount: 0,
              expenseDate: item.expenseDate,
              merchant: item.merchant || null,
              description: item.description || null,
              receiptDocumentId: item.receiptDocumentId || null,
              remarks: item.remarks || null,
              taxTreatment: item.taxTreatment || 'NON_TAXABLE',
            })),
          },
        },
        include: {
          items: {
            include: {
              category: true,
              receiptDocument: true,
            },
          },
          fiscalYear: true,
        },
      });

      return created;
    });
  }

  async updateClaimDraft(
    id: string,
    companyId: string,
    data: {
      title?: string;
      description?: string;
      items?: Array<{
        categoryId: string;
        amount: number;
        expenseDate: Date;
        merchant?: string;
        description?: string;
        receiptDocumentId?: string;
        remarks?: string;
        taxTreatment?: ExpenseTaxTreatment;
      }>;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const claimDelegate = (tx as any).expenseClaim;
      const itemDelegate = (tx as any).expenseClaimItem;

      if (data.items) {
        await itemDelegate.deleteMany({ where: { claimId: id } });

        const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);

        await claimDelegate.update({
          where: { id },
          data: {
            title: data.title,
            description: data.description,
            totalAmount,
            items: {
              create: data.items.map((item) => ({
                categoryId: item.categoryId,
                amount: item.amount,
                approvedAmount: 0,
                expenseDate: item.expenseDate,
                merchant: item.merchant || null,
                description: item.description || null,
                receiptDocumentId: item.receiptDocumentId || null,
                remarks: item.remarks || null,
                taxTreatment: item.taxTreatment || 'NON_TAXABLE',
              })),
            },
          },
        });
      } else {
        await claimDelegate.update({
          where: { id },
          data: {
            ...(data.title && { title: data.title }),
            ...(data.description !== undefined && { description: data.description }),
          },
        });
      }

      return this.findByIdAndTenant(id, companyId);
    });
  }

  async submitClaim(id: string, companyId: string) {
    return this.claimDelegate.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      include: {
        items: true,
        fiscalYear: true,
      },
    });
  }

  async reviewClaim(
    id: string,
    companyId: string,
    reviewerId: string,
    decision: 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUIRED',
    remarks?: string,
    itemApprovals?: Array<{ itemId: string; approvedAmount: number; taxTreatment?: ExpenseTaxTreatment; remarks?: string }>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const claimDelegate = (tx as any).expenseClaim;
      const itemDelegate = (tx as any).expenseClaimItem;

      let approvedAmount = 0;
      let taxableAmount = 0;
      let nonTaxableAmount = 0;

      if (decision === 'APPROVED' && itemApprovals && itemApprovals.length > 0) {
        for (const app of itemApprovals) {
          const item = await itemDelegate.findUnique({ where: { id: app.itemId } });
          if (item) {
            const finalAppAmt = Math.min(app.approvedAmount, item.amount);
            const treatment = app.taxTreatment || item.taxTreatment || 'NON_TAXABLE';

            await itemDelegate.update({
              where: { id: app.itemId },
              data: {
                approvedAmount: finalAppAmt,
                taxTreatment: treatment,
                remarks: app.remarks || null,
              },
            });

            approvedAmount += finalAppAmt;
            if (treatment === 'TAXABLE') {
              taxableAmount += finalAppAmt;
            } else {
              nonTaxableAmount += finalAppAmt;
            }
          }
        }
      } else if (decision === 'APPROVED') {
        const existingItems = await itemDelegate.findMany({ where: { claimId: id } });
        for (const item of existingItems) {
          await itemDelegate.update({
            where: { id: item.id },
            data: { approvedAmount: item.amount },
          });
          approvedAmount += item.amount;
          if (item.taxTreatment === 'TAXABLE') {
            taxableAmount += item.amount;
          } else {
            nonTaxableAmount += item.amount;
          }
        }
      } else {
        await itemDelegate.updateMany({
          where: { claimId: id },
          data: { approvedAmount: 0 },
        });
      }

      const updated = await claimDelegate.update({
        where: { id },
        data: {
          status: decision === 'APPROVED' ? 'PAYABLE' : decision,
          approvedAmount,
          taxableAmount,
          nonTaxableAmount,
          remarks: remarks || null,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          ...(decision === 'APPROVED' && { approvedAt: new Date(), payableAt: new Date() }),
        },
        include: {
          items: {
            include: { category: true, receiptDocument: true },
          },
          fiscalYear: true,
          employee: true,
        },
      });

      return updated;
    });
  }

  async payClaim(
    id: string,
    companyId: string,
    paymentMethod: ExpensePaymentMethod,
    paymentReference?: string,
    remarks?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const claimDelegate = (tx as any).expenseClaim;

      const claim = await claimDelegate.findFirst({
        where: { id, companyId },
      });

      if (!claim) {
        throw new Error('Expense claim not found or access denied');
      }

      if (claim.status !== 'APPROVED' && claim.status !== 'PAYABLE') {
        throw new Error(`Expense claim in ${claim.status} status cannot be paid out`);
      }

      // ATOMIC CONDITIONAL UPDATE GUARD (P1-02 FIX)
      const result = await claimDelegate.updateMany({
        where: {
          id,
          companyId,
          paymentStatus: 'UNPAID',
          status: { in: ['APPROVED', 'PAYABLE'] },
        },
        data: {
          status: 'PAID',
          paymentStatus: 'PAID',
          paidAmount: claim.approvedAmount,
          paymentMethod,
          paymentReference: paymentReference || null,
          remarks: remarks || claim.remarks,
          paidAt: new Date(),
        },
      });

      if (result.count !== 1) {
        throw new Error('Expense claim is already paid, processing, or no longer payable.');
      }

      return this.findByIdAndTenant(id, companyId);
    });
  }
}
