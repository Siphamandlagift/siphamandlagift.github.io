import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, type DocumentSnapshot, type Firestore, type WriteBatch } from 'firebase-admin/firestore';
import { createDefaultData, createDefaultStudentTemplate } from './default-data.js';
import {
  createPasswordCredentials,
  generatePasswordResetToken,
  hashPasswordResetToken,
  isDefaultDemoCredentialLogin,
  isStrongPassword,
  shouldBlockDefaultDemoCredentialLogin,
  verifyPassword,
} from './auth-utils.js';
import {
  AuthAccountRecord,
  AssignmentSubmissionRecord,
  BrandingSettingsUpdateInput,
  ChangePasswordInput,
  EnrollmentStudentRecord,
  ExternalTrainingRequestCreateInput,
  ExternalTrainingRequestDocumentsInput,
  ExternalTrainingRequestReviewInput,
  ExternalTrainingRequestUpdateInput,
  LoginRequestInput,
  LoginRole,
  LmsDataStore,
  ManagerStatePatch,
  ManagedUserCredentialInput,
  ManagedUserCredentialsUpsertResponse,
  PasswordResetTokenStatus,
  QuizSubmissionRecord,
  StudentIdpEntryRecord,
  StudentKpiEntryRecord,
  StudentKpiScoreRecord,
  StudentKpiYearRecord,
  StudentNotificationRecord,
  StudentSnapshotUpdate,
  StudentRecord,
  SystemTrainingManagerRecord,
  TrainingOffering,
  TrainingOfferingUpdate,
} from './contracts.js';

const configuredDataDirectory = process.env['LMS_DATA_DIRECTORY']?.trim();
const dataDirectory = configuredDataDirectory
  ? path.resolve(configuredDataDirectory)
  : path.resolve(process.cwd(), 'server', 'data');
const dataFilePath = path.join(dataDirectory, 'lms-data.json');
const backupDataFilePath = path.join(dataDirectory, 'lms-data.backup.json');
const tempDataFilePath = path.join(dataDirectory, 'lms-data.json.tmp');
const defaultCourseImage = 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=400&q=80';
const passwordResetLifetimeMs = 60 * 60 * 1000;
const defaultStudentTemplate = createDefaultStudentTemplate();
const firestoreCollectionNames = [
  'offerings',
  'students',
  'trainingManagers',
  'managerMessages',
  'mentorshipAssignments',
  'assignmentSubmissions',
  'mentorshipSubmissions',
  'quizSubmissions',
  'externalTrainingRequests',
  'authAccounts',
  'passwordResetTokens',
] as const satisfies readonly FirestoreCollectionName[];

type FirestoreCollectionName = Exclude<keyof LmsDataStore, 'branding' | 'updatedAt' | 'currentKpiYear' | 'kpiYearsOpened'>;
type FirestoreCollectionRecord<Name extends FirestoreCollectionName> = LmsDataStore[Name] extends Array<infer Item>
  ? Item & { id: string }
  : never;
type FirestoreBatchOperation = (batch: WriteBatch) => void;

function syncPublishedOfferingsToStudents(data: LmsDataStore): LmsDataStore {
  const publishedOfferings = data.offerings.filter((offering) => offering.status === 'Published');
  const publishedOfferingIds = new Set(publishedOfferings.map((offering) => offering.id));
  const publishedOfferingTitles = new Set(publishedOfferings.map((offering) => offering.title));
  const validAssessmentOfferingKeys = new Set(publishedOfferings.flatMap((offering) => [offering.id, offering.title]));

  const students = data.students.map((student) => {
    const assignedOfferingIdSet = new Set(student.assignedOfferingIds);

    // Only retain course cards for offerings the student is explicitly assigned to.
    const retainedCourses = student.courses.filter((course) => {
      if (course.offeringId) {
        return publishedOfferingIds.has(course.offeringId) && assignedOfferingIdSet.has(course.offeringId);
      }
      const matchedOffering = publishedOfferings.find((o) => o.title === course.name);
      return matchedOffering ? assignedOfferingIdSet.has(matchedOffering.id) : false;
    });
    const courseByOfferingId = new Map(retainedCourses.filter((course) => course.offeringId).map((course) => [course.offeringId!, course]));
    const courseByName = new Map(retainedCourses.map((course) => [course.name, course]));

    const nextCourses = retainedCourses.map((course) => {
      const matchedOffering = course.offeringId
        ? publishedOfferings.find((offering) => offering.id === course.offeringId)
        : publishedOfferings.find((offering) => offering.title === course.name);

      if (!matchedOffering) {
        return course;
      }

      return {
        ...course,
        offeringId: matchedOffering.id,
        name: matchedOffering.title,
        image: matchedOffering.thumbnailDataUrl || course.image || defaultCourseImage,
        description: matchedOffering.description || course.description,
      };
    });

    for (const offering of publishedOfferings) {
      if (courseByOfferingId.has(offering.id) || courseByName.has(offering.title)) {
        continue;
      }

      // Only push a course card when the student is explicitly assigned to this offering.
      if (!assignedOfferingIdSet.has(offering.id)) {
        continue;
      }

      nextCourses.unshift({
        offeringId: offering.id,
        name: offering.title,
        progress: 0,
        image: offering.thumbnailDataUrl || defaultCourseImage,
        completed: false,
        description: offering.description,
      });
    }

    // Only retain notified-offering tracking and notifications for assigned published offerings.
    const notifiedOfferingIds = student.notifiedOfferingIds.filter(
      (offeringId) => publishedOfferingIds.has(offeringId) && assignedOfferingIdSet.has(offeringId),
    );
    const notifications = student.notifications.filter((notification) => {
      if (!notification.id.startsWith('course-')) return true;
      const offeringId = notification.id.slice('course-'.length);
      return publishedOfferingIds.has(offeringId) && assignedOfferingIdSet.has(offeringId);
    });
    const assessmentAttempts = Object.fromEntries(
      Object.entries(student.assessmentAttempts ?? {}).filter(([assessmentKey]) => {
        const [offeringKey] = assessmentKey.split('::');
        return validAssessmentOfferingKeys.has(offeringKey);
      }),
    );

    for (const offering of publishedOfferings) {
      if (notifiedOfferingIds.includes(offering.id)) {
        continue;
      }

      // Only notify the student if they are explicitly assigned to this offering.
      if (!assignedOfferingIdSet.has(offering.id)) {
        continue;
      }

      notifiedOfferingIds.push(offering.id);
      notifications.unshift(createOfferingNotification(offering));
    }

    return {
      ...student,
      courses: nextCourses,
      notifications,
      notifiedOfferingIds,
      assessmentAttempts,
    } satisfies StudentRecord;
  });

  return {
    ...data,
    students,
  };
}

