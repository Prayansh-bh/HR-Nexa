import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PlatformNotificationOptions {
  title: string;
  message: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
  category?:
    'company' | 'subscription' | 'billing' | 'system' | 'security' | 'seat';
  company?: string;
  reason?: string;
  recommendedAction?: string;
  linkUrl?: string;
}

@Injectable()
export class CompanyNotificationsService {
  private readonly logger = new Logger(CompanyNotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dispatches a real-time notification to the Super Admin platform dashboard.
   */
  async notifySuperAdmin(options: PlatformNotificationOptions): Promise<void> {
    try {
      await (this.prisma as any).systemNotification.create({
        data: {
          title: options.title,
          message: options.message,
          severity: options.severity || 'info',
          category: options.category || 'company',
          targetRole: 'SuperAdmin',
          company: options.company || 'System',
          reason: options.reason || 'SaaS Lifecycle Event',
          recommendedAction:
            options.recommendedAction || 'Review dashboard details.',
          linkUrl: options.linkUrl || 'saas.companies',
          read: false,
          readBy: '[]',
          timestamp: new Date(),
        },
      });
      this.logger.log(`SuperAdmin notification emitted: [${options.title}]`);
    } catch (err: any) {
      this.logger.error(
        `Failed to create SuperAdmin notification: ${err?.message}`,
      );
    }
  }
}
