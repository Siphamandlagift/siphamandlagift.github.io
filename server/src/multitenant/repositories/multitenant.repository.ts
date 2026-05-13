import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { AppError } from '../errors.js';
import { permissionsForRole } from '../rbac.js';
import type {
  AuthenticatedUserProfile,
  CompanyRecord,
  CourseRecord,
  EnrollmentRecord,
  LicenseType,
  UserRecord,
  UserRole,
  UserWithCompanyRecord,
} from '../types.js';

type RegisterTenantInput = {
  companyName: string;
  licenseType: LicenseType;
  name: string;
  email: string;
  passwordHash: string;
};

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
}

export class MultiTenantRepository {
  constructor(private readonly pool: Pool) {}

  async healthCheck() {
    await this.pool.query('select 1');
  }

  async registerTenant(input: RegisterTenantInput) {
    const client = await this.pool.connect();

    try {
      await client.query('begin');
      const company = await this.insertCompany(client, input.companyName, input.licenseType);
      const user = await this.insertUser(client, {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: 'admin',
        companyId: company.id,
      });

      await client.query('commit');

      return {
        userId: user.id,
        companyId: company.id,
        companyName: company.name,
        licenseType: company.licenseType,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: permissionsForRole(user.role),
      } satisfies AuthenticatedUserProfile;
    } catch (error) {
      await client.query('rollback');

      if (isUniqueViolation(error)) {
        throw new AppError('An account with this email address already exists.', 409);
      }

      throw error;
    } finally {
      client.release();
    }
  }

  async findUserByEmail(email: string) {
    // This is the pre-auth identity lookup. It resolves the company context that is
    // then enforced on every tenant-scoped query after the JWT is issued.
    const result = await this.pool.query<UserWithCompanyRecord>(
      `
        select
          users.id,
          users.name,
          users.email,
          users.password_hash as "passwordHash",
          users.role,
          users.company_id as "companyId",
          companies.name as "companyName",
          companies.license_type as "licenseType"
        from users
        inner join companies on companies.id = users.company_id
        where lower(users.email) = lower($1)
        limit 1
      `,
      [email],
    );

    return result.rows[0] ?? null;
  }

  async findAuthenticatedUser(userId: string, companyId: string) {
    const user = await this.queryOneForCompany<UserWithCompanyRecord>(
      companyId,
      `
        select
          users.id,
          users.name,
          users.email,
          users.password_hash as "passwordHash",
          users.role,
          users.company_id as "companyId",
          companies.name as "companyName",
          companies.license_type as "licenseType"
        from users
        inner join companies on companies.id = users.company_id
        where users.company_id = $1 and users.id = $2
        limit 1
      `,
      [userId],
    );

    return user ? this.toAuthenticatedProfile(user) : null;
  }

  async listUsersByCompany(companyId: string) {
    const result = await this.queryForCompany<UserRecord>(
      companyId,
      `
        select
          id,
          name,
          email,
          role,
          company_id as "companyId"
        from users
        where company_id = $1
        order by name asc
      `,
    );

    return result.rows;
  }

  async listCoursesByCompany(companyId: string) {
    const result = await this.queryForCompany<CourseRecord>(
      companyId,
      `
        select
          courses.id,
          courses.title,
          courses.company_id as "companyId",
          count(enrollments.id)::int as "enrollmentCount",
          coalesce(round(avg(enrollments.progress)::numeric, 2), 0)::float as "averageProgress"
        from courses
        left join enrollments on enrollments.course_id = courses.id and enrollments.company_id = courses.company_id
        where courses.company_id = $1
        group by courses.id, courses.title, courses.company_id
        order by courses.title asc
      `,
    );

    return result.rows;
  }

