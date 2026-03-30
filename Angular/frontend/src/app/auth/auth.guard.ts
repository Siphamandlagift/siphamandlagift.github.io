import { Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, UserRole } from './auth.service';

import { inject } from '@angular/core';

export function authGuard(requiredRoles: UserRole[] = []): CanActivateFn {
  return (route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isLoggedIn()) {
      router.navigate(['/auth/login']);
      return false;
    }
    if (requiredRoles.length > 0 && !requiredRoles.includes(auth.getRole()!)) {
      router.navigate(['/auth/login']);
      return false;
    }
    return true;
  };
}
