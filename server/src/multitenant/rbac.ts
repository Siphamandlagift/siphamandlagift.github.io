import type { UserRole } from './types.js';

export type Permission =
  | 'dashboard:read'
  | 'users:read'
  | 'courses:read'
  | 'courses:create'
  | 'enrollments:company:read'
  | 'enrollments:self:read'
  | 'enrollments:self:update';

const rolePermissions: Record<UserRole, readonly Permission[]> = {
  admin: ['dashboard:read', 'users:read', 'courses:read', 'courses:create', 'enrollments:company:read'],
  manager: ['dashboard:read', 'users:read', 'courses:read', 'enrollments:company:read'],
  learner: ['dashboard:read', 'courses:read', 'enrollments:self:read', 'enrollments:self:update'],
};

export function permissionsForRole(role: UserRole): Permission[] {
  return [...rolePermissions[role]];
}

export function hasPermission(role: UserRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}