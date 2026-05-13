import { InjectionToken, Provider } from '@angular/core';

export type TenantApiConfig = {
  baseUrl: string;
  sessionStorageKey: string;
};

export const TENANT_API_CONFIG = new InjectionToken<TenantApiConfig>('TENANT_API_CONFIG');

function resolveDefaultTenantApiBaseUrl() {
  if (typeof globalThis.location === 'undefined') {
    return 'http://localhost:3001';
  }

  const { hostname, origin } = globalThis.location;

  return hostname === 'localhost' || hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : `${origin.replace(/\/$/, '')}/tenant-api`;
}

function normalizeConfigValue(value: string | undefined, fallbackValue: string) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue.replace(/\/$/, '') : fallbackValue;
}

export function provideTenantApiConfig(config?: Partial<TenantApiConfig>): Provider {
  return {
    provide: TENANT_API_CONFIG,
    useValue: {
      baseUrl: normalizeConfigValue(config?.baseUrl, resolveDefaultTenantApiBaseUrl()),
      sessionStorageKey: config?.sessionStorageKey ?? 'tenant-lms-session',
    } satisfies TenantApiConfig,
  };
}