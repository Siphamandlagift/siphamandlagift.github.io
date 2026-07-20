import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore, type WriteBatch } from 'firebase-admin/firestore';
import { createDefaultData } from './default-data.js';
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
  StudentNotificationRecord,
  StudentSnapshotUpdate,
  StudentRecord,
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
const defaultStudentTemplate = createDefaultData().students[0];
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

type FirestoreCollectionName = Exclude<keyof LmsDataStore, 'branding' | 'updatedAt'>;
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
    case 'administrator':
      return 'admin';
    default:
      return role;
  }
}

function normalizeLoginRole(role: EnrollmentStudentRecord['role'] | LoginRole): LoginRole {
  switch (role) {
    case 'manager':
      return 'training-manager';
    case 'admin':
      return 'administrator';
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
    mentorshipProfile: {
      ...existing.mentorshipProfile,
      menteeName: student.name,
      menteeSurname: student.surname,
    },
  };
}

function normalizeData(data: LmsDataStore): LmsDataStore {
  const defaults = createDefaultData();
  const offerings = data.offerings ?? defaults.offerings;
  const students = data.students.map((student) => {
    const defaultStudent = defaults.students.find((entry) => entry.id === student.id);
    const role = normalizeEnrollmentRole((student.role ?? defaultStudent?.role ?? 'student') as EnrollmentStudentRecord['role'] | LoginRole);
    const settings = {
      ...(defaultStudent?.settings ?? defaults.students[0]?.settings),
      ...(student.settings ?? {}),
    };
    const courses = student.courses ?? defaultStudent?.courses ?? [];
    const assignedOfferingIds = student.assignedOfferingIds ?? defaultStudent?.assignedOfferingIds ?? [];
    const notifiedOfferingIds = student.notifiedOfferingIds ?? defaultStudent?.notifiedOfferingIds ?? [];
    const notifications = student.notifications ?? defaultStudent?.notifications ?? [];
    const messages = student.messages ?? defaultStudent?.messages ?? [];
    const idpEntries = normalizeStudentIdpEntries(student.idpEntries ?? defaultStudent?.idpEntries ?? []);

    return {
      ...defaultStudent,
      ...student,
      role,
      settings,
      assignedOfferingIds,
      assessmentAttempts: student.assessmentAttempts ?? defaultStudent?.assessmentAttempts ?? {},
      courses,
      notifications,
      messages,
      idpEntries,
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
    this.writeQueue = this.writeQueue.then(async () => {
      await this.writePrimaryStore(nextData);
    });
    await this.writeQueue;
    return nextData;
  }

  async getBootstrap() {
    const data = await this.read();
    const idpEntriesByStudent = Object.fromEntries(
      data.students.map((student) => [student.id, student.idpEntries ?? []]),
    );

    return {
      offerings: data.offerings,
      branding: data.branding,
      students: data.students.map(({ courses, notifications, messages, notifiedOfferingIds, idpEntries, ...student }) => student),
      idpEntriesByStudent,
      trainingManagers: data.trainingManagers,
      managerMessages: data.managerMessages,
      mentorshipAssignments: data.mentorshipAssignments,
      assignmentSubmissions: data.assignmentSubmissions,
      mentorshipSubmissions: data.mentorshipSubmissions,
      quizSubmissions: data.quizSubmissions,
      externalTrainingRequests: data.externalTrainingRequests,
    };
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
      data.mentorshipAssignments = patch.mentorshipAssignments;
    }

    if (patch.mentorshipSubmissions) {
      data.mentorshipSubmissions = patch.mentorshipSubmissions;
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
    const approvingManager = data.trainingManagers.find((manager) => manager.id === approvingManagerId);

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
    const approvingManager = data.trainingManagers.find((manager) => manager.id === approvingManagerId);

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

    // Dual-access: a line manager is enrolled as a student AND has training-manager credentials.
    // Their auth account role is 'training-manager' with a linkedStudentId pointing to their own
    // student record. Allow them to log in as 'student' using the same credentials.
    let lineManagerStudentId: string | undefined;
    if (!account && role === 'student') {
      const managerAccount = data.authAccounts.find(
        (entry) => entry.role === 'training-manager'
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

  async resolveRoles(input: { username: string; password: string }): Promise<Array<{
    role: LoginRole;
    route: string;
    username: string;
    email: string;
    studentId?: string;
  }>> {
    const data = await this.read();
    const username = input.username.trim();
    const normalizedUsername = username.toLowerCase();
    const password = input.password;

    if (!username || !password) {
      return [];
    }

    const results: Array<{ role: LoginRole; route: string; username: string; email: string; studentId?: string }> = [];

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

      results.push({
        role: account.role,
        route: account.route,
        username: account.username,
        email: account.email,
        studentId: resolveStudentIdForAccount(data, account),
      });

      // Dual-access: a training manager with a linked student profile can also enter the student workspace.
      if (account.role === 'training-manager' && account.linkedStudentId) {
        results.push({
          role: 'student' as const,
          route: '/student-profile',
          username: account.username,
          email: account.email,
          studentId: account.linkedStudentId,
        });
      }
    }

    return results;
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
      ? (storeSnapshot.data() as Partial<Pick<LmsDataStore, 'branding' | 'updatedAt'>>)
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
    });
  }

  override async write(data: LmsDataStore): Promise<LmsDataStore> {
    const nextData = normalizeData({
      ...data,
      updatedAt: new Date().toISOString(),
    });

    this.firestoreWriteQueue = this.firestoreWriteQueue.then(async () => {
      const batchOperations: FirestoreBatchOperation[] = [
        (batch) => {
          batch.set(this.storeDocument, this.sanitizeForFirestore({
            branding: nextData.branding,
            updatedAt: nextData.updatedAt,
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
}

export function createLmsRepository() {
  const configuredBackend = process.env['LMS_STORAGE_BACKEND']?.trim().toLowerCase();
  const isFirebaseRuntime = Boolean(process.env['FUNCTION_TARGET'] || process.env['FIREBASE_CONFIG']);

  if (configuredBackend === 'firestore' || (!configuredBackend && isFirebaseRuntime)) {
    return new FirestoreLmsRepository();
  }

  return new LmsRepository();
}