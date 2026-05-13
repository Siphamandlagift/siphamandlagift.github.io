import type { MultiTenantRepository } from '../repositories/multitenant.repository.js';
import { AppError } from '../errors.js';
import { hasPermission } from '../rbac.js';
import type { AuthenticatedUserProfile } from '../types.js';

export class CourseService {
  constructor(private readonly repository: MultiTenantRepository) {}

  listCourses(user: AuthenticatedUserProfile) {
    if (hasPermission(user.role, 'enrollments:self:read') && !hasPermission(user.role, 'enrollments:company:read')) {
      // Learners may only see courses they are enrolled in.
      return this.repository.listCoursesByUserEnrollment(user.userId, user.companyId);
    }

    return this.repository.listCoursesByCompany(user.companyId);
  }

  createCourse(companyId: string, title: string) {
    return this.repository.createCourse(companyId, title);
  }

  async updateProgress(user: AuthenticatedUserProfile, courseId: string, progress: number) {
    const updated = await this.repository.updateEnrollmentProgress(user.userId, courseId, user.companyId, progress);

    if (!updated) {
      throw new AppError('Enrollment not found or you do not have access to this course.', 404);
    }

    return updated;
  }
}