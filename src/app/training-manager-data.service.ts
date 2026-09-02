import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, interval, tap, throwError, type Observable } from 'rxjs';
import { LmsBackendService } from './lms-backend.service';
import { combineDisplayName, readLmsSessionRecord } from './session-auth';
import type { StudentMessage } from './student-data.service';

export type ManagerPanel = 'dashboard' | 'requested-training' | 'courses' | 'mentorship' | 'enrollment' | 'messages' | 'idp' | 'performance' | 'succession';

export type ManagerProfile = {
  name: string;
  role: string;
  team: string;
  email: string;
  profileImageUrl: string | null;
};

export type SystemTrainingManager = {
  id: string;
  name: string;
  role: string;
  team: string;
  email: string;
};

export type TrainingOfferingType = 'Course' | 'Programme';
export type LearningStatus = 'Completed' | 'In Progress' | 'Not Yet Started';
export type TrainingAssessmentType = 'Quiz' | 'Assignment' | 'Mentorship' | 'Read and Acknowledge';
export type TrainingContentKind = 'Video' | 'Assessment' | 'Document' | 'Scorm';
export type TrainingQuestionType = 'Multiple Choice' | 'Short Answer' | 'Long Answer' | 'Document Upload' | 'True or False' | 'Matching';
export type TrainingIdpStatus = 'Not Started' | 'In Progress' | 'Completed' | 'On Hold';

export type StudentIdpEntry = {
  developmentNeed: string;
  plannedAction: string;
  supportRequired: string;
  dateCaptured: string;
  targetDate: string;
  status: TrainingIdpStatus;
};

export type StudentKpiScore = 1 | 2 | 3 | 4 | 5;

export type StudentKpiEntry = {
  id: string;
  // Visible columns: Key Result Area / Key Performance Indicator / Weight of KPI / Target /
  // Actual / Final Rating (overallScoring) / Comments.
  keyResultArea: string;
  kpi: string;
  weight: number;
  target: string;
  actual: string;
  comments: string;
  overallScoring: StudentKpiScore | null;
  // No longer independently editable — Manager/Employee/Overall Scoring collapsed into the single
  // Final Rating (overallScoring) column above. Kept (not removed) so historical data recorded
  // under the old three-way scoring model stays intact; nothing writes new values into these.
  managerScoring: StudentKpiScore | null;
  employeeScoring: StudentKpiScore | null;
  measure: string;
  dateOfReview: string;
  // Performance Gap Analysis — only meaningful once overallScoring lands at 1 or 2; captured here
  // rather than in a separate structure so it travels with the KPI row through the same save,
  // year-carry-forward, and read-only-past-year rules everything else on the row already follows.
  gapInitiative: string;
  gapComments: string;
  gapTargetDate: string;
};

export type TrainingAssessment = {
  title: string;
  type: TrainingAssessmentType;
};

export type TrainingContentItem = {
  id: string;
  kind: TrainingContentKind;
  title: string;
  assessmentType: TrainingAssessmentType | null;
  passMarkPercentage?: number;
  maxAttempts?: number;
  resourceLink: string;
  uploadedFileName: string;
  uploadedFileDataUrl?: string;
  convertedPdfUrl?: string;
  requiresAcknowledgement?: boolean;
  allowDownload?: boolean;
  /** Real video length in seconds, captured client-side when a video file is uploaded.
   *  Drives the dashboard's "Total Hours Spent" estimate for this step instead of a flat guess. */
  durationSeconds?: number;
  questions: TrainingAssessmentQuestion[];
};

export type TrainingAssessmentQuestion = {
  prompt: string;
  questionType: TrainingQuestionType;
  points: number;
  choices: TrainingAssessmentChoice[];
  matchingPairs: TrainingMatchingPair[];
  dragAndDropEnabled: boolean;
  attachmentFileName: string;
  attachmentDataUrl?: string;
};

export type TrainingAssessmentChoice = {
  text: string;
  points: number;
  isCorrect: boolean;
};

export type TrainingMatchingPair = {
  prompt: string;
  answer: string;
};

type LearnerSubmissionResult =
  | { ok: true }
  | { ok: false; message: string };

export type TrainingOffering = {
  id: string;
  title: string;
  type: TrainingOfferingType;
  category: string;
  description: string;
  completionDeadline: string;
  thumbnailDataUrl: string | null;
  contentItems: TrainingContentItem[];
  createdOn: string;
  status: 'Published' | 'Draft';
};

export type TrainingOfferingUpdate = {
  id: string;
  title: string;
  type: TrainingOfferingType;
  category: string;
  description: string;
  completionDeadline: string;
  status: TrainingOffering['status'];
  thumbnailDataUrl: string | null;
  contentItems?: TrainingContentItem[];
};

export type EnrollmentStudent = {
  id: string;
  name: string;
  surname: string;
  group: string;
  dateEnrolled: string;
  deadlineDate: string;
  email: string;
  jobTitle: string;
  idNumber: string;
  activeStatus: 'Active' | 'Inactive';
  department: string;
  lineManager: string;
  lineManagerId?: string;
  status: LearningStatus;
  assignedOfferingIds: string[];
  role: 'student' | 'manager';
  isAdmin: boolean;
  ofoCode?: string;
  race?: string;
  gender?: string;
  municipality?: string;
  dateOfBirth?: string;
  nqfLevel?: string;
};

export type EnrollmentStudentInput = Omit<EnrollmentStudent, 'id' | 'status' | 'assignedOfferingIds' | 'jobTitle' | 'idNumber' | 'lineManager'> & {
  jobTitle?: string;
  idNumber?: string;
  lineManager?: string;
};

export type ManagerDashboardCard = {
  label: string;
  value: string;
  detail: string;
  accent: string;
};

export type LearningActivityItem = {
  label: LearningStatus;
  count: number;
  color: string;
};

export type ManagerMessage = {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  unread: boolean;
  replies: ManagerMessageReply[];
};

export type ManagerMessageReply = {
  id: string;
  sender: string;
  body: string;
  time: string;
  authorType: 'manager' | 'contact';
  deliveryState?: 'Sent' | 'Delivered';
};

export type SubmissionReviewStatus = 'Pending Review' | 'Approved' | 'Needs Revision';
export type MentorshipReviewStatus = SubmissionReviewStatus;
export type AssignmentReviewStatus = SubmissionReviewStatus;

export type ExternalTrainingRequestStatus = SubmissionReviewStatus;

export type ExternalTrainingRequestRecord = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseName: string;
  provider: string;
  trainingType: 'Accredited' | 'Workshop/Seminar' | 'Informal Training' | 'Short Course';
  alignedToIdp: 'Yes' | 'No';
  trainingStartDate: string;
  trainingEndDate: string;
  courseCost: string;
  additionalCostRequired: 'Yes' | 'No';
  travelCost: string;
  examCost: string;
  accommodationCost: string;
  approvingManagerId: string;
  approvingManagerName: string;
  approvingManagerEmail: string;
  invoiceFileName: string;
  invoiceDataUrl: string;
  brochureFileName: string;
  brochureDataUrl: string;
  proofOfPaymentFileName: string;
  proofOfPaymentUrl: string;
  certificateFileName: string;
  certificateUrl: string;
  submittedAt: string;
  status: ExternalTrainingRequestStatus;
  reviewerName: string | null;
  reviewerFeedback: string;
  reviewedAt: string | null;
};

export type ExternalTrainingRequestCreateInput = {
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseName: string;
  provider: string;
  trainingType: 'Accredited' | 'Workshop/Seminar' | 'Informal Training' | 'Short Course';
  alignedToIdp: 'Yes' | 'No';
  trainingStartDate: string;
  trainingEndDate: string;
  courseCost: string;
  additionalCostRequired: 'Yes' | 'No';
  travelCost: string;
  examCost: string;
  accommodationCost: string;
  approvingManagerId: string;
  invoiceFileName: string;
  invoiceDataUrl: string;
  brochureFileName: string;
  brochureDataUrl: string;
};

export type ExternalTrainingRequestUpdateInput = ExternalTrainingRequestCreateInput & {
  requestId: string;
};

export type ExternalTrainingRequestReviewInput = {
  requestId: string;
  reviewerName: string;
  status: ExternalTrainingRequestStatus;
  feedback?: string;
};

export type ExternalTrainingRequestDocumentsInput = {
  requestId: string;
  invoiceFileName?: string;
  invoiceDataUrl?: string;
  proofOfPaymentFileName?: string;
  proofOfPaymentUrl?: string;
  certificateFileName?: string;
  certificateUrl?: string;
};

export type SuccessionReadinessRating = 'Ready Now' | 'Ready in 1-2 Years' | 'Ready in 3+ Years';
export type SuccessionNominationStatus = 'Draft' | 'Active' | 'Withdrawn';

export type SuccessionRoleRecord = {
  id: string;
  title: string;
  department: string;
  ownerManagerId: string;
  incumbentStudentId: string;
  createdOn: string;
};

export type SuccessionRoleInput = {
  incumbentStudentId: string;
};

export type SuccessionDevelopmentAction = {
  id: string;
  description: string;
  status: TrainingIdpStatus;
  targetDate?: string;
};

export type SuccessionCompetencyGap = {
  id: string;
  competency: string;
  notes?: string;
  developmentActions: SuccessionDevelopmentAction[];
};

export type SuccessorNominationRecord = {
  id: string;
  roleId: string;
  successorStudentId: string;
  nominatedByManagerId: string;
  readinessRating: SuccessionReadinessRating;
  readinessRationale?: string;
  competencyGaps: SuccessionCompetencyGap[];
  status: SuccessionNominationStatus;
  createdOn: string;
  updatedOn: string;
  activatedOn?: string;
  withdrawnOn?: string;
};

export type SuccessorNominationCreateInput = {
  roleId: string;
  successorStudentId: string;
  readinessRating: SuccessionReadinessRating;
  readinessRationale?: string;
};

export type SuccessorNominationUpdateInput = {
  readinessRating: SuccessionReadinessRating;
  readinessRationale?: string;
  competencyGaps: SuccessionCompetencyGap[];
};

export type MentorshipAssignmentRecord = {
  id: string;
  menteeId: string;
  menteeName: string;
  menteeSurname: string;
  mentorshipStartDate: string;
  jobTitle: string;
  mentorName: string;
  mentorSurname: string;
};

export type MentorshipSubmissionRecord = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseId?: string;
  offeringId: string;
  offeringTitle: string;
  assessmentId?: string;
  assessmentStepId?: string;
  assessmentTitle: string;
  mentorName: string;
  sessionDate: string;
  actionPlan: string;
  attemptsUsed?: number;
  submittedAt: string;
  status: MentorshipReviewStatus;
  reviewerName: string | null;
  reviewerFeedback: string;
  reviewedAt: string | null;
};

export type AssignmentSubmissionRecord = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseId?: string;
  offeringId: string;
  offeringTitle: string;
  assessmentId?: string;
  assessmentStepId?: string;
  assessmentTitle: string;
  questionType: 'Short Answer' | 'Long Answer' | 'Document Upload';
  responseText: string;
  documentFileName: string;
  documentDataUrl: string;
  possiblePoints: number;
  attemptsUsed?: number;
  awardedPoints: number | null;
  submittedAt: string;
  status: AssignmentReviewStatus;
  reviewerName: string | null;
  reviewerFeedback: string;
  reviewedAt: string | null;
};

@Injectable({ providedIn: 'root' })
export class TrainingManagerDataService {
  private static readonly offeringsStorageKey = 'lms-app.offerings';
  private static readonly studentsStorageKey = 'lms-app.students';
  private static readonly assignmentSubmissionsStorageKey = 'lms-app.assignment-submissions';
  private static readonly idpEntriesByStudentStorageKey = 'lms-app.idp-entries-by-student';
  private static readonly kpiEntriesByStudentStorageKey = 'lms-app.kpi-entries-by-student';

  private readonly backend = inject(LmsBackendService);
  private backendHydrated = false;

  /** Becomes true once offerings have been loaded from the backend (or its cache).
   *  Used by StudentDataService to avoid syncing courses before real data is available. */
  private readonly offeringsHydratedSignal = signal(false);
  readonly offeringsHydrated = this.offeringsHydratedSignal.asReadonly();

  private readonly offeringsSignal = signal<TrainingOffering[]>([]);
  private readonly trainingManagersSignal = signal<SystemTrainingManager[]>([]);

  // Show the real logged-in manager's own identity — falling back to the matching directory
  // entry above when this account is one of the known managers, otherwise deriving a display
  // name from the session so an admin (or any manager not in that list) sees their own info
  // instead of a hardcoded placeholder.
  private readonly profileSignal = signal<ManagerProfile>(this.resolveInitialManagerProfile());

  private readonly managerMessagesSignal = signal<ManagerMessage[]>([]);

  private readonly studentsSignal = signal<EnrollmentStudent[]>([]);

  private readonly mentorshipAssignmentsSignal = signal<MentorshipAssignmentRecord[]>([]);
  private readonly mentorshipSubmissionsSignal = signal<MentorshipSubmissionRecord[]>([]);
  private readonly assignmentSubmissionsSignal = signal<AssignmentSubmissionRecord[]>([]);
  private readonly externalTrainingRequestsSignal = signal<ExternalTrainingRequestRecord[]>([]);
  // Already scoped server-side (see getBootstrap): an admin gets every role/nomination, a manager
  // only those for roles they own.
  private readonly successionRolesSignal = signal<SuccessionRoleRecord[]>([]);
  private readonly successorNominationsSignal = signal<SuccessorNominationRecord[]>([]);
  private readonly idpEntriesByStudentSignal = signal<Record<string, StudentIdpEntry[]>>({});
  private readonly kpiEntriesByStudentSignal = signal<Record<string, StudentKpiEntry[]>>({});

  // The org-wide KPI review cycle: currentKpiYear is the only year anyone can edit; every year a
  // manager has ever opened (including the current one) is listed in kpiYearsOpened for building
  // a year selector. kpiEntriesByStudent above only ever holds the current year's entries — a
  // past year's entries are fetched on demand into kpiYearEntriesCacheSignal (see
  // kpiEntriesForStudentYear / fetchKpiEntriesForStudentYear) rather than loaded eagerly for
  // everyone, since that cache only ever grows as more years get opened.
  private readonly currentKpiYearSignal = signal<number>(new Date().getFullYear());
  private readonly kpiYearsOpenedSignal = signal<number[]>([new Date().getFullYear()]);
  private readonly kpiYearEntriesCacheSignal = signal<Record<string, Record<number, StudentKpiEntry[]>>>({});
  private readonly kpiYearFetchesInFlight = new Set<string>();

