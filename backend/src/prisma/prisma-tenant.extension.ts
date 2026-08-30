import { Prisma } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { TenantContextService } from '../common/tenant/tenant-context.service';

// Category A (Direct companyId models)
const DIRECT_COMPANY_ID_MODELS = new Set([
  'LeaveRequest',
  'Payroll',
  'Document',
  'AuditLog',
  'Message',
  'CompanyAsset',
  'CompanyDevice',
  'ReviewCycle',
  'PerformanceReview',
  'PerformanceCriterion',
  'PerformanceGoal',
  'KPIDefinition',
  'PerformanceAudit',
  'Exit',
  'ExitChecklistTemplate',
  'SalaryComponent',
  'CompanySettings',
  'OfficeTiming',
  'Holiday',
  'LeaveType',
  'CalendarEvent',
  'Role',
  'AttendanceSetting',
  'AttendanceRegularizationRequest',
  'ExpenseCategory',
  'ExpenseClaim',
  'FiscalYear',
  'SupportTicket',
  'OutboxEvent',
  'OutboxIdempotency',
  'TaxDeclaration',
  'Subscription',
  'Offer',
]);

// Category B (Direct subscriptionId models)
const DIRECT_SUBSCRIPTION_ID_MODELS = new Set([
  'Employee',
  'Department',
  'Designation',
  'Announcement',
  'JobRequisition',
  'Candidate',
  'CandidateEvaluation',
  'User',
  'SubscriptionEvent',
  'Offer',
]);

// Category C (Relation-scoped models)
const RELATION_SCOPED_MODELS: Record<string, (companyId: string, subscriptionId: string | null) => any> = {
  Attendance: (companyId, subscriptionId) => ({
    employee: subscriptionId
      ? { OR: [{ companyId }, { subscriptionId }] }
      : { companyId },
  }),
  LeaveQuota: (companyId, subscriptionId) => ({
    employee: subscriptionId
      ? { OR: [{ companyId }, { subscriptionId }] }
      : { companyId },
  }),
  PerformanceCriterionScore: (companyId) => ({
    review: { companyId },
  }),
  ReviewCycleParticipant: (companyId) => ({
    reviewCycle: { companyId },
  }),
  ExitApproval: (companyId) => ({
    exit: { companyId },
  }),
  ExitChecklistItem: (companyId) => ({
    exit: { companyId },
  }),
  ExitInterview: (companyId) => ({
    exit: { companyId },
  }),
  ExitTimeline: (companyId) => ({
    exit: { companyId },
  }),
  ExitDocument: (companyId) => ({
    exit: { companyId },
  }),
  ExitSettlement: (companyId) => ({
    exit: { companyId },
  }),
  TicketMessage: (companyId) => ({
    ticket: { companyId },
  }),
  ExpenseClaimItem: (companyId) => ({
    claim: { companyId },
  }),
  TaxDeclarationItem: (companyId) => ({
    taxDeclaration: { companyId },
  }),
};

/**
 * Enterprise Model-Aware Prisma Extension for Multi-Tenant Scoping.
 *
 * 1. SuperAdmin requests execute un-scoped (zero injection).
 * 2. Category A models filter explicitly by companyId.
 * 3. Category B models filter explicitly by subscriptionId or companyId fallback.
 * 4. Category C models filter via parent relation paths.
 * 5. Category D models (global platform tables) are completely un-scoped.
 * 6. Defensive failure: Missing companyId on tenant requests throws 403 ForbiddenException.
 */
export function createTenantPrismaExtension(
  tenantContextService: TenantContextService,
) {
  return Prisma.defineExtension((client) => {
    return client.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            // 1. SuperAdmin / Platform Request Check: Execute query completely un-scoped
            if (
              !model ||
              tenantContextService.isSuperAdmin() ||
              tenantContextService.isPlatform()
            ) {
              return query(args);
            }

            const companyId = tenantContextService.getCompanyId();
            const subscriptionId = tenantContextService.getSubscriptionId();

            if (companyId === 'PLATFORM') {
              return query(args);
            }

            const isDirectCompany = DIRECT_COMPANY_ID_MODELS.has(model);
            const isDirectSub = DIRECT_SUBSCRIPTION_ID_MODELS.has(model);
            const relationScopedFilter = RELATION_SCOPED_MODELS[model];

            // 2. Category D Check: Global / Platform models pass through unmodified
            if (!isDirectCompany && !isDirectSub && !relationScopedFilter) {
              return query(args);
            }

            // 3. Defensive Failure: Tenant-scoped request missing companyId throws 403
            if (!companyId || companyId === 'DEFAULT_COMPANY') {
              throw new ForbiddenException(
                'Tenant context (companyId) is required for this operation',
              );
            }

            const currentArgs = (args || {}) as any;

            // 4. Read & Mutation Filter Injection
            if (
              [
                'findMany',
                'findFirst',
                'findUnique',
                'count',
                'aggregate',
                'groupBy',
                'update',
                'updateMany',
                'delete',
                'deleteMany',
                'upsert',
              ].includes(operation)
            ) {
              currentArgs.where = currentArgs.where || {};
              if (isDirectCompany) {
                if (operation === 'upsert') {
                  currentArgs.where = { ...currentArgs.where, companyId };
                  currentArgs.create = { ...currentArgs.create, companyId };
                  currentArgs.update = { ...currentArgs.update, companyId };
                } else {
                  currentArgs.where = { ...currentArgs.where, companyId };
                }
              } else if (isDirectSub) {
                const subFilter = subscriptionId
                  ? { OR: [{ subscriptionId }, { companyId }] }
                  : { companyId };
                if (operation === 'upsert') {
                  currentArgs.where = { ...currentArgs.where, ...subFilter };
                  if (subscriptionId) {
                    currentArgs.create = { ...currentArgs.create, subscriptionId, companyId };
                    currentArgs.update = { ...currentArgs.update, subscriptionId, companyId };
                  } else {
                    currentArgs.create = { ...currentArgs.create, companyId };
                    currentArgs.update = { ...currentArgs.update, companyId };
                  }
                } else {
                  currentArgs.where = { ...currentArgs.where, ...subFilter };
                }
              } else if (relationScopedFilter) {
                if (
                  [
                    'findMany',
                    'findFirst',
                    'count',
                    'aggregate',
                    'groupBy',
                    'updateMany',
                    'deleteMany',
                  ].includes(operation)
                ) {
                  const filter = relationScopedFilter(companyId, subscriptionId);
                  currentArgs.where = { ...currentArgs.where, ...filter };
                }
              }
            }

            return query(currentArgs);
          },
        },
      },
    });
  });
}
