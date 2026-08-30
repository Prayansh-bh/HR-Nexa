import { ConnectionOptions } from 'bullmq';
import { ConfigService } from '@nestjs/config';

export function getRedisConnectionOptions(configService?: ConfigService): ConnectionOptions {
  const getEnv = (key: string): string | undefined => {
    if (configService) {
      const val = configService.get<string>(key);
      if (val !== undefined && val !== null) return String(val);
    }
    return process.env[key];
  };

  const redisUrl = getEnv('REDIS_URL');
  if (redisUrl && redisUrl.trim().length > 0) {
    try {
      const url = new URL(redisUrl);
      const isTls = url.protocol === 'rediss:';
      return {
        host: url.hostname,
        port: url.port ? parseInt(url.port, 10) : 6379,
        username: url.username || undefined,
        password: url.password || undefined,
        tls: isTls ? {} : undefined,
        maxRetriesPerRequest: null,
      };
    } catch {
      // If parsing fails, fall back to standard parameters
    }
  }

  const host = getEnv('REDIS_HOST') || 'localhost';
  const rawPort = getEnv('REDIS_PORT');
  const port = rawPort ? parseInt(rawPort, 10) : 6379;
  const username = getEnv('REDIS_USERNAME') || undefined;
  const password = getEnv('REDIS_PASSWORD') || undefined;
  const rawTls = getEnv('REDIS_TLS');
  const tls =
    rawTls === 'true' || rawTls === '1'
      ? {}
      : undefined;

  return {
    host,
    port: isNaN(port) ? 6379 : port,
    username,
    password,
    tls,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy(times: number) {
      // In local dev without explicit REDIS_URL, limit reconnect attempts to prevent ECONNREFUSED console spam
      if (!getEnv('REDIS_URL') && (!getEnv('REDIS_HOST') || getEnv('REDIS_HOST') === 'localhost')) {
        if (times > 3) {
          return null; // Stop retrying continuously if no local Redis server is active
        }
      }
      return Math.min(times * 500, 5000);
    },
  };
}
