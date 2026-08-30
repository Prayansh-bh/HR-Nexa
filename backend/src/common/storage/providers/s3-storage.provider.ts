import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationResolverService } from '../../../modules/integrations/services/integration-resolver.service';
import * as fs from 'fs';
import { StorageProvider, StoredFile, UploadOptions } from './storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly integrationResolver: IntegrationResolverService,
  ) {}

  /**
   * Dynamically resolves AWS S3 credentials via IntegrationResolverService.
   * Order: Active DB Credential -> .env Fallback.
   * If active DB credential exists but fails decryption -> Fails Fast.
   */
  private async resolveCredentials(companyId: string | null = null): Promise<{
    region: string;
    bucketName: string;
    accessKeyId: string;
    secretAccessKey: string;
  }> {
    const resolved = await this.integrationResolver.resolveAwsS3(companyId);

    return {
      region: resolved.region || 'ap-south-1',
      bucketName: resolved.bucket || '',
      accessKeyId: resolved.accessKeyId || '',
      secretAccessKey: resolved.secretAccessKey || '',
    };
  }

  /**
   * Dynamically constructs S3Client and retrieves bucketName for the given company context.
   */
  private async getS3Context(companyId: string | null = null) {
    const creds = await this.resolveCredentials(companyId);
    try {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        region: creds.region,
        credentials:
          creds.accessKeyId && creds.secretAccessKey
            ? { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey }
            : undefined,
      });

      return {
        client,
        bucketName: creds.bucketName,
        region: creds.region,
      };
    } catch (err) {
      this.logger.error('Failed to load @aws-sdk/client-s3 package. Ensure it is installed.');
      throw err;
    }
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, operationName: string, maxAttempts = 3): Promise<T> {
    let attempt = 0;
    const delays = [100, 300, 900];

    while (attempt < maxAttempts) {
      try {
        return await fn();
      } catch (err: any) {
        attempt++;
        const isRetryable =
          err.$metadata?.httpStatusCode >= 500 ||
          err.code === 'NetworkingError' ||
          err.code === 'TimeoutError' ||
          err.name === 'ThrottlingException';

        if (isRetryable && attempt < maxAttempts) {
          const delay = delays[attempt - 1] || 1000;
          this.logger.warn(`[STORAGE] S3 ${operationName} transient error (attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw err;
        }
      }
    }
    throw new Error(`S3 operation ${operationName} failed after ${maxAttempts} attempts`);
  }

  async upload(
    file: { path?: string; buffer?: Buffer; originalname: string; mimetype: string; size: number },
    options: UploadOptions,
  ): Promise<StoredFile> {
    const startTime = Date.now();
    const { client, bucketName } = await this.getS3Context(options.companyId || null);
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');

    const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase().replace(/[^a-z0-9.]/gi, '');
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${ext}`;
    const companyPrefix = options.companyId ? `tenants/${options.companyId}/` : '';
    const employeePrefix = options.employeeId ? `/${options.employeeId}` : '';
    const key = `${companyPrefix}${options.category}${employeePrefix}/${uniqueFilename}`;

    let body: Buffer;
    if (file.buffer) {
      body = file.buffer;
    } else if (file.path && fs.existsSync(file.path)) {
      body = fs.readFileSync(file.path);
    } else {
      throw new Error('No file buffer or temp path provided for S3 upload');
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: file.mimetype,
      ServerSideEncryption: 'AES256',
    });

    const response: any = await this.executeWithRetry(() => client.send(command), 'upload');
    const durationMs = Date.now() - startTime;

    this.logger.log(
      `[STORAGE] provider=s3 operation=upload category=${options.category} key=${key} size=${file.size} durationMs=${durationMs}`,
    );

    return {
      key,
      size: file.size,
      mimeType: file.mimetype,
      originalName: file.originalname,
      etag: response?.ETag ? response.ETag.replace(/"/g, '') : undefined,
      lastModified: new Date(),
    };
  }

  async download(key: string): Promise<Buffer | NodeJS.ReadableStream> {
    const startTime = Date.now();
    const { client, bucketName } = await this.getS3Context(null);
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response: any = await this.executeWithRetry(() => client.send(command), 'download');
    const durationMs = Date.now() - startTime;

    this.logger.log(`[STORAGE] provider=s3 operation=download key=${key} durationMs=${durationMs}`);
    return response.Body as NodeJS.ReadableStream;
  }

  async delete(key: string): Promise<boolean> {
    const startTime = Date.now();
    try {
      const { client, bucketName } = await this.getS3Context(null);
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await this.executeWithRetry(() => client.send(command), 'delete');
      const durationMs = Date.now() - startTime;
      this.logger.log(`[STORAGE] provider=s3 operation=delete key=${key} durationMs=${durationMs}`);
      return true;
    } catch (err) {
      this.logger.error(`[STORAGE] provider=s3 operation=delete FAILED key=${key}: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const { client, bucketName } = await this.getS3Context(null);
      const { HeadObjectCommand } = await import('@aws-sdk/client-s3');

      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await client.send(command);
      return true;
    } catch (err) {
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { client, bucketName, region } = await this.getS3Context(null);
      if (!bucketName) {
        this.logger.warn('[STORAGE] S3StorageProvider healthCheck NOTICE: AWS_S3_BUCKET env variable is not defined');
        return false;
      }
      const { HeadBucketCommand, GetBucketLocationCommand } = await import('@aws-sdk/client-s3');

      await client.send(new HeadBucketCommand({ Bucket: bucketName }));

      const locationRes: any = await client.send(new GetBucketLocationCommand({ Bucket: bucketName }));
      const bucketRegion = locationRes?.LocationConstraint || 'us-east-1';

      if (bucketRegion !== region && !(bucketRegion === 'EU' && region === 'eu-west-1')) {
        this.logger.warn(`[STORAGE] S3StorageProvider healthCheck WARNING: Configured region (${region}) does not match bucket region (${bucketRegion})`);
      }

      this.logger.log(`[STORAGE] S3StorageProvider healthCheck PASSED for bucket: ${bucketName} (${region})`);
      return true;
    } catch (err: any) {
      this.logger.error(`[STORAGE] S3StorageProvider healthCheck FAILED: ${err?.message || String(err)}`);
      return false;
    }
  }
}
