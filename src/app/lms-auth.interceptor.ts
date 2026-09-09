import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { LMS_API_CONFIG } from './lms-api.config';
import { clearLmsAuthSession, hasRequiredSessionFields, isLmsSessionExpired, readLmsSessionRecord } from './session-auth';

export const lmsAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(LMS_API_CONFIG);
  const router = inject(Router);

  // Only attach auth header for LMS API requests — and never for /api/platform/*, which carries
  // its own, entirely separate Super Admin session (see super-admin/platform-auth.interceptor.ts).
  if (!request.url.startsWith(config.baseUrl) || request.url.startsWith(`${config.baseUrl}/platform`)) {
    return next(request);
  }

  const session = readLmsSessionRecord();
  if (session && isLmsSessionExpired(session)) {
    clearLmsAuthSession();
    void router.navigate(['/']);
    return next(request);
  }

  if (session && !hasRequiredSessionFields(session)) {
    clearLmsAuthSession();
    return next(request);
  }

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('lms-token') : null;

  if (!token) {
    return next(request);
  }

  return next(request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  }));
};
