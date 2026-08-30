import {
  Injectable,
  OnModuleInit,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  StorageProvider,
  StoredFile,
  UploadOptions,
} from './providers/storage-provider.interface';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import {
  UploadCategory,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZES,
  normalizeUploadCategory,
} from './storage.constants';

export type { UploadCategory };

export interface UploadResult {
  filename: string;
  originalName: string;
  path: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface StorageMetrics {
  document_upload_success_total: number;
  document_upload_failed_total: number;
  document_download_failed_total: number;
  last_s3_latency_ms: number;
  activeDriver: 's3';
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private activeDriver: 's3' | 'local' = 'local';

  // Production Storage Metrics Tracking
  private metrics = {
    document_upload_success_total: 0,
    document_upload_failed_total: 0,
    document_download_failed_total: 0,
    last_s3_latency_ms: 0,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly localProvider: LocalStorageProvider,
    private readonly s3Provider: S3StorageProvider,
  ) { }

  async onModuleInit() {
    const driver = this.configService.get<string>('STORAGE_DRIVER', 'local').toLowerCase();
    this.activeDriver = driver === 's3' ? 's3' : 'local';

    this.logger.log(
      `[STORAGE] Initializing StorageService with active driver: ${this.activeDriver.toUpperCase()}`,
    );

    if (this.activeDriver === 's3') {
      // Mandatory S3 Production Health Check (Fail Fast)
      const isHealthy = await this.s3Provider.healthCheck();
      if (!isHealthy) {
        const errorMsg = `[STORAGE] CRITICAL: S3 Storage Driver health check failed on application startup. Verify AWS_S3_BUCKET, AWS_REGION, and credentials. Application startup aborted.`;
        this.logger.error(errorMsg);
        throw new Error(errorMsg);
      }
      this.logger.log(`[STORAGE] S3 Storage Driver startup health check PASSED cleanly.`);
    } else {
      this.logger.log(`[STORAGE] Local Storage Driver initialized cleanly for local environment.`);
    }
  }

  /** Retrieve current active storage driver name */
  getDriverName(): 's3' | 'local' {
    return this.activeDriver;
  }

  /** Retrieve production storage monitoring metrics */
  getMetrics(): StorageMetrics {
    return {
      ...this.metrics,
      activeDriver: this.activeDriver as any,
    };
  }

  /** Centralized MIME type & file size validation using single source of truth from storage.constants.ts */
  validateFile(
    file: { originalname?: string; mimetype?: string; size?: number },
    rawCategory: string,
  ): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const category = normalizeUploadCategory(rawCategory);
    const mime = file.mimetype || '';
    const allowedMimes = ALLOWED_MIME_TYPES[category] || ALLOWED_MIME_TYPES['documents'];
    if (!allowedMimes.includes(mime)) {
      throw new BadRequestException(
        `Invalid file type [${mime}]. Allowed types for ${category}: ${allowedMimes.join(', ')}`,
      );
    }

    const size = file.size || 0;
    const maxSize = MAX_FILE_SIZES[category] || 10 * 1024 * 1024;
    if (size > maxSize) {
      throw new BadRequestException(
        `File size (${(size / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed limit (${maxSize / 1024 / 1024} MB)`,
      );
    }

    const filename = file.originalname || '';
    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      throw new BadRequestException('Invalid or dangerous filename detected');
    }
  }

  /**
   * STEP 6.1 — Exclusive S3 Upload Target:
   * All new document uploads write strictly to S3StorageProvider.
   */
  async saveFile(
    file: {
      originalname: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    },
    rawCategory: string,
    companyId?: string,
  ): Promise<UploadResult> {
    const category = normalizeUploadCategory(rawCategory);
    this.validateFile(file, category);
    const startTime = Date.now();

    try {
      const provider = this.activeDriver === 's3' ? this.s3Provider : this.localProvider;
      const result = await provider.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        { category, companyId },
      );

      this.metrics.document_upload_success_total++;
      if (this.activeDriver === 's3') {
        this.metrics.last_s3_latency_ms = Date.now() - startTime;
      }

      return {
        filename: file.originalname,
        originalName: file.originalname,
        path: result.key,
        url: `/${result.key}`,
        mimeType: result.mimeType,
        size: result.size,
      };
    } catch (err: any) {
      this.metrics.document_upload_failed_total++;
      this.logger.error(`S3 upload failed for file ${file.originalname}: ${err.message}`);
      throw err;
    }
  }

  /** Retrieve readable file stream or buffer from resolved provider */
  async getFileStream(key: string): Promise<Buffer | NodeJS.ReadableStream> {
    try {
      const provider = this.resolveProviderForKey(key);
      return await provider.download(key);
    } catch (err: any) {
      this.metrics.document_download_failed_total++;
      throw err;
    }
  }

  /** Delete file delegating to resolved provider */
  async deleteFile(relativeOrAbsolutePath: string): Promise<boolean> {
    const provider = this.resolveProviderForKey(relativeOrAbsolutePath);
    return provider.delete(relativeOrAbsolutePath);
  }

  /** Check if file exists */
  async exists(key: string): Promise<boolean> {
    const provider = this.resolveProviderForKey(key);
    return provider.exists(key);
  }

  /** Resolve provider based on key prefix (legacy 'uploads/' paths route to LocalStorageProvider) */
  private resolveProviderForKey(key: string): StorageProvider {
    if (key.startsWith('uploads/') || key.startsWith('./uploads/')) {
      return this.localProvider;
    }
    return this.s3Provider;
  }
}
