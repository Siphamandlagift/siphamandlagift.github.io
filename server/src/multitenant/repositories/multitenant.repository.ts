import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { AppError } from '../errors.js';
import { permissionsForRole } from '../rbac.js';
import type {
  AuthenticatedUserProfile,
  CompanyRecord,
  CourseRecord,
  EnrollmentRecord,
  LicenseType,
  SubscriptionRecord,
  UpsertSubscriptionInput,
  UserRecord,
  UserRole,
  UserWithCompanyRecord,
} from '../types.js';

// ─── Firestore collection names ────────────────────────────────────────────────
const COMPANIES = 'tenantCompanies';
const USERS = 'tenantUsers';
const COURSES = 'tenantCourses';
const ENROLLMENTS = 'tenantEnrollments';

// ─── Firestore document shapes ─────────────────────────────────────────────────
type CompanyDoc = {
  name: string;
  licenseType: LicenseType;
  createdAt: Date;
  subscription?: {
    status: string;
    activatedAt: string | null;
    expiresAt: string | null;
    notes: string | null;
    updatedAt: Date;
  };
};

type UserDoc = {
  name: string;
  email: string;
  emailLower: string;
  passwordHash: string;
  role: UserRole;
  companyId: string;
  isPlatformAdmin: boolean;
  createdAt: Date;
};

type CourseDoc = {
  title: string;
  companyId: string;
  createdAt: Date;
};

type EnrollmentDoc = {
  userId: string;
  courseId: string;
  progress: number;
  companyId: string;
  createdAt: Date;
};

type CompanyWithSubscriptionRow = {
  id: string;
  name: string;
  licenseType: LicenseType;
  subscriptionId: string | null;
  status: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  userCount: number;
  courseCount: number;
};

type RegisterTenantInput = {
  companyName: string;
  licenseType: LicenseType;
  name: string;
  email: string;
  passwordHash: string;
};

export class MultiTenantRepository {
  constructor(private readonly db: Firestore) {}

  async healthCheck() {
    await this.db.collection(COMPANIES).limit(1).get();
  }

  async registerTenant(input: RegisterTenantInput): Promise<AuthenticatedUserProfile> {
    const existing = await this.findUserByEmail(input.email);
    if (existing) {
      throw new AppError('An account with this email address already exists.', 409);
    }

    const existingCompany = await this.db.collection(COMPANIES).where('name', '==', input.companyName).limit(1).get();
    if (!existingCompany.empty) {
      throw new AppError('A company with this name already exists.', 409);
    }

    const companyId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const batch = this.db.batch();

    batch.set(this.db.collection(COMPANIES).doc(companyId), {
      name: input.companyName,
      licenseType: input.licenseType,
      createdAt: new Date(),
      subscription: { status: 'active', activatedAt: now, expiresAt: null, notes: null, updatedAt: new Date() },
    } satisfies CompanyDoc);

    batch.set(this.db.collection(USERS).doc(userId), {
      name: input.name,
      email: input.email,
      emailLower: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      role: 'admin' as UserRole,
      companyId,
      isPlatformAdmin: false,
      createdAt: new Date(),
    } satisfies UserDoc);

    await batch.commit();

    return {
      userId,
      companyId,
      companyName: input.companyName,
      licenseType: input.licenseType,
      name: input.name,
      email: input.email,
      role: 'admin',
      permissions: permissionsForRole('admin'),
      isPlatformAdmin: false,
    };
  }

  async findUserByEmail(email: string): Promise<UserWithCompanyRecord | null> {
    const snap = await this.db.collection(USERS).where('emailLower', '==', email.toLowerCase()).limit(1).get();
    if (snap.empty) return null;

    const userDoc = snap.docs[0];
    const u = userDoc.data() as UserDoc;
    const companyDoc = await this.db.collection(COMPANIES).doc(u.companyId).get();
    if (!companyDoc.exists) return null;

    const c = companyDoc.data() as CompanyDoc;
    return {
      id: userDoc.id,
      name: u.name,
      email: u.email,
      passwordHash: u.passwordHash,
      role: u.role,
      companyId: u.companyId,
      isPlatformAdmin: u.isPlatformAdmin ?? false,
      companyName: c.name,
      licenseType: c.licenseType,
    };
  }

