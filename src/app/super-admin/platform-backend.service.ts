import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LMS_API_CONFIG } from '../lms-api.config';

export type SubscriptionPlan = 'starter' | 'growth' | 'enterprise';
export type SubscriptionStatus = 'active' | 'suspended' | 'cancelled';

export type SubscriptionRecord = {
  plan: SubscriptionPlan;
  licenseLimit: number;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
};

export type CompanyUsageSummary = {
  userCount: number;
  licenseLimit: number;
};

export type CompanyWithUsage = {
  id: string;
  name: string;
  createdAt: string;
  createdBySuperAdminId: string;
  subscription: SubscriptionRecord;
  usage: CompanyUsageSummary;
};

export type PlatformLoginRequest = {
  email: string;
  password: string;
};

export type PlatformLoginResponse = {
  adminId: string;
  name: string;
  email: string;
  token: string;
};

export type CreateCompanyRequest = {
  name: string;
  plan: SubscriptionPlan;
  licenseLimit: number;
  startDate: string;
  endDate: string;
};

export type UpdateCompanySubscriptionRequest = Partial<{
  plan: SubscriptionPlan;
  licenseLimit: number;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
}>;

export type CreateCompanyAdminRequest = {
  email: string;
  password: string;
};

export type PlatformUsageOverview = {
  companyCount: number;
  totalUsers: number;
  companies: Array<{
    companyId: string;
    name: string;
    usage: CompanyUsageSummary;
    status: SubscriptionStatus;
  }>;
};

@Injectable({ providedIn: 'root' })
export class PlatformBackendService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(LMS_API_CONFIG);

  private get baseUrl() {
    return `${this.config.baseUrl}/platform`;
  }

  login(input: PlatformLoginRequest): Observable<PlatformLoginResponse> {
    return this.http.post<PlatformLoginResponse>(`${this.baseUrl}/auth/login`, input);
  }

  listCompanies(): Observable<CompanyWithUsage[]> {
    return this.http.get<CompanyWithUsage[]>(`${this.baseUrl}/companies`);
  }

  getCompany(companyId: string): Observable<CompanyWithUsage> {
    return this.http.get<CompanyWithUsage>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}`);
  }

  createCompany(input: CreateCompanyRequest): Observable<CompanyWithUsage> {
    return this.http.post<CompanyWithUsage>(`${this.baseUrl}/companies`, input);
  }

  updateSubscription(companyId: string, patch: UpdateCompanySubscriptionRequest) {
    return this.http.patch<CompanyWithUsage>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/subscription`, patch);
  }

  createCompanyAdmin(companyId: string, input: CreateCompanyAdminRequest) {
    return this.http.post<{ id: string; email: string; role: string }>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/admins`, input);
  }

  getUsageOverview(): Observable<PlatformUsageOverview> {
    return this.http.get<PlatformUsageOverview>(`${this.baseUrl}/usage`);
  }
}
