import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { TenantPermission, TenantUserRole } from './models';
import { TenantAuthService } from './tenant-auth.service';

export const tenantRoleGuard: CanActivateFn = (route, state) => {
  const auth = inject(TenantAuthService);
  const router = inject(Router);
  const allowedRoles = (route.data?.['roles'] as TenantUserRole[] | undefined) ?? [];
  const requiredPermissions = (route.data?.['permissions'] as TenantPermission[] | undefined) ?? [];

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/tenant/login'], {
      queryParams: { redirect: state.url },
    });
  }

  if (allowedRoles.length && !auth.canAccessRole(allowedRoles)) {
    return router.createUrlTree([auth.dashboardRouteForRole()]);
  }

  if (requiredPermissions.length && !auth.hasAnyPermission(requiredPermissions)) {
    return router.createUrlTree([auth.dashboardRouteForRole()]);
  }

  return true;
};