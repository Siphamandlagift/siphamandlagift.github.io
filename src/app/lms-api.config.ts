import { InjectionToken, Provider } from '@angular/core';

export type LmsApiConfig = {
  baseUrl: string;
  defaultStudentId: string;
};

export const LMS_API_CONFIG = new InjectionToken<LmsApiConfig>('LMS_API_CONFIG');

function resolveDefaultLmsApiBaseUrl() {
  if (typeof globalThis.location === 'undefined') {
    return 'http://localhost:3000/api';
  }

  const { hostname, origin } = globalThis.location;

  return hostname === 'localhost' || hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : `${origin.replace(/\/$/, '')}/api`;
}

function normalizeConfigValue(value: string | undefined, fallbackValue: string) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue.replace(/\/$/, '') : fallbackValue;
}

export function provideLmsApiConfig(config?: Partial<LmsApiConfig>): Provider {
  return {
    provide: LMS_API_CONFIG,
    useValue: {
      baseUrl: normalizeConfigValue(config?.baseUrl, resolveDefaultLmsApiBaseUrl()),
      defaultStudentId: config?.defaultStudentId ?? 'student-1',
    } satisfies LmsApiConfig,
  };
}