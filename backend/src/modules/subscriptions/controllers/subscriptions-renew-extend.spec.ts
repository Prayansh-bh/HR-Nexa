import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from '../services/subscriptions.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';

describe('SubscriptionsController - Renew & Extend-Trial Endpoints', () => {
  let controller: SubscriptionsController;
  let service: jest.Mocked<Partial<SubscriptionsService>>;

  beforeEach(async () => {
    service = {
      renewSubscription: jest.fn().mockResolvedValue({ id: 'SUB-1', status: 'Paid' } as any),
      extendTrial: jest.fn().mockResolvedValue({ id: 'SUB-1', status: 'Trial' } as any),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [{ provide: SubscriptionsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('PUT /subscriptions/:id/renew', () => {
    it('should delegate to service.renewSubscription with explicit duration', async () => {
      await controller.renewSubscription('SUB-1', { duration: '1_MONTH' });
      expect(service.renewSubscription).toHaveBeenCalledWith('SUB-1', '1_MONTH');
    });

    it('should delegate to service.renewSubscription with undefined when body is empty', async () => {
      await controller.renewSubscription('SUB-1', {} as any);
      expect(service.renewSubscription).toHaveBeenCalledWith('SUB-1', undefined);
    });
  });

  describe('PUT /subscriptions/:id/extend-trial', () => {
    it('should delegate to service.extendTrial with custom days', async () => {
      await controller.extendTrial('SUB-1', { days: 21 });
      expect(service.extendTrial).toHaveBeenCalledWith('SUB-1', 21);
    });

    it('should delegate to service.extendTrial with undefined when body is empty', async () => {
      await controller.extendTrial('SUB-1', {} as any);
      expect(service.extendTrial).toHaveBeenCalledWith('SUB-1', undefined);
    });
  });
});
