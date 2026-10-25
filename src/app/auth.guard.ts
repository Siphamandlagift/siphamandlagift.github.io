import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { clearLmsAuthSession, companyScopedRoute, hasActiveLmsSession, readLmsCompanyUrlSlug, readLmsSessionRecord } from './session-auth';

export const authGuard: CanActivateFn = (route) => {
  const router = inject(Router);

  if (!hasActiveLmsSession()) {
    clearLmsAuthSession();
    router.navigate(['/']);
    return false;
  }

  const session = readLmsSessionRecord();
  if (!session || !session.role || !session.username) {
    clearLmsAuthSession();
    router.navigate(['/']);
    return false;
  }

  // Matches both route registrations in app.routes.ts for this profile — the flat one
  // ('admin-profile') and the company-scoped one (':companySlug/admin-profile') — without
  // needing to parse the URL by hand.
  const routePath = route.routeConfig?.path ?? '';
  const bareProfilePath = routePath.endsWith('admin-profile') ? 'admin-profile'
    : routePath.endsWith('student-profile') ? 'student-profile'
    : routePath.endsWith('training-manager-profile') ? 'training-manager-profile'
    : null;

  // Role-based protection
  if (
    (bareProfilePath === 'admin-profile' && session.role !== 'administrator')
    || (bareProfilePath === 'student-profile' && session.role !== 'student')
    || (bareProfilePath === 'training-manager-profile' && session.role !== 'training-manager')
  ) {
    clearLmsAuthSession();
    router.navigate(['/']);
    return false;
  }

  // Company-scoped routes carry a :companySlug segment — if it doesn't match the slug THIS
  // session actually logged into (a stale bookmark, a hand-edited URL, or a tab that hasn't yet
  // picked up app.ts's cross-tab reload), correct the URL instead of trusting it. Company access
  // itself is always resolved from the session token server-side, never from the URL, so a
  // mismatch here can't grant access to another company — it would just keep showing a
  // misleading URL for this one, which is exactly what this guard exists to prevent.
  const urlCompanySlug = route.paramMap.get('companySlug');
  const sessionCompanyUrlSlug = readLmsCompanyUrlSlug();
  if (bareProfilePath && urlCompanySlug && sessionCompanyUrlSlug && urlCompanySlug !== sessionCompanyUrlSlug) {
    router.navigate([companyScopedRoute(sessionCompanyUrlSlug, `/${bareProfilePath}`)]);
    return false;
  }

  return true;
};
