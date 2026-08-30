import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export const PLATFORM_TENANT = 'PLATFORM';

export interface TenantStore {
  companyId: string;
  subscriptionId: string | null;
  isSuperAdmin: boolean;
}

const asyncLocalStorage = new AsyncLocalStorage<TenantStore>();

@Injectable()
export class TenantContextService {
  static run<R>(store: TenantStore, callback: () => R): R {
    return asyncLocalStorage.run(store, callback);
  }

  static runTenant<R>(companyId: string, callback: () => R): R;
  static runTenant<R>(
    companyId: string,
    subscriptionId: string | null,
    callback: () => R,
  ): R;
  static runTenant<R>(
    companyId: string,
    subOrCb: (string | null) | (() => R),
    callback?: () => R,
  ): R {
    let subscriptionId: string | null = null;
    let cb: () => R;

    if (typeof subOrCb === 'function') {
      cb = subOrCb;
      subscriptionId = null;
    } else {
      subscriptionId = subOrCb;
      cb = callback!;
    }

    const trimmed = (companyId || '').trim();
    if (!trimmed || trimmed === PLATFORM_TENANT) {
      throw new Error(
        'Async Tenant Execution Error: TENANT scope requires a valid, non-platform companyId',
      );
    }
    return asyncLocalStorage.run(
      {
        companyId: trimmed,
        subscriptionId: subscriptionId ? subscriptionId.trim() : null,
        isSuperAdmin: false,
      },
      cb,
    );
  }

  static runPlatform<R>(callback: () => R): R {
    return asyncLocalStorage.run(
      {
        companyId: PLATFORM_TENANT,
        subscriptionId: null,
        isSuperAdmin: true,
      },
      callback,
    );
  }

  static getCompanyId(): string {
    const store = asyncLocalStorage.getStore();
    return store?.companyId || PLATFORM_TENANT;
  }

  static getSubscriptionId(): string | null {
    const store = asyncLocalStorage.getStore();
    return store?.subscriptionId || null;
  }

  static isSuperAdmin(): boolean {
    const store = asyncLocalStorage.getStore();
    return store?.isSuperAdmin ?? false;
  }

  static isPlatform(): boolean {
    const store = asyncLocalStorage.getStore();
    return (store?.companyId === PLATFORM_TENANT || store?.isSuperAdmin) ?? true;
  }

  setCompanyId(companyId: string): void {
    this.setContext(companyId, null, false);
  }

  setContext(
    companyId: string | null,
    subscriptionId: string | null,
    isSuperAdmin: boolean,
  ): void {
    const store = asyncLocalStorage.getStore();
    if (store) {
      store.isSuperAdmin = isSuperAdmin;
      store.companyId = isSuperAdmin
        ? PLATFORM_TENANT
        : companyId && companyId.trim().length > 0
          ? companyId.trim()
          : PLATFORM_TENANT;
      store.subscriptionId = isSuperAdmin
        ? null
        : subscriptionId && subscriptionId.trim().length > 0
          ? subscriptionId.trim()
          : null;
    }
  }

  getCompanyId(): string {
    const store = asyncLocalStorage.getStore();
    return store?.companyId || PLATFORM_TENANT;
  }

  getSubscriptionId(): string | null {
    const store = asyncLocalStorage.getStore();
    return store?.subscriptionId || null;
  }

  isSuperAdmin(): boolean {
    const store = asyncLocalStorage.getStore();
    return store?.isSuperAdmin ?? false;
  }

  isPlatform(): boolean {
    const store = asyncLocalStorage.getStore();
    return (store?.companyId === PLATFORM_TENANT || store?.isSuperAdmin) ?? true;
  }
}
