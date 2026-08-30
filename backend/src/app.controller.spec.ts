import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SeedFromEmployeesService } from './modules/departments/services/seed-from-employees.service';
import { PrismaService } from './prisma/prisma.service';
import { StorageService } from './common/storage/storage.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: { $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]) },
        },
        {
          provide: StorageService,
          useValue: { getHealth: jest.fn().mockResolvedValue({ status: 'ok' }) },
        },
        {
          provide: SeedFromEmployeesService,
          useValue: { seedOrgDataFromEmployees: jest.fn() },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return server metadata', () => {
      expect(appController.getHello()).toHaveProperty(
        'message',
        'HRMS API Server is active',
      );
    });
  });
});
