import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CanonicalJobContext } from '../../../common/queue/canonical-job-context.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import { PayrollRepository } from '../repositories/payroll.repository';
import { PayrollEngineService } from './payroll-engine.service';
import { BatchProcessPayrollDto } from '../dto/batch-process-payroll.dto';
import { GeneratePayrollDto } from '../dto/generate-payroll.dto';
import { MarkPayrollPaidDto } from '../dto/mark-payroll-paid.dto';
import { UpdatePayrollInputDto } from '../dto/payroll-input.dto';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import { StatutoryRulesService } from './statutory-rules.service';
import { AttendanceMatrixService } from '../../attendance/services/attendance-matrix.service';
import { SalaryComponentCalculatorService } from './salary-component-calculator.service';
import { TaxCalculationService } from './tax-calculation.service';
import { ExpenseClaimRepository } from '../repositories/expense-claim.repository';
import { LopPolicyService } from './lop-policy.service';

export function resolveEffectiveExitDate(emp: any): Date | string | null {
  const latestExit = emp?.exits?.[0];
  if (latestExit) {
    if (latestExit.approvedLastWorkingDay) {
      return latestExit.approvedLastWorkingDay;
    }
    if (
      latestExit.proposedLastWorkingDay &&
      (latestExit.status === 'COMPLETED' || latestExit.status === 'APPROVED')
    ) {
      return latestExit.proposedLastWorkingDay;
    }
  }
  return emp?.deletedAt || null;
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payrollRepository: PayrollRepository,
    private readonly payrollEngine: PayrollEngineService,
    private readonly auditLogger: AuditLoggerService,
    private readonly statutoryRulesService: StatutoryRulesService,
    private readonly attendanceMatrixService: AttendanceMatrixService,
    private readonly taxCalculationService: TaxCalculationService,
    private readonly expenseClaimRepository: ExpenseClaimRepository,
    private readonly lopPolicyService: LopPolicyService,
  ) {}

  async findAll(
    currentUser: any,
    month?: string,
    employeeId?: string,
    optionsParam?: { page?: number; limit?: number },
  ) {
    const companyId = this.getTenantId(currentUser);
    return this.payrollRepository.findMany({
      companyId,
      month,
      employeeId,
      page: optionsParam?.page,
      limit: optionsParam?.limit,
    });
  }

  private getPeriodLockKey(month: string, tenantId?: string | null): string {
    const scope = tenantId && tenantId !== 'PLATFORM' ? `${tenantId}_` : '';
    return `payroll_period_lock_${scope}${month.toLowerCase().replace(/\s+/g, '_')}`;
  }

  async getPeriodStatus(month: string, tenantId?: string | null): Promise<string> {
    const lockKey = this.getPeriodLockKey(month, tenantId);
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: lockKey },
    });
    return config ? config.value : 'OPEN';
  }

  async assertPeriodNotLocked(month: string, tenantId?: string | null) {
    const status = await this.getPeriodStatus(month, tenantId);
    if (status === 'LOCKED') {
      throw new BadRequestException(`Payroll period for ${month} is locked.`);
    }
  }

  async calculate(currentUser: any, dto: BatchProcessPayrollDto) {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin';
    const companyId = isSuperAdmin
      ? dto.companyId || null
      : currentUser?.companyId !== 'PLATFORM'
      ? currentUser?.companyId
      : null;

    const employees = await this.prisma.employee.findMany({
      where: {
        status: 'Active',
        deletedAt: null,
        ...(companyId ? { companyId } : {}),
      },
      include: {
        exits: {
          where: {
            ...(companyId ? { companyId } : {}),
            status: { in: ['APPROVED', 'COMPLETED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (dto.adjustments && typeof dto.adjustments === 'object') {
      const validEmpIds = new Set(employees.map((e) => e.id));
      for (const adjEmpId of Object.keys(dto.adjustments)) {
        if (!validEmpIds.has(adjEmpId)) {
          throw new BadRequestException(
            `Adjustment provided for invalid or unauthorized employee ID "${adjEmpId}".`,
          );
        }
      }
    }

    const attendanceSettings = companyId && companyId !== 'PLATFORM'
      ? await (this.prisma as any).attendanceSetting.findFirst({
          where: { companyId },
        })
      : null;

    // Generate unified attendance matrix (incorporates holidays, weekends, leave requests, attendance)
    const matrix = await this.attendanceMatrixService.getMatrix(
      dto.month,
      'All',
      undefined,
      currentUser,
    );

    // Cache/Load statutory rules once per batch run
    const statRules = await this.statutoryRulesService.getStatutoryRules();

    // Resolve active Fiscal Year for tenant
    const activeFy = await (this.prisma as any).fiscalYear.findFirst({
      where: { companyId, status: 'ACTIVE', deletedAt: null },
    });
    const activeFyId = activeFy?.id || '';

    // Pre-fetch persistent PayrollInput records for the target company and month
    const persistedInputs = await (this.prisma as any).payrollInput.findMany({
      where: {
        month: dto.month,
        ...(companyId && companyId !== 'PLATFORM' ? { companyId } : {}),
      },
    });
    const persistedInputMap = new Map<string, any>(persistedInputs.map((p: any) => [p.employeeId, p]));

    const results: any[] = [];

    for (const emp of employees) {
      const explicitAdj = dto.adjustments?.[emp.id];
      const persistedInput: any = persistedInputMap.get(emp.id);

      const adj = explicitAdj
        ? explicitAdj
        : persistedInput
        ? {
            LOPDays: persistedInput.lopDays,
            overtimeHours: persistedInput.overtimeHours,
            bonus: persistedInput.bonus,
            deductions: persistedInput.deductions,
            ptOverride: 0,
            remarks: persistedInput.remarks || '',
          }
        : {
            LOPDays: 0,
            overtimeHours: 0,
            bonus: 0,
            deductions: 0,
            ptOverride: 0,
            remarks: '',
          };

      // Query unpaid claims designated for PAYROLL payout for this employee
      let nonTaxableReimbursement = 0;
      let taxableReimbursement = 0;
      if (companyId && companyId !== 'PLATFORM') {
        const unpaidClaims = await this.expenseClaimRepository.findUnpaidPayrollClaims(
          companyId,
          emp.id,
        );
        for (const claim of unpaidClaims) {
          nonTaxableReimbursement += claim.nonTaxableAmount || 0;
          taxableReimbursement += claim.taxableAmount || 0;
        }
      }

      // Retrieve the derived attendance summary from the unified matrix
      let attendanceSummary;
      try {
        const matrixRow = matrix.records.find(
          (r: any) => r.employeeId === emp.id,
        );
        if (!matrixRow || !matrixRow.summary) {
          throw new BadRequestException(
            `Could not generate attendance summary for ${emp.name}`,
          );
        }

        // Map matrix summary to the format expected by Payroll Engine
        const totalDaysInMonth = matrix.daysInMonth;
        attendanceSummary = {
          workingDays: totalDaysInMonth - matrixRow.summary.weekend,
          presentDays: matrixRow.summary.present + matrixRow.summary.late,
          halfDays: matrixRow.summary.halfDay,
          absentDays: matrixRow.summary.absent,
          lopDays: matrixRow.summary.lopDays,
        };
      } catch (err: any) {
        throw new BadRequestException(err.message);
      }

      // Calculate authoritative monthly TDS using active FiscalYear, TaxDeclaration, and taxable reimbursements
      let taxBreakdown;
      if (activeFyId) {
        taxBreakdown = await this.taxCalculationService.computeEmployeeMonthlyTds(
          companyId,
          emp.id,
          activeFyId,
          emp.salary + taxableReimbursement,
          dto.month,
        );
        if ((adj as any).tdsOverride === undefined) {
          (adj as any).tdsOverride = taxBreakdown.monthlyTdsDeduction;
        }
      }

      const lopPolicy = await this.lopPolicyService.resolvePolicy(
        companyId,
        dto.month,
        attendanceSummary,
      );

      const payrollInput = {
        ...adj,
        nonTaxableReimbursement,
      };

      const exitDate = resolveEffectiveExitDate(emp);
      const calc = this.payrollEngine.calculateEmployeePayroll(
        emp,
        attendanceSummary,
        payrollInput,
        statRules,
        [],
        attendanceSettings,
        lopPolicy,
        dto.month,
        exitDate,
      );

      const warnings: string[] = [];
      if (!emp.pan) {
        warnings.push(`Missing PAN for ${emp.name}. TDS returns will fail.`);
      }
      if (!emp.uan) {
        warnings.push(`Missing UAN for ${emp.name}. EPF filing will fail.`);
      }
      if (calc.net < 0) {
        warnings.push(`Negative net salary for ${emp.name}.`);
      }

      results.push({
        id: `SLIP-${emp.id}-${dto.month.replace(/\s+/g, '-')}`,
        employeeId: emp.id,
        employeeName: emp.name,
        month: dto.month,
        fixedBaseSalary: calc.fixedBaseSalary,
        basicSalary: calc.basicSalary,
        gross: calc.gross,
        deductions: calc.totalDeduct,
        net: calc.net,
        lopDays: calc.lopDeductDays,
        lopDeductAmount: calc.lopDeductAmount,
        prorationDays: calc.prorationDays,
        prorationDeductAmount: calc.prorationDeductAmount,
        lopDivisorMode: calc.lopDivisorMode,
        lopDivisor: calc.lopDivisor,
        calculationVersion: calc.calculationVersion,
        components: calc.components,
        warnings,
        adjustments: {
          ...adj,
          nonTaxableReimbursement,
          taxableReimbursement,
        },
        generatedAt: new Date().toISOString(),
      });
    }

    return results;
  }

  public static readonly STALE_LOCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  async claimIdempotencyKey(key: string, customStaleThresholdMs?: number): Promise<boolean> {
    const staleThresholdMs = customStaleThresholdMs ?? PayrollService.STALE_LOCK_THRESHOLD_MS;
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return true;
    } catch (err) {
      const existing = await this.prisma.idempotencyKey.findUnique({ where: { key } });
      if (!existing) {
        return false;
      }

      if (existing.status === 'COMPLETED') {
        return false;
      }

      if (existing.status === 'FAILED') {
        // Atomically reclaim FAILED key for retry
        const reclaimed = await this.prisma.idempotencyKey.updateMany({
          where: {
            key,
            status: 'FAILED',
            createdAt: existing.createdAt,
          },
          data: {
            status: 'PENDING',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        return reclaimed.count > 0;
      }

      if (existing.status === 'PENDING') {
        const ageMs = Date.now() - new Date(existing.createdAt).getTime();
        if (ageMs < staleThresholdMs) {
          throw new BadRequestException('Another payroll calculation or batch process is already in progress. Please wait.');
        }

        // Atomically reclaim stale PENDING lock
        const reclaimed = await this.prisma.idempotencyKey.updateMany({
          where: {
            key,
            status: 'PENDING',
            createdAt: existing.createdAt,
          },
          data: {
            status: 'PENDING',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });

        if (reclaimed.count > 0) {
          return true;
        }

        throw new BadRequestException('Another payroll calculation or batch process is already in progress. Please wait.');
      }

      return false;
    }
  }

  async resolveIdempotencyKey(key: string, success: boolean) {
    try {
      await this.prisma.idempotencyKey.update({
        where: { key },
        data: {
          status: success ? 'COMPLETED' : 'FAILED',
          completedAt: success ? new Date() : null,
        },
      });
    } catch (err) {
      // ignore
    }
  }

  async generateDraftBatch(dto: GeneratePayrollDto, user: any) {
    const tenantId = this.getTenantId(user);
    await this.assertPeriodNotLocked(dto.month, tenantId);

    const isSuperAdmin = user?.role === 'SuperAdmin';
    const companyId = isSuperAdmin
      ? dto.companyId || 'PLATFORM'
      : user?.companyId !== 'PLATFORM'
      ? user?.companyId || user?.subscriptionId || 'PLATFORM'
      : 'PLATFORM';

    const idempotencyKeyStr = `${companyId}_payroll_gen_${dto.month.replace(/\s+/g, '_')}`;
    const claimed = await this.claimIdempotencyKey(idempotencyKeyStr);
    if (!claimed) {
      throw new BadRequestException('Draft payroll generation for this month is already in progress or completed.');
    }

    try {
      const employees = await this.prisma.employee.findMany({
        where: {
          status: 'Active',
          deletedAt: null,
          ...(companyId && companyId !== 'PLATFORM' ? { companyId } : {}),
        },
        include: {
          exits: {
            where: {
              ...(companyId && companyId !== 'PLATFORM' ? { companyId } : {}),
              status: { in: ['APPROVED', 'COMPLETED'] },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (dto.adjustments && typeof dto.adjustments === 'object') {
        const validEmpIds = new Set(employees.map((e) => e.id));
        for (const adjEmpId of Object.keys(dto.adjustments)) {
          if (!validEmpIds.has(adjEmpId)) {
            throw new BadRequestException(
              `Adjustment provided for invalid or unauthorized employee ID "${adjEmpId}".`,
            );
          }
        }
      }

      const attendanceSettings = companyId && companyId !== 'PLATFORM'
        ? await (this.prisma as any).attendanceSetting.findFirst({
            where: { companyId },
          })
        : null;

      // Generate unified attendance matrix (incorporates holidays, weekends, leave requests, attendance)
      const matrix = await this.attendanceMatrixService.getMatrix(
        dto.month,
        'All',
        undefined,
        user,
      );

      // Cache/Load statutory rules once per batch run
      const statRules = await this.statutoryRulesService.getStatutoryRules();

      // Resolve active Fiscal Year for tenant
      const activeFy = await (this.prisma as any).fiscalYear.findFirst({
        where: { companyId, status: 'ACTIVE', deletedAt: null },
      });
      const activeFyId = activeFy?.id || '';

      // Pre-fetch persistent PayrollInput records for the target company and month
      const persistedInputs = await (this.prisma as any).payrollInput.findMany({
        where: {
          month: dto.month,
          ...(companyId && companyId !== 'PLATFORM' ? { companyId } : {}),
        },
      });
      const persistedInputMap = new Map<string, any>(persistedInputs.map((p: any) => [p.employeeId, p]));

      const draftSlips: any[] = [];
      const validationErrors: string[] = [];
      const allWarnings: string[] = [];

      for (const emp of employees) {
        const explicitAdj = dto.adjustments?.[emp.id];
        const persistedInput: any = persistedInputMap.get(emp.id);

        const adj = explicitAdj
          ? explicitAdj
          : persistedInput
          ? {
              LOPDays: persistedInput.lopDays,
              overtimeHours: persistedInput.overtimeHours,
              bonus: persistedInput.bonus,
              deductions: persistedInput.deductions,
              ptOverride: 0,
              remarks: persistedInput.remarks || '',
            }
          : {
              LOPDays: 0,
              overtimeHours: 0,
              bonus: 0,
              deductions: 0,
              ptOverride: 0,
              remarks: '',
            };

        if (adj.LOPDays !== undefined && adj.LOPDays < 0) {
          validationErrors.push(
            `Employee ${emp.name} has invalid negative LOP days override.`,
          );
        }
        if (adj.overtimeHours !== undefined && adj.overtimeHours < 0) {
          validationErrors.push(
            `Employee ${emp.name} has invalid negative overtime hours.`,
          );
        }

        // Query unpaid claims designated for PAYROLL payout for this employee
        let nonTaxableReimbursement = 0;
        let taxableReimbursement = 0;
        const empConsumedClaimIds: string[] = [];

        if (companyId && companyId !== 'PLATFORM') {
          const unpaidClaims = await this.expenseClaimRepository.findUnpaidPayrollClaims(companyId, emp.id);
          for (const claim of unpaidClaims) {
            nonTaxableReimbursement += claim.nonTaxableAmount || 0;
            taxableReimbursement += claim.taxableAmount || 0;
            empConsumedClaimIds.push(claim.id);
          }
        }

        // Retrieve the derived attendance summary from the unified matrix
        let attendanceSummary;
        try {
          const matrixRow = matrix.records.find(
            (r: any) => r.employeeId === emp.id,
          );
          if (!matrixRow || !matrixRow.summary) {
            throw new Error(
              `Could not generate attendance summary for ${emp.name}`,
            );
          }

          // Map matrix summary to the format expected by Payroll Engine
          const totalDaysInMonth = matrix.daysInMonth;
          attendanceSummary = {
            workingDays: totalDaysInMonth - matrixRow.summary.weekend,
            presentDays: matrixRow.summary.present + matrixRow.summary.late,
            halfDays: matrixRow.summary.halfDay,
            absentDays: matrixRow.summary.absent,
            lopDays: matrixRow.summary.lopDays,
          };
        } catch (err: any) {
          validationErrors.push(err.message);
          continue;
        }

        // Calculate authoritative monthly TDS using active FiscalYear, TaxDeclaration, and taxable reimbursements
        let taxBreakdown;
        if (activeFyId) {
          taxBreakdown = await this.taxCalculationService.computeEmployeeMonthlyTds(
            companyId,
            emp.id,
            activeFyId,
            emp.salary + taxableReimbursement,
            dto.month,
          );
          if ((adj as any).tdsOverride === undefined) {
            (adj as any).tdsOverride = taxBreakdown.monthlyTdsDeduction;
          }
        }

        const lopPolicy = await this.lopPolicyService.resolvePolicy(
          companyId,
          dto.month,
          attendanceSummary,
        );

        const payrollInput = {
          ...adj,
          nonTaxableReimbursement,
        };

        const exitDate = resolveEffectiveExitDate(emp);
        const calc = this.payrollEngine.calculateEmployeePayroll(
          emp,
          attendanceSummary,
          payrollInput,
          statRules,
          [],
          attendanceSettings,
          lopPolicy,
          dto.month,
          exitDate,
        );

        if (calc.net < 0) {
          validationErrors.push(
            `Employee ${emp.name} calculation results in negative net salary.`,
          );
        }

        const warnings: string[] = [];
        if (!emp.pan) {
          warnings.push(`Missing PAN for ${emp.name}. TDS returns will fail.`);
        }
        if (!emp.uan) {
          warnings.push(`Missing UAN for ${emp.name}. EPF filing will fail.`);
        }
        allWarnings.push(...warnings);

        // Prepare final snapshot adjustments containing immutable calculation rule metadata
        const snapshotAdjustments = {
          LOPDays: calc.lopDeductDays,
          overtimeHours: adj.overtimeHours || 0,
          bonus: adj.bonus || 0,
          deductions: adj.deductions || 0,
          ptOverride: adj.ptOverride || 0,
          remarks: adj.remarks || '',
          workingDays: calc.workingDays,
          presentDays: calc.presentDays,
          lopDivisorMode: calc.lopDivisorMode,
          lopDivisor: calc.lopDivisor,
          pfRate: statRules.pfRate,
          tdsRate: statRules.tdsRate,
          ptAmount: statRules.ptAmount,
          basicPercentage: statRules.basicPercentage,
          hraPercentage: statRules.hraPercentage,
          taxRegime: taxBreakdown?.regime || 'NEW',
          approvedTaxDeductions: taxBreakdown?.cappedDeductionsTotal || 0,
          annualTaxLiability: taxBreakdown?.totalAnnualTaxLiability || 0,
          tdsWithheldSoFar: taxBreakdown?.tdsWithheldSoFar || 0,
          remainingTaxLiability: taxBreakdown?.remainingTaxLiability || 0,
          nonTaxableReimbursement,
          taxableReimbursement,
          consumedClaimIds: empConsumedClaimIds,
        };

        draftSlips.push({
          employeeId: emp.id,
          month: dto.month,
          payDate: dto.payDate || null,
          fixedBaseSalary: calc.fixedBaseSalary,
          basicSalary:
            calc.components.find((c) => c.name === 'Basic Salary')?.amount ||
            calc.basicSalary,
          allowances: calc.components
            .filter((c) => c.type === 'EARNING' && c.name !== 'Basic Salary')
            .reduce((s, c) => s + c.amount, 0),
          gross: calc.gross,
          deductions: calc.totalDeduct,
          netSalary: calc.net,
          lopDays: calc.lopDeductDays,
          lopDeductAmount: calc.lopDeductAmount,
          lopDivisorMode: calc.lopDivisorMode,
          lopDivisor: calc.lopDivisor,
          status: 'DRAFT',
          warnings: JSON.stringify(warnings),
          components: calc.components,
          adjustments: snapshotAdjustments,
          calculationVersion: 2,
        });
      }

      if (validationErrors.length > 0) {
        throw new BadRequestException({
          message: 'Draft payroll generation validation failed.',
          errors: validationErrors,
        });
      }

      const existingPayrolls = await this.prisma.payroll.findMany({
        where: {
          month: dto.month,
          ...(companyId && companyId !== 'PLATFORM' ? { companyId } : {}),
        },
        select: { id: true, employeeId: true, status: true },
      });

      // If existing records are already in APPROVED, LOCKED, or PAID, reject draft regeneration
      const nonDraftRecord = existingPayrolls.find(
        (p) => p.status !== 'DRAFT' && p.status !== 'CALCULATED',
      );
      if (nonDraftRecord) {
        throw new BadRequestException(
          `Cannot regenerate draft for ${dto.month}: Existing payroll is in ${nonDraftRecord.status} status. Only DRAFT payroll can be regenerated.`,
        );
      }

      const existingMap = new Map(existingPayrolls.map((p) => [p.employeeId, p.id]));
      const toCreateData: any[] = [];
      const toUpdateEntries: { id: string; data: any }[] = [];

      for (const slip of draftSlips) {
        const existingId = existingMap.get(slip.employeeId);
        if (existingId) {
          toUpdateEntries.push({
            id: existingId,
            data: {
              payDate: slip.payDate,
              fixedBaseSalary: slip.fixedBaseSalary,
              basicSalary: slip.basicSalary,
              allowances: slip.allowances,
              gross: slip.gross,
              deductions: slip.deductions,
              netSalary: slip.netSalary,
              lopDays: slip.lopDays,
              lopDeductAmount: slip.lopDeductAmount,
              lopDivisorMode: slip.lopDivisorMode,
              lopDivisor: slip.lopDivisor,
              status: 'DRAFT',
              warnings: slip.warnings,
              components: slip.components,
              adjustments: slip.adjustments,
              calculationVersion: slip.calculationVersion,
            },
          });
        } else {
          toCreateData.push({
            ...slip,
            companyId,
          });
        }
      }

      await this.prisma.$transaction(async (tx) => {
        if (toCreateData.length > 0) {
          await tx.payroll.createMany({
            data: toCreateData,
          });
        }

        if (toUpdateEntries.length > 0) {
          await Promise.all(
            toUpdateEntries.map(({ id, data }) =>
              tx.payroll.update({
                where: { id },
                data,
              }),
            ),
          );
        }

        await tx.auditLog.create({
          data: {
            actorId: user.id || 'system',
            actorRole: user.role || 'HRAdmin',
            companyId,
            action: 'PAYROLL_DRAFT_GENERATED' as any,
            entityType: 'PAYROLL',
            details: JSON.stringify({
              companyId,
              summary: `Generated DRAFT payroll for month: ${dto.month} - total: ${employees.length} employees.`,
            }),
          },
        });
      });

      await this.resolveIdempotencyKey(idempotencyKeyStr, true);

      const totalGross = draftSlips.reduce((s, i) => s + i.gross, 0);
      const totalNet = draftSlips.reduce((s, i) => s + i.netSalary, 0);

      return {
        month: dto.month,
        status: 'DRAFT',
        count: draftSlips.length,
        totalGross,
        totalNet,
        warnings: allWarnings,
      };
    } catch (err) {
      await this.resolveIdempotencyKey(idempotencyKeyStr, false);
      throw err;
    }
  }

  async processBatch(dto: BatchProcessPayrollDto, user: any) {
    const tenantId = this.getTenantId(user);
    await this.assertPeriodNotLocked(dto.month, tenantId);

    const isSuperAdmin = user?.role === 'SuperAdmin';
    const companyId = isSuperAdmin
      ? dto.companyId || 'PLATFORM'
      : user?.companyId !== 'PLATFORM'
      ? user?.companyId || user?.subscriptionId || 'PLATFORM'
      : 'PLATFORM';

    const idempotencyKeyStr = `${companyId}_payroll_run_${dto.month.replace(/\s+/g, '_')}`;
    const claimed = await this.claimIdempotencyKey(idempotencyKeyStr);
    if (!claimed) {
      throw new BadRequestException('Payroll batch processing for this month has already been executed or completed.');
    }

    try {
      if (!dto.payDate) {
        throw new BadRequestException('payDate is required for processing.');
      }

      // Require existing DRAFT records
      const existingPayrolls = await this.prisma.payroll.findMany({
        where: {
          month: dto.month,
          ...(companyId && companyId !== 'PLATFORM' ? { companyId } : {}),
        },
        select: { id: true, employeeId: true, status: true },
      });

      if (existingPayrolls.length === 0) {
        throw new BadRequestException(
          `No draft payroll records found for ${dto.month}. HR Admin must generate draft payroll first before processing.`,
        );
      }

      // Check if any record is already in a non-draft state (APPROVED, LOCKED, PAID)
      const nonDraft = existingPayrolls.filter(
        (p) => p.status !== 'DRAFT' && p.status !== 'CALCULATED',
      );
      if (nonDraft.length > 0) {
        throw new BadRequestException(
          `Cannot process payroll for ${dto.month}: ${nonDraft.length} record(s) are already in ${nonDraft[0].status} status.`,
        );
      }

      const employees = await this.prisma.employee.findMany({
        where: {
          status: 'Active',
          deletedAt: null,
          ...(companyId && companyId !== 'PLATFORM' ? { companyId } : {}),
        },
        include: {
          exits: {
            where: {
              ...(companyId && companyId !== 'PLATFORM' ? { companyId } : {}),
              status: { in: ['APPROVED', 'COMPLETED'] },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (dto.adjustments && typeof dto.adjustments === 'object') {
        const validEmpIds = new Set(employees.map((e) => e.id));
        for (const adjEmpId of Object.keys(dto.adjustments)) {
          if (!validEmpIds.has(adjEmpId)) {
            throw new BadRequestException(
              `Adjustment provided for invalid or unauthorized employee ID "${adjEmpId}".`,
            );
          }
        }
      }

      const attendanceSettings = companyId && companyId !== 'PLATFORM'
        ? await (this.prisma as any).attendanceSetting.findFirst({
            where: { companyId },
          })
        : null;

      // Generate unified attendance matrix (incorporates holidays, weekends, leave requests, attendance)
      const matrix = await this.attendanceMatrixService.getMatrix(
        dto.month,
        'All',
        undefined,
        user,
      );

      // Cache/Load statutory rules once per batch run
      const statRules = await this.statutoryRulesService.getStatutoryRules();

      // Resolve active Fiscal Year for tenant
      const activeFy = await (this.prisma as any).fiscalYear.findFirst({
        where: { companyId, status: 'ACTIVE', deletedAt: null },
      });
      const activeFyId = activeFy?.id || '';

      // Pre-fetch persistent PayrollInput records for the target company and month
      const persistedInputs = await (this.prisma as any).payrollInput.findMany({
        where: {
          month: dto.month,
          ...(companyId && companyId !== 'PLATFORM' ? { companyId } : {}),
        },
      });
      const persistedInputMap = new Map<string, any>(persistedInputs.map((p: any) => [p.employeeId, p]));

      const calculatedSlips: any[] = [];
      const validationErrors: string[] = [];
      const allConsumedClaimIds: string[] = [];

      for (const emp of employees) {
        const explicitAdj = dto.adjustments?.[emp.id];
        const persistedInput: any = persistedInputMap.get(emp.id);

        const adj = explicitAdj
          ? explicitAdj
          : persistedInput
          ? {
              LOPDays: persistedInput.lopDays,
              overtimeHours: persistedInput.overtimeHours,
              bonus: persistedInput.bonus,
              deductions: persistedInput.deductions,
              ptOverride: 0,
              remarks: persistedInput.remarks || '',
            }
          : {
              LOPDays: 0,
              overtimeHours: 0,
              bonus: 0,
              deductions: 0,
              ptOverride: 0,
              remarks: '',
            };

        if (adj.LOPDays !== undefined && adj.LOPDays < 0) {
          validationErrors.push(
            `Employee ${emp.name} has invalid negative LOP days override.`,
          );
        }
        if (adj.overtimeHours !== undefined && adj.overtimeHours < 0) {
          validationErrors.push(
            `Employee ${emp.name} has invalid negative overtime hours.`,
          );
        }

        // Query unpaid claims designated for PAYROLL payout for this employee
        let nonTaxableReimbursement = 0;
        let taxableReimbursement = 0;
        const empConsumedClaimIds: string[] = [];

        if (companyId && companyId !== 'PLATFORM') {
          const unpaidClaims = await this.expenseClaimRepository.findUnpaidPayrollClaims(companyId, emp.id);
          for (const claim of unpaidClaims) {
            nonTaxableReimbursement += claim.nonTaxableAmount || 0;
            taxableReimbursement += claim.taxableAmount || 0;
            empConsumedClaimIds.push(claim.id);
          }
        }
        allConsumedClaimIds.push(...empConsumedClaimIds);

        // Retrieve the derived attendance summary from the unified matrix
        let attendanceSummary;
        try {
          const matrixRow = matrix.records.find(
            (r: any) => r.employeeId === emp.id,
          );
          if (!matrixRow || !matrixRow.summary) {
            throw new Error(
              `Could not generate attendance summary for ${emp.name}`,
            );
          }

          // Map matrix summary to the format expected by Payroll Engine
          const totalDaysInMonth = matrix.daysInMonth;
          attendanceSummary = {
            workingDays: totalDaysInMonth - matrixRow.summary.weekend,
            presentDays: matrixRow.summary.present + matrixRow.summary.late,
            halfDays: matrixRow.summary.halfDay,
            absentDays: matrixRow.summary.absent,
            lopDays: matrixRow.summary.lopDays,
          };
        } catch (err: any) {
          validationErrors.push(err.message);
          continue;
        }

        // Calculate authoritative monthly TDS using active FiscalYear, TaxDeclaration, and taxable reimbursements
        let taxBreakdown;
        if (activeFyId) {
          taxBreakdown = await this.taxCalculationService.computeEmployeeMonthlyTds(
            companyId,
            emp.id,
            activeFyId,
            emp.salary + taxableReimbursement,
            dto.month,
          );
          if ((adj as any).tdsOverride === undefined) {
            (adj as any).tdsOverride = taxBreakdown.monthlyTdsDeduction;
          }
        }

        const lopPolicy = await this.lopPolicyService.resolvePolicy(
          companyId,
          dto.month,
          attendanceSummary,
        );

        const payrollInput = {
          ...adj,
          nonTaxableReimbursement,
        };

        const exitDate = resolveEffectiveExitDate(emp);
        const calc = this.payrollEngine.calculateEmployeePayroll(
          emp,
          attendanceSummary,
          payrollInput,
          statRules,
          [],
          attendanceSettings,
          lopPolicy,
          dto.month,
          exitDate,
        );

        if (calc.net < 0) {
          validationErrors.push(
            `Employee ${emp.name} calculation results in negative net salary.`,
          );
        }

        const warnings: string[] = [];
        if (!emp.pan) {
          warnings.push(`Missing PAN for ${emp.name}. TDS returns will fail.`);
        }
        if (!emp.uan) {
          warnings.push(`Missing UAN for ${emp.name}. EPF filing will fail.`);
        }

        // Prepare final snapshot adjustments containing immutable calculation rule metadata
        const snapshotAdjustments = {
          LOPDays: calc.lopDeductDays,
          overtimeHours: adj.overtimeHours || 0,
          bonus: adj.bonus || 0,
          deductions: adj.deductions || 0,
          ptOverride: adj.ptOverride || 0,
          remarks: adj.remarks || '',
          workingDays: calc.workingDays,
          presentDays: calc.presentDays,
          lopDivisorMode: calc.lopDivisorMode,
          lopDivisor: calc.lopDivisor,
          // Rule metadata snapshot for historical audits!
          pfRate: statRules.pfRate,
          tdsRate: statRules.tdsRate,
          ptAmount: statRules.ptAmount,
          basicPercentage: statRules.basicPercentage,
          hraPercentage: statRules.hraPercentage,
          // Tax declaration calculation breakdown metadata
          taxRegime: taxBreakdown?.regime || 'NEW',
          approvedTaxDeductions: taxBreakdown?.cappedDeductionsTotal || 0,
          annualTaxLiability: taxBreakdown?.totalAnnualTaxLiability || 0,
          tdsWithheldSoFar: taxBreakdown?.tdsWithheldSoFar || 0,
          remainingTaxLiability: taxBreakdown?.remainingTaxLiability || 0,
          // Expense Claim Reimbursement metadata
          nonTaxableReimbursement,
          taxableReimbursement,
          consumedClaimIds: empConsumedClaimIds,
        };

        calculatedSlips.push({
          employeeId: emp.id,
          month: dto.month,
          payDate: dto.payDate,
          fixedBaseSalary: calc.fixedBaseSalary,
          basicSalary:
            calc.components.find((c) => c.name === 'Basic Salary')?.amount ||
            calc.basicSalary,
          allowances: calc.components
            .filter((c) => c.type === 'EARNING' && c.name !== 'Basic Salary')
            .reduce((s, c) => s + c.amount, 0),
          gross: calc.gross,
          deductions: calc.totalDeduct,
          netSalary: calc.net,
          lopDays: calc.lopDeductDays,
          lopDeductAmount: calc.lopDeductAmount,
          lopDivisorMode: calc.lopDivisorMode,
          lopDivisor: calc.lopDivisor,
          status: 'APPROVED',
          warnings: JSON.stringify(warnings),
          components: calc.components,
          adjustments: snapshotAdjustments,
          calculationVersion: 2,
        });
      }

      if (validationErrors.length > 0) {
        throw new BadRequestException({
          message: 'Batch payroll processing validation failed.',
          errors: validationErrors,
        });
      }

      const existingMap = new Map(existingPayrolls.map((p) => [p.employeeId, p.id]));
      const toCreateData: any[] = [];
      const toUpdateEntries: { id: string; data: any }[] = [];

      for (const slip of calculatedSlips) {
        const existingId = existingMap.get(slip.employeeId);
        if (existingId) {
          toUpdateEntries.push({
            id: existingId,
            data: {
              payDate: slip.payDate,
              fixedBaseSalary: slip.fixedBaseSalary,
              basicSalary: slip.basicSalary,
              allowances: slip.allowances,
              gross: slip.gross,
              deductions: slip.deductions,
              netSalary: slip.netSalary,
              lopDays: slip.lopDays,
              lopDeductAmount: slip.lopDeductAmount,
              lopDivisorMode: slip.lopDivisorMode,
              lopDivisor: slip.lopDivisor,
              status: 'APPROVED',
              warnings: slip.warnings,
              components: slip.components,
              adjustments: slip.adjustments,
              calculationVersion: slip.calculationVersion,
            },
          });
        } else {
          toCreateData.push({
            ...slip,
            companyId,
          });
        }
      }

      const results = await this.prisma.$transaction(async (tx) => {
        if (toCreateData.length > 0) {
          await tx.payroll.createMany({
            data: toCreateData,
          });
        }

        if (toUpdateEntries.length > 0) {
          await Promise.all(
            toUpdateEntries.map(({ id, data }) =>
              tx.payroll.update({
                where: { id },
                data,
              }),
            ),
          );
        }

        // Mark consumed payroll expense claims as PAID inside transaction
        if (allConsumedClaimIds.length > 0) {
          await this.expenseClaimRepository.markClaimsPaidByPayroll(
            allConsumedClaimIds,
            companyId,
            dto.month.replace(/\s+/g, '_'),
            tx,
          );
        }

        const lockKey = this.getPeriodLockKey(dto.month, tenantId);
        await tx.systemConfig.upsert({
          where: { key: lockKey },
          update: { value: 'LOCKED' },
          create: { key: lockKey, value: 'LOCKED' },
        });

        // Write to append-only AuditLog inside transaction
        const auditDetails = JSON.stringify({
          companyId,
          summary: `Processed and locked payroll for month: ${dto.month} - total: ${employees.length} employees.`,
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id || 'system',
            actorRole: user.role || 'HRAdmin',
            companyId,
            action: 'PAYROLL_LOCKED' as any,
            entityType: 'PAYROLL',
            details: auditDetails,
          },
        });

        // Write to Outbox table inside transaction using CanonicalJobContext
        const jobId = randomUUID();
        const correlationId = randomUUID();
        const canonicalContext: CanonicalJobContext<{ month: string; count: number; userId?: string }> = {
          jobId,
          eventId: jobId,
          companyId,
          actorUserId: user.id || 'system',
          actorRole: user.role || 'Accountant',
          executionScope: 'TENANT',
          correlationId,
          enqueuedAt: new Date().toISOString(),
          data: {
            month: dto.month,
            count: employees.length,
            userId: user.id,
          },
        };

        await tx.outboxEvent.create({
          data: {
            id: jobId,
            companyId,
            eventType: 'PAYROLL_LOCKED',
            payload: JSON.stringify(canonicalContext),
            status: 'PENDING',
          },
        });

        return calculatedSlips;
      });

      await this.resolveIdempotencyKey(idempotencyKeyStr, true);
      return results;
    } catch (err) {
      await this.resolveIdempotencyKey(idempotencyKeyStr, false);
      throw err;
    }
  }

  async lockPeriod(month: string, user: any) {
    const tenantId = this.getTenantId(user);
    const lockKey = this.getPeriodLockKey(month, tenantId);
    await this.prisma.systemConfig.upsert({
      where: { key: lockKey },
      update: { value: 'LOCKED' },
      create: { key: lockKey, value: 'LOCKED' },
    });

    await this.auditLogger.logAction({
      userId: user.id,
      userName: user.name,
      companyId: user.companyId || 'PLATFORM',
      action: 'PAYROLL_PERIOD_LOCKED',
      details: `Locked payroll period for: ${month}`,
    });

    return { status: 'LOCKED' };
  }

  async unlockPeriod(month: string, user: any) {
    const tenantId = this.getTenantId(user);
    const lockKey = this.getPeriodLockKey(month, tenantId);
    await this.prisma.systemConfig.upsert({
      where: { key: lockKey },
      update: { value: 'OPEN' },
      create: { key: lockKey, value: 'OPEN' },
    });

    await this.auditLogger.logAction({
      userId: user.id,
      userName: user.name,
      companyId: user.companyId || 'PLATFORM',
      action: 'PAYROLL_PERIOD_UNLOCKED',
      details: `Unlocked payroll period for: ${month}`,
    });

    return { status: 'OPEN' };
  }

  validateStatusTransition(current: string, next: string) {
    const normCurrent = (current || '').toUpperCase().trim();
    const normNext = (next || '').toUpperCase().trim();

    if (normCurrent === 'DRAFT' || normCurrent === 'CALCULATED') {
      throw new BadRequestException(
        'Draft payroll slips cannot be transitioned individually. Please use the batch Process Payroll workflow to approve and finalize drafts.',
      );
    }

    const transitions: Record<string, string[]> = {
      'APPROVED': ['LOCKED', 'PAID'],
      'LOCKED': ['APPROVED', 'PAYMENT_INITIATED', 'PAID'],
      'PAYMENT_INITIATED': ['LOCKED', 'PAID'],
      'PAID': [],
    };
    const allowed = transitions[normCurrent] || [];
    if (!allowed.includes(normNext)) {
      throw new BadRequestException(`Invalid payroll status transition from ${current} to ${next}`);
    }
  }

  private getTenantId(currentUser: any): string | null {
    if (currentUser?.role === 'SuperAdmin') return null;
    return currentUser?.companyId || currentUser?.subscriptionId || null;
  }

  async updateStatus(id: string, status: string, user: any) {
    const tenantId = this.getTenantId(user);
    const record = await this.payrollRepository.findByIdAndTenant(id, tenantId);
    if (!record) {
      throw new NotFoundException(`Payroll slip with ID "${id}" not found`);
    }

    const normNext = (status || '').toUpperCase().trim();
    if (normNext !== 'PAID') {
      await this.assertPeriodNotLocked(record.month, tenantId);
    }

    const currentStatus = record.status || 'DRAFT';
    this.validateStatusTransition(currentStatus, status);
    const updateData: any = { status: normNext as any };
    if (normNext === 'PAID' && !record.payDate) {
      updateData.payDate = new Date().toISOString().slice(0, 10);
    }
    const result = await this.payrollRepository.update(id, updateData);

    await this.auditLogger.logAction({
      userId: user.id,
      userName: user.name,
      companyId: user.companyId || 'PLATFORM',
      action: 'PAYROLL_APPROVED',
      details: `Updated payroll status for slip ID ${id} from ${currentStatus} to ${status}`,
    });

    return result;
  }

  async markMonthAsPaid(dto: MarkPayrollPaidDto, user: any) {
    const isSuperAdmin = user?.role === 'SuperAdmin';
    const tenantId = this.getTenantId(user);

    // Resolve target company ID strictly:
    // For tenant user: MUST be user's tenantId (never accept foreign companyId)
    // For SuperAdmin: uses dto.companyId if specified, or null for all non-demo tenants
    const targetCompanyId = !isSuperAdmin ? tenantId : (dto.companyId || null);

    const where: any = {
      month: dto.month,
    };

    if (targetCompanyId) {
      where.employee = {
        OR: [
          { companyId: targetCompanyId },
          { subscriptionId: targetCompanyId },
        ],
      };
    } else {
      where.employee = {
        company: {
          isDemo: false,
        },
      };
    }

    const existingRecords = await this.prisma.payroll.findMany({
      where,
      include: { employee: true },
    });

    if (existingRecords.length === 0) {
      throw new NotFoundException(`No payroll records found for month "${dto.month}"`);
    }

    const nonPaid = existingRecords.filter((r) => (r.status || '').toUpperCase() !== 'PAID');
    if (nonPaid.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        message: `All payroll records for month "${dto.month}" are already marked as PAID.`,
        month: dto.month,
      };
    }

    const eligibleRecords = nonPaid.filter((r) =>
      ['APPROVED', 'LOCKED', 'PAYMENT_INITIATED'].includes((r.status || '').toUpperCase()),
    );

    if (eligibleRecords.length === 0) {
      throw new BadRequestException(
        `Cannot mark payroll as PAID: No records in APPROVED or LOCKED status found for month "${dto.month}". Please process/lock payroll first.`,
      );
    }

    const payDate = dto.payDate || new Date().toISOString().slice(0, 10);
    const eligibleIds = eligibleRecords.map((r) => r.id);

    const result = await this.prisma.$transaction(async (tx) => {
      const updateRes = await tx.payroll.updateMany({
        where: {
          id: { in: eligibleIds },
        },
        data: {
          status: 'PAID',
          payDate,
        },
      });

      await this.auditLogger.logAction({
        userId: user.id || 'system',
        userName: user.name || 'System',
        companyId: targetCompanyId || user.companyId || 'PLATFORM',
        action: 'PAYROLL_APPROVED',
        details: `Disbursed and marked payroll as PAID for month ${dto.month} (${updateRes.count} slips). Ref: ${dto.paymentReference || 'Direct Bank Transfer'}, PayDate: ${payDate}`,
      });

      return updateRes;
    });

    return {
      success: true,
      updatedCount: result.count,
      month: dto.month,
      payDate,
      message: `Successfully marked ${result.count} payroll slips as PAID for ${dto.month}.`,
    };
  }

  async getSummary(currentUser: any, month: string) {
    const companyId = this.getTenantId(currentUser);
    const records = await this.payrollRepository.findByMonth(companyId, month);

    const basicSum = records.reduce((sum, r) => sum + r.basicSalary, 0);
    const allowancesSum = records.reduce((sum, r) => sum + r.allowances, 0);
    const deductionsSum = records.reduce((sum, r) => sum + r.deductions, 0);
    const netSum = records.reduce((sum, r) => sum + r.netSalary, 0);

    const paidCount = records.filter((r) => r.status === 'PAID').length;
    const pendingCount = records.filter((r) => r.status !== 'PAID').length;

    return {
      month,
      totalBasic: basicSum,
      totalAllowances: allowancesSum,
      totalDeductions: deductionsSum,
      totalNet: netSum,
      totalEmployees: records.length,
      paidCount,
      pendingCount,
    };
  }

  async getComponents(companyId?: string | null) {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    return this.prisma.salaryComponent.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async createComponent(companyId: string | null, data: any) {
    if (!companyId) {
      throw new BadRequestException('Company ID is required to create a salary component.');
    }
    const fromDate = new Date(data.effectiveFrom);
    const toDate = data.effectiveTo ? new Date(data.effectiveTo) : null;

    const overlaps = await this.prisma.salaryComponent.findMany({
      where: {
        companyId,
        name: data.name,
        OR: [
          {
            effectiveFrom: { lte: fromDate },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: fromDate } }
            ]
          },
          ...(toDate ? [{
            effectiveFrom: { lte: toDate },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: toDate } }
            ]
          }] : [])
        ]
      }
    });

    if (overlaps.length > 0) {
      throw new BadRequestException('Overlapping validity period detected for this component name.');
    }

    if (data.calculationMethod === 'FORMULA') {
      const calculator = new SalaryComponentCalculatorService();
      calculator.validateFormulaGraph([data]);
    }

    return this.prisma.salaryComponent.create({
      data: {
        companyId,
        name: data.name,
        type: data.type,
        calculationMethod: data.calculationMethod,
        value: data.value,
        calculationBase: data.calculationBase || null,
        formulaJson: data.formulaJson || null,
        taxable: data.taxable ?? true,
        pfApplicable: data.pfApplicable ?? false,
        esiApplicable: data.esiApplicable ?? false,
        effectiveFrom: fromDate,
        effectiveTo: toDate,
      },
    });
  }

  async deleteComponent(companyId: string | null, id: string) {
    const comp = await this.prisma.salaryComponent.findUnique({ where: { id } });
    if (!comp || (companyId && comp.companyId !== companyId)) {
      throw new NotFoundException(`Salary component with ID "${id}" not found`);
    }
    return this.prisma.salaryComponent.delete({ where: { id } });
  }

  async updateSlip(companyId: string | null, id: string, data: any) {
    const slip = await this.payrollRepository.findByIdAndTenant(id, companyId);
    if (!slip) {
      throw new NotFoundException(`Payroll slip with ID "${id}" not found`);
    }

    if (slip.status === 'LOCKED' || slip.status === 'PAID' || slip.status === 'PAYMENT_INITIATED') {
      throw new BadRequestException('Cannot modify a locked or paid payroll record.');
    }

    const emp = await this.prisma.employee.findUnique({
      where: { id: slip.employeeId },
      include: {
        exits: {
          where: {
            ...(companyId ? { companyId } : {}),
            status: { in: ['APPROVED', 'COMPLETED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!emp) {
      throw new NotFoundException(`Employee associated with payroll record not found`);
    }

    const updatedAdjustments = data.adjustments || (slip.adjustments as any) || {
      LOPDays: 0,
      overtimeHours: 0,
      bonus: 0,
      deductions: 0,
      ptOverride: 0,
    };

    const statRules = await this.statutoryRulesService.getStatutoryRules();
    const lopPolicy = await this.lopPolicyService.resolvePolicy(
      companyId,
      slip.month,
    );
    const exitDate = resolveEffectiveExitDate(emp);
    const calc = this.payrollEngine.calculateEmployeePayroll(
      emp,
      {
        workingDays: lopPolicy.divisor,
        presentDays: Math.max(0, lopPolicy.divisor - (updatedAdjustments.LOPDays || 0)),
        halfDays: 0,
        absentDays: updatedAdjustments.LOPDays || 0,
        lopDays: updatedAdjustments.LOPDays || 0,
      },
      updatedAdjustments,
      statRules,
      [],
      null,
      lopPolicy,
      slip.month,
      exitDate,
    );

    return this.prisma.payroll.update({
      where: { id },
      data: {
        fixedBaseSalary: calc.fixedBaseSalary,
        basicSalary: calc.basicSalary,
        allowances: Math.max(0, calc.gross - calc.basicSalary),
        gross: calc.gross,
        deductions: calc.totalDeduct,
        netSalary: calc.net,
        lopDays: calc.lopDeductDays,
        lopDeductAmount: calc.lopDeductAmount,
        lopDivisorMode: calc.lopDivisorMode,
        lopDivisor: calc.lopDivisor,
        components: JSON.parse(JSON.stringify(calc.components)),
        adjustments: JSON.parse(JSON.stringify(updatedAdjustments)),
        version: { increment: 1 },
      },
    });
  }

  async getPayrollInputs(currentUser: any, month?: string, employeeId?: string) {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin';
    const companyId = isSuperAdmin
      ? currentUser?.companyId !== 'PLATFORM'
        ? currentUser?.companyId
        : null
      : currentUser?.companyId || currentUser?.subscriptionId || null;

    if (currentUser?.role === 'Employee') {
      const empId = currentUser?.employee?.id;
      if (!empId) return [];
      return (this.prisma as any).payrollInput.findMany({
        where: {
          employeeId: empId,
          ...(month ? { month } : {}),
          ...(companyId ? { companyId } : {}),
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              department: { select: { name: true } },
              designation: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return (this.prisma as any).payrollInput.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(month ? { month } : {}),
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: { select: { name: true } },
            designation: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertPayrollInput(
    currentUser: any,
    employeeId: string,
    dto: UpdatePayrollInputDto,
  ) {
    let companyId = this.getTenantId(currentUser);
    if (currentUser?.role === 'SuperAdmin') {
      companyId =
        dto.companyId ||
        (currentUser.companyId && currentUser.companyId !== 'PLATFORM'
          ? currentUser.companyId
          : null);
      if (companyId) {
        const targetCompany = await this.prisma.company.findUnique({
          where: { id: companyId },
          select: { id: true },
        });
        if (!targetCompany) {
          throw new NotFoundException(
            `Target company with ID "${companyId}" does not exist.`,
          );
        }
      }
    }

    // 1. Period Lock enforcement
    const tenantId = this.getTenantId(currentUser);
    await this.assertPeriodNotLocked(dto.month, tenantId);

    // 2. Validate target employee and tenant ownership
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        ...(companyId ? { companyId } : {}),
        deletedAt: null,
      },
    });
    if (!employee) {
      throw new NotFoundException(
        `Employee with ID "${employeeId}" not found in current company.`,
      );
    }

    // 3. Immutability check: Reject if employee's payroll for this month is already PROCESSED or PAID
    const existingPayroll = await this.prisma.payroll.findUnique({
      where: {
        employeeId_month: {
          employeeId,
          month: dto.month,
        },
      },
      select: { id: true, status: true },
    });
    if (
      existingPayroll &&
      (existingPayroll.status === ('PROCESSED' as any) ||
        existingPayroll.status === 'APPROVED' ||
        existingPayroll.status === 'LOCKED' ||
        existingPayroll.status === 'PAYMENT_INITIATED' ||
        existingPayroll.status === 'PAID')
    ) {
      throw new BadRequestException(
        `Cannot modify payroll inputs for ${dto.month}: payroll is already ${existingPayroll.status.toLowerCase()}.`,
      );
    }

    const targetCompanyId = employee.companyId || companyId || 'PLATFORM';

    const lopDays = dto.lopDays !== undefined ? Math.max(0, dto.lopDays) : 0;
    const overtimeHours =
      dto.overtimeHours !== undefined ? Math.max(0, dto.overtimeHours) : 0;
    const bonus = dto.bonus !== undefined ? Math.max(0, dto.bonus) : 0;
    const deductions =
      dto.deductions !== undefined ? Math.max(0, dto.deductions) : 0;
    const remarks = dto.remarks || '';

    // 4. Atomic upsert
    const inputRecord = await (this.prisma as any).payrollInput.upsert({
      where: {
        employeeId_month: {
          employeeId,
          month: dto.month,
        },
      },
      create: {
        companyId: targetCompanyId,
        employeeId,
        month: dto.month,
        lopDays,
        overtimeHours,
        bonus,
        deductions,
        remarks,
        createdBy: currentUser.id || 'system',
        updatedBy: currentUser.id || 'system',
      },
      update: {
        ...(dto.lopDays !== undefined ? { lopDays: dto.lopDays } : {}),
        ...(dto.overtimeHours !== undefined
          ? { overtimeHours: dto.overtimeHours }
          : {}),
        ...(dto.bonus !== undefined ? { bonus: dto.bonus } : {}),
        ...(dto.deductions !== undefined ? { deductions: dto.deductions } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
        updatedBy: currentUser.id || 'system',
      },
    });

    // 5. Append audit log
    await this.auditLogger.logAction({
      userId: currentUser.id || 'system',
      userName: currentUser.name || 'HR Admin',
      companyId: targetCompanyId,
      action: 'PAYROLL_INPUT_UPDATED',
      details: `Updated payroll inputs for employee ${employee.name} (${employeeId}) for month ${dto.month}: LOP=${inputRecord.lopDays}, OT=${inputRecord.overtimeHours}, Bonus=${inputRecord.bonus}, Deductions=${inputRecord.deductions}`,
      newValue: {
        employeeId,
        month: dto.month,
        lopDays: inputRecord.lopDays,
        overtimeHours: inputRecord.overtimeHours,
        bonus: inputRecord.bonus,
        deductions: inputRecord.deductions,
        remarks: inputRecord.remarks,
      },
    });

    return inputRecord;
  }
}
