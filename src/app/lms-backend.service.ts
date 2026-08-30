import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, inject } from '@angular/core';
import { Observable, switchMap, map, catchError } from 'rxjs';
import { FirebaseStorageService, UploadEvent } from './firebase-storage.service';
import { LMS_API_CONFIG, LmsApiConfig } from './lms-api.config';
import type {
  AssignmentSubmissionRecord,
  EnrollmentStudent,
  ExternalTrainingRequestCreateInput,
  ExternalTrainingRequestDocumentsInput,
  ExternalTrainingRequestRecord,
  ExternalTrainingRequestReviewInput,
  ExternalTrainingRequestUpdateInput,
  ManagerMessage,
  MentorshipAssignmentRecord,
  MentorshipSubmissionRecord,
  StudentIdpEntry,
  StudentKpiEntry,
  SuccessionRoleInput,
  SuccessionRoleRecord,
  SuccessorNominationCreateInput,
  SuccessorNominationRecord,
  SuccessorNominationUpdateInput,
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
  StudentSuccessionStatus,
} from './student-data.service';

export type LmsBrandThemeId = 'ocean' | 'forest' | 'sunrise' | 'purple' | 'black' | 'grey';

export type LmsBootstrapResponse = {
  offerings: TrainingOffering[];
  branding: BrandingSettings;
  students: EnrollmentStudent[];
  idpEntriesByStudent?: Record<string, StudentIdpEntry[]>;
  // Current year's entries only — a past year is fetched on demand via getKpiEntriesForYear.
  kpiEntriesByStudent?: Record<string, StudentKpiEntry[]>;
  currentKpiYear?: number;
  kpiYearsOpened?: number[];
  trainingManagers: SystemTrainingManager[];
  managerMessages: ManagerMessage[];
  mentorshipAssignments: MentorshipAssignmentRecord[];
  assignmentSubmissions: AssignmentSubmissionRecord[];
  mentorshipSubmissions: MentorshipSubmissionRecord[];
  quizSubmissions?: QuizSubmissionRecord[];
  externalTrainingRequests: ExternalTrainingRequestRecord[];
  successionRoles?: SuccessionRoleRecord[];
  successorNominations?: SuccessorNominationRecord[];
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
  // Server-computed (see repository.computeSuccessionStatus) — only an Active nomination for this
  // learner ever surfaces here, never the nominator's or the role's incumbent's identity.
  successionStatus?: StudentSuccessionStatus | null;
};

// assessmentAttempts is optional (unlike on StudentSnapshotResponse, which the server still
// returns it on) — the server ignores it on this path now and writes it exclusively through
// gradeQuizAttempt, so a snapshot save no longer needs to carry it. successionStatus is likewise
// excluded — it's server-computed and never client-writable.
export type StudentSnapshotUpdate = Omit<StudentSnapshotResponse, 'studentId' | 'assessmentAttempts' | 'successionStatus'> & {
  assessmentAttempts?: Record<string, StudentAssessmentAttempt>;
};

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
  name?: string;
  surname?: string;
  token: string;
};

export type ResolveRolesResponse = {
  roles: ResolveRolesEntry[];
};

export type SwitchableRolesResponse = {
  roles: LoginRole[];
};

export type MyIdentityResponse = {
  name: string | null;
  surname: string | null;
  profileImageUrl: string | null;
  profileImageDataUrl: string | null;
};

export type MyProfileImageUpdate = {
  profileImageUrl?: string | null;
  profileImageDataUrl?: string | null;
};

