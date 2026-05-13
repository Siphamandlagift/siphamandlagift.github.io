import { Inject, Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { TENANT_API_CONFIG, type TenantApiConfig } from './tenant-api.config';
import type { TenantAuthResponse, TenantAuthUser, TenantLoginRequest, TenantPermission, TenantRegisterRequest, TenantUserRole } from './models';
import { permissionsForRole } from './tenant-rbac';

type StoredTenantSession = TenantAuthResponse;

@Injectable({ providedIn: 'root' })
export class TenantAuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(null);
  readonly currentUser = signal<TenantAuthUser | null>(null);
  readonly isAuthenticated = computed(() => !!this.token() && !!this.currentUser());

  constructor(@Inject(TENANT_API_CONFIG) private readonly config: TenantApiConfig) {
    this.restoreSession();
  }

  login(input: TenantLoginRequest) {
    return this.http.post<TenantAuthResponse>(`${this.config.baseUrl}/auth/login`, input).pipe(
      tap((response) => this.persistSession(response)),
    );
  }

  register(input: TenantRegisterRequest) {
    return this.http.post<TenantAuthResponse>(`${this.config.baseUrl}/auth/register`, input).pipe(
      tap((response) => this.persistSession(response)),
    );
  }

  logout() {
    this.clearSession();
    void this.router.navigate(['/tenant/login']);
  }

  canAccessRole(roles: readonly TenantUserRole[]) {
    const role = this.currentUser()?.role;
    return !!role && roles.includes(role);
  }

  hasPermission(permission: TenantPermission) {
    return this.currentUser()?.permissions.includes(permission) ?? false;
  }

  hasAnyPermission(permissions: readonly TenantPermission[]) {
    return permissions.some((permission) => this.hasPermission(permission));
  }

  dashboardRouteForRole(role = this.currentUser()?.role) {
    switch (role) {
      case 'admin':
        return '/tenant/dashboard/admin';
      case 'manager':
        return '/tenant/dashboard/manager';
      case 'learner':
        return '/tenant/dashboard/learner';
      default:
        return '/tenant/login';
    }
  }

  private restoreSession() {
    try {
      const rawSession = localStorage.getItem(this.config.sessionStorageKey);

      if (!rawSession) {
        return;
      }

      const parsedSession = JSON.parse(rawSession) as StoredTenantSession;
      this.token.set(parsedSession.token);
      this.currentUser.set(this.normalizeUserPermissions(parsedSession.user));
    } catch {
      this.clearSession();
    }
  }

  private persistSession(session: StoredTenantSession) {
    const normalizedSession = {
      ...session,
      user: this.normalizeUserPermissions(session.user),
    } satisfies StoredTenantSession;

    localStorage.setItem(this.config.sessionStorageKey, JSON.stringify(normalizedSession));
    this.token.set(normalizedSession.token);
    this.currentUser.set(normalizedSession.user);
  }

  private clearSession() {
    localStorage.removeItem(this.config.sessionStorageKey);
    this.token.set(null);
    this.currentUser.set(null);
  }

  private normalizeUserPermissions(user: TenantAuthUser): TenantAuthUser {
    return {
      ...user,
      permissions: user.permissions?.length ? user.permissions : permissionsForRole(user.role),
    };
  }
}