import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ExpenseClaimRepository } from '../repositories/expense-claim.repository';
import { ExpensePolicyService } from './expense-policy.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantScope } from '../../../common/tenant/tenant-scope.interface';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
  CreateExpenseClaimDto,
  UpdateExpenseClaimDto,
  ReviewExpenseClaimDto,
  PayExpenseClaimDto,
  ExpenseClaimStatus,
  ExpensePaymentStatus,
} from '../dto/expense-claim.dto';

@Injectable()
export class ExpenseClaimService {
  constructor(
    private readonly expenseClaimRepository: ExpenseClaimRepository,
    private readonly expensePolicyService: ExpensePolicyService,
    private readonly prisma: PrismaService,
  ) {}

  private async assertFiscalYearNotLocked(fiscalYearId: string, companyId: string) {
    const fy = await (this.prisma as any).fiscalYear.findFirst({
      where: { id: fiscalYearId, companyId, deletedAt: null },
    });
    if (!fy) {
      throw new NotFoundException(`Fiscal Year record not found or access denied`);
    }
    if (fy.status === 'CLOSED' || fy.isLocked) {
      throw new BadRequestException(`Fiscal year period '${fy.name}' is closed/locked. Expense claims cannot be modified.`);
    }
    return fy;
  }

  // --- Category Management ---
  async getCategories(scope: TenantScope, activeOnly = false) {
    return this.expenseClaimRepository.findTenantCategories(scope.companyId, activeOnly);
  }

  async createCategory(scope: TenantScope, dto: CreateExpenseCategoryDto) {
    const companyId = scope.companyId;
    const existing = await this.expenseClaimRepository.findCategoryByCodeAndTenant(dto.code, companyId);
    if (existing) {
      throw new ConflictException(`Expense category code '${dto.code}' already exists for this tenant.`);
    }
    return this.expenseClaimRepository.createCategory(companyId, dto);
  }

  async updateCategory(id: string, scope: TenantScope, dto: UpdateExpenseCategoryDto) {
    const companyId = scope.companyId;
    const existing = await this.expenseClaimRepository.findCategoryByIdAndTenant(id, companyId);
    if (!existing) {
      throw new NotFoundException(`Category ID '${id}' not found`);
    }
    return this.expenseClaimRepository.updateCategory(id, companyId, dto);
  }

  // --- Self-Service Employee Claims ---
  async getMyClaims(user: any, scope: TenantScope, fiscalYearId?: string) {
    const employeeId = user.employee?.id;
    if (!employeeId) {
      throw new BadRequestException('Employee record not linked to authenticated user.');
    }
    return this.expenseClaimRepository.findTenantClaims(scope.companyId, {
      employeeId,
      fiscalYearId,
    });
  }