export type ManagedUserCredentialInput = {
  studentId: string;
  email: string;
  role: 'student' | 'manager';
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

export type HrIntegrationSyncSummary = {
  added: number;
  updated: number;
  skipped: number;
  issues: string[];
  syncedAt: string;
};

// authHeaderValue is never included — the server redacts it to hasCredential. See
// redactHrIntegrationConfig in repository.ts.
export type HrIntegrationConfig = {
  enabled: boolean;
  baseUrl: string;
  authHeaderName: string;
  hasCredential: boolean;
  lastSyncSummary: HrIntegrationSyncSummary | null;
};

export type HrIntegrationConfigUpdate = {
  enabled: boolean;
  baseUrl: string;
  authHeaderName: string;
  // Blank/omitted keeps the currently stored credential unchanged.
  authHeaderValue?: string;
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

  getSwitchableRoles(): Observable<SwitchableRolesResponse> {
    return this.http.get<SwitchableRolesResponse>(`${this.config.baseUrl}/auth/switchable-roles`);
  }

  getMyIdentity(): Observable<MyIdentityResponse> {
    return this.http.get<MyIdentityResponse>(`${this.config.baseUrl}/auth/my-identity`);
  }

  updateMyProfileImage(update: MyProfileImageUpdate): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.config.baseUrl}/auth/my-profile-image`, update);
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

  getHrIntegrationConfig(): Observable<HrIntegrationConfig> {
    return this.http.get<HrIntegrationConfig>(`${this.config.baseUrl}/admin/hr-integration`);
  }

  updateHrIntegrationConfig(input: HrIntegrationConfigUpdate): Observable<HrIntegrationConfig> {
    return this.http.put<HrIntegrationConfig>(`${this.config.baseUrl}/admin/hr-integration`, input);
  }

  syncHrRoster(): Observable<HrIntegrationSyncSummary> {
    return this.http.post<HrIntegrationSyncSummary>(`${this.config.baseUrl}/admin/hr-integration/sync`, {});
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

  /** Uploads small files (e.g. the branding logo) as base64 JSON. Avoids both the
   *  Cloud Functions multer/multipart bug and the direct-to-GCS CORS dependency —
   *  see the /storage/upload-base64 server route for details. Not for large files:
   *  base64 adds ~33% overhead against the server's 50 MB JSON body limit. */
  uploadFileBase64(file: File, folder: string): Observable<{ url: string; path: string }> {
    return new Observable((observer) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const dataBase64 = result.slice(result.indexOf(',') + 1);
        this.http.post<{ url: string; path: string }>(`${this.config.baseUrl}/storage/upload-base64`, {
          folder,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          dataBase64,
        }).subscribe(observer);
      };
      reader.onerror = () => observer.error(reader.error ?? new Error('Could not read the selected file.'));
      reader.readAsDataURL(file);
    });
  }

  /** Emits progress events (`{ type: 'progress', percent: number }`) while uploading,
   *  then a final completion event (`{ type: 'complete', url, path }`). */
  uploadFileWithProgress(file: File, folder: string): Observable<UploadEvent> {
    return this.firebaseStorage.uploadWithProgress(file, folder);
  }

  /** Uploads a file in chunks relayed through our own server — no practical file-size limit,
   *  and avoids a GCS CORS quirk that makes direct-to-storage uploads unreliable. Same event
   *  shape as uploadFileWithProgress. */
  uploadFileChunked(file: File, folder: string): Observable<UploadEvent> {
    return this.firebaseStorage.uploadChunked(file, folder);
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

  setKpiEntries(studentId: string, entries: StudentKpiEntry[]): Observable<StudentKpiEntry[]> {
    return this.http.put<{ entries: StudentKpiEntry[] }>(`${this.config.baseUrl}/students/${studentId}/kpi-entries`, { entries })
      .pipe(map((response) => response.entries));
  }

  updateKpiGapAnalysis(
    studentId: string,
    updates: { id: string; gapInitiative: string; gapComments: string; gapTargetDate: string }[],
  ): Observable<StudentKpiEntry[]> {
    return this.http.put<{ entries: StudentKpiEntry[] }>(`${this.config.baseUrl}/students/${studentId}/kpi-entries/gap-analysis`, { entries: updates })
      .pipe(map((response) => response.entries));
  }

  // Bootstrap only carries the current year's entries — this fetches any other (or the current)
  // year on demand, e.g. when a year selector picks a past year to browse.
  getKpiEntriesForYear(studentId: string, year: number): Observable<StudentKpiEntry[]> {
    return this.http.get<{ entries: StudentKpiEntry[] }>(`${this.config.baseUrl}/students/${studentId}/kpi-entries/${year}`)
      .pipe(map((response) => response.entries));
  }

  openKpiYear(year: number): Observable<{ currentKpiYear: number; kpiYearsOpened: number[] }> {
    return this.http.post<{ currentKpiYear: number; kpiYearsOpened: number[] }>(`${this.config.baseUrl}/kpi-years/open`, { year });
  }

  createSuccessionRole(input: SuccessionRoleInput): Observable<SuccessionRoleRecord> {
    return this.http.post<SuccessionRoleRecord>(`${this.config.baseUrl}/succession/roles`, input);
  }

  deleteSuccessionRole(roleId: string): Observable<void> {
    return this.http.delete<void>(`${this.config.baseUrl}/succession/roles/${roleId}`);
  }

  createSuccessorNomination(input: SuccessorNominationCreateInput): Observable<SuccessorNominationRecord> {
    return this.http.post<SuccessorNominationRecord>(`${this.config.baseUrl}/succession/nominations`, input);
  }

  updateSuccessorNomination(nominationId: string, input: SuccessorNominationUpdateInput): Observable<SuccessorNominationRecord> {
    return this.http.put<SuccessorNominationRecord>(`${this.config.baseUrl}/succession/nominations/${nominationId}`, input);
  }

  setSuccessorNominationStatus(nominationId: string, status: SuccessorNominationRecord['status']): Observable<SuccessorNominationRecord> {
    return this.http.put<SuccessorNominationRecord>(`${this.config.baseUrl}/succession/nominations/${nominationId}/status`, { status });
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

  attachExternalTrainingRequestDocuments(input: ExternalTrainingRequestDocumentsInput): Observable<ExternalTrainingRequestRecord> {
    return this.http.put<ExternalTrainingRequestRecord>(`${this.config.baseUrl}/external-training-requests/${input.requestId}/documents`, input);
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

  // Grades a quiz attempt server-side — the server looks up the offering's own copy of the
  // questions/answer key and returns the resulting attempt; this never sends (and the server
  // never trusts) a passed/score value computed here.
  gradeQuizAttempt(studentId: string, offeringId: string, contentItemId: string, answers: QuizSubmissionAnswer[]): Observable<StudentAssessmentAttempt> {
    return this.http.post<StudentAssessmentAttempt>(
      `${this.config.baseUrl}/students/${studentId}/quiz-attempts/${contentItemId}`,
      { offeringId, answers },
    );
  }

  upsertMentorshipSubmission(submission: MentorshipSubmissionRecord): Observable<MentorshipSubmissionRecord> {
    return this.http.post<MentorshipSubmissionRecord>(`${this.config.baseUrl}/mentorship-submissions`, submission);
  }
}