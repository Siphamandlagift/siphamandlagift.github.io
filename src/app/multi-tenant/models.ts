export type TenantUserRole = 'admin' | 'manager' | 'learner';

export type TenantPermission =
  | 'dashboard:read'
  | 'users:read'
  | 'courses:read'
  | 'courses:create'
  | 'enrollments:company:read'
  | 'enrollments:self:read'
  | 'enrollments:self:update';

export type TenantLicenseType = 'starter' | 'growth' | 'enterprise';

export type TenantAuthUser = {
  userId: string;
  companyId: string;
  companyName: string;
  licenseType: TenantLicenseType;
  name: string;
  email: string;
  role: TenantUserRole;
  permissions: TenantPermission[];
};

export type TenantAuthResponse = {
  token: string;
  user: TenantAuthUser;
};

export type TenantLoginRequest = {
  email: string;
  password: string;
};

export type TenantRegisterRequest = {
  companyName: string;
  licenseType: TenantLicenseType;
  name: string;
  email: string;
  password: string;
};

export type TenantUser = {
  id: string;
  name: string;
  email: string;
  role: TenantUserRole;
  companyId: string;
};

export type TenantCourse = {
  id: string;
  title: string;
  companyId: string;
  enrollmentCount: number;
  averageProgress: number;
};

export type TenantEnrollment = {
  id: string;
  userId: string;
  courseId: string;
  progress: number;
  companyId: string;
  learnerName: string;
  learnerEmail: string;
  courseTitle: string;
};

export type TenantDashboardResponse = {
  user: TenantAuthUser;
  summary: {
    totalUsers: number;
    totalCourses: number;
    totalEnrollments: number;
    averageProgress: number;
    myEnrollments: number;
  };
  users: TenantUser[];
  courses: TenantCourse[];
  enrollments: TenantEnrollment[];
};