  async createMyClaim(user: any, scope: TenantScope, dto: CreateExpenseClaimDto) {
    const employeeId = user.employee?.id;
    if (!employeeId) {
      throw new BadRequestException('Employee record not linked to authenticated user.');
    }
    const companyId = scope.companyId;

    await this.assertFiscalYearNotLocked(dto.fiscalYearId, companyId);

    const validatedItems = await this.expensePolicyService.validateAndEnforceCategoryPolicy(
      companyId,
      dto.items.map((i) => ({
        categoryId: i.categoryId,
        amount: i.amount,
        receiptDocumentId: i.receiptDocumentId,
      })),
      employeeId,
    );

    const fullItems = dto.items.map((item, idx) => ({
      ...item,
      expenseDate: new Date(item.expenseDate),
      taxTreatment: validatedItems[idx].taxTreatment,
    }));

    const created = await this.expenseClaimRepository.createClaim({
      companyId,
      employeeId,
      fiscalYearId: dto.fiscalYearId,
      title: dto.title,
      description: dto.description,
      items: fullItems,
    });

    // Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || user?.email || 'Employee',
          actorId: user?.id || 'system',
          actorRole: user?.role || 'Employee',
          entityType: 'PAYROLL' as any,
          action: 'EXPENSE_CLAIM_CREATED',
          details: `[EXPENSE_CLAIM_CREATED] Created claim ${created.claimNumber} (Total: ₹${created.totalAmount})`,
          companyId,
        },
      });
    } catch (e) {}

    return created;
  }

  async updateMyClaimDraft(user: any, scope: TenantScope, id: string, dto: UpdateExpenseClaimDto) {
    const employeeId = user.employee?.id;
    if (!employeeId) {
      throw new BadRequestException('Employee record not linked to authenticated user.');
    }
    const companyId = scope.companyId;

    const existing = await this.expenseClaimRepository.findByIdAndTenant(id, companyId);
    if (!existing || existing.employeeId !== employeeId) {
      throw new NotFoundException('Expense claim not found or access denied');
    }

    if (existing.status !== 'DRAFT' && existing.status !== 'CORRECTION_REQUIRED') {
      throw new BadRequestException(`Cannot update claim in ${existing.status} status.`);
    }

    await this.assertFiscalYearNotLocked(existing.fiscalYearId, companyId);

    let fullItems;
    if (dto.items) {
      const validatedItems = await this.expensePolicyService.validateAndEnforceCategoryPolicy(
        companyId,
        dto.items.map((i) => ({
          categoryId: i.categoryId,
          amount: i.amount,
          receiptDocumentId: i.receiptDocumentId,
        })),
        employeeId,
      );

      fullItems = dto.items.map((item, idx) => ({
        ...item,
        expenseDate: new Date(item.expenseDate),
        taxTreatment: validatedItems[idx].taxTreatment,
      }));
    }

    return this.expenseClaimRepository.updateClaimDraft(id, companyId, {
      title: dto.title,
      description: dto.description,
      items: fullItems,
    });
  }

  async submitMyClaim(user: any, scope: TenantScope, id: string) {
    const employeeId = user.employee?.id;
    if (!employeeId) {
      throw new BadRequestException('Employee record not linked to authenticated user.');
    }
    const companyId = scope.companyId;

    const existing = await this.expenseClaimRepository.findByIdAndTenant(id, companyId);
    if (!existing || existing.employeeId !== employeeId) {
      throw new NotFoundException('Expense claim not found or access denied');
    }

    if (existing.status === 'SUBMITTED' || existing.status === 'APPROVED' || existing.status === 'PAYABLE' || existing.status === 'PAID') {
      throw new BadRequestException(`Expense claim is already ${existing.status}`);
    }

    await this.assertFiscalYearNotLocked(existing.fiscalYearId, companyId);

    const submitted = await this.expenseClaimRepository.submitClaim(id, companyId);

    try {
      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || user?.email || 'Employee',
          actorId: user?.id || 'system',
          actorRole: user?.role || 'Employee',
          entityType: 'PAYROLL' as any,
          action: 'EXPENSE_CLAIM_SUBMITTED',
          details: `[EXPENSE_CLAIM_SUBMITTED] Submitted claim ${existing.claimNumber} for review`,
          companyId,
        },
      });
    } catch (e) {}

    return submitted;
  }

  // --- Accountant Audit & Management ---
  async getTenantClaims(
    scope: TenantScope,
    options?: { fiscalYearId?: string; employeeId?: string; status?: ExpenseClaimStatus; paymentStatus?: ExpensePaymentStatus; page?: number; limit?: number },
  ) {
    return this.expenseClaimRepository.findTenantClaims(scope.companyId, options);
  }

  async getClaimById(id: string, scope: TenantScope) {
    const item = await this.expenseClaimRepository.findByIdAndTenant(id, scope.companyId);
    if (!item) {
      throw new NotFoundException(`Expense claim ID "${id}" not found or access denied`);
    }
    return item;
  }

  async reviewClaim(id: string, scope: TenantScope, user: any, dto: ReviewExpenseClaimDto) {
    const companyId = scope.companyId;
    const existing = await this.getClaimById(id, scope);

    // P2-1 Remediation: A user MUST NOT approve, reject, or review their own expense claim
    if (user?.employee?.id && user.employee.id === existing.employeeId) {
      throw new ForbiddenException('You cannot approve or reject your own expense claim.');
    }

    await this.assertFiscalYearNotLocked(existing.fiscalYearId, companyId);

    if (existing.status !== 'SUBMITTED' && existing.status !== 'UNDER_REVIEW') {
      throw new BadRequestException(`Claim status '${existing.status}' cannot be audited. Must be SUBMITTED or UNDER_REVIEW.`);
    }

    const reviewed = await this.expenseClaimRepository.reviewClaim(
      id,
      companyId,
      user?.id || 'auditor',
      dto.decision,
      dto.remarks,
      dto.itemApprovals,
    );

    try {
      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || user?.email || 'Auditor',
          actorId: user?.id || 'system',
          actorRole: user?.role || 'HRAdmin',
          entityType: 'PAYROLL' as any,
          action: `EXPENSE_CLAIM_${dto.decision}`,
          details: `[EXPENSE_CLAIM_${dto.decision}] Review decision '${dto.decision}' for claim ${existing.claimNumber}. Approved Amount: ₹${reviewed.approvedAmount}`,
          companyId,
        },
      });
    } catch (e) {}

    return reviewed;
  }

  async payClaim(id: string, scope: TenantScope, user: any, dto: PayExpenseClaimDto) {
    const companyId = scope.companyId;
    const existing = await this.getClaimById(id, scope);

    await this.assertFiscalYearNotLocked(existing.fiscalYearId, companyId);

    if (existing.status !== 'PAYABLE' && existing.status !== 'APPROVED') {
      throw new BadRequestException(`Claim status '${existing.status}' is not eligible for payout. Must be APPROVED or PAYABLE.`);
    }

    if (existing.paymentStatus === 'PAID') {
      throw new ConflictException(`Expense claim ${existing.claimNumber} is already marked as PAID.`);
    }

    const paid = await this.expenseClaimRepository.payClaim(
      id,
      companyId,
      dto.paymentMethod,
      dto.paymentReference,
      dto.remarks,
    );

    try {
      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || user?.email || 'Accountant',
          actorId: user?.id || 'system',
          actorRole: user?.role || 'Accountant',
          entityType: 'PAYROLL' as any,
          action: 'EXPENSE_CLAIM_PAID',
          details: `[EXPENSE_CLAIM_PAID] Paid out claim ${existing.claimNumber} via ${dto.paymentMethod} (Ref: ${dto.paymentReference || 'N/A'}). Paid Amount: ₹${paid.paidAmount}`,
          companyId,
        },
      });
    } catch (e) {}

    return paid;
  }
}
