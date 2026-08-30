export type TrainingOfferingType = 'Course' | 'Programme';
export type TrainingAssessmentType = 'Quiz' | 'Assignment' | 'Mentorship' | 'Read and Acknowledge';
export type TrainingContentKind = 'Video' | 'Assessment' | 'Document' | 'Scorm';
export type TrainingQuestionType = 'Multiple Choice' | 'Short Answer' | 'Long Answer' | 'Document Upload' | 'True or False' | 'Matching';
export type SubmissionReviewStatus = 'Pending Review' | 'Approved' | 'Needs Revision';
export type LoginRole = 'administrator' | 'training-manager' | 'student';
export type LmsBrandThemeId = 'ocean' | 'forest' | 'sunrise' | 'purple' | 'black' | 'grey';

export type TrainingAssessmentChoice = {
  text: string;
  points: number;
  isCorrect: boolean;
};

export type TrainingMatchingPair = {
  prompt: string;
  answer: string;
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
  durationSeconds?: number;
  questions: TrainingAssessmentQuestion[];
};

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

export type StudentCourseRecord = {
  offeringId?: string;
  name: string;
  progress?: number;
  image: string;
  completed: boolean;
  completedAt?: string;
  description: string;
};

export type StudentProfileRecord = {
  name: string;
  email: string;
  idNumber: string;
  age: number;
  contactNumber: string;
  address: string;
  department: string;
  jobTitle: string;
  joined: string;
  learningStreak: string;
  profileImageDataUrl: string | null;
  profileImageUrl: string | null;
  passwordUpdatedAt: string;
};

export type StudentMentorshipProfileRecord = {
  menteeName: string;
  menteeSurname: string;
  menteeJobTitle: string;
  menteeQualification: string;
  menteeExperience: string;
  mentorName: string;
  mentorSurname: string;
  mentorJobTitle: string;
  mentorQualification: string;
  mentorExperience: string;
};

export type StudentMentorshipObjectiveEntryRecord = {
  title: string;
  date: string;
  achievementDate: string;
};

export type StudentMentorshipObjectivesRecord = {
  mentorshipGoals: StudentMentorshipObjectiveEntryRecord[];
  objectives: StudentMentorshipObjectiveEntryRecord[];
};

export type StudentMentorshipProgressEntryRecord = {
  objectiveAchieved: string;
  dateAchieved: string;
};

export type StudentMentorshipProgressReportRecord = {
  dateOfMeeting: string;
  objectivesAchieved: StudentMentorshipProgressEntryRecord[];
  mentorComments: string;
};

export type StudentBadgeStateRecord = {
  earnedBadgeIds: string[];
};

export type StudentCertificateStatusRecord = 'Active' | 'Expired' | 'Pending Renewal';

export type StudentCertificateLicenceRecord = {
  id: string;
  certificationName: string;
  completionDate: string;
  expiryDate: string;
  fileName: string;
  fileDataUrl: string;
  fileUrl?: string | null;
  source?: 'manual' | 'course-completion';
  status: StudentCertificateStatusRecord;
  renewalRequired: 'Yes' | 'No';
  reminderNotification: 'Yes' | 'No';
  reminderDaysBeforeExpiry: number;
};

export type StudentNotificationPreferencesRecord = {
  emailUpdates: boolean;
  smsAlerts: boolean;
  assignmentReminders: boolean;
  messageNotifications: boolean;
  certificateMilestones: boolean;
};

export type StudentPrivacySettingsRecord = {
  tutorProfileVisibility: boolean;
  classmateProfileVisibility: boolean;
  showEmailAddress: boolean;
  showContactNumber: boolean;
};

export type StudentSettingsRecord = {
  notificationPreferences: StudentNotificationPreferencesRecord;
  privacySettings: StudentPrivacySettingsRecord;
  themePreference: LmsBrandThemeId | null;
};

export type StudentNotificationRecord = {
  id: string;
  badge: string;
  title: string;
  body: string;
  dateLabel: string;
  unread: boolean;
};

