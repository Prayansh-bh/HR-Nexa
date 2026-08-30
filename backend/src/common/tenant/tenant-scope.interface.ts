export interface TenantScope {
  companyId: string;
  subscriptionId?: string | null;
  isSuperAdmin: boolean;
  isPlatformBypass?: boolean;
}
