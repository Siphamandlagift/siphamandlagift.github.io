import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LMS_API_CONFIG } from '../lms-api.config';
import type { LmsBrandThemeId } from '../lms-backend.service';

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
  // URL slug for this company's own branded login page (.../login/{slug}) — unset until a Super
  // Admin assigns one (see updateCompanySlug below).
  slug?: string;
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

export type AdministratorAccountSummary = {
  id: string;
  email: string;
  username: string;
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

// The one login screen's branding, shared by every company — see server/src/platform-repository's
// getPlatformBranding/updatePlatformBranding.
export type PlatformBrandingSettings = {
  themeId: LmsBrandThemeId;
  companyLogoDataUrl: string | null;
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

  listCompanyAdmins(companyId: string): Observable<AdministratorAccountSummary[]> {
    return this.http.get<AdministratorAccountSummary[]>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/admins`);
  }

  resetCompanyAdminPassword(companyId: string, accountId: string, password: string) {
    return this.http.put<{ message: string }>(
      `${this.baseUrl}/companies/${encodeURIComponent(companyId)}/admins/${encodeURIComponent(accountId)}/password`,
      { password },
    );
  }

  getUsageOverview(): Observable<PlatformUsageOverview> {
    return this.http.get<PlatformUsageOverview>(`${this.baseUrl}/usage`);
  }

  getBranding(): Observable<PlatformBrandingSettings> {
    return this.http.get<PlatformBrandingSettings>(`${this.baseUrl}/branding`);
  }

  updateBranding(input: PlatformBrandingSettings): Observable<PlatformBrandingSettings> {
    return this.http.put<PlatformBrandingSettings>(`${this.baseUrl}/branding`, input);
  }

  getCompanyBranding(companyId: string): Observable<PlatformBrandingSettings> {
    return this.http.get<PlatformBrandingSettings>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/branding`);
  }

  updateCompanyBranding(companyId: string, input: PlatformBrandingSettings): Observable<PlatformBrandingSettings> {
    return this.http.put<PlatformBrandingSettings>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/branding`, input);
  }

  updateCompanySlug(companyId: string, slug: string): Observable<CompanyWithUsage> {
    return this.http.patch<CompanyWithUsage>(`${this.baseUrl}/companies/${encodeURIComponent(companyId)}/slug`, { slug });
  }
}
