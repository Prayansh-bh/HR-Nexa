import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeUserLinkService } from './employee-user-link.service';
import { UserRepository } from '../../auth/repositories/user.repository';
import { PasswordService } from '../../auth/services/password.service';
import { EmailService } from '../../../email/email.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('EmployeeUserLinkService - Company ID vs Subscription ID Remediation', () => {
  let service: EmployeeUserLinkService;
  let mockUserRepository: any;
  let mockPrisma: any;
  let mockEmailService: any;

  beforeEach(async () => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
    };

    mockPrisma = {
      role: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
    };

    mockEmailService = {
      sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeUserLinkService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: PasswordService, useValue: { hash: jest.fn().mockResolvedValue('hashed_pass') } },
        { provide: EmailService, useValue: mockEmailService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EmployeeUserLinkService>(EmployeeUserLinkService);
  });

  it('getOrCreateUserForEmployee writes separate companyId and subscriptionId to new user', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(null);
    mockUserRepository.createUser.mockResolvedValue({ id: 'user-1' });
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

    await service.getOrCreateUserForEmployee({
      email: 'employee@example.com',
      name: 'John Employee',
      companyName: 'Acme Corp',
      roleId: 'role-1',
      companyId: 'COMPANY_A',
      subscriptionId: 'SUB_A',
    });

    // Assert that user creation writes the Subscription ID to subscriptionId column
    expect(mockUserRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'employee@example.com',
        subscriptionId: 'SUB_A', // MUST NOT be 'COMPANY_A'
      }),
    );

    // Assert that user company linking updates companyId column with Company ID
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        companyId: 'COMPANY_A', // MUST NOT be 'SUB_A'
      },
    });
  });

  it('getOrCreateUserForEmployee updates existing user with separate companyId and subscriptionId', async () => {
    mockUserRepository.findByEmail.mockResolvedValue({ id: 'user-1' });

    await service.getOrCreateUserForEmployee({
      email: 'employee@example.com',
      name: 'John Employee',
      companyName: 'Acme Corp',
      roleId: 'role-1',
      companyId: 'COMPANY_A',
      subscriptionId: 'SUB_A',
    });

    // Assert that updating the user updates subscriptionId and companyId to their respective separate values
    expect(mockUserRepository.updateUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        subscriptionId: 'SUB_A',
        companyId: 'COMPANY_A',
      }),
    );
  });
});
