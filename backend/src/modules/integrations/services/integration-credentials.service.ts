import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/security/encryption.service';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import {
  IntegrationCredential,
  CreateIntegrationCredentialDto,
  UpdateIntegrationCredentialDto,
  SafeIntegrationCredentialResponse,
  IntegrationProvider,
  IntegrationStatus,
  INTEGRATION_PROVIDER_DEFINITIONS,
} from '../types/integration.types';

@Injectable()
export class IntegrationCredentialsService {
  private readonly logger = new Logger(IntegrationCredentialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  private get dbModel() {
    return (this.prisma as any).integrationCredential;
  }

  /**
   * Validate that required non-secret and secret fields are present for a given provider.
   * SEC-P2-01: Rejects any secret fields explicitly passed inside the public config dictionary.
   */
  public validateProviderFields(
    provider: IntegrationProvider,
    config: Record<string, any>,
    secrets?: Record<string, any>,
    isUpdate = false,
  ): void {
    const def = INTEGRATION_PROVIDER_DEFINITIONS[provider];
    if (!def) {
      throw new Error(`Unsupported integration provider: ${provider}`);
    }

    if (config && typeof config === 'object') {
      // SEC-P2-01: REJECT any secret field found inside config!
      const secretFields = def.secretFields || [];
      for (const key of Object.keys(config)) {
        const isSecret = secretFields.some(
          (sf) => sf.trim().toLowerCase() === key.trim().toLowerCase(),
        );
        if (isSecret) {
          throw new Error(
            `Security violation: Secret field "${key}" must not be passed inside public config dictionary for provider "${provider}". Put secret fields inside secrets dictionary.`,
          );
        }
      }

      for (const field of def.nonSecretFields) {
        if (!isUpdate && (config[field] === undefined || config[field] === null || config[field] === '')) {
          throw new Error(`Missing required configuration field: "${field}" for provider "${provider}".`);
        }
      }
    }

    if (secrets && typeof secrets === 'object') {
      for (const field of def.secretFields) {
        if (!isUpdate && (secrets[field] === undefined || secrets[field] === null || secrets[field] === '')) {
          throw new Error(`Missing required secret field: "${field}" for provider "${provider}".`);
        }
      }
    }
  }

  /**
   * Create a new IntegrationCredential record.
   * Strictly prevents duplicate platform credentials (companyId = null) for the same provider,
   * relying on PostgreSQL partial unique indexes as the final database-level authority.
   */
  public async createCredential(
    dto: CreateIntegrationCredentialDto,
  ): Promise<SafeIntegrationCredentialResponse> {
    const targetCompanyId = dto.companyId ?? null;

    // Platform-level pre-check for friendly application error
    if (targetCompanyId === null) {
      const existing = await this.dbModel.findFirst({
        where: {
          provider: dto.provider,
          companyId: null,
        },
      });

      if (existing) {
        throw new Error(
          `Platform integration credential for provider "${dto.provider}" already exists.`,
        );
      }
    }

    // Validate provider fields (including SEC-P2-01 secret-in-config rejection)
    this.validateProviderFields(dto.provider, dto.config, dto.secrets, false);

    // Encrypt secret fields JSON payload
    const encryptedSecrets = this.encryptionService.encrypt(
      JSON.stringify(dto.secrets || {}),
    );

    try {
      const record: IntegrationCredential = await this.dbModel.create({
        data: {
          provider: dto.provider,
          name: dto.name,
          enabled: true,
          companyId: targetCompanyId,
          config: dto.config,
          encryptedSecrets,
          status: IntegrationStatus.UNTESTED,
          createdById: dto.createdById ?? null,
        },
      });

      if (this.auditLogger) {
        await this.auditLogger.logAction({
          companyId: targetCompanyId || 'PLATFORM',
          userId: dto.createdById ?? null,
          action: 'INTEGRATION_CREATED',
          details: `Created integration credential [${record.id}] for provider ${dto.provider}`,
          oldValue: null,
          newValue: { provider: record.provider, name: record.name, enabled: record.enabled },
        });
      }

      return this.toSafeResponse(record, dto.secrets);
    } catch (err: any) {
      // SEC-P2-02: DB-level unique constraint error handling (P2002 or partial unique index violation)
      if (err?.code === 'P2002' || err?.message?.includes('unique constraint') || err?.message?.includes('IntegrationCredential_provider_')) {
        if (targetCompanyId === null) {
          throw new Error(`Platform integration credential for provider "${dto.provider}" already exists.`);
        }
        throw new Error(`Integration credential for provider "${dto.provider}" and company already exists.`);
      }
      throw err;
    }
  }

  /**
   * Update an existing IntegrationCredential record.
   */
  public async updateCredential(
    id: string,
    dto: UpdateIntegrationCredentialDto,
  ): Promise<SafeIntegrationCredentialResponse> {
    const existing: IntegrationCredential | null = await this.dbModel.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Integration credential with ID "${id}" not found.`);
    }

    let updatedConfig = (existing.config || {}) as Record<string, any>;
    if (dto.config) {
      updatedConfig = { ...updatedConfig, ...dto.config };
    }

    let updatedSecrets: Record<string, any> | undefined;
    let encryptedSecrets = existing.encryptedSecrets;

    if (dto.secrets && Object.keys(dto.secrets).length > 0) {
      const existingDecrypted = await this.getResolvedSecretsInternal(existing);
      updatedSecrets = { ...existingDecrypted, ...dto.secrets };
      this.validateProviderFields(existing.provider as IntegrationProvider, updatedConfig, updatedSecrets, true);
      encryptedSecrets = this.encryptionService.encrypt(
        JSON.stringify(updatedSecrets),
      );
    } else if (dto.config) {
      this.validateProviderFields(existing.provider as IntegrationProvider, updatedConfig, undefined, true);
    }

    const record: IntegrationCredential = await this.dbModel.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        enabled: dto.enabled ?? existing.enabled,
        config: updatedConfig,
        encryptedSecrets,
        status: dto.status ?? existing.status,
        lastTestedAt: dto.lastTestedAt ?? existing.lastTestedAt,
        lastError: dto.lastError ?? existing.lastError,
      },
    });

    if (this.auditLogger) {
      await this.auditLogger.logAction({
        companyId: record.companyId || 'PLATFORM',
        action: 'INTEGRATION_UPDATED',
        details: `Updated integration credential [${record.id}] for provider ${record.provider}`,
        oldValue: { name: existing.name, enabled: existing.enabled },
        newValue: { name: record.name, enabled: record.enabled },
      });
    }

    return this.toSafeResponse(record, updatedSecrets);
  }

  /**
   * Delete an IntegrationCredential record by ID.
   */
  public async deleteCredential(id: string): Promise<boolean> {
    const existing: IntegrationCredential | null = await this.dbModel.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Integration credential with ID "${id}" not found.`);
    }

