import 'reflect-metadata';
import { validateEnv } from './env.validation';

describe('Production Environment Validation Hardening (Phase 11 - P2)', () => {
  it('should pass in development mode with default secret', () => {
    const config = { NODE_ENV: 'development' };
    const validated = validateEnv(config);
    expect(validated.JWT_SECRET).toBe('hrms_super_secret_jwt_key_2026_go_deepmind');
  });

  it('should FAIL in production mode if JWT_SECRET is missing', () => {
    const config = { NODE_ENV: 'production' };
    expect(() => validateEnv(config)).toThrow(
      'SECURITY CRITICAL: Production environment requires an explicit, non-default JWT_SECRET'
    );
  });

  it('should FAIL in production mode if JWT_SECRET is the default fallback', () => {
    const config = {
      NODE_ENV: 'production',
      JWT_SECRET: 'hrms_super_secret_jwt_key_2026_go_deepmind',
    };
    expect(() => validateEnv(config)).toThrow(
      'SECURITY CRITICAL: Production environment requires an explicit, non-default JWT_SECRET'
    );
  });

  it('should FAIL in production mode if JWT_SECRET is too short', () => {
    const config = {
      NODE_ENV: 'production',
      JWT_SECRET: 'short_secret',
    };
    expect(() => validateEnv(config)).toThrow(
      'SECURITY CRITICAL: Production environment requires an explicit, non-default JWT_SECRET'
    );
  });

  it('should FAIL in production mode if RAZORPAY_KEY_ID is missing or mock', () => {
    const config = {
      NODE_ENV: 'production',
      JWT_SECRET: 'prod_ultra_secure_random_jwt_secret_key_987654321',
      ALLOWED_ORIGINS: 'https://app.hrnexa.com',
      REDIS_HOST: 'localhost',
      RAZORPAY_KEY_ID: 'rzp_test_mock_key_id',
      RAZORPAY_KEY_SECRET: 'live_secret_123456789',
      RAZORPAY_WEBHOOK_SECRET: 'live_webhook_secret_123456789',
    };
    expect(() => validateEnv(config)).toThrow(
      'SECURITY CRITICAL: Production environment requires an explicit, non-mock RAZORPAY_KEY_ID',
    );
  });

  it('should FAIL in production mode if RAZORPAY_KEY_SECRET is missing or mock', () => {
    const config = {
      NODE_ENV: 'production',
      JWT_SECRET: 'prod_ultra_secure_random_jwt_secret_key_987654321',
      ALLOWED_ORIGINS: 'https://app.hrnexa.com',
      REDIS_HOST: 'localhost',
      RAZORPAY_KEY_ID: 'rzp_live_abc123xyz789',
      RAZORPAY_KEY_SECRET: 'mock_secret_key_hrnexa',
      RAZORPAY_WEBHOOK_SECRET: 'live_webhook_secret_123456789',
    };
    expect(() => validateEnv(config)).toThrow(
      'SECURITY CRITICAL: Production environment requires an explicit, non-mock RAZORPAY_KEY_SECRET',
    );
  });

  it('should FAIL in production mode if RAZORPAY_WEBHOOK_SECRET is missing or mock', () => {
    const config = {
      NODE_ENV: 'production',
      JWT_SECRET: 'prod_ultra_secure_random_jwt_secret_key_987654321',
      ALLOWED_ORIGINS: 'https://app.hrnexa.com',
      REDIS_HOST: 'localhost',
      RAZORPAY_KEY_ID: 'rzp_live_abc123xyz789',
      RAZORPAY_KEY_SECRET: 'live_secret_123456789',
      RAZORPAY_WEBHOOK_SECRET: 'mock_webhook_secret_hrnexa',
    };
    expect(() => validateEnv(config)).toThrow(
      'SECURITY CRITICAL: Production environment requires an explicit, non-mock RAZORPAY_WEBHOOK_SECRET',
    );
  });

  it('should PASS in production mode when all required secrets and live Razorpay credentials are provided', () => {
    const config = {
      NODE_ENV: 'production',
      JWT_SECRET: 'prod_ultra_secure_random_jwt_secret_key_987654321',
      ALLOWED_ORIGINS: 'https://app.hrnexa.com',
      REDIS_HOST: 'localhost',
      RAZORPAY_KEY_ID: 'rzp_live_abc123xyz789',
      RAZORPAY_KEY_SECRET: 'live_secret_123456789',
      RAZORPAY_WEBHOOK_SECRET: 'live_webhook_secret_123456789',
    };
    const validated = validateEnv(config);
    expect(validated.JWT_SECRET).toBe('prod_ultra_secure_random_jwt_secret_key_987654321');
    expect(validated.RAZORPAY_KEY_ID).toBe('rzp_live_abc123xyz789');
    expect(validated.RAZORPAY_KEY_SECRET).toBe('live_secret_123456789');
    expect(validated.RAZORPAY_WEBHOOK_SECRET).toBe('live_webhook_secret_123456789');
  });
});
