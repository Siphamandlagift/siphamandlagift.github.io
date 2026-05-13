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
};

export type AuthTokenPayload = Pick<AuthenticatedUserProfile, 'userId' | 'companyId' | 'email' | 'role' | 'name'>;

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