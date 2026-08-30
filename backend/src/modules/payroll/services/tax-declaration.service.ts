import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { TaxDeclarationRepository, TaxDeclarationStatus, TaxRegime } from '../repositories/tax-declaration.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantScope } from '../../../common/tenant/tenant-scope.interface';
import { CreateTaxDeclarationDto, AuditTaxDeclarationDto } from '../dto/tax-declaration.dto';

import { TaxCalculationService } from './tax-calculation.service';

@Injectable()
export class TaxDeclarationService {
  constructor(
    private readonly taxDeclarationRepository: TaxDeclarationRepository,
    private readonly prisma: PrismaService,
    private readonly taxCalculationService: TaxCalculationService,
  ) {}

  private async assertFiscalYearNotLocked(fiscalYearId: string, companyId: string) {
    const fy = await (this.prisma as any).fiscalYear.findFirst({
      where: { id: fiscalYearId, companyId, deletedAt: null },
    });
    if (!fy) {
      throw new NotFoundException(`Fiscal Year record not found or access denied`);
    }
    if (fy.status === 'CLOSED' || fy.isLocked) {
      throw new BadRequestException(`Fiscal year period '${fy.name}' is closed/locked. Tax declarations cannot be created or modified.`);
    }
    return fy;
  }

  async getMyDeclaration(user: any, scope: TenantScope, fiscalYearId?: string) {
    const employeeId = user.employee?.id;
    if (!employeeId) {
      throw new BadRequestException('Employee record not linked to authenticated user.');
    }
    const companyId = scope.companyId;

    let targetFyId = fiscalYearId;
    if (!targetFyId) {
      const activeFy = await (this.prisma as any).fiscalYear.findFirst({
        where: { companyId, status: 'ACTIVE', deletedAt: null },
      });
      targetFyId = activeFy?.id;
    }

    if (!targetFyId) {
      return null;
    }

    return this.taxDeclarationRepository.findByEmployeeAndFiscalYear(companyId, employeeId, targetFyId);
  }

