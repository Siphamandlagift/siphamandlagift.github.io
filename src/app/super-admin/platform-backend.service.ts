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

export type SuperAdminSummary = {
  id: string;
  name: string;
  email: string;
};

export type CreateSuperAdminRequest = {
  name: string;
  email: string;
  password: string;
};

export type PlatformPasswordResetRequest = {
  email: string;
};

export type PlatformPasswordResetRequestResponse = {
  message: string;
};

export type PlatformPasswordResetTokenStatus = {
  valid: boolean;
  email?: string;
  expiresAt?: string;
};

export type PlatformPasswordResetConfirmRequest = {
  token: string;
  password: string;
};

export type PlatformPasswordResetConfirmResponse = {
  message: string;
  name: string;
  email: string;
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
  backgroundImageUrl: string | null;
};

export type UploadedBrandingImage = {
  url: string;
  path: string;
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

  // Mirrors LmsBackendService.uploadFileBase64's FileReader-to-base64 pattern — a Super Admin
  // token has no companyId of its own, so companyId is passed explicitly only when uploading FOR
  // a specific company's branding (scopes the Storage path the same way that company's own
  // admin-set logo already is); omitted for the platform-wide default.
  uploadBrandingImage(file: File, companyId?: string): Observable<UploadedBrandingImage> {
    return new Observable((observer) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const dataBase64 = result.slice(result.indexOf(',') + 1);
        this.http.post<UploadedBrandingImage>(`${this.baseUrl}/storage/upload-base64`, {
          folder: 'branding',
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          dataBase64,
          ...(companyId ? { companyId } : {}),
        }).subscribe(observer);
      };
      reader.onerror = () => observer.error(reader.error ?? new Error('Could not read the selected file.'));
      reader.readAsDataURL(file);
    });
  }

  requestPasswordReset(input: PlatformPasswordResetRequest): Observable<PlatformPasswordResetRequestResponse> {
    return this.http.post<PlatformPasswordResetRequestResponse>(`${this.baseUrl}/auth/password-reset/request`, input);
  }

  validatePasswordResetToken(token: string): Observable<PlatformPasswordResetTokenStatus> {
    return this.http.get<PlatformPasswordResetTokenStatus>(`${this.baseUrl}/auth/password-reset/validate`, { params: { token } });
  }

  confirmPasswordReset(input: PlatformPasswordResetConfirmRequest): Observable<PlatformPasswordResetConfirmResponse> {
    return this.http.post<PlatformPasswordResetConfirmResponse>(`${this.baseUrl}/auth/password-reset/confirm`, input);
  }

  listAdmins(): Observable<SuperAdminSummary[]> {
    return this.http.get<SuperAdminSummary[]>(`${this.baseUrl}/admins`);
  }

  createAdmin(input: CreateSuperAdminRequest): Observable<SuperAdminSummary> {
    return this.http.post<SuperAdminSummary>(`${this.baseUrl}/admins`, input);
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
