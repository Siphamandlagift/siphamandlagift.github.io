import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { clearLmsAuthSession, hasActiveLmsSession, readLmsSessionRecord } from './session-auth';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);

  if (!hasActiveLmsSession()) {
    clearLmsAuthSession();
    router.navigate(['/']);
    return false;
  }

  const session = readLmsSessionRecord();
  // Route path: e.g. /admin-profile, /student-profile, /training-manager-profile
  const url = state.url;
  if (!session || !session.role || !session.username) {
    clearLmsAuthSession();
    router.navigate(['/']);
    return false;
  }
  // Role-based protection
  if (
    (url.startsWith('/admin-profile') && session.role !== 'administrator') ||
    (url.startsWith('/student-profile') && session.role !== 'student') ||
    (url.startsWith('/training-manager-profile') && session.role !== 'training-manager')
  ) {
    clearLmsAuthSession();
    router.navigate(['/']);
    return false;
  }
  return true;
};
