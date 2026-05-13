import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantAuthService } from './tenant-auth.service';

export const tenantAuthGuard: CanActivateFn = (_route, state) => {
  const auth = inject(TenantAuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/tenant/login'], {
    queryParams: { redirect: state.url },
  });
};