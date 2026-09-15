import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IntegrationCredentialsService } from './integration-credentials.service';
import {
  IntegrationCredential,
  IntegrationProvider,
  ResolvedRazorpayCredentials,
  ResolvedAwsS3Credentials,
  ResolvedSmtpCredentials,
} from '../types/integration.types';

@Injectable()
export class IntegrationResolverService {
  private readonly logger = new Logger(IntegrationResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialsService: IntegrationCredentialsService,
  ) {}

  private get dbModel() {
    return (this.prisma as any).integrationCredential;
  }

  /**
   * Resolve Razorpay Credentials.
   * Order:
   * 1. Enabled Tenant DB IntegrationCredential record (if companyId provided).
   * 2. Enabled Platform DB IntegrationCredential record (companyId = null).
   *    If DB record exists and is active, attempt decryption. If decryption/validation fails -> FAIL FAST (no .env fallback!).
   * 3. process.env fallback (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET) if no active DB record exists.
   */
  public async resolveRazorpay(
    companyId: string | null = null,
  ): Promise<ResolvedRazorpayCredentials> {
    let record: IntegrationCredential | null = null;
    if (companyId) {
      record = await this.dbModel.findFirst({
        where: {
          provider: IntegrationProvider.RAZORPAY,
          companyId,
          enabled: true,
        },
      });
    }

    if (!record) {
      record = await this.dbModel.findFirst({
        where: {
          provider: IntegrationProvider.RAZORPAY,
          companyId: null,
          enabled: true,
        },
      });
    }

    if (!record) {
      return {
        keyId: process.env.RAZORPAY_KEY_ID || '',
        keySecret: process.env.RAZORPAY_KEY_SECRET || '',
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
        source: 'ENV',
      };
    }

    try {
      const secrets =
        await this.credentialsService.getResolvedSecretsInternal(record);
      const config = (record.config || {}) as Record<string, any>;

      if (!config?.keyId || !secrets?.keySecret) {
        throw new Error(
          'Required Razorpay configuration fields (keyId, keySecret) missing in active DB credential.',
        );
      }

      return {
        keyId: String(config.keyId),
        keySecret: String(secrets.keySecret),
        webhookSecret: String(secrets.webhookSecret || ''),
        source: 'DB',
      };
    } catch (err: any) {
      this.logger.error(
        `Failed to resolve active DB Razorpay credential [${record.id}]: ${err.message}`,
      );
      throw new Error(
        `Failed to resolve active DB Razorpay integration credential: ${err.message}`,
      );
    }
  }

  /**
   * Resolve AWS S3 Credentials.
   * Order:
   * 1. Enabled Tenant DB IntegrationCredential record (if companyId provided).
   * 2. Enabled Platform DB IntegrationCredential record (companyId = null).
   *    If DB record exists and is active, attempt decryption. If decryption/validation fails -> FAIL FAST (no .env fallback!).
   * 3. process.env fallback (AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) if no active DB record exists.
   */
  public async resolveAwsS3(
    companyId: string | null = null,
  ): Promise<ResolvedAwsS3Credentials> {
    let record: IntegrationCredential | null = null;
    if (companyId) {
      record = await this.dbModel.findFirst({
        where: {
          provider: IntegrationProvider.AWS_S3,
          companyId,
          enabled: true,
        },
      });
    }

    if (!record) {
      record = await this.dbModel.findFirst({
        where: {
          provider: IntegrationProvider.AWS_S3,
          companyId: null,
          enabled: true,
        },
      });
    }

    if (!record) {
      return {
        region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1',
        bucket: process.env.AWS_S3_BUCKET || process.env.AWS_BUCKET || '',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        source: 'ENV',
      };
    }

    try {
      const secrets =
        await this.credentialsService.getResolvedSecretsInternal(record);
      const config = (record.config || {}) as Record<string, any>;

      if (!config?.region || !config?.bucket || !config?.accessKeyId || !secrets?.secretAccessKey) {
        throw new Error(
          'Required AWS S3 configuration fields (region, bucket, accessKeyId, secretAccessKey) missing in active DB credential.',
        );
      }

      return {
        region: String(config.region),
        bucket: String(config.bucket),
        accessKeyId: String(config.accessKeyId),
        secretAccessKey: String(secrets.secretAccessKey),
        source: 'DB',
      };
    } catch (err: any) {
      this.logger.error(
        `Failed to resolve active DB AWS S3 credential [${record.id}]: ${err.message}`,
      );
      throw new Error(
        `Failed to resolve active DB AWS S3 integration credential: ${err.message}`,
      );
    }
  }

  /**
   * Resolve SMTP Email Credentials.
   * Order:
   * 1. Enabled Tenant DB IntegrationCredential record (if companyId provided).
   * 2. Enabled Platform DB IntegrationCredential record (companyId = null).
   *    If DB record exists and is active, attempt decryption. If decryption/validation fails -> FAIL FAST (no .env fallback!).
   * 3. process.env fallback (EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS, EMAIL_FROM, EMAIL_NAME) if no active DB record exists.
   */
  public async resolveSmtp(
    companyId: string | null = null,
  ): Promise<ResolvedSmtpCredentials> {
    let record: IntegrationCredential | null = null;
    if (companyId) {
      record = await this.dbModel.findFirst({
        where: {
          provider: IntegrationProvider.SMTP_EMAIL,
          companyId,
          enabled: true,
        },
      });
    }

    if (!record) {
      record = await this.dbModel.findFirst({
        where: {
          provider: IntegrationProvider.SMTP_EMAIL,
          companyId: null,
          enabled: true,
        },
      });
    }

    if (!record) {
      return {
        host: process.env.EMAIL_HOST || '',
        port: parseInt(process.env.EMAIL_PORT || '587', 10),
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER || '',
        password: process.env.EMAIL_PASS || undefined,
        from: process.env.EMAIL_FROM || '',
        name: process.env.EMAIL_NAME || 'HR Nexa',
        source: 'ENV',
      };
    }

    try {
      const secrets =
        await this.credentialsService.getResolvedSecretsInternal(record);
      const config = (record.config || {}) as Record<string, any>;

      if (!config?.host) {
        throw new Error(
          'Required SMTP configuration field (host) missing in active DB credential.',
        );
      }

      return {
        host: String(config.host),
        port: Number(config.port || 587),
        secure: Boolean(config.secure),
        user: String(config.user || ''),
        password: secrets?.password ? String(secrets.password) : undefined,
        from: String(config.from || ''),
        name: String(config.name || 'HR Nexa'),
        source: 'DB',
      };
    } catch (err: any) {
      this.logger.error(
        `Failed to resolve active DB SMTP credential [${record.id}]: ${err.message}`,
      );
      throw new Error(
        `Failed to resolve active DB SMTP integration credential: ${err.message}`,
      );
    }
  }
}
