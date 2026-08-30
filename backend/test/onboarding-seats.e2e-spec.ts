import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ConflictException } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/modules/auth/services/token.service';

jest.setTimeout(60000);

describe('Onboarding Seats & Subscription Refactoring (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: TokenService;
  let superAdminToken: string;

  const cleanUpDb = async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'admin@e2ecompanybasic.com',
            'admin@e2ecompanyprem.com',
            'admin@e2ecompanyconcur.com',
            'admin2@e2ecompanyprem.com',
            'sa-onboard-test@test.com',
          ],
        },
      },
    });
    const comps = await prisma.company.findMany({
      where: {
        name: {
          in: [
            'E2E Company Basic',
            'E2E Company Premium',
            'E2E Company Concurrency',
          ],
        },
      },
    });
    const compIds = comps.map((c) => c.id);
    if (compIds.length > 0) {
      await prisma.companyPlanAssignment.deleteMany({
        where: {
          company: {
            in: [
              'E2E Company Basic',
              'E2E Company Premium',
              'E2E Company Concurrency',
            ],
          },
        },
      });
      await prisma.invoice.deleteMany({
        where: { subscriptionId: { in: compIds } },
      });
      await prisma.subscription.deleteMany({
        where: { id: { in: compIds } },
      });
      await prisma.role.deleteMany({
        where: { companyId: { in: compIds } },
      });
      await prisma.department.deleteMany({
        where: { companyId: { in: compIds } },
      });
      await prisma.designation.deleteMany({
        where: { companyId: { in: compIds } },
      });
      await prisma.company.deleteMany({
        where: { id: { in: compIds } },
      });
    }
  };

  beforeAll(async () => {
    jest.setTimeout(45000); // 45 seconds timeout for remote Postgres DB latency

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    tokenService = moduleFixture.get<TokenService>(TokenService);

    // Clean up DB before running tests to prevent leftover state issues
    await cleanUpDb();

    // Seed dummy SuperAdmin user if missing
    let saUser = await prisma.user.findFirst({
      where: { role: 'SuperAdmin' },
    });
    if (!saUser) {
      saUser = await prisma.user.create({
        data: {
          email: 'sa-onboard-test@test.com',
          name: 'SA Onboard Test',
          password: 'hashedpassword',
          role: 'SuperAdmin',
          initials: 'SA',
        },
      });
    }

    superAdminToken = tokenService.sign({
      email: saUser.email,
      sub: saUser.id,
      role: saUser.role,
      companyId: 'PLATFORM',
      subscriptionId: null,
      pv: saUser.permissionVersion,
      sv: saUser.sessionVersion || 1,
    });
  });

  afterAll(async () => {
    await cleanUpDb();
    await app.close();
  });

  it('1. Onboarding PREMIUM assigns correct seats and storage limits from DB, and snapshots pricing', async () => {
    const res = await request(app.getHttpServer())
      .post('/subscriptions')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        company: 'E2E Company Premium',
        plan: 'PLAN_PREM',
        cycle: 'Annual',
        ownerEmail: 'admin@e2ecompanyprem.com',
        ownerName: 'E2E Admin Premium',
      });

    expect(res.status).toBe(201);
    expect(res.body.plan).toBe('PREMIUM');
    expect(res.body.purchasedSeats).toBe(500); // Dynamic from dynamic DB seeding limit
    expect(res.body.storageLimitMB).toBe(100 * 1024); // 100GB * 1024 = 102400
    expect(res.body.storageUsed).toBe('0 GB / 100 GB');

    // Verify Invoice snapshot
    const invoices = await prisma.invoice.findMany({
      where: { subscriptionId: res.body.id },
    });
    expect(invoices.length).toBe(1);
    expect(invoices[0].planName).toBe('PREMIUM');
    expect(invoices[0].planVersion).toBe(1);
    expect(invoices[0].seatCount).toBe(500);
    expect(invoices[0].storageGB).toBe(100);
    expect(Number(invoices[0].unitPrice)).toBe(180000);
  }, 60000);

  it('2. Onboarding on BASIC assigns correct seats and storage limits', async () => {
    const res = await request(app.getHttpServer())
      .post('/subscriptions')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        company: 'E2E Company Basic',
        plan: 'PLAN_BASIC',
        cycle: 'Monthly',
        ownerEmail: 'admin@e2ecompanybasic.com',
        ownerName: 'E2E Admin Basic',
      });

    expect(res.status).toBe(201);
    expect(res.body.plan).toBe('BASIC');
    expect(res.body.purchasedSeats).toBe(10); // Dynamic from dynamic DB
    expect(res.body.storageLimitMB).toBe(10 * 1024);
  }, 60000);

  it('3. Trying to onboard an already existing company name returns 409 Conflict', async () => {
    const res = await request(app.getHttpServer())
      .post('/subscriptions')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        company: 'E2E Company Premium',
        plan: 'PLAN_PREM',
        cycle: 'Annual',
        ownerEmail: 'admin2@e2ecompanyprem.com',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already exists');
  }, 60000);

  it('4. Trying to onboard with an invalid or archived plan throws BadRequestException', async () => {
    const res = await request(app.getHttpServer())
      .post('/subscriptions')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        company: 'E2E Invalid Plan Comp',
        plan: 'NON_EXISTENT_PLAN_CODE',
        cycle: 'Monthly',
      });

    expect(res.status).toBe(400);
  }, 60000);

  it('5. Storage purchase preserves used storage and Number() decimal parsing works', async () => {
    const onboardRes = await request(app.getHttpServer())
      .post('/subscriptions')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        company: 'E2E Company Concurrency',
        plan: 'PLAN_BASIC',
        cycle: 'Monthly',
        ownerEmail: 'admin@e2ecompanyconcur.com',
        ownerName: 'E2E Admin Concur',
      });

    expect(onboardRes.status).toBe(201);
    const subId = onboardRes.body.id;

    // Set storageUsedMB to 2048 (2 GB used)
    await prisma.subscription.update({
      where: { id: subId },
      data: {
        storageUsedMB: 2048,
        storageUsed: '2 GB / 10 GB',
      },
    });

    // Add 2.5 GB of storage
    const addRes = await request(app.getHttpServer())
      .post(`/subscriptions/${subId}/add-storage`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ storage: '2.5' });

    expect(addRes.status).toBe(201);
    expect(addRes.body.storageUsed).toBe('2 GB / 12.5 GB');

    const sub = await prisma.subscription.findUnique({
      where: { id: subId },
    });
    expect(sub?.storageLimitMB).toBe(12.5 * 1024);
    expect(sub?.storageUsedMB).toBe(2048);
  }, 60000);

  it('6. Concurrent upgrades are synchronized using row-level locking', async () => {
    const comps = await prisma.company.findMany({
      where: { name: 'E2E Company Concurrency' },
    });
    const subId = comps[0].id;

    // Start two concurrent upgrade requests to PREMIUM plan
    const req1 = request(app.getHttpServer())
      .put(`/subscriptions/${subId}/upgrade`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ plan: 'PLAN_PREM' });

    const req2 = request(app.getHttpServer())
      .put(`/subscriptions/${subId}/upgrade`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ plan: 'PLAN_PREM' });

    const [res1, res2] = await Promise.all([req1, req2]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Verify limit matches the Premium plan
    const sub = await prisma.subscription.findUnique({
      where: { id: subId },
    });
    expect(sub?.purchasedSeats).toBe(500);

    // Verify exactly one upgrade invoice was created for PLAN_PREM
    const invoices = await prisma.invoice.findMany({
      where: {
        subscriptionId: subId,
        id: { startsWith: 'INV-UPG-' },
      },
    });
    expect(invoices.length).toBe(1);
  }, 60000);
});
