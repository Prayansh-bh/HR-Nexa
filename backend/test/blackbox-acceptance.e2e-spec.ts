import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/modules/auth/services/token.service';
import { Role } from '../src/modules/auth/role.enum';
import { Permission } from '../src/modules/auth/permissions.enum';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

import * as classValidator from 'class-validator';
import * as classTransformer from 'class-transformer';

jest.setTimeout(30000);

describe('HR NEXA Blackbox Acceptance E2E Audit', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: TokenService;

  // Tenant 1 (Acme Corp)
  const TENANT_1_ID = 'TENANT-ACME-01';
  let hrAdminToken: string;
  let managerToken: string;
  let employeeToken: string;

  // Tenant 2 (Beta Corp)
  const TENANT_2_ID = 'TENANT-BETA-02';
  let tenant2AdminToken: string;

  const EMP_ADMIN_ID = 'EMP-ADM-001';
  const EMP_MGR_ID = 'EMP-MGR-001';
  const EMP_STAFF_ID = 'EMP-STF-001';
  const EMP_TENANT2_ID = 'EMP-BETA-001';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        validatorPackage: classValidator,
        transformerPackage: classTransformer,
        whitelist: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    tokenService = moduleFixture.get<TokenService>(TokenService);

    // Clean up test records
    await prisma.exit.deleteMany({ where: { companyId: { in: [TENANT_1_ID, TENANT_2_ID] } } });
    await prisma.leaveRequest.deleteMany({ where: { companyId: { in: [TENANT_1_ID, TENANT_2_ID] } } });
    await prisma.attendance.deleteMany({ where: { employeeId: { in: [EMP_ADMIN_ID, EMP_MGR_ID, EMP_STAFF_ID, EMP_TENANT2_ID] } } });
    await prisma.payroll.deleteMany({ where: { companyId: { in: [TENANT_1_ID, TENANT_2_ID] } } });
    await prisma.payrollInput.deleteMany({ where: { companyId: { in: [TENANT_1_ID, TENANT_2_ID] } } });
    await prisma.candidate.deleteMany({ where: { subscriptionId: { in: [TENANT_1_ID, TENANT_2_ID] } } });
    await prisma.employee.deleteMany({ where: { id: { in: [EMP_ADMIN_ID, EMP_MGR_ID, EMP_STAFF_ID, EMP_TENANT2_ID] } } });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['admin@acme.test', 'mgr@acme.test', 'staff@acme.test', 'admin@beta.test'],
        },
      },
    });
    await prisma.subscription.deleteMany({ where: { id: { in: [TENANT_1_ID, TENANT_2_ID] } } });
    await prisma.company.deleteMany({ where: { id: { in: [TENANT_1_ID, TENANT_2_ID] } } });

    // 1. Provision Tenant 1 & 2 Companies and Subscriptions
    await prisma.company.create({ data: { id: TENANT_1_ID, name: 'Acme Corporation' } });
    await prisma.company.create({ data: { id: TENANT_2_ID, name: 'Beta Systems' } });

    await prisma.subscription.create({
      data: {
        id: TENANT_1_ID,
        companyId: TENANT_1_ID,
        company: 'Acme Corporation',
        plan: 'Enterprise',
        cycle: 'monthly',
        start: '2026-01-01',
        expiry: '2030-01-01',
        amount: 9999,
        status: 'Active',
      },
    });

    await prisma.subscription.create({
      data: {
        id: TENANT_2_ID,
        companyId: TENANT_2_ID,
        company: 'Beta Systems',
        plan: 'Enterprise',
        cycle: 'monthly',
        start: '2026-01-01',
        expiry: '2030-01-01',
        amount: 9999,
        status: 'Active',
      },
    });

    // 2. Create Users & Employees for Tenant 1
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@acme.test',
        password: 'hashedpassword',
        name: 'Priya Menon',
        role: Role.HRAdmin,
        companyId: TENANT_1_ID,
        subscriptionId: TENANT_1_ID,
      },
    });

    const mgrUser = await prisma.user.create({
      data: {
        email: 'mgr@acme.test',
        password: 'hashedpassword',
        name: 'Manager Bob',
        role: Role.Manager,
        companyId: TENANT_1_ID,
        subscriptionId: TENANT_1_ID,
      },
    });

    const staffUser = await prisma.user.create({
      data: {
        email: 'staff@acme.test',
        password: 'hashedpassword',
        name: 'Staff Alice',
        role: Role.Employee,
        companyId: TENANT_1_ID,
        subscriptionId: TENANT_1_ID,
      },
    });

    // Tenant 2 Admin
    const tenant2Admin = await prisma.user.create({
      data: {
        email: 'admin@beta.test',
        password: 'hashedpassword',
        name: 'Beta Admin',
        role: Role.HRAdmin,
        companyId: TENANT_2_ID,
        subscriptionId: TENANT_2_ID,
      },
    });

    // 3. Create Linked Employee Records
    await prisma.employee.create({
      data: {
        id: EMP_ADMIN_ID,
        userId: adminUser.id,
        name: 'Priya Menon',
        email: 'admin@acme.test',
        department: 'Human Resources',
        designation: 'HR Director',
        location: 'Bangalore HQ',
        status: 'Active',
        salary: 150000,
        joined: '2025-01-01',
        avatar: '',
        companyId: TENANT_1_ID,
        subscriptionId: TENANT_1_ID,
      },
    });

    await prisma.employee.create({
      data: {
        id: EMP_MGR_ID,
        userId: mgrUser.id,
        name: 'Manager Bob',
        email: 'mgr@acme.test',
        department: 'Engineering',
        designation: 'Engineering Manager',
        location: 'Bangalore HQ',
        status: 'Active',
        salary: 120000,
        joined: '2025-02-01',
        avatar: '',
        companyId: TENANT_1_ID,
        subscriptionId: TENANT_1_ID,
      },
    });

    await prisma.employee.create({
      data: {
        id: EMP_STAFF_ID,
        userId: staffUser.id,
        name: 'Staff Alice',
        email: 'staff@acme.test',
        department: 'Engineering',
        designation: 'Software Engineer',
        location: 'Bangalore HQ',
        status: 'Active',
        salary: 80000,
        joined: '2025-03-01',
        avatar: '',
        companyId: TENANT_1_ID,
        subscriptionId: TENANT_1_ID,
      },
    });

    await prisma.employee.create({
      data: {
        id: EMP_TENANT2_ID,
        userId: tenant2Admin.id,
        name: 'Beta Admin',
        email: 'admin@beta.test',
        department: 'Executive',
        designation: 'Managing Director',
        location: 'Mumbai Tech Hub',
        status: 'Active',
        salary: 200000,
        joined: '2025-01-01',
        avatar: '',
        companyId: TENANT_2_ID,
        subscriptionId: TENANT_2_ID,
      },
    });

    // 4. Generate Authoritative Auth Tokens
    hrAdminToken = tokenService.generateAccessToken({
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      companyId: TENANT_1_ID,
      subscriptionId: TENANT_1_ID,
      pv: 0,
      sv: 0,
    });

    managerToken = tokenService.generateAccessToken({
      sub: mgrUser.id,
      email: mgrUser.email,
      role: mgrUser.role,
      companyId: TENANT_1_ID,
      subscriptionId: TENANT_1_ID,
      pv: 0,
      sv: 0,
    });

    employeeToken = tokenService.generateAccessToken({
      sub: staffUser.id,
      email: staffUser.email,
      role: staffUser.role,
      companyId: TENANT_1_ID,
      subscriptionId: TENANT_1_ID,
      pv: 0,
      sv: 0,
    });

    tenant2AdminToken = tokenService.generateAccessToken({
      sub: tenant2Admin.id,
      email: tenant2Admin.email,
      role: tenant2Admin.role,
      companyId: TENANT_2_ID,
      subscriptionId: TENANT_2_ID,
      pv: 0,
      sv: 0,
    });
  });

  afterAll(async () => {
    // Teardown test records
    if (prisma) {
      await prisma.exit.deleteMany({ where: { companyId: { in: [TENANT_1_ID, TENANT_2_ID] } } });
      await prisma.leaveRequest.deleteMany({ where: { companyId: { in: [TENANT_1_ID, TENANT_2_ID] } } });
      await prisma.attendance.deleteMany({ where: { employeeId: { in: [EMP_ADMIN_ID, EMP_MGR_ID, EMP_STAFF_ID, EMP_TENANT2_ID] } } });
      await prisma.payroll.deleteMany({ where: { companyId: { in: [TENANT_1_ID, TENANT_2_ID] } } });
      await prisma.payrollInput.deleteMany({ where: { companyId: { in: [TENANT_1_ID, TENANT_2_ID] } } });
      await prisma.candidate.deleteMany({ where: { subscriptionId: { in: [TENANT_1_ID, TENANT_2_ID] } } });
      await prisma.employee.deleteMany({ where: { id: { in: [EMP_ADMIN_ID, EMP_MGR_ID, EMP_STAFF_ID, EMP_TENANT2_ID] } } });
      await prisma.user.deleteMany({
        where: {
          email: {
            in: ['admin@acme.test', 'mgr@acme.test', 'staff@acme.test', 'admin@beta.test'],
          },
        },
      });
      await prisma.subscription.deleteMany({ where: { id: { in: [TENANT_1_ID, TENANT_2_ID] } } });
      await prisma.company.deleteMany({ where: { id: { in: [TENANT_1_ID, TENANT_2_ID] } } });
    }
    if (app) {
      await app.close();
    }
  });

  describe('1. Add Employee & Location / Branch E2E', () => {
    it('should create employee with custom tenant branch location and persist to DB', async () => {
      const res = await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({
          name: 'Rajesh Kumar',
          email: 'rajesh.k@acme.test',
          department: 'Engineering',
          designation: 'Senior Backend Engineer',
          location: 'Pune Development Center',
          salary: 95000,
          joined: '2026-08-01',
          status: 'Active',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Rajesh Kumar');
      expect(res.body.location).toBe('Pune Development Center');

      // Verify PostgreSQL DB State
      const dbRecord = await prisma.employee.findFirst({
        where: { email: 'rajesh.k@acme.test', companyId: TENANT_1_ID },
      });
      expect(dbRecord).toBeDefined();
      expect(dbRecord?.location).toBe('Pune Development Center');

      // Clean up newly added employee
      if (dbRecord) {
        await prisma.employee.delete({ where: { id: dbRecord.id } });
      }
    });
  });

  describe('2. Manual Attendance E2E', () => {
    it('should save manual attendance record for employee with in/out times and status', async () => {
      const res = await request(app.getHttpServer())
        .post('/attendance/clock')
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({
          employeeId: EMP_STAFF_ID,
          date: '2026-08-10',
          inTime: '09:15',
          outTime: '18:15',
          status: 'Present',
          remarks: 'Manual entry verified by HR',
        });

      expect(res.status).toBe(201);
      expect(res.body.employeeId).toBe(EMP_STAFF_ID);
      expect(res.body.inTime).toBe('09:15');
      expect(res.body.outTime).toBe('18:15');

      // Verify PostgreSQL DB State
      const record = await prisma.attendance.findFirst({
        where: { employeeId: EMP_STAFF_ID, date: '2026-08-10' },
      });
      expect(record).toBeDefined();
      expect(record?.status).toBe('Present');
    });
  });

  describe('3. Employee Self Clock In & Clock Out E2E', () => {
    it('should record Clock In (inTime) for authenticated employee', async () => {
      const res = await request(app.getHttpServer())
        .post('/attendance/clock')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          date: '2026-08-18',
          inTime: '09:00',
        });

      expect(res.status).toBe(201);
      expect(res.body.employeeId).toBe(EMP_STAFF_ID);
      expect(res.body.inTime).toBe('09:00');
      expect(res.body.outTime).toBeNull();
    });

    it('should record Clock Out (outTime) updating the existing today record', async () => {
      const res = await request(app.getHttpServer())
        .post('/attendance/clock')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          date: '2026-08-18',
          outTime: '18:00',
        });

      expect(res.status).toBe(201);
      expect(res.body.inTime).toBe('09:00');
      expect(res.body.outTime).toBe('18:00');

      // Verify PostgreSQL DB State
      const record = await prisma.attendance.findFirst({
        where: { employeeId: EMP_STAFF_ID, date: '2026-08-18' },
      });
      expect(record?.outTime).toBe('18:00');
    });
  });

  describe('4. Apply Leave E2E', () => {
    it('should apply leave with { from, to } payload and persist PENDING request', async () => {
      const res = await request(app.getHttpServer())
        .post('/leaves')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          type: 'Casual Leave',
          from: '2026-08-20',
          to: '2026-08-21',
          reason: 'Family function attendance',
        });

      expect(res.status).toBe(201);
      expect(res.body.employeeId).toBe(EMP_STAFF_ID);
      expect(res.body.status).toBe('PENDING');

      // Verify PostgreSQL DB State
      const dbLeave = await prisma.leaveRequest.findFirst({
        where: { employeeId: EMP_STAFF_ID, from: '2026-08-20' },
      });
      expect(dbLeave).toBeDefined();
      expect(dbLeave?.type).toBe('Casual Leave');
    });
  });

  describe('5. Submit Resignation E2E', () => {
    it('should allow employee to submit resignation and create timeline record', async () => {
      const res = await request(app.getHttpServer())
        .post('/exit')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          reason: 'Career transition and higher education',
          proposedLastWorkingDay: '2026-10-31T00:00:00.000Z',
          noticeBuyoutRequest: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.employeeId).toBe(EMP_STAFF_ID);
      expect(res.body.stage).toBe('SUBMITTED');
      expect(res.body.status).toBe('PENDING');

      // Verify PostgreSQL DB State
      const exitRecord = await prisma.exit.findFirst({
        where: { employeeId: EMP_STAFF_ID, companyId: TENANT_1_ID },
      });
      expect(exitRecord).toBeDefined();
      expect(exitRecord?.reason).toBe('Career transition and higher education');
    });

    it('should reject duplicate resignation for employee while active exit exists', async () => {
      const res = await request(app.getHttpServer())
        .post('/exit')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          reason: 'Second resignation attempt',
          proposedLastWorkingDay: '2026-10-31T00:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('active resignation already exists');
    });
  });

  describe('6. Payroll Calculation & Process Batch E2E', () => {
    it('should preview payroll calculation accurately including salary components and deductions', async () => {
      const res = await request(app.getHttpServer())
        .post('/payroll/calculate')
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({
          month: 'August 2026',
        });

      expect(res.status).toBe(201);
      expect(Array.isArray(res.body)).toBe(true);
      const staffCalc = res.body.find((p: any) => p.employeeId === EMP_STAFF_ID);
      expect(staffCalc).toBeDefined();
      expect(staffCalc.gross).toBeGreaterThan(0);
      expect(staffCalc.net).toBeGreaterThan(0);
    });

    it('should process batch payroll and persist authoritative payroll records to PostgreSQL', async () => {
      const res = await request(app.getHttpServer())
        .post('/payroll/process')
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({
          month: 'August 2026',
          payDate: '2026-08-31',
          status: 'Processed',
          adjustments: {
            [EMP_STAFF_ID]: {
              LOPDays: 0,
              overtimeHours: 0,
              bonus: 2000,
              deductions: 500,
              remarks: 'Performance bonus added',
            },
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.count).toBeGreaterThanOrEqual(1);

      // Verify PostgreSQL DB State
      const staffPayroll = await prisma.payroll.findUnique({
        where: { employeeId_month: { employeeId: EMP_STAFF_ID, month: 'August 2026' } },
      });
      expect(staffPayroll).toBeDefined();
      expect(staffPayroll?.status).toBe('PROCESSED');
    });
  });

  describe('7. Offer Letter Generation E2E', () => {
    it('should generate branded HTML offer letter, store in document storage, and persist Offer record', async () => {
      // 1. Create a candidate
      const cand = await prisma.candidate.create({
        data: {
          name: 'Vikram Mehta',
          email: 'vikram.m@external.test',
          jobTitle: 'Lead Architect',
          stage: 'Interview',
          rating: 4.8,
          subscriptionId: TENANT_1_ID,
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/recruitment/candidates/${cand.id}/generate-offer`)
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({
          annualCTC: 1800000,
          joiningDate: '2026-10-01',
          designation: 'Lead Architect',
          expiryDate: '2026-09-15',
        });

      expect(res.status).toBe(201);
      expect(res.body.offer).toBeDefined();
      expect(res.body.offer.annualCTC).toBe(1800000);
      expect(res.body.document).toBeDefined();

      // Verify PostgreSQL DB State
      const offerRecord = await prisma.offer.findUnique({
        where: { candidateId: cand.id },
      });
      expect(offerRecord).toBeDefined();
      expect(offerRecord?.annualCTC).toBe(1800000);
      expect(offerRecord?.status).toBe('GENERATED');
    });
  });

  describe('8. Multi-Tenant Isolation Verification E2E', () => {
    it('should strictly isolate Tenant 1 data from Tenant 2 (Tenant 2 cannot read Tenant 1 employees or payroll)', async () => {
      // Tenant 2 admin requests employee list
      const empRes = await request(app.getHttpServer())
        .get('/employees')
        .set('Authorization', `Bearer ${tenant2AdminToken}`);

      expect(empRes.status).toBe(200);
      const returnedIds = empRes.body.map((e: any) => e.id);
      expect(returnedIds).toContain(EMP_TENANT2_ID);
      expect(returnedIds).not.toContain(EMP_STAFF_ID);
      expect(returnedIds).not.toContain(EMP_ADMIN_ID);

      // Tenant 2 admin attempts to view Tenant 1 payroll
      const payrollRes = await request(app.getHttpServer())
        .get('/payroll?month=August%202026')
        .set('Authorization', `Bearer ${tenant2AdminToken}`);

      expect(payrollRes.status).toBe(200);
      const payrollEmpIds = payrollRes.body.map((p: any) => p.employeeId);
      expect(payrollEmpIds).not.toContain(EMP_STAFF_ID);
    });
  });
});
