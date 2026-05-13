
import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { tenantAuthGuard } from './multi-tenant/tenant-auth.guard';
import { tenantRoleGuard } from './multi-tenant/tenant-role.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./login/login').then((m) => m.Login) },
  { path: 'tenant/login', loadComponent: () => import('./multi-tenant/tenant-login.component').then((m) => m.TenantLoginComponent) },
  { path: 'tenant/register', loadComponent: () => import('./multi-tenant/tenant-register.component').then((m) => m.TenantRegisterComponent) },
  {
    path: 'tenant/dashboard',
    loadComponent: () => import('./multi-tenant/tenant-dashboard.component').then((m) => m.TenantDashboardComponent),
    canActivate: [tenantAuthGuard, tenantRoleGuard],
    data: { permissions: ['dashboard:read'] },
  },
  {
    path: 'tenant/dashboard/admin',
    loadComponent: () => import('./multi-tenant/tenant-dashboard.component').then((m) => m.TenantDashboardComponent),
    canActivate: [tenantAuthGuard, tenantRoleGuard],
    data: { roles: ['admin'], permissions: ['dashboard:read', 'courses:create', 'users:read'] },
  },
  {
    path: 'tenant/dashboard/manager',
    loadComponent: () => import('./multi-tenant/tenant-dashboard.component').then((m) => m.TenantDashboardComponent),
    canActivate: [tenantAuthGuard, tenantRoleGuard],
    data: { roles: ['manager'], permissions: ['dashboard:read', 'users:read', 'enrollments:company:read'] },
  },
  {
    path: 'tenant/dashboard/learner',
    loadComponent: () => import('./multi-tenant/tenant-dashboard.component').then((m) => m.TenantDashboardComponent),
    canActivate: [tenantAuthGuard, tenantRoleGuard],
    data: { roles: ['learner'], permissions: ['dashboard:read', 'enrollments:self:read'] },
  },
  { path: 'reset-password', loadComponent: () => import('./reset-password/reset-password').then((m) => m.ResetPasswordComponent) },
  { path: 'admin-profile', loadComponent: () => import('./admin-profile.component').then((m) => m.AdminProfileComponent), canActivate: [authGuard] },
  { path: 'student-profile', loadComponent: () => import('./student-profile.component').then((m) => m.StudentProfileComponent), canActivate: [authGuard] },
  { path: 'training-manager-profile', loadComponent: () => import('./training-manager-profile.component').then((m) => m.TrainingManagerProfileComponent), canActivate: [authGuard] },
];
