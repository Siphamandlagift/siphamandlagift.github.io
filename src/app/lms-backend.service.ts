import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, inject } from '@angular/core';
import { Observable, switchMap, map, catchError } from 'rxjs';
import { FirebaseStorageService, UploadEvent } from './firebase-storage.service';
import { LMS_API_CONFIG, LmsApiConfig } from './lms-api.config';
import type {
  AssignmentSubmissionRecord,
  EnrollmentStudent,
  ExternalTrainingRequestCreateInput,
  ExternalTrainingRequestRecord,
  ExternalTrainingRequestReviewInput,
  ExternalTrainingRequestUpdateInput,
  ManagerMessage,
  MentorshipAssignmentRecord,
  MentorshipSubmissionRecord,
  StudentIdpEntry,
  SystemTrainingManager,
  TrainingOffering,
  TrainingQuestionType,
  TrainingOfferingUpdate,
} from './training-manager-data.service';
import type {
  StudentAssessmentAttempt,
  StudentBadgeState,
  StudentCertificateLicence,
  StudentCourse,
  StudentMentorshipObjectives,
  StudentMentorshipProfile,
  StudentMentorshipProgressReport,
  StudentMessage,
  StudentNotification,
  StudentSettingsData,
  StudentProfileData,
} from './student-data.service';

export type LmsBrandThemeId = 'ocean' | 'forest' | 'sunrise' | 'purple' | 'black' | 'grey';

export type LmsBootstrapResponse = {
  offerings: TrainingOffering[];
  branding: BrandingSettings;
  students: EnrollmentStudent[];
  idpEntriesByStudent?: Record<string, StudentIdpEntry[]>;
  trainingManagers: SystemTrainingManager[];
  managerMessages: ManagerMessage[];
  mentorshipAssignments: MentorshipAssignmentRecord[];
  assignmentSubmissions: AssignmentSubmissionRecord[];
  mentorshipSubmissions: MentorshipSubmissionRecord[];
  quizSubmissions?: QuizSubmissionRecord[];
  externalTrainingRequests: ExternalTrainingRequestRecord[];
};

export type QuizSubmissionAnswer = {
  questionId: string;
  prompt: string;
  questionType: TrainingQuestionType;
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
  answers: QuizSubmissionAnswer[];
  attemptsUsed: number;
  passed: boolean;
  scorePercentage: number;
  scoreEarned: number;
  scorePossible: number;
  submittedAt: string;
};

export type StudentSnapshotResponse = {
  studentId: string;
  profile: StudentProfileData;
  badgeState: StudentBadgeState;
  certificatesAndLicences: StudentCertificateLicence[];
  settings: StudentSettingsData;
  mentorshipProfile: StudentMentorshipProfile;
  mentorshipObjectives: StudentMentorshipObjectives;
  mentorshipProgressReport: StudentMentorshipProgressReport;
  courses: StudentCourse[];
  notifications: StudentNotification[];
  messages: StudentMessage[];
  notifiedOfferingIds: string[];
  assessmentAttempts: Record<string, StudentAssessmentAttempt>;
  idpEntries?: StudentIdpEntry[];
};

export type StudentSnapshotUpdate = Omit<StudentSnapshotResponse, 'studentId'>;

export type ScormUploadResponse = {
  packageId: string;
  entryPath: string;
  launchUrl: string;
};

export type ManagerStatePatch = {
  students?: EnrollmentStudent[];
  trainingManagers?: SystemTrainingManager[];
  managerMessages?: ManagerMessage[];
  mentorshipAssignments?: MentorshipAssignmentRecord[];
  mentorshipSubmissions?: MentorshipSubmissionRecord[];
  externalTrainingRequests?: ExternalTrainingRequestRecord[];
};

export type LoginRole = 'administrator' | 'training-manager' | 'student';

export type LoginRequest = {
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
  token: string;
};

export type ResolveRolesRequest = {
  username: string;
  password: string;
};

export type ResolveRolesEntry = {
  role: LoginRole;
  route: string;
  username: string;
  email: string;
  studentId?: string;
  token: string;
};

export type ResolveRolesResponse = {
  roles: ResolveRolesEntry[];
};

