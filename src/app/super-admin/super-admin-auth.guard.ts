import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { clearPlatformAuthSession, hasActivePlatformSession } from './platform-session-auth';

// Kept separate from the company-user authGuard (auth.guard.ts) rather than a 4th branch on it —
// same reasoning as everywhere else in the retrofit: a Super Admin isn't a company role, it's a
// different identity model with its own session store entirely.
export const superAdminAuthGuard: CanActivateFn = () => {
  const router = inject(Router);

  if (!hasActivePlatformSession()) {
    clearPlatformAuthSession();
    router.navigate(['/super-admin']);
    return false;
  }

  return true;
};