export type StudentMessageReplyRecord = {
  id: string;
  sender: string;
  body: string;
  time: string;
  authorType: 'student' | 'contact';
  deliveryState?: 'Sent' | 'Delivered';
};

export type StudentMessageRecord = {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  unread: boolean;
  replies: StudentMessageReplyRecord[];
};

export type ManagerMessageReplyRecord = {
  id: string;
  sender: string;
  body: string;
  time: string;
  authorType: 'manager' | 'contact';
  deliveryState?: 'Sent' | 'Delivered';
};

export type ManagerMessageRecord = {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  unread: boolean;
  replies: ManagerMessageReplyRecord[];
};

export type SystemTrainingManagerRecord = {
  id: string;
  name: string;
  role: string;
  team: string;
  email: string;
};

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
  status: SubmissionReviewStatus;
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
  status: SubmissionReviewStatus;
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

export type EnrollmentStudentRecord = {
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
  status: 'Completed' | 'In Progress' | 'Not Yet Started';
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

export type StudentIdpStatusRecord = 'Not Started' | 'In Progress' | 'Completed' | 'On Hold';

export type StudentIdpEntryRecord = {
  developmentNeed: string;
  plannedAction: string;
  supportRequired: string;
  dateCaptured: string;
  targetDate: string;
  status: StudentIdpStatusRecord;
};

export type StudentKpiScoreRecord = 1 | 2 | 3 | 4 | 5;

export type StudentKpiEntryRecord = {
  id: string;
  // Visible table columns (Key Result Area / Key Performance Indicator / Weight of KPI / Target /
  // Actual / Final Rating / Comments):
  keyResultArea: string;
  kpi: string;
  weight: number;
  target: string;
  actual: string;
  comments: string;
  // The single editable rating going forward — displayed as "Final Rating". Manager Scoring and
  // Employee Scoring are no longer separately editable (the employee self-scoring step was
  // removed), but both fields — and measure/dateOfReview — are kept and preserved on every write
  // rather than deleted, so historical data already recorded under the old three-way scoring
  // model stays intact and readable even though nothing writes new values into them any more.
  overallScoring: StudentKpiScoreRecord | null;
  managerScoring: StudentKpiScoreRecord | null;
  employeeScoring: StudentKpiScoreRecord | null;
  measure: string;
  dateOfReview: string;
  // Performance Gap Analysis — only meaningful once overallScoring lands at 1 or 2. Written
  // through its own dedicated endpoint (see updateKpiGapAnalysis), the same way employeeScoring
  // is, so a manager's full-table save can't silently wipe it out.
  gapInitiative: string;
  gapComments: string;
  gapTargetDate: string;
};

export type StudentKpiEmployeeScoringUpdateInput = {
  entries: { id: string; employeeScoring: StudentKpiScoreRecord | null }[];
};

export type StudentKpiGapAnalysisUpdateInput = {
  entries: { id: string; gapInitiative: string; gapComments: string; gapTargetDate: string }[];
};

export type SuccessionReadinessRating = 'Ready Now' | 'Ready in 1-2 Years' | 'Ready in 3+ Years';
export type SuccessionNominationStatus = 'Draft' | 'Active' | 'Withdrawn';

// A role only ever exists because a manager flagged one of their own team's positions as
// critical — there's no separate role-naming/admin-assignment step, so title/department are
// snapshotted from the incumbent at flagging time rather than independently settable.
export type SuccessionRoleRecord = {
  id: string;
  title: string;
  department: string;
  // The flagging manager's own EnrollmentStudentRecord id — their team is every student whose
  // lineManagerId equals this.
  ownerManagerId: string;
  // Required: the team member whose position was flagged. Display-only to the L&D admin report;
  // never surfaced to the nominated successor (see StudentSuccessionStatus).
  incumbentStudentId: string;
  createdOn: string;
};

export type SuccessionRoleInput = {
  incumbentStudentId: string;
};

export type SuccessionDevelopmentAction = {
  id: string;
  description: string;
  status: StudentIdpStatusRecord;
  targetDate?: string;
};

export type SuccessionCompetencyGap = {
  id: string;
  competency: string;
  notes?: string;
  developmentActions: SuccessionDevelopmentAction[];
};

// Owned by the nomination itself rather than the existing KPI gap-analysis / IDP entries — those
// have no stable id/linkage to hang a per-gap development plan off today, and this keeps the
// succession feature self-contained instead of retrofitting the actively-used KPI/IDP system.
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

export type SuccessorNominationStatusUpdateInput = {
  status: SuccessionNominationStatus;
};

// What the nominated learner is allowed to see about their own earmarking — role title and their
// own readiness/development plan only, never who nominated them or the role's incumbent.
export type StudentSuccessionStatus = {
  roleTitle: string;
  readinessRating: SuccessionReadinessRating;
  competencyGaps: SuccessionCompetencyGap[];
};

// One KPI table per opened year. Only the org-wide current year (LmsDataStore.currentKpiYear) is
// ever editable; every other year in this array is a closed, read-only historical record — see
// openKpiYear in repository.ts, which is the only thing that ever adds a new entry here.
export type StudentKpiYearRecord = {
  year: number;
  entries: StudentKpiEntryRecord[];
};

export type OpenKpiYearInput = {
  year: number;
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

export type StudentRecord = EnrollmentStudentRecord & {
  profile: StudentProfileRecord;
  badgeState: StudentBadgeStateRecord;
  certificatesAndLicences?: StudentCertificateLicenceRecord[];
  settings: StudentSettingsRecord;
  mentorshipProfile: StudentMentorshipProfileRecord;
  mentorshipObjectives: StudentMentorshipObjectivesRecord;
  mentorshipProgressReport: StudentMentorshipProgressReportRecord;
  courses: StudentCourseRecord[];
  notifications: StudentNotificationRecord[];
  messages: StudentMessageRecord[];
  notifiedOfferingIds: string[];
  assessmentAttempts?: Record<string, StudentAssessmentAttemptRecord>;
  idpEntries?: StudentIdpEntryRecord[];
  kpiYears?: StudentKpiYearRecord[];
};

export type BrandingSettingsRecord = {
  themeId: 'ocean' | 'forest' | 'sunrise' | 'purple' | 'black' | 'grey';
  companyLogoDataUrl: string | null;
};

export type HrIntegrationSyncSummary = {
  added: number;
  updated: number;
  skipped: number;
  issues: string[];
  syncedAt: string;
};

// Stored server-side, including the real authHeaderValue — never returned to the browser as-is.
// See HrIntegrationConfigResponse below for the shape any GET actually sends back.
export type HrIntegrationConfigRecord = {
  enabled: boolean;
  baseUrl: string;
  authHeaderName: string;
  authHeaderValue: string;
  lastSyncSummary: HrIntegrationSyncSummary | null;
};

// What GET /api/admin/hr-integration actually returns: authHeaderValue is redacted to a boolean
// (hasCredential) so the configured API key/token is never round-tripped to the browser.
export type HrIntegrationConfigResponse = {
  enabled: boolean;
  baseUrl: string;
  authHeaderName: string;
  hasCredential: boolean;
  lastSyncSummary: HrIntegrationSyncSummary | null;
};

// authHeaderValue is optional and, when blank/omitted, leaves the currently stored credential
// untouched — the same "blank input = keep existing secret" convention used for password fields
// elsewhere in this app, so re-saving the base URL doesn't force re-entering the API key.
export type HrIntegrationConfigUpdateInput = {
  enabled: boolean;
  baseUrl: string;
  authHeaderName: string;
  authHeaderValue?: string;
};

// The JSON shape this LMS expects an external HR system's endpoint to return (an array of these).
// Deliberately close to EnrollmentStudentInput/the CSV bulk-upload template fields so the same
// validation and roster-merge logic can be shared between both import paths.
export type HrIntegrationRosterRecord = {
  email: string;
  name: string;
  surname: string;
  department: string;
  group: string;
  dateEnrolled: string;
  deadlineDate: string;
  jobTitle?: string;
  idNumber?: string;
  ofoCode?: string;
  race?: string;
  gender?: string;
  municipality?: string;
  dateOfBirth?: string;
  nqfLevel?: string;
  activeStatus?: 'Active' | 'Inactive';
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
  status: SubmissionReviewStatus;
  reviewerName: string | null;
  reviewerFeedback: string;
  reviewedAt: string | null;
};

export type StudentAssessmentAttemptRecord = {
  attemptsUsed: number;
  passed: boolean;
  lastScorePercentage: number;
  lastScoreEarned: number;
  lastScorePossible: number;
  lastSubmittedAt: string;
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
  status: SubmissionReviewStatus;
  reviewerName: string | null;
  reviewerFeedback: string;
  reviewedAt: string | null;
};

export type AuthAccountRecord = {
  id: string;
  role: LoginRole;
  username: string;
  email: string;
  route: string;
  passwordHash: string;
  passwordSalt: string;
  linkedStudentId?: string | null;
};

export type PasswordResetTokenRecord = {
  id: string;
  accountId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  sentAt: string;
  consumedAt: string | null;
};

export type QuizSubmissionAnswerRecord = {
  questionId: string;
  prompt: string;
  questionType: string;
  responseText: string;
  selectedOption: string;
  matchingResponses: Array<{
    prompt: string;
    answer: string;
  }>;
};

export type QuizSubmissionRecord = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseTitle: string;
  assessmentId: string;
  assessmentTitle: string;
  answers: QuizSubmissionAnswerRecord[];
  attemptsUsed: number;
  passed: boolean;
  scorePercentage: number;
  scoreEarned: number;
  scorePossible: number;
  submittedAt: string;
};

export type LmsDataStore = {
  offerings: TrainingOffering[];
  students: StudentRecord[];
  branding: BrandingSettingsRecord;
  trainingManagers: SystemTrainingManagerRecord[];
  managerMessages: ManagerMessageRecord[];
  mentorshipAssignments: MentorshipAssignmentRecord[];
  assignmentSubmissions: AssignmentSubmissionRecord[];
  mentorshipSubmissions: MentorshipSubmissionRecord[];
  quizSubmissions: QuizSubmissionRecord[];
  externalTrainingRequests: ExternalTrainingRequestRecord[];
  authAccounts: AuthAccountRecord[];
  passwordResetTokens: PasswordResetTokenRecord[];
  successionRoles: SuccessionRoleRecord[];
  successorNominations: SuccessorNominationRecord[];
  updatedAt: string;
  // Org-wide KPI review cycle: currentKpiYear is the one year anyone can still edit; every year a
  // manager has ever opened (including the current one) is recorded in kpiYearsOpened so a year
  // selector can be built without scanning every student's kpiYears. Defaults are seeded in
  // default-data.ts; migrated in from legacy per-student kpiEntries in normalizeData if missing.
  currentKpiYear: number;
  kpiYearsOpened: number[];
  hrIntegration: HrIntegrationConfigRecord;
};

export type LmsBootstrapResponse = {
  offerings: TrainingOffering[];
  branding: BrandingSettingsRecord;
  students: EnrollmentStudentRecord[];
  idpEntriesByStudent: Record<string, StudentIdpEntryRecord[]>;
  // Only the current year's entries — enough for the table everyone actually edits without
  // bloating bootstrap with every student's full KPI history. A past year's entries are fetched
  // on demand (GET /students/:studentId/kpi-entries/:year) only when a year selector picks one.
  kpiEntriesByStudent: Record<string, StudentKpiEntryRecord[]>;
  currentKpiYear: number;
  kpiYearsOpened: number[];
  trainingManagers: SystemTrainingManagerRecord[];
  managerMessages: ManagerMessageRecord[];
  mentorshipAssignments: MentorshipAssignmentRecord[];
  assignmentSubmissions: AssignmentSubmissionRecord[];
  mentorshipSubmissions: MentorshipSubmissionRecord[];
  quizSubmissions: QuizSubmissionRecord[];
  externalTrainingRequests: ExternalTrainingRequestRecord[];
  // Scoped per caller (see getBootstrap) — an admin gets every role/nomination, a manager only
  // those for roles they own, and a student gets neither array at all (their view is the single
  // successionStatus field on their own snapshot instead).
  successionRoles: SuccessionRoleRecord[];
  successorNominations: SuccessorNominationRecord[];
};

export type StudentSnapshotResponse = {
  studentId: string;
  profile: StudentProfileRecord;
  badgeState: StudentBadgeStateRecord;
  certificatesAndLicences: StudentCertificateLicenceRecord[];
  settings: StudentSettingsRecord;
  mentorshipProfile: StudentMentorshipProfileRecord;
  mentorshipObjectives: StudentMentorshipObjectivesRecord;
  mentorshipProgressReport: StudentMentorshipProgressReportRecord;
  courses: StudentCourseRecord[];
  notifications: StudentNotificationRecord[];
  messages: StudentMessageRecord[];
  notifiedOfferingIds: string[];
  assessmentAttempts: Record<string, StudentAssessmentAttemptRecord>;
  // Only an Active nomination surfaces here — Draft/Withdrawn are never returned to the learner,
  // and the role's owner manager / incumbent are deliberately omitted (see StudentSuccessionStatus).
  successionStatus: StudentSuccessionStatus | null;
  idpEntries?: StudentIdpEntryRecord[];
};

export type StudentSnapshotUpdate = {
  profile: StudentProfileRecord;
  badgeState: StudentBadgeStateRecord;
  certificatesAndLicences: StudentCertificateLicenceRecord[];
  settings: StudentSettingsRecord;
  mentorshipProfile: StudentMentorshipProfileRecord;
  mentorshipObjectives: StudentMentorshipObjectivesRecord;
  mentorshipProgressReport: StudentMentorshipProgressReportRecord;
  courses: StudentCourseRecord[];
  notifications: StudentNotificationRecord[];
  messages: StudentMessageRecord[];
  notifiedOfferingIds: string[];
  // Optional and ignored server-side if present — quiz results are graded and written
  // exclusively through the dedicated quiz-attempt grading endpoint, never through a snapshot
  // save. Kept optional (rather than removed) only so an older client mid-rollout can still
  // include it without the request being rejected.
  assessmentAttempts?: Record<string, StudentAssessmentAttemptRecord>;
  idpEntries?: StudentIdpEntryRecord[];
};

export type ManagerStatePatch = {
  students?: EnrollmentStudentRecord[];
  trainingManagers?: SystemTrainingManagerRecord[];
  managerMessages?: ManagerMessageRecord[];
  mentorshipAssignments?: MentorshipAssignmentRecord[];
  mentorshipSubmissions?: MentorshipSubmissionRecord[];
  externalTrainingRequests?: ExternalTrainingRequestRecord[];
};

export type LoginRequestInput = {
  role: LoginRole;
  username: string;
  password: string;
};

export type LoginResponse = {
  role: LoginRole;
  route: string;
  username: string;
  email: string;
  studentId?: string;
};

export type ManagedUserCredentialInput = {
  studentId: string;
  email: string;
  role: EnrollmentStudentRecord['role'];
  password: string;
};

export type ManagedUserCredentialsUpsertResponse = {
  created: number;
  updated: number;
  skipped: number;
};

export type PasswordResetRequestInput = {
  email: string;
};

export type PasswordResetRequestResponse = {
  message: string;
};

export type PasswordResetTokenStatus = {
  valid: boolean;
  email?: string;
  expiresAt?: string;
};

export type PasswordResetConfirmInput = {
  token: string;
  password: string;
};

export type BrandingSettingsUpdateInput = BrandingSettingsRecord;

export type ChangePasswordInput = {
  email: string;
  password: string;
};