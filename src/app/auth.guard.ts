import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

// Simple session state using localStorage (can be replaced with a service)
function getSession() {
  try {
    return JSON.parse(localStorage.getItem('lms-session') || '{}');
  } catch {
    return {};
  }
}

export const authGuard: CanActivateFn = (route, state) => {
  const session = getSession();
  const router = inject(Router);
  // Route path: e.g. /admin-profile, /student-profile, /training-manager-profile
  const url = state.url;
  if (!session || !session.role || !session.username) {
    router.navigate(['/']);
    return false;
  }
  // Role-based protection
  if (
    (url.startsWith('/admin-profile') && session.role !== 'administrator') ||
    (url.startsWith('/student-profile') && session.role !== 'student') ||
    (url.startsWith('/training-manager-profile') && session.role !== 'training-manager')
  ) {
    router.navigate(['/']);
    return false;
  }
  return true;
};