    await this.dbModel.delete({
      where: { id },
    });

    if (this.auditLogger) {
      await this.auditLogger.logAction({
        companyId: existing.companyId || 'PLATFORM',
        action: 'INTEGRATION_DELETED',
        details: `Deleted integration credential [${existing.id}] for provider ${existing.provider}`,
        oldValue: { provider: existing.provider, name: existing.name },
        newValue: null,
      });
    }

    return true;
  }

  /**
   * Retrieve credential by ID with masked secrets.
   */
  public async getCredentialById(
    id: string,
  ): Promise<SafeIntegrationCredentialResponse> {
    const record: IntegrationCredential | null = await this.dbModel.findUnique({
      where: { id },
    });

    if (!record) {
      throw new Error(`Integration credential with ID "${id}" not found.`);
    }

    return this.toSafeResponse(record);
  }

  /**
   * Retrieve platform or tenant credential by provider with masked secrets.
   */
  public async getCredentialByProvider(
    provider: IntegrationProvider,
    companyId: string | null = null,
  ): Promise<SafeIntegrationCredentialResponse | null> {
    const record: IntegrationCredential | null = await this.dbModel.findFirst({
      where: {
        provider,
        companyId,
      },
    });

    if (!record) {
      return null;
    }

    return this.toSafeResponse(record);
  }

  /**
   * List credentials with masked secrets.
   */
  public async listCredentials(
    companyId: string | null = null,
  ): Promise<SafeIntegrationCredentialResponse[]> {
    const records: IntegrationCredential[] = await this.dbModel.findMany({
      where: {
        companyId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(records.map((r) => this.toSafeResponse(r)));
  }

  /**
   * Enable or disable a credential.
   */
  public async setCredentialStatus(
    id: string,
    enabled: boolean,
  ): Promise<SafeIntegrationCredentialResponse> {
    const existing: IntegrationCredential | null = await this.dbModel.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Integration credential with ID "${id}" not found.`);
    }

    const newStatus = enabled
      ? existing.status === IntegrationStatus.DISABLED
        ? IntegrationStatus.UNTESTED
        : existing.status
      : IntegrationStatus.DISABLED;

    const record: IntegrationCredential = await this.dbModel.update({
      where: { id },
      data: {
        enabled,
        status: newStatus,
      },
    });

    if (this.auditLogger) {
      await this.auditLogger.logAction({
        companyId: record.companyId || 'PLATFORM',
        action: enabled ? 'INTEGRATION_ENABLED' : 'INTEGRATION_DISABLED',
        details: `${enabled ? 'Enabled' : 'Disabled'} integration credential [${record.id}] for provider ${record.provider}`,
        oldValue: { enabled: existing.enabled },
        newValue: { enabled: record.enabled },
      });
    }

    return this.toSafeResponse(record);
  }

  /**
   * INTERNAL ONLY: Decrypt secrets for backend service consumption.
   * MUST NOT be exposed to controllers or returned to frontend.
   */
  public async getResolvedSecretsInternal(
    idOrRecord: string | IntegrationCredential,
  ): Promise<Record<string, any>> {
    let record: IntegrationCredential | null;

    if (typeof idOrRecord === 'string') {
      record = await this.dbModel.findUnique({
        where: { id: idOrRecord },
      });
    } else {
      record = idOrRecord;
    }

    if (!record) {
      throw new Error('Integration credential record not found.');
    }

    const decryptedJson = this.encryptionService.decrypt(
      record.encryptedSecrets,
    );

    try {
      return JSON.parse(decryptedJson);
    } catch {
      throw new Error('Failed to parse decrypted secrets payload.');
    }
  }

  /**
   * Format DB record into safe administrative response with masked secrets.
   */
  public async toSafeResponse(
    record: IntegrationCredential,
    knownSecrets?: Record<string, any>,
  ): Promise<SafeIntegrationCredentialResponse> {
    const def =
      INTEGRATION_PROVIDER_DEFINITIONS[record.provider as IntegrationProvider];
    const secretKeys =
      def?.secretFields || ['keySecret', 'secretAccessKey', 'password', 'webhookSecret', 'clientSecret', 'accessToken', 'appSecret'];

    let targetSecretKeys = secretKeys;
    if (knownSecrets) {
      targetSecretKeys = Array.from(new Set([...secretKeys, ...Object.keys(knownSecrets)]));
    } else {
      try {
        const decrypted = await this.getResolvedSecretsInternal(record);
        targetSecretKeys = Array.from(new Set([...secretKeys, ...Object.keys(decrypted)]));
      } catch {
        // Fallback to static provider definition secret keys if decryption fails
      }
    }

    const maskedSecrets: Record<string, string> = {};
    for (const key of targetSecretKeys) {
      maskedSecrets[key] = '••••••••';
    }

    return {
      id: record.id,
      provider: record.provider as IntegrationProvider,
      name: record.name,
      enabled: record.enabled,
      companyId: record.companyId,
      status: record.status as IntegrationStatus,
      config: (record.config || {}) as Record<string, any>,
      maskedSecrets,
      lastTestedAt: record.lastTestedAt,
      lastError: record.lastError,
      createdById: record.createdById,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