  async createMyDeclaration(user: any, scope: TenantScope, dto: CreateTaxDeclarationDto) {
    const employeeId = user.employee?.id;
    if (!employeeId) {
      throw new BadRequestException('Employee record not linked to authenticated user.');
    }
    const companyId = scope.companyId;

    await this.assertFiscalYearNotLocked(dto.fiscalYearId, companyId);

    const existing = await this.taxDeclarationRepository.findByEmployeeAndFiscalYear(
      companyId,
      employeeId,
      dto.fiscalYearId,
    );

    if (existing) {
      throw new ConflictException(`A tax declaration for this fiscal year already exists. Please update your existing declaration.`);
    }

    const created = await this.taxDeclarationRepository.create({
      companyId,
      employeeId,
      fiscalYearId: dto.fiscalYearId,
      regime: dto.regime as TaxRegime,
      items: dto.items,
    });

    // Audit log
    try {
      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || user?.email || 'Employee',
          actorId: user?.id || 'system',
          actorRole: user?.role || 'Employee',
          entityType: 'PAYROLL' as any,
          action: 'TAX_DECLARATION_CREATED',
          details: `[TAX_DECLARATION_CREATED] Created draft tax declaration (${dto.regime} Regime) for employee ID: ${employeeId}`,
          companyId,
        },
      });
    } catch (auditErr) {
      // non-blocking
    }

    return created;
  }

  async updateMyDeclaration(user: any, scope: TenantScope, dto: Partial<CreateTaxDeclarationDto>) {
    const employeeId = user.employee?.id;
    if (!employeeId) {
      throw new BadRequestException('Employee record not linked to authenticated user.');
    }
    const companyId = scope.companyId;

    if (!dto.fiscalYearId) {
      throw new BadRequestException('fiscalYearId is required to locate target declaration');
    }

    await this.assertFiscalYearNotLocked(dto.fiscalYearId, companyId);

    const existing = await this.taxDeclarationRepository.findByEmployeeAndFiscalYear(
      companyId,
      employeeId,
      dto.fiscalYearId,
    );

    if (!existing) {
      throw new NotFoundException('Tax declaration record not found for this fiscal year');
    }

    if (existing.status === 'APPROVED' || existing.status === 'CLOSED' as any) {
      throw new BadRequestException(`Cannot update declaration in ${existing.status} status.`);
    }

    const updated = await this.taxDeclarationRepository.updateDraft(existing.id, companyId, {
      regime: dto.regime as TaxRegime,
      items: dto.items,
    });

    return updated;
  }

  async submitMyDeclaration(user: any, scope: TenantScope, fiscalYearId: string) {
    const employeeId = user.employee?.id;
    if (!employeeId) {
      throw new BadRequestException('Employee record not linked to authenticated user.');
    }
    const companyId = scope.companyId;

    await this.assertFiscalYearNotLocked(fiscalYearId, companyId);

    const existing = await this.taxDeclarationRepository.findByEmployeeAndFiscalYear(
      companyId,
      employeeId,
      fiscalYearId,
    );

    if (!existing) {
      throw new NotFoundException('Tax declaration record not found');
    }

    if (existing.status === 'SUBMITTED' || existing.status === 'APPROVED') {
      throw new BadRequestException(`Declaration is already ${existing.status}`);
    }

    const submitted = await this.taxDeclarationRepository.submit(existing.id, companyId);

    // Audit log
    try {
      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || user?.email || 'Employee',
          actorId: user?.id || 'system',
          actorRole: user?.role || 'Employee',
          entityType: 'PAYROLL' as any,
          action: 'TAX_DECLARATION_SUBMITTED',
          details: `[TAX_DECLARATION_SUBMITTED] Submitted tax declaration for review (ID: ${existing.id})`,
          companyId,
        },
      });
    } catch (auditErr) {
      // non-blocking
    }

    return submitted;
  }

  async findTenantDeclarations(
    scope: TenantScope,
    options?: { fiscalYearId?: string; status?: TaxDeclarationStatus; page?: number; limit?: number },
  ) {
    return this.taxDeclarationRepository.findTenantDeclarations(scope.companyId, options);
  }

  async getDeclarationById(id: string, scope: TenantScope) {
    const item = await this.taxDeclarationRepository.findByIdAndTenant(id, scope.companyId);
    if (!item) {
      throw new NotFoundException(`Tax declaration ID "${id}" not found or access denied`);
    }
    return item;
  }

  async auditDeclaration(id: string, scope: TenantScope, user: any, dto: AuditTaxDeclarationDto) {
    const companyId = scope.companyId;
    const existing = await this.getDeclarationById(id, scope);

    await this.assertFiscalYearNotLocked(existing.fiscalYearId, companyId);

    if (existing.status !== 'SUBMITTED' && existing.status !== 'UNDER_REVIEW') {
      throw new BadRequestException(`Declaration status '${existing.status}' cannot be audited. Must be SUBMITTED or UNDER_REVIEW.`);
    }

    const cappedApprovals = dto.itemApprovals?.map((app) => {
      const item = existing.items?.find((i: any) => i.id === app.itemId);
      const capped = item ? this.taxCalculationService.capSectionAmount(item.section, app.approvedAmount) : app.approvedAmount;
      return { ...app, approvedAmount: capped };
    });

    const audited = await this.taxDeclarationRepository.auditDecision(
      id,
      companyId,
      user?.id || 'auditor',
      dto.decision,
      dto.remarks,
      cappedApprovals,
    );

    // Audit log
    try {
      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || user?.email || 'Auditor',
          actorId: user?.id || 'system',
          actorRole: user?.role || 'HRAdmin',
          entityType: 'PAYROLL' as any,
          action: `TAX_DECLARATION_${dto.decision}`,
          details: `[TAX_DECLARATION_${dto.decision}] Audit decision '${dto.decision}' for declaration ID: ${id}. Approved Total: ₹${audited.totalApproved}`,
          companyId,
        },
      });
    } catch (auditErr) {
      // non-blocking
    }

    return audited;
  }
}
