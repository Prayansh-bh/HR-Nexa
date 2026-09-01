import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionDashboardService } from './subscription-dashboard.service';
import { SubscriptionsRepository } from '../repositories/subscriptions.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { getBusinessDateString } from '../../../common/utils/date.util';
import { PlansRepository } from '../../plans/repositories/plans.repository';
import { PlatformReportsRepository } from '../../platform-reports/repositories/platform-reports.repository';

describe('Production Demo Tenant Isolation Architecture Specs', () => {
  let dashboardService: SubscriptionDashboardService;
  let subscriptionsRepository: SubscriptionsRepository;
  let prismaService: PrismaService;
  let mockPrisma: any;
  let mockRepo: any;

  beforeEach(async () => {
    mockPrisma = {
      subscription: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      invoice: {
        findMany: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      employee: {
        findMany: jest.fn(),
      },
      company: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      payroll: {
        findMany: jest.fn(),
      },
      attendance: {
        findMany: jest.fn(),
      },
      leaveRequest: {
        findMany: jest.fn(),
      },
      candidate: {
        findMany: jest.fn(),
      },
      document: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    mockRepo = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionDashboardService,
        {
          provide: SubscriptionsRepository,
          useValue: mockRepo,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    dashboardService = module.get<SubscriptionDashboardService>(SubscriptionDashboardService);
    subscriptionsRepository = module.get<SubscriptionsRepository>(SubscriptionsRepository);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1 — Demo only dataset (2 demo companies, 0 real companies)
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 1: Demo-only dataset produces exactly zero production metrics', async () => {
    // When queried with isDemo: false, repository returns empty array
    mockRepo.findAll.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);

    const stats = await dashboardService.getEnrichedStats();
    const queue = await dashboardService.getRenewalQueue();

    expect(stats.totalCompanies).toBe(0);
    expect(stats.activeSubscriptions).toBe(0);
    expect(stats.trialCompanies).toBe(0);
    expect(stats.expired).toBe(0);
    expect(stats.suspended).toBe(0);
    expect(stats.cancelled).toBe(0);
    expect(stats.other).toBe(0);
    expect(stats.totalRevenue).toBe(0);
    expect(stats.monthlyRevenue).toBe(0);
    expect(stats.annualRevenue).toBe(0);
    expect(stats.mrr).toBe(0);
    expect(stats.arr).toBe(0);
    expect(queue).toEqual([]);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2 — 1 Real + 1 Demo company
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 2: Real + Demo company: only real company contributes to metrics', async () => {
    const today = getBusinessDateString();
    const nextYear = `${parseInt(today.slice(0, 4), 10) + 1}-12-31`;

    const realSub = {
      id: 'sub-real-bgjv',
      company: 'BGJV',
      companyId: 'comp-real-bgjv',
      plan: 'PREMIUM',
      cycle: 'Annual',
      amount: 50000,
      status: SubscriptionStatus.ACTIVE,
      start: today,
      expiry: nextYear,
    };

    const realInvoice = {
      id: 'INV-REAL-001',
      company: 'BGJV',
      subscriptionId: 'sub-real-bgjv',
      amount: 50000,
      status: 'Paid',
      type: 'Invoice',
      date: today,
    };

    // SubscriptionsRepository called with isDemo: false returns only real subscription
    mockRepo.findAll.mockResolvedValue([realSub]);
    mockPrisma.invoice.findMany.mockResolvedValue([realInvoice]);

    const stats = await dashboardService.getEnrichedStats();

    expect(stats.totalCompanies).toBe(1);
    expect(stats.activeSubscriptions).toBe(1);
    expect(stats.totalRevenue).toBe(50000);
    expect(stats.mrr).toBe(Math.round(50000 / 12)); // 4167
    expect(stats.arr).toBe(Math.round(50000 / 12) * 12); // 50004
    expect(mockRepo.findAll).toHaveBeenCalledWith({ isDemo: false });
    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith({
      where: {
        subscription: {
          companyRelation: {
            isDemo: false,
          },
        },
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3 — Multiple real + multiple demo with mixed statuses
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 3: Multiple real + multiple demo: exact aggregation of real tenants only', async () => {
    const today = getBusinessDateString();
    const nextYear = `${parseInt(today.slice(0, 4), 10) + 1}-12-31`;

    const realSubs = [
      { id: 'r1', company: 'R1', status: SubscriptionStatus.ACTIVE, amount: 12000, cycle: 'Annual', expiry: nextYear },
      { id: 'r2', company: 'R2', status: SubscriptionStatus.TRIAL, amount: 0, cycle: 'Trial', expiry: nextYear },
      { id: 'r3', company: 'R3', status: SubscriptionStatus.EXPIRED, amount: 10000, cycle: 'Annual', expiry: '2025-01-01' },
      { id: 'r4', company: 'R4', status: SubscriptionStatus.SUSPENDED, amount: 15000, cycle: 'Annual', expiry: nextYear },
      { id: 'r5', company: 'R5', status: SubscriptionStatus.CANCELLED, amount: 20000, cycle: 'Annual', expiry: nextYear },
    ];

    mockRepo.findAll.mockResolvedValue(realSubs);
    mockPrisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-r1', amount: 12000, status: 'Paid', type: 'Invoice', date: today },
    ]);

    const stats = await dashboardService.getEnrichedStats();

    expect(stats.totalCompanies).toBe(5);
    expect(stats.activeSubscriptions).toBe(1);
    expect(stats.trialCompanies).toBe(1);
    expect(stats.expired).toBe(1);
    expect(stats.suspended).toBe(1);
    expect(stats.cancelled).toBe(1);
    expect(stats.other).toBe(0);
    expect(stats.totalRevenue).toBe(12000);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 4 — Mutually exclusive status partition invariant
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 4: Status partition invariant holds: active + trial + expired + suspended + cancelled + other === totalCompanies', async () => {
    const today = getBusinessDateString();
    const nextYear = `${parseInt(today.slice(0, 4), 10) + 1}-12-31`;

    const realSubs = [
      { id: 'r1', company: 'R1', status: SubscriptionStatus.ACTIVE, amount: 1000, cycle: 'Monthly', expiry: nextYear },
      { id: 'r2', company: 'R2', status: SubscriptionStatus.TRIAL, amount: 0, cycle: 'Trial', expiry: nextYear },
      { id: 'r3', company: 'R3', status: SubscriptionStatus.EXPIRED, amount: 1000, cycle: 'Monthly', expiry: '2024-01-01' },
      { id: 'r4', company: 'R4', status: SubscriptionStatus.SUSPENDED, amount: 1000, cycle: 'Monthly', expiry: nextYear },
      { id: 'r5', company: 'R5', status: SubscriptionStatus.CANCELLED, amount: 1000, cycle: 'Monthly', expiry: nextYear },
      { id: 'r6', company: 'R6', status: 'Pending', amount: 1000, cycle: 'Monthly', expiry: nextYear },
    ];

    mockRepo.findAll.mockResolvedValue(realSubs);
    mockPrisma.invoice.findMany.mockResolvedValue([]);

    const stats = await dashboardService.getEnrichedStats();

    const sum =
      stats.activeSubscriptions +
      stats.trialCompanies +
      stats.expired +
      stats.suspended +
      stats.cancelled +
      stats.other;

    expect(sum).toBe(stats.totalCompanies);
    expect(stats.totalCompanies).toBe(6);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 5 — Renewal queue isolation
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 5: Renewal queue excludes demo subscriptions', async () => {
    const today = new Date();
    const in15Days = new Date(today);
    in15Days.setDate(in15Days.getDate() + 15);

    const realExpiringSub = {
      id: 'sub-real-expiring',
      company: 'BGJV',
      status: SubscriptionStatus.ACTIVE,
      expiry: getBusinessDateString(in15Days),
    };

    mockRepo.findAll.mockResolvedValue([realExpiringSub]);

    const queue = await dashboardService.getRenewalQueue();

    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe('sub-real-expiring');
    expect(mockRepo.findAll).toHaveBeenCalledWith({ isDemo: false });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 6 — Revenue isolation: Demo invoice contributes ₹0
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 6: Revenue isolation ensures demo invoices contribute ₹0 to total revenue', async () => {
    const today = getBusinessDateString();

    mockRepo.findAll.mockResolvedValue([
      { id: 'r1', company: 'BGJV', status: SubscriptionStatus.ACTIVE, amount: 50000, cycle: 'Annual', expiry: '2027-01-01' },
    ]);

    // Prisma query with where { subscription: { companyRelation: { isDemo: false } } } returns only real invoices
    mockPrisma.invoice.findMany.mockResolvedValue([
      { id: 'INV-BGJV-001', amount: 50000, status: 'Paid', type: 'Invoice', date: today },
    ]);

    const stats = await dashboardService.getEnrichedStats();

    expect(stats.totalRevenue).toBe(50000);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 7 — Plan distribution isolation
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 7: Plans repository getCompanySubscriptions scopes to real companies only', async () => {
    const plansRepo = new PlansRepository(mockPrisma);
    mockPrisma.subscription.findMany.mockResolvedValue([
      { id: 'sub-bgjv', company: 'BGJV', plan: 'PREMIUM', status: 'Active' },
    ]);

    const subs = await plansRepo.getCompanySubscriptions();

    expect(subs.length).toBe(1);
    expect(subs[0].company).toBe('BGJV');
    expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
      where: {
        companyRelation: {
          isDemo: false,
        },
      },
      select: { id: true, company: true, plan: true, status: true },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 8 — SubscriptionsRepository findAll scopes to isDemo
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 8: SubscriptionsRepository applies isDemo filter correctly', async () => {
    const repo = new SubscriptionsRepository(mockPrisma);
    mockPrisma.subscription.findMany.mockResolvedValue([]);

    await repo.findAll({ isDemo: false });

    expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
      where: {
        companyRelation: {
          isDemo: false,
        },
      },
      include: {
        companyRelation: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 9 — Platform reports repository excludes demo companies
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 9: Platform reports repository queries exclude demo data', async () => {
    const reportsRepo = new PlatformReportsRepository(mockPrisma);
    mockPrisma.subscription.findMany.mockResolvedValue([]);
    mockPrisma.employee.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.payroll.findMany.mockResolvedValue([]);
    mockPrisma.attendance.findMany.mockResolvedValue([]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
    mockPrisma.candidate.findMany.mockResolvedValue([]);

    await reportsRepo.getCompanyReport({});
    expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyRelation: { isDemo: false },
        }),
      }),
    );

    await reportsRepo.getEmployeeReport({});
    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          company: { isDemo: false },
        }),
      }),
    );

    await reportsRepo.getRevenueReport({});
    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          subscription: {
            companyRelation: { isDemo: false },
          },
        },
      }),
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 10 — Real tenant visibility preserved
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 10: Real tenant BGJV remains isDemo: false and visible in production metrics', async () => {
    const today = getBusinessDateString();
    mockRepo.findAll.mockResolvedValue([
      { id: 'bgjv-sub', company: 'BGJV', status: SubscriptionStatus.ACTIVE, amount: 15000, cycle: 'Annual', expiry: '2027-01-01' },
    ]);
    mockPrisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-bgjv-1', amount: 15000, status: 'Paid', type: 'Invoice', date: today },
    ]);

    const stats = await dashboardService.getEnrichedStats();

    expect(stats.totalCompanies).toBe(1);
    expect(stats.activeSubscriptions).toBe(1);
    expect(stats.totalRevenue).toBe(15000);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 11 — Double counting prevention across mixed statuses
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 11: Mutually exclusive status assignment prevents double counting in production', async () => {
    const today = getBusinessDateString();
    const subs = [
      { id: '1', company: 'A', status: SubscriptionStatus.ACTIVE, amount: 1000, cycle: 'Monthly', expiry: '2027-01-01' },
      { id: '2', company: 'B', status: SubscriptionStatus.EXPIRED, amount: 1000, cycle: 'Monthly', expiry: '2024-01-01' },
    ];
    mockRepo.findAll.mockResolvedValue(subs);
    mockPrisma.invoice.findMany.mockResolvedValue([]);

    const stats = await dashboardService.getEnrichedStats();

    expect(stats.activeSubscriptions).toBe(1);
    expect(stats.expired).toBe(1);
    expect(stats.trialCompanies).toBe(0);
    expect(stats.totalCompanies).toBe(2);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 12 — Churn rate calculation for real tenants
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 12: Churn rate calculated strictly from real tenants population', async () => {
    const realSubs = [
      { id: 'r1', company: 'R1', status: SubscriptionStatus.ACTIVE, amount: 1000, cycle: 'Monthly', expiry: '2027-01-01' },
      { id: 'r2', company: 'R2', status: SubscriptionStatus.CANCELLED, amount: 1000, cycle: 'Monthly', expiry: '2027-01-01' },
    ];
    mockRepo.findAll.mockResolvedValue(realSubs);
    mockPrisma.invoice.findMany.mockResolvedValue([]);

    const stats = await dashboardService.getEnrichedStats();

    expect(stats.totalCompanies).toBe(2);
    expect(stats.cancelled).toBe(1);
    expect(stats.churnRate).toBe(50); // 1 / 2 * 100
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 13 — SubscriptionsService.getSubscriptions() scopes to isDemo: false by default
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 13: SubscriptionsService.getSubscriptions() passes isDemo: false by default to repository', async () => {
    const { SubscriptionsService } = await import('./subscriptions.service');
    const mockBilling = { getAllInvoices: jest.fn().mockResolvedValue([]) };
    const subService = new SubscriptionsService(
      mockRepo,
      {} as any,
      {} as any,
      mockBilling as any,
      dashboardService,
      {} as any,
      {} as any,
    );

    mockRepo.findAll.mockResolvedValue([
      { id: 'real-1', company: 'Real Co', companyRelation: { isDemo: false } },
    ]);

    const result = await subService.getSubscriptions();

    expect(mockRepo.findAll).toHaveBeenCalledWith({
      page: undefined,
      limit: undefined,
      isDemo: false,
    });
    expect(result.subscriptions).toHaveLength(1);
    expect(result.subscriptions[0].company).toBe('Real Co');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 14 — SubscriptionBillingService.getAllInvoices() scopes to isDemo: false
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 14: SubscriptionBillingService.getAllInvoices() queries real invoices only', async () => {
    const { SubscriptionBillingService } = await import('./subscription-billing.service');
    const billingService = new SubscriptionBillingService(mockPrisma);

    mockPrisma.invoice.findMany.mockResolvedValue([
      { id: 'INV-REAL', amount: 15000, company: 'BGJV' },
    ]);

    const invoices = await billingService.getAllInvoices();

    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith({
      where: {
        subscription: {
          companyRelation: {
            isDemo: false,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
    expect(invoices).toHaveLength(1);
    expect(invoices[0].id).toBe('INV-REAL');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 15 — RecruitmentRepository.getPlatformOverview() scopes to isDemo: false
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 15: RecruitmentRepository.getPlatformOverview() excludes demo candidates & jobs', async () => {
    const { RecruitmentRepository } = await import('../../recruitment/repositories/recruitment.repository');
    mockPrisma.jobRequisition = {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    };
    mockPrisma.candidate = {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    };

    const recruitmentRepo = new RecruitmentRepository(mockPrisma);
    const overview = await recruitmentRepo.getPlatformOverview();

    expect(mockPrisma.jobRequisition.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subscription: {
            companyRelation: {
              isDemo: false,
            },
          },
        }),
      }),
    );
    expect(overview.totalOpenJobs).toBe(0);
    expect(overview.totalCandidates).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 16 — TicketsService.getTicketStats() scopes to isDemo: false
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 16: TicketsService.getTicketStats() calls ticketsRepository with isDemo: false', async () => {
    const { TicketsService } = await import('../../tickets/services/tickets.service');
    const mockTicketsRepo = {
      findAll: jest.fn().mockResolvedValue([
        { id: 'T-1', status: 'Open', priority: 'High' },
      ]),
      countStats: jest.fn().mockResolvedValue({
        total: 1,
        open: 1,
        inProgress: 0,
        resolved: 0,
        closed: 0,
        critical: 1,
      }),
    };
    const ticketsService = new TicketsService(mockTicketsRepo as any, mockPrisma);
    const stats = await ticketsService.getTicketStats();

    expect(mockTicketsRepo.countStats).toHaveBeenCalledWith({ isDemo: false });
    expect(stats.open).toBe(1);
    expect(stats.critical).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 17 — EmployeesRepository platform vs tenant query scoping
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 17: EmployeesRepository findMany scopes to isDemo: false when tenantId is null, and respects explicit tenantId', async () => {
    const { EmployeesRepository } = await import('../../employees/repositories/employees.repository');
    const mockContext: any = { isPlatform: jest.fn().mockReturnValue(true), getCompanyId: jest.fn().mockReturnValue(null) };
    mockPrisma.employee = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const empRepo = new EmployeesRepository(mockPrisma, mockContext);

    // 1. Platform query (tenantId: null)
    await empRepo.findMany({ tenantCompanyId: null });
    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          company: { isDemo: false },
        }),
      }),
    );

    // 2. Tenant query (tenantId: 'C1')
    await empRepo.findMany({ tenantCompanyId: 'C1' });
    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'C1',
        }),
      }),
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 18 — AttendanceRepository platform vs tenant query scoping
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 18: AttendanceRepository findMany scopes to employee.company.isDemo: false when companyId is null', async () => {
    const { AttendanceRepository } = await import('../../attendance/repositories/attendance.repository');
    mockPrisma.extended = {
      attendance: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const attendanceRepo = new AttendanceRepository(mockPrisma);

    // 1. Platform query
    await attendanceRepo.findMany({ companyId: null });
    expect(mockPrisma.extended.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employee: { company: { isDemo: false } },
        }),
      }),
    );

    // 2. Explicit tenant query
    await attendanceRepo.findMany({ companyId: 'C1' });
    expect(mockPrisma.extended.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employee: { OR: [{ companyId: 'C1' }, { subscriptionId: 'C1' }] },
        }),
      }),
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 19 — LeaveRepository platform vs tenant query scoping
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 19: LeaveRepository findManyRequests scopes to employee.company.isDemo: false when tenantId is null', async () => {
    const { LeaveRepository } = await import('../../leave/repositories/leave.repository');
    const mockContext: any = { isPlatform: jest.fn().mockReturnValue(true), getCompanyId: jest.fn().mockReturnValue(null) };
    mockPrisma.leaveRequest = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const leaveRepo = new LeaveRepository(mockPrisma, mockContext);

    // 1. Platform query
    await leaveRepo.findManyRequests({ tenantCompanyId: null });
    expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employee: { company: { isDemo: false } },
        }),
      }),
    );

    // 2. Explicit tenant query
    await leaveRepo.findManyRequests({ tenantCompanyId: 'C1' });
    expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employee: { companyId: 'C1' },
        }),
      }),
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 20 — PayrollRepository platform vs tenant query scoping
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 20: PayrollRepository findMany scopes to employee.company.isDemo: false when companyId is null', async () => {
    const { PayrollRepository } = await import('../../payroll/repositories/payroll.repository');
    mockPrisma.payroll = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const payrollRepo = new PayrollRepository(mockPrisma);

    // 1. Platform query
    await payrollRepo.findMany({ companyId: null });
    expect(mockPrisma.payroll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employee: { company: { isDemo: false } },
        }),
      }),
    );

    // 2. Explicit tenant query
    await payrollRepo.findMany({ companyId: 'C1' });
    expect(mockPrisma.payroll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employee: { companyId: 'C1' },
        }),
      }),
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 21 — DepartmentsRepository & DocumentsRepository platform isolation
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 21: DepartmentsRepository and DocumentsRepository scope to non-demo when isPlatform is true', async () => {
    const { DepartmentsRepository } = await import('../../departments/repositories/departments.repository');
    const { DocumentsRepository } = await import('../../documents/repositories/documents.repository');

    const mockContext: any = { isPlatform: jest.fn().mockReturnValue(true), getCompanyId: jest.fn().mockReturnValue(null) };
    mockPrisma.department = { findMany: jest.fn().mockResolvedValue([]) };
    mockPrisma.document = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };

    const deptRepo = new DepartmentsRepository(mockPrisma, mockContext);
    await deptRepo.findAllDepartments();
    expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { company: { isDemo: false } },
            { subscription: { companyRelation: { isDemo: false } } },
          ],
        }),
      }),
    );

    const docRepo = new DocumentsRepository(mockPrisma);
    await docRepo.findMany({ isPlatformBypass: true, companyId: '', isSuperAdmin: true });
    expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          company: { isDemo: false },
        }),
      }),
    );
  });
});
