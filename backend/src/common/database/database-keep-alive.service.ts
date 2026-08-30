import {
  Injectable,
  OnModuleInit,
  BeforeApplicationShutdown,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DatabaseKeepAliveService
  implements OnModuleInit, BeforeApplicationShutdown
{
  private readonly logger = new Logger(DatabaseKeepAliveService.name);
  private timer: NodeJS.Timeout | null = null;
  private isEnabled = false;
  private intervalMs = 240000; // 4 minutes default

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const enabledRaw = this.configService.get<string>(
      'DATABASE_KEEP_ALIVE_ENABLED',
    );

    if (enabledRaw !== undefined) {
      this.isEnabled = enabledRaw === 'true' || enabledRaw === '1';
    } else {
      // Default: Enabled in production, disabled in dev/test
      this.isEnabled = nodeEnv === 'production';
    }

    if (!this.isEnabled) {
      this.logger.debug(
        `[DatabaseKeepAlive] Keep-alive service is DISABLED for environment '${nodeEnv}'.`,
      );
      return;
    }

    const intervalMinutesRaw = this.configService.get<string>(
      'DATABASE_KEEP_ALIVE_INTERVAL_MINUTES',
      '4',
    );
    let intervalMinutes = parseInt(intervalMinutesRaw, 10);
    if (isNaN(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 60) {
      this.logger.warn(
        `[DatabaseKeepAlive] Invalid interval '${intervalMinutesRaw}'. Falling back to 4 minutes.`,
      );
      intervalMinutes = 4;
    }

    this.intervalMs = intervalMinutes * 60 * 1000;

    this.logger.log(
      `[DatabaseKeepAlive] Initializing Keep-Alive service (Interval: ${intervalMinutes} min, NodeEnv: ${nodeEnv}).`,
    );

    // Immediate initial ping on startup to warm database connection
    this.pingDatabase();

    // Setup periodic ping timer
    this.timer = setInterval(() => {
      this.pingDatabase();
    }, this.intervalMs);
  }

  async pingDatabase(): Promise<boolean> {
    if (!this.isEnabled) return false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      this.logger.debug('[DatabaseKeepAlive] Keep-alive ping executed successfully.');
      return true;
    } catch (err: any) {
      this.logger.debug(
        `[DatabaseKeepAlive] Keep-alive query failed: ${err.message}`,
      );
      return false;
    }
  }

  beforeApplicationShutdown(signal?: string) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.debug(
        `[DatabaseKeepAlive] Timer cleared for application shutdown (Signal: ${signal || 'none'}).`,
      );
    }
  }
}