  // Timestamp of the last local write per student id, so a periodic bootstrap poll that was
  // already in flight when that write happened doesn't clobber it with stale data once the poll
  // resolves (see mergeServerAuthoritativeRecord) — this is what made a student's KPI self-score
  // "disappear" a few seconds after saving.
  private readonly idpEntriesDirtyAt: Record<string, number> = {};
  private readonly kpiEntriesDirtyAt: Record<string, number> = {};
  // Same reasoning, but for the students array as a whole rather than per-id — studentsSignal
  // (unlike idpEntriesByStudent/kpiEntriesByStudent) is merged via mergeServerAuthoritative, which
  // trusts the server's copy of any id it already knows about wholesale, with no per-item
  // staleness check at all. Without this, a poll already in flight when a manager assigns/
  // unassigns a course (or otherwise edits the roster) resolves afterward with the pre-edit
  // snapshot and silently reverts the edit in this session's own view — and since persistStudents
  // always PUTs the *entire* current students() array, the next unrelated roster edit re-sends
  // that reverted state and erases the original edit server-side too.
  private studentsDirtyAt: number | null = null;

  readonly profile = this.profileSignal.asReadonly();
  readonly offerings = this.offeringsSignal.asReadonly();
  readonly trainingManagers = computed(() => this.buildTrainingManagers());
  // The raw, admin-managed entries only — trainingManagers() above also folds in one synthesized
  // per role==='manager' student (see buildTrainingManagerFromStudent), which isn't a real record
  // that can be edited/deleted from here (editing one of those means editing the student instead).
  readonly explicitTrainingManagers = this.trainingManagersSignal.asReadonly();
  readonly managerMessages = this.managerMessagesSignal.asReadonly();
  readonly unreadManagerMessagesCount = computed(() => this.managerMessages().filter((message) => message.unread).length);
  readonly managerMessageRecipients = computed(() =>
    this.students()
      .map((student) => `${student.name} ${student.surname}`)
      .sort((left, right) => left.localeCompare(right)),
  );
  readonly students = this.studentsSignal.asReadonly();
  readonly mentorshipAssignments = computed(() =>
    [...this.mentorshipAssignmentsSignal()].sort((left, right) =>
      left.menteeName.localeCompare(right.menteeName) || left.menteeSurname.localeCompare(right.menteeSurname),
    ),
  );
  // The mentee's own line manager (a stable id, set by an admin) should always see their
  // mentee's mentorship activity, regardless of whether the student typed the mentor's name
  // correctly in the free-text mentor field. This resolves the current manager's own student
  // record id so it can be compared against a mentee's lineManagerId. Also reused by succession
  // planning to build "my team" (every student whose lineManagerId equals this).
  readonly currentManagerStudentId = computed(() => {
    const currentManagerEmail = this.profile().email.trim().toLowerCase();
    if (!currentManagerEmail) {
      return null;
    }

    return this.students().find((student) => student.email.trim().toLowerCase() === currentManagerEmail)?.id ?? null;
  });
  readonly mentorshipAssignmentsForCurrentManager = computed(() => {
    const currentManagerName = this.normalizePersonName(this.profile().name);
    const currentManagerStudentId = this.currentManagerStudentId();

    if (!currentManagerName && !currentManagerStudentId) {
      return this.mentorshipAssignments();
    }

    const menteesById = new Map(this.students().map((student) => [student.id, student]));

    return this.mentorshipAssignments().filter((assignment) => {
      const mentee = menteesById.get(assignment.menteeId);
      if (currentManagerStudentId && mentee?.lineManagerId === currentManagerStudentId) {
        return true;
      }

      return Boolean(currentManagerName)
        && this.normalizePersonName(`${assignment.mentorName} ${assignment.mentorSurname}`) === currentManagerName;
    });
  });
  readonly mentorshipSubmissions = computed(() =>
    [...this.mentorshipSubmissionsSignal()].sort((left, right) => right.submittedAt.localeCompare(left.submittedAt)),
  );
  readonly mentorshipSubmissionsForCurrentManager = computed(() => {
    const currentManagerName = this.normalizePersonName(this.profile().name);
    const currentManagerStudentId = this.currentManagerStudentId();

    if (!currentManagerName && !currentManagerStudentId) {
      return this.mentorshipSubmissions();
    }

    const menteesById = new Map(this.students().map((student) => [student.id, student]));
    const assignmentsByMenteeId = new Map(
      this.mentorshipAssignmentsSignal().map((assignment) => [
        assignment.menteeId,
        this.normalizePersonName(`${assignment.mentorName} ${assignment.mentorSurname}`),
      ]),
    );

    return this.mentorshipSubmissions().filter((submission) => {
      const mentee = menteesById.get(submission.studentId);
      if (currentManagerStudentId && mentee?.lineManagerId === currentManagerStudentId) {
        return true;
      }

      if (!currentManagerName) {
        return false;
      }

      const assignedMentorName = assignmentsByMenteeId.get(submission.studentId) ?? '';

      if (assignedMentorName) {
        return assignedMentorName === currentManagerName;
      }

      return this.normalizePersonName(submission.mentorName) === currentManagerName;
    });
  });
  readonly assignmentSubmissions = computed(() =>
    [...this.assignmentSubmissionsSignal()].sort((left, right) => right.submittedAt.localeCompare(left.submittedAt)),
  );
  readonly idpEntriesByStudent = this.idpEntriesByStudentSignal.asReadonly();
  readonly kpiEntriesByStudent = this.kpiEntriesByStudentSignal.asReadonly();
  readonly currentKpiYear = this.currentKpiYearSignal.asReadonly();
  readonly kpiYearsOpened = this.kpiYearsOpenedSignal.asReadonly();
  readonly externalTrainingRequests = computed(() =>
    [...this.externalTrainingRequestsSignal()].sort((left, right) => right.submittedAt.localeCompare(left.submittedAt)),
  );
  readonly pendingExternalTrainingRequestsCount = computed(() =>
    this.externalTrainingRequestsForCurrentManager().filter((request) => request.status === 'Pending Review').length,
  );
  readonly successionRoles = this.successionRolesSignal.asReadonly();
  readonly successorNominations = this.successorNominationsSignal.asReadonly();
  // Case/whitespace-insensitive match: a manager's login email (session-derived) and their
  // directory email (used as approvingManagerEmail on requests) are meant to be the same value,
  // but an exact === comparison would silently show zero requests if they ever drift apart
  // (e.g. trailing whitespace, differing casing from a manual edit).
  readonly externalTrainingRequestsForCurrentManager = computed(() => {
    const currentManagerEmail = this.profile().email.trim().toLowerCase();
    return this.externalTrainingRequests().filter((request) => request.approvingManagerEmail.trim().toLowerCase() === currentManagerEmail);
  });
  readonly mentorshipPendingCount = computed(() =>
    this.mentorshipSubmissionsForCurrentManager().filter((submission) => submission.status === 'Pending Review').length,
  );
  readonly mentorshipApprovedCount = computed(() =>
    this.mentorshipSubmissionsForCurrentManager().filter((submission) => submission.status === 'Approved').length,
  );
  readonly mentorshipNeedsRevisionCount = computed(() =>
    this.mentorshipSubmissionsForCurrentManager().filter((submission) => submission.status === 'Needs Revision').length,
  );

  readonly registeredStudentsCount = computed(() => this.students().length);
  readonly publishedCoursesCount = computed(() => this.offerings().filter((offering) => offering.status === 'Published').length);
  readonly programmesCount = computed(() => this.offerings().filter((offering) => offering.type === 'Programme').length);
  readonly assignedStudentsCount = computed(() => this.students().filter((student) => student.assignedOfferingIds.length > 0).length);

  readonly dashboardCards = computed<ManagerDashboardCard[]>(() => [
    {
      label: 'Students Registered',
      value: String(this.registeredStudentsCount()),
      detail: 'Active learners available for assignment right now.',
      accent: 'linear-gradient(90deg, #0f766e, #14b8a6)',
    },
    {
      label: 'Courses Published',
      value: String(this.publishedCoursesCount()),
      detail: 'Courses and programmes currently available in the manager workspace.',
      accent: 'linear-gradient(90deg, #1d4ed8, #38bdf8)',
    },
    {
      label: 'Students Assigned',
      value: String(this.assignedStudentsCount()),
      detail: 'Learners already mapped to at least one created offering.',
      accent: 'linear-gradient(90deg, #f59e0b, #f97316)',
    },
    {
      label: 'External Requests Pending',
      value: String(this.pendingExternalTrainingRequestsCount()),
      detail: 'External training requests waiting for this manager to review.',
      accent: 'linear-gradient(90deg, #7c3aed, #2563eb)',
    },
  ]);

  readonly learningActivity = computed<LearningActivityItem[]>(() => {
    const students = this.students();
    const countByStatus = (status: LearningStatus) => students.filter((student) => student.status === status).length;

    return [
      { label: 'Completed', count: countByStatus('Completed'), color: '#10b981' },
      { label: 'In Progress', count: countByStatus('In Progress'), color: '#3b82f6' },
      { label: 'Not Yet Started', count: countByStatus('Not Yet Started'), color: '#f59e0b' },
    ];
  });

  setIdpEntriesForStudent(studentId: string, entries: StudentIdpEntry[]) {
    const normalizedStudentId = studentId.trim();
    if (!normalizedStudentId) {
      return;
    }

    this.idpEntriesDirtyAt[normalizedStudentId] = Date.now();
    this.idpEntriesByStudentSignal.update((current) => {
      const next = {
        ...current,
        [normalizedStudentId]: entries.map((entry) => this.normalizeIdpEntry(entry)),
      };
      this.saveIdpEntriesByStudent(next);
      return next;
    });

    this.persistIdpEntriesToBackend(normalizedStudentId);
  }

  idpEntriesForStudent(studentId: string): StudentIdpEntry[] {
    return this.idpEntriesByStudentSignal()[studentId] ?? [];
  }

  // Manager-facing: full replace of a student's KPI table (add/remove rows, edit every field).
  setKpiEntriesForStudent(studentId: string, entries: StudentKpiEntry[]) {
    const normalizedStudentId = studentId.trim();
    if (!normalizedStudentId) {
      return;
    }

    this.kpiEntriesDirtyAt[normalizedStudentId] = Date.now();
    this.kpiEntriesByStudentSignal.update((current) => {
      const next = {
        ...current,
        [normalizedStudentId]: entries.map((entry) => this.normalizeKpiEntry(entry)),
      };
      this.saveKpiEntriesByStudent(next);
      return next;
    });

    this.persistKpiEntriesToBackend(normalizedStudentId);
  }

  kpiEntriesForStudent(studentId: string): StudentKpiEntry[] {
    return this.kpiEntriesByStudentSignal()[studentId] ?? [];
  }

  // The current year is always live (kpiEntriesByStudent, kept fresh by the periodic bootstrap
  // refresh); a past year is read-only and, once fetched, never changes again — so it's cached
  // indefinitely here rather than re-fetched every time a year selector lands back on it.
  kpiEntriesForStudentYear(studentId: string, year: number): StudentKpiEntry[] {
    if (year === this.currentKpiYearSignal()) {
      return this.kpiEntriesForStudent(studentId);
    }

    return this.kpiYearEntriesCacheSignal()[studentId]?.[year] ?? [];
  }

  // Populates the cache kpiEntriesForStudentYear reads from for a past year. Safe to call
  // whenever a year selector lands on a non-current year — no-ops if already cached or already
  // in flight, so a component doesn't need to track that itself.
  async fetchKpiEntriesForStudentYear(studentId: string, year: number): Promise<void> {
    if (year === this.currentKpiYearSignal()) {
      return;
    }

    if (this.kpiYearEntriesCacheSignal()[studentId]?.[year] !== undefined) {
      return;
    }

    const key = `${studentId}::${year}`;
    if (this.kpiYearFetchesInFlight.has(key)) {
      return;
    }

    this.kpiYearFetchesInFlight.add(key);
    try {
      const entries = await firstValueFrom(this.backend.getKpiEntriesForYear(studentId, year));
      this.kpiYearEntriesCacheSignal.update((current) => ({
        ...current,
        [studentId]: { ...(current[studentId] ?? {}), [year]: entries },
      }));
    } catch {
      // Leave uncached — the component can just re-select the year to retry.
    } finally {
      this.kpiYearFetchesInFlight.delete(key);
    }
  }

  // The manager-facing "open a new KPI year" action — org-wide, so this affects every student at
  // once. The server does all the real work (copies every student's current-year KPI definitions
  // forward with scores cleared; see repository.openKpiYear); this just adopts the new
  // currentKpiYear/kpiYearsOpened it returns and re-pulls bootstrap so kpiEntriesByStudent
  // reflects the new year for everyone, rather than trying to reconstruct that copy-forward
  // locally.
  async openKpiYear(year: number): Promise<{ success: true } | { success: false; message: string }> {
    try {
      await firstValueFrom(this.backend.openKpiYear(year));
      // Deliberately NOT setting currentKpiYearSignal/kpiYearsOpenedSignal from the response here
      // — refreshBootstrapState() below does that itself once the fresh (new-year, blank-scored)
      // entries actually land, and awaiting it before returning is what stops a caller from acting
      // on the new year before its data exists locally. Setting the signals early used to make
      // refreshBootstrapState's own "did the KPI year just change?" check (comparing the bootstrap
      // response's year against currentKpiYearSignal) see them as already equal, silently skipping
      // the safe "take the server's fresh data outright" branch in favour of the ordinary
      // dirty-timestamp merge — which assumes old and new data are the same logical table. That
      // let a manager who opened a new year, then immediately opened a student's KPI table before
      // the background refresh finished, load and resave the *previous* year's already-scored rows
      // under the new year.
      await this.refreshBootstrapState();
      return { success: true };
    } catch (error) {
      const message = error instanceof Object && 'error' in error && (error as { error?: { message?: string } }).error?.message
        ? (error as { error: { message: string } }).error.message
        : 'Failed to open the new KPI year.';
      return { success: false, message };
    }
  }

  // Manager-facing: merges only the three Performance Gap Analysis fields into existing KPI
  // rows — same shape as the employee-scoring endpoint this app used to have (see server.ts,
  // which keeps that endpoint and the employeeScoring field for historical data even though no
  // client calls it any more), just for the initiative/comments/target
  // date a manager records against a KPI rated 1 or 2. Staged and submitted as one batch by the
  // Performance Gap Analysis card in training-manager-profile.component.ts.
  updateKpiGapAnalysis(
    studentId: string,
    updates: { id: string; gapInitiative: string; gapComments: string; gapTargetDate: string }[],
  ): Promise<boolean> {
    const normalizedStudentId = studentId.trim();
    if (!normalizedStudentId || !updates.length) {
      return Promise.resolve(false);
    }

    const previousEntries = this.kpiEntriesByStudentSignal()[normalizedStudentId] ?? [];
    const updatesById = new Map(updates.map((update) => [update.id, update]));

    this.kpiEntriesDirtyAt[normalizedStudentId] = Date.now();
    this.kpiEntriesByStudentSignal.update((current) => {
      const next = {
        ...current,
        [normalizedStudentId]: previousEntries.map((entry) => {
          const update = updatesById.get(entry.id);
          return update
            ? { ...entry, gapInitiative: update.gapInitiative, gapComments: update.gapComments, gapTargetDate: update.gapTargetDate }
            : entry;
        }),
      };
      this.saveKpiEntriesByStudent(next);
      return next;
    });

    return new Promise<boolean>((resolve) => {
      this.backend.updateKpiGapAnalysis(normalizedStudentId, updates).subscribe({
        next: (entries) => {
          this.kpiEntriesDirtyAt[normalizedStudentId] = Date.now();
          this.kpiEntriesByStudentSignal.update((current) => {
            const next = { ...current, [normalizedStudentId]: entries };
            this.saveKpiEntriesByStudent(next);
            return next;
          });
          resolve(true);
        },
        error: () => {
          this.kpiEntriesByStudentSignal.update((current) => {
            const next = { ...current, [normalizedStudentId]: previousEntries };
            this.saveKpiEntriesByStudent(next);
            return next;
          });
          resolve(false);
        },
      });
    });
  }

