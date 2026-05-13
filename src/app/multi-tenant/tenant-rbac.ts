import type { TenantPermission, TenantUserRole } from './models';

const rolePermissions: Record<TenantUserRole, readonly TenantPermission[]> = {
  admin: ['dashboard:read', 'users:read', 'courses:read', 'courses:create', 'enrollments:company:read'],
  manager: ['dashboard:read', 'users:read', 'courses:read', 'enrollments:company:read'],
  learner: ['dashboard:read', 'courses:read', 'enrollments:self:read'],
};

export function permissionsForRole(role: TenantUserRole): TenantPermission[] {
  return [...rolePermissions[role]];
}