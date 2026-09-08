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

// Admin-configurable required sign-off counts for the two multi-approver chains below. Defaulting
// both to 1 reproduces today's single-approver, immediately-final behavior exactly — see
// ApprovalChainStepRecord/KpiApprovalRecord and the chain fields on ExternalTrainingRequestRecord.
export type ApprovalWorkflowSettingsRecord = {
  kpiApproversRequired: number;
  trainingApproversRequired: number;
};

export type ApprovalWorkflowSettingsUpdateInput = ApprovalWorkflowSettingsRecord;

// One completed step in either approval chain below. approverEmail is what a reject's "reset back
// to the first approver" actually restores onto the chain's current-approver-email field — without
// it, that reset would have no way to recover the first approver's email once later steps had
// overwritten it.
export type ApprovalChainStepRecord = {
  approverId: string;
  approverName: string;
  approverEmail: string;
  decidedAt: string;
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
  // Multi-approver chain (see ApprovalWorkflowSettingsRecord.trainingApproversRequired). Optional
  // so a record created before this feature shipped (or while the setting is at its default of 1)
  // is indistinguishable from today's single-approver behavior — approvingManagerId/Name/Email
  // above still always means "the current, first, or only approver" either way.
  approvalHistory?: ApprovalChainStepRecord[];
  approvalsRequired?: number;
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
  // Required only when this approval isn't the chain's final step (approvalHistory.length + 1 <
  // approvalsRequired) — picks who reviews next. Ignored on a reject or a final approval.
  nextApproverId?: string;
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

// One IDP table per opened year — mirrors StudentKpiYearRecord below. Unlike KPI rows, IDP entries
// have no stable id and never need one: opening a new year always starts blank (no carry-forward),
// so every write to the current year's table is a full, unconditional replace of that year's array.
export type StudentIdpYearRecord = {
  year: number;
  entries: StudentIdpEntryRecord[];
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

// Lets the flagging manager correct the role's basics after the fact — e.g. the incumbent's own
// jobTitle string snapshotted at flagging time isn't the name they'd want on the succession board,
// or the position needs to move to a different team member. Incumbent must still be a real member
// of the manager's own team, same as at creation.
export type SuccessionRoleUpdateInput = {
  title: string;
  department: string;
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

// A sign-off on an entire KPI table for one review year (see
// ApprovalWorkflowSettingsRecord.kpiApproversRequired) — scoped to the whole table, not a single
// row, the same unit the Overall Performance Rating already treats as one thing. currentApproverId
// is the approver-pool entry (see resolveApprovingManagers/buildTrainingManagers);
// currentApproverEmail is what authorization actually checks against, since every identity check in
// this codebase resolves by email (AuthenticatedIdentity has no field that could match a pool id).
export type KpiApprovalStatus = 'Pending Approval' | 'Approved' | 'Needs Revision';

export type KpiApprovalRecord = {
  status: KpiApprovalStatus;
  approvalHistory: ApprovalChainStepRecord[];
  currentApproverId: string;
  currentApproverName: string;
  currentApproverEmail: string;
  approvalsRequired: number;
};

// One KPI table per opened year. Only the org-wide current year (LmsDataStore.currentKpiYear) is
// ever editable; every other year in this array is a closed, read-only historical record — see
// openKpiYear in repository.ts, which is the only thing that ever adds a new entry here.
export type StudentKpiYearRecord = {
  year: number;
  entries: StudentKpiEntryRecord[];
  // Absent whenever kpiApproversRequired is 1 (the default) — a table with no approval object
  // behaves exactly as it did before this feature existed.
  approval?: KpiApprovalRecord;
};

export type OpenKpiYearInput = {
  year: number;
};

export type SubmitKpiTableForApprovalInput = {
  nextApproverId: string;
};

export type KpiApprovalDecisionInput = {
  decision: 'Approved' | 'Needs Revision';
  // Required only when approving a non-final step — same rule as
  // ExternalTrainingRequestReviewInput.nextApproverId.
  nextApproverId?: string;
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
  // Legacy: one flat, un-yeared IDP table. Migrated into idpYears on first read once the year
  // feature is live (see normalizeStudentIdpYears in repository.ts) — never written again after
  // that.
  idpEntries?: StudentIdpEntryRecord[];
  idpYears?: StudentIdpYearRecord[];
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
  // Which company this account belongs to (companies/{companyId}, the same id this record's own
  // document already lives under as companies/{companyId}/authAccounts/{id}). Stored explicitly,
  // not just implied by the Firestore path, because login/resolve-roles/SSO run before any
  // companyId is known — they resolve it via a collection-group query on usernameLower/emailLower
  // across every company's authAccounts, then need it as an explicit JWT claim afterward (a JWT
  // can't carry Firestore path ancestry).
  companyId: string;
  usernameLower: string;
  emailLower: string;
};

export type PasswordResetTokenRecord = {
  id: string;
  accountId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  sentAt: string;
  consumedAt: string | null;
  // Same reasoning as AuthAccountRecord.companyId — password-reset validate/confirm only ever
  // receive a token, so the company has to be resolved via a collection-group query on tokenHash
  // before this record's own company-scoped repository can be constructed.
  companyId: string;
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
  // Same shape as the KPI review cycle above, for IDPs — see StudentIdpYearRecord.
  currentIdpYear: number;
  idpYearsOpened: number[];
  hrIntegration: HrIntegrationConfigRecord;
  approvalWorkflowSettings: ApprovalWorkflowSettingsRecord;
};

export type LmsBootstrapResponse = {
  offerings: TrainingOffering[];
  branding: BrandingSettingsRecord;
  students: EnrollmentStudentRecord[];
  // Only the current year's entries — same "fetch a past year on demand" convention as
  // kpiEntriesByStudent below (GET /students/:studentId/idp-entries/:year).
  idpEntriesByStudent: Record<string, StudentIdpEntryRecord[]>;
  currentIdpYear: number;
  idpYearsOpened: number[];
  // Only the current year's entries — enough for the table everyone actually edits without
  // bloating bootstrap with every student's full KPI history. A past year's entries are fetched
  // on demand (GET /students/:studentId/kpi-entries/:year) only when a year selector picks one.
  kpiEntriesByStudent: Record<string, StudentKpiEntryRecord[]>;
  currentKpiYear: number;
  kpiYearsOpened: number[];
  // Readable by every role (unlike hrIntegration, which never rides along in bootstrap) — a
  // manager needs kpiApproversRequired/trainingApproversRequired just to know whether to show a
  // "Submit for Approval" action at all. Only an admin can change it (PUT
  // /api/approval-workflow-settings).
  approvalWorkflowSettings: ApprovalWorkflowSettingsRecord;
  // Current-year KPI approval state per student — null when kpiApproversRequired is 1 (the
  // default) or the table hasn't been submitted for approval yet. Kept as its own field rather
  // than riding along inside kpiEntriesByStudent's year bucket, since that projection only ever
  // carries the entries array, never the year record's other fields (see StudentKpiYearRecord).
  kpiApprovalByStudent: Record<string, KpiApprovalRecord | null>;
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
  // IDP entries have their own dedicated, year-scoped endpoints (setIdpEntriesForStudent /
  // getIdpEntriesForStudentYear / openIdpYear) rather than riding along here — see the KPI
  // fields' absence from this same type for the identical reasoning (repository.ts's
  // updateStudentSnapshot comment documents the lost-update race this generic endpoint caused
  // before KPI was pulled out of it).
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

// --- Multi-tenant / licensing (Phase 1: types only — not yet wired into LmsDataStore,
// the repository, or any route. See the "Multi-Company / Multi-Tenant Retrofit" plan.) ---

export type SubscriptionPlan = 'starter' | 'growth' | 'enterprise';

// 'expired' is intentionally not a stored status — it's derived at request time from
// endDate, matching the "fail-closed on anything other than exactly 'active'" convention
// this system uses elsewhere for gating.
export type SubscriptionStatus = 'active' | 'suspended' | 'cancelled';

export type SubscriptionRecord = {
  plan: SubscriptionPlan;
  // Counts all users of every role (administrator + training-manager + student) combined.
  licenseLimit: number;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
};

// Mirrors LmsDataStore's current root-singleton fields (branding, KPI/IDP year state, HR
// integration, approval workflow settings) plus the new company identity/subscription
// fields — this is what each `companies/{companyId}` document holds once the repository
// is retargeted from the single shared `lmsStores/primary` document.
export type CompanyRecord = {
  id: string;
  name: string;
  createdAt: string;
  createdBySuperAdminId: string;
  subscription: SubscriptionRecord;
};

export type PlatformRole = 'super-admin';

export type PlatformAdminRecord = {
  id: string;
  role: PlatformRole;
  name: string;
  email: string;
  emailLower: string;
  passwordHash: string;
  passwordSalt: string;
};

// --- Phase 3: Super Admin API request/response shapes ---

export type PlatformLoginInput = {
  email: string;
  password: string;
};

export type PlatformAuthenticatedResponse = {
  adminId: string;
  name: string;
  email: string;
  token: string;
};

export type CreateCompanyInput = {
  name: string;
  plan: SubscriptionPlan;
  licenseLimit: number;
  startDate: string;
  endDate: string;
};

export type UpdateCompanySubscriptionInput = {
  plan?: SubscriptionPlan;
  licenseLimit?: number;
  startDate?: string;
  endDate?: string;
  status?: SubscriptionStatus;
};

// No name field — AuthAccountRecord itself has none (an account's display name is always derived
// from a linked student profile, created on that admin's first login; see ensureSwitchStudentProfile
// in repository.ts). Matches how the system's own default seeded admin account already behaves.
export type CreateCompanyAdminInput = {
  email: string;
  password: string;
};

export type CompanyUsageSummary = {
  userCount: number;
  licenseLimit: number;
};

export type CompanyWithUsage = CompanyRecord & {
  usage: CompanyUsageSummary;
};