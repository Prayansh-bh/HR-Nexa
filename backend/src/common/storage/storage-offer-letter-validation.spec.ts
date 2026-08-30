import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { BadRequestException } from '@nestjs/common';
import { ALLOWED_MIME_TYPES } from './storage.constants';

describe('StorageService - Offer Letter MIME & Security Validation', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('local'),
          },
        },
        {
          provide: LocalStorageProvider,
          useValue: {
            upload: jest.fn().mockResolvedValue({
              path: 'uploads/offer-letters/comp-1/test.html',
              url: '/files/test.html',
              key: 'test.html',
            }),
          },
        },
        {
          provide: S3StorageProvider,
          useValue: {
            healthCheck: jest.fn().mockResolvedValue(true),
            upload: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    await service.onModuleInit();
  });

  it('should allow text/html for offer-letters category', () => {
    expect(() =>
      service.validateFile(
        {
          originalname: 'offer_letter_jane_doe.html',
          mimetype: 'text/html',
          size: 5000,
        },
        'offer-letters',
      ),
    ).not.toThrow();
  });

  it('should allow application/pdf for offer-letters category', () => {
    expect(() =>
      service.validateFile(
        {
          originalname: 'offer_letter_jane_doe.pdf',
          mimetype: 'application/pdf',
          size: 15000,
        },
        'offer-letters',
      ),
    ).not.toThrow();
  });

  it('should reject executable or unauthorized MIME types for offer-letters', () => {
    expect(() =>
      service.validateFile(
        {
          originalname: 'malicious.exe',
          mimetype: 'application/x-msdownload',
          size: 5000,
        },
        'offer-letters',
      ),
    ).toThrow(BadRequestException);
  });

  it('should reject file sizes exceeding the maximum limit', () => {
    expect(() =>
      service.validateFile(
        {
          originalname: 'huge_offer.pdf',
          mimetype: 'application/pdf',
          size: 15 * 1024 * 1024, // 15MB > 10MB limit
        },
        'offer-letters',
      ),
    ).toThrow(BadRequestException);
  });

  it('should reject path traversal in filenames', () => {
    expect(() =>
      service.validateFile(
        {
          originalname: '../../etc/passwd',
          mimetype: 'text/html',
          size: 500,
        },
        'offer-letters',
      ),
    ).toThrow(BadRequestException);
  });
});