  constructor() {
    this.hydrateOwnDisplayName();

    const localStudents = this.loadStudents();
    if (localStudents.length) {
      this.studentsSignal.set(localStudents);
    }

    const localIdpEntriesByStudent = this.loadIdpEntriesByStudent();
    this.idpEntriesByStudentSignal.set(localIdpEntriesByStudent);

    const localKpiEntriesByStudent = this.loadKpiEntriesByStudent();
    this.kpiEntriesByStudentSignal.set(localKpiEntriesByStudent);

    this.backend.getBootstrap().subscribe({
      next: (bootstrap) => {
        const mergedOfferings = this.mergeWithLocalOfferings(bootstrap.offerings);
        const mergedStudents = this.mergeWithLocalStudents(bootstrap.students);
        this.offeringsSignal.set(mergedOfferings);
        this.saveOfferings(mergedOfferings);
        this.studentsSignal.set(mergedStudents);
        this.saveStudents(mergedStudents);
        this.managerMessagesSignal.set(bootstrap.managerMessages);
        this.trainingManagersSignal.set(bootstrap.trainingManagers);
        this.mentorshipAssignmentsSignal.set(bootstrap.mentorshipAssignments);
        this.mentorshipSubmissionsSignal.set(bootstrap.mentorshipSubmissions);
        this.assignmentSubmissionsSignal.set(this.hydrateAssignmentSubmissions(bootstrap.assignmentSubmissions));
        this.externalTrainingRequestsSignal.set(bootstrap.externalTrainingRequests);
        this.successionRolesSignal.set(bootstrap.successionRoles ?? []);
        this.successorNominationsSignal.set(bootstrap.successorNominations ?? []);
        const backendIdpEntriesByStudent = this.normalizeIdpEntriesByStudent(bootstrap.idpEntriesByStudent);
        const mergedIdpEntriesByStudent = {
          ...localIdpEntriesByStudent,
          ...backendIdpEntriesByStudent,
        };
        this.idpEntriesByStudentSignal.set(mergedIdpEntriesByStudent);
        this.saveIdpEntriesByStudent(mergedIdpEntriesByStudent);
        const backendKpiEntriesByStudent = this.normalizeKpiEntriesByStudent(bootstrap.kpiEntriesByStudent);
        const mergedKpiEntriesByStudent = {
          ...localKpiEntriesByStudent,
          ...backendKpiEntriesByStudent,
        };
        this.kpiEntriesByStudentSignal.set(mergedKpiEntriesByStudent);
        this.saveKpiEntriesByStudent(mergedKpiEntriesByStudent);
        if (typeof bootstrap.currentKpiYear === 'number') {
          this.currentKpiYearSignal.set(bootstrap.currentKpiYear);
        }
        if (bootstrap.kpiYearsOpened?.length) {
          this.kpiYearsOpenedSignal.set(bootstrap.kpiYearsOpened);
        }
        this.backendHydrated = true;
        this.offeringsHydratedSignal.set(true);

        // Start polling for new messages after initial load.
        interval(15000).subscribe(() => this.refreshManagerMessages());
        // Also periodically refresh the rest of the bootstrap-loaded collections, which
        // otherwise never update again for the life of the session (see refreshBootstrapState).
        interval(20000).subscribe(() => this.refreshBootstrapState());
      },
      error: () => {
        const savedOfferings = this.loadOfferings();
        if (savedOfferings.length) {
          this.offeringsSignal.set(savedOfferings);
        }

        const savedStudents = this.loadStudents();
        if (savedStudents.length) {
          this.studentsSignal.set(savedStudents);
        }



        this.assignmentSubmissionsSignal.set(this.loadAssignmentSubmissions());

        this.backendHydrated = true;
        this.offeringsHydratedSignal.set(true);
      },
    });
  }

  readonly offeringAssignmentCounts = computed(() => {
    const counts = new Map<string, number>();

    for (const student of this.students()) {
      for (const offeringId of student.assignedOfferingIds) {
        counts.set(offeringId, (counts.get(offeringId) ?? 0) + 1);
      }
    }

    return counts;
  });

  createOffering(input: {
    title: string;
    type: TrainingOfferingType;
    category: string;
    description: string;
    completionDeadline: string;
    thumbnailDataUrl: string | null;
    contentItems: Array<{
      id?: string;
      kind: TrainingContentKind;
      title: string;
      assessmentType: TrainingAssessmentType | null;
      passMarkPercentage?: number;
      maxAttempts?: number;
      resourceLink: string;
      uploadedFileName: string;
      uploadedFileDataUrl?: string;
      convertedPdfUrl?: string;
      requiresAcknowledgement?: boolean;
      allowDownload?: boolean;
      durationSeconds?: number;
      questions: Array<{
        prompt: string;
        questionType: TrainingQuestionType;
        points: number;
        choices: Array<{
          text: string;
          points: number;
          isCorrect: boolean;
        }>;
        matchingPairs: Array<{
          prompt: string;
          answer: string;
        }>;
        dragAndDropEnabled: boolean;
        attachmentFileName: string;
        attachmentDataUrl: string;
      }>;
    }>;
  }): TrainingOffering | null {
    const normalizedTitle = input.title.trim();
    const normalizedCategory = input.category.trim();
    const normalizedDescription = input.description.trim();
    const normalizedContentItems = this.normalizeOfferingContentItems(input.contentItems, normalizedTitle);

    if (!normalizedTitle || !normalizedCategory || !normalizedDescription) {
      return null;
    }

    const offeringId = this.createUniqueOfferingId(normalizedTitle);

    const newOffering: TrainingOffering = {
      id: offeringId,
      title: normalizedTitle,
      type: input.type,
      category: normalizedCategory,
      description: normalizedDescription,
      completionDeadline: input.completionDeadline,
      thumbnailDataUrl: input.thumbnailDataUrl,
      contentItems: normalizedContentItems,
      createdOn: '06 Apr 2026',
      status: 'Published',
    };

    this.offeringsSignal.update((items) => [newOffering, ...items]);
    this.saveOfferings(this.offerings());

    this.backend.createOffering(newOffering).subscribe({
      next: (savedOffering) => {
        this.offeringsSignal.update((items) =>
          items.map((item) => {
            if (item.id !== savedOffering.id) return item;
            // Preserve local content data (data URLs) not stored in the backend
            return { ...savedOffering, contentItems: item.contentItems, thumbnailDataUrl: item.thumbnailDataUrl ?? savedOffering.thumbnailDataUrl };
          }),
        );
        this.saveOfferings(this.offerings());
      },
      error: () => {
        this.saveOfferings(this.offerings());
      },
    });

    return newOffering;
  }

  updateOffering(input: TrainingOfferingUpdate) {
    const normalizedTitle = input.title.trim();
    const normalizedCategory = input.category.trim();
    const normalizedDescription = input.description.trim();
    const normalizedContentItems = input.contentItems ? this.normalizeOfferingContentItems(input.contentItems, normalizedTitle) : undefined;

    if (!normalizedTitle || !normalizedCategory || !normalizedDescription) {
      return null;
    }

    let updatedOffering: TrainingOffering | null = null;
    this.offeringsSignal.update((items) =>
      items.map((item) =>
        item.id === input.id
          ? {
              ...item,
              title: normalizedTitle,
              type: input.type,
              category: normalizedCategory,
              description: normalizedDescription,
              completionDeadline: input.completionDeadline,
              status: input.status,
              thumbnailDataUrl: input.thumbnailDataUrl,
              contentItems: normalizedContentItems ?? item.contentItems,
            }
          : item,
      ),
    );
    updatedOffering = this.offerings().find((item) => item.id === input.id) ?? null;
    this.saveOfferings(this.offerings());

    this.backend.updateOffering({
      ...input,
      title: normalizedTitle,
      category: normalizedCategory,
      description: normalizedDescription,
      contentItems: normalizedContentItems,
    }).subscribe({
      next: (savedOffering) => {
        this.offeringsSignal.update((items) =>
          items.map((item) => {
            if (item.id !== savedOffering.id) return item;
            // Preserve local content data (data URLs) not stored in the backend
            return { ...savedOffering, contentItems: item.contentItems, thumbnailDataUrl: item.thumbnailDataUrl ?? savedOffering.thumbnailDataUrl };
          }),
        );
        this.saveOfferings(this.offerings());
      },
      error: () => {
        this.saveOfferings(this.offerings());
      },
    });

    return updatedOffering;
  }

  deleteOffering(offeringId: string) {
    const normalizedOfferingId = offeringId.trim();

    if (!normalizedOfferingId || !this.offerings().some((offering) => offering.id === normalizedOfferingId)) {
      return false;
    }

    this.offeringsSignal.update((items) => items.filter((item) => item.id !== normalizedOfferingId));
    this.studentsSignal.update((students) =>
      students.map((student) => {
        if (!student.assignedOfferingIds.includes(normalizedOfferingId)) {
          return student;
        }

        const assignedOfferingIds = student.assignedOfferingIds.filter((assignedId) => assignedId !== normalizedOfferingId);

        return {
          ...student,
          ...this.resolveAssignmentState(student, assignedOfferingIds),
        };
      }),
    );
    this.assignmentSubmissionsSignal.update((submissions) =>
      submissions.filter((submission) => submission.offeringId !== normalizedOfferingId),
    );
    this.mentorshipSubmissionsSignal.update((submissions) =>
      submissions.filter((submission) => submission.offeringId !== normalizedOfferingId),
    );

    this.saveOfferings(this.offerings());
    this.saveAssignmentSubmissions(this.assignmentSubmissionsSignal());
    // This also just optimistically edited every affected student's assignedOfferingIds locally
    // (above) ahead of the server's own independent cleanup of the same field — same staleness
    // guard as persistStudents, for the same reason.
    this.studentsDirtyAt = Date.now();

    if (this.backendHydrated) {
      this.backend.deleteOffering(normalizedOfferingId).subscribe({
        error: () => {
          // Keep local state if the API is temporarily unavailable.
        },
      });
    }

    return true;
  }

  private normalizeOfferingContentItems(
    contentItems: Array<{
      id?: string;
      kind: TrainingContentKind;
      title: string;
      assessmentType: TrainingAssessmentType | null;
      passMarkPercentage?: number;
      maxAttempts?: number;
      resourceLink: string;
      uploadedFileName: string;
      uploadedFileDataUrl?: string;
      convertedPdfUrl?: string;
      requiresAcknowledgement?: boolean;
      allowDownload?: boolean;
      durationSeconds?: number;
      questions: Array<{
        prompt: string;
        questionType: TrainingQuestionType;
        points: number;
        choices: Array<{
          text: string;
          points: number;
          isCorrect: boolean;
        }>;
        matchingPairs: Array<{
          prompt: string;
          answer: string;
        }>;
        dragAndDropEnabled: boolean;
        attachmentFileName: string;
        attachmentDataUrl?: string;
      }>;
    }>,
    normalizedTitle: string,
  ) {
    return contentItems
      .map((item, index) => {
        const normalizedResourceLink = item.resourceLink.trim();
        const normalizedUploadedDataUrl = item.uploadedFileDataUrl?.trim() ?? '';

        return {
        id: item.id?.trim() || `${this.slugify(normalizedTitle || `item-${index + 1}`)}-${index + 1}`,
        kind: item.kind,
        title: item.title.trim(),
        assessmentType: item.kind === 'Assessment' ? item.assessmentType ?? 'Quiz' : null,
        passMarkPercentage: item.kind === 'Assessment' ? this.normalizePassMarkPercentage(item.passMarkPercentage) : undefined,
        maxAttempts: item.kind === 'Assessment' ? this.normalizeMaxAttempts(item.maxAttempts) : undefined,
        resourceLink: normalizedResourceLink,
        uploadedFileName: item.uploadedFileName.trim(),
        // Prefer hosted links for persistence and keep data-URL fallback only for older records.
        uploadedFileDataUrl: normalizedResourceLink ? '' : normalizedUploadedDataUrl,
        convertedPdfUrl: item.convertedPdfUrl?.trim() || undefined,
        requiresAcknowledgement: item.kind === 'Document' ? Boolean(item.requiresAcknowledgement) : false,
        allowDownload: item.kind === 'Document' || item.kind === 'Scorm' ? item.allowDownload !== false : undefined,
        durationSeconds: item.kind === 'Video' && typeof item.durationSeconds === 'number' && item.durationSeconds > 0
          ? Math.round(item.durationSeconds)
          : undefined,
        questions: item.kind === 'Assessment'
          ? item.questions
              .map((question) => ({
                prompt: question.prompt.trim(),
                questionType: question.questionType,
                points: Math.max(1, Number(question.points) || 1),
                choices: question.questionType === 'Multiple Choice' || question.questionType === 'True or False'
                  ? question.choices
                      .map((choice) => ({
                        text: choice.text.trim(),
                        points: Math.max(0, Number(choice.points) || 0),
                        isCorrect: Boolean(choice.isCorrect),
                      }))
                      .filter((choice) => choice.text.length > 0)
                  : [],
                matchingPairs: question.questionType === 'Matching'
                  ? question.matchingPairs
                      .map((pair) => ({
                        prompt: pair.prompt.trim(),
                        answer: pair.answer.trim(),
                      }))
                      .filter((pair) => pair.prompt.length > 0 && pair.answer.length > 0)
                  : [],
                dragAndDropEnabled: question.questionType === 'Matching' ? Boolean(question.dragAndDropEnabled) : false,
                attachmentFileName: question.attachmentFileName.trim(),
                attachmentDataUrl: question.attachmentDataUrl?.trim() ?? '',
              }))
              .filter((question) => question.prompt.length > 0)
          : [],
          };
          })
      .filter((item) => item.title.length > 0);
  }

