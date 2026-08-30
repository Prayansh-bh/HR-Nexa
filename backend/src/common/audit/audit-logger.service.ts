import { Injectable, Logger } from '@nestjs/common';
import { AuditLogsRepository } from '../../modules/system/repositories/audit-logs.repository';

export interface AuditLogEntry {
  userId?: string | null;
  userName?: string;
  companyId?: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string;
  browser?: string;
  details?: string;
}

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);

  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  async logAction(entry: AuditLogEntry): Promise<void> {
    try {
      const companyId = entry.companyId || 'PLATFORM';
      const formattedDetails = JSON.stringify({
        companyId,
        oldValue: entry.oldValue ?? null,
        newValue: entry.newValue ?? null,
        ip: entry.ip || '127.0.0.1',
        browser: entry.browser || 'Unknown',
        summary: entry.details || entry.action,
      });

      await this.auditLogsRepository.create({
        userId: entry.userId || null,
        userName: entry.userName || 'System',
        actorId: entry.userId || 'system',
        actorRole: 'HRAdmin', // Default role for standard dashboard logs
        entityType: 'COMPANY_SETTINGS', // Default entity type
        action: entry.action as any,
        companyId,
        details: formattedDetails,
      });
    } catch (error) {
      this.logger.error(
        `Failed to record audit log for action [${entry.action}]: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
