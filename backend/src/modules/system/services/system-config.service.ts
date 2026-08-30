import { Injectable, Logger } from '@nestjs/common';
import { SystemConfigRepository } from '../repositories/system-config.repository';
import { AuditLogsRepository } from '../repositories/audit-logs.repository';
import { UpdateGlobalSettingsDto } from '../dto/update-global-settings.dto';

export const CONFIG_KEYS = {
  RAZORPAY_KEY_ID: 'razorpay_key_id',
  RAZORPAY_KEY_SECRET: 'razorpay_key_secret',
} as const;

export const SUPPORTED_LANGUAGES = {
  EN: 'en',
  HI: 'hi',
} as const;

export type SupportedLanguage =
  (typeof SUPPORTED_LANGUAGES)[keyof typeof SUPPORTED_LANGUAGES];

export function normalizeLanguageCode(lang?: string | null): SupportedLanguage {
  if (!lang) return SUPPORTED_LANGUAGES.EN;
  const clean = lang.trim().toLowerCase();
  if (clean === 'hi' || clean === 'hindi') {
    return SUPPORTED_LANGUAGES.HI;
  }
  return SUPPORTED_LANGUAGES.EN;
}

export const DEFAULT_GLOBAL_SETTINGS = {
  timeZone: 'IST (Indian Standard Time)',
  currency: 'INR (₹)',
  dateFormat: 'YYYY-MM-DD',
  defaultLanguage: 'en',
  sessionTimeoutMins: 30,
  trialDays: 14,
  strictPasswordPolicy: true,
  requireOtpLogin: false,
  requireCompanyApproval: false,
  maintenanceMode: false,
};

@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name);

  constructor(
    private readonly repo: SystemConfigRepository,
    private readonly auditLogsRepo: AuditLogsRepository,
  ) {}

  async get(key: string): Promise<string | null> {
    return this.repo.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    return this.repo.set(key, value);
  }

  async getGlobalSettings() {
    const raw = await this.repo.getAll();
    return {
      timeZone: raw.timeZone || DEFAULT_GLOBAL_SETTINGS.timeZone,
      currency: raw.currency || DEFAULT_GLOBAL_SETTINGS.currency,
      dateFormat: raw.dateFormat || DEFAULT_GLOBAL_SETTINGS.dateFormat,
      defaultLanguage: normalizeLanguageCode(raw.defaultLanguage),
      sessionTimeoutMins: raw.sessionTimeoutMins
        ? parseInt(raw.sessionTimeoutMins, 10)
        : DEFAULT_GLOBAL_SETTINGS.sessionTimeoutMins,
      trialDays: raw.trialDays
        ? parseInt(raw.trialDays, 10)
        : DEFAULT_GLOBAL_SETTINGS.trialDays,
      strictPasswordPolicy:
        raw.strictPasswordPolicy !== undefined
          ? raw.strictPasswordPolicy === 'true'
          : DEFAULT_GLOBAL_SETTINGS.strictPasswordPolicy,
      requireOtpLogin:
        raw.requireOtpLogin !== undefined
          ? raw.requireOtpLogin === 'true'
          : DEFAULT_GLOBAL_SETTINGS.requireOtpLogin,
      requireCompanyApproval:
        raw.requireCompanyApproval !== undefined
          ? raw.requireCompanyApproval === 'true'
          : DEFAULT_GLOBAL_SETTINGS.requireCompanyApproval,
      maintenanceMode:
        raw.maintenanceMode !== undefined
          ? raw.maintenanceMode === 'true'
          : DEFAULT_GLOBAL_SETTINGS.maintenanceMode,
    };
  }

  async getRuntimeSettings(): Promise<{
    timeZone: string;
    currency: string;
    dateFormat: string;
    defaultLanguage: string;
  }> {
    const settings = await this.getGlobalSettings();
    return {
      timeZone: settings.timeZone,
      currency: settings.currency,
      dateFormat: settings.dateFormat,
      defaultLanguage: settings.defaultLanguage,
    };
  }

  async getConfiguredTrialDays(): Promise<number> {
    const settings = await this.getGlobalSettings();
    const days = Number(settings.trialDays);
    if (Number.isInteger(days) && days >= 1 && days <= 365) {
      return days;
    }
    return DEFAULT_GLOBAL_SETTINGS.trialDays;
  }

  async getConfiguredSessionTimeoutMins(): Promise<number> {
    const settings = await this.getGlobalSettings();
    const mins = Number(settings.sessionTimeoutMins);
    if (Number.isInteger(mins) && mins >= 5 && mins <= 1440) {
      return mins;
    }
    return DEFAULT_GLOBAL_SETTINGS.sessionTimeoutMins;
  }

  async isCompanyApprovalRequired(): Promise<boolean> {
    const settings = await this.getGlobalSettings();
    return settings.requireCompanyApproval === true;
  }

  async isOtpLoginRequired(): Promise<boolean> {
    const settings = await this.getGlobalSettings();
    return settings.requireOtpLogin === true;
  }

  async getConfiguredDefaultLanguage(): Promise<SupportedLanguage> {
    const settings = await this.getGlobalSettings();
    return normalizeLanguageCode(settings.defaultLanguage);
  }

  async updateGlobalSettings(
    dto: UpdateGlobalSettingsDto,
    user: { id: string; name: string; role: string },
    ip?: string,
    userAgent?: string,
  ) {
    const current = await this.getGlobalSettings();
    const changes: Record<string, string> = {};
    const auditDiffs: string[] = [];

    const keys = Object.keys(dto) as (keyof UpdateGlobalSettingsDto)[];

    for (const key of keys) {
      if (dto[key] !== undefined && dto[key] !== (current as any)[key]) {
        const prevVal = String((current as any)[key]);
        const newVal = String(dto[key]);
        changes[key] = newVal;
        auditDiffs.push(`[${key}] Previous: "${prevVal}" -> New: "${newVal}"`);
      }
    }

    if (Object.keys(changes).length > 0) {
      const clientIp = ip || '127.0.0.1';
      const browser = userAgent || 'Unknown Browser';
      const details =
        `Global Settings updated by ${user.name} (${user.role}) from IP: ${clientIp}, Agent: ${browser}. Changes:\n` +
        auditDiffs.join('\n');

      const auditData = {
        userId: user.id,
        userName: user.name,
        actorId: user.id || 'system',
        actorRole: user.role || 'SuperAdmin',
        entityType: 'COMPANY_SETTINGS' as const,
        action: 'SETTINGS_UPDATED',
        details,
        companyId: 'PLATFORM',
      };

      await this.repo.setManyWithAudit(changes, auditData);
      this.logger.log(
        `Atomic Global Settings and audit log recorded for update by ${user.name}`,
      );
    }

    return this.getGlobalSettings();
  }

  /** Returns the public Razorpay Key ID only (safe to send to frontend) */
  async getPaymentGatewayPublicConfig(): Promise<{ keyId: string | null }> {
    const keyId = await this.repo.get(CONFIG_KEYS.RAZORPAY_KEY_ID);
    return { keyId };
  }

  /** Persist both Razorpay credentials server-side */
  async savePaymentGatewayConfig(
    keyId: string,
    keySecret: string,
  ): Promise<void> {
    await this.repo.set(CONFIG_KEYS.RAZORPAY_KEY_ID, keyId);
    await this.repo.set(CONFIG_KEYS.RAZORPAY_KEY_SECRET, keySecret);
  }
}
