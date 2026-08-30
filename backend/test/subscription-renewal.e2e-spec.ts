import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as classValidator from 'class-validator';
import * as classTransformer from 'class-transformer';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/modules/auth/services/token.service';
import { getBusinessDateString, calculateSubscriptionExpiry } from '../src/common/utils/date.util';

describe('Subscription Renewal & Trial Extension (e2e with Mocked DB Provider)', () => {
  let app: INestApplication;
  let tokenService: TokenService;

  let superAdminToken: string;
  let tenantAdminToken: string;

  const todayStr = getBusinessDateString();

  let subDb: Record<string, any> = {};
  let invoicesDb: any[] = [];
  let eventsDb: any[] = [];
  let auditLogsDb: any[] = [];

  const mockTx = {
    $queryRaw: jest.fn().mockImplementation(async (strings: TemplateStringsArray, id: string) => {
      const sub = subDb[id];
      return sub ? [sub] : [];
    }),
    saaSPlanNew: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'PLAN-PRO',
        name: 'Growth',
        status: 'Active',
      }),
    },
    planVersion: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'VER-1',
        version: 1,
        monthlyPrice: 2999,
        yearlyPrice: 29990,
        employeeLimit: 25,
        storageLimitGB: 25,
      }),
    },
    invoice: {
      create: jest.fn().mockImplementation(async (args) => {
        invoicesDb.push(args.data);
        return args.data;
      }),
      update: jest.fn().mockImplementation(async (args) => {
        const inv = invoicesDb.find((i) => i.id === args.where.id);
        if (inv) Object.assign(inv, args.data);
        return inv;
      }),
    },
    subscription: {
      update: jest.fn().mockImplementation(async (args) => {
        const sub = subDb[args.where.id];
        if (sub) Object.assign(sub, args.data);
        return sub;
      }),
    },
    subscriptionEvent: {
      create: jest.fn().mockImplementation(async (args) => {
        eventsDb.push(args.data);
        return args.data;
      }),
    },
  };

  const mockPrismaService = {
    $transaction: jest.fn().mockImplementation(async (cb) => {
      return cb(mockTx);
    }),
    subscription: {
      findUnique: jest.fn().mockImplementation(async (args) => {
        return subDb[args.where.id] || null;
      }),
      update: jest.fn().mockImplementation(async (args) => {
        const sub = subDb[args.where.id];
        if (sub) Object.assign(sub, args.data);
        return sub;
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    subscriptionEvent: {
      create: jest.fn().mockImplementation(async (args) => {
        eventsDb.push(args.data);
        return args.data;
      }),
    },
    invoice: {
      findMany: jest.fn().mockImplementation(async (args) => {
        return invoicesDb.filter((i) => i.subscriptionId === args.where?.subscriptionId);
      }),
    },
    saaSPlanNew: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'PLAN-PRO',
        name: 'Growth',
        status: 'Active',
      }),
    },
    planVersion: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'VER-1',
        version: 1,
        monthlyPrice: 2999,
        yearlyPrice: 29990,
        employeeLimit: 25,
        storageLimitGB: 25,
      }),
    },
    user: {
      findUnique: jest.fn().mockImplementation(async (args) => {
        if (args.where?.id === 'sa-user-1' || args.where?.email === 'superadmin@test.com') {
          return {
            id: 'sa-user-1',
            email: 'superadmin@test.com',
            role: 'SuperAdmin',
            name: 'Super Admin',
            companyId: null,
            permissionVersion: 1,
            sessionVersion: 1,
            status: 'Active',
          };
        }
        if (args.where?.id === 'hr-user-1' || args.where?.email === 'hradmin@test.com') {
          return {
            id: 'hr-user-1',
            email: 'hradmin@test.com',
            role: 'HRAdmin',
            name: 'HR Admin',
            companyId: 'COMP_1',
            permissionVersion: 1,
            sessionVersion: 1,
            status: 'Active',
            subscription: {
              id: 'SUB_ACTIVE',
              status: 'Active',
              expiry: '2026-09-01',
            },
          };
        }
        return null;
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    systemSetting: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    systemConfig: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    blacklistedToken: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    userSession: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    role: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    auditLog: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async (args) => {
        auditLogsDb.push(args.data);
        return args.data;
      }),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['/', 'health'] });
    app.useGlobalPipes(
      new ValidationPipe({
        validatorPackage: classValidator,
        transformerPackage: classTransformer,
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    tokenService = moduleFixture.get<TokenService>(TokenService);

    superAdminToken = tokenService.sign({
      sub: 'sa-user-1',
      email: 'superadmin@test.com',
      role: 'SuperAdmin',
      name: 'Super Admin',
      companyId: 'PLATFORM',
    });

    tenantAdminToken = tokenService.sign({
      sub: 'hr-user-1',
      email: 'hradmin@test.com',
      role: 'HRAdmin',
      name: 'HR Admin',
      companyId: 'COMP_1',
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Renewal Duration Contract & Validation (HTTP E2E)', () => {
    beforeEach(() => {
      subDb = {
        SUB_ACTIVE: {
          id: 'SUB_ACTIVE',
          company: 'Acme Corp',
          plan: 'Growth',
          cycle: 'Monthly',
          start: '2026-08-01',
          expiry: '2026-09-01',
          amount: 2999,
          status: 'Active',
        },
      };
      invoicesDb = [];
      eventsDb = [];
    });

    it('rejects unsupported duration (e.g. 5_YEARS) with HTTP 400', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_ACTIVE/renew')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ duration: '5_YEARS' });

      expect(res.status).toBe(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('duration must be one of')]),
      );
    });

    it('renews with explicit 14_DAYS duration (courtesy extension -> amount 0, cycle Trial)', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_ACTIVE/renew')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ duration: '14_DAYS' });

      expect(res.status).toBe(200);
      expect(res.body.amount).toBe(0);
      expect(res.body.cycle).toBe('Trial');
      expect(res.body.expiry).toBe('2026-09-15');
      expect(invoicesDb.length).toBe(0);
    });

    it('renews with explicit 1_MONTH duration -> Paid status & generates invoice', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_ACTIVE/renew')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ duration: '1_MONTH' });

      expect(res.status).toBe(200);
      expect(res.body.amount).toBe(2999);
      expect(res.body.cycle).toBe('Monthly');
      expect(res.body.expiry).toBe('2026-10-01');
      expect(res.body.status).toBe('Paid');
      expect(invoicesDb.length).toBe(1);
      expect(invoicesDb[0].status).toBe('Paid');
    });

    it('renews with explicit 1_YEAR duration -> Active status & yearly amount', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_ACTIVE/renew')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ duration: '1_YEAR' });

      expect(res.status).toBe(200);
      expect(res.body.amount).toBe(29990);
      expect(res.body.cycle).toBe('Annual');
      expect(res.body.expiry).toBe('2027-09-01');
      expect(res.body.status).toBe('Active');
    });

    it('empty body {} defaults to existing subscription cycle (backward compatibility)', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_ACTIVE/renew')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.cycle).toBe('Monthly');
      expect(res.body.expiry).toBe('2026-10-01');
    });
  });

  describe('2. Expired Subscription Renewal Anchor Verification (HTTP E2E)', () => {
    beforeEach(() => {
      subDb = {
        SUB_EXPIRED: {
          id: 'SUB_EXPIRED',
          company: 'Expired Corp',
          plan: 'Growth',
          cycle: 'Monthly',
          start: '2025-01-01',
          expiry: '2025-02-01', // Expired in 2025
          amount: 2999,
          status: 'Expired',
        },
      };
    });

    it('renewing expired subscription for 1 month anchors to today and never stays in past', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_EXPIRED/renew')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ duration: '1_MONTH' });

      expect(res.status).toBe(200);
      expect(res.body.start).toBe(todayStr);
      expect(res.body.expiry > todayStr).toBe(true);

      const expectedExpiry = calculateSubscriptionExpiry(todayStr, 'Monthly');
      expect(res.body.expiry).toBe(expectedExpiry);
    });

    it('renewing expired subscription for 14 days anchors to today', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_EXPIRED/renew')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ duration: '14_DAYS' });

      expect(res.status).toBe(200);
      expect(res.body.start).toBe(todayStr);
      expect(res.body.expiry > todayStr).toBe(true);

      const expectedExpiry = calculateSubscriptionExpiry(todayStr, 'Trial', 14);
      expect(res.body.expiry).toBe(expectedExpiry);
    });

    it('renewing expired subscription for 1 year anchors to today', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_EXPIRED/renew')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ duration: '1_YEAR' });

      expect(res.status).toBe(200);
      expect(res.body.start).toBe(todayStr);
      expect(res.body.expiry > todayStr).toBe(true);

      const expectedExpiry = calculateSubscriptionExpiry(todayStr, 'Annual');
      expect(res.body.expiry).toBe(expectedExpiry);
    });
  });

  describe('3. Extend Trial Endpoint & Validation (HTTP E2E)', () => {
    beforeEach(() => {
      subDb = {
        SUB_TRIAL: {
          id: 'SUB_TRIAL',
          company: 'Trial Corp',
          plan: 'Growth',
          cycle: 'Trial',
          start: '2026-08-10',
          expiry: '2026-08-24',
          amount: 0,
          status: 'Trial',
        },
      };
    });

    it('PUT /api/subscriptions/:id/extend-trial with days=14 advances expiry', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_TRIAL/extend-trial')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ days: 14 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('Trial');
      expect(res.body.expiry).toBe('2026-09-07');
    });

    it('PUT /api/subscriptions/:id/extend-trial on expired trial anchors to today', async () => {
      subDb.SUB_TRIAL.expiry = '2025-01-01';
      subDb.SUB_TRIAL.status = 'Expired';

      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_TRIAL/extend-trial')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ days: 14 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('Trial');
      expect(res.body.expiry > todayStr).toBe(true);
    });

    it('rejects invalid days=0 with HTTP 400', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_TRIAL/extend-trial')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ days: 0 });

      expect(res.status).toBe(400);
    });

    it('rejects invalid days=366 with HTTP 400', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_TRIAL/extend-trial')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ days: 366 });

      expect(res.status).toBe(400);
    });
  });

  describe('4. Authorization & RBAC Enforcement (HTTP E2E)', () => {
    beforeEach(() => {
      subDb = {
        SUB_ACTIVE: {
          id: 'SUB_ACTIVE',
          company: 'Acme Corp',
          plan: 'Growth',
          cycle: 'Monthly',
          start: '2026-08-01',
          expiry: '2026-09-01',
          amount: 2999,
          status: 'Active',
        },
      };
    });

    it('allows SuperAdmin to renew subscription', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_ACTIVE/renew')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ duration: '1_MONTH' });

      expect(res.status).toBe(200);
    });

    it('denies Tenant Admin (HRAdmin) from renewing subscription with HTTP 403', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_ACTIVE/renew')
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .send({ duration: '1_MONTH' });

      expect(res.status).toBe(403);
    });

    it('denies unauthenticated request with HTTP 401', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_ACTIVE/renew')
        .send({ duration: '1_MONTH' });

      expect(res.status).toBe(401);
    });

    it('denies Tenant Admin from extending trial with HTTP 403', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_ACTIVE/extend-trial')
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .send({ days: 14 });

      expect(res.status).toBe(403);
    });

    it('denies unauthenticated request to extend trial with HTTP 401', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_ACTIVE/extend-trial')
        .send({ days: 14 });

      expect(res.status).toBe(401);
    });
  });

  describe('5. Transactional Integrity & Concurrency (HTTP E2E)', () => {
    beforeEach(() => {
      subDb = {
        SUB_CONCUR: {
          id: 'SUB_CONCUR',
          company: 'Concurrent Corp',
          plan: 'Growth',
          cycle: 'Monthly',
          start: '2026-08-01',
          expiry: '2026-09-01',
          amount: 2999,
          status: 'Active',
        },
      };
      invoicesDb = [];
      eventsDb = [];
    });

    it('creates SubscriptionEvent and updates Subscription atomically', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/subscriptions/SUB_CONCUR/renew')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ duration: '1_MONTH' });

      expect(res.status).toBe(200);
      expect(eventsDb.length).toBe(1);
      expect(eventsDb[0].event).toBe('Renewed');
      expect(eventsDb[0].subscriptionId).toBe('SUB_CONCUR');
      expect(invoicesDb.length).toBe(1);
      expect(invoicesDb[0].status).toBe('Paid');
    });

    it('concurrent renewals serialize and update state cleanly', async () => {
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .put('/api/subscriptions/SUB_CONCUR/renew')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ duration: '1_MONTH' }),
        request(app.getHttpServer())
          .put('/api/subscriptions/SUB_CONCUR/renew')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ duration: '1_MONTH' }),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(subDb.SUB_CONCUR.expiry).toBe('2026-11-01');
      expect(invoicesDb.length).toBe(2);
      expect(eventsDb.length).toBe(2);
    });
  });
});

