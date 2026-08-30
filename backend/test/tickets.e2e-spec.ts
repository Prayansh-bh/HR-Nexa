import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as classValidator from 'class-validator';
import * as classTransformer from 'class-transformer';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/modules/auth/services/token.service';

describe('Support Tickets CRUD, Security & Tenant Isolation (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let tokenService: TokenService;

  let superAdminToken: string;
  let tenantAToken: string;
  let tenantBToken: string;
  let noPermissionUserToken: string;

  let ticketsDb: Record<string, any> = {};
  let messagesDb: any[] = [];
  let auditLogsDb: any[] = [];

  const mockTx = {
    supportTicket: {
      update: jest.fn().mockImplementation(async (args) => {
        const ticket = ticketsDb[args.where.id];
        if (ticket) Object.assign(ticket, args.data);
        return ticket;
      }),
    },
  };

  const mockPrismaService = {
    $transaction: jest.fn().mockImplementation(async (cb) => {
      if (typeof cb === 'function') return cb(mockTx);
      return cb;
    }),
    company: {
      findUnique: jest.fn().mockImplementation(async (args) => {
        if (args.where.id === '11111111-1111-4111-8111-111111111111') {
          return { id: '11111111-1111-4111-8111-111111111111', name: 'Tenant A Corp' };
        }
        if (args.where.id === '22222222-2222-4222-8222-222222222222') {
          return { id: '22222222-2222-4222-8222-222222222222', name: 'Tenant B Corp' };
        }
        return null;
      }),
    },
    supportTicket: {
      findMany: jest.fn().mockImplementation(async (args) => {
        return Object.values(ticketsDb).filter((t: any) => {
          if (t.deletedAt) return false;
          if (args.where?.companyId && t.companyId !== args.where.companyId) return false;
          if (args.where?.company && t.company !== args.where.company) return false;
          if (args.where?.AND) {
            for (const cond of args.where.AND) {
              if (cond.deletedAt === null && t.deletedAt !== null) return false;
              if (cond.OR) {
                const match = cond.OR.some((orCond: any) => {
                  if (orCond.companyId && t.companyId === orCond.companyId) return true;
                  if (orCond.company && t.company === orCond.company) return true;
                  return false;
                });
                if (!match) return false;
              }
            }
          }
          return true;
        });
      }),
      findFirst: jest.fn().mockImplementation(async (args) => {
        return Object.values(ticketsDb).find((t: any) => {
          if (args.where?.id && t.id !== args.where.id) return false;
          if (args.where?.deletedAt === null && t.deletedAt !== null) return false;
          if (args.where?.AND) {
            for (const cond of args.where.AND) {
              if (cond.id && t.id !== cond.id) return false;
              if (cond.deletedAt === null && t.deletedAt !== null) return false;
              if (cond.OR) {
                const match = cond.OR.some((orCond: any) => {
                  if (orCond.companyId && t.companyId === orCond.companyId) return true;
                  if (orCond.company && t.company === orCond.company) return true;
                  return false;
                });
                if (!match) return false;
              }
            }
          }
          return true;
        }) || null;
      }),
      count: jest.fn().mockImplementation(async () => Object.values(ticketsDb).length),
      create: jest.fn().mockImplementation(async (args) => {
        const ticket = {
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          deletedBy: null,
        };
        ticketsDb[ticket.id] = ticket;
        return ticket;
      }),
      update: jest.fn().mockImplementation(async (args) => {
        const ticket = ticketsDb[args.where.id];
        if (ticket) Object.assign(ticket, args.data);
        return ticket;
      }),
    },
    ticketMessage: {
      findMany: jest.fn().mockImplementation(async (args) => {
        return messagesDb.filter((m: any) => m.ticketId === args.where.ticketId);
      }),
      create: jest.fn().mockImplementation(async (args) => {
        const msg = {
          id: `msg-${Date.now()}-${Math.random()}`,
          ...args.data,
          createdAt: new Date(),
        };
        messagesDb.push(msg);
        return msg;
      }),
    },
    auditLog: {
      create: jest.fn().mockImplementation(async (args) => {
        auditLogsDb.push(args.data);
        return args.data;
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn().mockImplementation(async (args) => {
        if (args.where?.id === 'user-sa') {
          return {
            id: 'user-sa',
            email: 'superadmin@test.com',
            role: 'SuperAdmin',
            name: 'Super Admin',
            companyId: null,
            permissionVersion: 1,
            sessionVersion: 1,
            status: 'Active',
          };
        }
        if (args.where?.id === 'user-ta') {
          return {
            id: 'user-ta',
            email: 'admin.a@test.com',
            role: 'HRAdmin',
            name: 'Admin Tenant A',
            companyId: '11111111-1111-4111-8111-111111111111',
            permissionVersion: 1,
            sessionVersion: 1,
            status: 'Active',
            subscription: { id: 'SUB_A', status: 'Active', expiry: '2027-01-01' },
          };
        }
        if (args.where?.id === 'user-tb') {
          return {
            id: 'user-tb',
            email: 'admin.b@test.com',
            role: 'HRAdmin',
            name: 'Admin Tenant B',
            companyId: '22222222-2222-4222-8222-222222222222',
            permissionVersion: 1,
            sessionVersion: 1,
            status: 'Active',
            subscription: { id: 'SUB_B', status: 'Active', expiry: '2027-01-01' },
          };
        }
        if (args.where?.id === 'user-noperm') {
          return {
            id: 'user-noperm',
            email: 'noperm@test.com',
            role: 'Employee',
            name: 'No Perm User',
            companyId: '11111111-1111-4111-8111-111111111111',
            permissionVersion: 1,
            sessionVersion: 1,
            status: 'Active',
            subscription: { id: 'SUB_A', status: 'Active', expiry: '2027-01-01' },
          };
        }
        return null;
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    systemConfig: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    systemSetting: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    blacklistedToken: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    userSession: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    permission: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    employee: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    role: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockImplementation(async (args) => {
        if (args.where?.name === 'Employee') {
          return {
            id: 'role-emp',
            name: 'Employee',
            permissions: '[]',
          };
        }
        return {
          id: 'role-admin',
          name: args.where?.name || 'HRAdmin',
          permissions: JSON.stringify([
            'support:tickets:view',
            'support:tickets:create',
            'support:tickets:status',
            'support:tickets:message',
            'support:tickets:delete',
            'support:tickets:resolve',
            'support:tickets:close',
          ]),
        };
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
      sub: 'user-sa',
      email: 'superadmin@test.com',
      role: 'SuperAdmin',
      name: 'Super Admin',
      companyId: 'PLATFORM',
    });

    tenantAToken = tokenService.sign({
      sub: 'user-ta',
      email: 'admin.a@test.com',
      role: 'HRAdmin',
      name: 'Admin Tenant A',
      companyId: '11111111-1111-4111-8111-111111111111',
    });

    tenantBToken = tokenService.sign({
      sub: 'user-tb',
      email: 'admin.b@test.com',
      role: 'HRAdmin',
      name: 'Admin Tenant B',
      companyId: '22222222-2222-4222-8222-222222222222',
    });

    noPermissionUserToken = tokenService.sign({
      sub: 'user-noperm',
      email: 'noperm@test.com',
      role: 'Employee',
      name: 'No Perm User',
      companyId: '11111111-1111-4111-8111-111111111111',
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    ticketsDb = {
      'TICKET-A1': {
        id: 'TICKET-A1',
        company: 'Tenant A Corp',
        companyId: '11111111-1111-4111-8111-111111111111',
        subject: 'Payroll calculation question',
        priority: 'Medium',
        assignedTo: 'Support Team',
        status: 'Open',
        attachments: 0,
        date: '2026-08-17',
        deletedAt: null,
        deletedBy: null,
      },
      'TICKET-B1': {
        id: 'TICKET-B1',
        company: 'Tenant B Corp',
        companyId: '22222222-2222-4222-8222-222222222222',
        subject: 'Attendance sync issue',
        priority: 'High',
        assignedTo: 'Support Team',
        status: 'Open',
        attachments: 1,
        date: '2026-08-17',
        deletedAt: null,
        deletedBy: null,
      },
    };
    messagesDb = [];
    auditLogsDb = [];
  });

  describe('1. Ticket CRUD Operations (HTTP E2E)', () => {
    it('POST /api/tickets - creates ticket and seeds initial message', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          subject: 'Need help with tax declaration',
          priority: 'High',
        });

      expect(res.status).toBe(201);
      expect(res.body.subject).toBe('Need help with tax declaration');
      expect(res.body.status).toBe('Open');
      expect(ticketsDb[res.body.id]).toBeDefined();
      expect(messagesDb.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/tickets - lists tickets for authenticated tenant', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/tickets')
        .set('Authorization', `Bearer ${tenantAToken}`);

      expect(res.status).toBe(200);
      const tickets = Array.isArray(res.body) ? res.body : res.body.data;
      expect(tickets.length).toBe(1);
      expect(tickets[0].id).toBe('TICKET-A1');
    });

    it('PUT /api/tickets/:id/status - updates status with valid transition', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/tickets/TICKET-A1/status')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({ status: 'In Progress' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('In Progress');
      expect(ticketsDb['TICKET-A1'].status).toBe('In Progress');
    });

    it('PUT /api/tickets/:id/status - rejects invalid status with HTTP 400', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/tickets/TICKET-A1/status')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({ status: 'InvalidStatus' });

      expect(res.status).toBe(400);
    });

    it('POST & GET /api/tickets/:id/messages - adds and retrieves messages', async () => {
      const postRes = await request(app.getHttpServer())
        .post('/api/tickets/TICKET-A1/messages')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({ message: 'Here is the additional detail for the ticket' });

      expect(postRes.status).toBe(201);

      const getRes = await request(app.getHttpServer())
        .get('/api/tickets/TICKET-A1/messages')
        .set('Authorization', `Bearer ${tenantAToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.length).toBeGreaterThanOrEqual(1);
      expect(getRes.body.some((m: any) => m.message.includes('additional detail'))).toBe(true);
    });

    it('DELETE /api/tickets/:id - soft deletes ticket and creates AuditLog', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/tickets/TICKET-A1')
        .set('Authorization', `Bearer ${tenantAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(ticketsDb['TICKET-A1'].deletedAt).toBeDefined();
      expect(auditLogsDb.some((a: any) => a.action === 'TICKET_DELETED')).toBe(true);
    });
  });

  describe('2. Authorization Enforcement (HTTP E2E)', () => {
    it('denies unauthenticated request with HTTP 401', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/tickets/TICKET-A1');

      expect(res.status).toBe(401);
    });

    it('denies user lacking required permission with HTTP 403', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/tickets/TICKET-A1')
        .set('Authorization', `Bearer ${noPermissionUserToken}`);

      expect(res.status).toBe(403);
    });

    it('allows SuperAdmin to view and manage tickets', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/tickets')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('3. Tenant Isolation & ID Tampering (HTTP E2E)', () => {
    it('Tenant A cannot read Tenant B ticket messages (HTTP 404 anti-enumeration)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/tickets/TICKET-B1/messages')
        .set('Authorization', `Bearer ${tenantAToken}`);

      expect(res.status).toBe(404);
    });

    it('Tenant A cannot update Tenant B ticket status (HTTP 404 anti-enumeration)', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/tickets/TICKET-B1/status')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({ status: 'In Progress' });

      expect(res.status).toBe(404);
      expect(ticketsDb['TICKET-B1'].status).toBe('Open'); // Unchanged
    });

    it('Tenant A cannot delete Tenant B ticket (HTTP 404 anti-enumeration)', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/tickets/TICKET-B1')
        .set('Authorization', `Bearer ${tenantAToken}`);

      expect(res.status).toBe(404);
      expect(ticketsDb['TICKET-B1'].deletedAt).toBeNull(); // Unchanged
    });

    it('Tenant B can delete its own ticket successfully', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/tickets/TICKET-B1')
        .set('Authorization', `Bearer ${tenantBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(ticketsDb['TICKET-B1'].deletedAt).toBeDefined();
    });
  });
});
