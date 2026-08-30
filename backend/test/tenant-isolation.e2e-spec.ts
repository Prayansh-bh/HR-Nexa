import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/modules/auth/services/token.service';

describe('Tenant Isolation & Dynamic RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: TokenService;

  let companyAUserToken: string;
  let companyBUserToken: string;
  let superAdminUserToken: string;
  let companyARoleId: string;
  let companyBRoleId: string;
  let companyAManagerId: string;
  let companyBManagerId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    tokenService = moduleFixture.get<TokenService>(TokenService);

    // Clean up previous runs
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['usera@test.com', 'userb@test.com', 'superadmin@test.com'],
        },
      },
    });
    await prisma.employee.deleteMany({
      where: { id: { in: ['EMPA001', 'EMPB001'] } },
    });
    await prisma.role.deleteMany({
      where: { name: { in: ['RoleA', 'RoleB'] } },
    });
    await prisma.subscription.deleteMany({
      where: { id: { in: ['SUB_A', 'SUB_B'] } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: ['COMP_A', 'COMP_B'] } },
    });

    // 1. Create Companies & Subscriptions
    await prisma.company.create({ data: { id: 'COMP_A', name: 'Company A' } });
    await prisma.company.create({ data: { id: 'COMP_B', name: 'Company B' } });

    await prisma.subscription.create({
      data: {
        id: 'SUB_A',
        company: 'Company A',
        plan: 'PREMIUM',
        companyId: 'COMP_A',
        cycle: 'Monthly',
        start: '2026-07-29',
        expiry: '2027-07-29',
        amount: 999.0,
        status: 'Active',
      },
    });
    await prisma.subscription.create({
      data: {
        id: 'SUB_B',
        company: 'Company B',
        plan: 'PREMIUM',
        companyId: 'COMP_B',
        cycle: 'Monthly',
        start: '2026-07-29',
        expiry: '2027-07-29',
        amount: 999.0,
        status: 'Active',
      },
    });

    // 2. Create dynamic roles
    const roleA = await prisma.role.create({
      data: {
        name: 'RoleA',
        permissions: JSON.stringify([
          'employees:list:view',
          'employees:list:create',
          'employees:list:edit',
          'employees:list:delete',
          'settings:roles:view',
        ]),
        companyId: 'COMP_A',
      },
    });
    const roleB = await prisma.role.create({
      data: {
        name: 'RoleB',
        permissions: JSON.stringify(['employees:list:view']),
        companyId: 'COMP_B',
      },
    });
    companyARoleId = roleA.id;
    companyBRoleId = roleB.id;

    // 3. Create users
    const userA = await prisma.user.create({
      data: {
        email: 'usera@test.com',
        name: 'User A',
        password: 'hashedpassword',
        role: 'RoleA',
        roleId: roleA.id,
        subscriptionId: 'SUB_A',
        companyId: 'COMP_A',
        initials: 'UA',
      },
    });
    const userB = await prisma.user.create({
      data: {
        email: 'userb@test.com',
        name: 'User B',
        password: 'hashedpassword',
        role: 'RoleB',
        roleId: roleB.id,
        subscriptionId: 'SUB_B',
        companyId: 'COMP_B',
        initials: 'UB',
      },
    });
    const userSA = await prisma.user.create({
      data: {
        email: 'superadmin@test.com',
        name: 'Super Admin',
        password: 'hashedpassword',
        role: 'SuperAdmin',
        roleId: null,
        subscriptionId: null,
        companyId: null,
        initials: 'SA',
      },
    });

    // 4. Create employees
    const empA = await prisma.employee.create({
      data: {
        id: 'EMPA001',
        name: 'Employee A',
        email: 'usera@test.com',
        userId: userA.id,
        subscriptionId: 'SUB_A',
        companyId: 'COMP_A',
        joined: '2026-07-30',
        salary: 50000,
        status: 'Active',
        avatar: 'EA',
      },
    });
    const empB = await prisma.employee.create({
      data: {
        id: 'EMPB001',
        name: 'Employee B',
        email: 'userb@test.com',
        userId: userB.id,
        subscriptionId: 'SUB_B',
        companyId: 'COMP_B',
        joined: '2026-07-30',
        salary: 60000,
        status: 'Active',
        avatar: 'EB',
      },
    });
    companyAManagerId = empA.id;
    companyBManagerId = empB.id;

    // 5. Issue JWT tokens
    companyAUserToken = tokenService.sign({
      email: userA.email,
      sub: userA.id,
      role: userA.role,
      companyId: 'SUB_A',
      subscriptionId: 'SUB_A',
      pv: userA.permissionVersion,
      sv: userA.sessionVersion || 1,
    });
    companyBUserToken = tokenService.sign({
      email: userB.email,
      sub: userB.id,
      role: userB.role,
      companyId: 'SUB_B',
      subscriptionId: 'SUB_B',
      pv: userB.permissionVersion,
      sv: userB.sessionVersion || 1,
    });
    superAdminUserToken = tokenService.sign({
      email: userSA.email,
      sub: userSA.id,
      role: userSA.role,
      companyId: 'PLATFORM',
      subscriptionId: null,
      pv: userSA.permissionVersion,
      sv: userSA.sessionVersion || 1,
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['usera@test.com', 'userb@test.com', 'superadmin@test.com'],
        },
      },
    });
    await prisma.employee.deleteMany({
      where: { id: { in: ['EMPA001', 'EMPB001', 'EMPA002'] } },
    });
    await prisma.role.deleteMany({
      where: { name: { in: ['RoleA', 'RoleB'] } },
    });
    await prisma.subscription.deleteMany({
      where: { id: { in: ['SUB_A', 'SUB_B'] } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: ['COMP_A', 'COMP_B'] } },
    });
    await app.close();
  });

  it("1. Company A cannot assign Company B's role", async () => {
    const res = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${companyAUserToken}`)
      .send({
        id: 'EMPA002',
        name: 'New Employee',
        email: 'newemp@test.com',
        departmentName: 'Engineering',
        designation: 'Staff',
        joined: '2026-07-30',
        salary: 40000,
        status: 'Active',
        avatar: 'NE',
        createAccount: true,
        roleId: companyBRoleId, // Try to assign company B's role
      });
    expect(res.status).toBe(403);
  });

  it("2. Company A cannot assign Company B's manager", async () => {
    const res = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${companyAUserToken}`)
      .send({
        id: 'EMPA002',
        name: 'New Employee',
        email: 'newemp@test.com',
        departmentName: 'Engineering',
        designation: 'Staff',
        joined: '2026-07-30',
        salary: 40000,
        status: 'Active',
        avatar: 'NE',
        createAccount: true,
        roleId: companyARoleId,
        managerId: companyBManagerId, // Try to assign company B's manager
      });
    expect(res.status).toBe(403);
  });

  it('3. Company A user sees only their company roles', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/roles-mgmt')
      .set('Authorization', `Bearer ${companyAUserToken}`);
    expect(res.status).toBe(200);
    const rolesList = res.body;
    expect(rolesList.some((r: any) => r.id === companyARoleId)).toBe(true);
    expect(rolesList.some((r: any) => r.id === companyBRoleId)).toBe(false);
  });

  it('4. Role deletion protection checks works', async () => {
    // Try to delete RoleA while User A is still assigned to it
    const res = await request(app.getHttpServer())
      .delete(`/auth/roles-mgmt/${companyARoleId}`)
      .set('Authorization', `Bearer ${companyAUserToken}`);
    expect(res.status).toBe(400); // Bad Request because employee is assigned
    expect(res.body.message).toContain('employees still assigned');
  });

  it('5. Invalidation via permissionVersion works', async () => {
    // 1. Update permissions of Role B
    const resUpdate = await request(app.getHttpServer())
      .put(`/auth/roles-mgmt/${companyBRoleId}`)
      .set('Authorization', `Bearer ${companyBUserToken}`)
      .send({
        permissions: ['employees:list:view', 'employees:list:edit'],
      });
    expect(resUpdate.status).toBe(200);

    // 2. Make request with old token (which has pv: 1)
    const resMe = await request(app.getHttpServer())
      .get('/auth/me/permissions')
      .set('Authorization', `Bearer ${companyBUserToken}`);

    // The strategy should reject because B's user.permissionVersion has incremented to 2 in DB!
    expect(resMe.status).toBe(401);
  });

  it("6. Super Admin can manage Company B's roles and custom role lifecycle", async () => {
    // 1. Super Admin creates a role for Company B
    const resCreate = await request(app.getHttpServer())
      .post('/auth/roles-mgmt')
      .set('Authorization', `Bearer ${superAdminUserToken}`)
      .send({
        name: 'SuperAdminCustomRole',
        description: 'Created by SuperAdmin',
        permissions: ['employees:list:view'],
        companyId: 'COMP_B',
      });
    expect(resCreate.status).toBe(201);
    const createdRoleId = resCreate.body.id;

    // 2. Super Admin gets Company B's roles (including the new custom one)
    const resGet = await request(app.getHttpServer())
      .get('/auth/roles-mgmt?companyId=COMP_B')
      .set('Authorization', `Bearer ${superAdminUserToken}`);
    expect(resGet.status).toBe(200);
    expect(resGet.body.some((r: any) => r.id === createdRoleId)).toBe(true);

    // 3. Super Admin updates Company B's custom role permissions
    const resUpdate = await request(app.getHttpServer())
      .put(`/auth/roles-mgmt/${createdRoleId}`)
      .set('Authorization', `Bearer ${superAdminUserToken}`)
      .send({
        permissions: ['employees:list:view', 'employees:list:create'],
        companyId: 'COMP_B',
      });
    expect(resUpdate.status).toBe(200);

    // 4. Verify audit log entry was written
    const auditLogs = await prisma.auditLog.findMany({
      where: { companyId: 'COMP_B', action: 'SETTINGS_UPDATED' },
    });
    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0].details).toContain('[ROLE_UPDATE_SUPERADMIN] SuperAdmin modified role');

    // 5. Super Admin deletes Company B's custom role
    const resDelete = await request(app.getHttpServer())
      .delete(`/auth/roles-mgmt/${createdRoleId}?companyId=COMP_B`)
      .set('Authorization', `Bearer ${superAdminUserToken}`);
    expect(resDelete.status).toBe(200);
  });

  it('7. Normal company user cannot bypass tenant boundary using companyId param', async () => {
    // Company A user tries to query Company B roles
    const resGet = await request(app.getHttpServer())
      .get('/auth/roles-mgmt?companyId=COMP_B')
      .set('Authorization', `Bearer ${companyAUserToken}`);

    // The controller should force targetCompanyId = req.user.companyId ('COMP_A')
    // So the returned list should NOT contain Company B's role
    expect(resGet.status).toBe(200);
    expect(resGet.body.some((r: any) => r.id === companyBRoleId)).toBe(false);
  });
});