function createOfferingNotification(offering: TrainingOffering): StudentNotificationRecord {
  return {
    id: `course-${offering.id}`,
    badge: 'Course',
    title: 'New course available',
    body: `${offering.title} has been loaded to your learner profile and is ready to open.`,
    dateLabel: 'Just now',
    unread: true,
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeEnrollmentRole(role: EnrollmentStudentRecord['role'] | LoginRole): EnrollmentStudentRecord['role'] {
  switch (role) {
    case 'training-manager':
      return 'manager';
    // A directory record's base role is always student or manager now — 'administrator' access is
    // granted separately via the isAdmin flag, never as a base role. Legacy 'administrator' values
    // (from data written before that split) fall back to 'student', matching the normalizeData migration.
    case 'administrator':
      return 'student';
    default:
      return role;
  }
}

function normalizeLoginRole(role: EnrollmentStudentRecord['role'] | LoginRole): LoginRole {
  switch (role) {
    case 'manager':
      return 'training-manager';
    default:
      return role;
  }
}

function routeForLoginRole(role: LoginRole) {
  switch (role) {
    case 'administrator':
      return '/admin-profile';
    case 'training-manager':
      return '/training-manager-profile';
    default:
      return '/student-profile';
  }
}

function resolveStudentIdForAccount(data: LmsDataStore, account: Pick<AuthAccountRecord, 'role' | 'email' | 'linkedStudentId'>) {
  if (account.role !== 'student') {
    return undefined;
  }

  if (account.linkedStudentId) {
    return account.linkedStudentId;
  }

  return data.students.find((entry) => entry.email.toLowerCase() === account.email.toLowerCase())?.id;
}

type ResolvedRoleEntry = {
  role: LoginRole;
  route: string;
  username: string;
  email: string;
  studentId?: string;
  name?: string;
  surname?: string;
};

/** The real "First Last" name behind an account (from its linked directory entry), used to avoid
 *  a username/email-derived placeholder flashing before the real name loads on the client. */
function resolveAccountDisplayNameSync(
  data: LmsDataStore,
  account: Pick<AuthAccountRecord, 'role' | 'email' | 'linkedStudentId'>,
): { name: string; surname: string } | null {
  const studentId = resolveStudentIdForAccount(data, account) ?? account.linkedStudentId;
  if (!studentId) {
    return null;
  }

  const student = data.students.find((entry) => entry.id === studentId);
  return student ? { name: student.name, surname: student.surname } : null;
}

/** The directory record backing this account, regardless of its base role — used to check the
 *  isAdmin flag, which grants full administrator access independently of the student/manager role. */
function resolveLinkedStudentRecord(
  data: LmsDataStore,
  account: Pick<AuthAccountRecord, 'role' | 'email' | 'linkedStudentId'>,
): EnrollmentStudentRecord | null {
  const studentId = resolveStudentIdForAccount(data, account) ?? account.linkedStudentId;
  if (!studentId) {
    return null;
  }

  return data.students.find((entry) => entry.id === studentId) ?? null;
}

function mergeResolvedRole(results: ResolvedRoleEntry[], candidate: ResolvedRoleEntry) {
  const existingIndex = results.findIndex((entry) => entry.role === candidate.role);
  if (existingIndex === -1) {
    results.push(candidate);
    return;
  }

  const existing = results[existingIndex];
  const existingHasStudentId = typeof existing.studentId === 'string' && existing.studentId.trim().length > 0;
  const candidateHasStudentId = typeof candidate.studentId === 'string' && candidate.studentId.trim().length > 0;

  if (!existingHasStudentId && candidateHasStudentId) {
    results[existingIndex] = candidate;
  }
}

function syncLinkedAuthAccounts(data: LmsDataStore) {
  const studentsById = new Map(data.students.map((student) => [student.id, student]));

  data.authAccounts = data.authAccounts.reduce<AuthAccountRecord[]>((accounts, account) => {
    const linkedStudentId = account.linkedStudentId
      ?? (account.role === 'student'
        ? data.students.find((student) => student.email.toLowerCase() === account.email.toLowerCase())?.id ?? null
        : null);

    if (!linkedStudentId) {
      accounts.push(account);
      return accounts;
    }

    const linkedStudent = studentsById.get(linkedStudentId);
    if (!linkedStudent) {
      return accounts;
    }

    const role = normalizeLoginRole(linkedStudent.role);
    accounts.push({
      ...account,
      linkedStudentId,
      role,
      route: routeForLoginRole(role),
      email: linkedStudent.email,
    });

    return accounts;
  }, []);
}

function buildStudentFullName(student: Pick<EnrollmentStudentRecord, 'name' | 'surname'>) {
  return [student.name.trim(), student.surname.trim()].filter(Boolean).join(' ');
}

/** The full set of people students can submit an external training request to: the raw
 *  trainingManagers directory plus anyone granted Training Manager access via User Management
 *  (role 'manager', active) — mirrors the client's buildTrainingManagers() merge so a manager
 *  who only exists as a student record with role 'manager' can still be a valid approving manager. */
function resolveApprovingManagers(data: LmsDataStore): SystemTrainingManagerRecord[] {
  const managers = [...data.trainingManagers];
  const seenEmails = new Set(managers.map((manager) => manager.email.trim().toLowerCase()));

  for (const student of data.students) {
    if (student.role !== 'manager' || student.activeStatus !== 'Active') {
      continue;
    }

    const normalizedEmail = student.email.trim().toLowerCase();
    if (!normalizedEmail || seenEmails.has(normalizedEmail)) {
      continue;
    }

    seenEmails.add(normalizedEmail);
    managers.push({
      id: `uploaded-manager-${student.id}`,
      name: buildStudentFullName(student),
      role: student.jobTitle.trim() || 'Training Manager',
      team: student.department.trim() || 'Learning Operations',
      email: student.email.trim(),
    });
  }

  return managers;
}

/** Best-effort "First Last" display name for an account that has no directory entry yet —
 *  derived from its username/email rather than a hardcoded placeholder. */
function deriveDisplayNameFromIdentity(username: string, email: string): { name: string; surname: string } {
  const titleCase = (segment: string) => segment.length ? segment[0].toUpperCase() + segment.slice(1).toLowerCase() : segment;
  const source = username.trim() || email.split('@')[0] || 'User';
  const words = source.split(/[\s._-]+/).filter(Boolean).map(titleCase);

  if (words.length === 0) {
    return { name: 'User', surname: '' };
  }

  if (words.length === 1) {
    return { name: words[0], surname: 'Profile' };
  }

  return { name: words[0], surname: words.slice(1).join(' ') };
}

function normalizeStudentIdpEntries(entries: unknown): StudentIdpEntryRecord[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.map((entry) => {
    const candidate = entry as Partial<StudentIdpEntryRecord>;
    const rawStatus = candidate.status;
    const status = rawStatus === 'Not Started' || rawStatus === 'In Progress' || rawStatus === 'Completed' || rawStatus === 'On Hold'
      ? rawStatus
      : 'Not Started';

    return {
      developmentNeed: typeof candidate.developmentNeed === 'string' ? candidate.developmentNeed : '',
      plannedAction: typeof candidate.plannedAction === 'string' ? candidate.plannedAction : '',
      supportRequired: typeof candidate.supportRequired === 'string' ? candidate.supportRequired : '',
      dateCaptured: typeof candidate.dateCaptured === 'string' ? candidate.dateCaptured : '',
      targetDate: typeof candidate.targetDate === 'string' ? candidate.targetDate : '',
      status,
    };
  });
}

function normalizeStudentKpiScore(value: unknown): StudentKpiScoreRecord | null {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : null;
}

function normalizeStudentKpiEntries(entries: unknown): StudentKpiEntryRecord[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.map((entry, index) => {
    const candidate = entry as Partial<StudentKpiEntryRecord> & { agreedOutput?: unknown };
    const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim() : `kpi-${Date.now()}-${index}`;
    const weight = typeof candidate.weight === 'number' && Number.isFinite(candidate.weight) ? candidate.weight : 0;
    // Rows saved before the Target/Actual column revision have `agreedOutput` but no `target` yet
    // — migrate it forward on read rather than losing what was already recorded there.
    const target = typeof candidate.target === 'string'
      ? candidate.target
      : typeof candidate.agreedOutput === 'string'
        ? candidate.agreedOutput
        : '';

    return {
      id,
      keyResultArea: typeof candidate.keyResultArea === 'string' ? candidate.keyResultArea : '',
      kpi: typeof candidate.kpi === 'string' ? candidate.kpi : '',
      weight,
      target,
      actual: typeof candidate.actual === 'string' ? candidate.actual : '',
      comments: typeof candidate.comments === 'string' ? candidate.comments : '',
      overallScoring: normalizeStudentKpiScore(candidate.overallScoring),
      managerScoring: normalizeStudentKpiScore(candidate.managerScoring),
      employeeScoring: normalizeStudentKpiScore(candidate.employeeScoring),
      measure: typeof candidate.measure === 'string' ? candidate.measure : '',
      dateOfReview: typeof candidate.dateOfReview === 'string' ? candidate.dateOfReview : '',
      gapInitiative: typeof candidate.gapInitiative === 'string' ? candidate.gapInitiative : '',
      gapComments: typeof candidate.gapComments === 'string' ? candidate.gapComments : '',
      gapTargetDate: typeof candidate.gapTargetDate === 'string' ? candidate.gapTargetDate : '',
    };
  });
}

// employeeScoring, managerScoring, and the three Performance Gap Analysis fields are each frozen
// off from the manager's full-table save form. employeeScoring and the gap fields have their own
// dedicated, more narrowly-scoped endpoints (updateKpiEmployeeScoring, updateKpiGapAnalysis);
// managerScoring has no live editable path left at all since Manager/Employee/Overall Scoring
// collapsed into the single Final Rating column (overallScoring) — but its historical value is
// still preserved rather than deleted. Without this, a manager's Save on
// setKpiEntriesForStudent — built from whatever their edit form last loaded, which doesn't carry
// a live edit to any of these fields — would silently overwrite a student's self-score or a
// manager's own gap-analysis notes the instant anything else on that row gets saved, even minutes
// or hours later: the manager's client has no way to know a newer value exists once their form is
// open. Forcing every incoming row's protected fields back to whatever the CURRENT stored values
// actually are (matched by row id; a genuinely new row simply has no existing value to preserve)
// makes those fields structurally impossible for this endpoint to touch, no matter how stale the
// caller's payload is — this is what actually keeps a saved rating (or gap plan) from ever
// "disappearing again".
function preserveEmployeeScoringOnFullReplace(
  existingEntries: StudentKpiEntryRecord[],
  incomingEntries: StudentKpiEntryRecord[],
): StudentKpiEntryRecord[] {
  const existingById = new Map(existingEntries.map((entry) => [entry.id, entry]));

  return incomingEntries.map((entry) => {
    const existing = existingById.get(entry.id);
    return {
      ...entry,
      managerScoring: existing ? existing.managerScoring : entry.managerScoring,
      employeeScoring: existing ? existing.employeeScoring : entry.employeeScoring,
      gapInitiative: existing ? existing.gapInitiative : entry.gapInitiative,
      gapComments: existing ? existing.gapComments : entry.gapComments,
      gapTargetDate: existing ? existing.gapTargetDate : entry.gapTargetDate,
    };
  });
}

// Migrates the legacy flat kpiEntries array (no year concept — every student had exactly one KPI
// table) into the current year's bucket the first time a record is normalized after the year
// feature shipped. Once a record has kpiYears, that's authoritative and kpiEntries is ignored.
function normalizeStudentKpiYears(
  student: { kpiYears?: unknown; kpiEntries?: unknown },
  currentKpiYear: number,
): StudentKpiYearRecord[] {
  if (Array.isArray(student.kpiYears)) {
    return student.kpiYears.map((candidate) => {
      const yearRecord = candidate as Partial<StudentKpiYearRecord>;
      const year = typeof yearRecord.year === 'number' && Number.isFinite(yearRecord.year) ? yearRecord.year : currentKpiYear;
      return { year, entries: normalizeStudentKpiEntries(yearRecord.entries) };
    });
  }

  if (Array.isArray(student.kpiEntries) && student.kpiEntries.length > 0) {
    return [{ year: currentKpiYear, entries: normalizeStudentKpiEntries(student.kpiEntries) }];
  }

  return [];
}

function findKpiYearEntries(kpiYears: StudentKpiYearRecord[], year: number): StudentKpiEntryRecord[] {
  return kpiYears.find((yearRecord) => yearRecord.year === year)?.entries ?? [];
}

function withKpiYearEntries(
  kpiYears: StudentKpiYearRecord[],
  year: number,
  entries: StudentKpiEntryRecord[],
): StudentKpiYearRecord[] {
  const next = kpiYears.filter((yearRecord) => yearRecord.year !== year);
  next.push({ year, entries });
  return next.sort((left, right) => left.year - right.year);
}

function createStudentRecordFromEnrollment(student: EnrollmentStudentRecord): StudentRecord {
  return {
    ...student,
    role: normalizeEnrollmentRole(student.role),
    profile: {
      ...cloneJson(defaultStudentTemplate.profile),
      name: buildStudentFullName(student),
      email: student.email,
    },
    badgeState: cloneJson(defaultStudentTemplate.badgeState),
    settings: cloneJson(defaultStudentTemplate.settings),
    mentorshipProfile: {
      ...cloneJson(defaultStudentTemplate.mentorshipProfile),
      menteeName: student.name,
      menteeSurname: student.surname,
    },
    mentorshipObjectives: cloneJson(defaultStudentTemplate.mentorshipObjectives),
    mentorshipProgressReport: cloneJson(defaultStudentTemplate.mentorshipProgressReport),
    courses: [],
    notifications: [],
    messages: [],
    notifiedOfferingIds: [],
    assessmentAttempts: {},
    idpEntries: [],
    kpiYears: [],
  };
}

function mergeEnrollmentStudentRecord(existing: StudentRecord | undefined, student: EnrollmentStudentRecord): StudentRecord {
  if (!existing) {
    return createStudentRecordFromEnrollment(student);
  }

  return {
    ...existing,
    ...student,
    role: normalizeEnrollmentRole(student.role),
    profile: {
      ...existing.profile,
      name: buildStudentFullName(student),
      email: student.email,
    },
    // Keep the mentee's own mentorship-profile name as-is: it starts out seeded from the
    // enrollment name (see createStudentRecordFromEnrollment) but the student can edit it
    // independently afterwards, and a roster sync shouldn't silently discard that edit.
    mentorshipProfile: existing.mentorshipProfile,
  };
}

function normalizeData(data: LmsDataStore): LmsDataStore {
  const defaults = createDefaultData();
  const offerings = data.offerings ?? defaults.offerings;
  const currentKpiYear = typeof data.currentKpiYear === 'number' && Number.isFinite(data.currentKpiYear)
    ? data.currentKpiYear
    : defaults.currentKpiYear;
  const kpiYearsOpened = Array.isArray(data.kpiYearsOpened) && data.kpiYearsOpened.length > 0
    ? Array.from(new Set(data.kpiYearsOpened.filter((year) => typeof year === 'number' && Number.isFinite(year)))).sort((left, right) => left - right)
    : [currentKpiYear];
  const students = data.students.map((student) => {
    const rawRole = (student.role ?? defaultStudentTemplate.role ?? 'student') as EnrollmentStudentRecord['role'] | LoginRole | 'admin';
    // Legacy migration: 'admin'/'administrator' used to be a base role. It's now the isAdmin flag
    // layered on top of a student/manager base role — normalize any old data to that shape.
    const isLegacyAdminRole = rawRole === 'admin' || rawRole === 'administrator';
    const role = isLegacyAdminRole ? 'student' as const : normalizeEnrollmentRole(rawRole);
    const isAdmin = isLegacyAdminRole || student.isAdmin === true;
    const settings = {
      ...defaultStudentTemplate.settings,
      ...(student.settings ?? {}),
    };
    const courses = student.courses ?? defaultStudentTemplate.courses ?? [];
    const assignedOfferingIds = student.assignedOfferingIds ?? defaultStudentTemplate.assignedOfferingIds ?? [];
    const notifiedOfferingIds = student.notifiedOfferingIds ?? defaultStudentTemplate.notifiedOfferingIds ?? [];
    const notifications = student.notifications ?? defaultStudentTemplate.notifications ?? [];
    const messages = student.messages ?? defaultStudentTemplate.messages ?? [];
    const idpEntries = normalizeStudentIdpEntries(student.idpEntries ?? defaultStudentTemplate.idpEntries ?? []);
    const kpiYears = normalizeStudentKpiYears(student, currentKpiYear);

    // Drops the legacy flat kpiEntries field once and for all now that it's been folded into
    // kpiYears above — otherwise it lingers forever in storage (and every future write) as dead
    // weight nothing reads anymore.
    const { kpiEntries: _legacyKpiEntries, ...studentWithoutLegacyKpiEntries } = student as StudentRecord & { kpiEntries?: unknown };

    return {
      ...defaultStudentTemplate,
      ...studentWithoutLegacyKpiEntries,
      role,
      isAdmin,
      settings,
      assignedOfferingIds,
      assessmentAttempts: student.assessmentAttempts ?? defaultStudentTemplate.assessmentAttempts ?? {},
      courses,
      notifications,
      messages,
      idpEntries,
      kpiYears,
      notifiedOfferingIds,
    } satisfies StudentRecord;
  });

  const normalized = syncPublishedOfferingsToStudents({
    ...data,
    offerings,
    students,
    branding: data.branding ?? defaults.branding,
    trainingManagers: data.trainingManagers ?? defaults.trainingManagers,
    managerMessages: data.managerMessages ?? defaults.managerMessages,
    mentorshipAssignments: data.mentorshipAssignments ?? defaults.mentorshipAssignments,
    mentorshipSubmissions: data.mentorshipSubmissions ?? defaults.mentorshipSubmissions,
    assignmentSubmissions: data.assignmentSubmissions ?? defaults.assignmentSubmissions,
    quizSubmissions: data.quizSubmissions ?? defaults.quizSubmissions,
    externalTrainingRequests: data.externalTrainingRequests ?? defaults.externalTrainingRequests,
    authAccounts: data.authAccounts ?? defaults.authAccounts,
    passwordResetTokens: (data.passwordResetTokens ?? defaults.passwordResetTokens).filter((token) => !token.consumedAt || new Date(token.consumedAt).getTime() > 0),
    updatedAt: data.updatedAt || new Date().toISOString(),
    currentKpiYear,
    kpiYearsOpened,
  });

  syncLinkedAuthAccounts(normalized);
  return normalized;
}

export class LmsRepository {
  private writeQueue = Promise.resolve();

  private serializeData(data: LmsDataStore) {
    return JSON.stringify(data, null, 2);
  }

  private async writePrimaryStore(data: LmsDataStore, preserveCurrentAsBackup = true) {
    await writeFile(tempDataFilePath, this.serializeData(data), 'utf8');

    if (preserveCurrentAsBackup) {
      try {
        await copyFile(dataFilePath, backupDataFilePath);
      } catch {
        // Continue when there is no current store to preserve yet.
      }
    }

    try {
      await rename(tempDataFilePath, dataFilePath);
    } catch {
      await writeFile(dataFilePath, this.serializeData(data), 'utf8');
      try {
        await unlink(tempDataFilePath);
      } catch {
        // Ignore temp file cleanup failures after the primary write succeeds.
      }
    }
  }

  private async seedStore() {
    const seeded = normalizeData(createDefaultData());
    await this.writePrimaryStore(seeded, false);
    return seeded;
  }

  private async readStoreFile(filePath: string) {
    try {
      const raw = await readFile(filePath, 'utf8');
      return normalizeData(JSON.parse(raw) as LmsDataStore);
    } catch {
      return null;
    }
  }

  private async quarantineCorruptedStore() {
    const corruptedFilePath = path.join(dataDirectory, `lms-data.corrupt-${Date.now()}.json`);

    try {
      await copyFile(dataFilePath, corruptedFilePath);
      return;
    } catch {
      // Fall through and try to rename the corrupt file instead.
    }

    try {
      await rename(dataFilePath, corruptedFilePath);
    } catch {
      // Ignore quarantine failures and proceed with store recovery.
    }
  }

  private async ensureStore(): Promise<void> {
    await mkdir(dataDirectory, { recursive: true });

    try {
      await readFile(dataFilePath, 'utf8');
    } catch {
      await this.seedStore();
    }
  }

  async read(): Promise<LmsDataStore> {
    await this.ensureStore();
    const primaryStore = await this.readStoreFile(dataFilePath);
    if (primaryStore) {
      return primaryStore;
    }

    const backupStore = await this.readStoreFile(backupDataFilePath);
    if (backupStore) {
      await this.quarantineCorruptedStore();
      await this.writePrimaryStore(backupStore, false);
      return backupStore;
    }

    await this.quarantineCorruptedStore();
    return this.seedStore();
  }

  async write(data: LmsDataStore): Promise<LmsDataStore> {
    const nextData = normalizeData({
      ...data,
      updatedAt: new Date().toISOString(),
    });

    await this.ensureStore();
    // See the matching comment in FirestoreLmsRepository.write() — .catch(() => {}) here stops
    // one failed write from permanently jamming every write after it.
    this.writeQueue = this.writeQueue.catch(() => {}).then(async () => {
      await this.writePrimaryStore(nextData);
    });
    await this.writeQueue;
    return nextData;
  }

  // `caller` is the requesting session's identity (role/studentId/email off its JWT), passed in by
  // the /api/bootstrap route handler. A manager/administrator session gets the full, unscoped
  // response below — the manager/admin UI genuinely needs every student's IDP/KPI/messages/
  // submissions to do reviews and reporting. Anything else (a student session, or no resolvable
  // identity) gets the *scoped* response further down: every other student's HR/performance data
  // used to ride along in this exact same response and reach the browser of every logged-in user
  // regardless of role, because nothing here scoped it down — the manager/admin UI was the only
  // caller that actually needed the unscoped view, and student-facing frontend code only ever
  // looks up its own record out of what bootstrap returns anyway (see the call sites in
  // student-data.service.ts / student-profile.component.ts / student-courses.component.ts, which
  // all `.find()`/filter down to the caller's own id or email after receiving the response).
  async getBootstrap(caller?: { role: string; studentId: string | null; email: string } | null) {
    const data = await this.read();
    const idpEntriesByStudent = Object.fromEntries(
      data.students.map((student) => [student.id, student.idpEntries ?? []]),
    );
    // Only the current year's entries ride along in bootstrap — a past year is fetched on demand
    // (getKpiEntriesForStudentYear) once a year selector actually picks one, so bootstrap doesn't
    // grow with every student's full KPI history as more years get opened.
    const kpiEntriesByStudent = Object.fromEntries(
      data.students.map((student) => [student.id, findKpiYearEntries(student.kpiYears ?? [], data.currentKpiYear)]),
    );
    const students = data.students.map(({ courses, notifications, messages, notifiedOfferingIds, idpEntries, kpiYears, ...student }) => student);

    const isPrivileged = caller?.role === 'administrator' || caller?.role === 'training-manager';
    if (isPrivileged) {
      return {
        offerings: data.offerings,
        branding: data.branding,
        students,
        idpEntriesByStudent,
        kpiEntriesByStudent,
        currentKpiYear: data.currentKpiYear,
        kpiYearsOpened: data.kpiYearsOpened,
        trainingManagers: data.trainingManagers,
        managerMessages: data.managerMessages,
        mentorshipAssignments: data.mentorshipAssignments,
        assignmentSubmissions: data.assignmentSubmissions,
        mentorshipSubmissions: data.mentorshipSubmissions,
        quizSubmissions: data.quizSubmissions,
        externalTrainingRequests: data.externalTrainingRequests,
      };
    }

    // Same resolution order as isOwnStudentRecord in server.ts: prefer the session's studentId
    // claim, fall back to an email match against the roster (the claim can be absent on an older
    // token, or stale if the roster entry was recreated after the session was issued).
    const ownStudent = caller
      ? students.find((student) => student.id === caller.studentId)
        ?? students.find((student) => student.email.trim().toLowerCase() === caller.email.trim().toLowerCase())
      : undefined;
    const ownStudentId = ownStudent?.id ?? null;
    const ownEmail = (ownStudent?.email ?? caller?.email ?? '').trim().toLowerCase();

    return {
      offerings: data.offerings,
      branding: data.branding,
      students: ownStudent ? [ownStudent] : [],
      idpEntriesByStudent: ownStudentId ? { [ownStudentId]: idpEntriesByStudent[ownStudentId] ?? [] } : {},
      kpiEntriesByStudent: ownStudentId ? { [ownStudentId]: kpiEntriesByStudent[ownStudentId] ?? [] } : {},
      currentKpiYear: data.currentKpiYear,
      kpiYearsOpened: data.kpiYearsOpened,
      trainingManagers: data.trainingManagers,
      // The student-facing reply flow fetches its own thread through the dedicated, ownership-
      // scoped GET /api/manager-messages instead — nothing in the student UI reads this bootstrap
      // field, so it's left empty here rather than handing over every other student's inbox.
      managerMessages: [],
      mentorshipAssignments: data.mentorshipAssignments.filter((assignment) => assignment.menteeId === ownStudentId),
      assignmentSubmissions: data.assignmentSubmissions.filter((submission) => submission.studentId === ownStudentId),
      // Not read by any student-facing code today (only via managerData in the manager/admin UI) —
      // left empty rather than handing over every other student's submissions.
      mentorshipSubmissions: [],
      quizSubmissions: [],
      externalTrainingRequests: data.externalTrainingRequests.filter(
        (request) => request.studentId === ownStudentId || request.studentEmail.trim().toLowerCase() === ownEmail,
      ),
    };
  }

  // Lazily fetches one past (or current) year's KPI table for a single student — used when a
  // year selector picks something other than the current year, which bootstrap doesn't include.
  async getKpiEntriesForStudentYear(studentId: string, year: number) {
    const data = await this.read();
    const student = data.students.find((entry) => entry.id === studentId);
    if (!student) {
      return null;
    }

    return findKpiYearEntries(student.kpiYears ?? [], year);
  }

  // The manager-facing "open a new KPI year" action: every student's current-year KPI rows are
  // copied forward into a brand-new year bucket with every score cleared (Manager/Employee/
  // Overall scoring and Date of Review all reset — only the KPI text/weight/agreed output/measure
  // carry over, since those rarely change review to review but scores obviously should start
  // fresh). The year being closed stays exactly as it was — kpiYears only ever gains entries here,
  // never loses or edits an existing one, which is what makes every past year a permanent,
  // read-only record once it's no longer current. Rejects reopening/duplicating a year that's
  // already been opened, and requires the new year to move the review cycle forward, not sideways
  // or backward.
  async openKpiYear(year: number) {
    const data = await this.read();
    if (!Number.isInteger(year)) {
      throw new Error('Year must be a whole number.');
    }

    if (data.kpiYearsOpened.includes(year)) {
      throw new Error(`KPI year ${year} has already been opened.`);
    }

    if (year <= data.currentKpiYear) {
      throw new Error(`New KPI year must be after the current year (${data.currentKpiYear}).`);
    }

    data.students = data.students.map((student) => {
      const kpiYears = student.kpiYears ?? [];
      const currentYearEntries = findKpiYearEntries(kpiYears, data.currentKpiYear);
      const carriedForwardEntries: StudentKpiEntryRecord[] = currentYearEntries.map((entry) => ({
        id: `kpi-${year}-${entry.id}`,
        keyResultArea: entry.keyResultArea,
        kpi: entry.kpi,
        weight: entry.weight,
        target: entry.target,
        measure: entry.measure,
        comments: entry.comments,
        // Actual/scores/date all describe THIS review period's outcome, so they reset along with
        // the rating — only the KPI's own definition (KRA/KPI/weight/target/measure) carries over.
        actual: '',
        overallScoring: null,
        managerScoring: null,
        employeeScoring: null,
        dateOfReview: '',
        // A gap plan is written against a specific low score; once the score resets for the new
        // year, last year's plan belongs to last year's (closed, read-only) record, not this one.
        gapInitiative: '',
        gapComments: '',
        gapTargetDate: '',
      }));

      return {
        ...student,
        kpiYears: withKpiYearEntries(kpiYears, year, carriedForwardEntries),
      };
    });

    data.currentKpiYear = year;
    data.kpiYearsOpened = [...data.kpiYearsOpened, year].sort((left, right) => left - right);

    const next = await this.write(data);
    return { currentKpiYear: next.currentKpiYear, kpiYearsOpened: next.kpiYearsOpened };
  }

  async getStudentSnapshot(studentId: string) {
    const data = await this.read();
    const student = data.students.find((entry) => entry.id === studentId);
    return student
      ? {
          studentId,
          profile: {
            ...student.profile,
            idNumber: student.idNumber || student.profile.idNumber || '',
            department: student.department || (student.profile as any).department || (student.profile as any).programme || 'General',
            jobTitle: student.jobTitle || (student.profile as any).jobTitle || 'Not set',
          },
          badgeState: student.badgeState,
          certificatesAndLicences: student.certificatesAndLicences ?? [],
          settings: student.settings,
          mentorshipProfile: student.mentorshipProfile,
          mentorshipObjectives: student.mentorshipObjectives,
          mentorshipProgressReport: student.mentorshipProgressReport,
          courses: student.courses,
          notifications: student.notifications,
          messages: student.messages,
          notifiedOfferingIds: student.notifiedOfferingIds,
          assessmentAttempts: student.assessmentAttempts ?? {},
          idpEntries: student.idpEntries ?? [],
        }
      : null;
  }

  async updateStudentSnapshot(studentId: string, snapshot: StudentSnapshotUpdate) {
    const data = await this.read();
    const studentIndex = data.students.findIndex((entry) => entry.id === studentId);

    if (studentIndex === -1) {
      return null;
    }

    const profileNameParts = snapshot.profile.name.trim().split(/\s+/).filter(Boolean);
    const nextFirstName = profileNameParts[0] ?? data.students[studentIndex].name;
    const nextSurname = profileNameParts.slice(1).join(' ') || data.students[studentIndex].surname;

    // Derive learning status from actual course completion data so it stays accurate
    // as students progress through their assigned offerings.
    const assignedIds = new Set(data.students[studentIndex].assignedOfferingIds ?? []);
    let derivedStatus: 'Completed' | 'In Progress' | 'Not Yet Started' | undefined;
    if (assignedIds.size > 0) {
      const assignedCourseRecords = (snapshot.courses ?? []).filter(
        (c) => c.offeringId && assignedIds.has(c.offeringId),
      );
      if (assignedCourseRecords.length > 0) {
        if (assignedCourseRecords.every((c) => c.completed)) {
          derivedStatus = 'Completed';
        } else if (assignedCourseRecords.some((c) => c.completed || (c.progress ?? 0) > 0)) {
          derivedStatus = 'In Progress';
        } else {
          derivedStatus = 'Not Yet Started';
        }
      }
    }

    data.students[studentIndex] = {
      ...data.students[studentIndex],
      name: nextFirstName,
      surname: nextSurname,
      email: snapshot.profile.email,
      idNumber: snapshot.profile.idNumber,
      ...(derivedStatus !== undefined ? { status: derivedStatus } : {}),
      profile: snapshot.profile,
      badgeState: snapshot.badgeState,
      certificatesAndLicences: snapshot.certificatesAndLicences ?? data.students[studentIndex].certificatesAndLicences ?? [],
      settings: snapshot.settings,
      mentorshipProfile: snapshot.mentorshipProfile,
      mentorshipObjectives: snapshot.mentorshipObjectives,
      mentorshipProgressReport: snapshot.mentorshipProgressReport,
      courses: snapshot.courses,
      notifications: snapshot.notifications,
      messages: snapshot.messages,
      notifiedOfferingIds: snapshot.notifiedOfferingIds,
      assessmentAttempts: snapshot.assessmentAttempts,
      idpEntries: normalizeStudentIdpEntries(snapshot.idpEntries ?? data.students[studentIndex].idpEntries ?? []),
    };

    syncLinkedAuthAccounts(data);

    const next = await this.write(data);
    const student = next.students.find((entry) => entry.id === studentId);
    return student
      ? {
          studentId,
          profile: student.profile,
          badgeState: student.badgeState,
          certificatesAndLicences: student.certificatesAndLicences ?? [],
          settings: student.settings,
          mentorshipProfile: student.mentorshipProfile,
          mentorshipObjectives: student.mentorshipObjectives,
          mentorshipProgressReport: student.mentorshipProgressReport,
          courses: student.courses,
          notifications: student.notifications,
          messages: student.messages,
          notifiedOfferingIds: student.notifiedOfferingIds,
          assessmentAttempts: student.assessmentAttempts ?? {},
          idpEntries: student.idpEntries ?? [],
        }
      : null;
  }

  // Full replace of a student's KPI table for the CURRENT year — only a training manager or
  // administrator may call this (enforced in server.ts), since it can add/remove rows and edit
  // every field including Manager scoring. Every other year in kpiYears is a closed, read-only
  // record this never touches.
  async setKpiEntriesForStudent(studentId: string, entries: StudentKpiEntryRecord[]) {
    const data = await this.read();
    const studentIndex = data.students.findIndex((entry) => entry.id === studentId);

    if (studentIndex === -1) {
      return null;
    }

    const kpiYears = data.students[studentIndex].kpiYears ?? [];
    const existingEntries = findKpiYearEntries(kpiYears, data.currentKpiYear);
    const nextEntries = preserveEmployeeScoringOnFullReplace(existingEntries, normalizeStudentKpiEntries(entries));
    data.students[studentIndex] = {
      ...data.students[studentIndex],
      kpiYears: withKpiYearEntries(kpiYears, data.currentKpiYear, nextEntries),
    };

    const next = await this.write(data);
    return findKpiYearEntries(next.students.find((entry) => entry.id === studentId)?.kpiYears ?? [], next.currentKpiYear);
  }

  // Merges only the Employee scoring field into the CURRENT year's KPI rows, matched by id.
  // Unlike setKpiEntriesForStudent, this can't add, remove, or otherwise edit a row, or touch any
  // year but the current one — that's what lets server.ts safely allow a student to call this for
  // their own KPI table without also handing them the ability to rewrite their Manager scoring,
  // the KPI text itself, or a closed past year.
  async updateKpiEmployeeScoring(studentId: string, updates: { id: string; employeeScoring: StudentKpiScoreRecord | null }[]) {
    const data = await this.read();
    const studentIndex = data.students.findIndex((entry) => entry.id === studentId);

    if (studentIndex === -1) {
      return null;
    }

    const scoringById = new Map(updates.map((update) => [update.id, update.employeeScoring]));
    const kpiYears = data.students[studentIndex].kpiYears ?? [];
    const existingEntries = findKpiYearEntries(kpiYears, data.currentKpiYear);
    const nextEntries = existingEntries.map((entry) =>
      scoringById.has(entry.id) ? { ...entry, employeeScoring: scoringById.get(entry.id) ?? null } : entry,
    );

    data.students[studentIndex] = {
      ...data.students[studentIndex],
      kpiYears: withKpiYearEntries(kpiYears, data.currentKpiYear, nextEntries),
    };

    const next = await this.write(data);
    return findKpiYearEntries(next.students.find((entry) => entry.id === studentId)?.kpiYears ?? [], next.currentKpiYear);
  }

  // Merges only the three Performance Gap Analysis fields into the CURRENT year's KPI rows,
  // matched by id — same shape and same reasoning as updateKpiEmployeeScoring above, just
  // manager/admin-only instead of student-writable (see server.ts). Can't add, remove, or
  // otherwise edit a row, touch any scoring field, or reach a closed past year.
  async updateKpiGapAnalysis(
    studentId: string,
    updates: { id: string; gapInitiative: string; gapComments: string; gapTargetDate: string }[],
  ) {
    const data = await this.read();
    const studentIndex = data.students.findIndex((entry) => entry.id === studentId);

    if (studentIndex === -1) {
      return null;
    }

    const updatesById = new Map(updates.map((update) => [update.id, update]));
    const kpiYears = data.students[studentIndex].kpiYears ?? [];
    const existingEntries = findKpiYearEntries(kpiYears, data.currentKpiYear);
    const nextEntries = existingEntries.map((entry) => {
      const update = updatesById.get(entry.id);
      return update
        ? { ...entry, gapInitiative: update.gapInitiative, gapComments: update.gapComments, gapTargetDate: update.gapTargetDate }
        : entry;
    });

    data.students[studentIndex] = {
      ...data.students[studentIndex],
      kpiYears: withKpiYearEntries(kpiYears, data.currentKpiYear, nextEntries),
    };

    const next = await this.write(data);
    return findKpiYearEntries(next.students.find((entry) => entry.id === studentId)?.kpiYears ?? [], next.currentKpiYear);
  }

  async listOfferings() {
    const data = await this.read();
    return data.offerings;
  }

  async getBranding() {
    const data = await this.read();
    return data.branding;
  }

  async updateBranding(input: BrandingSettingsUpdateInput) {
    const data = await this.read();
    data.branding = {
      themeId: input.themeId,
      companyLogoDataUrl: input.companyLogoDataUrl,
    };

    const next = await this.write(data);
    return next.branding;
  }

  async createOffering(offering: TrainingOffering) {
    const data = await this.read();
    if (data.offerings.some((entry) => entry.id === offering.id)) {
      return null;
    }

    data.offerings.unshift(offering);
    const next = await this.write(data);
    return next.offerings.find((entry) => entry.id === offering.id) ?? null;
  }

  async updateOffering(update: TrainingOfferingUpdate) {
    const data = await this.read();
    let updated = false;

    data.offerings = data.offerings.map((offering) => {
      if (offering.id !== update.id) {
        return offering;
      }

      updated = true;
      return {
        ...offering,
        title: update.title,
        type: update.type,
        category: update.category,
        description: update.description,
        completionDeadline: update.completionDeadline,
        status: update.status,
        thumbnailDataUrl: update.thumbnailDataUrl,
        contentItems: update.contentItems ?? offering.contentItems,
      };
    });

    if (!updated) {
      return null;
    }

    const next = await this.write(data);
    return next.offerings.find((offering) => offering.id === update.id) ?? null;
  }

  async deleteOffering(offeringId: string) {
    const data = await this.read();
    const existingOffering = data.offerings.find((offering) => offering.id === offeringId);

    if (!existingOffering) {
      return false;
    }

    data.offerings = data.offerings.filter((offering) => offering.id !== offeringId);
    data.students = data.students.map((student) => {
      if (!student.assignedOfferingIds.includes(offeringId)) {
        return student;
      }

      const assignedOfferingIds = student.assignedOfferingIds.filter((assignedId) => assignedId !== offeringId);
      const resolvedDeadline = data.offerings
        .filter((offering) => assignedOfferingIds.includes(offering.id))
        .map((offering) => offering.completionDeadline)
        .filter(Boolean)
        .sort()
        .at(-1) ?? student.deadlineDate;

      return {
        ...student,
        assignedOfferingIds,
        deadlineDate: resolvedDeadline,
        activeStatus: assignedOfferingIds.length ? 'Active' : 'Inactive',
        status: assignedOfferingIds.length
          ? (student.status === 'Not Yet Started' ? 'In Progress' : student.status)
          : 'Not Yet Started',
      };
    });
    data.assignmentSubmissions = data.assignmentSubmissions.filter((submission) => submission.offeringId !== offeringId);
    data.mentorshipSubmissions = data.mentorshipSubmissions.filter((submission) => submission.offeringId !== offeringId);
    data.quizSubmissions = data.quizSubmissions.filter((submission) => submission.courseId !== offeringId);

    await this.write(data);
    return true;
  }

  async listAssignmentSubmissions() {
    const data = await this.read();
    return data.assignmentSubmissions;
  }

  async listQuizSubmissions() {
    const data = await this.read();
    return data.quizSubmissions;
  }

  async patchManagerState(patch: ManagerStatePatch) {
    const data = await this.read();

    if (patch.students) {
      const currentStudentsById = new Map(data.students.map((student) => [student.id, student]));
      data.students = patch.students.map((student) => mergeEnrollmentStudentRecord(currentStudentsById.get(student.id), student));
      syncLinkedAuthAccounts(data);
    }

    if (patch.trainingManagers) {
      data.trainingManagers = patch.trainingManagers;
    }

    if (patch.managerMessages) {
      // Merge by ID: preserve any messages added by students that the manager's session
      // doesn't know about yet (e.g. messages delivered via POST /api/manager-messages).
      const patchById = new Map(patch.managerMessages.map((m) => [m.id, m]));
      const onlyInDb = data.managerMessages.filter((m) => !patchById.has(m.id));
      data.managerMessages = [...onlyInDb, ...patch.managerMessages];
    }

    if (patch.mentorshipAssignments) {
      // Merge by ID, same reasoning as managerMessages above: the client only ever loads
      // this collection once at bootstrap, so a naive replace here would silently drop any
      // assignment created/updated by a different session (e.g. another manager, or a
      // student saving their mentorship profile) in the meantime.
      const patchById = new Map(patch.mentorshipAssignments.map((a) => [a.id, a]));
      const onlyInDb = data.mentorshipAssignments.filter((a) => !patchById.has(a.id));
      data.mentorshipAssignments = [...onlyInDb, ...patch.mentorshipAssignments];
    }

    if (patch.mentorshipSubmissions) {
      // Merge by ID for the same reason as mentorshipAssignments above.
      const patchById = new Map(patch.mentorshipSubmissions.map((s) => [s.id, s]));
      const onlyInDb = data.mentorshipSubmissions.filter((s) => !patchById.has(s.id));
      data.mentorshipSubmissions = [...onlyInDb, ...patch.mentorshipSubmissions];
    }

    if (patch.externalTrainingRequests) {
      data.externalTrainingRequests = patch.externalTrainingRequests;
    }

    return this.write(data);
  }

  async appendManagerMessage(message: LmsDataStore['managerMessages'][number]) {
    const data = await this.read();
    data.managerMessages = [message, ...data.managerMessages];
    return this.write(data);
  }

  async upsertAssignmentSubmission(submission: AssignmentSubmissionRecord) {
    const data = await this.read();
    const existingIndex = data.assignmentSubmissions.findIndex((entry) => entry.id === submission.id);

    if (existingIndex === -1) {
      data.assignmentSubmissions.unshift(submission);
    } else {
      data.assignmentSubmissions[existingIndex] = submission;
    }

    const next = await this.write(data);
    return next.assignmentSubmissions.find((entry) => entry.id === submission.id) ?? null;
  }

  async upsertMentorshipSubmission(submission: LmsDataStore['mentorshipSubmissions'][number]) {
    const data = await this.read();
    const existingIndex = data.mentorshipSubmissions.findIndex((entry) => entry.id === submission.id);

    if (existingIndex === -1) {
      data.mentorshipSubmissions.unshift(submission);
    } else {
      data.mentorshipSubmissions[existingIndex] = submission;
    }

    const next = await this.write(data);
    return next.mentorshipSubmissions.find((entry) => entry.id === submission.id) ?? null;
  }

  async upsertQuizSubmission(submission: QuizSubmissionRecord) {
    const data = await this.read();
    const existingIndex = data.quizSubmissions.findIndex((entry) => entry.id === submission.id);

    if (existingIndex === -1) {
      data.quizSubmissions.unshift(submission);
    } else {
      data.quizSubmissions[existingIndex] = submission;
    }

    const next = await this.write(data);
    return next.quizSubmissions.find((entry) => entry.id === submission.id) ?? null;
  }

  async createExternalTrainingRequest(input: ExternalTrainingRequestCreateInput) {
    const data = await this.read();
    const studentName = input.studentName.trim();
    const studentEmail = input.studentEmail.trim();
    const courseName = input.courseName.trim();
    const provider = input.provider.trim();
    const trainingStartDate = input.trainingStartDate.trim();
    const trainingEndDate = input.trainingEndDate.trim();
    const courseCost = input.courseCost.trim();
    const approvingManagerId = input.approvingManagerId.trim();
    const approvingManager = resolveApprovingManagers(data).find((manager) => manager.id === approvingManagerId);

    if (!studentName || !studentEmail || !courseName || !provider || !trainingStartDate || !trainingEndDate || !courseCost || !approvingManager) {
      return null;
    }

    const additionalCostRequired = input.additionalCostRequired;
    const travelCost = input.travelCost.trim();
    const examCost = input.examCost.trim();
    const accommodationCost = input.accommodationCost.trim();

    if (additionalCostRequired === 'Yes' && (!travelCost || !examCost || !accommodationCost)) {
      return null;
    }

    const request = {
      id: `external-training-request-${Date.now()}`,
      studentId: input.studentId.trim(),
      studentName,
      studentEmail,
      courseName,
      provider,
      trainingType: input.trainingType,
      alignedToIdp: input.alignedToIdp,
      trainingStartDate,
      trainingEndDate,
      courseCost,
      additionalCostRequired,
      travelCost: additionalCostRequired === 'Yes' ? travelCost : '',
      examCost: additionalCostRequired === 'Yes' ? examCost : '',
      accommodationCost: additionalCostRequired === 'Yes' ? accommodationCost : '',
      approvingManagerId: approvingManager.id,
      approvingManagerName: approvingManager.name,
      approvingManagerEmail: approvingManager.email,
      invoiceFileName: input.invoiceFileName.trim(),
      invoiceDataUrl: input.invoiceDataUrl,
      brochureFileName: input.brochureFileName.trim(),
      brochureDataUrl: input.brochureDataUrl,
      proofOfPaymentFileName: '',
      proofOfPaymentUrl: '',
      certificateFileName: '',
      certificateUrl: '',
      submittedAt: this.formatDisplayDate(new Date()),
      status: 'Pending Review' as const,
      reviewerName: null,
      reviewerFeedback: '',
      reviewedAt: null,
    };

    data.externalTrainingRequests.unshift(request);
    const next = await this.write(data);
    return next.externalTrainingRequests.find((entry) => entry.id === request.id) ?? null;
  }

  async updateExternalTrainingRequest(input: ExternalTrainingRequestUpdateInput) {
    const data = await this.read();
    const requestId = input.requestId.trim();
    const studentName = input.studentName.trim();
    const studentEmail = input.studentEmail.trim();
    const courseName = input.courseName.trim();
    const provider = input.provider.trim();
    const trainingStartDate = input.trainingStartDate.trim();
    const trainingEndDate = input.trainingEndDate.trim();
    const courseCost = input.courseCost.trim();
    const approvingManagerId = input.approvingManagerId.trim();
    const approvingManager = resolveApprovingManagers(data).find((manager) => manager.id === approvingManagerId);

    if (!requestId || !studentName || !studentEmail || !courseName || !provider || !trainingStartDate || !trainingEndDate || !courseCost || !approvingManager) {
      return null;
    }

    const existingIndex = data.externalTrainingRequests.findIndex((entry) => entry.id === requestId);
    if (existingIndex === -1 || data.externalTrainingRequests[existingIndex]?.status !== 'Needs Revision') {
      return null;
    }

    const additionalCostRequired = input.additionalCostRequired;
    const travelCost = input.travelCost.trim();
    const examCost = input.examCost.trim();
    const accommodationCost = input.accommodationCost.trim();

    if (additionalCostRequired === 'Yes' && (!travelCost || !examCost || !accommodationCost)) {
      return null;
    }

    data.externalTrainingRequests[existingIndex] = {
      ...data.externalTrainingRequests[existingIndex],
      studentName,
      studentEmail,
      courseName,
      provider,
      trainingType: input.trainingType,
      alignedToIdp: input.alignedToIdp,
      trainingStartDate,
      trainingEndDate,
      courseCost,
      additionalCostRequired,
      travelCost: additionalCostRequired === 'Yes' ? travelCost : '',
      examCost: additionalCostRequired === 'Yes' ? examCost : '',
      accommodationCost: additionalCostRequired === 'Yes' ? accommodationCost : '',
      approvingManagerId: approvingManager.id,
      approvingManagerName: approvingManager.name,
      approvingManagerEmail: approvingManager.email,
      invoiceFileName: input.invoiceFileName.trim(),
      invoiceDataUrl: input.invoiceDataUrl,
      brochureFileName: input.brochureFileName.trim(),
      brochureDataUrl: input.brochureDataUrl,
      submittedAt: this.formatDisplayDate(new Date()),
      status: 'Pending Review',
      reviewerName: null,
      reviewerFeedback: '',
      reviewedAt: null,
    };

    const next = await this.write(data);
    return next.externalTrainingRequests.find((entry) => entry.id === requestId) ?? null;
  }

  async reviewExternalTrainingRequest(input: ExternalTrainingRequestReviewInput) {
    const data = await this.read();
    const requestId = input.requestId.trim();
    const reviewerName = input.reviewerName.trim();

    if (!requestId || !reviewerName) {
      return null;
    }

    const existingIndex = data.externalTrainingRequests.findIndex((entry) => entry.id === requestId);
    if (existingIndex === -1) {
      return null;
    }

    data.externalTrainingRequests[existingIndex] = {
      ...data.externalTrainingRequests[existingIndex],
      reviewerName,
      reviewerFeedback: input.feedback?.trim() ?? '',
      status: input.status,
      reviewedAt: this.formatDisplayDate(new Date()),
    };

    const next = await this.write(data);
    return next.externalTrainingRequests.find((entry) => entry.id === requestId) ?? null;
  }

  async attachExternalTrainingRequestDocuments(input: ExternalTrainingRequestDocumentsInput) {
    const data = await this.read();
    const requestId = input.requestId.trim();

    if (!requestId) {
      return null;
    }

    const existingIndex = data.externalTrainingRequests.findIndex((entry) => entry.id === requestId);
    if (existingIndex === -1) {
      return null;
    }

    const existing = data.externalTrainingRequests[existingIndex];
    data.externalTrainingRequests[existingIndex] = {
      ...existing,
      invoiceFileName: input.invoiceFileName !== undefined ? input.invoiceFileName.trim() : existing.invoiceFileName ?? '',
      invoiceDataUrl: input.invoiceDataUrl !== undefined ? input.invoiceDataUrl : existing.invoiceDataUrl ?? '',
      proofOfPaymentFileName: input.proofOfPaymentFileName !== undefined ? input.proofOfPaymentFileName.trim() : existing.proofOfPaymentFileName ?? '',
      proofOfPaymentUrl: input.proofOfPaymentUrl !== undefined ? input.proofOfPaymentUrl : existing.proofOfPaymentUrl ?? '',
      certificateFileName: input.certificateFileName !== undefined ? input.certificateFileName.trim() : existing.certificateFileName ?? '',
      certificateUrl: input.certificateUrl !== undefined ? input.certificateUrl : existing.certificateUrl ?? '',
    };

    const next = await this.write(data);
    return next.externalTrainingRequests.find((entry) => entry.id === requestId) ?? null;
  }

  async authenticateSso(input: { email: string; role?: LoginRole }) {
    const data = await this.read();
    const normalizedEmail = input.email.trim().toLowerCase();
    const requestedRole = input.role;

    if (!normalizedEmail) {
      return null;
    }

    const account = data.authAccounts.find((entry) => entry.email.toLowerCase() === normalizedEmail);
    if (!account) {
      return null;
    }

    if (requestedRole && requestedRole !== account.role) {
      // Allow manager credentials to open the learner workspace when the manager
      // has a linked learner profile.
      if (requestedRole === 'student' && account.role === 'training-manager' && account.linkedStudentId) {
        return {
          role: 'student' as const,
          route: '/student-profile',
          username: account.username,
          email: account.email,
          studentId: account.linkedStudentId,
        };
      }

      return null;
    }

    return {
      role: account.role,
      route: account.route,
      username: account.username,
      email: account.email,
      studentId: resolveStudentIdForAccount(data, account),
    };
  }

  async authenticate(input: LoginRequestInput) {
    const data = await this.read();
    const role = input.role;
    const username = input.username.trim();
    const normalizedUsername = username.toLowerCase();
    const password = input.password;

    if (!username || !password) {
      return null;
    }

    if (shouldBlockDefaultDemoCredentialLogin() && isDefaultDemoCredentialLogin(role, username, password)) {
      return null;
    }

    // Primary lookup: find an account whose stored role matches the requested role exactly.
    let account = data.authAccounts.find(
      (entry) => entry.role === role
        && (entry.username.toLowerCase() === normalizedUsername || entry.email.toLowerCase() === normalizedUsername),
    );

    // Dual-access: a training manager or administrator can also be enrolled as a student.
    // Their auth account role is 'training-manager'/'administrator' with a linkedStudentId pointing
    // to their own student record. Allow them to log in as 'student' using the same credentials.
    let lineManagerStudentId: string | undefined;
    if (!account && role === 'student') {
      const managerAccount = data.authAccounts.find(
        (entry) => (entry.role === 'training-manager' || entry.role === 'administrator')
          && entry.linkedStudentId
          && (entry.username.toLowerCase() === normalizedUsername || entry.email.toLowerCase() === normalizedUsername),
      );
      if (managerAccount) {
        account = managerAccount;
        lineManagerStudentId = managerAccount.linkedStudentId ?? undefined;
      }
    }

    if (!account) {
      return null;
    }

    if (!verifyPassword(password, account.passwordSalt, account.passwordHash)) {
      return null;
    }

    // Line manager logging in as student: return student context instead of manager context.
    if (lineManagerStudentId) {
      return {
        role: 'student' as const,
        route: '/student-profile',
        username: account.username,
        email: account.email,
        studentId: lineManagerStudentId,
      };
    }

    return {
      role: account.role,
      route: account.route,
      username: account.username,
      email: account.email,
      studentId: resolveStudentIdForAccount(data, account),
    };
  }

  async resolveRoles(input: { username: string; password: string }): Promise<ResolvedRoleEntry[]> {
    const data = await this.read();
    const username = input.username.trim();
    const normalizedUsername = username.toLowerCase();
    const password = input.password;

    if (!username || !password) {
      return [];
    }

    const results: ResolvedRoleEntry[] = [];

    const matchingAccounts = data.authAccounts.filter(
      (a) => a.username.toLowerCase() === normalizedUsername || a.email.toLowerCase() === normalizedUsername,
    );

    for (const account of matchingAccounts) {
      if (shouldBlockDefaultDemoCredentialLogin() && isDefaultDemoCredentialLogin(account.role, username, password)) {
        continue;
      }

      if (!verifyPassword(password, account.passwordSalt, account.passwordHash)) {
        continue;
      }

      const identity = resolveAccountDisplayNameSync(data, account);

      mergeResolvedRole(results, {
        role: account.role,
        route: account.route,
        username: account.username,
        email: account.email,
        studentId: resolveStudentIdForAccount(data, account),
        name: identity?.name,
        surname: identity?.surname,
      });

      // Dual-access: a training manager or administrator with a linked student profile can also enter the student workspace.
      if ((account.role === 'training-manager' || account.role === 'administrator') && account.linkedStudentId) {
        mergeResolvedRole(results, {
          role: 'student' as const,
          route: '/student-profile',
          username: account.username,
          email: account.email,
          studentId: account.linkedStudentId,
          name: identity?.name,
          surname: identity?.surname,
        });
      }

      // The isAdmin flag on the linked directory record grants full administrator access
      // independently of the account's base role (student or manager).
      const linkedStudentForAdmin = resolveLinkedStudentRecord(data, account);
      if (linkedStudentForAdmin?.isAdmin) {
        mergeResolvedRole(results, {
          role: 'administrator' as const,
          route: '/admin-profile',
          username: account.username,
          email: account.email,
          studentId: resolveStudentIdForAccount(data, account) ?? account.linkedStudentId ?? undefined,
          name: identity?.name,
          surname: identity?.surname,
        });
      }
    }

    return results;
  }

  async resolveRolesByEmail(email: string): Promise<ResolvedRoleEntry[]> {
    const data = await this.read();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      return [];
    }

    const results: ResolvedRoleEntry[] = [];

    const matchingAccounts = data.authAccounts.filter(
      (a) => a.email.toLowerCase() === normalizedEmail,
    );

    for (const account of matchingAccounts) {
      const identity = resolveAccountDisplayNameSync(data, account);

      mergeResolvedRole(results, {
        role: account.role,
        route: account.route,
        username: account.username,
        email: account.email,
        studentId: resolveStudentIdForAccount(data, account),
        name: identity?.name,
        surname: identity?.surname,
      });

      // Dual-access: a training manager or administrator with a linked student profile can also enter the student workspace.
      if ((account.role === 'training-manager' || account.role === 'administrator') && account.linkedStudentId) {
        mergeResolvedRole(results, {
          role: 'student' as const,
          route: '/student-profile',
          username: account.username,
          email: account.email,
          studentId: account.linkedStudentId,
          name: identity?.name,
          surname: identity?.surname,
        });
      }

      // The isAdmin flag on the linked directory record grants full administrator access
      // independently of the account's base role (student or manager).
      const linkedStudentForAdmin = resolveLinkedStudentRecord(data, account);
      if (linkedStudentForAdmin?.isAdmin) {
        mergeResolvedRole(results, {
          role: 'administrator' as const,
          route: '/admin-profile',
          username: account.username,
          email: account.email,
          studentId: resolveStudentIdForAccount(data, account) ?? account.linkedStudentId ?? undefined,
          name: identity?.name,
          surname: identity?.surname,
        });
      }
    }

    return results;
  }

  /**
   * The real name and profile picture behind an account, regardless of which role it's currently
   * logged in as — resolved from the directory entry linked to that account, not from
   * username/email parsing. Lets the admin and training-manager views show the same name and
   * picture as the student view for accounts with multiple access roles.
   */
  async resolveAccountIdentity(accountEmail: string): Promise<{
    name: string;
    surname: string;
    profileImageUrl: string | null;
    profileImageDataUrl: string | null;
  } | null> {
    const data = await this.read();
    const normalizedEmail = accountEmail.trim().toLowerCase();
    const account = data.authAccounts.find((entry) => entry.email.toLowerCase() === normalizedEmail);
    if (!account) {
      return null;
    }

    const identity = resolveAccountDisplayNameSync(data, account);
    if (!identity) {
      return null;
    }

    const studentId = resolveStudentIdForAccount(data, account) ?? account.linkedStudentId;
    const student = studentId ? data.students.find((entry) => entry.id === studentId) : undefined;

    return {
      ...identity,
      profileImageUrl: student?.profile?.profileImageUrl ?? null,
      profileImageDataUrl: student?.profile?.profileImageDataUrl ?? null,
    };
  }

  /**
   * Updates only the profile picture on the directory entry linked to this account — used so an
   * admin/training-manager's picture upload is visible from every role, not just the one they
   * uploaded it from. Never touches any other field on the student record.
   */
  async updateAccountProfileImage(
    accountEmail: string,
    image: { profileImageUrl: string | null; profileImageDataUrl: string | null },
  ): Promise<boolean> {
    const data = await this.read();
    const normalizedEmail = accountEmail.trim().toLowerCase();
    const account = data.authAccounts.find((entry) => entry.email.toLowerCase() === normalizedEmail);
    if (!account) {
      return false;
    }

    const studentId = resolveStudentIdForAccount(data, account) ?? account.linkedStudentId;
    if (!studentId) {
      return false;
    }

    const studentIndex = data.students.findIndex((entry) => entry.id === studentId);
    if (studentIndex === -1) {
      return false;
    }

    data.students[studentIndex] = {
      ...data.students[studentIndex],
      profile: {
        ...data.students[studentIndex].profile,
        profileImageUrl: image.profileImageUrl,
        profileImageDataUrl: image.profileImageDataUrl,
      },
    };

    await this.write(data);
    return true;
  }

  /**
   * Gives an administrator or training manager a real, persistent student profile to switch into,
   * instead of the generic fallback session (which had no studentId and silently reused whichever
   * student the server happens to be configured with as its default).
   *
   * Reuses a directory entry that already matches this account's email (e.g. one added via User
   * Management) if one exists; otherwise creates a fresh, empty one. Either way the link is saved
   * on the account so every future switch — and every future login — lands on the same profile.
   */
  async ensureSwitchStudentProfile(accountEmail: string): Promise<{ studentId: string } | null> {
    const data = await this.read();
    const normalizedEmail = accountEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      return null;
    }

    const accountIndex = data.authAccounts.findIndex((entry) => entry.email.toLowerCase() === normalizedEmail);
    if (accountIndex === -1) {
      return null;
    }

    const account = data.authAccounts[accountIndex];
    if (account.role !== 'administrator' && account.role !== 'training-manager') {
      return null;
    }

    if (account.linkedStudentId && data.students.some((student) => student.id === account.linkedStudentId)) {
      return { studentId: account.linkedStudentId };
    }

    // Base role is always 'manager' here — admin access (a legacy 'administrator' authAccounts row,
    // which normalizeData migrates away going forward) is granted via isAdmin, not the base role.
    const isAdminAccount = (account.role as string) === 'administrator';
    const directoryRole: EnrollmentStudentRecord['role'] = 'manager';
    const existingStudent = data.students.find((student) => student.email.toLowerCase() === normalizedEmail);

    let studentId: string;
    if (existingStudent) {
      studentId = existingStudent.id;
      if (existingStudent.role !== directoryRole || (isAdminAccount && !existingStudent.isAdmin)) {
        data.students = data.students.map((student) =>
          student.id === studentId ? { ...student, role: directoryRole, isAdmin: student.isAdmin || isAdminAccount } : student,
        );
      }
    } else {
      const displayName = deriveDisplayNameFromIdentity(account.username, account.email);
      studentId = `own-profile-${accountIndex}-${Date.now().toString(36)}`;
      const enrollment: EnrollmentStudentRecord = {
        id: studentId,
        name: displayName.name,
        surname: displayName.surname,
        group: 'Internal',
        dateEnrolled: new Date().toISOString().slice(0, 10),
        deadlineDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().slice(0, 10),
        email: account.email,
        jobTitle: isAdminAccount ? 'Administrator' : 'Training Manager',
        idNumber: '',
        activeStatus: 'Active',
        department: isAdminAccount ? 'Administration' : 'Training Management',
        lineManager: '',
        status: 'Not Yet Started',
        assignedOfferingIds: [],
        role: directoryRole,
        isAdmin: isAdminAccount,
      };
      data.students = [...data.students, createStudentRecordFromEnrollment(enrollment)];
    }

    data.authAccounts[accountIndex] = { ...account, linkedStudentId: studentId };
    syncLinkedAuthAccounts(data);
    await this.write(data);

    return { studentId };
  }

  async upsertManagedUserCredentials(inputs: ManagedUserCredentialInput[]): Promise<ManagedUserCredentialsUpsertResponse> {
    const data = await this.read();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const input of inputs) {
      const studentId = input.studentId.trim();
      const password = input.password.trim();

      if (!studentId || !isStrongPassword(password)) {
        skipped += 1;
        continue;
      }

      const student = data.students.find((entry) => entry.id === studentId);
      if (!student) {
        skipped += 1;
        continue;
      }

      const email = student.email.trim().toLowerCase();
      const role = normalizeLoginRole(input.role);
      const credentials = createPasswordCredentials(password);
      const accountIndex = data.authAccounts.findIndex(
        (entry) => entry.linkedStudentId === studentId || entry.email.toLowerCase() === email,
      );

      if (accountIndex >= 0) {
        data.authAccounts[accountIndex] = {
          ...data.authAccounts[accountIndex],
          role,
          route: routeForLoginRole(role),
          email,
          linkedStudentId: studentId,
          passwordHash: credentials.passwordHash,
          passwordSalt: credentials.passwordSalt,
        };
        updated += 1;
      } else {
        data.authAccounts.unshift({
          id: `auth-managed-${studentId}`,
          role,
          username: email,
          email,
          route: routeForLoginRole(role),
          passwordHash: credentials.passwordHash,
          passwordSalt: credentials.passwordSalt,
          linkedStudentId: studentId,
        });
        created += 1;
      }

      data.students = data.students.map((entry) =>
        entry.id === studentId
          ? {
              ...entry,
              profile: {
                ...entry.profile,
                passwordUpdatedAt: 'Updated just now',
              },
            }
          : entry,
      );
    }

    syncLinkedAuthAccounts(data);
    await this.write(data);
    return { created, updated, skipped };
  }

  async createPasswordResetRequest(emailAddress: string) {
    const data = await this.read();
    const email = emailAddress.trim().toLowerCase();
    const account = data.authAccounts.find((entry) => entry.email.toLowerCase() === email);

    if (!account) {
      return null;
    }

    const token = generatePasswordResetToken();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + passwordResetLifetimeMs);

    data.passwordResetTokens = data.passwordResetTokens
      .filter((entry) => entry.accountId !== account.id || entry.consumedAt)
      .filter((entry) => new Date(entry.expiresAt).getTime() > Date.now());

    data.passwordResetTokens.unshift({
      id: `password-reset-${Date.now()}`,
      accountId: account.id,
      tokenHash: hashPasswordResetToken(token),
      createdAt: issuedAt.toISOString(),
      sentAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      consumedAt: null,
    });

    await this.write(data);

    return {
      token,
      accountEmail: account.email,
      username: account.username,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getPasswordResetTokenStatus(token: string): Promise<PasswordResetTokenStatus> {
    const match = await this.findActivePasswordResetToken(token);

    if (!match) {
      return { valid: false };
    }

    return {
      valid: true,
      email: match.account.email,
      expiresAt: match.record.expiresAt,
    };
  }

  async resetPassword(token: string, nextPassword: string) {
    const password = nextPassword.trim();
    if (!isStrongPassword(password)) {
      return null;
    }

    const data = await this.read();
    const tokenHash = hashPasswordResetToken(token);
    const nowIso = new Date().toISOString();
    const record = data.passwordResetTokens.find((entry) => entry.tokenHash === tokenHash && !entry.consumedAt && new Date(entry.expiresAt).getTime() > Date.now());

    if (!record) {
      return null;
    }

    const accountIndex = data.authAccounts.findIndex((entry) => entry.id === record.accountId);
    if (accountIndex === -1) {
      return null;
    }

    const credentials = createPasswordCredentials(password);
    data.authAccounts[accountIndex] = {
      ...data.authAccounts[accountIndex],
      passwordHash: credentials.passwordHash,
      passwordSalt: credentials.passwordSalt,
    };

    data.passwordResetTokens = data.passwordResetTokens.map((entry) =>
      entry.id === record.id || (entry.accountId === record.accountId && !entry.consumedAt)
        ? { ...entry, consumedAt: nowIso }
        : entry,
    );

    const next = await this.write(data);
    const account = next.authAccounts[accountIndex];

    return {
      role: account.role,
      route: account.route,
      username: account.username,
      email: account.email,
    };
  }

  async changePassword(input: ChangePasswordInput) {
    const email = input.email.trim().toLowerCase();
    const password = input.password.trim();

    if (!email || !isStrongPassword(password)) {
      return null;
    }

    const data = await this.read();
    const accountIndex = data.authAccounts.findIndex((entry) => entry.email.toLowerCase() === email);
    if (accountIndex === -1) {
      return null;
    }

    const credentials = createPasswordCredentials(password);
    data.authAccounts[accountIndex] = {
      ...data.authAccounts[accountIndex],
      passwordHash: credentials.passwordHash,
      passwordSalt: credentials.passwordSalt,
    };

    const studentIndex = data.students.findIndex((entry) => entry.profile.email.toLowerCase() === email);
    if (studentIndex !== -1) {
      data.students[studentIndex] = {
        ...data.students[studentIndex],
        profile: {
          ...data.students[studentIndex].profile,
          passwordUpdatedAt: 'Updated just now',
        },
      };
    }

    const next = await this.write(data);
    const account = next.authAccounts[accountIndex];
    return {
      role: account.role,
      route: account.route,
      username: account.username,
      email: account.email,
    };
  }

  private async findActivePasswordResetToken(token: string) {
    const data = await this.read();
    const tokenHash = hashPasswordResetToken(token);
    const record = data.passwordResetTokens.find((entry) => entry.tokenHash === tokenHash && !entry.consumedAt && new Date(entry.expiresAt).getTime() > Date.now());

    if (!record) {
      return null;
    }

    const account = data.authAccounts.find((entry) => entry.id === record.accountId);
    if (!account) {
      return null;
    }

    return { record, account };
  }

  private formatDisplayDate(date: Date) {
    return new Intl.DateTimeFormat('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }
}

class FirestoreLmsRepository extends LmsRepository {
  private readonly firestore: Firestore;
  private firestoreWriteQueue = Promise.resolve();
  private readonly rootCollectionId = process.env['LMS_FIRESTORE_COLLECTION']?.trim() || 'lmsStores';
  private readonly rootDocumentId = process.env['LMS_FIRESTORE_DOCUMENT_ID']?.trim() || 'primary';

  constructor() {
    super();
    const app = getApps().length > 0 ? getApp() : initializeApp();
    this.firestore = getFirestore(app);
  }

  private get storeDocument() {
    return this.firestore.collection(this.rootCollectionId).doc(this.rootDocumentId);
  }

  private collection<Name extends FirestoreCollectionName>(collectionName: Name) {
    return this.storeDocument.collection(collectionName);
  }

  private sanitizeForFirestore<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private async readCollection<Name extends FirestoreCollectionName>(collectionName: Name): Promise<FirestoreCollectionRecord<Name>[]> {
    const snapshot = await this.collection(collectionName).get();
    return snapshot.docs.map((documentSnapshot) => documentSnapshot.data() as FirestoreCollectionRecord<Name>);
  }

  private async queueCollectionSync<Name extends FirestoreCollectionName>(
    batchOperations: FirestoreBatchOperation[],
    collectionName: Name,
    nextItems: FirestoreCollectionRecord<Name>[],
  ) {
    const collectionRef = this.collection(collectionName);
    const existingDocuments = await collectionRef.listDocuments();
    const nextIds = new Set(nextItems.map((item) => item.id));

    for (const item of nextItems) {
      const nextValue = this.sanitizeForFirestore(item);
      batchOperations.push((batch) => {
        batch.set(collectionRef.doc(item.id), nextValue);
      });
    }

    for (const document of existingDocuments) {
      if (nextIds.has(document.id)) {
        continue;
      }

      batchOperations.push((batch) => {
        batch.delete(document);
      });
    }
  }

  private async commitBatchOperations(batchOperations: FirestoreBatchOperation[]) {
    if (batchOperations.length === 0) {
      return;
    }

    for (let index = 0; index < batchOperations.length; index += 450) {
      const batch = this.firestore.batch();
      for (const operation of batchOperations.slice(index, index + 450)) {
        operation(batch);
      }
      await batch.commit();
    }
  }

  override async read(): Promise<LmsDataStore> {
    const [
      storeSnapshot,
      offerings,
      students,
      trainingManagers,
      managerMessages,
      mentorshipAssignments,
      assignmentSubmissions,
      mentorshipSubmissions,
      quizSubmissions,
      externalTrainingRequests,
      authAccounts,
      passwordResetTokens,
    ] = await Promise.all([
      this.storeDocument.get(),
      this.readCollection('offerings'),
      this.readCollection('students'),
      this.readCollection('trainingManagers'),
      this.readCollection('managerMessages'),
      this.readCollection('mentorshipAssignments'),
      this.readCollection('assignmentSubmissions'),
      this.readCollection('mentorshipSubmissions'),
      this.readCollection('quizSubmissions'),
      this.readCollection('externalTrainingRequests'),
      this.readCollection('authAccounts'),
      this.readCollection('passwordResetTokens'),
    ]);

    const hasStoredCollections = [
      offerings,
      students,
      trainingManagers,
      managerMessages,
      mentorshipAssignments,
      assignmentSubmissions,
      mentorshipSubmissions,
      quizSubmissions,
      externalTrainingRequests,
      authAccounts,
      passwordResetTokens,
    ].some((records) => records.length > 0);

    if (!storeSnapshot.exists && !hasStoredCollections) {
      const seeded = normalizeData(createDefaultData());
      await this.write(seeded);
      return seeded;
    }

    const defaults = normalizeData(createDefaultData());
    const storeData = storeSnapshot.exists
      ? (storeSnapshot.data() as Partial<Pick<LmsDataStore, 'branding' | 'updatedAt' | 'currentKpiYear' | 'kpiYearsOpened'>>)
      : undefined;

    return normalizeData({
      offerings,
      students,
      branding: storeData?.branding ?? defaults.branding,
      trainingManagers,
      managerMessages,
      mentorshipAssignments,
      assignmentSubmissions,
      mentorshipSubmissions,
      quizSubmissions,
      externalTrainingRequests,
      authAccounts,
      passwordResetTokens,
      updatedAt: storeData?.updatedAt ?? defaults.updatedAt,
      currentKpiYear: storeData?.currentKpiYear ?? defaults.currentKpiYear,
      kpiYearsOpened: storeData?.kpiYearsOpened ?? defaults.kpiYearsOpened,
    });
  }

  override async write(data: LmsDataStore): Promise<LmsDataStore> {
    const nextData = normalizeData({
      ...data,
      updatedAt: new Date().toISOString(),
    });

    // .catch(() => {}) before chaining the next write is load-bearing: without it, a single
    // failed write (e.g. an oversized field) leaves this.firestoreWriteQueue permanently
    // rejected, and every future write on this same warm instance silently no-ops (the
    // .then() callback is skipped once the chain is rejected) while still rejecting its own
    // caller with that same stale error — making one bad write look like the server is
    // randomly broken for everyone until the instance recycles. Swallowing the previous
    // failure here only resets the chain for the next write; it doesn't hide this write's own
    // errors — those still propagate normally via the `await` below.
    this.firestoreWriteQueue = this.firestoreWriteQueue.catch(() => {}).then(async () => {
      const batchOperations: FirestoreBatchOperation[] = [
        (batch) => {
          batch.set(this.storeDocument, this.sanitizeForFirestore({
            branding: nextData.branding,
            updatedAt: nextData.updatedAt,
            currentKpiYear: nextData.currentKpiYear,
            kpiYearsOpened: nextData.kpiYearsOpened,
          }));
        },
      ];

      await Promise.all(
        firestoreCollectionNames.map((collectionName) => this.queueCollectionSync(
          batchOperations,
          collectionName,
          nextData[collectionName] as FirestoreCollectionRecord<typeof collectionName>[],
        )),
      );

      await this.commitBatchOperations(batchOperations);
    });

    await this.firestoreWriteQueue;
    return nextData;
  }

  // Scoped, transactional overrides for the two high-frequency single-student KPI writes.
  // The inherited read()+write() path round-trips and rewrites *every* collection in the whole
  // store for any change, serialized only by an in-memory queue that's local to one warm Cloud
  // Function instance — under real concurrent traffic (two different requests landing on two
  // different instances, which is normal for HTTPS functions under load) two of those full-store
  // read-modify-write cycles can interleave: both read the store before either writes, so
  // whichever writes second overwrites the first's change with its own (older) snapshot of that
  // student. That's what let a student's KPI self-score appear saved and then silently vanish —
  // not a display bug, an actual lost write. Touching only the one affected student document
  // inside a Firestore transaction sidesteps both problems: the transaction's own optimistic-
  // concurrency retry keeps two concurrent writes to the *same* document from losing one, and nothing
  // outside that one document is read or rewritten, so unrelated writes elsewhere can't collide with it.
  override async setKpiEntriesForStudent(studentId: string, entries: StudentKpiEntryRecord[]) {
    const ref = this.collection('students').doc(studentId);
    return this.firestore.runTransaction(async (transaction) => {
      // Both reads have to happen before any write in a Firestore transaction — currentKpiYear
      // lives on the root store document (shared org-wide), the KPI rows on the student's own.
      const [snapshot, storeSnapshot] = await Promise.all([transaction.get(ref), transaction.get(this.storeDocument)]);
      if (!snapshot.exists) {
        return null;
      }

      const currentKpiYear = this.readCurrentKpiYear(storeSnapshot);
      // A raw transaction snapshot never goes through normalizeData, so a document a student
      // still has under the pre-year-feature shape (kpiEntries, no kpiYears yet) has to be
      // migrated right here too — otherwise this write would treat their KPI history as empty
      // and silently orphan it the instant this transaction actually commits a kpiYears field.
      const rawData = snapshot.data() as { kpiYears?: unknown; kpiEntries?: unknown };
      const kpiYears = normalizeStudentKpiYears(rawData, currentKpiYear);
      const existingEntries = findKpiYearEntries(kpiYears, currentKpiYear);
      const nextEntries = preserveEmployeeScoringOnFullReplace(existingEntries, normalizeStudentKpiEntries(entries));
      transaction.update(ref, {
        kpiYears: this.sanitizeForFirestore(withKpiYearEntries(kpiYears, currentKpiYear, nextEntries)),
        // Once a legacy document has been migrated into kpiYears above, the old flat field is
        // dead weight — left in place it would keep getting read by normalizeStudentKpiYears'
        // Array.isArray(kpiYears) branch forever ignoring it, but never actually cleaned up,
        // since this is a merge (update), not a full-document replace like the generic write()
        // path that normally strips it.
        ...('kpiEntries' in rawData ? { kpiEntries: FieldValue.delete() } : {}),
      });
      return nextEntries;
    });
  }

  override async updateKpiEmployeeScoring(studentId: string, updates: { id: string; employeeScoring: StudentKpiScoreRecord | null }[]) {
    const ref = this.collection('students').doc(studentId);
    return this.firestore.runTransaction(async (transaction) => {
      const [snapshot, storeSnapshot] = await Promise.all([transaction.get(ref), transaction.get(this.storeDocument)]);
      if (!snapshot.exists) {
        return null;
      }

      const currentKpiYear = this.readCurrentKpiYear(storeSnapshot);
      const scoringById = new Map(updates.map((update) => [update.id, update.employeeScoring]));
      // Same migrate-on-read as setKpiEntriesForStudent above — see that comment.
      const rawData = snapshot.data() as { kpiYears?: unknown; kpiEntries?: unknown };
      const kpiYears = normalizeStudentKpiYears(rawData, currentKpiYear);
      const existingEntries = findKpiYearEntries(kpiYears, currentKpiYear);
      const nextEntries = existingEntries.map((entry) =>
        scoringById.has(entry.id) ? { ...entry, employeeScoring: scoringById.get(entry.id) ?? null } : entry,
      );

      transaction.update(ref, {
        kpiYears: this.sanitizeForFirestore(withKpiYearEntries(kpiYears, currentKpiYear, nextEntries)),
        ...('kpiEntries' in rawData ? { kpiEntries: FieldValue.delete() } : {}),
      });
      return nextEntries;
    });
  }

  override async updateKpiGapAnalysis(
    studentId: string,
    updates: { id: string; gapInitiative: string; gapComments: string; gapTargetDate: string }[],
  ) {
    const ref = this.collection('students').doc(studentId);
    return this.firestore.runTransaction(async (transaction) => {
      const [snapshot, storeSnapshot] = await Promise.all([transaction.get(ref), transaction.get(this.storeDocument)]);
      if (!snapshot.exists) {
        return null;
      }

      const currentKpiYear = this.readCurrentKpiYear(storeSnapshot);
      const updatesById = new Map(updates.map((update) => [update.id, update]));
      // Same migrate-on-read as setKpiEntriesForStudent above — see that comment.
      const rawData = snapshot.data() as { kpiYears?: unknown; kpiEntries?: unknown };
      const kpiYears = normalizeStudentKpiYears(rawData, currentKpiYear);
      const existingEntries = findKpiYearEntries(kpiYears, currentKpiYear);
      const nextEntries = existingEntries.map((entry) => {
        const update = updatesById.get(entry.id);
        return update
          ? { ...entry, gapInitiative: update.gapInitiative, gapComments: update.gapComments, gapTargetDate: update.gapTargetDate }
          : entry;
      });

      transaction.update(ref, {
        kpiYears: this.sanitizeForFirestore(withKpiYearEntries(kpiYears, currentKpiYear, nextEntries)),
        ...('kpiEntries' in rawData ? { kpiEntries: FieldValue.delete() } : {}),
      });
      return nextEntries;
    });
  }

  // currentKpiYear lives on the root store document; falls back to the same default the rest of
  // normalizeData uses if the store document hasn't been created yet or predates the year feature.
  private readCurrentKpiYear(storeSnapshot: DocumentSnapshot): number {
    const stored = storeSnapshot.exists ? (storeSnapshot.data() as Partial<LmsDataStore>)?.currentKpiYear : undefined;
    return typeof stored === 'number' && Number.isFinite(stored) ? stored : new Date().getFullYear();
  }

  // Scoped override of the org-wide "open a new KPI year" action. The inherited implementation
  // (base class above) goes through the generic read()+write() path, which re-lists and fully
  // overwrites every document in every collection via an unconditional batch.set() — including
  // every student document — rather than a merge. That's the same full-dataset read-modify-write
  // race the three scoped overrides above exist to avoid: any write that lands on a student
  // document (a self-score, a snapshot autosave) in the window between this method's read and its
  // write gets silently clobbered by this method's own (older) snapshot of that student. Opening a
  // year is rare and manager-initiated rather than high-frequency like those other three, but the
  // blast radius is worse if it does collide — a lost write during an org-wide rollover, not just
  // one student's save. This override narrows every write to only the kpiYears field via update()
  // (merge) instead of set() (full replace), and touches only the students collection and the root
  // store document — nothing else is read or rewritten.
  override async openKpiYear(year: number) {
    if (!Number.isInteger(year)) {
      throw new Error('Year must be a whole number.');
    }

    const resultPromise = this.firestoreWriteQueue.catch(() => {}).then(async () => {
      const storeSnapshot = await this.storeDocument.get();
      const storeData = storeSnapshot.exists ? (storeSnapshot.data() as Partial<LmsDataStore>) : undefined;
      const currentKpiYear = this.readCurrentKpiYear(storeSnapshot);
      const kpiYearsOpened = Array.isArray(storeData?.kpiYearsOpened) ? storeData.kpiYearsOpened : [currentKpiYear];

      if (kpiYearsOpened.includes(year)) {
        throw new Error(`KPI year ${year} has already been opened.`);
      }

      if (year <= currentKpiYear) {
        throw new Error(`New KPI year must be after the current year (${currentKpiYear}).`);
      }

      const studentDocuments = await this.collection('students').get();

      // Each student's carry-forward runs as its own Firestore transaction (reading and writing
      // that one document's kpiYears field together), rather than building one shared batch from
      // this method's single upfront collection read. The batch approach computed nextKpiYears
      // from a read taken once at the top of this method, then unconditionally overwrote the
      // kpiYears field with that stale snapshot — silently discarding a concurrent student
      // self-score save, manager gap-analysis edit, or snapshot autosave that transactionally
      // committed to the same student's kpiYears in the window between this method's read and its
      // batch commit. A per-student transaction reads and writes that document together and
      // retries automatically if it loses that race, matching how setKpiEntriesForStudent/
      // updateKpiEmployeeScoring/updateKpiGapAnalysis/updateStudentSnapshot below are already
      // scoped for exactly this reason.
      await Promise.all(studentDocuments.docs.map((document) => this.firestore.runTransaction(async (transaction) => {
        const ref = document.ref;
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) {
          return;
        }

        const rawData = snapshot.data() as { kpiYears?: unknown; kpiEntries?: unknown };
        const kpiYears = normalizeStudentKpiYears(rawData, currentKpiYear);
        const currentYearEntries = findKpiYearEntries(kpiYears, currentKpiYear);
        const carriedForwardEntries: StudentKpiEntryRecord[] = currentYearEntries.map((entry) => ({
          id: `kpi-${year}-${entry.id}`,
          keyResultArea: entry.keyResultArea,
          kpi: entry.kpi,
          weight: entry.weight,
          target: entry.target,
          measure: entry.measure,
          comments: entry.comments,
          actual: '',
          overallScoring: null,
          managerScoring: null,
          employeeScoring: null,
          dateOfReview: '',
          gapInitiative: '',
          gapComments: '',
          gapTargetDate: '',
        }));

        const nextKpiYears = this.sanitizeForFirestore(withKpiYearEntries(kpiYears, year, carriedForwardEntries));
        transaction.update(ref, {
          kpiYears: nextKpiYears,
          ...('kpiEntries' in rawData ? { kpiEntries: FieldValue.delete() } : {}),
        });
      })));

      const nextKpiYearsOpened = [...kpiYearsOpened, year].sort((left, right) => left - right);
      await this.storeDocument.set({ currentKpiYear: year, kpiYearsOpened: nextKpiYearsOpened }, { merge: true });

      return { currentKpiYear: year, kpiYearsOpened: nextKpiYearsOpened };
    });

    this.firestoreWriteQueue = resultPromise.then(() => {}, () => {});
    return resultPromise;
  }

  // Scoped override of the same shape as the two KPI methods above, for the same reason: the
  // inherited read()+write() path round-trips and rewrites the ENTIRE store for a single
  // student's routine snapshot save (autosaved on practically every student-side interaction —
  // browsing a course, marking a notification read, etc.), so it's the highest-frequency
  // opportunity for the full-dataset lost-update race described on write() above. Concretely: the
  // inherited path spreads the existing student record forward (`...data.students[studentIndex]`)
  // to preserve fields this endpoint doesn't touch, including kpiYears — but if that read
  // happened before a concurrent KPI save landed, this save's own (unrelated) write silently
  // carries the stale kpiYears back over the top of it once it completes. That's what made a
  // student's KPI self-score appear saved and then vanish shortly after, independent of the two
  // dedicated KPI endpoints already being scoped/transactional — this endpoint fires far more
  // often than either of those, so it's the more likely collision partner in practice.
  override async updateStudentSnapshot(studentId: string, snapshot: StudentSnapshotUpdate) {
    const ref = this.collection('students').doc(studentId);
    const updatedStudent = await this.firestore.runTransaction(async (transaction) => {
      const documentSnapshot = await transaction.get(ref);
      if (!documentSnapshot.exists) {
        return null;
      }

      const existing = documentSnapshot.data() as StudentRecord;
      const profileNameParts = snapshot.profile.name.trim().split(/\s+/).filter(Boolean);
      const nextFirstName = profileNameParts[0] ?? existing.name;
      const nextSurname = profileNameParts.slice(1).join(' ') || existing.surname;

      // Derive learning status from actual course completion data so it stays accurate as
      // students progress through their assigned offerings — mirrors the inherited path exactly.
      const assignedIds = new Set(existing.assignedOfferingIds ?? []);
      let derivedStatus: 'Completed' | 'In Progress' | 'Not Yet Started' | undefined;
      if (assignedIds.size > 0) {
        const assignedCourseRecords = (snapshot.courses ?? []).filter(
          (courseRecord) => courseRecord.offeringId && assignedIds.has(courseRecord.offeringId),
        );
        if (assignedCourseRecords.length > 0) {
          if (assignedCourseRecords.every((courseRecord) => courseRecord.completed)) {
            derivedStatus = 'Completed';
          } else if (assignedCourseRecords.some((courseRecord) => courseRecord.completed || (courseRecord.progress ?? 0) > 0)) {
            derivedStatus = 'In Progress';
          } else {
            derivedStatus = 'Not Yet Started';
          }
        }
      }

      const nextStudent: StudentRecord = {
        ...existing,
        name: nextFirstName,
        surname: nextSurname,
        email: snapshot.profile.email,
        idNumber: snapshot.profile.idNumber,
        ...(derivedStatus !== undefined ? { status: derivedStatus } : {}),
        profile: snapshot.profile,
        badgeState: snapshot.badgeState,
        certificatesAndLicences: snapshot.certificatesAndLicences ?? existing.certificatesAndLicences ?? [],
        settings: snapshot.settings,
        mentorshipProfile: snapshot.mentorshipProfile,
        mentorshipObjectives: snapshot.mentorshipObjectives,
        mentorshipProgressReport: snapshot.mentorshipProgressReport,
        courses: snapshot.courses,
        notifications: snapshot.notifications,
        messages: snapshot.messages,
        notifiedOfferingIds: snapshot.notifiedOfferingIds,
        assessmentAttempts: snapshot.assessmentAttempts,
        idpEntries: normalizeStudentIdpEntries(snapshot.idpEntries ?? existing.idpEntries ?? []),
      };

      transaction.update(ref, this.sanitizeForFirestore(nextStudent));
      return nextStudent;
    });

    if (!updatedStudent) {
      return null;
    }

    // Best-effort and outside the transaction, since it only matters on the rare save where a
    // student's own email actually changes — keeps their explicitly-linked auth account (if any)
    // in step, without paying the full authAccounts-collection scan syncLinkedAuthAccounts does
    // on every save via the inherited path. An auth account that's only matched by email (no
    // linkedStudentId set) isn't covered here; that fallback-matching case is rare enough for a
    // self-service email change that it's an acceptable gap against fixing the much more common
    // KPI data-loss race above.
    await this.syncLinkedAuthAccountForStudent(updatedStudent);

    return {
      studentId,
      profile: updatedStudent.profile,
      badgeState: updatedStudent.badgeState,
      certificatesAndLicences: updatedStudent.certificatesAndLicences ?? [],
      settings: updatedStudent.settings,
      mentorshipProfile: updatedStudent.mentorshipProfile,
      mentorshipObjectives: updatedStudent.mentorshipObjectives,
      mentorshipProgressReport: updatedStudent.mentorshipProgressReport,
      courses: updatedStudent.courses,
      notifications: updatedStudent.notifications,
      messages: updatedStudent.messages,
      notifiedOfferingIds: updatedStudent.notifiedOfferingIds,
      assessmentAttempts: updatedStudent.assessmentAttempts ?? {},
      idpEntries: updatedStudent.idpEntries ?? [],
    };
  }

  private async syncLinkedAuthAccountForStudent(student: StudentRecord) {
    const linkedAccountsSnapshot = await this.collection('authAccounts')
      .where('linkedStudentId', '==', student.id)
      .get();

    if (linkedAccountsSnapshot.empty) {
      return;
    }

    const role = normalizeLoginRole(student.role);
    const route = routeForLoginRole(role);
    const batch = this.firestore.batch();
    let hasUpdates = false;

    for (const accountDocument of linkedAccountsSnapshot.docs) {
      const account = accountDocument.data() as FirestoreCollectionRecord<'authAccounts'>;
      if (account.email === student.email && account.role === role && account.route === route) {
        continue;
      }

      hasUpdates = true;
      batch.update(accountDocument.ref, { email: student.email, role, route });
    }

    if (hasUpdates) {
      await batch.commit();
    }
  }
}

export function createLmsRepository() {
  const configuredBackend = process.env['LMS_STORAGE_BACKEND']?.trim().toLowerCase();
  const isFirebaseRuntime = Boolean(process.env['FUNCTION_TARGET'] || process.env['FIREBASE_CONFIG']);

  if (configuredBackend === 'firestore' || (!configuredBackend && isFirebaseRuntime)) {
    return new FirestoreLmsRepository();
  }

  return new LmsRepository();
}