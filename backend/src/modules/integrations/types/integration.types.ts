export enum IntegrationProvider {
  RAZORPAY = 'RAZORPAY',
  AWS_S3 = 'AWS_S3',
  SMTP_EMAIL = 'SMTP_EMAIL',
  GOOGLE = 'GOOGLE',
  MICROSOFT = 'MICROSOFT',
  WHATSAPP = 'WHATSAPP',
}

export enum IntegrationStatus {
  CONNECTED = 'CONNECTED',
  FAILED = 'FAILED',
  UNTESTED = 'UNTESTED',
  DISABLED = 'DISABLED',
}

export interface IntegrationCredential {
  id: string;
  provider: IntegrationProvider | string;
  name: string;
  enabled: boolean;
  companyId: string | null;
  config: any;
  encryptedSecrets: string;
  status: IntegrationStatus | string;
  lastTestedAt: Date | null;
  lastError: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationProviderDefinition {
  provider: IntegrationProvider;
  displayName: string;
  description: string;
  nonSecretFields: string[];
  secretFields: string[];
}

export const INTEGRATION_PROVIDER_DEFINITIONS: Record<
  IntegrationProvider,
  IntegrationProviderDefinition
> = {
  [IntegrationProvider.RAZORPAY]: {
    provider: IntegrationProvider.RAZORPAY,
    displayName: 'Razorpay Payment Gateway',
    description: 'Third-party payment gateway integration for HR Nexa billing and checkout.',
    nonSecretFields: ['keyId'],
    secretFields: ['keySecret', 'webhookSecret'],
  },
  [IntegrationProvider.AWS_S3]: {
    provider: IntegrationProvider.AWS_S3,
    displayName: 'AWS S3 Storage',
    description: 'Cloud object storage for employee attachments and generated document storage.',
    nonSecretFields: ['region', 'bucket', 'accessKeyId'],
    secretFields: ['secretAccessKey'],
  },
  [IntegrationProvider.SMTP_EMAIL]: {
    provider: IntegrationProvider.SMTP_EMAIL,
    displayName: 'SMTP Email Gateway',
    description: 'Transactional mail server for system notifications and password resets.',
    nonSecretFields: ['host', 'port', 'secure', 'user', 'from', 'name'],
    secretFields: ['password'],
  },
  [IntegrationProvider.GOOGLE]: {
    provider: IntegrationProvider.GOOGLE,
    displayName: 'Google Workspace',
    description: 'OAuth and single sign-on integration for Google services.',
    nonSecretFields: ['clientId', 'scopes', 'redirectUri'],
    secretFields: ['clientSecret'],
  },
  [IntegrationProvider.MICROSOFT]: {
    provider: IntegrationProvider.MICROSOFT,
    displayName: 'Microsoft Entra ID / Office 365',
    description: 'OAuth and enterprise identity integration for Microsoft services.',
    nonSecretFields: ['clientId', 'tenantId', 'scopes', 'redirectUri'],
    secretFields: ['clientSecret'],
  },
  [IntegrationProvider.WHATSAPP]: {
    provider: IntegrationProvider.WHATSAPP,
    displayName: 'WhatsApp Business API',
    description: 'WhatsApp notification and communication service integration.',
    nonSecretFields: ['phoneNumberId', 'businessAccountId'],
    secretFields: ['accessToken', 'appSecret'],
  },
};

// DTOs & Public Admin Interfaces
export interface CreateIntegrationCredentialDto {
  provider: IntegrationProvider;
  name: string;
  companyId?: string | null;
  config: Record<string, any>;
  secrets: Record<string, any>;
  createdById?: string | null;
}

export interface UpdateIntegrationCredentialDto {
  name?: string;
  enabled?: boolean;
  config?: Record<string, any>;
  secrets?: Record<string, any>;
  status?: IntegrationStatus;
  lastTestedAt?: Date | null;
  lastError?: string | null;
}

/**
 * Safe Administrative Response
 * Plaintext secrets and backend metadata (e.g. 'source') MUST NOT be returned in this object.
 */
export interface SafeIntegrationCredentialResponse {
  id: string;
  provider: IntegrationProvider;
  name: string;
  enabled: boolean;
  companyId: string | null;
  status: IntegrationStatus;
  config: Record<string, any>;
  maskedSecrets: Record<string, string>;
  lastTestedAt: Date | null;
  lastError: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Internal Resolved Credential Interfaces
 * Used exclusively by backend integration resolvers and background workers.
 * The 'source' field is internal only.
 */
export interface ResolvedRazorpayCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  source: 'DB' | 'ENV';
}

export interface ResolvedAwsS3Credentials {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  source: 'DB' | 'ENV';
}

export interface ResolvedSmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  from: string;
  name: string;
  source: 'DB' | 'ENV';
}
