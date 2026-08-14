import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, inject } from '@angular/core';
import { TENANT_API_CONFIG, type TenantApiConfig } from './tenant-api.config';
import type { TenantCompanyRow, TenantCourse, TenantDashboardResponse, TenantSubscription, TenantUsageSummary, TenantUser } from './models';

@Injectable({ providedIn: 'root' })
export class TenantApiService {
  private readonly http = inject(HttpClient);

  constructor(@Inject(TENANT_API_CONFIG) private readonly config: TenantApiConfig) {}

  getDashboard() {
    return this.http.get<TenantDashboardResponse>(`${this.config.baseUrl}/dashboard`);
  }

  getUsers() {
    return this.http.get<TenantUser[]>(`${this.config.baseUrl}/users`);
  }

  getCourses() {
    return this.http.get<TenantCourse[]>(`${this.config.baseUrl}/courses`);
  }

  createCourse(title: string) {
    return this.http.post<TenantCourse>(`${this.config.baseUrl}/courses`, { title });
  }

  updateProgress(courseId: string, progress: number) {
    return this.http.patch<{ id: string; progress: number }>(
      `${this.config.baseUrl}/courses/${courseId}/progress`,
      { progress },
    );
  }

  getMySubscription() {
    return this.http.get<TenantUsageSummary>(`${this.config.baseUrl}/billing/me`);
  }

  /** Platform admin only: list all companies with subscription status */
  getAllCompanies() {
    return this.http.get<TenantCompanyRow[]>(`${this.config.baseUrl}/billing`);
  }

  /** Platform admin only */
  updateSubscription(companyId: string, body: Partial<TenantSubscription>) {
    return this.http.put<TenantSubscription>(`${this.config.baseUrl}/billing/${companyId}`, body);
  }
}