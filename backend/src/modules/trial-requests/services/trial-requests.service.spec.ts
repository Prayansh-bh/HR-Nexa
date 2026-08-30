import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TrialRequestsService } from './trial-requests.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../email/email.service';

describe('TrialRequestsService', () => {
  let service: TrialRequestsService;
  let prismaMock: any;
  let emailServiceMock: any;
  let configServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      trialRequest: {
        create: jest.fn().mockImplementation((args) => ({
          id: 'trial-uuid-1',
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'trial-uuid-1',
            fullName: 'Test User',
            workEmail: 'test@company.com',
            phoneNumber: '+91 9999999999',
            companyName: 'Acme Corp',
            teamSize: '11 - 50 Employees',
            selectedModules: '["Payroll & Statutory"]',
            message: 'Need urgent setup',
            status: 'PENDING',
            createdAt: new Date(),
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockImplementation((args) => {
          if (args.where.id === 'trial-uuid-1') {
            return {
              id: 'trial-uuid-1',
              fullName: 'Test User',
              status: 'PENDING',
              adminNotes: null,
            };
          }
          return null;
        }),
        update: jest.fn().mockImplementation((args) => ({
          id: args.where.id,
          ...args.data,
        })),
      },
    };

    emailServiceMock = {
      sendEmail: jest.fn().mockResolvedValue({ success: true }),
    };

    configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'ADMIN_NOTIFICATION_EMAIL') return 'admin@hrnexa.com';
        if (key === 'EMAIL_FROM') return 'noreply@hrnexa.com';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrialRequestsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<TrialRequestsService>(TrialRequestsService);
  });

  it('1. should create a trial request in database and trigger notification emails', async () => {
    const dto = {
      fullName: 'Priya Sharma',
      workEmail: 'priya@acme.com',
      phoneNumber: '+91 98765 43210',
      companyName: 'Acme Technologies',
      teamSize: '11 - 50 Employees',
      selectedModules: ['Payroll & Statutory', 'Attendance & Biometrics'],
      message: 'Looking forward to testing HR NEXA',
    };

    const result = await service.create(dto, {
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('trial-uuid-1');
    expect(result.companyName).toBe('Acme Technologies');
    expect(result.workEmail).toBe('priya@acme.com');

    expect(prismaMock.trialRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fullName: 'Priya Sharma',
        workEmail: 'priya@acme.com',
        phoneNumber: '+91 98765 43210',
        companyName: 'Acme Technologies',
        teamSize: '11 - 50 Employees',
        status: 'PENDING',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      }),
    });

    // Verify email calls
    expect(emailServiceMock.sendEmail).toHaveBeenCalledTimes(2);
    expect(emailServiceMock.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@hrnexa.com',
        subject: expect.stringContaining('New Trial Lead'),
      }),
    );
    expect(emailServiceMock.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'priya@acme.com',
        subject: expect.stringContaining('14-Day Free Trial Request'),
      }),
    );
  });

  it('2. should list all trial requests with parsed modules', async () => {
    const list = await service.findAll({ page: 1, limit: 10, status: 'PENDING' });
    expect(list.total).toBe(1);
    expect(list.data[0].selectedModulesList).toEqual(['Payroll & Statutory']);
  });

  it('3. should update trial request status and admin notes', async () => {
    const result = await service.updateStatus('trial-uuid-1', {
      status: 'CONTACTED',
      adminNotes: 'Spoke with Priya, scheduled onboarding call.',
    });

    expect(result.success).toBe(true);
    expect(prismaMock.trialRequest.update).toHaveBeenCalledWith({
      where: { id: 'trial-uuid-1' },
      data: {
        status: 'CONTACTED',
        adminNotes: 'Spoke with Priya, scheduled onboarding call.',
      },
    });
  });

  it('4. should throw NotFoundException if trial request does not exist', async () => {
    await expect(
      service.updateStatus('non-existent-id', { status: 'REJECTED' }),
    ).rejects.toThrow('Trial request with ID non-existent-id not found.');
  });
});
