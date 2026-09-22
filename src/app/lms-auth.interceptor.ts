import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
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

  const outgoing = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(outgoing).pipe(
    catchError((error) => {
      // A company's subscription lapsing mid-session must force an immediate, explained logout —
      // not leave an already-open dashboard silently showing increasingly stale data forever.
      // Every data service's own poll/save error handlers treat a failed request as a transient
      // blip and quietly retry, which is right for a real network hiccup but wrong for this
      // permanent rejection — handling it once here, for every request, closes that gap in one
      // place instead of touching each of those handlers separately. Only acts when a session
      // currently exists: the login call itself has no session yet and gets this same 403 from
      // the server, but login.ts's own submit-error handler already shows the server's message
      // directly for that case — reacting here too would double up two different responses to
      // one failed call.
      if (error?.status === 403 && error?.error?.reason === 'subscription-inactive' && readLmsSessionRecord()) {
        clearLmsAuthSession();
        void router.navigate(['/'], { queryParams: { sessionError: error.error.message } });
      }
      return throwError(() => error);
    }),
  );
};
