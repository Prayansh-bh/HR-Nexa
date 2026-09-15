import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3001;

  @IsString()
  @IsOptional()
  JWT_SECRET: string = 'hrms_super_secret_jwt_key_2026_go_deepmind';

  @IsString()
  @IsOptional()
  JWT_EXPIRATION: string = '15m';

  @IsString()
  @IsOptional()
  EMAIL_HOST?: string;

  @IsNumber()
  @IsOptional()
  EMAIL_PORT?: number;

  @IsString()
  @IsOptional()
  EMAIL_SECURE?: string;

  @IsString()
  @IsOptional()
  EMAIL_USER?: string;

  @IsString()
  @IsOptional()
  EMAIL_PASS?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM?: string;

  @IsString()
  @IsOptional()
  EMAIL_NAME?: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL?: string;

  @IsString()
  @IsOptional()
  TENANT_APP_URL?: string;

  @IsString()
  @IsOptional()
  OWNER_APP_URL?: string;

  @IsString()
  @IsOptional()
  RAZORPAY_KEY_ID?: string;

  @IsString()
  @IsOptional()
  RAZORPAY_KEY_SECRET?: string;

  @IsString()
  @IsOptional()
  RAZORPAY_WEBHOOK_SECRET?: string;

  @IsString()
  @IsOptional()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @IsOptional()
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_USERNAME?: string;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.trim().toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0' || lower === '') return false;
      return 'INVALID_BOOLEAN';
    }
    return value;
  })
  REDIS_TLS: boolean = false;

  @IsString()
  @IsOptional()
  REDIS_URL?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.trim().toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
      return 'INVALID_BOOLEAN';
    }
    return value;
  })
  ENABLE_QUEUE_WORKERS: boolean = true;

  @IsString()
  @IsOptional()
  ENCRYPTION_KEY?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const sanitizedErrorMsg = errors
      .map((err) => {
        const constraints = err.constraints ? Object.values(err.constraints).join(', ') : 'invalid';
        return `${err.property}: ${constraints}`;
      })
      .join('; ');
    throw new Error(`Environment validation error: ${sanitizedErrorMsg}`);
  }

  if (
    typeof validatedConfig.REDIS_PORT !== 'number' ||
    isNaN(validatedConfig.REDIS_PORT) ||
    validatedConfig.REDIS_PORT <= 0 ||
    validatedConfig.REDIS_PORT > 65535
  ) {
    throw new Error('Environment validation error: REDIS_PORT must be a valid port number between 1 and 65535');
  }

  if (config.REDIS_TLS !== undefined && config.REDIS_TLS !== null) {
    if (typeof config.REDIS_TLS === 'string') {
      const lower = config.REDIS_TLS.trim().toLowerCase();
      if (!['true', 'false', '1', '0', ''].includes(lower)) {
        throw new Error('Environment validation error: REDIS_TLS must be a valid boolean');
      }
    } else if (typeof config.REDIS_TLS !== 'boolean') {
      throw new Error('Environment validation error: REDIS_TLS must be a valid boolean');
    }
  }

  // Production Security Hardening (Phase 11, Phase 4B.1 & Phase B2.3)
  if (validatedConfig.NODE_ENV === Environment.Production) {
    const isDefaultSecret =
      !config.JWT_SECRET ||
      validatedConfig.JWT_SECRET === 'hrms_super_secret_jwt_key_2026_go_deepmind' ||
      validatedConfig.JWT_SECRET.trim().length < 16;
    if (isDefaultSecret) {
      throw new Error(
        'SECURITY CRITICAL: Production environment requires an explicit, non-default JWT_SECRET of at least 16 characters.',
      );
    }

    const origins = typeof config.ALLOWED_ORIGINS === 'string' ? config.ALLOWED_ORIGINS.trim() : '';
    if (!origins) {
      throw new Error(
        'SECURITY CRITICAL: Production environment requires an explicit ALLOWED_ORIGINS setting (e.g. https://app.hrnexa.com).',
      );
    }

    const hasRedisHost = typeof config.REDIS_HOST === 'string' && config.REDIS_HOST.trim().length > 0;
    const hasRedisUrl = typeof config.REDIS_URL === 'string' && config.REDIS_URL.trim().length > 0;
    if (!hasRedisHost && !hasRedisUrl) {
      throw new Error(
        'SECURITY CRITICAL: Production environment requires an explicit REDIS_HOST or REDIS_URL setting.',
      );
    }

    // Razorpay Production Validation (Phase B2.3 Remediation)
    const rzpKeyId = typeof config.RAZORPAY_KEY_ID === 'string' ? config.RAZORPAY_KEY_ID.trim() : '';
    if (!rzpKeyId || rzpKeyId.startsWith('rzp_test_mock')) {
      throw new Error(
        'SECURITY CRITICAL: Production environment requires an explicit, non-mock RAZORPAY_KEY_ID.',
      );
    }

    const rzpKeySecret = typeof config.RAZORPAY_KEY_SECRET === 'string' ? config.RAZORPAY_KEY_SECRET.trim() : '';
    if (!rzpKeySecret || rzpKeySecret === 'mock_secret_key_hrnexa') {
      throw new Error(
        'SECURITY CRITICAL: Production environment requires an explicit, non-mock RAZORPAY_KEY_SECRET.',
      );
    }

    const rzpWebhookSecret = typeof config.RAZORPAY_WEBHOOK_SECRET === 'string' ? config.RAZORPAY_WEBHOOK_SECRET.trim() : '';
    if (!rzpWebhookSecret || rzpWebhookSecret === 'mock_webhook_secret_hrnexa') {
      throw new Error(
        'SECURITY CRITICAL: Production environment requires an explicit, non-mock RAZORPAY_WEBHOOK_SECRET.',
      );
    }
  }

  // Encryption Key Format Validation (AES-256-GCM Integration Security)
  if (config.ENCRYPTION_KEY !== undefined && config.ENCRYPTION_KEY !== null && config.ENCRYPTION_KEY !== '') {
    const encKey = typeof config.ENCRYPTION_KEY === 'string' ? config.ENCRYPTION_KEY.trim() : '';
    if (encKey.length !== 64 && Buffer.from(encKey, 'utf8').length !== 32) {
      throw new Error(
        'Environment validation error: ENCRYPTION_KEY must be a 64-character hex string or 32-byte UTF-8 string',
      );
    }
  }

  return validatedConfig;
}
