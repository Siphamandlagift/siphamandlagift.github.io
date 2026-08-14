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
  themePreference: LmsBrandThemeId;
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
};

export type BrandingSettingsRecord = {
  themeId: 'ocean' | 'forest' | 'sunrise' | 'purple' | 'black' | 'grey';
  companyLogoDataUrl: string | null;
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
  updatedAt: string;
};

export type LmsBootstrapResponse = {
  offerings: TrainingOffering[];
  branding: BrandingSettingsRecord;
  students: EnrollmentStudentRecord[];
  idpEntriesByStudent: Record<string, StudentIdpEntryRecord[]>;
  trainingManagers: SystemTrainingManagerRecord[];
  managerMessages: ManagerMessageRecord[];
  mentorshipAssignments: MentorshipAssignmentRecord[];
  assignmentSubmissions: AssignmentSubmissionRecord[];
  mentorshipSubmissions: MentorshipSubmissionRecord[];
  quizSubmissions: QuizSubmissionRecord[];
  externalTrainingRequests: ExternalTrainingRequestRecord[];
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
  assessmentAttempts: Record<string, StudentAssessmentAttemptRecord>;
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