  private normalizePassMarkPercentage(value: number | undefined) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return undefined;
    }

    return Math.min(100, Math.max(1, Math.round(value)));
  }

  private normalizeMaxAttempts(value: number | undefined) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return undefined;
    }

    return Math.max(1, Math.round(value));
  }

  assignStudentToOffering(studentId: string, offeringId: string) {
    const assignedOffering = this.offerings().find((offering) => offering.id === offeringId);

    this.studentsSignal.update((students) =>
      students.map((student) => {
        if (student.id !== studentId || student.assignedOfferingIds.includes(offeringId)) {
          return student;
        }

        const assignedOfferingIds = [...student.assignedOfferingIds, offeringId];

        return {
          ...student,
          ...this.resolveAssignmentState(student, assignedOfferingIds, assignedOffering?.completionDeadline),
        };
      }),
    );

    this.persistStudents();
  }

  removeStudentFromOffering(studentId: string, offeringId: string) {
    let removedCount = 0;

    this.studentsSignal.update((students) =>
      students.map((student) => {
        if (student.id !== studentId || !student.assignedOfferingIds.includes(offeringId)) {
          return student;
        }

        removedCount += 1;
        const assignedOfferingIds = student.assignedOfferingIds.filter((assignedId) => assignedId !== offeringId);

        return {
          ...student,
          ...this.resolveAssignmentState(student, assignedOfferingIds),
        };
      }),
    );

    this.persistStudents();

    return removedCount;
  }

  updateStudent(studentId: string, input: EnrollmentStudentInput) {
    const normalizedName = input.name.trim();
    const normalizedSurname = input.surname.trim();
    const normalizedGroup = input.group.trim();
    const normalizedEmail = input.email.trim();
    const normalizedDepartment = input.department.trim();

    if (
      !normalizedName ||
      !normalizedSurname ||
      !normalizedGroup ||
      !input.dateEnrolled ||
      !input.deadlineDate ||
      !normalizedEmail ||
      !normalizedDepartment
    ) {
      return;
    }

    this.studentsSignal.update((students) =>
      students.map((student) =>
        student.id === studentId
          ? {
              ...student,
              name: normalizedName,
              surname: normalizedSurname,
              group: normalizedGroup,
              dateEnrolled: input.dateEnrolled,
              deadlineDate: input.deadlineDate,
              email: normalizedEmail,
              jobTitle: input.jobTitle === undefined ? student.jobTitle : input.jobTitle.trim(),
              idNumber: input.idNumber === undefined ? student.idNumber : input.idNumber.trim(),
              activeStatus: input.activeStatus,
              department: normalizedDepartment,
              lineManager: input.lineManager === undefined ? student.lineManager : input.lineManager.trim(),
              lineManagerId: input.lineManagerId === undefined ? student.lineManagerId : (input.lineManagerId.trim() || undefined),
              ofoCode: input.ofoCode === undefined ? student.ofoCode : input.ofoCode.trim(),
              race: input.race === undefined ? student.race : input.race.trim(),
              gender: input.gender === undefined ? student.gender : input.gender.trim(),
              municipality: input.municipality === undefined ? student.municipality : input.municipality.trim(),
              dateOfBirth: input.dateOfBirth === undefined ? student.dateOfBirth : input.dateOfBirth.trim(),
              nqfLevel: input.nqfLevel === undefined ? student.nqfLevel : input.nqfLevel.trim(),
              role: input.role,
              isAdmin: input.isAdmin,
            }
          : student,
      ),
    );

    this.persistStudents();
  }

  bulkUpsertStudents(inputs: EnrollmentStudentInput[]) {
    const normalizedInputs = inputs
      .map((input) => this.normalizeStudentInput(input))
      .filter((input): input is EnrollmentStudentInput => input !== null);

    if (!normalizedInputs.length) {
      return { added: 0, updated: 0, skipped: inputs.length };
    }

    let added = 0;
    let updated = 0;

    this.studentsSignal.update((students) => {
      const nextStudents = [...students];
      const studentsByEmail = new Map(nextStudents.map((student) => [student.email.toLowerCase(), student]));
      const usedIds = new Set(nextStudents.map((student) => student.id));

      for (const input of normalizedInputs) {
        const emailKey = input.email.toLowerCase();
        const existing = studentsByEmail.get(emailKey);

        if (existing) {
          const existingIndex = nextStudents.findIndex((student) => student.id === existing.id);
          if (existingIndex >= 0) {
            nextStudents[existingIndex] = {
              ...existing,
              ...input,
            };
            studentsByEmail.set(emailKey, nextStudents[existingIndex]);
            updated += 1;
          }

          continue;
        }

        const id = this.createUniqueStudentId(input, usedIds);
        usedIds.add(id);

        const newStudent: EnrollmentStudent = {
          id,
          ...input,
          jobTitle: input.jobTitle?.trim() ?? '',
          idNumber: input.idNumber?.trim() ?? '',
          status: 'Not Yet Started',
          assignedOfferingIds: [],
          lineManager: input.lineManager?.trim() ?? '',
          ...(input.lineManagerId?.trim() ? { lineManagerId: input.lineManagerId.trim() } : {}),
          ofoCode: input.ofoCode?.trim() ?? '',
          race: input.race?.trim() ?? '',
          gender: input.gender?.trim() ?? '',
          municipality: input.municipality?.trim() ?? '',
        };

        nextStudents.push(newStudent);
        studentsByEmail.set(emailKey, newStudent);
        added += 1;
      }

      return nextStudents;
    });

    this.persistStudents();

    return {
      added,
      updated,
      skipped: inputs.length - normalizedInputs.length,
    };
  }

  deleteStudent(studentId: string) {
    const normalizedStudentId = studentId.trim();

    if (!normalizedStudentId) {
      return;
    }

    this.studentsSignal.update((students) =>
      students.filter((student) => student.id !== normalizedStudentId),
    );

    this.persistStudents();
  }

  removeGroupFromOffering(groupName: string, offeringId: string) {
    const normalizedGroupName = groupName.trim();

    if (!normalizedGroupName) {
      return 0;
    }

    let removedCount = 0;

    this.studentsSignal.update((students) =>
      students.map((student) => {
        if (student.group !== normalizedGroupName || !student.assignedOfferingIds.includes(offeringId)) {
          return student;
        }

        removedCount += 1;
        const assignedOfferingIds = student.assignedOfferingIds.filter((assignedId) => assignedId !== offeringId);

        return {
          ...student,
          ...this.resolveAssignmentState(student, assignedOfferingIds),
        };
      }),
    );

    this.persistStudents();

    return removedCount;
  }

  updateGroup(groupName: string, input: { name: string; startDate: string; endDate: string; additionalStudentIds?: string[]; removedStudentIds?: string[] }) {
    const normalizedCurrentName = groupName.trim();
    const normalizedNextName = input.name.trim();
    const additionalStudentIds = new Set(input.additionalStudentIds ?? []);
    const removedStudentIds = new Set(input.removedStudentIds ?? []);

    if (!normalizedCurrentName || !normalizedNextName || !input.startDate || !input.endDate) {
      return;
    }

    this.studentsSignal.update((students) =>
      students.map((student) =>
        removedStudentIds.has(student.id)
          ? {
              ...student,
              group: 'Ungrouped',
            }
          : student.group === normalizedCurrentName || additionalStudentIds.has(student.id)
          ? {
              ...student,
              group: normalizedNextName,
              dateEnrolled: input.startDate,
              deadlineDate: input.endDate,
            }
          : student,
      ),
    );

    this.persistStudents();
  }

  createGroup(input: { name: string; startDate: string; endDate: string; studentIds: string[] }) {
    const normalizedName = input.name.trim();
    const studentIds = new Set(input.studentIds);

    if (!normalizedName || !input.startDate || !input.endDate || studentIds.size === 0) {
      return;
    }

    this.studentsSignal.update((students) =>
      students.map((student) =>
        studentIds.has(student.id)
          ? {
              ...student,
              group: normalizedName,
              dateEnrolled: input.startDate,
              deadlineDate: input.endDate,
            }
          : student,
      ),
    );

    this.persistStudents();
  }

  deleteGroup(groupName: string) {
    const normalizedGroupName = groupName.trim();

    if (!normalizedGroupName) {
      return;
    }

    this.studentsSignal.update((students) =>
      students.map((student) =>
        student.group === normalizedGroupName
          ? {
              ...student,
              group: 'Ungrouped',
            }
          : student,
      ),
    );

    this.persistStudents();
  }

  offeringsForStudent(student: EnrollmentStudent) {
    const assignments = new Set(student.assignedOfferingIds);
    return this.offerings().filter((offering) => assignments.has(offering.id));
  }

  offeringsForGroup(students: EnrollmentStudent[]) {
    const assignments = new Set(students.flatMap((student) => student.assignedOfferingIds));
    return this.offerings().filter((offering) => assignments.has(offering.id));
  }

  markManagerMessageRead(messageId: string) {
    this.managerMessagesSignal.update((messages) =>
      messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              unread: false,
            }
          : message,
      ),
    );

    this.persistManagerMessages();
  }

  sendManagerMessage(recipient: string, subject: string, message: string) {
    const normalizedRecipient = recipient.trim();
    const normalizedSubject = subject.trim();
    const normalizedMessage = message.trim();

    if (!normalizedRecipient || !normalizedSubject || !normalizedMessage) {
      return;
    }

    this.managerMessagesSignal.update((messages) => [
      {
        id: `manager-message-${Date.now()}`,
        sender: `To: ${normalizedRecipient}`,
        subject: normalizedSubject,
        preview: normalizedMessage,
        body: normalizedMessage,
        time: 'Just now',
        unread: false,
        replies: [],
      },
      ...messages,
    ]);

    this.persistManagerMessages();
    this.deliverManagerMessageToStudent(normalizedRecipient, normalizedSubject, normalizedMessage);
  }

  replyToManagerMessage(messageId: string, message: string) {
    const normalizedMessage = message.trim();

    if (!normalizedMessage) {
      return;
    }

    this.managerMessagesSignal.update((messages) =>
      messages.map((item) =>
        item.id === messageId
          ? {
              ...item,
              replies: [
                ...item.replies,
                {
                  id: `${messageId}-reply-${Date.now()}`,
                  sender: this.profile().name,
                  body: normalizedMessage,
                  time: 'Just now',
                  authorType: 'manager',
                  deliveryState: 'Sent',
                },
              ],
            }
          : item,
      ),
    );

    this.persistManagerMessages();

    // Deliver the manager's reply to the student's snapshot so the learner can see it.
    const originalThread = this.managerMessagesSignal().find((m) => m.id === messageId);
    if (originalThread) {
      this.deliverManagerReplyToStudent(originalThread.sender, originalThread.subject, normalizedMessage);
    }
  }

  private deliverManagerReplyToStudent(studentName: string, subject: string, message: string) {
    const student = this.findStudentByMessageRecipient(studentName);

    if (!student) {
      return;
    }

    const normalizedSubject = subject.trim().toLocaleLowerCase();

    this.backend.getStudentSnapshot(student.id).subscribe({
      next: (snapshot) => {
        const threadIndex = snapshot.messages.findIndex(
          (m) => m.subject.trim().toLocaleLowerCase() === normalizedSubject,
        );

        if (threadIndex === -1) {
          return;
        }

        const thread = snapshot.messages[threadIndex];
        const reply = {
          id: `${thread.id}-reply-${Date.now()}`,
          sender: this.profile().name,
          body: message,
          time: 'Just now',
          authorType: 'contact' as const,
          deliveryState: 'Delivered' as const,
        };

        const updatedMessages = snapshot.messages.map((m, i) =>
          i === threadIndex ? { ...m, unread: true, replies: [...m.replies, reply] } : m,
        );

        this.backend.updateStudentSnapshot({ ...snapshot, messages: updatedMessages }, student.id).subscribe({
          error: () => {
            // Non-critical — manager reply is already recorded on the manager side.
          },
        });
      },
      error: () => {
        // Ignore if student snapshot is unavailable.
      },
    });
  }

  createMentorshipAssignment(input: {
    menteeId: string;
    mentorshipStartDate: string;
    jobTitle: string;
    mentorName: string;
    mentorSurname: string;
  }) {
    const mentee = this.students().find((student) => student.id === input.menteeId.trim());
    const mentorshipStartDate = input.mentorshipStartDate;
    const jobTitle = input.jobTitle.trim();
    const mentorName = input.mentorName.trim();
    const mentorSurname = input.mentorSurname.trim();

    if (!mentee || !mentorshipStartDate || !jobTitle || !mentorName || !mentorSurname) {
      return;
    }

    const existingAssignment = this.mentorshipAssignmentsSignal().find((assignment) => assignment.menteeId === mentee.id);

    if (existingAssignment) {
      this.updateMentorshipAssignment(existingAssignment.id, {
        menteeId: mentee.id,
        mentorshipStartDate,
        jobTitle,
        mentorName,
        mentorSurname,
      });
      return;
    }

    this.mentorshipAssignmentsSignal.update((assignments) => [
      {
        id: `mentorship-assignment-${mentee.id}`,
        menteeId: mentee.id,
        menteeName: mentee.name,
        menteeSurname: mentee.surname,
        mentorshipStartDate,
        jobTitle,
        mentorName,
        mentorSurname,
      },
      ...assignments,
    ]);

    this.persistMentorshipAssignments();
  }

  createBulkMentorshipAssignments(input: { menteeIds: string[] }) {
    const uniqueMenteeIds = Array.from(new Set(input.menteeIds.map((menteeId) => menteeId.trim()).filter(Boolean)));

    if (!uniqueMenteeIds.length) {
      return;
    }

    const today = new Date();
    const mentorshipStartDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (const menteeId of uniqueMenteeIds) {
      const mentee = this.students().find((student) => student.id === menteeId);
      const existingAssignment = this.mentorshipAssignmentsSignal().find((assignment) => assignment.menteeId === menteeId);

      if (!mentee || existingAssignment) {
        continue;
      }

      this.mentorshipAssignmentsSignal.update((assignments) => [
        {
          id: `mentorship-assignment-${mentee.id}`,
          menteeId: mentee.id,
          menteeName: mentee.name,
          menteeSurname: mentee.surname,
          mentorshipStartDate,
          jobTitle: mentee.jobTitle,
          mentorName: '',
          mentorSurname: '',
        },
        ...assignments,
      ]);
    }

    this.persistMentorshipAssignments();
  }

  updateMentorshipAssignment(assignmentId: string, input: {
    menteeId: string;
    mentorshipStartDate: string;
    jobTitle: string;
    mentorName: string;
    mentorSurname: string;
  }) {
    const normalizedAssignmentId = assignmentId.trim();
    const mentee = this.students().find((student) => student.id === input.menteeId.trim());
    const mentorshipStartDate = input.mentorshipStartDate;
    const jobTitle = input.jobTitle.trim();
    const mentorName = input.mentorName.trim();
    const mentorSurname = input.mentorSurname.trim();

    if (!normalizedAssignmentId || !mentee || !mentorshipStartDate || !jobTitle || !mentorName || !mentorSurname) {
      return;
    }

    this.mentorshipAssignmentsSignal.update((assignments) =>
      assignments.map((assignment) =>
        assignment.id === normalizedAssignmentId
          ? {
              ...assignment,
              menteeId: mentee.id,
              menteeName: mentee.name,
              menteeSurname: mentee.surname,
              mentorshipStartDate,
              jobTitle,
              mentorName,
              mentorSurname,
            }
          : assignment,
      ),
    );

    this.persistMentorshipAssignments();
  }

  deleteMentorshipAssignment(assignmentId: string) {
    const normalizedAssignmentId = assignmentId.trim();

    if (!normalizedAssignmentId) {
      return;
    }

    this.mentorshipAssignmentsSignal.update((assignments) =>
      assignments.filter((assignment) => assignment.id !== normalizedAssignmentId),
    );

    this.persistMentorshipAssignments();
  }

  mentorshipSubmissionForStudentOffering(studentId: string, offeringId: string, assessmentStepId?: string, includeLegacyFallback = true) {
    const submissions = this.mentorshipSubmissionsSignal().filter((submission) => submission.studentId === studentId && submission.offeringId === offeringId);
    if (!assessmentStepId) {
      return submissions[0] ?? null;
    }

    const matchingSubmission = submissions.find((submission) => submission.assessmentStepId === assessmentStepId);
    if (matchingSubmission) {
      return matchingSubmission;
    }

    return includeLegacyFallback
      ? submissions.find((submission) => !submission.assessmentStepId) ?? null
      : null;
  }

  assignmentSubmissionForStudentOffering(studentId: string, offeringId: string, assessmentStepId?: string, includeLegacyFallback = true) {
    const submissions = this.assignmentSubmissionsSignal().filter((submission) => submission.studentId === studentId && submission.offeringId === offeringId);
    if (!assessmentStepId) {
      return submissions[0] ?? null;
    }

    const matchingSubmission = submissions.find((submission) => submission.assessmentStepId === assessmentStepId);
    if (matchingSubmission) {
      return matchingSubmission;
    }

    return includeLegacyFallback
      ? submissions.find((submission) => !submission.assessmentStepId) ?? null
      : null;
  }

  submitMentorshipSubmission(input: {
    studentId: string;
    offeringId: string;
    assessmentStepId?: string;
    assessmentTitle?: string;
    mentorName: string;
    sessionDate: string;
    actionPlan: string;
  }): LearnerSubmissionResult {
    const student = this.students().find((item) => item.id === input.studentId);
    const offering = this.offerings().find((item) => item.id === input.offeringId);
    const mentorshipStep = this.findAssessmentStep(offering, 'Mentorship', input.assessmentStepId);
    const mentorName = input.mentorName.trim();
    const sessionDate = input.sessionDate.trim();
    const actionPlan = input.actionPlan.trim();
    const assessmentStepId = input.assessmentStepId?.trim() ?? '';
    const assessmentTitle = input.assessmentTitle?.trim() || mentorshipStep?.item.title || '';

    if (!student || !offering || !mentorshipStep || !assessmentTitle) {
      return {
        ok: false,
        message: 'This mentorship response could not be submitted right now. Refresh the course and try again.',
      };
    }

    if (!mentorName || !sessionDate || !actionPlan) {
      return {
        ok: false,
        message: 'Complete the mentor name, session date, and action plan before submitting.',
      };
    }

    const submittedAt = this.formatDisplayDate(new Date());
    const maxAttempts = this.normalizeMaxAttempts(mentorshipStep.item.maxAttempts);
    let submissionRejected = false;

    this.mentorshipSubmissionsSignal.update((submissions) => {
      const existingSubmission = submissions.find((submission) =>
        submission.studentId === student.id
        && submission.offeringId === offering.id
        && (submission.assessmentStepId ?? '') === assessmentStepId,
      );
      const nextAttemptsUsed = (existingSubmission ? existingSubmission.attemptsUsed ?? 1 : 0) + 1;
      const recordIdSuffix = assessmentStepId.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'default';

      if (maxAttempts !== undefined && nextAttemptsUsed > maxAttempts) {
        submissionRejected = true;
        return submissions;
      }

      if (!existingSubmission) {
        return [
          {
            id: `mentorship-${student.id}-${offering.id}-${recordIdSuffix}`,
            studentId: student.id,
            studentName: `${student.name} ${student.surname}`,
            studentEmail: student.email,
            courseId: offering.id,
            offeringId: offering.id,
            offeringTitle: offering.title,
            assessmentId: mentorshipStep.stepId,
            assessmentStepId: assessmentStepId || undefined,
            assessmentTitle,
            mentorName,
            sessionDate,
            actionPlan,
            attemptsUsed: nextAttemptsUsed,
            submittedAt,
            status: 'Pending Review',
            reviewerName: null,
            reviewerFeedback: '',
            reviewedAt: null,
          },
          ...submissions,
        ];
      }

      return submissions.map((submission) =>
        submission.id === existingSubmission.id
          ? {
              ...submission,
              courseId: offering.id,
              assessmentId: mentorshipStep.stepId,
              assessmentStepId: assessmentStepId || undefined,
              assessmentTitle,
              mentorName,
              sessionDate,
              actionPlan,
              attemptsUsed: nextAttemptsUsed,
              submittedAt,
              status: 'Pending Review',
              reviewerName: null,
              reviewerFeedback: '',
              reviewedAt: null,
            }
          : submission,
      );
    });

    if (submissionRejected) {
      return {
        ok: false,
        message: 'No attempts remain for this mentorship response.',
      };
    }

    this.persistMentorshipSubmissions();
    return { ok: true };
  }

  submitMentorshipFormSubmission(input: {
    studentId: string;
    studentName: string;
    studentEmail: string;
    mentorName: string;
    formId: 'profile' | 'objectives' | 'progress-report';
    formTitle: string;
    actionPlan: string;
    sessionDate?: string;
    profileData?: {
      jobTitle: string;
      mentorName: string;
      mentorSurname: string;
    };
  }) {
    const studentId = input.studentId.trim();
    const student = this.students().find((item) => item.id === studentId);
    const studentName = student ? `${student.name} ${student.surname}` : input.studentName.trim();
    const studentEmail = student?.email ?? input.studentEmail.trim();
    const mentorName = input.mentorName.trim();
    const formId = input.formId.trim();
    const formTitle = input.formTitle.trim();
    const actionPlan = input.actionPlan.trim();
    const submittedAt = this.formatDisplayDate(new Date());
    const sessionDate = input.sessionDate?.trim() || submittedAt;
    const mentorshipFormsOfferingId = 'mentorship-workspace-forms';

    if (!studentId || !studentName || !studentEmail || !mentorName || !formId || !formTitle || !actionPlan) {
      return;
    }

    const nextSubmission: MentorshipSubmissionRecord = {
      id: `mentorship-form-${studentId}-${formId}`,
      studentId,
      studentName,
      studentEmail,
      courseId: mentorshipFormsOfferingId,
      offeringId: mentorshipFormsOfferingId,
      offeringTitle: 'Mentorship Workspace',
      assessmentId: `mentorship-form-${formId}`,
      assessmentStepId: `mentorship-form-${formId}`,
      assessmentTitle: formTitle,
      mentorName,
      sessionDate,
      actionPlan,
      submittedAt,
      status: 'Pending Review',
      reviewerName: null,
      reviewerFeedback: '',
      reviewedAt: null,
    };

    this.mentorshipSubmissionsSignal.update((submissions) => {
      const existingSubmission = submissions.find((submission) => submission.id === nextSubmission.id);

      if (!existingSubmission) {
        return [nextSubmission, ...submissions];
      }

      return submissions.map((submission) =>
        submission.id === existingSubmission.id ? nextSubmission : submission,
      );
    });

    this.persistMentorshipSubmissions();

    // When the mentorship profile form is saved, upsert the corresponding
    // mentorship assignment row so the manager's mentorship tab always shows
    // the latest mentee + mentor details.
    if (input.formId === 'profile' && input.profileData) {
      const profileData = input.profileData;
      const jobTitle = profileData.jobTitle.trim() || student?.jobTitle?.trim() || '';
      const mentorName = profileData.mentorName.trim();
      const mentorSurname = profileData.mentorSurname.trim();

      if (jobTitle && mentorName && mentorSurname) {
        const today = new Date();
        const mentorshipStartDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        this.createMentorshipAssignment({
          menteeId: studentId,
          mentorshipStartDate,
          jobTitle,
          mentorName,
          mentorSurname,
        });
      }
    }
  }

  async submitAssignmentSubmission(input: {
    studentId: string;
    offeringId: string;
    assessmentStepId?: string;
    assessmentTitle?: string;
    questionType: 'Short Answer' | 'Long Answer' | 'Document Upload';
    responseText?: string;
    documentFileName?: string;
    documentDataUrl?: string;
  }): Promise<LearnerSubmissionResult> {
    const student = this.students().find((item) => item.id === input.studentId);
    const offering = this.offerings().find((item) => item.id === input.offeringId);
    const assignmentStep = this.findAssessmentStep(offering, 'Assignment', input.assessmentStepId);
    const assignmentItem = assignmentStep?.item;
    const assignmentQuestion = assignmentStep?.question;
    const responseText = input.responseText?.trim() ?? '';
    const documentFileName = input.documentFileName?.trim() ?? '';
    const documentDataUrl = input.documentDataUrl?.trim() ?? '';
    const assessmentStepId = input.assessmentStepId?.trim() ?? '';
    const assessmentTitle = input.assessmentTitle?.trim() || assignmentItem?.title || '';

    if (!student || !offering || !assignmentItem || !assignmentQuestion || !assessmentTitle) {
      return {
        ok: false,
        message: 'This assignment could not be submitted right now. Refresh the course and try again.',
      };
    }

    if (
      assignmentQuestion.questionType !== 'Short Answer'
      && assignmentQuestion.questionType !== 'Long Answer'
      && assignmentQuestion.questionType !== 'Document Upload'
    ) {
      return {
        ok: false,
        message: 'This assignment question is not supported for learner submissions yet.',
      };
    }

    if (assignmentQuestion.questionType !== input.questionType) {
      return {
        ok: false,
        message: 'This assignment no longer matches the latest course version. Refresh the course and try again.',
      };
    }

    if ((input.questionType === 'Short Answer' || input.questionType === 'Long Answer') && !responseText) {
      return {
        ok: false,
        message: 'Enter your assignment response before submitting.',
      };
    }

    if (input.questionType === 'Document Upload' && (!documentFileName || !documentDataUrl)) {
      return {
        ok: false,
        message: 'Choose a document before submitting this assignment.',
      };
    }

    const submittedAt = this.formatDisplayDate(new Date());
    const maxAttempts = this.normalizeMaxAttempts(assignmentItem.maxAttempts);
    const existingSubmission = this.assignmentSubmissionsSignal().find((submission) =>
      submission.studentId === student.id
      && submission.offeringId === offering.id
      && (submission.assessmentStepId ?? '') === assessmentStepId,
    );
    const nextAttemptsUsed = (existingSubmission ? existingSubmission.attemptsUsed ?? 1 : 0) + 1;

    if (maxAttempts !== undefined && nextAttemptsUsed > maxAttempts) {
      return {
        ok: false,
        message: 'No attempts remain for this assignment.',
      };
    }

    const recordIdSuffix = assessmentStepId.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'default';

    const nextSubmission: AssignmentSubmissionRecord = {
      id: existingSubmission?.id ?? `assignment-${student.id}-${offering.id}-${recordIdSuffix}`,
      studentId: student.id,
      studentName: `${student.name} ${student.surname}`,
      studentEmail: student.email,
      courseId: offering.id,
      offeringId: offering.id,
      offeringTitle: offering.title,
      assessmentId: assignmentStep.stepId,
      assessmentStepId: assessmentStepId || undefined,
      assessmentTitle,
      questionType: input.questionType,
      responseText: input.questionType === 'Short Answer' || input.questionType === 'Long Answer' ? responseText : '',
      documentFileName: input.questionType === 'Document Upload' ? documentFileName : '',
      documentDataUrl: input.questionType === 'Document Upload' ? documentDataUrl : '',
      possiblePoints: assignmentQuestion.points,
      attemptsUsed: nextAttemptsUsed,
      awardedPoints: null,
      submittedAt,
      status: 'Pending Review',
      reviewerName: null,
      reviewerFeedback: '',
      reviewedAt: null,
    };

    const previousSubmissions = this.assignmentSubmissionsSignal();
    const nextSubmissions = !existingSubmission
      ? [nextSubmission, ...previousSubmissions]
      : previousSubmissions.map((submission) =>
      submission.id === existingSubmission.id ? nextSubmission : submission,
    );

    this.assignmentSubmissionsSignal.set(nextSubmissions);
    this.saveAssignmentSubmissions(nextSubmissions);

    const saved = await this.persistAssignmentSubmission(nextSubmission);
    if (!saved) {
      this.assignmentSubmissionsSignal.set(previousSubmissions);
      this.saveAssignmentSubmissions(previousSubmissions);
      return { ok: false, message: 'Your assignment could not be submitted. Please check your connection and try again.' };
    }

    return { ok: true };
  }

  private findAssessmentStep(
    offering: TrainingOffering | undefined,
    assessmentType: 'Assignment' | 'Mentorship',
    assessmentStepId?: string,
  ) {
    if (!offering) {
      return null;
    }

    const normalizedStepId = assessmentStepId?.trim() ?? '';
    for (let itemIndex = 0; itemIndex < offering.contentItems.length; itemIndex += 1) {
      const item = offering.contentItems[itemIndex];
      if (item.kind !== 'Assessment' || item.assessmentType !== assessmentType) {
        continue;
      }

      if (!item.questions.length) {
        continue;
      }

      for (let questionIndex = 0; questionIndex < item.questions.length; questionIndex += 1) {
        const question = item.questions[questionIndex];
        const stepId = this.createAssessmentStepId(offering.id, item.id, itemIndex, questionIndex);
        if (!normalizedStepId || stepId === normalizedStepId) {
          return { item, question, stepId };
        }
      }
    }

    return null;
  }

  private createAssessmentStepId(offeringId: string, itemId: string, itemIndex: number, questionIndex: number) {
    const baseId = itemId || `${offeringId}-assessment-${itemIndex + 1}`;
    return `${baseId}-question-${questionIndex + 1}`;
  }

  async reviewAssignmentSubmission(input: {
    submissionId: string;
    reviewerName: string;
    status: AssignmentReviewStatus;
    feedback: string;
    awardedPoints: number | null;
  }): Promise<LearnerSubmissionResult> {
    const submissionId = input.submissionId.trim();
    const reviewerName = input.reviewerName.trim();
    const feedback = input.feedback.trim();

    if (!submissionId || !reviewerName || !feedback) {
      return { ok: false, message: 'Add reviewer feedback before submitting your review.' };
    }

    const previousSubmissions = this.assignmentSubmissionsSignal();
    const activeSubmission = previousSubmissions.find((submission) => submission.id === submissionId);
    if (!activeSubmission) {
      return { ok: false, message: 'This submission could not be found. Refresh and try again.' };
    }

    const awardedPoints = input.status === 'Approved'
      ? (typeof input.awardedPoints === 'number' && Number.isFinite(input.awardedPoints)
        ? Math.max(0, Math.min(activeSubmission.possiblePoints, Math.round(input.awardedPoints)))
        : null)
      : null;

    if (input.status === 'Approved' && awardedPoints === null) {
      return { ok: false, message: 'Enter the points to award before approving this submission.' };
    }

    const updatedSubmission: AssignmentSubmissionRecord = {
      ...activeSubmission,
      reviewerName,
      reviewerFeedback: feedback,
      awardedPoints,
      status: input.status,
      reviewedAt: this.formatDisplayDate(new Date()),
    };

    const nextSubmissions = previousSubmissions.map((submission) =>
      submission.id === submissionId ? updatedSubmission : submission,
    );

    this.assignmentSubmissionsSignal.set(nextSubmissions);
    this.saveAssignmentSubmissions(nextSubmissions);

    const saved = await this.persistAssignmentSubmission(updatedSubmission);
    if (!saved) {
      this.assignmentSubmissionsSignal.set(previousSubmissions);
      this.saveAssignmentSubmissions(previousSubmissions);
      return { ok: false, message: 'Your review could not be saved. Please check your connection and try again.' };
    }

    return { ok: true };
  }

  private persistAssignmentSubmission(submission: AssignmentSubmissionRecord): Promise<boolean> {
    return new Promise((resolve) => {
      this.backend.upsertAssignmentSubmission(submission).subscribe({
        next: () => resolve(true),
        error: () => resolve(false),
      });
    });
  }

  reviewMentorshipSubmission(input: {
    submissionId: string;
    reviewerName: string;
    status: MentorshipReviewStatus;
    feedback: string;
  }) {
    const submissionId = input.submissionId.trim();
    const reviewerName = input.reviewerName.trim();
    const feedback = input.feedback.trim();

    if (!submissionId || !reviewerName || !feedback) {
      return;
    }

    this.mentorshipSubmissionsSignal.update((submissions) =>
      submissions.map((submission) =>
        submission.id === submissionId
          ? {
              ...submission,
              reviewerName,
              reviewerFeedback: feedback,
              status: input.status,
              reviewedAt: this.formatDisplayDate(new Date()),
            }
          : submission,
      ),
    );

    this.persistMentorshipSubmissions();
  }

  // Returns null only for a client-side validation failure the caller should already have caught
  // via its own form validators — every other outcome (including a failed server round-trip) is
  // reported through the Observable so the caller can tell the difference between "submitted" and
  // "looked submitted locally but the manager will never see it" (see persistExternalTrainingRequestCreate).
  submitExternalTrainingRequest(input: ExternalTrainingRequestCreateInput): Observable<ExternalTrainingRequestRecord> | null {
    const studentId = input.studentId.trim();
    const studentName = input.studentName.trim();
    const studentEmail = input.studentEmail.trim();
    const courseName = input.courseName.trim();
    const provider = input.provider.trim();
    const trainingType = input.trainingType;
    const alignedToIdp = input.alignedToIdp;
    const trainingStartDate = input.trainingStartDate.trim();
    const trainingEndDate = input.trainingEndDate.trim();
    const courseCost = input.courseCost.trim();
    const additionalCostRequired = input.additionalCostRequired;
    const travelCost = input.travelCost.trim();
    const examCost = input.examCost.trim();
    const accommodationCost = input.accommodationCost.trim();
    const approvingManager = this.trainingManagers().find((manager) => manager.id === input.approvingManagerId.trim());

    if (!studentName || !studentEmail || !courseName || !provider || !trainingStartDate || !trainingEndDate || !courseCost || !approvingManager) {
      return null;
    }

    if (additionalCostRequired === 'Yes' && (!travelCost || !examCost || !accommodationCost)) {
      return null;
    }

    const temporaryRequestId = `external-training-request-${Date.now()}`;
    const nextRequest: ExternalTrainingRequestRecord = {
      id: temporaryRequestId,
      studentId,
      studentName,
      studentEmail,
      courseName,
      provider,
      trainingType,
      alignedToIdp,
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
      status: 'Pending Review',
      reviewerName: null,
      reviewerFeedback: '',
      reviewedAt: null,
    };

    this.externalTrainingRequestsSignal.update((requests) => [nextRequest, ...requests]);
    return this.persistExternalTrainingRequestCreate(temporaryRequestId, {
      studentId,
      studentName,
      studentEmail,
      courseName,
      provider,
      trainingType,
      alignedToIdp,
      trainingStartDate,
      trainingEndDate,
      courseCost,
      additionalCostRequired,
      travelCost,
      examCost,
      accommodationCost,
      approvingManagerId: approvingManager.id,
      invoiceFileName: input.invoiceFileName.trim(),
      invoiceDataUrl: input.invoiceDataUrl,
      brochureFileName: input.brochureFileName.trim(),
      brochureDataUrl: input.brochureDataUrl,
    });
  }

  updateExternalTrainingRequest(input: ExternalTrainingRequestUpdateInput): Observable<ExternalTrainingRequestRecord> | null {
    const requestId = input.requestId.trim();
    const existingRequest = this.externalTrainingRequestsSignal().find((request) => request.id === requestId);
    const studentName = input.studentName.trim();
    const studentEmail = input.studentEmail.trim();
    const courseName = input.courseName.trim();
    const provider = input.provider.trim();
    const trainingType = input.trainingType;
    const alignedToIdp = input.alignedToIdp;
    const trainingStartDate = input.trainingStartDate.trim();
    const trainingEndDate = input.trainingEndDate.trim();
    const courseCost = input.courseCost.trim();
    const additionalCostRequired = input.additionalCostRequired;
    const travelCost = input.travelCost.trim();
    const examCost = input.examCost.trim();
    const accommodationCost = input.accommodationCost.trim();
    const approvingManager = this.trainingManagers().find((manager) => manager.id === input.approvingManagerId.trim());

    if (
      !requestId
      || !existingRequest
      || existingRequest.status !== 'Needs Revision'
      || !studentName
      || !studentEmail
      || !courseName
      || !provider
      || !trainingStartDate
      || !trainingEndDate
      || !courseCost
      || !approvingManager
    ) {
      return null;
    }

    if (additionalCostRequired === 'Yes' && (!travelCost || !examCost || !accommodationCost)) {
      return null;
    }

    const nextRequest: ExternalTrainingRequestRecord = {
      ...existingRequest,
      studentName,
      studentEmail,
      courseName,
      provider,
      trainingType,
      alignedToIdp,
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

    this.externalTrainingRequestsSignal.update((requests) =>
      requests.map((request) => request.id === requestId ? nextRequest : request),
    );
    return this.persistExternalTrainingRequestUpdate(existingRequest, {
      requestId,
      studentId: existingRequest.studentId,
      studentName,
      studentEmail,
      courseName,
      provider,
      trainingType,
      alignedToIdp,
      trainingStartDate,
      trainingEndDate,
      courseCost,
      additionalCostRequired,
      travelCost,
      examCost,
      accommodationCost,
      approvingManagerId: approvingManager.id,
      invoiceFileName: input.invoiceFileName.trim(),
      invoiceDataUrl: input.invoiceDataUrl,
      brochureFileName: input.brochureFileName.trim(),
      brochureDataUrl: input.brochureDataUrl,
    });
  }

  reviewExternalTrainingRequest(input: ExternalTrainingRequestReviewInput) {
    const requestId = input.requestId.trim();
    const reviewerName = input.reviewerName.trim();

    if (!requestId || !reviewerName) {
      return;
    }

    this.externalTrainingRequestsSignal.update((requests) => {
      const nextRequests = requests.map((request) =>
        request.id === requestId
          ? {
              ...request,
              reviewerName,
              reviewerFeedback: input.feedback?.trim() ?? '',
              status: input.status,
              reviewedAt: this.formatDisplayDate(new Date()),
            }
          : request,
      );

      this.persistExternalTrainingRequestReview({
        requestId,
        reviewerName,
        status: input.status,
        feedback: input.feedback?.trim() ?? '',
      });
      return nextRequests;
    });
  }

  attachExternalTrainingRequestDocuments(input: ExternalTrainingRequestDocumentsInput) {
    const requestId = input.requestId.trim();
    const existingRequest = this.externalTrainingRequestsSignal().find((request) => request.id === requestId);

    if (!requestId || !existingRequest) {
      return;
    }

    this.externalTrainingRequestsSignal.update((requests) =>
      requests.map((request) =>
        request.id === requestId
          ? {
              ...request,
              ...(input.invoiceFileName !== undefined ? { invoiceFileName: input.invoiceFileName } : {}),
              ...(input.invoiceDataUrl !== undefined ? { invoiceDataUrl: input.invoiceDataUrl } : {}),
              ...(input.proofOfPaymentFileName !== undefined ? { proofOfPaymentFileName: input.proofOfPaymentFileName } : {}),
              ...(input.proofOfPaymentUrl !== undefined ? { proofOfPaymentUrl: input.proofOfPaymentUrl } : {}),
              ...(input.certificateFileName !== undefined ? { certificateFileName: input.certificateFileName } : {}),
              ...(input.certificateUrl !== undefined ? { certificateUrl: input.certificateUrl } : {}),
            }
          : request,
      ),
    );

    this.persistExternalTrainingRequestDocuments(input);
  }

  private persistStudents() {
    this.studentsDirtyAt = Date.now();
    this.saveStudents(this.students());

    if (!this.backendHydrated) {
      return;
    }

    this.backend.patchManagerState({ students: this.students() }).subscribe({
      error: () => {
        // Keep local state if the API is temporarily unavailable.
      },
    });
  }

  private persistManagerMessages() {
    if (!this.backendHydrated) {
      return;
    }

    this.backend.patchManagerState({ managerMessages: this.managerMessagesSignal() }).subscribe({
      error: () => {
        // Keep local state if the API is temporarily unavailable.
      },
    });
  }

  private refreshManagerMessages() {
    this.backend.getManagerMessages().subscribe({
      next: (messages) => {
        // Merge: keep in-memory messages the server doesn't know yet, update the rest.
        const serverById = new Map(messages.map((m) => [m.id, m]));
        const onlyLocal = this.managerMessagesSignal().filter((m) => !serverById.has(m.id));
        this.managerMessagesSignal.set([...messages, ...onlyLocal]);
      },
      error: () => { /* Silently skip failed polls */ },
    });
  }

  // Server-authoritative merge: trust the server's copy of anything it knows about (so this
  // session sees edits/creations from other sessions), but keep any purely local item the
  // server doesn't have yet (e.g. a just-created record whose write is still in flight) instead
  // of letting it flicker away until the write round-trips. Same reasoning as refreshManagerMessages.
  private mergeServerAuthoritative<T extends { id: string }>(serverItems: T[], localItems: T[]): T[] {
    const serverIds = new Set(serverItems.map((item) => item.id));
    const onlyLocal = localItems.filter((item) => !serverIds.has(item.id));
    return [...serverItems, ...onlyLocal];
  }

  // requestStartedAt/dirtyAt guard against a poll that was already in flight when a local write
  // happened: if the write landed after this particular fetch started, the fetch's response can't
  // possibly reflect it yet, so the (more current) local value wins instead of being clobbered by
  // that stale response once it resolves.
  private mergeServerAuthoritativeRecord<T>(
    serverRecord: Record<string, T>,
    localRecord: Record<string, T>,
    dirtyAt?: Record<string, number>,
    requestStartedAt?: number,
  ): Record<string, T> {
    const merged = { ...serverRecord };
    for (const [key, value] of Object.entries(localRecord)) {
      const dirtiedAt = dirtyAt?.[key];
      const isStaleForKey = dirtiedAt !== undefined && requestStartedAt !== undefined && dirtiedAt >= requestStartedAt;
      if (!(key in merged) || isStaleForKey) {
        merged[key] = value;
      }
    }
    return merged;
  }

  /** Periodically refreshes the bootstrap-loaded collections (offerings, students, mentorship,
   *  assignment submissions, external training requests, IDP entries) so the manager/admin
   *  dashboards don't silently go stale for the life of a long-lived session — mirroring the
   *  refresh that already existed for managerMessages. Returns a Promise (resolving once this
   *  particular fetch settles, success or failure) so a caller that needs the refresh to have
   *  actually landed before proceeding — e.g. openKpiYear, which shouldn't report success until
   *  the new year's data is really in the local cache — can await it; the periodic poll below
   *  still just fires it without awaiting, which is unaffected by this being awaitable. */
  /** Public entry point for a caller that just wrote something outside this service's own
   *  optimistic-update methods (e.g. admin-profile.component.ts's bulk training-record upload,
   *  which calls the backend directly rather than through submitExternalTrainingRequest/
   *  reviewExternalTrainingRequest so it can await the real server-assigned id between the create
   *  and review calls) and wants the local signals to reflect that write immediately, rather than
   *  waiting for the next 20s poll. */
  async refreshNow(): Promise<void> {
    await this.refreshBootstrapState();
  }

  private refreshBootstrapState(): Promise<void> {
    const requestStartedAt = Date.now();
    return new Promise<void>((resolve) => {
      this.backend.getBootstrap().subscribe({
        next: (bootstrap) => {
          this.offeringsSignal.set(this.mergeServerAuthoritative(bootstrap.offerings, this.offeringsSignal()));
          // A local roster write that started after this particular fetch did can't possibly be
          // reflected in bootstrap.students yet, so it wins outright this cycle instead of being
          // clobbered by this (now-stale) response — see studentsDirtyAt above. The next poll,
          // started after that write, will pick up the confirmed server state normally.
          const isStudentsStale = this.studentsDirtyAt !== null && this.studentsDirtyAt >= requestStartedAt;
          this.studentsSignal.set(isStudentsStale ? this.studentsSignal() : this.mergeServerAuthoritative(bootstrap.students, this.studentsSignal()));
          this.trainingManagersSignal.set(bootstrap.trainingManagers);
          this.mentorshipAssignmentsSignal.set(this.mergeServerAuthoritative(bootstrap.mentorshipAssignments, this.mentorshipAssignmentsSignal()));
          this.mentorshipSubmissionsSignal.set(this.mergeServerAuthoritative(bootstrap.mentorshipSubmissions, this.mentorshipSubmissionsSignal()));
          this.assignmentSubmissionsSignal.set(
            this.mergeServerAuthoritative(this.hydrateAssignmentSubmissions(bootstrap.assignmentSubmissions), this.assignmentSubmissionsSignal()),
          );
          this.externalTrainingRequestsSignal.set(
            this.mergeServerAuthoritative(bootstrap.externalTrainingRequests, this.externalTrainingRequestsSignal()),
          );
          this.successionRolesSignal.set(bootstrap.successionRoles ?? []);
          this.successorNominationsSignal.set(bootstrap.successorNominations ?? []);
          this.idpEntriesByStudentSignal.set(
            this.mergeServerAuthoritativeRecord(
              this.normalizeIdpEntriesByStudent(bootstrap.idpEntriesByStudent),
              this.idpEntriesByStudentSignal(),
              this.idpEntriesDirtyAt,
              requestStartedAt,
            ),
          );
          // A year the local cache's dirty timestamps were recorded against isn't comparable to a
          // *different* year's server data once someone opens a new KPI year mid-session — the
          // dirty-merge logic assumes "local" and "server" are the same logical table, which is no
          // longer true across a year boundary. Just take the server's fresh (new-year) data
          // outright in that case, and drop the now-irrelevant dirty timestamps from the old year.
          if (typeof bootstrap.currentKpiYear === 'number' && bootstrap.currentKpiYear !== this.currentKpiYearSignal()) {
            this.kpiEntriesByStudentSignal.set(this.normalizeKpiEntriesByStudent(bootstrap.kpiEntriesByStudent));
            for (const key of Object.keys(this.kpiEntriesDirtyAt)) {
              delete this.kpiEntriesDirtyAt[key];
            }
          } else {
            this.kpiEntriesByStudentSignal.set(
              this.mergeServerAuthoritativeRecord(
                this.normalizeKpiEntriesByStudent(bootstrap.kpiEntriesByStudent),
                this.kpiEntriesByStudentSignal(),
                this.kpiEntriesDirtyAt,
                requestStartedAt,
              ),
            );
          }
          if (typeof bootstrap.currentKpiYear === 'number') {
            this.currentKpiYearSignal.set(bootstrap.currentKpiYear);
          }
          if (bootstrap.kpiYearsOpened?.length) {
            this.kpiYearsOpenedSignal.set(bootstrap.kpiYearsOpened);
          }
          resolve();
        },
        error: () => {
          // Silently skip failed polls — but still resolve, so an awaiting caller (openKpiYear)
          // doesn't hang forever on a transient network failure.
          resolve();
        },
      });
    });
  }

  private persistMentorshipAssignments() {
    if (!this.backendHydrated) {
      return;
    }

    this.backend.patchManagerState({ mentorshipAssignments: this.mentorshipAssignmentsSignal() }).subscribe({
      error: () => {
        // Keep local state if the API is temporarily unavailable.
      },
    });
  }

  private persistMentorshipSubmissions() {
    if (!this.backendHydrated) {
      return;
    }

    this.backend.patchManagerState({ mentorshipSubmissions: this.mentorshipSubmissionsSignal() }).subscribe({
      error: () => {
        // Keep local state if the API is temporarily unavailable.
      },
    });
  }

  // Returns the actual server round-trip so the caller (the student's submission form) can tell a
  // real success apart from a failure — previously this subscribed internally and swallowed
  // errors, leaving the optimistic local record in place forever on failure. That made a failed
  // submission look identical to a successful one client-side: the student saw their own "request
  // submitted" state while the approving manager, reading fresh from the server in their own
  // session, never received anything at all.
  private persistExternalTrainingRequestCreate(temporaryRequestId: string, input: ExternalTrainingRequestCreateInput): Observable<ExternalTrainingRequestRecord> {
    if (!this.backendHydrated) {
      this.externalTrainingRequestsSignal.update((requests) => requests.filter((request) => request.id !== temporaryRequestId));
      return throwError(() => new Error('Not connected to the server yet.'));
    }

    return this.backend.createExternalTrainingRequest(input).pipe(
      tap({
        next: (savedRequest) => {
          this.externalTrainingRequestsSignal.update((requests) =>
            requests.map((request) => request.id === temporaryRequestId ? savedRequest : request),
          );
        },
        error: () => {
          // Roll back the optimistic record — it never reached the server, so leaving it in place
          // would keep showing the student a "submitted" request the approving manager can't see.
          this.externalTrainingRequestsSignal.update((requests) => requests.filter((request) => request.id !== temporaryRequestId));
        },
      }),
    );
  }

  // previousRequest is the pre-edit record — on failure the optimistic edit is rolled back to it
  // instead of being left in place, same reasoning as persistExternalTrainingRequestCreate above.
  // This path matters most for a resubmission after "Needs Revision": a silently-failed
  // resubmission previously looked identical to a real one, so the approving manager never saw it
  // come back.
  private persistExternalTrainingRequestUpdate(previousRequest: ExternalTrainingRequestRecord, input: ExternalTrainingRequestUpdateInput): Observable<ExternalTrainingRequestRecord> {
    if (!this.backendHydrated) {
      this.externalTrainingRequestsSignal.update((requests) =>
        requests.map((request) => request.id === previousRequest.id ? previousRequest : request),
      );
      return throwError(() => new Error('Not connected to the server yet.'));
    }

    return this.backend.updateExternalTrainingRequest(input).pipe(
      tap({
        next: (savedRequest) => {
          this.externalTrainingRequestsSignal.update((requests) =>
            requests.map((request) => request.id === savedRequest.id ? savedRequest : request),
          );
        },
        error: () => {
          this.externalTrainingRequestsSignal.update((requests) =>
            requests.map((request) => request.id === previousRequest.id ? previousRequest : request),
          );
        },
      }),
    );
  }

  private persistExternalTrainingRequestReview(input: ExternalTrainingRequestReviewInput) {
    if (!this.backendHydrated) {
      return;
    }

    this.backend.reviewExternalTrainingRequest(input).subscribe({
      next: (savedRequest) => {
        this.externalTrainingRequestsSignal.update((requests) =>
          requests.map((request) => request.id === savedRequest.id ? savedRequest : request),
        );
      },
      error: () => {
        // Keep local state if the API is temporarily unavailable.
      },
    });
  }

  private persistExternalTrainingRequestDocuments(input: ExternalTrainingRequestDocumentsInput) {
    if (!this.backendHydrated) {
      return;
    }

    this.backend.attachExternalTrainingRequestDocuments(input).subscribe({
      next: (savedRequest) => {
        this.externalTrainingRequestsSignal.update((requests) =>
          requests.map((request) => request.id === savedRequest.id ? savedRequest : request),
        );
      },
      error: () => {
        // Keep local state if the API is temporarily unavailable.
      },
    });
  }

  // Succession planning: unlike the external-training-request flow above, there's no client-side
  // temporary-id/reconcile dance here — these are deliberate, low-frequency manager/admin actions,
  // so the caller just waits for the real server record (with its real id) before updating local
  // state, rather than optimistically rendering a placeholder.
  createSuccessionRole(input: SuccessionRoleInput): Observable<SuccessionRoleRecord> {
    return this.backend.createSuccessionRole(input).pipe(
      tap((role) => this.successionRolesSignal.update((roles) => [...roles, role])),
    );
  }

  deleteSuccessionRole(roleId: string): Observable<void> {
    return this.backend.deleteSuccessionRole(roleId).pipe(
      tap(() => {
        this.successionRolesSignal.update((roles) => roles.filter((entry) => entry.id !== roleId));
        // Mirrors the server's own cascade (LmsRepository.deleteSuccessionRole) — withdraw rather
        // than drop, so the local list stays consistent with what a refresh would show.
        this.successorNominationsSignal.update((nominations) => nominations.map((entry) => (
          entry.roleId === roleId && entry.status !== 'Withdrawn'
            ? { ...entry, status: 'Withdrawn' as const }
            : entry
        )));
      }),
    );
  }

  createSuccessorNomination(input: SuccessorNominationCreateInput): Observable<SuccessorNominationRecord> {
    return this.backend.createSuccessorNomination(input).pipe(
      tap((nomination) => this.successorNominationsSignal.update((nominations) => [...nominations, nomination])),
    );
  }

  updateSuccessorNomination(nominationId: string, input: SuccessorNominationUpdateInput): Observable<SuccessorNominationRecord> {
    return this.backend.updateSuccessorNomination(nominationId, input).pipe(
      tap((nomination) => this.successorNominationsSignal.update((nominations) => nominations.map((entry) => (entry.id === nomination.id ? nomination : entry)))),
    );
  }

  setSuccessorNominationStatus(nominationId: string, status: SuccessionNominationStatus): Observable<SuccessorNominationRecord> {
    return this.backend.setSuccessorNominationStatus(nominationId, status).pipe(
      tap((nomination) => this.successorNominationsSignal.update((nominations) => nominations.map((entry) => (entry.id === nomination.id ? nomination : entry)))),
    );
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private createUniqueOfferingId(title: string) {
    const baseId = this.slugify(title) || 'course';
    const existingIds = new Set(this.offerings().map((offering) => offering.id));

    if (!existingIds.has(baseId)) {
      return baseId;
    }

    let suffix = 2;
    let nextId = `${baseId}-${suffix}`;

    while (existingIds.has(nextId)) {
      suffix += 1;
      nextId = `${baseId}-${suffix}`;
    }

    return nextId;
  }

  private normalizeStudentInput(input: EnrollmentStudentInput) {
    const normalizedName = input.name.trim();
    const normalizedSurname = input.surname.trim();
    const normalizedGroup = input.group.trim();
    const normalizedEmail = input.email.trim();
    const normalizedDepartment = input.department.trim();

    if (
      !normalizedName ||
      !normalizedSurname ||
      !normalizedGroup ||
      !input.dateEnrolled ||
      !input.deadlineDate ||
      !normalizedEmail ||
      !normalizedDepartment
    ) {
      return null;
    }

    return {
      name: normalizedName,
      surname: normalizedSurname,
      group: normalizedGroup,
      dateEnrolled: input.dateEnrolled,
      deadlineDate: input.deadlineDate,
      email: normalizedEmail,
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle.trim() } : {}),
      ...(input.idNumber !== undefined ? { idNumber: input.idNumber.trim() } : {}),
      activeStatus: input.activeStatus,
      department: normalizedDepartment,
      ...(input.lineManager !== undefined ? { lineManager: input.lineManager.trim() } : {}),
      ...(input.lineManagerId !== undefined ? { lineManagerId: input.lineManagerId.trim() || undefined } : {}),
      ...(input.ofoCode !== undefined ? { ofoCode: input.ofoCode.trim() } : {}),
      ...(input.race !== undefined ? { race: input.race.trim() } : {}),
      ...(input.gender !== undefined ? { gender: input.gender.trim() } : {}),
      ...(input.municipality !== undefined ? { municipality: input.municipality.trim() } : {}),
      ...(input.dateOfBirth !== undefined ? { dateOfBirth: input.dateOfBirth.trim() } : {}),
      ...(input.nqfLevel !== undefined ? { nqfLevel: input.nqfLevel.trim() } : {}),
      role: input.role,
      isAdmin: input.isAdmin,
    };
  }

  private buildTrainingManagers() {
    const managers = [...this.trainingManagersSignal()];
    const seenEmails = new Set(managers.map((manager) => manager.email.trim().toLowerCase()));

    for (const student of this.students()) {
      if (student.role !== 'manager' || student.activeStatus !== 'Active') {
        continue;
      }

      const normalizedEmail = student.email.trim().toLowerCase();
      if (!normalizedEmail || seenEmails.has(normalizedEmail)) {
        continue;
      }

      seenEmails.add(normalizedEmail);
      managers.push(this.buildTrainingManagerFromStudent(student));
    }

    return managers.sort((left, right) => left.name.localeCompare(right.name) || left.email.localeCompare(right.email));
  }

  private buildTrainingManagerFromStudent(student: EnrollmentStudent): SystemTrainingManager {
    return {
      id: `uploaded-manager-${student.id}`,
      name: `${student.name} ${student.surname}`.trim(),
      role: student.jobTitle.trim() || 'Training Manager',
      team: student.department.trim() || 'Learning Operations',
      email: student.email.trim(),
    };
  }

  // Admin-facing approving-manager management (Settings > Approval settings) — adds/edits/removes
  // an explicit trainingManagers entry. Uses the same full-array-replace PUT /api/manager-state
  // path every other collection here already persists through (see persistStudents et al.), rather
  // than adding a dedicated endpoint for a rarely-written admin list.
  upsertApprovingManager(manager: SystemTrainingManager) {
    this.trainingManagersSignal.update((managers) => (
      managers.some((entry) => entry.id === manager.id)
        ? managers.map((entry) => (entry.id === manager.id ? manager : entry))
        : [...managers, manager]
    ));
    this.persistTrainingManagers();
  }

  deleteApprovingManager(managerId: string) {
    this.trainingManagersSignal.update((managers) => managers.filter((entry) => entry.id !== managerId));
    this.persistTrainingManagers();
  }

  private persistTrainingManagers() {
    if (!this.backendHydrated) {
      return;
    }

    this.backend.patchManagerState({ trainingManagers: this.trainingManagersSignal() }).subscribe({
      error: () => {
        // Keep local state if the API is temporarily unavailable.
      },
    });
  }

  private createUniqueStudentId(input: EnrollmentStudentInput, usedIds: Set<string>) {
    const baseId = this.slugify(`${input.name}-${input.surname}-${input.email.split('@')[0]}`) || 'student';
    let nextId = baseId;
    let suffix = 2;

    while (usedIds.has(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    return nextId;
  }

  private deliverManagerMessageToStudent(recipient: string, subject: string, message: string) {
    const student = this.findStudentByMessageRecipient(recipient);

    if (!student) {
      return;
    }

    this.backend.getStudentSnapshot(student.id).subscribe({
      next: (snapshot) => {
        const nextMessage: StudentMessage = {
          id: `student-message-${Date.now()}`,
          sender: this.profile().name,
          subject,
          preview: message,
          body: message,
          time: 'Just now',
          unread: true,
          replies: [],
        };

        this.backend.updateStudentSnapshot({
          ...snapshot,
          messages: [nextMessage, ...snapshot.messages],
        }, student.id).subscribe({
          error: () => {
            // Keep manager-side send success even if learner delivery fails.
          },
        });
      },
      error: () => {
        // Ignore learner delivery if the backend snapshot is unavailable.
      },
    });
  }

  private findStudentByMessageRecipient(recipient: string) {
    const normalizedRecipient = recipient.trim().toLocaleLowerCase();

    if (!normalizedRecipient) {
      return null;
    }

    return this.students().find((student) => {
      const fullName = `${student.name} ${student.surname}`.trim().toLocaleLowerCase();
      return fullName === normalizedRecipient || student.email.trim().toLocaleLowerCase() === normalizedRecipient;
    }) ?? null;
  }

  private loadAssignmentSubmissions() {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const raw = localStorage.getItem(TrainingManagerDataService.assignmentSubmissionsStorageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? this.hydrateAssignmentSubmissions(parsed) : [];
    } catch {
      return [];
    }
  }

  private hydrateAssignmentSubmissions(submissions: Array<Partial<AssignmentSubmissionRecord>>) {
    return submissions.map((submission) => ({
      ...submission,
      possiblePoints: this.resolveAssignmentPossiblePoints(submission) ?? 0,
      awardedPoints: typeof submission?.awardedPoints === 'number' && Number.isFinite(submission.awardedPoints) ? submission.awardedPoints : null,
      status: submission?.status ?? 'Pending Review',
      reviewerName: submission?.reviewerName ?? null,
      reviewerFeedback: submission?.reviewerFeedback ?? '',
      reviewedAt: submission?.reviewedAt ?? null,
    })) as AssignmentSubmissionRecord[];
  }

  private loadOfferings() {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const raw = localStorage.getItem(TrainingManagerDataService.offeringsStorageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? (parsed as TrainingOffering[])
        : [];
    } catch {
      return [];
    }
  }

  private loadStudents() {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const raw = localStorage.getItem(TrainingManagerDataService.studentsStorageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed as EnrollmentStudent[];
    } catch {
      return [];
    }
  }

  private mergeWithLocalStudents(backendStudents: EnrollmentStudent[]): EnrollmentStudent[] {
    const localStudents = this.loadStudents();
    if (!localStudents.length) {
      return backendStudents;
    }

    const localById = new Map(localStudents.map((student) => [student.id, student]));
    const merged = backendStudents.map((backendStudent) => {
      const local = localById.get(backendStudent.id);
      if (!local) {
        return backendStudent;
      }

      // Keep local student data when it differs; this prevents assignments from
      // disappearing if a prior backend write failed or has not propagated yet.
      return JSON.stringify(local) !== JSON.stringify(backendStudent)
        ? local
        : backendStudent;
    });

    for (const local of localStudents) {
      if (!merged.some((student) => student.id === local.id)) {
        merged.push(local);
      }
    }

    return merged;
  }

  private mergeWithLocalOfferings(backendOfferings: TrainingOffering[]): TrainingOffering[] {
    const localOfferings = this.loadOfferings();
    if (!localOfferings.length) {
      return backendOfferings;
    }
    const localById = new Map(localOfferings.map((o) => [o.id, o]));
    const merged = backendOfferings.map((backendOffering) => {
      const local = localById.get(backendOffering.id);
      if (!local) return backendOffering;

      // If both copies exist but differ, keep local to avoid user edits disappearing
      // when a previous backend save failed or lagged behind.
      if (JSON.stringify(local) !== JSON.stringify(backendOffering)) {
        return local;
      }

      return backendOffering;
    });
    // Append local-only offerings the backend does not yet know about
    for (const local of localOfferings) {
      if (!merged.some((o) => o.id === local.id)) {
        merged.push(local);
      }
    }
    return merged;
  }

  private saveOfferings(offerings: TrainingOffering[]) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(TrainingManagerDataService.offeringsStorageKey, JSON.stringify(offerings));
    } catch {
      return;
    }
  }

  private saveStudents(students: EnrollmentStudent[]) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(TrainingManagerDataService.studentsStorageKey, JSON.stringify(students));
    } catch {
      return;
    }
  }

  private saveAssignmentSubmissions(submissions: AssignmentSubmissionRecord[]) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(TrainingManagerDataService.assignmentSubmissionsStorageKey, JSON.stringify(submissions));
    } catch {
      return;
    }
  }

  private loadIdpEntriesByStudent() {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    try {
      const raw = localStorage.getItem(TrainingManagerDataService.idpEntriesByStudentStorageKey);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }

      const entriesByStudent: Record<string, StudentIdpEntry[]> = {};
      for (const [studentId, entries] of Object.entries(parsed as Record<string, unknown>)) {
        if (!Array.isArray(entries) || !studentId.trim()) {
          continue;
        }

        entriesByStudent[studentId] = entries.map((entry) => this.normalizeIdpEntry(entry));
      }

      return entriesByStudent;
    } catch {
      return {};
    }
  }

  private saveIdpEntriesByStudent(entriesByStudent: Record<string, StudentIdpEntry[]>) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(TrainingManagerDataService.idpEntriesByStudentStorageKey, JSON.stringify(entriesByStudent));
    } catch {
      return;
    }
  }

  private normalizeIdpEntry(entry: unknown): StudentIdpEntry {
    const candidate = (entry && typeof entry === 'object' ? entry : {}) as Partial<StudentIdpEntry>;
    const status = this.normalizeIdpStatus(candidate.status);

    return {
      developmentNeed: typeof candidate.developmentNeed === 'string' ? candidate.developmentNeed.trim() : '',
      plannedAction: typeof candidate.plannedAction === 'string' ? candidate.plannedAction.trim() : '',
      supportRequired: typeof candidate.supportRequired === 'string' ? candidate.supportRequired.trim() : '',
      dateCaptured: typeof candidate.dateCaptured === 'string' ? candidate.dateCaptured.trim() : '',
      targetDate: typeof candidate.targetDate === 'string' ? candidate.targetDate.trim() : '',
      status,
    };
  }

  private normalizeIdpStatus(status: unknown): TrainingIdpStatus {
    if (status === 'In Progress' || status === 'Completed' || status === 'On Hold') {
      return status;
    }

    return 'Not Started';
  }

  private normalizeIdpEntriesByStudent(entriesByStudent: unknown) {
    if (!entriesByStudent || typeof entriesByStudent !== 'object' || Array.isArray(entriesByStudent)) {
      return {};
    }

    const normalized: Record<string, StudentIdpEntry[]> = {};
    for (const [studentId, entries] of Object.entries(entriesByStudent as Record<string, unknown>)) {
      if (!studentId.trim() || !Array.isArray(entries)) {
        continue;
      }

      normalized[studentId] = entries.map((entry) => this.normalizeIdpEntry(entry));
    }

    return normalized;
  }

  private persistIdpEntriesToBackend(studentId: string) {
    if (!this.backendHydrated) {
      return;
    }

    const idpEntries = this.idpEntriesForStudent(studentId);
    this.backend.getStudentSnapshot(studentId).subscribe({
      next: (snapshot) => {
        const { studentId: _studentId, ...snapshotUpdate } = snapshot;
        this.backend.updateStudentSnapshot({
          ...snapshotUpdate,
          idpEntries,
        }, studentId).subscribe({
          error: () => {
            // Keep local IDP state if backend persistence is temporarily unavailable.
          },
        });
      },
      error: () => {
        // Ignore backend sync failures and preserve local IDP entries.
      },
    });
  }

  private loadKpiEntriesByStudent() {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    try {
      const raw = localStorage.getItem(TrainingManagerDataService.kpiEntriesByStudentStorageKey);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }

      const entriesByStudent: Record<string, StudentKpiEntry[]> = {};
      for (const [studentId, entries] of Object.entries(parsed as Record<string, unknown>)) {
        if (!Array.isArray(entries) || !studentId.trim()) {
          continue;
        }

        entriesByStudent[studentId] = entries.map((entry) => this.normalizeKpiEntry(entry));
      }

      return entriesByStudent;
    } catch {
      return {};
    }
  }

  private saveKpiEntriesByStudent(entriesByStudent: Record<string, StudentKpiEntry[]>) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(TrainingManagerDataService.kpiEntriesByStudentStorageKey, JSON.stringify(entriesByStudent));
    } catch {
      return;
    }
  }

  private normalizeKpiScoreValue(score: unknown): StudentKpiScore | null {
    return score === 1 || score === 2 || score === 3 || score === 4 || score === 5 ? score : null;
  }

  private normalizeKpiEntry(entry: unknown): StudentKpiEntry {
    const candidate = (entry && typeof entry === 'object' ? entry : {}) as Partial<StudentKpiEntry> & { agreedOutput?: unknown };
    const weight = typeof candidate.weight === 'number' && Number.isFinite(candidate.weight) ? candidate.weight : 0;
    // A locally cached entry from before the Target/Actual column revision has `agreedOutput` but
    // no `target` yet — migrate it forward rather than losing what was already recorded there.
    const target = typeof candidate.target === 'string'
      ? candidate.target
      : typeof candidate.agreedOutput === 'string'
        ? candidate.agreedOutput
        : '';

    return {
      id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim() : `kpi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      keyResultArea: typeof candidate.keyResultArea === 'string' ? candidate.keyResultArea : '',
      kpi: typeof candidate.kpi === 'string' ? candidate.kpi : '',
      weight,
      target,
      actual: typeof candidate.actual === 'string' ? candidate.actual : '',
      comments: typeof candidate.comments === 'string' ? candidate.comments : '',
      overallScoring: this.normalizeKpiScoreValue(candidate.overallScoring),
      managerScoring: this.normalizeKpiScoreValue(candidate.managerScoring),
      employeeScoring: this.normalizeKpiScoreValue(candidate.employeeScoring),
      measure: typeof candidate.measure === 'string' ? candidate.measure : '',
      dateOfReview: typeof candidate.dateOfReview === 'string' ? candidate.dateOfReview : '',
      gapInitiative: typeof candidate.gapInitiative === 'string' ? candidate.gapInitiative : '',
      gapComments: typeof candidate.gapComments === 'string' ? candidate.gapComments : '',
      gapTargetDate: typeof candidate.gapTargetDate === 'string' ? candidate.gapTargetDate : '',
    };
  }

  private normalizeKpiEntriesByStudent(entriesByStudent: unknown) {
    if (!entriesByStudent || typeof entriesByStudent !== 'object' || Array.isArray(entriesByStudent)) {
      return {};
    }

    const normalized: Record<string, StudentKpiEntry[]> = {};
    for (const [studentId, entries] of Object.entries(entriesByStudent as Record<string, unknown>)) {
      if (!studentId.trim() || !Array.isArray(entries)) {
        continue;
      }

      normalized[studentId] = entries.map((entry) => this.normalizeKpiEntry(entry));
    }

    return normalized;
  }

  // Unlike IDP entries, KPI entries have their own dedicated endpoint (see server.ts) rather
  // than riding along on the general student snapshot — that's what lets the server enforce the
  // full-table-vs-scoped write split described on setKpiEntriesForStudent / updateKpiGapAnalysis.
  private persistKpiEntriesToBackend(studentId: string) {
    if (!this.backendHydrated) {
      return;
    }

    const kpiEntries = this.kpiEntriesForStudent(studentId);
    this.backend.setKpiEntries(studentId, kpiEntries).subscribe({
      next: (entries) => {
        this.kpiEntriesByStudentSignal.update((current) => {
          const next = { ...current, [studentId]: entries };
          this.saveKpiEntriesByStudent(next);
          return next;
        });
      },
      error: () => {
        // Keep local KPI state if backend persistence is temporarily unavailable.
      },
    });
  }

  private resolveAssignmentPossiblePoints(submission: Partial<AssignmentSubmissionRecord>) {
    if (typeof submission.possiblePoints === 'number' && Number.isFinite(submission.possiblePoints) && submission.possiblePoints > 0) {
      return submission.possiblePoints;
    }

    const offering = this.offerings().find((item) => item.id === submission.offeringId);
    if (!offering) {
      return null;
    }

    const normalizedStepId = submission.assessmentStepId?.trim() ?? '';
    const normalizedAssessmentId = submission.assessmentId?.trim() ?? '';
    const normalizedAssessmentTitle = submission.assessmentTitle?.trim().toLocaleLowerCase() ?? '';
    let fallbackPoints: number | null = null;

    for (let itemIndex = 0; itemIndex < offering.contentItems.length; itemIndex += 1) {
      const item = offering.contentItems[itemIndex];
      if (item.kind !== 'Assessment' || item.assessmentType !== 'Assignment') {
        continue;
      }

      if (fallbackPoints === null) {
        fallbackPoints = item.questions[0]?.points ?? null;
      }

      if (normalizedAssessmentTitle && item.title.trim().toLocaleLowerCase() === normalizedAssessmentTitle) {
        fallbackPoints = item.questions[0]?.points ?? fallbackPoints;
      }

      if (normalizedAssessmentId && item.id === normalizedAssessmentId) {
        fallbackPoints = item.questions[0]?.points ?? fallbackPoints;
      }

      for (let questionIndex = 0; questionIndex < item.questions.length; questionIndex += 1) {
        const question = item.questions[questionIndex];
        const stepId = this.createAssessmentStepId(offering.id, item.id, itemIndex, questionIndex);

        if ((normalizedStepId && stepId === normalizedStepId) || (!normalizedStepId && normalizedAssessmentId && stepId === normalizedAssessmentId)) {
          return question.points;
        }
      }
    }

    return fallbackPoints;
  }

  private normalizePersonName(value: string) {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  /** Resolves the logged-in user's own identity for the manager workspace header — matching
   *  against the known managers directory when possible, otherwise deriving a display name
   *  from the session so this never shows a hardcoded placeholder for a different person. */
  private resolveInitialManagerProfile(): ManagerProfile {
    const session = readLmsSessionRecord();
    const sessionEmail = session?.email?.trim().toLowerCase();

    if (sessionEmail) {
      const matchedManager = this.trainingManagersSignal().find(
        (manager) => manager.email.toLowerCase() === sessionEmail,
      );
      if (matchedManager) {
        return {
          name: matchedManager.name,
          role: matchedManager.role,
          team: matchedManager.team,
          email: matchedManager.email,
          profileImageUrl: null,
        };
      }
    }

    return {
      name: session?.displayName ?? this.deriveDisplayNameFromIdentity(session?.username, session?.email),
      role: 'Training Manager',
      team: 'People Enablement',
      email: session?.email?.trim() || '',
      profileImageUrl: null,
    };
  }

  // Prefer the account's real directory name and picture (the same ones shown in the student and
  // admin views) over the username/email-derived fallback, so accounts with multiple access roles
  // show one consistent identity everywhere. Public so the manager component can re-run this on
  // every visit — this service is a root singleton constructed once, so a picture uploaded from
  // another role after that first construction would otherwise never be picked up here.
  refreshOwnIdentity() {
    this.hydrateOwnDisplayName();
  }

  /** Optimistically updates the topbar avatar right after this account's own picture is
   *  uploaded/removed, without waiting for a full identity refetch. */
  setOwnProfileImage(profileImageUrl: string | null) {
    this.profileSignal.update((profile) => ({ ...profile, profileImageUrl }));
  }

  private hydrateOwnDisplayName() {
    this.backend.getMyIdentity().subscribe({
      next: (identity) => {
        const fullName = combineDisplayName(identity.name ?? undefined, identity.surname ?? undefined);
        this.profileSignal.update((profile) => ({
          ...profile,
          name: fullName ?? profile.name,
          profileImageUrl: identity.profileImageUrl || identity.profileImageDataUrl || null,
        }));
      },
      error: () => {
        // Keep the derived fallback name and initials avatar if the lookup fails.
      },
    });
  }

  private deriveDisplayNameFromIdentity(username: string | undefined, email: string | undefined): string {
    const source = username?.trim() || email?.trim().split('@')[0] || '';
    const words = source
      .split(/[\s._-]+/)
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase());

    return words.join(' ') || 'Training Manager';
  }

  private formatDisplayDate(date: Date) {
    return new Intl.DateTimeFormat('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private resolveAssignmentState(student: EnrollmentStudent, assignedOfferingIds: string[], latestAssignedDeadline?: string) {
    const resolvedDeadline = latestAssignedDeadline
      ?? this.offerings()
        .filter((offering) => assignedOfferingIds.includes(offering.id))
        .map((offering) => offering.completionDeadline)
        .filter(Boolean)
        .sort()
        .at(-1)
      ?? student.deadlineDate;

    if (!assignedOfferingIds.length) {
      return {
        assignedOfferingIds,
        deadlineDate: resolvedDeadline,
        activeStatus: 'Inactive' as const,
        status: 'Not Yet Started' as LearningStatus,
      };
    }

    return {
      assignedOfferingIds,
      deadlineDate: resolvedDeadline,
      activeStatus: 'Active' as const,
      status: student.status === 'Not Yet Started' ? 'In Progress' as LearningStatus : student.status,
    };
  }
}