  async createCourse(companyId: string, title: string) {
    try {
      const result = await this.queryForCompany<CourseRecord>(
        companyId,
        `
          insert into courses (title, company_id)
          values ($2, $1)
          returning id, title, company_id as "companyId", 0::int as "enrollmentCount", 0::float as "averageProgress"
        `,
        [title],
      );

      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('A course with this title already exists for your company.', 409);
      }

      throw error;
    }
  }

  async listEnrollmentsByCompany(companyId: string) {
    const result = await this.queryForCompany<EnrollmentRecord>(
      companyId,
      `
        select
          enrollments.id,
          enrollments.user_id as "userId",
          enrollments.course_id as "courseId",
          enrollments.progress,
          enrollments.company_id as "companyId",
          users.name as "learnerName",
          users.email as "learnerEmail",
          courses.title as "courseTitle"
        from enrollments
        inner join users on users.id = enrollments.user_id and users.company_id = enrollments.company_id
        inner join courses on courses.id = enrollments.course_id and courses.company_id = enrollments.company_id
        where enrollments.company_id = $1
        order by users.name asc, courses.title asc
      `,
    );

    return result.rows;
  }

  async listCoursesByUserEnrollment(userId: string, companyId: string) {
    const result = await this.queryForCompany<CourseRecord>(
      companyId,
      `
        select
          courses.id,
          courses.title,
          courses.company_id as "companyId",
          1::int as "enrollmentCount",
          enrollments.progress::float as "averageProgress"
        from courses
        inner join enrollments
          on enrollments.course_id = courses.id
          and enrollments.user_id = $2
          and enrollments.company_id = $1
        where courses.company_id = $1
        order by courses.title asc
      `,
      [userId],
    );

    return result.rows;
  }

  async updateEnrollmentProgress(userId: string, courseId: string, companyId: string, progress: number) {
    const result = await this.queryForCompany<EnrollmentRecord>(
      companyId,
      `
        update enrollments
        set progress = $4
        where company_id = $1 and user_id = $2 and course_id = $3
        returning
          id,
          user_id as "userId",
          course_id as "courseId",
          progress,
          company_id as "companyId",
          '' as "learnerName",
          '' as "learnerEmail",
          '' as "courseTitle"
      `,
      [courseId, userId, progress],
    );

    return result.rows[0] ?? null;
  }

  async listEnrollmentsForUser(userId: string, companyId: string) {
    const result = await this.queryForCompany<EnrollmentRecord>(
      companyId,
      `
        select
          enrollments.id,
          enrollments.user_id as "userId",
          enrollments.course_id as "courseId",
          enrollments.progress,
          enrollments.company_id as "companyId",
          users.name as "learnerName",
          users.email as "learnerEmail",
          courses.title as "courseTitle"
        from enrollments
        inner join users on users.id = enrollments.user_id and users.company_id = enrollments.company_id
        inner join courses on courses.id = enrollments.course_id and courses.company_id = enrollments.company_id
        where enrollments.company_id = $1 and enrollments.user_id = $2
        order by courses.title asc
      `,
      [userId],
    );

    return result.rows;
  }

  private async insertCompany(client: PoolClient, name: string, licenseType: LicenseType) {
    const result = await client.query<CompanyRecord>(
      `
        insert into companies (name, license_type)
        values ($1, $2)
        returning id, name, license_type as "licenseType"
      `,
      [name, licenseType],
    );

    return result.rows[0];
  }

  private async insertUser(
    client: PoolClient,
    input: { name: string; email: string; passwordHash: string; role: UserRole; companyId: string },
  ) {
    const result = await client.query<UserRecord>(
      `
        insert into users (name, email, password_hash, role, company_id)
        values ($1, $2, $3, $4, $5)
        returning id, name, email, role, company_id as "companyId"
      `,
      [input.name, input.email, input.passwordHash, input.role, input.companyId],
    );

    return result.rows[0];
  }

  private toAuthenticatedProfile(user: UserWithCompanyRecord): AuthenticatedUserProfile {
    return {
      userId: user.id,
      companyId: user.companyId,
      companyName: user.companyName,
      licenseType: user.licenseType,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: permissionsForRole(user.role),
    };
  }

  private async queryForCompany<T extends QueryResultRow>(companyId: string, text: string, values: readonly unknown[] = []) {
    this.assertCompanyScope(companyId);
    return this.pool.query<T>(text, [companyId, ...values]);
  }

  private async queryOneForCompany<T extends QueryResultRow>(companyId: string, text: string, values: readonly unknown[] = []) {
    const result = await this.queryForCompany<T>(companyId, text, values);
    return result.rows[0] ?? null;
  }

  private assertCompanyScope(companyId: string) {
    if (!companyId.trim()) {
      throw new AppError('A valid company scope is required to query tenant data.', 500);
    }
  }
}