export type ManagedUserCredentialInput = {
  studentId: string;
  email: string;
  role: 'student' | 'manager' | 'admin';
  password: string;
};

export type ManagedUserCredentialsUpsertRequest = {
  users: ManagedUserCredentialInput[];
};

export type ManagedUserCredentialsUpsertResponse = {
  created: number;
  updated: number;
  skipped: number;
};

export type PasswordResetRequest = {
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

export type PasswordResetConfirmRequest = {
  token: string;
  password: string;
};

export type PasswordResetConfirmResponse = {
  message: string;
  username: string;
  route: string;
  role: LoginRole;
  email: string;
};

export type BrandingSettings = {
  themeId: LmsBrandThemeId;
  companyLogoDataUrl: string | null;
};

export type ChangePasswordRequest = {
  email: string;
  password: string;
};

export type ChangePasswordResponse = PasswordResetConfirmResponse;

@Injectable({ providedIn: 'root' })
export class LmsBackendService {
  private readonly http = inject(HttpClient);
  private readonly firebaseStorage = inject(FirebaseStorageService);

  constructor(@Inject(LMS_API_CONFIG) private readonly config: LmsApiConfig) {}

  get healthUrl() {
    return this.config.baseUrl.replace(/\/api$/, '') + '/health';
  }

  get defaultStudentId() {
    return this.config.defaultStudentId;
  }

  getBootstrap(): Observable<LmsBootstrapResponse> {
    return this.http.get<LmsBootstrapResponse>(`${this.config.baseUrl}/bootstrap`);
  }

  login(input: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.config.baseUrl}/auth/login`, input);
  }

  resolveRoles(input: ResolveRolesRequest): Observable<ResolveRolesResponse> {
    return this.http.post<ResolveRolesResponse>(`${this.config.baseUrl}/auth/resolve-roles`, input);
  }

  switchRole(targetRole: LoginRole): Observable<ResolveRolesEntry> {
    return this.http.post<ResolveRolesEntry>(`${this.config.baseUrl}/auth/switch-role`, { targetRole });
  }

  microsoftSsoStartUrl(role?: LoginRole): string {
    const target = new URL(`${this.config.baseUrl}/auth/sso/microsoft/start`, window.location.origin);
    if (role) {
      target.searchParams.set('role', role);
    }
    return target.toString();
  }

  requestPasswordReset(input: PasswordResetRequest): Observable<PasswordResetRequestResponse> {
    return this.http.post<PasswordResetRequestResponse>(`${this.config.baseUrl}/auth/password-reset/request`, input);
  }

  validatePasswordResetToken(token: string): Observable<PasswordResetTokenStatus> {
    return this.http.get<PasswordResetTokenStatus>(`${this.config.baseUrl}/auth/password-reset/validate`, {
      params: { token },
    });
  }

  confirmPasswordReset(input: PasswordResetConfirmRequest): Observable<PasswordResetConfirmResponse> {
    return this.http.post<PasswordResetConfirmResponse>(`${this.config.baseUrl}/auth/password-reset/confirm`, input);
  }

  changePassword(input: ChangePasswordRequest): Observable<ChangePasswordResponse> {
    return this.http.post<ChangePasswordResponse>(`${this.config.baseUrl}/auth/change-password`, input);
  }

  upsertManagedUserCredentials(input: ManagedUserCredentialsUpsertRequest): Observable<ManagedUserCredentialsUpsertResponse> {
    return this.http.post<ManagedUserCredentialsUpsertResponse>(`${this.config.baseUrl}/auth/managed-users/credentials`, input);
  }

  getBranding(): Observable<BrandingSettings> {
    return this.http.get<BrandingSettings>(`${this.config.baseUrl}/branding`);
  }

  updateBranding(input: BrandingSettings): Observable<BrandingSettings> {
    return this.http.put<BrandingSettings>(`${this.config.baseUrl}/branding`, input);
  }

  getOfferings(): Observable<TrainingOffering[]> {
    return this.http.get<TrainingOffering[]>(`${this.config.baseUrl}/offerings`);
  }

  createOffering(offering: TrainingOffering): Observable<TrainingOffering> {
    return this.http.post<TrainingOffering>(`${this.config.baseUrl}/offerings`, offering);
  }

  updateOffering(update: TrainingOfferingUpdate): Observable<TrainingOffering> {
    return this.http.put<TrainingOffering>(`${this.config.baseUrl}/offerings/${update.id}`, update);
  }

  deleteOffering(offeringId: string): Observable<void> {
    return this.http.delete<void>(`${this.config.baseUrl}/offerings/${offeringId}`);
  }

  uploadFile(file: File, folder: string): Observable<{ url: string; path: string }> {
    return this.firebaseStorage.upload(file, folder);
  }

  /** Emits progress events (`{ type: 'progress', percent: number }`) while uploading,
   *  then a final completion event (`{ type: 'complete', url, path }`). */
  uploadFileWithProgress(file: File, folder: string): Observable<UploadEvent> {
    return this.firebaseStorage.uploadWithProgress(file, folder);
  }

  uploadScormPackage(file: File): Observable<ScormUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ScormUploadResponse>(`${this.config.baseUrl}/storage/upload-scorm`, formData);
  }

  convertPptxToPdf(file: File): Observable<{ pdfUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ pdfUrl: string }>(`${this.config.baseUrl}/storage/convert-pptx`, formData);
  }

  getStudentSnapshot(studentId = this.config.defaultStudentId): Observable<StudentSnapshotResponse> {
    return this.http.get<StudentSnapshotResponse>(`${this.config.baseUrl}/students/${studentId}/snapshot`);
  }

  updateStudentSnapshot(snapshot: StudentSnapshotUpdate, studentId = this.config.defaultStudentId): Observable<StudentSnapshotResponse> {
    return this.http.put<StudentSnapshotResponse>(`${this.config.baseUrl}/students/${studentId}/snapshot`, snapshot);
  }

  patchManagerState(patch: ManagerStatePatch): Observable<unknown> {
    return this.http.put(`${this.config.baseUrl}/manager-state`, patch);
  }

  postManagerMessage(message: ManagerMessage): Observable<ManagerMessage> {
    return this.http.post<ManagerMessage>(`${this.config.baseUrl}/manager-messages`, message);
  }

  getManagerMessages(): Observable<ManagerMessage[]> {
    return this.http.get<ManagerMessage[]>(`${this.config.baseUrl}/manager-messages`);
  }

  createExternalTrainingRequest(input: ExternalTrainingRequestCreateInput): Observable<ExternalTrainingRequestRecord> {
    return this.http.post<ExternalTrainingRequestRecord>(`${this.config.baseUrl}/external-training-requests`, input);
  }

  updateExternalTrainingRequest(input: ExternalTrainingRequestUpdateInput): Observable<ExternalTrainingRequestRecord> {
    return this.http.put<ExternalTrainingRequestRecord>(`${this.config.baseUrl}/external-training-requests/${input.requestId}`, input);
  }

  reviewExternalTrainingRequest(input: ExternalTrainingRequestReviewInput): Observable<ExternalTrainingRequestRecord> {
    return this.http.put<ExternalTrainingRequestRecord>(`${this.config.baseUrl}/external-training-requests/${input.requestId}/review`, input);
  }

  getAssignmentSubmissions(): Observable<AssignmentSubmissionRecord[]> {
    return this.http.get<AssignmentSubmissionRecord[]>(`${this.config.baseUrl}/assignment-submissions`);
  }

  upsertAssignmentSubmission(submission: AssignmentSubmissionRecord): Observable<AssignmentSubmissionRecord> {
    return this.http.post<AssignmentSubmissionRecord>(`${this.config.baseUrl}/assignment-submissions`, submission);
  }

  upsertQuizSubmission(submission: QuizSubmissionRecord): Observable<QuizSubmissionRecord> {
    return this.http.post<QuizSubmissionRecord>(`${this.config.baseUrl}/quiz-submissions`, submission);
  }

  upsertMentorshipSubmission(submission: MentorshipSubmissionRecord): Observable<MentorshipSubmissionRecord> {
    return this.http.post<MentorshipSubmissionRecord>(`${this.config.baseUrl}/mentorship-submissions`, submission);
  }
}