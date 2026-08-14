import type { Request } from 'express';
import type { Permission } from './rbac.js';

export type UserRole = 'admin' | 'manager' | 'learner';

export type LicenseType = 'starter' | 'growth' | 'enterprise';

export type AuthenticatedUserProfile = {
  userId: string;
  companyId: string;
  companyName: string;
  licenseType: LicenseType;
  name: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  isPlatformAdmin: boolean;
};

export type AuthTokenPayload = Pick<AuthenticatedUserProfile, 'userId' | 'companyId' | 'email' | 'role' | 'name' | 'isPlatformAdmin'>;

export type AuthenticatedRequest = Request & {
  auth?: AuthenticatedUserProfile;
};

export type CompanyRecord = {
  id: string;
  name: string;
  licenseType: LicenseType;
};

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
};

export type UserWithCompanyRecord = UserRecord & {
  passwordHash: string;
  companyName: string;
  licenseType: LicenseType;
  isPlatformAdmin: boolean;
};

export type CourseRecord = {
  id: string;
  title: string;
  companyId: string;
  enrollmentCount: number;
  averageProgress: number;
};

export type EnrollmentRecord = {
  id: string;
  userId: string;
  courseId: string;
  progress: number;
  companyId: string;
  learnerName: string;
  learnerEmail: string;
  courseTitle: string;
};

export type AuthResponse = {
  token: string;
  user: AuthenticatedUserProfile;
};

export type DashboardResponse = {
  user: AuthenticatedUserProfile;
  summary: {
    totalUsers: number;
    totalCourses: number;
    totalEnrollments: number;
    averageProgress: number;
    myEnrollments: number;
  };
  users: UserRecord[];
  courses: CourseRecord[];
  enrollments: EnrollmentRecord[];
};

// ─── Billing ─────────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'active' | 'inactive' | 'suspended';

export type SubscriptionRecord = {
  id: string;
  companyId: string;
  status: SubscriptionStatus;
  activatedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
};

/** Per-plan hard limits. null means unlimited. */
export const PLAN_LIMITS: Record<LicenseType, { maxUsers: number | null; maxCourses: number | null }> = {
  starter: { maxUsers: 15, maxCourses: 10 },
  growth: { maxUsers: 100, maxCourses: 50 },
  enterprise: { maxUsers: null, maxCourses: null },
};

export type UpsertSubscriptionInput = {
  status: SubscriptionStatus;
  activatedAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
};