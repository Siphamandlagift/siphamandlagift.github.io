import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideLmsApiConfig } from './lms-api.config';
import { provideTenantApiConfig } from './multi-tenant/tenant-api.config';
import { tenantAuthInterceptor } from './multi-tenant/tenant-auth.interceptor';
import { lmsAuthInterceptor } from './lms-auth.interceptor';

export type RuntimeAppConfig = {
  lmsApiBaseUrl?: string;
  tenantApiBaseUrl?: string;
  defaultStudentId?: string;
  tenantSessionStorageKey?: string;
};

export function createAppConfig(runtimeConfig: RuntimeAppConfig = {}): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideHttpClient(withInterceptors([lmsAuthInterceptor, tenantAuthInterceptor])),
      provideRouter(routes),
      provideLmsApiConfig({
        baseUrl: runtimeConfig.lmsApiBaseUrl,
        defaultStudentId: runtimeConfig.defaultStudentId,
      }),
      provideTenantApiConfig({
        baseUrl: runtimeConfig.tenantApiBaseUrl,
        sessionStorageKey: runtimeConfig.tenantSessionStorageKey,
      }),
    ],
  };
}

export const appConfig: ApplicationConfig = createAppConfig();