  async findAuthenticatedUser(userId: string, companyId: string): Promise<AuthenticatedUserProfile | null> {
    this.assertCompanyScope(companyId);
    const [userDoc, companyDoc] = await Promise.all([
      this.db.collection(USERS).doc(userId).get(),
      this.db.collection(COMPANIES).doc(companyId).get(),
    ]);

    if (!userDoc.exists || !companyDoc.exists) return null;

    const u = userDoc.data() as UserDoc;
    const c = companyDoc.data() as CompanyDoc;
    if (u.companyId !== companyId) return null;

    return {
      userId,
      companyId,
      companyName: c.name,
      licenseType: c.licenseType,
      name: u.name,
      email: u.email,
      role: u.role,
      permissions: permissionsForRole(u.role),
      isPlatformAdmin: u.isPlatformAdmin ?? false,
    };
  }

  async listUsersByCompany(companyId: string): Promise<UserRecord[]> {
    this.assertCompanyScope(companyId);
    const snap = await this.db.collection(USERS).where('companyId', '==', companyId).get();
    return snap.docs
      .map((doc) => {
        const u = doc.data() as UserDoc;
        return { id: doc.id, name: u.name, email: u.email, role: u.role, companyId: u.companyId };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async listCoursesByCompany(companyId: string): Promise<CourseRecord[]> {
    this.assertCompanyScope(companyId);
    const [coursesSnap, enrollSnap] = await Promise.all([
      this.db.collection(COURSES).where('companyId', '==', companyId).get(),
      this.db.collection(ENROLLMENTS).where('companyId', '==', companyId).get(),
    ]);

    const stats = new Map<string, { count: number; total: number }>();
    for (const doc of enrollSnap.docs) {
      const e = doc.data() as EnrollmentDoc;
      const s = stats.get(e.courseId) ?? { count: 0, total: 0 };
      s.count++;
      s.total += e.progress;
      stats.set(e.courseId, s);
    }

    return coursesSnap.docs
      .map((doc) => {
        const d = doc.data() as CourseDoc;
        const s = stats.get(doc.id);
        return {
          id: doc.id,
          title: d.title,
          companyId: d.companyId,
          enrollmentCount: s?.count ?? 0,
          averageProgress: s ? Math.round((s.total / s.count) * 100) / 100 : 0,
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  async createCourse(companyId: string, title: string): Promise<CourseRecord> {
    this.assertCompanyScope(companyId);
    const existing = await this.db.collection(COURSES)
      .where('companyId', '==', companyId)
      .where('title', '==', title)
      .limit(1)
      .get();
    if (!existing.empty) {
      throw new AppError('A course with this title already exists for your company.', 409);
    }

    const courseId = crypto.randomUUID();
    await this.db.collection(COURSES).doc(courseId).set({ title, companyId, createdAt: new Date() } satisfies CourseDoc);
    return { id: courseId, title, companyId, enrollmentCount: 0, averageProgress: 0 };
  }

  async listEnrollmentsByCompany(companyId: string): Promise<EnrollmentRecord[]> {
    this.assertCompanyScope(companyId);
    const [enrollSnap, usersSnap, coursesSnap] = await Promise.all([
      this.db.collection(ENROLLMENTS).where('companyId', '==', companyId).get(),
      this.db.collection(USERS).where('companyId', '==', companyId).get(),
      this.db.collection(COURSES).where('companyId', '==', companyId).get(),
    ]);

    const usersMap = new Map(usersSnap.docs.map((d) => [d.id, d.data() as UserDoc]));
    const coursesMap = new Map(coursesSnap.docs.map((d) => [d.id, d.data() as CourseDoc]));

    return enrollSnap.docs
      .map((doc) => {
        const e = doc.data() as EnrollmentDoc;
        const u = usersMap.get(e.userId);
        const c = coursesMap.get(e.courseId);
        return {
          id: doc.id,
          userId: e.userId,
          courseId: e.courseId,
          progress: e.progress,
          companyId: e.companyId,
          learnerName: u?.name ?? '',
          learnerEmail: u?.email ?? '',
          courseTitle: c?.title ?? '',
        };
      })
      .sort((a, b) => a.learnerName.localeCompare(b.learnerName) || a.courseTitle.localeCompare(b.courseTitle));
  }

  async listCoursesByUserEnrollment(userId: string, companyId: string): Promise<CourseRecord[]> {
    this.assertCompanyScope(companyId);
    const enrollSnap = await this.db.collection(ENROLLMENTS).where('userId', '==', userId).get();
    const userEnrollments = enrollSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as EnrollmentDoc) }))
      .filter((e) => e.companyId === companyId);

    if (userEnrollments.length === 0) return [];

    const courseIds = [...new Set(userEnrollments.map((e) => e.courseId))];
    const courseDocs = await Promise.all(courseIds.map((id) => this.db.collection(COURSES).doc(id).get()));
    const progressMap = new Map(userEnrollments.map((e) => [e.courseId, e.progress]));

    return courseDocs
      .filter((d) => d.exists && (d.data() as CourseDoc).companyId === companyId)
      .map((d) => {
        const c = d.data() as CourseDoc;
        return { id: d.id, title: c.title, companyId: c.companyId, enrollmentCount: 1, averageProgress: progressMap.get(d.id) ?? 0 };
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  async updateEnrollmentProgress(userId: string, courseId: string, companyId: string, progress: number): Promise<EnrollmentRecord | null> {
    this.assertCompanyScope(companyId);
    const snap = await this.db.collection(ENROLLMENTS).where('userId', '==', userId).get();
    const match = snap.docs.find((d) => {
      const e = d.data() as EnrollmentDoc;
      return e.courseId === courseId && e.companyId === companyId;
    });
    if (!match) return null;
    await match.ref.update({ progress });
    return { id: match.id, userId, courseId, progress, companyId, learnerName: '', learnerEmail: '', courseTitle: '' };
  }

  async listEnrollmentsForUser(userId: string, companyId: string): Promise<EnrollmentRecord[]> {
    this.assertCompanyScope(companyId);
    const enrollSnap = await this.db.collection(ENROLLMENTS).where('userId', '==', userId).get();
    const userEnrollments = enrollSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as EnrollmentDoc) }))
      .filter((e) => e.companyId === companyId);

    if (userEnrollments.length === 0) return [];

    const courseIds = [...new Set(userEnrollments.map((e) => e.courseId))];
    const courseDocs = await Promise.all(courseIds.map((id) => this.db.collection(COURSES).doc(id).get()));
    const coursesMap = new Map(courseDocs.filter((d) => d.exists).map((d) => [d.id, (d.data() as CourseDoc).title]));

    return userEnrollments
      .map((e) => ({ id: e.id, userId: e.userId, courseId: e.courseId, progress: e.progress, companyId: e.companyId, learnerName: '', learnerEmail: '', courseTitle: coursesMap.get(e.courseId) ?? '' }))
      .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));
  }

