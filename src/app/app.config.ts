import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideLmsApiConfig } from './lms-api.config';
import { lmsAuthInterceptor } from './lms-auth.interceptor';
import { platformAuthInterceptor } from './super-admin/platform-auth.interceptor';

export type RuntimeAppConfig = {
  lmsApiBaseUrl?: string;
  defaultStudentId?: string;
};

export function createAppConfig(runtimeConfig: RuntimeAppConfig = {}): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideHttpClient(withInterceptors([lmsAuthInterceptor, platformAuthInterceptor])),
      provideRouter(routes),
      provideLmsApiConfig({
        baseUrl: runtimeConfig.lmsApiBaseUrl,
        defaultStudentId: runtimeConfig.defaultStudentId,
      }),
    ],
  };
}

export const appConfig: ApplicationConfig = createAppConfig();
