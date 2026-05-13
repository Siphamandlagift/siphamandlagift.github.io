import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LMS_API_CONFIG } from './lms-api.config';

export const lmsAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(LMS_API_CONFIG);

  // Only attach auth header for LMS API requests.
  if (!request.url.startsWith(config.baseUrl)) {
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
