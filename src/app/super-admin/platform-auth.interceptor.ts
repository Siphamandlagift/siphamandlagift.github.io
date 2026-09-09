import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { LMS_API_CONFIG } from '../lms-api.config';
import {
  clearPlatformAuthSession,
  hasRequiredPlatformSessionFields,
  isPlatformSessionExpired,
  readPlatformSessionRecord,
  readPlatformToken,
} from './platform-session-auth';

// Mirrors lms-auth.interceptor.ts, but for /api/platform/* requests only — both live under the
// same api Cloud Function/baseUrl, so each interceptor has to explicitly claim only its own path
// prefix (see lms-auth.interceptor.ts's own matching exclusion) rather than relying on a
// different origin the way the retiring /tenant-api prototype could.
export const platformAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(LMS_API_CONFIG);
  const router = inject(Router);
  const platformBaseUrl = `${config.baseUrl}/platform`;

  if (!request.url.startsWith(platformBaseUrl) || request.url === `${platformBaseUrl}/auth/login`) {
    return next(request);
  }

  const session = readPlatformSessionRecord();
  if (session && isPlatformSessionExpired(session)) {
    clearPlatformAuthSession();
    void router.navigate(['/super-admin']);
    return next(request);
  }

  if (session && !hasRequiredPlatformSessionFields(session)) {
    clearPlatformAuthSession();
    return next(request);
  }

  const token = readPlatformToken();
  if (!token) {
    return next(request);
  }

  return next(request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  }));
};
