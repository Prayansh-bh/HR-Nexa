import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(process.env.AUTH_CLEANUP_CRON || CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleScheduledCleanup() {
    this.logger.log('Starting scheduled authentication cleanup job...');
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    try {
      // 1. Purge expired password reset tokens
      const resetRes = await this.prisma.passwordResetToken.deleteMany({
        where: { expiresAt: { lt: now } },
      });

      // 2. Purge blacklisted tokens
      const blacklistRes = await this.prisma.blacklistedToken.deleteMany({
        where: { expiresAt: { lt: now } },
      });

      // 3. Purge revoked or expired UserSessions older than 30 days
      const sessionRes = await this.prisma.userSession.deleteMany({
        where: {
          OR: [
            { revokedAt: { lt: thirtyDaysAgo } },
            { expiresAt: { lt: thirtyDaysAgo } },
          ],
        },
      });

      this.logger.log(
        `Cleanup complete: ${resetRes.count} reset tokens, ${blacklistRes.count} blacklisted tokens, ${sessionRes.count} sessions purged.`,
      );
    } catch (err: any) {
      this.logger.error(`Authentication cleanup failed: ${err.message}`, err.stack);
    }
  }
}
