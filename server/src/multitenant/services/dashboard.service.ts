import type { MultiTenantRepository } from '../repositories/multitenant.repository.js';
import { hasPermission } from '../rbac.js';
import type { AuthenticatedUserProfile, DashboardResponse } from '../types.js';

export class DashboardService {
  constructor(private readonly repository: MultiTenantRepository) {}

  async getDashboard(user: AuthenticatedUserProfile): Promise<DashboardResponse> {
    const canViewCompanyEnrollments = hasPermission(user.role, 'enrollments:company:read');
    const canViewUsers = hasPermission(user.role, 'users:read');
    const isLearner = hasPermission(user.role, 'enrollments:self:read') && !canViewCompanyEnrollments;

    const [users, courses, companyEnrollments, myEnrollments] = await Promise.all([
      canViewUsers ? this.repository.listUsersByCompany(user.companyId) : Promise.resolve([]),
      isLearner
        ? this.repository.listCoursesByUserEnrollment(user.userId, user.companyId)
        : this.repository.listCoursesByCompany(user.companyId),
      canViewCompanyEnrollments ? this.repository.listEnrollmentsByCompany(user.companyId) : Promise.resolve([]),
      this.repository.listEnrollmentsForUser(user.userId, user.companyId),
    ]);

    const enrollments = canViewCompanyEnrollments ? companyEnrollments : myEnrollments;

    // Summary stats are scoped to the user's own data unless they can view company-wide enrollments.
    const summaryEnrollments = canViewCompanyEnrollments ? companyEnrollments : myEnrollments;
    const totalEnrollments = summaryEnrollments.length;
    const averageProgress = totalEnrollments
      ? Number((summaryEnrollments.reduce((total: number, item) => total + item.progress, 0) / totalEnrollments).toFixed(2))
      : 0;

    return {
      user,
      summary: {
        totalUsers: canViewUsers ? users.length : 0,
        totalCourses: courses.length,
        totalEnrollments,
        averageProgress,
        myEnrollments: myEnrollments.length,
      },
      users: canViewUsers ? users : [],
      courses,
      enrollments,
    };
  }
}