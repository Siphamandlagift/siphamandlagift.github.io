
import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { superAdminAuthGuard } from './super-admin/super-admin-auth.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./login/login').then((m) => m.Login) },
  // Same Login component, reached at a company's own branded URL (Super Admin sets the slug) —
  // see Login.ngOnInit reading the companySlug route param.
  { path: 'login/:companySlug', loadComponent: () => import('./login/login').then((m) => m.Login) },
  { path: 'super-admin', loadComponent: () => import('./super-admin/super-admin-login.component').then((m) => m.SuperAdminLoginComponent) },
  {
    path: 'super-admin/dashboard',
    loadComponent: () => import('./super-admin/super-admin-dashboard.component').then((m) => m.SuperAdminDashboardComponent),
    canActivate: [superAdminAuthGuard],
  },
  { path: 'reset-password', loadComponent: () => import('./reset-password/reset-password').then((m) => m.ResetPasswordComponent) },
  { path: 'admin-profile', loadComponent: () => import('./admin-profile.component').then((m) => m.AdminProfileComponent), canActivate: [authGuard] },
  { path: 'student-profile', loadComponent: () => import('./student-profile.component').then((m) => m.StudentProfileComponent), canActivate: [authGuard] },
  { path: 'training-manager-profile', loadComponent: () => import('./training-manager-profile.component').then((m) => m.TrainingManagerProfileComponent), canActivate: [authGuard] },
];