  // ─── Billing ───────────────────────────────────────────────────────────────

  async getSubscription(companyId: string): Promise<SubscriptionRecord | null> {
    const doc = await this.db.collection(COMPANIES).doc(companyId).get();
    if (!doc.exists) return null;
    const sub = (doc.data() as CompanyDoc).subscription;
    if (!sub) return null;
    return { id: companyId, companyId, status: sub.status as SubscriptionRecord['status'], activatedAt: sub.activatedAt, expiresAt: sub.expiresAt, notes: sub.notes };
  }

  async upsertSubscription(companyId: string, input: UpsertSubscriptionInput): Promise<SubscriptionRecord> {
    await this.db.collection(COMPANIES).doc(companyId).update({
      subscription: { status: input.status, activatedAt: input.activatedAt ?? null, expiresAt: input.expiresAt ?? null, notes: input.notes ?? null, updatedAt: new Date() },
    });
    return { id: companyId, companyId, status: input.status as SubscriptionRecord['status'], activatedAt: input.activatedAt ?? null, expiresAt: input.expiresAt ?? null, notes: input.notes ?? null };
  }

  async countUsersForCompany(companyId: string): Promise<number> {
    const snap = await this.db.collection(USERS).where('companyId', '==', companyId).count().get();
    return snap.data().count;
  }

  async countCoursesForCompany(companyId: string): Promise<number> {
    const snap = await this.db.collection(COURSES).where('companyId', '==', companyId).count().get();
    return snap.data().count;
  }

  async listAllCompaniesWithSubscription(): Promise<CompanyWithSubscriptionRow[]> {
    const companiesSnap = await this.db.collection(COMPANIES).get();
    const results = await Promise.all(
      companiesSnap.docs.map(async (doc) => {
        const company = doc.data() as CompanyDoc;
        const companyId = doc.id;
        const [userCountSnap, courseCountSnap] = await Promise.all([
          this.db.collection(USERS).where('companyId', '==', companyId).count().get(),
          this.db.collection(COURSES).where('companyId', '==', companyId).count().get(),
        ]);
        const sub = company.subscription;
        return {
          id: companyId,
          name: company.name,
          licenseType: company.licenseType,
          subscriptionId: sub ? companyId : null,
          status: sub?.status ?? null,
          activatedAt: sub?.activatedAt ?? null,
          expiresAt: sub?.expiresAt ?? null,
          notes: sub?.notes ?? null,
          userCount: userCountSnap.data().count,
          courseCount: courseCountSnap.data().count,
        } satisfies CompanyWithSubscriptionRow;
      }),
    );
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  private assertCompanyScope(companyId: string) {
    if (!companyId?.trim()) {
      throw new AppError('A valid company scope is required to query tenant data.', 500);
    }
  }
}
