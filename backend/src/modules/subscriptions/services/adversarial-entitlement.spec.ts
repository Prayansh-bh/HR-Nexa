import { assertSubscriptionActive, getEffectivePermissions, clearTenantEntitlementCache } from '../../../common/tenant/tenant-validation.util';
import { ForbiddenException } from '@nestjs/common';

describe('PHASE 2H ADVERSARIAL: Subscription & Entitlement Bypass Attacks', () => {
  beforeEach(() => {
    clearTenantEntitlementCache();
  });

  describe('Attack 1: Inactive / Suspended / Cancelled Tenant Calling Endpoints', () => {
    it('MUST REJECT Suspended subscription with 403 Forbidden', () => {
      expect(() => {
        assertSubscriptionActive('HR Admin', { status: 'Suspended', expiry: '2099-12-31' });
      }).toThrow(ForbiddenException);
    });

    it('MUST REJECT Cancelled subscription with 403 Forbidden', () => {
      expect(() => {
        assertSubscriptionActive('HR Admin', { status: 'Cancelled', expiry: '2099-12-31' });
      }).toThrow(ForbiddenException);
    });

    it('MUST REJECT Expired subscription with 403 Forbidden', () => {
      expect(() => {
        assertSubscriptionActive('HR Admin', { status: 'Active', expiry: '2020-01-01' });
      }).toThrow(ForbiddenException);
    });

    it('MUST REJECT Pending Approval registration with 403 Forbidden', () => {
      expect(() => {
        assertSubscriptionActive('HR Admin', { status: 'Pending Approval', expiry: '2099-12-31' });
      }).toThrow(ForbiddenException);
    });
  });

  describe('Attack 2: Starter Plan Tenant Attempting Enterprise Feature Endpoint', () => {
    it('MUST strip unentitled permissions when feature is not enabled in plan tier', async () => {
      const mockPrisma = {
        companyPlanAssignment: {
          findUnique: jest.fn().mockResolvedValue({ planVersionId: 'plan-v-starter-123' }),
        },
        planVersion: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'plan-v-starter-123',
            features: [
              {
                enabled: true,
                feature: { key: 'employees' },
              },
            ],
          }),
        },
        permission: {
          findMany: jest.fn().mockResolvedValue([
            { key: 'employees.view', feature: { key: 'employees' } },
            { key: 'performance.manage', feature: { key: 'performance' } },
            { key: 'recruitment.create', feature: { key: 'recruitment' } },
          ]),
        },
      };

      const requestedPermissions = ['employees.view', 'performance.manage', 'recruitment.create'];
      const subscription = { id: 'sub-starter', company: 'comp-starter-1', status: 'Active' };

      const effective = await getEffectivePermissions(mockPrisma, 'HR Admin', requestedPermissions, subscription);

      // Enterprise permissions (performance, recruitment) must be stripped out
      expect(effective).toContain('employees.view');
      expect(effective).not.toContain('performance.manage');
      expect(effective).not.toContain('recruitment.create');
    });
  });

  describe('Attack 3: SuperAdmin Bypass Boundary', () => {
    it('MUST allow SuperAdmin to maintain platform administration capabilities', () => {
      expect(() => {
        assertSubscriptionActive('SuperAdmin', null);
      }).not.toThrow();
    });
  });
});
