  // ...existing imports and type definitions...
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, interval } from 'rxjs';
import {
  AssignmentSubmissionRecord,
  EnrollmentStudent,
  EnrollmentStudentInput,
  ExternalTrainingRequestRecord,
  StudentIdpEntry,
  SuccessionReadinessRating,
  SuccessionRoleRecord,
  SystemTrainingManager,
  TrainingAssessmentChoice,
  TrainingAssessmentType,
  TrainingContentKind,
  TrainingManagerDataService,
  TrainingMatchingPair,
  TrainingOffering,
  TrainingOfferingType,
  TrainingQuestionType,
} from './training-manager-data.service';
import { LmsBackendService, type HrIntegrationConfig, type HrIntegrationConfigUpdate, type HrIntegrationSyncSummary, type LoginRole, type ManagedUserCredentialInput, type ResolveRolesEntry } from './lms-backend.service';
import { LmsBrandThemeId, LmsBrandingService } from './lms-branding.service';
import type { StudentCertificateLicence, StudentCertificateStatus, StudentCourse } from './student-data.service';
import { clearLmsAuthSession, combineDisplayName, createLmsSessionRecord, readLmsSessionRecord } from './session-auth';
import { LogoutConfirmDialogComponent } from './logout-confirm-dialog.component';
import { LoadingSpinnerComponent } from './loading-spinner.component';
import { PublishedOfferingDetailComponent } from './published-offering-detail.component';
import { PublishedOfferingCardComponent } from './published-offering-card.component';
import { PowerPointWindowComponent } from './powerpoint-window.component';
import { resolvePowerPointUploadType } from './powerpoint-preview';

type AdminPanel = 'dashboard' | 'users' | 'reports' | 'succession' | 'settings' | 'courses' | 'enrollment';

// ── Courses panel types (relocated from training-manager-profile.component.ts) ────
type CoursesPanelView = 'create' | 'created' | 'submissions';
type AssignmentSubmissionFilter = 'All' | 'Pending Review' | 'Approved' | 'Needs Revision';
type CreateCourseSection = 'basics' | 'content';

// ── Student Enrollment panel types (relocated from training-manager-profile.component.ts) ──
type EnrollmentPanelView = 'students' | 'groups';
type AssignWizardStep = 1 | 2 | 3;
type EnrollmentGroupSummary = {
  name: string;
  members: EnrollmentStudent[];
  activeCount: number;
  startDate: string;
  endDate: string;
};

type AssessmentChoiceFormGroup = FormGroup<{
  text: FormControl<string>;
  points: FormControl<number>;
  isCorrect: FormControl<boolean>;
}>;

type AssessmentQuestionFormGroup = FormGroup<{
  prompt: FormControl<string>;
  questionType: FormControl<TrainingQuestionType>;
  points: FormControl<number>;
  choices: FormArray<AssessmentChoiceFormGroup>;
  matchingPairs: FormArray<MatchingPairFormGroup>;
  dragAndDropEnabled: FormControl<boolean>;
  attachmentFileName: FormControl<string>;
  attachmentDataUrl: FormControl<string>;
}>;

type MatchingPairFormGroup = FormGroup<{
  prompt: FormControl<string>;
  answer: FormControl<string>;
}>;

type ContentItemFormGroup = FormGroup<{
  id: FormControl<string>;
  kind: FormControl<TrainingContentKind>;
  title: FormControl<string>;
  assessmentType: FormControl<TrainingAssessmentType | null>;
  passMarkPercentage: FormControl<number>;
  maxAttempts: FormControl<number>;
  resourceLink: FormControl<string>;
  uploadedFileName: FormControl<string>;
  uploadedFileDataUrl: FormControl<string>;
  convertedPdfUrl: FormControl<string>;
  requiresAcknowledgement: FormControl<boolean>;
  allowDownload: FormControl<boolean>;
  durationSeconds: FormControl<number | null>;
  questions: FormArray<AssessmentQuestionFormGroup>;
}>;

type PowerPointPreviewState = {
  fileName: string;
  message: string;
};

type SuccessionOrgNode = { role: SuccessionRoleRecord; children: SuccessionOrgNode[] };

type BulkUploadIssue = {
  lineNumber: number;
  message: string;
};

type AdminSettingsSection = 'profile-picture' | 'company-logo' | 'theme' | 'hr-integration' | 'approval-settings';
type ReportDownloadFormat = 'CSV' | 'XLSX';
type AdminReportView = 'annual-training' | 'idp-report' | 'performance-report' | 'certificate-licence-report' | 'seta-report';
type TrainingReportSource = 'All' | 'LMS' | 'External';
type SetaReportTab = 'atr' | 'wsp';
type AtrSubReport = 'beneficiaries-completed' | 'number-beneficiaries' | 'pivotal-actual';
type WspSubReport = 'beneficiaries-planned' | 'employment-summary' | 'pivotal-planned';
type CompletedTrainingEvent = { request: ExternalTrainingRequestRecord; student: EnrollmentStudent | undefined };

// A row parsed from the training-record bulk-upload file, resolved and validated (learner email
// matched to a real student, training type normalized against the 4-value enum) — ready to hand
// to POST /api/external-training-requests. Kept alongside its source line number so a failure at
// the save step (network/server error, not a parsing issue) can still point at the right row.
type TrainingRecordUploadRow = {
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseName: string;
  provider: string;
  trainingType: 'Accredited' | 'Workshop/Seminar' | 'Informal Training' | 'Short Course';
  trainingStartDate: string;
  trainingEndDate: string;
};
type PlannedTrainingEvent = { student: EnrollmentStudent; nameOfLearningProgramme: string; typeOfLearningProgramme: string };

// The consolidated Training Report merges two very different "training occurred" signals into
// one row shape: approved external training requests, and completed internal LMS courses (with
// an assignment mark where the completion was assignment-driven). sourceId keeps the real
// underlying record id (external request id, or student::offering) separate from the row's
// synthetic display id so actions like "Upload Proof" can still target the right record.
type ConsolidatedTrainingReportRow = {
  id: string;
  sourceId: string;
  learnerName: string;
  learnerEmail: string;
  idNumber: string;
  jobTitle: string;
  department: string;
  ofoCode: string;
  race: string;
  gender: string;
  municipality: string;
  trainingItem: string;
  source: 'LMS' | 'External';
  trainingType: string;
  result: string;
  provider: string;
  date: string;
  dateValue: string;
  status: string;
};

type IdpReportRow = {
  id: string;
  name: string;
  surname: string;
  idNumber: string;
  jobTitle: string;
  ofoCode: string;
  race: string;
  gender: string;
  municipality: string;
  manager: string;
  developmentNeed: string;
  plannedAction: string;
  supportRequired: string;
  dateCaptured: string;
  dateCapturedValue: string;
  targetDate: string;
  targetDateValue: string;
  status: string;
};

// One row per student (not per KPI, unlike IdpReportRow) — a performance report is meant to give
// an at-a-glance standing per employee, not a line-item dump. overallRating mirrors the same
// overallScoring-falls-back-to-employeeScoring weighted average used on the student/manager KPI
// views, so this report never contradicts what those pages show.
type PerformanceReportRow = {
  id: string;
  name: string;
  surname: string;
  idNumber: string;
  jobTitle: string;
  department: string;
  manager: string;
  kpiCount: number;
  totalWeight: number;
  overallRating: number | null;
  overallRatingLabel: string;
  lastReviewDate: string;
  lastReviewDateValue: string;
};

// WSP (Workplace Skills Plan) covers training that's planned/in progress — sourced from internal
// LMS course assignments that haven't been completed yet. ATR (Annual Training Report) covers
// training already delivered; its 3 sub-reports (further below) match the official SETA MIS
// upload templates rather than a single generic row shape.
// The 3 WSP sub-reports mirror the ATR ones' structure but for training that's PLANNED rather
// than delivered, matching the official templates supplied for this LMS
// (2024_Beneficiaries_Planned_Non_Pivotal_Training_V1.xlsx, 2024_Employment_Summary_V1.xlsx,
// 2024_Pivotal_Planned_Training_Report_V1.xlsx). "Planned training" is sourced from two places
// per student: internal LMS course assignments that haven't been completed yet, AND IDP entries
// (via their Development Need field, used as the training-intervention name) that aren't marked
// Completed — see plannedTrainingEvents. Employment Summary is different: it profiles the whole
// workforce (every user), not just those with planned training, matching how "Employment Summary"
// is normally used in a WSP submission.
type WspBeneficiariesPlannedRow = BeneficiaryDemographicCounts & {
  id: string;
  ofoOccupation: string;
  municipality: string;
  nqfAlignedTraining: string;
  nqfLevel: string;
  programmeNeedsAddressed: string;
  fundingType: string;
  dgContractNumber: string;
  socioEconomicStatus: string;
  typeOfLearningProgramme: string;
  nameOfLearningProgramme: string;
  typeOfEducationalInstitution: string;
  totalEstimatedCost: number;
  entryLevel: number;
  intermediateLevel: number;
  advancedLevel: number;
};

type WspEmploymentSummaryRow = BeneficiaryDemographicCounts & {
  id: string;
  ofoOccupation: string;
  municipality: string;
};

type WspPivotalPlannedRow = BeneficiaryDemographicCounts & {
  id: string;
  ofoOccupation: string;
  municipality: string;
  programmeNeedsAddressed: string;
  fundingType: string;
  dgContractNumber: string;
  idNumber: string;
  firstName: string;
  surname: string;
  socioEconomicStatus: string;
  typeOfLearningProgramme: string;
  nameOfLearningProgramme: string;
  pivotalOfoOccupation: string;
  typeOfEducationalInstitution: string;
  nqfLevel: string;
  cost: number;
  entryLevel: number;
  intermediateLevel: number;
  advancedLevel: number;
};

// The 3 sub-reports below match the official SETA MIS upload templates supplied for this LMS
// (2023_Beneficiaries_Completed_Training_V1.xlsx, 2023_Number_Actual_Beneficiaries_V1.xlsx,
// 2023_Pivotal_Actual_Training_Report_V1.xlsx) column-for-column, including the machine-key /
// human-readable double header row those templates use. Fields this LMS doesn't capture
// (NQF Level, NQF Aligned Training, Programme Needs Addressed, Funding Type, DG Contract Number,
// Socio Economic Status, Type Of Educational Institution, Entry/Intermediate/Advanced Level,
// Disability status) are always 'Not captured' / 0. Age Group is derived from the South African
// ID number's embedded date of birth (first 6 digits, YYMMDD) rather than left blank, since that
// data genuinely is available — see deriveAgeGroupFromIdNumber.
type BeneficiaryDemographicCounts = {
  africanMale: number;
  africanFemale: number;
  africanDisabled: number;
  colouredMale: number;
  colouredFemale: number;
  colouredDisabled: number;
  indianMale: number;
  indianFemale: number;
  indianDisabled: number;
  whiteMale: number;
  whiteFemale: number;
  whiteDisabled: number;
  age1: number;
  age2: number;
  age3: number;
};

type BeneficiariesCompletedTrainingRow = BeneficiaryDemographicCounts & {
  id: string;
  ofoOccupation: string;
  municipality: string;
  nqfAlignedTraining: string;
  nqfLevel: string;
  programmeNeedsAddressed: string;
  fundingType: string;
  dgContractNumber: string;
  socioEconomicStatus: string;
  typeOfLearningProgramme: string;
  nameOfLearningProgramme: string;
  typeOfEducationalInstitution: string;
  totalActualCost: number;
  entryLevel: number;
  intermediateLevel: number;
  advancedLevel: number;
};

type NumberBeneficiariesRow = BeneficiaryDemographicCounts & {
  id: string;
  ofoOccupation: string;
  municipality: string;
};

type PivotalActualTrainingRow = BeneficiaryDemographicCounts & {
  id: string;
  ofoOccupation: string;
  municipality: string;
  programmeNeedsAddressed: string;
  fundingType: string;
  dgContractNumber: string;
  idNumber: string;
  firstName: string;
  surname: string;
  socioEconomicStatus: string;
  typeOfLearningProgramme: string;
  nameOfLearningProgramme: string;
  pivotalOfoOccupation: string;
  typeOfEducationalInstitution: string;
  nqfLevel: string;
  cost: number;
  entryLevel: number;
  intermediateLevel: number;
  advancedLevel: number;
};

type CertificateLicenceReportRow = {
  id: string;
  name: string;
  surname: string;
  idNumber: string;
  department: string;
  certificateName: string;
  expiryDate: string;
  expiryDateValue: string;
  renewalRequired: 'Yes' | 'No';
  status: string;
};

type ManagedUserUploadRow = {
  student: EnrollmentStudentInput;
  password?: string;
};

type UserFormControls = {
  name: FormControl<string>;
  surname: FormControl<string>;
  email: FormControl<string>;
  password: FormControl<string>;
  jobTitle: FormControl<string>;
  idNumber: FormControl<string>;
  ofoCode: FormControl<string>;
  race: FormControl<string>;
  gender: FormControl<string>;
  municipality: FormControl<string>;
  dateOfBirth: FormControl<string>;
  nqfLevel: FormControl<string>;
  department: FormControl<string>;
  lineManagerId: FormControl<string>;
  group: FormControl<string>;
  dateEnrolled: FormControl<string>;
  deadlineDate: FormControl<string>;
  activeStatus: FormControl<'Active' | 'Inactive'>;
  managerAccess: FormControl<'Yes' | 'No'>;
  isAdmin: FormControl<'Yes' | 'No'>;
};

type UserFormGroup = FormGroup<UserFormControls>;

/** Best-effort "First Last" display name derived from the logged-in username/email,
 *  used when there's no richer profile name available for this account yet. */
function deriveDisplayNameFromIdentity(username: string | undefined, email: string | undefined): string {
  const source = username?.trim() || email?.trim().split('@')[0] || '';
  const words = source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase());

  return words.join(' ') || 'Admin';
}

@Component({
  selector: 'admin-profile',
  imports: [CommonModule, ReactiveFormsModule, LogoutConfirmDialogComponent, LoadingSpinnerComponent, PublishedOfferingCardComponent, PublishedOfferingDetailComponent, PowerPointWindowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'handleOverlayEscape()',
  },
  template: `

    <div
      class="admin-shell"
      [style.--admin-primary]="branding.currentTheme().primary"
      [style.--admin-secondary]="branding.currentTheme().secondary"
      [style.--admin-tint]="branding.currentTheme().tint"
      [style.--admin-surface]="branding.currentTheme().surface">
      <datalist id="ofoCodeOptions">
        @for (code of ofoCodeOptions(); track code) {
          <option [value]="code"></option>
        }
      </datalist>
      <datalist id="municipalityOptions">
        @for (name of municipalityOptions(); track name) {
          <option [value]="name"></option>
        }
      </datalist>
      @if (showWelcomeBanner()) {
        <div class="admin-welcome-banner" [class.admin-welcome-banner-leaving]="welcomeBannerLeaving()" role="status" aria-live="polite">
          <div>
            <div class="admin-welcome-banner-title">Welcome back, {{ adminFirstName() }}</div>
            <div class="admin-welcome-banner-copy">Your administrator workspace is ready.</div>
          </div>
        </div>
      }

      <header class="admin-topbar">
        <div class="admin-brand-block">
          <span class="admin-brand-logo" [class.admin-brand-logo-has-image]="!!branding.companyLogoDataUrl()">
            @if (branding.companyLogoDataUrl()) {
              <img [src]="branding.companyLogoDataUrl()!" alt="" />
            } @else {
              <span>AD</span>
            }
          </span>
          <div>
            <div class="admin-brand-name">skillsconnect</div>
            <div class="admin-brand-copy">Administrator workspace</div>
          </div>
        </div>

        <div class="admin-topbar-dropdown-wrap">
          <button
            type="button"
            class="admin-topbar-profile-btn"
            aria-label="Admin profile menu"
            [attr.aria-expanded]="topbarProfileMenuOpen()"
            [disabled]="switchingRole()"
            (click)="openTopbarProfileMenu()">
            <span class="admin-avatar" [class.admin-avatar-has-image]="!!adminProfileImageDataUrl()">
              @if (adminProfileImageDataUrl()) {
                <img [src]="adminProfileImageDataUrl()!" alt="Admin profile picture" />
              } @else {
                {{ adminInitials() }}
              }
            </span>
            <div class="admin-user-name">{{ adminName() }}</div>
            <svg class="admin-topbar-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m7 10 5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>

          @if (topbarProfileMenuOpen()) {
            <div class="admin-topbar-menu" role="dialog" aria-label="Admin profile menu">
              <button type="button" class="admin-topbar-menu-item" (click)="selectPanel('dashboard'); closeTopbarProfileMenu()">Dashboard</button>
              <button type="button" class="admin-topbar-menu-item" (click)="selectPanel('reports'); closeTopbarProfileMenu()">Reports</button>
              <div class="admin-topbar-menu-divider"></div>
              <div class="admin-topbar-menu-section-label">Switch role</div>
              <button type="button" class="admin-topbar-menu-item" (click)="switchToRole('training-manager')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3Zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z"/></svg>
                Training Manager
              </button>
              <button type="button" class="admin-topbar-menu-item" (click)="switchToRole('student')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="currentColor" d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82ZM12 3 1 9l11 6 9-4.91V17h2V9L12 3Z"/></svg>
                Student
              </button>
              <div class="admin-topbar-menu-divider"></div>
              <button type="button" class="admin-topbar-menu-item admin-topbar-menu-item-danger" (click)="logout()">Log out</button>
            </div>
          }
        </div>
      </header>

      @if (topbarProfileMenuOpen()) {
        <button type="button" class="admin-topbar-menu-backdrop" aria-label="Close admin profile menu" (click)="closeTopbarProfileMenu()"></button>
      }

      <div class="admin-layout" [class.admin-layout-sidebar-collapsed]="adminSidebarCollapsed()">
        <aside class="admin-sidebar" [class.admin-sidebar-collapsed]="adminSidebarCollapsed()" [class.admin-sidebar-scrolling]="sidebarScrolling()" (scroll)="onSidebarScroll()" aria-label="Admin navigation">
          <div class="admin-sidebar-header">
            <button
              type="button"
              class="admin-sidebar-toggle"
              [attr.aria-label]="adminSidebarCollapsed() ? 'Expand navigation panel' : 'Collapse navigation panel'"
              [attr.aria-expanded]="!adminSidebarCollapsed()"
              (click)="toggleAdminSidebar()">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 7.5h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                <path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                <path d="M6 16.5h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
              </svg>
            </button>
          </div>

          <ng-container *ngFor="let item of navItems">
            <button type="button" [class.active]="selectedPanel() === item.value" [attr.aria-label]="item.label" (click)="selectPanel(item.value)">
              <span class="admin-nav-icon" aria-hidden="true">
                @switch (item.value) {
                  @case ('dashboard') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="3.5" y="3.5" width="7" height="7" rx="2" stroke="currentColor" stroke-width="1.8"></rect>
                      <rect x="13.5" y="3.5" width="7" height="4.5" rx="2" stroke="currentColor" stroke-width="1.8"></rect>
                      <rect x="13.5" y="11" width="7" height="9.5" rx="2" stroke="currentColor" stroke-width="1.8"></rect>
                      <rect x="3.5" y="13.5" width="7" height="7" rx="2" stroke="currentColor" stroke-width="1.8"></rect>
                    </svg>
                  }
                  @case ('courses') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M4.75 7.5 12 4l7.25 3.5L12 11 4.75 7.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                      <path d="M4.75 11.5 12 15l7.25-3.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                      <path d="M4.75 15.5 12 19l7.25-3.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    </svg>
                  }
                  @case ('enrollment') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 6.5v11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      <path d="M6.5 12h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      <circle cx="12" cy="12" r="7.25" stroke="currentColor" stroke-width="1.8"/>
                    </svg>
                  }
                  @case ('users') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.8"></circle>
                      <path d="M4 18c0-2.8 2.6-4.5 5-4.5s5 1.7 5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
                      <circle cx="17" cy="9" r="2.5" stroke="currentColor" stroke-width="1.8"></circle>
                      <path d="M14.5 18c.45-1.75 1.95-2.9 4.2-2.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
                    </svg>
                  }
                  @case ('reports') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5v13a1 1 0 0 1-1.52.85L12 16l-5.48 3.35A1 1 0 0 1 5 18.5v-13Z" stroke="currentColor" stroke-width="1.8"></path>
                      <path d="M8 7.5h8M8 10.5h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
                    </svg>
                  }
                  @case ('settings') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8"></circle>
                      <path d="M19.4 12a7.4 7.4 0 0 0-.08-1l2-1.55-1.8-3.1-2.38.96a7.45 7.45 0 0 0-1.72-1l-.36-2.55H11l-.36 2.55a7.45 7.45 0 0 0-1.72 1l-2.38-.96-1.8 3.1 2 1.55a7.4 7.4 0 0 0 0 2l-2 1.55 1.8 3.1 2.38-.96c.52.42 1.1.76 1.72 1l.36 2.55h3.94l.36-2.55c.62-.24 1.2-.58 1.72-1l2.38.96 1.8-3.1-2-1.55c.05-.33.08-.67.08-1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path>
                    </svg>
                  }
                }
              </span>
              <span class="admin-nav-label">{{ item.label }}</span>
            </button>
          </ng-container>

          <button type="button" class="logout" aria-label="Log out" (click)="logout()">
            <span class="admin-nav-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M10 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
                <path d="M14 16l4-4-4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M18 12H9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
              </svg>
            </span>
            <span class="admin-nav-label">Log out</span>
          </button>
        </aside>
        <main class="admin-main-panel">
          @if (editingUser(); as activeUser) {
            <div class="admin-modal-backdrop" (click)="cancelUserEdit()">
              <section class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-edit-user-title" (click)="$event.stopPropagation()">
                <div class="admin-section-card-header">
                  <h2 id="admin-edit-user-title">Edit user</h2>
                  <span>{{ activeUser.name }} {{ activeUser.surname }}</span>
                </div>
                <form class="admin-edit-form" [formGroup]="userEditForm" (ngSubmit)="saveUserEdit()">
                  <label>
                    Name
                    <input type="text" formControlName="name" />
                  </label>
                  <label>
                    Surname
                    <input type="text" formControlName="surname" />
                  </label>
                  <label>
                    Email
                    <input type="email" formControlName="email" />
                  </label>
                  <label>
                    Reset Password
                    <input type="password" formControlName="password" placeholder="Leave blank to keep the current password" />
                  </label>
                  <label>
                    Job Title
                    <input type="text" formControlName="jobTitle" />
                  </label>
                  <label>
                    ID Number
                    <input type="text" formControlName="idNumber" />
                  </label>
                  <label>
                    OFO Code
                    <input type="text" formControlName="ofoCode" list="ofoCodeOptions" placeholder="Search job title or code…" autocomplete="off" />
                  </label>
                  <label>
                    Race
                    <select formControlName="race" style="width: 100%; background: #fffbe6; border: 2px solid #f9c74f; color: #222; padding: 8px; margin-top: 4px; display: block;">
                      <option value="">-- None --</option>
                      <option value="African">African</option>
                      <option value="Coloured">Coloured</option>
                      <option value="White">White</option>
                      <option value="Indian">Indian</option>
                      <option value="Foreign">Foreign</option>
                    </select>
                  </label>
                  <label>
                    Gender
                    <select formControlName="gender" style="width: 100%; background: #fffbe6; border: 2px solid #f9c74f; color: #222; padding: 8px; margin-top: 4px; display: block;">
                      <option value="">-- None --</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </label>
                  <label>
                    Municipality
                    <input type="text" formControlName="municipality" list="municipalityOptions" placeholder="Search municipality…" autocomplete="off" />
                  </label>
                  <label>
                    Date of Birth
                    <input type="date" formControlName="dateOfBirth" #dobInput />
                    @if (computeAge(dobInput.value); as age) {
                      <span class="admin-field-hint">Age: {{ age }}</span>
                    }
                  </label>
                  <label>
                    NQF Level
                    <select formControlName="nqfLevel" style="width: 100%; background: #fffbe6; border: 2px solid #f9c74f; color: #222; padding: 8px; margin-top: 4px; display: block;">
                      <option value="">-- None --</option>
                      <option value="Below Level 01">Below Level 01</option>
                      <option value="Level 01">Level 01</option>
                      <option value="Level 02">Level 02</option>
                      <option value="Level 03">Level 03</option>
                      <option value="Level 04">Level 04</option>
                      <option value="Level 05">Level 05</option>
                      <option value="Level 06">Level 06</option>
                      <option value="Level 07">Level 07</option>
                      <option value="Level 08">Level 08</option>
                      <option value="Level 09">Level 09</option>
                      <option value="Level 10">Level 10</option>
                    </select>
                  </label>
                  <label>
                    Department
                    <input type="text" formControlName="department" />
                  </label>
                  <label>
                    Line Manager
                    <select formControlName="lineManagerId" style="width: 100%; background: #fffbe6; border: 2px solid #f9c74f; color: #222; padding: 8px; margin-top: 4px; display: block;">
                      <option value="">-- None --</option>
                      @for (option of lineManagerOptions(); track option.id) {
                        <option [value]="option.id">{{ option.name }} {{ option.surname }}</option>
                      }
                    </select>
                  </label>
                  <label>
                    Group
                    <input type="text" formControlName="group" />
                  </label>
                  <label>
                    Start Date
                    <input type="date" formControlName="dateEnrolled" />
                  </label>
                  <label>
                    End Date
                    <input type="date" formControlName="deadlineDate" />
                  </label>
                  <label>
                    Role
                    <select formControlName="managerAccess" style="width: 100%; background: #fffbe6; border: 2px solid #f9c74f; color: #222; padding: 8px; margin-top: 4px; display: block;">
                      @for (option of managerAccessOptions; track option.value) {
                        <option [value]="option.value">{{ option.label }}</option>
                      }
                    </select>
                  </label>
                  <label>
                    Admin
                    <select formControlName="isAdmin" style="width: 100%; background: #fffbe6; border: 2px solid #f9c74f; color: #222; padding: 8px; margin-top: 4px; display: block;">
                      @for (option of adminAccessOptions; track option.value) {
                        <option [value]="option.value">{{ option.label }}</option>
                      }
                    </select>
                  </label>
                  <label>
                    Access
                    <select formControlName="activeStatus" style="width: 100%; background: #fffbe6; border: 2px solid #f9c74f; color: #222; padding: 8px; margin-top: 4px; display: block;">
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </label>
                  <div class="admin-form-actions">
                    <button type="submit" class="admin-primary-btn" [disabled]="userEditForm.invalid">Save changes</button>
                    <button type="button" class="admin-secondary-btn" (click)="cancelUserEdit()">Cancel</button>
                  </div>
                </form>
              </section>
            </div>
          }

          @if (editingAnnualReportRequest(); as editingRequest) {
            <div class="admin-modal-backdrop" (click)="closeAnnualReportDocumentsEditor()">
              <section class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-annual-report-documents-title" (click)="$event.stopPropagation()">
                <div class="admin-section-card-header">
                  <h2 id="admin-annual-report-documents-title">Edit training record</h2>
                  <span>{{ editingRequest.studentName }} — {{ editingRequest.courseName }}</span>
                </div>

                <div class="admin-annual-report-documents-form">
                  <div class="admin-report-document-field">
                    <span class="admin-report-document-label">Invoice</span>
                    <label class="admin-upload-btn" [class.admin-upload-btn-disabled]="uploadingInvoice()">
                      <span>{{ uploadingInvoice() ? 'Uploading…' : 'Choose file' }}</span>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" [disabled]="uploadingInvoice()" (change)="onInvoiceSelected($event, editingRequest.id)" />
                    </label>
                    @if (editingRequest.invoiceFileName) {
                      <span class="admin-report-upload-status">
                        Current file:
                        <a [href]="editingRequest.invoiceDataUrl" target="_blank" rel="noopener noreferrer">{{ editingRequest.invoiceFileName }}</a>
                      </span>
                    }
                  </div>

                  <div class="admin-report-document-field">
                    <span class="admin-report-document-label">Proof of Payment</span>
                    <label class="admin-upload-btn" [class.admin-upload-btn-disabled]="uploadingProofOfPayment()">
                      <span>{{ uploadingProofOfPayment() ? 'Uploading…' : 'Choose file' }}</span>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" [disabled]="uploadingProofOfPayment()" (change)="onProofOfPaymentSelected($event, editingRequest.id)" />
                    </label>
                    @if (editingRequest.proofOfPaymentFileName) {
                      <span class="admin-report-upload-status">
                        Current file:
                        <a [href]="editingRequest.proofOfPaymentUrl" target="_blank" rel="noopener noreferrer">{{ editingRequest.proofOfPaymentFileName }}</a>
                      </span>
                    }
                  </div>

                  <div class="admin-report-document-field">
                    <span class="admin-report-document-label">Certificate</span>
                    <label class="admin-upload-btn" [class.admin-upload-btn-disabled]="uploadingCertificate()">
                      <span>{{ uploadingCertificate() ? 'Uploading…' : 'Choose file' }}</span>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" [disabled]="uploadingCertificate()" (change)="onCertificateSelected($event, editingRequest.id)" />
                    </label>
                    @if (editingRequest.certificateFileName) {
                      <span class="admin-report-upload-status">
                        Current file:
                        <a [href]="editingRequest.certificateUrl" target="_blank" rel="noopener noreferrer">{{ editingRequest.certificateFileName }}</a>
                      </span>
                    }
                  </div>

                  <div class="admin-form-actions">
                    <button type="button" class="admin-secondary-btn" (click)="closeAnnualReportDocumentsEditor()">Close</button>
                  </div>
                </div>
              </section>
            </div>
          }

          @if (showSingleUserModal()) {
            <div class="admin-modal-backdrop" (click)="closeSingleUserForm()">
              <section class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-add-user-title" (click)="$event.stopPropagation()">
                <div class="admin-section-card-header">
                  <h2 id="admin-add-user-title">Add user</h2>
                  <span>Manual entry</span>
                </div>

                <p class="admin-single-user-hint">Create a single learner record or mark the user as a training manager. If the email already exists, the current user record will be updated.</p>

                @if (singleUserMessage(); as message) {
                  <div class="admin-upload-feedback" [class.admin-upload-feedback-error]="singleUserTone() === 'error'" role="status" aria-live="polite">
                    {{ message }}
                  </div>
                }

                <form class="admin-edit-form admin-single-user-form" [formGroup]="singleUserForm" (ngSubmit)="saveSingleUser()">
                  <label>
                    Name
                    <input type="text" formControlName="name" />
                  </label>
                  <label>
                    Surname
                    <input type="text" formControlName="surname" />
                  </label>
                  <label>
                    Email
                    <input type="email" formControlName="email" />
                  </label>
                  <label>
                    Password
                    <input type="password" formControlName="password" placeholder="Enter a password for this account" />
                  </label>
                  <label>
                    Job Title
                    <input type="text" formControlName="jobTitle" />
                  </label>
                  <label>
                    ID Number
                    <input type="text" formControlName="idNumber" />
                  </label>
                  <label>
                    OFO Code
                    <input type="text" formControlName="ofoCode" list="ofoCodeOptions" placeholder="Search job title or code…" autocomplete="off" />
                  </label>
                  <label>
                    Race
                    <select formControlName="race" style="width: 100%; background: #fffbe6; border: 2px solid #f9c74f; color: #222; padding: 8px; margin-top: 4px; display: block;">
                      <option value="">-- None --</option>
                      <option value="African">African</option>
                      <option value="Coloured">Coloured</option>
                      <option value="White">White</option>
                      <option value="Indian">Indian</option>
                      <option value="Foreign">Foreign</option>
                    </select>
                  </label>
                  <label>
                    Gender
                    <select formControlName="gender" style="width: 100%; background: #fffbe6; border: 2px solid #f9c74f; color: #222; padding: 8px; margin-top: 4px; display: block;">
                      <option value="">-- None --</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </label>
                  <label>
                    Municipality
                    <input type="text" formControlName="municipality" list="municipalityOptions" placeholder="Search municipality…" autocomplete="off" />
                  </label>
                  <label>
                    Date of Birth
                    <input type="date" formControlName="dateOfBirth" #dobInput />
                    @if (computeAge(dobInput.value); as age) {
                      <span class="admin-field-hint">Age: {{ age }}</span>
                    }
                  </label>
                  <label>
                    NQF Level
                    <select formControlName="nqfLevel" style="width: 100%; background: #fffbe6; border: 2px solid #f9c74f; color: #222; padding: 8px; margin-top: 4px; display: block;">
                      <option value="">-- None --</option>
                      <option value="Below Level 01">Below Level 01</option>
                      <option value="Level 01">Level 01</option>
                      <option value="Level 02">Level 02</option>
                      <option value="Level 03">Level 03</option>
                      <option value="Level 04">Level 04</option>
                      <option value="Level 05">Level 05</option>
                      <option value="Level 06">Level 06</option>
                      <option value="Level 07">Level 07</option>
                      <option value="Level 08">Level 08</option>
                      <option value="Level 09">Level 09</option>
                      <option value="Level 10">Level 10</option>
                    </select>
                  </label>
                  <label>
                    Department
                    <input type="text" formControlName="department" />
                  </label>
                  <label>
                    Line Manager
                    <select formControlName="lineManagerId" style="width: 100%; background: #fffbe6; border: 2px solid #f9c74f; color: #222; padding: 8px; margin-top: 4px; display: block;">
                      <option value="">-- None --</option>
                      @for (option of lineManagerOptions(); track option.id) {
                        <option [value]="option.id">{{ option.name }} {{ option.surname }}</option>
                      }
                    </select>
                  </label>
                  <label>
                    Group
                    <input type="text" formControlName="group" />
                  </label>
                  <label>
                    Start Date
                    <input type="date" formControlName="dateEnrolled" />
                  </label>
                  <label>
                    End Date
                    <input type="date" formControlName="deadlineDate" />
                  </label>
                  <label>
                    Role
                    <select formControlName="managerAccess" style="width: 100%; background: #fffbe6; border: 2px solid #f9c74f; color: #222; padding: 8px; margin-top: 4px; display: block;">
                      @for (option of managerAccessOptions; track option.value) {
                        <option [value]="option.value">{{ option.label }}</option>
                      }
                    </select>
                  </label>
                  <label>
                    Admin
                    <select formControlName="isAdmin" style="width: 100%; background: #fffbe6; border: 2px solid #f9c74f; color: #222; padding: 8px; margin-top: 4px; display: block;">
                      @for (option of adminAccessOptions; track option.value) {
                        <option [value]="option.value">{{ option.label }}</option>
                      }
                    </select>
                  </label>
                  <label>
                    Access
                    <select formControlName="activeStatus" style="width: 100%; background: #fffbe6; border: 2px solid #f9c74f; color: #222; padding: 8px; margin-top: 4px; display: block;">
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </label>
                  <div class="admin-form-actions admin-single-user-actions">
                    <button type="submit" class="admin-primary-btn" [disabled]="singleUserForm.invalid">Save user</button>
                    <button type="button" class="admin-secondary-btn" (click)="resetSingleUserForm()">Clear form</button>
                    <button type="button" class="admin-secondary-btn" (click)="closeSingleUserForm()">Cancel</button>
                  </div>
                </form>
              </section>
            </div>
          }

          @if (selectedPanel() === 'dashboard') {
            <section class="admin-panel">
              <div class="section-heading-block admin-dashboard-heading">
                <p class="eyebrow">Dashboard</p>
                <h1>Overview</h1>
                <p class="section-copy">A quick snapshot of your organisation's learning activity.</p>
              </div>

              <div class="admin-dashboard-top-grid">
                <div class="admin-metric-grid admin-metric-grid-2x2">
                  <article class="admin-metric-card admin-metric-card-users">
                    <span class="admin-metric-icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.8"/>
                        <path d="M3.5 19c0-3.04 2.8-5 5.5-5s5.5 1.96 5.5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                        <circle cx="17" cy="9" r="2.4" stroke="currentColor" stroke-width="1.8"/>
                        <path d="M14.8 19c.4-2.2 2.15-3.6 4.7-3.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      </svg>
                    </span>
                    <div class="admin-metric-label">Total Users</div>
                    <div class="admin-metric-value">{{ totalUsersCount() }}</div>
                    <div class="admin-metric-copy">Students currently listed on the LMS.</div>
                  </article>

                  <article class="admin-metric-card admin-metric-card-active">
                    <span class="admin-metric-icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/>
                        <path d="M8.3 12.3l2.4 2.4 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                    <div class="admin-metric-label">Active Users</div>
                    <div class="admin-metric-value">{{ activeUsersCount() }}</div>
                    <div class="admin-metric-copy">Users with active LMS access status.</div>
                  </article>

                  <article class="admin-metric-card admin-metric-card-inactive">
                    <span class="admin-metric-icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/>
                        <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      </svg>
                    </span>
                    <div class="admin-metric-label">Non Active Users</div>
                    <div class="admin-metric-value">{{ inactiveUsersCount() }}</div>
                    <div class="admin-metric-copy">Users currently marked as inactive.</div>
                  </article>

                  <article class="admin-metric-card admin-metric-card-accent admin-metric-card-learners">
                    <span class="admin-metric-icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M12 4.5 3 8.75l9 4.25 9-4.25L12 4.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                        <path d="M6.5 11v4.2c0 1.4 2.46 2.55 5.5 2.55s5.5-1.15 5.5-2.55V11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      </svg>
                    </span>
                    <div class="admin-metric-label">Assigned Learners</div>
                    <div class="admin-metric-value">{{ managerData.assignedStudentsCount() }}</div>
                    <div class="admin-metric-copy">Learners assigned to at least one offering.</div>
                  </article>
                </div>

              <article class="admin-section-card admin-gauge-card">
                <div class="admin-section-card-header">
                  <div class="admin-section-card-heading">
                    <span class="admin-section-card-icon" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M4 20V5.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 5.5V20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M7.5 16.5v-4M12 16.5v-7M16.5 16.5v-2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      </svg>
                    </span>
                    <h2>Overall performance rating</h2>
                  </div>
                  <span>{{ performanceGaugeBandCounts().total }} scored employees</span>
                </div>

                <div class="admin-gauge-body">
                  <svg class="admin-gauge-svg" viewBox="0 0 240 145" role="img" [attr.aria-label]="'Average overall performance rating ' + performanceGaugeAverageLabel() + ' out of 4'">
                    <path d="M 30,120 A 90,90 0 1,1 210,120" class="admin-gauge-band-track" />
                    <path d="M 30,120 A 90,90 0 0,1 117.64,30.03" class="admin-gauge-band admin-gauge-band-critical" [class.admin-gauge-band-ready]="dashboardGaugeReady()" />
                    <path d="M 122.36,30.03 A 90,90 0 0,1 196.74,72.97" class="admin-gauge-band admin-gauge-band-serious" [class.admin-gauge-band-ready]="dashboardGaugeReady()" />
                    <path d="M 199.09,77.06 A 90,90 0 0,1 210,120" class="admin-gauge-band admin-gauge-band-good" [class.admin-gauge-band-ready]="dashboardGaugeReady()" />
                    @if (performanceGaugeMarker(); as marker) {
                      <circle
                        [attr.cx]="marker.x"
                        [attr.cy]="marker.y"
                        [attr.fill]="performanceGaugeMarkerColor()"
                        r="7"
                        class="admin-gauge-marker"
                        [class.admin-gauge-marker-ready]="dashboardGaugeReady()"
                      />
                    }
                    <text x="120" y="102" text-anchor="middle" class="admin-gauge-value" [class.admin-gauge-value-ready]="dashboardGaugeReady()">{{ performanceGaugeAverageLabel() }}</text>
                    <text x="120" y="120" text-anchor="middle" class="admin-gauge-value-caption" dy="14">average / 4</text>
                    <text x="18" y="129" text-anchor="start" class="admin-gauge-scale-label">1</text>
                    <text x="222" y="129" text-anchor="end" class="admin-gauge-scale-label">4</text>
                  </svg>

                  <div class="admin-gauge-legend">
                    <div class="admin-gauge-legend-row">
                      <span class="admin-gauge-legend-dot admin-gauge-legend-dot-critical"></span>
                      <span class="admin-gauge-legend-text"><strong>Needs Improvement or below</strong> — rating 1–2</span>
                      <span class="admin-gauge-legend-count">{{ performanceGaugeBandCounts().critical }}</span>
                    </div>
                    <div class="admin-gauge-legend-row">
                      <span class="admin-gauge-legend-dot admin-gauge-legend-dot-serious"></span>
                      <span class="admin-gauge-legend-text"><strong>Meets Expectations</strong> — rating 3</span>
                      <span class="admin-gauge-legend-count">{{ performanceGaugeBandCounts().serious }}</span>
                    </div>
                    <div class="admin-gauge-legend-row">
                      <span class="admin-gauge-legend-dot admin-gauge-legend-dot-good"></span>
                      <span class="admin-gauge-legend-text"><strong>Exceeds Expectations</strong> — rating 4</span>
                      <span class="admin-gauge-legend-count">{{ performanceGaugeBandCounts().good }}</span>
                    </div>
                    @if (!performanceGaugeBandCounts().total) {
                      <p class="admin-gauge-empty-note">No employees have a scored KPI yet.</p>
                    }
                  </div>
                </div>
              </article>
              </div>

              <div class="admin-snapshot-grid">
                <article class="admin-section-card">
                  <div class="admin-section-card-header">
                    <div class="admin-section-card-heading">
                      <span class="admin-section-card-icon" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <rect x="4" y="10.5" width="16" height="9" rx="2" stroke="currentColor" stroke-width="1.8"/>
                          <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                        </svg>
                      </span>
                      <h2>User access snapshot</h2>
                    </div>
                    <span>{{ activeRateLabel() }} active</span>
                  </div>

                  <div class="admin-progress-group">
                    <div class="admin-progress-row">
                      <div class="admin-progress-meta">
                        <strong>Active</strong>
                        <span>{{ activeUsersCount() }} users</span>
                      </div>
                      <div class="admin-progress-track">
                        <span class="admin-progress-fill" [style.width.%]="activeUsersPercent()"></span>
                      </div>
                    </div>

                    <div class="admin-progress-row">
                      <div class="admin-progress-meta">
                        <strong>Inactive</strong>
                        <span>{{ inactiveUsersCount() }} users</span>
                      </div>
                      <div class="admin-progress-track admin-progress-track-muted">
                        <span class="admin-progress-fill admin-progress-fill-muted" [style.width.%]="inactiveUsersPercent()"></span>
                      </div>
                    </div>
                  </div>
                </article>

                <article class="admin-section-card">
                  <div class="admin-section-card-header">
                    <div class="admin-section-card-heading">
                      <span class="admin-section-card-icon" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M4 19.5V6.2c0-.94.76-1.7 1.7-1.7h4.6l1.4 1.7h6.6c.94 0 1.7.76 1.7 1.7v9.6c0 .94-.76 1.7-1.7 1.7H4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                        </svg>
                      </span>
                      <h2>Learning status summary</h2>
                    </div>
                    <span>{{ totalUsersCount() }} total</span>
                  </div>

                  <div class="admin-status-list">
                    @for (item of learningStatusSummary(); track item.label) {
                      <div class="admin-status-row">
                        <div class="admin-status-meta">
                          <span class="admin-status-dot" [style.background]="item.color"></span>
                          <strong>{{ item.label }}</strong>
                        </div>
                        <span>{{ item.count }}</span>
                      </div>
                    }
                  </div>
                </article>
              </div>
            </section>
          }

          @if (selectedPanel() === 'users') {
            <section class="admin-panel">
              <section class="admin-section-card">
                <div class="admin-bulk-upload-panel">
                  <div class="admin-bulk-upload-actions">
                    <label class="admin-settings-field admin-report-download-field admin-bulk-upload-template-field">
                      <span>Template format</span>
                      <select [value]="selectedBulkUploadTemplateFormat()" (change)="updateBulkUploadTemplateFormat($event)">
                        <option value="CSV">Download CSV template</option>
                        <option value="XLSX">Download XLSX template</option>
                      </select>
                    </label>
                    <button type="button" class="admin-secondary-btn" (click)="downloadBulkUploadTemplate()">Download template</button>
                    <label class="admin-upload-btn">
                      <span>Upload users file</span>
                      <input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" (change)="handleBulkUserUpload($event)" />
                    </label>
                    <button type="button" class="admin-secondary-btn" (click)="openSingleUserForm()">Add user</button>
                    <span class="admin-chip">CSV or XLSX</span>
                  </div>
                </div>

                @if (bulkUploadMessage(); as message) {
                  <div class="admin-upload-feedback" [class.admin-upload-feedback-error]="bulkUploadTone() === 'error'" role="status" aria-live="polite">
                    {{ message }}
                  </div>
                }

                @if (!showSingleUserModal() && singleUserMessage(); as message) {
                  <div class="admin-upload-feedback" [class.admin-upload-feedback-error]="singleUserTone() === 'error'" role="status" aria-live="polite">
                    {{ message }}
                  </div>
                }

                @if (bulkUploadIssues().length) {
                  <div class="admin-upload-issues" role="alert" aria-live="assertive">
                    <div class="admin-upload-issues-title">Upload issues</div>
                    <div class="admin-upload-issues-copy">Fix the rows below and upload the file again.</div>

                    <ul class="admin-upload-issues-list">
                      @for (issue of bulkUploadIssues(); track issue.lineNumber + issue.message) {
                        <li>Row {{ issue.lineNumber }}: {{ issue.message }}</li>
                      }
                    </ul>
                  </div>
                }

                <div class="admin-toolbar">
                  <label class="admin-search-field">
                    <span>Search users</span>
                    <input type="search" [value]="userSearchTerm()" placeholder="Search by name, email, group, department or status" (input)="updateUserSearch($event)" />
                  </label>

                  <div class="admin-chip-row">
                    <span class="admin-chip">{{ filteredUsers().length }} listed</span>
                    <span class="admin-chip">{{ activeUsersCount() }} active</span>
                    <span class="admin-chip">{{ inactiveUsersCount() }} inactive</span>
                  </div>
                </div>

                <div class="admin-user-table-wrap">
                  <div class="admin-user-table admin-user-table-head" aria-hidden="true">
                    <span>User</span>
                    <span>Department</span>
                    <span>Group</span>
                    <span>Learning Status</span>
                    <span>Access</span>
                    <span>Actions</span>
                  </div>

                  <div class="admin-user-list">
                    @for (student of filteredUsers(); track student.id) {
                      <article class="admin-user-table admin-user-row">
                        <div class="admin-user-cell admin-user-primary">
                          <span class="admin-user-avatar">{{ student.name[0] }}{{ student.surname[0] }}</span>
                          <div>
                            <div class="admin-user-fullname">{{ student.name }} {{ student.surname }}</div>
                            <div class="admin-user-email">{{ student.email }}</div>
                          </div>
                        </div>
                        <div class="admin-user-cell">
                          <div class="admin-user-field-label">Department</div>
                          <span>{{ student.department }}</span>
                        </div>
                        <div class="admin-user-cell">
                          <div class="admin-user-field-label">Group</div>
                          <span>{{ student.group }}</span>
                        </div>
                        <div class="admin-user-cell">
                          <div class="admin-user-field-label">Learning Status</div>
                          @let effectiveStatus = resolveStudentOverallStatus(student);
                          <span class="admin-status-pill" [class.admin-status-pill-complete]="effectiveStatus === 'Completed'" [class.admin-status-pill-progress]="effectiveStatus === 'In Progress'" [class.admin-status-pill-pending]="effectiveStatus === 'Not Yet Started'">
                            {{ effectiveStatus }}
                          </span>
                        </div>
                        <div class="admin-user-cell">
                          <div class="admin-user-field-label">Access</div>
                          <span class="admin-access-pill" [class.admin-access-pill-inactive]="student.activeStatus === 'Inactive'">
                            {{ student.activeStatus }}
                          </span>
                        </div>
                        <div class="admin-user-cell admin-user-actions-cell">
                          <div class="admin-user-field-label">Actions</div>
                          <div class="admin-user-actions">
                            <button type="button" class="admin-inline-btn" (click)="openUserEditor(student)">Edit</button>
                            <button type="button" class="admin-inline-btn admin-inline-btn-danger" (click)="deleteUser(student)">Delete</button>
                          </div>
                        </div>
                      </article>
                    } @empty {
                      <div class="admin-empty-state">No users match the current search.</div>
                    }
                  </div>
                </div>
              </section>
            </section>
          }

          @if (selectedPanel() === 'reports') {
            <section class="admin-panel">
              <div class="admin-report-picker">
                @if (!selectedReportView()) {
                  <article class="admin-section-card admin-report-menu-card admin-report-menu-card-primary">
                    <div class="admin-section-card-header">
                      <h2>Report List</h2>
                      <span>5 available</span>
                    </div>

                    <div class="admin-report-menu" role="list" aria-label="Admin report list">
                      <button type="button" class="admin-report-menu-item admin-report-menu-item-annual" (click)="selectReportView('annual-training')">
                        <span class="admin-report-menu-icon" aria-hidden="true">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <rect x="3.5" y="4.5" width="17" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/>
                            <path d="M3.5 9.5h17" stroke="currentColor" stroke-width="1.8"/>
                            <path d="M8 3v3M16 3v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                            <path d="M7.5 17v-4M12 17v-6M16.5 17v-2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                          </svg>
                        </span>
                        <span class="admin-report-menu-text">
                          <strong>Training Report</strong>
                          <span>Training that has occurred — approved external training and completed LMS courses.</span>
                        </span>
                        <span class="admin-report-menu-cta">View report
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </span>
                      </button>
                      <button type="button" class="admin-report-menu-item admin-report-menu-item-idp" (click)="selectReportView('idp-report')">
                        <span class="admin-report-menu-icon" aria-hidden="true">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/>
                            <circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.8"/>
                            <circle cx="12" cy="12" r="1.4" fill="currentColor"/>
                          </svg>
                        </span>
                        <span class="admin-report-menu-text">
                          <strong>IDP Report</strong>
                          <span>Employee IDP entries with manager and development details.</span>
                        </span>
                        <span class="admin-report-menu-cta">View report
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </span>
                      </button>
                      <button type="button" class="admin-report-menu-item admin-report-menu-item-performance" (click)="selectReportView('performance-report')">
                        <span class="admin-report-menu-icon" aria-hidden="true">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <path d="M4 20V5.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 5.5V20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M7.5 16.5v-4M12 16.5v-7M16.5 16.5v-2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                            <path d="M2.5 20h19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                          </svg>
                        </span>
                        <span class="admin-report-menu-text">
                          <strong>Performance Report</strong>
                          <span>KPI standing per employee — weighting, overall rating, and last review date.</span>
                        </span>
                        <span class="admin-report-menu-cta">View report
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </span>
                      </button>
                      <button type="button" class="admin-report-menu-item admin-report-menu-item-certs" (click)="selectReportView('certificate-licence-report')">
                        <span class="admin-report-menu-icon" aria-hidden="true">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="9" r="5.5" stroke="currentColor" stroke-width="1.8"/>
                            <path d="M12 6.7l.95 1.93 2.13.31-1.54 1.5.36 2.12L12 11.5l-1.9 1.06.36-2.12-1.54-1.5 2.13-.31L12 6.7Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                            <path d="M9 13.5 7.5 20l4.5-2 4.5 2-1.5-6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </span>
                        <span class="admin-report-menu-text">
                          <strong>Certificates and Licences Report</strong>
                          <span>Track employee certificate and licence expiry, renewal, and status.</span>
                        </span>
                        <span class="admin-report-menu-cta">View report
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </span>
                      </button>
                      <button type="button" class="admin-report-menu-item admin-report-menu-item-seta" (click)="selectReportView('seta-report')">
                        <span class="admin-report-menu-icon" aria-hidden="true">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <path d="M4 20V6.5A2.5 2.5 0 0 1 6.5 4H16l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                            <path d="M16 4v3.5A1.5 1.5 0 0 0 17.5 9H20" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                            <path d="M7.5 13h9M7.5 16.5h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                          </svg>
                        </span>
                        <span class="admin-report-menu-text">
                          <strong>SETA Report</strong>
                          <span>ATR and WSP training schedules for SETA submission.</span>
                        </span>
                        <span class="admin-report-menu-cta">View report
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </span>
                      </button>
                    </div>
                  </article>
                }

                @if (selectedReportView()) {
                  <article class="admin-section-card admin-report-open-card">
                    <div class="admin-section-card-header admin-report-open-header">
                      <div class="admin-report-open-heading">
                        @if (selectedReportView() === 'annual-training') {
                          <h2>Training Report</h2>
                          <span>{{ filteredAnnualTrainingReportRows().length }} of {{ annualTrainingReportRows().length }} training records</span>
                        }

                        @if (selectedReportView() === 'idp-report') {
                          <h2>IDP Report</h2>
                          <span>{{ idpReportRows().length }} IDP entries</span>
                        }

                        @if (selectedReportView() === 'performance-report') {
                          <h2>Performance Report</h2>
                          <span>{{ performanceReportRows().length }} employees</span>
                        }

                        @if (selectedReportView() === 'certificate-licence-report') {
                          <h2>Certificates and Licences Report</h2>
                          <span>{{ certificateLicenceReportRows().length }} records</span>
                        }

                        @if (selectedReportView() === 'seta-report') {
                          @if (selectedSetaReportTab() === 'atr') {
                            <h2>SETA Report — ATR</h2>
                            <span>{{ selectedAtrSubReport() ? 'Viewing sub-report' : 'Choose a sub-report' }}</span>
                          } @else if (selectedSetaReportTab() === 'wsp') {
                            <h2>SETA Report — WSP</h2>
                            <span>{{ selectedWspSubReport() ? 'Viewing sub-report' : 'Choose a sub-report' }}</span>
                          } @else {
                            <h2>SETA Report</h2>
                            <span>Choose ATR or WSP</span>
                          }
                        }
                      </div>

                      <button type="button" class="admin-inline-btn admin-report-back-btn" (click)="backFromReportView()">
                        Back
                        @if (selectedReportView() === 'seta-report' && selectedSetaReportTab() === 'atr' && selectedAtrSubReport()) { to ATR }
                        @else if (selectedReportView() === 'seta-report' && selectedSetaReportTab() === 'wsp' && selectedWspSubReport()) { to WSP }
                        @else if (selectedReportView() === 'seta-report' && selectedSetaReportTab()) { to SETA report }
                        @else { to report list }
                      </button>
                    </div>

                    @if (selectedReportView() === 'annual-training') {
                      <div class="admin-report-content-stack">
                        <article class="admin-section-card">
                          <div class="admin-section-card-header">
                            <h2>Report filters</h2>
                            <span>{{ filteredAnnualTrainingReportRows().length }} of {{ annualTrainingReportRows().length }} rows</span>
                          </div>

                          <div class="admin-report-filter-grid">
                            <label class="admin-report-filter-field">
                              <span>Search</span>
                              <input type="text" [value]="annualReportSearchTerm()" (input)="updateAnnualReportSearch($event)" placeholder="Name, training item, provider" />
                            </label>

                            <label class="admin-report-filter-field">
                              <span>Department</span>
                              <select [value]="selectedAnnualReportDepartment()" (change)="updateAnnualReportDepartment($event)">
                                <option value="">All departments</option>
                                @for (department of annualReportDepartments(); track department) {
                                  <option [value]="department">{{ department }}</option>
                                }
                              </select>
                            </label>

                            <label class="admin-report-filter-field">
                              <span>Source</span>
                              <select [value]="selectedAnnualReportSource()" (change)="updateAnnualReportSource($event)">
                                <option value="All">All sources</option>
                                <option value="LMS">LMS</option>
                                <option value="External">External</option>
                              </select>
                            </label>

                            <label class="admin-report-filter-field">
                              <span>Date From</span>
                              <input type="date" [value]="selectedAnnualReportDateFrom()" (input)="updateAnnualReportDateFrom($event)" />
                            </label>

                            <label class="admin-report-filter-field">
                              <span>Date To</span>
                              <input type="date" [value]="selectedAnnualReportDateTo()" (input)="updateAnnualReportDateTo($event)" />
                            </label>

                          </div>

                          <div class="admin-report-actions">
                            <button type="button" class="admin-secondary-btn" (click)="clearAnnualReportFilters()">Clear filters</button>
                            <label class="admin-report-filter-field admin-report-download-field">
                              <span>Download As</span>
                              <select [value]="selectedAnnualReportDownloadFormat()" (change)="updateAnnualReportDownloadFormat($event)">
                                <option value="CSV">CSV</option>
                                <option value="XLSX">XLSX</option>
                              </select>
                            </label>
                            <button type="button" class="admin-primary-btn" [disabled]="!canDownloadAnnualReport()" (click)="downloadAnnualReport()">Download report</button>
                          </div>
                        </article>

                        <article class="admin-section-card">
                          <div class="admin-section-card-header">
                            <h2>Bulk import training records</h2>
                            <span>Backfill approved training for existing learners</span>
                          </div>

                          <p class="admin-settings-hint">
                            Upload a CSV or XLSX file with Learner Email, Course Name, Provider, Training Type, Start Date and End Date. Each valid row is saved and approved automatically, so it shows up here and in the SETA (ATR) reports right away — nothing needs a separate manual approval step.
                          </p>

                          <div class="admin-report-actions">
                            <button type="button" class="admin-secondary-btn" (click)="downloadTrainingRecordUploadTemplate()">Download template</button>
                            <label class="admin-report-filter-field admin-report-download-field">
                              <span>Approving manager</span>
                              <select [value]="trainingRecordApprovingManagerId()" (change)="updateTrainingRecordApprovingManager($event)">
                                <option value="">Select a manager</option>
                                @for (manager of managerData.trainingManagers(); track manager.id) {
                                  <option [value]="manager.id">{{ manager.name }}</option>
                                }
                              </select>
                            </label>
                            <label class="admin-upload-btn" [class.admin-upload-btn-disabled]="trainingRecordUploadInProgress()">
                              <span>{{ trainingRecordUploadInProgress() ? 'Uploading…' : 'Upload training records file' }}</span>
                              <input
                                type="file"
                                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                [disabled]="trainingRecordUploadInProgress()"
                                (change)="handleTrainingRecordUpload($event)" />
                            </label>
                          </div>

                          @if (trainingRecordUploadMessage()) {
                            <div class="admin-upload-feedback" [class.admin-upload-feedback-error]="trainingRecordUploadTone() === 'error'" role="status" aria-live="polite">
                              {{ trainingRecordUploadMessage() }}
                            </div>
                          }

                          @if (trainingRecordUploadIssues().length) {
                            <div class="admin-upload-issues" role="alert" aria-live="assertive">
                              <div class="admin-upload-issues-title">Upload issues</div>
                              <div class="admin-upload-issues-copy">Fix the rows below and upload the file again.</div>
                              <ul class="admin-upload-issues-list">
                                @for (issue of trainingRecordUploadIssues(); track issue.lineNumber + issue.message) {
                                  <li>Row {{ issue.lineNumber }}: {{ issue.message }}</li>
                                }
                              </ul>
                            </div>
                          }
                        </article>

                        @if (filteredAnnualTrainingReportRows().length) {
                          <div class="admin-report-table-wrap">
                            <table class="admin-report-table">
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>Email</th>
                                  <th>ID Number</th>
                                  <th>Job Title</th>
                                  <th>Department</th>
                                  <th>OFO Code</th>
                                  <th>Race</th>
                                  <th>Gender</th>
                                  <th>Municipality</th>
                                  <th>Training Item</th>
                                  <th>Source</th>
                                  <th>Type</th>
                                  <th>Result</th>
                                  <th>Provider</th>
                                  <th>Date</th>
                                  <th>Status</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                @for (row of filteredAnnualTrainingReportRows(); track row.id) {
                                  <tr>
                                    <td>{{ row.learnerName }}</td>
                                    <td>{{ row.learnerEmail }}</td>
                                    <td>{{ row.idNumber }}</td>
                                    <td>{{ row.jobTitle }}</td>
                                    <td>{{ row.department }}</td>
                                    <td>{{ row.ofoCode }}</td>
                                    <td>{{ row.race }}</td>
                                    <td>{{ row.gender }}</td>
                                    <td>{{ row.municipality }}</td>
                                    <td>{{ row.trainingItem }}</td>
                                    <td>{{ row.source }}</td>
                                    <td>{{ row.trainingType }}</td>
                                    <td>{{ row.result }}</td>
                                    <td>{{ row.provider }}</td>
                                    <td>{{ row.date }}</td>
                                    <td>{{ row.status }}</td>
                                    <td>
                                      @if (row.source === 'External') {
                                        <button type="button" class="admin-inline-btn" (click)="openAnnualReportDocumentsEditor(row.sourceId)">Upload Proof</button>
                                      }
                                    </td>
                                  </tr>
                                }
                              </tbody>
                            </table>
                          </div>
                        } @else {
                          <div class="admin-empty-state">No training records match the current filters.</div>
                        }
                      </div>
                    }

                    @if (selectedReportView() === 'idp-report') {
                      <div class="admin-report-content-stack">
                        <article class="admin-section-card">
                          <div class="admin-section-card-header">
                            <h2>Report preview</h2>
                            <span>{{ idpReportRows().length }} rows</span>
                          </div>

                          <div class="admin-report-preview-meta">
                            <span class="admin-chip">15 fields</span>
                            <span class="admin-chip">{{ idpReportRows().length }} rows included</span>
                          </div>

                          <div class="admin-report-actions">
                            <label class="admin-report-filter-field admin-report-download-field">
                              <span>Download As</span>
                              <select [value]="selectedIdpReportDownloadFormat()" (change)="updateIdpReportDownloadFormat($event)">
                                <option value="CSV">CSV</option>
                                <option value="XLSX">XLSX</option>
                              </select>
                            </label>
                            <button type="button" class="admin-primary-btn" [disabled]="!canDownloadIdpReport()" (click)="downloadIdpReport()">Download report</button>
                          </div>

                          @if (!idpReportRows().length) {
                            <div class="admin-empty-state">No IDP entries were found for the current LMS users.</div>
                          }
                        </article>

                        @if (idpReportRows().length) {
                          <div class="admin-report-table-wrap">
                            <table class="admin-report-table">
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>Surname</th>
                                  <th>ID Number</th>
                                  <th>Job Title</th>
                                  <th>OFO Code</th>
                                  <th>Race</th>
                                  <th>Gender</th>
                                  <th>Municipality</th>
                                  <th>Manager</th>
                                  <th>Development Need</th>
                                  <th>Planned Action</th>
                                  <th>Support Required</th>
                                  <th>Date Captured</th>
                                  <th>Target Date</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                @for (row of idpReportRows(); track row.id) {
                                  <tr>
                                    <td>{{ row.name }}</td>
                                    <td>{{ row.surname }}</td>
                                    <td>{{ row.idNumber }}</td>
                                    <td>{{ row.jobTitle }}</td>
                                    <td>{{ row.ofoCode }}</td>
                                    <td>{{ row.race }}</td>
                                    <td>{{ row.gender }}</td>
                                    <td>{{ row.municipality }}</td>
                                    <td>{{ row.manager }}</td>
                                    <td>{{ row.developmentNeed }}</td>
                                    <td>{{ row.plannedAction }}</td>
                                    <td>{{ row.supportRequired }}</td>
                                    <td>{{ row.dateCaptured }}</td>
                                    <td>{{ row.targetDate }}</td>
                                    <td>{{ row.status }}</td>
                                  </tr>
                                }
                              </tbody>
                            </table>
                          </div>
                        }
                      </div>
                    }

                    @if (selectedReportView() === 'performance-report') {
                      <div class="admin-report-content-stack">
                        <article class="admin-section-card">
                          <div class="admin-section-card-header">
                            <h2>Report preview</h2>
                            <span>{{ performanceReportRows().length }} rows</span>
                          </div>

                          <div class="admin-report-preview-meta">
                            <span class="admin-chip">10 fields</span>
                            <span class="admin-chip">{{ performanceReportRows().length }} rows included</span>
                          </div>

                          <div class="admin-report-actions">
                            <label class="admin-report-filter-field admin-report-download-field">
                              <span>Download As</span>
                              <select [value]="selectedPerformanceReportDownloadFormat()" (change)="updatePerformanceReportDownloadFormat($event)">
                                <option value="CSV">CSV</option>
                                <option value="XLSX">XLSX</option>
                              </select>
                            </label>
                            <button type="button" class="admin-primary-btn" [disabled]="!canDownloadPerformanceReport()" (click)="downloadPerformanceReport()">Download report</button>
                          </div>

                          @if (!performanceReportRows().length) {
                            <div class="admin-empty-state">No LMS users were found to include in this report.</div>
                          }
                        </article>

                        @if (performanceReportRows().length) {
                          <div class="admin-report-table-wrap">
                            <table class="admin-report-table">
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>Surname</th>
                                  <th>ID Number</th>
                                  <th>Job Title</th>
                                  <th>Department</th>
                                  <th>Manager</th>
                                  <th>KPIs</th>
                                  <th>Total Weight</th>
                                  <th>Overall Rating</th>
                                  <th>Last Review</th>
                                </tr>
                              </thead>
                              <tbody>
                                @for (row of performanceReportRows(); track row.id) {
                                  <tr>
                                    <td>{{ row.name }}</td>
                                    <td>{{ row.surname }}</td>
                                    <td>{{ row.idNumber }}</td>
                                    <td>{{ row.jobTitle }}</td>
                                    <td>{{ row.department }}</td>
                                    <td>{{ row.manager }}</td>
                                    <td>{{ row.kpiCount }}</td>
                                    <td>{{ row.totalWeight }}%</td>
                                    <td>{{ row.overallRatingLabel }}</td>
                                    <td>{{ row.lastReviewDate }}</td>
                                  </tr>
                                }
                              </tbody>
                            </table>
                          </div>
                        }
                      </div>
                    }

                    @if (selectedReportView() === 'certificate-licence-report') {
                      <div class="admin-report-content-stack">
                        <article class="admin-section-card">
                          <div class="admin-section-card-header">
                            <h2>Report preview</h2>
                            <span>{{ certificateLicenceReportRows().length }} rows</span>
                          </div>

                          <div class="admin-report-preview-meta">
                            <span class="admin-chip">8 fields</span>
                            <span class="admin-chip">{{ certificateLicenceReportRows().length }} rows included</span>
                          </div>

                          <div class="admin-report-actions">
                            <label class="admin-report-filter-field admin-report-download-field">
                              <span>Download As</span>
                              <select [value]="selectedCertificateReportDownloadFormat()" (change)="updateCertificateReportDownloadFormat($event)">
                                <option value="CSV">CSV</option>
                                <option value="XLSX">XLSX</option>
                              </select>
                            </label>
                            <button type="button" class="admin-primary-btn" [disabled]="!canDownloadCertificateLicenceReport()" (click)="downloadCertificateLicenceReport()">Download report</button>
                          </div>

                          @if (!certificateLicenceReportRows().length) {
                            <div class="admin-empty-state">No certificate or licence records were found for current learners.</div>
                          }
                        </article>

                        @if (certificateLicenceReportRows().length) {
                          <div class="admin-report-table-wrap">
                            <table class="admin-report-table">
                              <thead>
                                <tr>
                                  <th>Full Name</th>
                                  <th>Surname</th>
                                  <th>ID Number</th>
                                  <th>Department</th>
                                  <th>Certificate Name</th>
                                  <th>Expiry Date</th>
                                  <th>Renewal Required</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                @for (row of certificateLicenceReportRows(); track row.id) {
                                  <tr>
                                    <td>{{ row.name }}</td>
                                    <td>{{ row.surname }}</td>
                                    <td>{{ row.idNumber }}</td>
                                    <td>{{ row.department }}</td>
                                    <td>{{ row.certificateName }}</td>
                                    <td>{{ row.expiryDate }}</td>
                                    <td>{{ row.renewalRequired }}</td>
                                    <td>{{ row.status }}</td>
                                  </tr>
                                }
                              </tbody>
                            </table>
                          </div>
                        }
                      </div>
                    }

                    @if (selectedReportView() === 'seta-report' && !selectedSetaReportTab()) {
                      <div class="admin-report-content-stack">
                        <article class="admin-section-card admin-report-menu-card">
                          <div class="admin-section-card-header">
                            <h2>SETA Report</h2>
                            <span>2 available</span>
                          </div>

                          <div class="admin-report-menu" role="list" aria-label="SETA report list">
                            <button type="button" class="admin-report-menu-item" (click)="selectSetaReportTab('atr')">
                              <span class="admin-report-menu-text">
                                <strong>ATR — Annual Training Report</strong>
                                <span>Training already delivered, for SETA submission.</span>
                              </span>
                              <span class="admin-report-menu-cta">View report
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                              </span>
                            </button>
                            <button type="button" class="admin-report-menu-item" (click)="selectSetaReportTab('wsp')">
                              <span class="admin-report-menu-text">
                                <strong>WSP — Workplace Skills Plan</strong>
                                <span>Training currently planned or in progress.</span>
                              </span>
                              <span class="admin-report-menu-cta">View report
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                              </span>
                            </button>
                          </div>
                        </article>
                      </div>
                    }

                    @if (selectedReportView() === 'seta-report' && selectedSetaReportTab() === 'atr' && !selectedAtrSubReport()) {
                      <div class="admin-report-content-stack">
                        <article class="admin-section-card admin-report-menu-card">
                          <div class="admin-section-card-header">
                            <h2>ATR</h2>
                            <span>3 available</span>
                          </div>

                          <p class="admin-report-note">
                            These 3 reports match the official SETA MIS upload templates column-for-column. Fields
                            this LMS doesn't capture yet (NQF Level, Disability Status, Socio Economic Status,
                            Funding Type, DG Contract Number, Programme Needs Addressed, Type Of Educational
                            Institution, Entry/Intermediate/Advanced Level) show "Not captured" or 0 — Age Group is
                            derived from each learner's South African ID number instead of left blank.
                          </p>

                          <div class="admin-report-menu" role="list" aria-label="ATR sub-report list">
                            <button type="button" class="admin-report-menu-item" (click)="selectAtrSubReport('beneficiaries-completed')">
                              <span class="admin-report-menu-text">
                                <strong>Beneficiaries Completed Training</strong>
                                <span>Aggregate by occupation, municipality and programme, with demographic counts.</span>
                              </span>
                              <span class="admin-report-menu-cta">View report
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                              </span>
                            </button>
                            <button type="button" class="admin-report-menu-item" (click)="selectAtrSubReport('number-beneficiaries')">
                              <span class="admin-report-menu-text">
                                <strong>Number of Actual Beneficiaries</strong>
                                <span>Total headcount by occupation and municipality, with demographic counts.</span>
                              </span>
                              <span class="admin-report-menu-cta">View report
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                              </span>
                            </button>
                            <button type="button" class="admin-report-menu-item" (click)="selectAtrSubReport('pivotal-actual')">
                              <span class="admin-report-menu-text">
                                <strong>Pivotal Actual Training Report</strong>
                                <span>Per-learner Pivotal programme records with ID number and demographics.</span>
                              </span>
                              <span class="admin-report-menu-cta">View report
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                              </span>
                            </button>
                          </div>
                        </article>
                      </div>
                    }

                    @if (selectedReportView() === 'seta-report' && selectedSetaReportTab() === 'atr' && selectedAtrSubReport()) {
                      <div class="admin-report-content-stack">
                        <article class="admin-section-card">
                          <div class="admin-section-card-header">
                            <h2>
                              @if (selectedAtrSubReport() === 'beneficiaries-completed') { Beneficiaries Completed Training }
                              @else if (selectedAtrSubReport() === 'number-beneficiaries') { Number of Actual Beneficiaries }
                              @else { Pivotal Actual Training Report }
                            </h2>
                            <span>
                              @if (selectedAtrSubReport() === 'beneficiaries-completed') { {{ beneficiariesCompletedTrainingRows().length }} rows }
                              @else if (selectedAtrSubReport() === 'number-beneficiaries') { {{ numberBeneficiariesRows().length }} rows }
                              @else { {{ pivotalActualTrainingRows().length }} rows }
                            </span>
                          </div>

                          <div class="admin-report-actions">
                            <button type="button" class="admin-secondary-btn" (click)="selectedAtrSubReport.set(null)">Back to ATR</button>
                            <label class="admin-report-filter-field">
                              <span>Date From</span>
                              <input type="date" [value]="selectedAtrReportDateFrom()" (input)="updateAtrReportDateFrom($event)" />
                            </label>
                            <label class="admin-report-filter-field">
                              <span>Date To</span>
                              <input type="date" [value]="selectedAtrReportDateTo()" (input)="updateAtrReportDateTo($event)" />
                            </label>
                            @if (selectedAtrReportDateFrom() || selectedAtrReportDateTo()) {
                              <button type="button" class="admin-secondary-btn" (click)="clearAtrReportDateFilters()">Clear dates</button>
                            }
                            <label class="admin-report-filter-field admin-report-download-field">
                              <span>Download As</span>
                              <select [value]="selectedAtrSubReportDownloadFormat()" (change)="updateAtrSubReportDownloadFormat($event)">
                                <option value="CSV">CSV</option>
                                <option value="XLSX">XLSX</option>
                              </select>
                            </label>
                            @if (selectedAtrSubReport() === 'beneficiaries-completed') {
                              <button type="button" class="admin-primary-btn" [disabled]="!canDownloadBeneficiariesCompletedTrainingReport()" (click)="downloadBeneficiariesCompletedTrainingReport()">Download report</button>
                            } @else if (selectedAtrSubReport() === 'number-beneficiaries') {
                              <button type="button" class="admin-primary-btn" [disabled]="!canDownloadNumberBeneficiariesReport()" (click)="downloadNumberBeneficiariesReport()">Download report</button>
                            } @else {
                              <button type="button" class="admin-primary-btn" [disabled]="!canDownloadPivotalActualTrainingReport()" (click)="downloadPivotalActualTrainingReport()">Download report</button>
                            }
                          </div>
                          <p class="admin-report-note admin-report-note-compact">Dates filter by training approval date (reviewed, falling back to submitted).</p>
                        </article>

                        @if (selectedAtrSubReport() === 'beneficiaries-completed') {
                          @if (beneficiariesCompletedTrainingRows().length) {
                            <div class="admin-report-table-wrap">
                              <table class="admin-report-table">
                                <thead>
                                  <tr>
                                    <th>OFO Occupation</th><th>Municipality</th><th>NQF Aligned Training</th><th>NQF Level</th>
                                    <th>Programme Needs Addressed</th><th>Funding Type</th><th>DG Contract Number</th>
                                    <th>Socio Economic Status</th><th>Type Of Learning Programme</th><th>Name Of Learning Programme</th>
                                    <th>Type Of Educational Institution</th><th>Total Actual Cost</th>
                                    <th>Entry Level</th><th>Intermediate Level</th><th>Advanced Level</th>
                                    <th>African Male</th><th>African Female</th><th>African Disabled</th>
                                    <th>Coloured Male</th><th>Coloured Female</th><th>Coloured Disabled</th>
                                    <th>Indian/Asian Male</th><th>Indian/Asian Female</th><th>Indian/Asian Disabled</th>
                                    <th>White Male</th><th>White Female</th><th>White Disabled</th>
                                    <th>Age &lt; 35</th><th>Age 35-55</th><th>Age &gt; 55</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  @for (row of beneficiariesCompletedTrainingRows(); track row.id) {
                                    <tr>
                                      <td>{{ row.ofoOccupation }}</td><td>{{ row.municipality }}</td><td>{{ row.nqfAlignedTraining }}</td><td>{{ row.nqfLevel }}</td>
                                      <td>{{ row.programmeNeedsAddressed }}</td><td>{{ row.fundingType }}</td><td>{{ row.dgContractNumber }}</td>
                                      <td>{{ row.socioEconomicStatus }}</td><td>{{ row.typeOfLearningProgramme }}</td><td>{{ row.nameOfLearningProgramme }}</td>
                                      <td>{{ row.typeOfEducationalInstitution }}</td><td>{{ row.totalActualCost }}</td>
                                      <td>{{ row.entryLevel }}</td><td>{{ row.intermediateLevel }}</td><td>{{ row.advancedLevel }}</td>
                                      <td>{{ row.africanMale }}</td><td>{{ row.africanFemale }}</td><td>{{ row.africanDisabled }}</td>
                                      <td>{{ row.colouredMale }}</td><td>{{ row.colouredFemale }}</td><td>{{ row.colouredDisabled }}</td>
                                      <td>{{ row.indianMale }}</td><td>{{ row.indianFemale }}</td><td>{{ row.indianDisabled }}</td>
                                      <td>{{ row.whiteMale }}</td><td>{{ row.whiteFemale }}</td><td>{{ row.whiteDisabled }}</td>
                                      <td>{{ row.age1 }}</td><td>{{ row.age2 }}</td><td>{{ row.age3 }}</td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>
                          } @else {
                            <div class="admin-empty-state">No approved training records to summarise yet.</div>
                          }
                        }

                        @if (selectedAtrSubReport() === 'number-beneficiaries') {
                          @if (numberBeneficiariesRows().length) {
                            <div class="admin-report-table-wrap">
                              <table class="admin-report-table">
                                <thead>
                                  <tr>
                                    <th>OFO Occupation</th><th>Municipality</th>
                                    <th>African Male</th><th>African Female</th><th>African Disabled</th>
                                    <th>Coloured Male</th><th>Coloured Female</th><th>Coloured Disabled</th>
                                    <th>Indian/Asian Male</th><th>Indian/Asian Female</th><th>Indian/Asian Disabled</th>
                                    <th>White Male</th><th>White Female</th><th>White Disabled</th>
                                    <th>Age &lt; 35</th><th>Age 35-55</th><th>Age &gt; 55</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  @for (row of numberBeneficiariesRows(); track row.id) {
                                    <tr>
                                      <td>{{ row.ofoOccupation }}</td><td>{{ row.municipality }}</td>
                                      <td>{{ row.africanMale }}</td><td>{{ row.africanFemale }}</td><td>{{ row.africanDisabled }}</td>
                                      <td>{{ row.colouredMale }}</td><td>{{ row.colouredFemale }}</td><td>{{ row.colouredDisabled }}</td>
                                      <td>{{ row.indianMale }}</td><td>{{ row.indianFemale }}</td><td>{{ row.indianDisabled }}</td>
                                      <td>{{ row.whiteMale }}</td><td>{{ row.whiteFemale }}</td><td>{{ row.whiteDisabled }}</td>
                                      <td>{{ row.age1 }}</td><td>{{ row.age2 }}</td><td>{{ row.age3 }}</td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>
                          } @else {
                            <div class="admin-empty-state">No approved training records to summarise yet.</div>
                          }
                        }

                        @if (selectedAtrSubReport() === 'pivotal-actual') {
                          @if (pivotalActualTrainingRows().length) {
                            <div class="admin-report-table-wrap">
                              <table class="admin-report-table">
                                <thead>
                                  <tr>
                                    <th>OFO Occupation</th><th>Municipality</th><th>Programme Needs Addressed</th><th>Funding Type</th>
                                    <th>DG Contract Number</th><th>ID Number</th><th>First Name</th><th>Surname</th>
                                    <th>Socio Economic Status</th><th>Type Of Learning Programme</th><th>Name Of Learning Programme</th>
                                    <th>Pivotal Programmes</th><th>Type Of Educational Institution</th><th>NQF Level</th><th>Cost</th>
                                    <th>Entry Level</th><th>Intermediate Level</th><th>Advanced Level</th>
                                    <th>African Male</th><th>African Female</th><th>African Disabled</th>
                                    <th>Coloured Male</th><th>Coloured Female</th><th>Coloured Disabled</th>
                                    <th>Indian/Asian Male</th><th>Indian/Asian Female</th><th>Indian/Asian Disabled</th>
                                    <th>White Male</th><th>White Female</th><th>White Disabled</th>
                                    <th>Age &lt; 35</th><th>Age 35-55</th><th>Age &gt; 55</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  @for (row of pivotalActualTrainingRows(); track row.id) {
                                    <tr>
                                      <td>{{ row.ofoOccupation }}</td><td>{{ row.municipality }}</td><td>{{ row.programmeNeedsAddressed }}</td><td>{{ row.fundingType }}</td>
                                      <td>{{ row.dgContractNumber }}</td><td>{{ row.idNumber }}</td><td>{{ row.firstName }}</td><td>{{ row.surname }}</td>
                                      <td>{{ row.socioEconomicStatus }}</td><td>{{ row.typeOfLearningProgramme }}</td><td>{{ row.nameOfLearningProgramme }}</td>
                                      <td>{{ row.pivotalOfoOccupation }}</td><td>{{ row.typeOfEducationalInstitution }}</td><td>{{ row.nqfLevel }}</td><td>{{ row.cost }}</td>
                                      <td>{{ row.entryLevel }}</td><td>{{ row.intermediateLevel }}</td><td>{{ row.advancedLevel }}</td>
                                      <td>{{ row.africanMale }}</td><td>{{ row.africanFemale }}</td><td>{{ row.africanDisabled }}</td>
                                      <td>{{ row.colouredMale }}</td><td>{{ row.colouredFemale }}</td><td>{{ row.colouredDisabled }}</td>
                                      <td>{{ row.indianMale }}</td><td>{{ row.indianFemale }}</td><td>{{ row.indianDisabled }}</td>
                                      <td>{{ row.whiteMale }}</td><td>{{ row.whiteFemale }}</td><td>{{ row.whiteDisabled }}</td>
                                      <td>{{ row.age1 }}</td><td>{{ row.age2 }}</td><td>{{ row.age3 }}</td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>
                          } @else {
                            <div class="admin-empty-state">No approved training records yet.</div>
                          }
                        }
                      </div>
                    }

                    @if (selectedReportView() === 'seta-report' && selectedSetaReportTab() === 'wsp' && !selectedWspSubReport()) {
                      <div class="admin-report-content-stack">
                        <article class="admin-section-card admin-report-menu-card">
                          <div class="admin-section-card-header">
                            <h2>WSP</h2>
                            <span>3 available</span>
                          </div>

                          <p class="admin-report-note">
                            These 3 reports match the official SETA MIS upload templates column-for-column. Planned
                            training is drawn from internal LMS course assignments not yet completed and from IDP
                            Development Need entries not yet marked Completed. Fields this LMS doesn't capture yet
                            (NQF Level, Disability Status, Socio Economic Status, Funding Type, DG Contract Number,
                            Programme Needs Addressed, Type Of Educational Institution, Entry/Intermediate/Advanced
                            Level, cost of planned training) show "Not captured" or 0.
                          </p>

                          <div class="admin-report-menu" role="list" aria-label="WSP sub-report list">
                            <button type="button" class="admin-report-menu-item" (click)="selectWspSubReport('beneficiaries-planned')">
                              <span class="admin-report-menu-text">
                                <strong>Beneficiaries Planned (Non-Pivotal) Training</strong>
                                <span>Aggregate by occupation, municipality and planned programme.</span>
                              </span>
                              <span class="admin-report-menu-cta">View report
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                              </span>
                            </button>
                            <button type="button" class="admin-report-menu-item" (click)="selectWspSubReport('employment-summary')">
                              <span class="admin-report-menu-text">
                                <strong>Employment Summary</strong>
                                <span>Whole-workforce headcount by occupation and municipality.</span>
                              </span>
                              <span class="admin-report-menu-cta">View report
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                              </span>
                            </button>
                            <button type="button" class="admin-report-menu-item" (click)="selectWspSubReport('pivotal-planned')">
                              <span class="admin-report-menu-text">
                                <strong>Pivotal Planned Training Report</strong>
                                <span>Per-learner planned Pivotal programme records.</span>
                              </span>
                              <span class="admin-report-menu-cta">View report
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                              </span>
                            </button>
                          </div>
                        </article>
                      </div>
                    }

                    @if (selectedReportView() === 'seta-report' && selectedSetaReportTab() === 'wsp' && selectedWspSubReport()) {
                      <div class="admin-report-content-stack">
                        <article class="admin-section-card">
                          <div class="admin-section-card-header">
                            <h2>
                              @if (selectedWspSubReport() === 'beneficiaries-planned') { Beneficiaries Planned (Non-Pivotal) Training }
                              @else if (selectedWspSubReport() === 'employment-summary') { Employment Summary }
                              @else { Pivotal Planned Training Report }
                            </h2>
                            <span>
                              @if (selectedWspSubReport() === 'beneficiaries-planned') { {{ wspBeneficiariesPlannedRows().length }} rows }
                              @else if (selectedWspSubReport() === 'employment-summary') { {{ wspEmploymentSummaryRows().length }} rows }
                              @else { {{ wspPivotalPlannedRows().length }} rows }
                            </span>
                          </div>

                          <div class="admin-report-actions">
                            <button type="button" class="admin-secondary-btn" (click)="selectedWspSubReport.set(null)">Back to WSP</button>
                            @if (selectedWspSubReport() !== 'employment-summary') {
                              <label class="admin-report-filter-field">
                                <span>Date From</span>
                                <input type="date" [value]="selectedWspReportDateFrom()" (input)="updateWspReportDateFrom($event)" />
                              </label>
                              <label class="admin-report-filter-field">
                                <span>Date To</span>
                                <input type="date" [value]="selectedWspReportDateTo()" (input)="updateWspReportDateTo($event)" />
                              </label>
                              @if (selectedWspReportDateFrom() || selectedWspReportDateTo()) {
                                <button type="button" class="admin-secondary-btn" (click)="clearWspReportDateFilters()">Clear dates</button>
                              }
                            }
                            <label class="admin-report-filter-field admin-report-download-field">
                              <span>Download As</span>
                              <select [value]="selectedWspSubReportDownloadFormat()" (change)="updateWspSubReportDownloadFormat($event)">
                                <option value="CSV">CSV</option>
                                <option value="XLSX">XLSX</option>
                              </select>
                            </label>
                            @if (selectedWspSubReport() === 'beneficiaries-planned') {
                              <button type="button" class="admin-primary-btn" [disabled]="!canDownloadWspBeneficiariesPlannedReport()" (click)="downloadWspBeneficiariesPlannedReport()">Download report</button>
                            } @else if (selectedWspSubReport() === 'employment-summary') {
                              <button type="button" class="admin-primary-btn" [disabled]="!canDownloadWspEmploymentSummaryReport()" (click)="downloadWspEmploymentSummaryReport()">Download report</button>
                            } @else {
                              <button type="button" class="admin-primary-btn" [disabled]="!canDownloadWspPivotalPlannedReport()" (click)="downloadWspPivotalPlannedReport()">Download report</button>
                            }
                          </div>
                          @if (selectedWspSubReport() !== 'employment-summary') {
                            <p class="admin-report-note admin-report-note-compact">Dates filter by each planned item's target date — course completion deadline, or IDP target date.</p>
                          } @else {
                            <p class="admin-report-note admin-report-note-compact">Employment Summary profiles the whole current workforce and has no per-record date to filter by.</p>
                          }
                        </article>

                        @if (selectedWspSubReport() === 'beneficiaries-planned') {
                          @if (wspBeneficiariesPlannedRows().length) {
                            <div class="admin-report-table-wrap">
                              <table class="admin-report-table">
                                <thead>
                                  <tr>
                                    <th>OFO Occupation</th><th>Municipality</th><th>NQF Aligned Training</th><th>NQF Level</th>
                                    <th>Programme Needs Addressed</th><th>Funding Type</th><th>DG Contract Number</th>
                                    <th>Socio Economic Status</th><th>Type Of Learning Programme</th><th>Name Of Learning Programme</th>
                                    <th>Type Of Educational Institution</th><th>Total Estimated Cost</th>
                                    <th>Entry Level</th><th>Intermediate Level</th><th>Advanced Level</th>
                                    <th>African Male</th><th>African Female</th><th>African Disabled</th>
                                    <th>Coloured Male</th><th>Coloured Female</th><th>Coloured Disabled</th>
                                    <th>Indian/Asian Male</th><th>Indian/Asian Female</th><th>Indian/Asian Disabled</th>
                                    <th>White Male</th><th>White Female</th><th>White Disabled</th>
                                    <th>Age &lt; 35</th><th>Age 35-55</th><th>Age &gt; 55</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  @for (row of wspBeneficiariesPlannedRows(); track row.id) {
                                    <tr>
                                      <td>{{ row.ofoOccupation }}</td><td>{{ row.municipality }}</td><td>{{ row.nqfAlignedTraining }}</td><td>{{ row.nqfLevel }}</td>
                                      <td>{{ row.programmeNeedsAddressed }}</td><td>{{ row.fundingType }}</td><td>{{ row.dgContractNumber }}</td>
                                      <td>{{ row.socioEconomicStatus }}</td><td>{{ row.typeOfLearningProgramme }}</td><td>{{ row.nameOfLearningProgramme }}</td>
                                      <td>{{ row.typeOfEducationalInstitution }}</td><td>{{ row.totalEstimatedCost }}</td>
                                      <td>{{ row.entryLevel }}</td><td>{{ row.intermediateLevel }}</td><td>{{ row.advancedLevel }}</td>
                                      <td>{{ row.africanMale }}</td><td>{{ row.africanFemale }}</td><td>{{ row.africanDisabled }}</td>
                                      <td>{{ row.colouredMale }}</td><td>{{ row.colouredFemale }}</td><td>{{ row.colouredDisabled }}</td>
                                      <td>{{ row.indianMale }}</td><td>{{ row.indianFemale }}</td><td>{{ row.indianDisabled }}</td>
                                      <td>{{ row.whiteMale }}</td><td>{{ row.whiteFemale }}</td><td>{{ row.whiteDisabled }}</td>
                                      <td>{{ row.age1 }}</td><td>{{ row.age2 }}</td><td>{{ row.age3 }}</td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>
                          } @else {
                            <div class="admin-empty-state">No planned training records yet.</div>
                          }
                        }

                        @if (selectedWspSubReport() === 'employment-summary') {
                          @if (wspEmploymentSummaryRows().length) {
                            <div class="admin-report-table-wrap">
                              <table class="admin-report-table">
                                <thead>
                                  <tr>
                                    <th>OFO Occupation</th><th>Municipality</th>
                                    <th>African Male</th><th>African Female</th><th>African Disabled</th>
                                    <th>Coloured Male</th><th>Coloured Female</th><th>Coloured Disabled</th>
                                    <th>Indian/Asian Male</th><th>Indian/Asian Female</th><th>Indian/Asian Disabled</th>
                                    <th>White Male</th><th>White Female</th><th>White Disabled</th>
                                    <th>Age &lt; 35</th><th>Age 35-55</th><th>Age &gt; 55</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  @for (row of wspEmploymentSummaryRows(); track row.id) {
                                    <tr>
                                      <td>{{ row.ofoOccupation }}</td><td>{{ row.municipality }}</td>
                                      <td>{{ row.africanMale }}</td><td>{{ row.africanFemale }}</td><td>{{ row.africanDisabled }}</td>
                                      <td>{{ row.colouredMale }}</td><td>{{ row.colouredFemale }}</td><td>{{ row.colouredDisabled }}</td>
                                      <td>{{ row.indianMale }}</td><td>{{ row.indianFemale }}</td><td>{{ row.indianDisabled }}</td>
                                      <td>{{ row.whiteMale }}</td><td>{{ row.whiteFemale }}</td><td>{{ row.whiteDisabled }}</td>
                                      <td>{{ row.age1 }}</td><td>{{ row.age2 }}</td><td>{{ row.age3 }}</td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>
                          } @else {
                            <div class="admin-empty-state">No users to summarise yet.</div>
                          }
                        }

                        @if (selectedWspSubReport() === 'pivotal-planned') {
                          @if (wspPivotalPlannedRows().length) {
                            <div class="admin-report-table-wrap">
                              <table class="admin-report-table">
                                <thead>
                                  <tr>
                                    <th>OFO Occupation</th><th>Municipality</th><th>Programme Needs Addressed</th><th>Funding Type</th>
                                    <th>DG Contract Number</th><th>ID Number</th><th>First Name</th><th>Surname</th>
                                    <th>Socio Economic Status</th><th>Type Of Learning Programme</th><th>Name Of Learning Programme</th>
                                    <th>Pivotal Programmes</th><th>Type Of Educational Institution</th><th>NQF Level</th><th>Cost</th>
                                    <th>Entry Level</th><th>Intermediate Level</th><th>Advanced Level</th>
                                    <th>African Male</th><th>African Female</th><th>African Disabled</th>
                                    <th>Coloured Male</th><th>Coloured Female</th><th>Coloured Disabled</th>
                                    <th>Indian/Asian Male</th><th>Indian/Asian Female</th><th>Indian/Asian Disabled</th>
                                    <th>White Male</th><th>White Female</th><th>White Disabled</th>
                                    <th>Age &lt; 35</th><th>Age 35-55</th><th>Age &gt; 55</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  @for (row of wspPivotalPlannedRows(); track row.id) {
                                    <tr>
                                      <td>{{ row.ofoOccupation }}</td><td>{{ row.municipality }}</td><td>{{ row.programmeNeedsAddressed }}</td><td>{{ row.fundingType }}</td>
                                      <td>{{ row.dgContractNumber }}</td><td>{{ row.idNumber }}</td><td>{{ row.firstName }}</td><td>{{ row.surname }}</td>
                                      <td>{{ row.socioEconomicStatus }}</td><td>{{ row.typeOfLearningProgramme }}</td><td>{{ row.nameOfLearningProgramme }}</td>
                                      <td>{{ row.pivotalOfoOccupation }}</td><td>{{ row.typeOfEducationalInstitution }}</td><td>{{ row.nqfLevel }}</td><td>{{ row.cost }}</td>
                                      <td>{{ row.entryLevel }}</td><td>{{ row.intermediateLevel }}</td><td>{{ row.advancedLevel }}</td>
                                      <td>{{ row.africanMale }}</td><td>{{ row.africanFemale }}</td><td>{{ row.africanDisabled }}</td>
                                      <td>{{ row.colouredMale }}</td><td>{{ row.colouredFemale }}</td><td>{{ row.colouredDisabled }}</td>
                                      <td>{{ row.indianMale }}</td><td>{{ row.indianFemale }}</td><td>{{ row.indianDisabled }}</td>
                                      <td>{{ row.whiteMale }}</td><td>{{ row.whiteFemale }}</td><td>{{ row.whiteDisabled }}</td>
                                      <td>{{ row.age1 }}</td><td>{{ row.age2 }}</td><td>{{ row.age3 }}</td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>
                          } @else {
                            <div class="admin-empty-state">No planned training records yet.</div>
                          }
                        }
                      </div>
                    }

                  </article>
                }
              </div>
            </section>
          }

          @if (selectedPanel() === 'succession') {
            <section class="admin-panel">
              <div class="section-heading-block">
                <p class="eyebrow">Succession Planning</p>
                <h1>Company-wide succession overview</h1>
                <p class="section-copy">Read-only — each manager flags critical roles on their own team and manages nominations for them directly.</p>
              </div>

              <div class="admin-report-actions succession-org-view-tabs">
                <button type="button" [class]="selectedSuccessionAdminView() === 'overview' ? 'admin-primary-btn' : 'admin-secondary-btn'" (click)="selectedSuccessionAdminView.set('overview')">Overview</button>
                <button type="button" [class]="selectedSuccessionAdminView() === 'organogram' ? 'admin-primary-btn' : 'admin-secondary-btn'" (click)="selectedSuccessionAdminView.set('organogram')">Organogram</button>
              </div>

              @if (selectedSuccessionAdminView() === 'organogram') {
                <section class="admin-section-card">
                  <div class="admin-section-card-header">
                    <h2>Succession organogram</h2>
                    <span>{{ managerData.successionRoles().length }} critical roles</span>
                  </div>
                  <p class="admin-report-note admin-report-note-compact">Each box is a critical role, nested under the role of the manager who owns it wherever that manager is themselves flagged. The colour bar shows the best successor readiness in that role's pipeline.</p>

                  @if (successionOrgTree().length) {
                    <div class="org-chart-scroll">
                      <ul class="org-chart-root">
                        @for (node of successionOrgTree(); track node.role.id) {
                          <ng-container [ngTemplateOutlet]="orgNodeTpl" [ngTemplateOutletContext]="{ $implicit: node }"></ng-container>
                        }
                      </ul>
                    </div>

                    <div class="org-chart-legend">
                      <span class="org-chart-legend-item"><span class="org-chart-legend-swatch org-chart-legend-swatch-ready-now"></span>Ready now</span>
                      <span class="org-chart-legend-item"><span class="org-chart-legend-swatch org-chart-legend-swatch-1-2-years"></span>1-2 years</span>
                      <span class="org-chart-legend-item"><span class="org-chart-legend-swatch org-chart-legend-swatch-3-plus-years"></span>3+ years</span>
                      <span class="org-chart-legend-item"><span class="org-chart-legend-swatch org-chart-legend-swatch-none"></span>No successor</span>
                    </div>

                    <ng-template #orgNodeTpl let-node>
                      <li class="org-chart-node">
                        <div class="org-chart-card" [class]="'org-chart-card-' + orgCardStatusSlug(node.role.id)">
                          <div class="org-chart-card-top">
                            <div class="org-chart-avatar" aria-hidden="true">{{ successorInitials(node.role.incumbentStudentId) }}</div>
                            <div class="org-chart-card-title-group">
                              <strong class="org-chart-card-title">{{ node.role.title }}</strong>
                              <span class="org-chart-card-meta">{{ successorName(node.role.incumbentStudentId) }} · {{ node.role.department }}</span>
                            </div>
                          </div>

                          @if (bestReadinessForRole(node.role.id); as bestRating) {
                            <span class="org-chart-readiness-pill" [class]="'org-chart-readiness-pill-' + readinessSlug(bestRating)">{{ bestRating }}</span>
                          } @else {
                            <span class="org-chart-readiness-pill org-chart-readiness-pill-none">No successor</span>
                          }

                          @if (nominationsForRole(node.role.id).length) {
                            <ul class="org-chart-successor-list">
                              @for (nomination of nominationsForRole(node.role.id); track nomination.id) {
                                <li>
                                  <span>{{ successorName(nomination.successorStudentId) }}</span>
                                  <span class="org-chart-readiness-pill org-chart-readiness-pill-sm" [class]="'org-chart-readiness-pill-' + readinessSlug(nomination.readinessRating)">{{ nomination.readinessRating }}</span>
                                </li>
                              }
                            </ul>
                          }
                        </div>

                        @if (node.children.length) {
                          <ul class="org-chart-children">
                            @for (child of node.children; track child.role.id) {
                              <ng-container [ngTemplateOutlet]="orgNodeTpl" [ngTemplateOutletContext]="{ $implicit: child }"></ng-container>
                            }
                          </ul>
                        }
                      </li>
                    </ng-template>
                  } @else {
                    <div class="admin-empty-state">No critical roles have been flagged yet.</div>
                  }
                </section>
              }

              @if (selectedSuccessionAdminView() === 'overview') {
              <section class="admin-section-card">
                <div class="admin-section-card-header">
                  <h2>Download report</h2>
                  <span>{{ managerData.successionRoles().length }} roles · {{ managerData.successorNominations().length }} nominations</span>
                </div>
                <p class="admin-report-note admin-report-note-compact">Includes every critical role and every successor nomination across the company, exactly as shown below.</p>
                <div class="admin-report-actions">
                  <label class="admin-report-filter-field admin-report-download-field">
                    <span>Download As</span>
                    <select [value]="selectedSuccessionReportDownloadFormat()" (change)="updateSuccessionReportDownloadFormat($event)">
                      <option value="CSV">CSV</option>
                      <option value="XLSX">XLSX</option>
                    </select>
                  </label>
                  <button type="button" class="admin-primary-btn" [disabled]="!canDownloadSuccessionReport()" (click)="downloadSuccessionReport()">Download report</button>
                </div>
              </section>

              <section class="admin-section-card">
                <h2>Critical roles</h2>
                @if (managerData.successionRoles().length) {
                  <div class="succession-report-table-wrap">
                    <table class="succession-report-table">
                      <thead>
                        <tr>
                          <th>Role</th>
                          <th>Department</th>
                          <th>Incumbent</th>
                          <th>Owning manager</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (role of managerData.successionRoles(); track role.id) {
                          <tr>
                            <td>{{ role.title }}</td>
                            <td>{{ role.department }}</td>
                            <td>{{ successorName(role.incumbentStudentId) }}</td>
                            <td>{{ ownerManagerName(role.ownerManagerId) }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                } @else {
                  <div class="admin-empty-state">No critical roles have been flagged yet.</div>
                }
              </section>

              <section class="admin-section-card">
                <h2>All nominations</h2>
                @if (managerData.successorNominations().length) {
                  <div class="succession-report-table-wrap">
                    <table class="succession-report-table">
                      <thead>
                        <tr>
                          <th>Role</th>
                          <th>Successor</th>
                          <th>Owning manager</th>
                          <th>Readiness</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (nomination of managerData.successorNominations(); track nomination.id) {
                          <tr>
                            <td>{{ roleTitle(nomination.roleId) }}</td>
                            <td>{{ successorName(nomination.successorStudentId) }}</td>
                            <td>{{ ownerManagerName(nomination.nominatedByManagerId) }}</td>
                            <td>{{ nomination.readinessRating }}</td>
                            <td><span class="succession-status-chip" [class.succession-status-active]="nomination.status === 'Active'" [class.succession-status-withdrawn]="nomination.status === 'Withdrawn'">{{ nomination.status }}</span></td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                } @else {
                  <div class="admin-empty-state">No successor nominations have been created yet.</div>
                }
              </section>
              }
            </section>
          }

          @if (selectedPanel() === 'settings') {
            <section class="admin-panel">
              <section class="admin-section-card">
                @if (!selectedSettingsSection()) {
                  <div class="admin-settings-menu" role="list" aria-label="System options">
                    <button type="button" class="admin-settings-menu-item" role="listitem" (click)="selectSettingsSection('profile-picture')">
                      <span class="admin-settings-menu-item-title">Admin profile picture</span>
                      <span class="admin-settings-menu-item-copy">Upload or remove the picture shown for your admin account.</span>
                      <span class="admin-settings-menu-item-status">{{ uploadingProfileImage() ? 'Uploading…' : (adminProfileImageDataUrl() ? 'Uploaded' : 'Using initials avatar') }}</span>
                    </button>
                    <button type="button" class="admin-settings-menu-item" role="listitem" (click)="selectSettingsSection('company-logo')">
                      <span class="admin-settings-menu-item-title">Company logo</span>
                      <span class="admin-settings-menu-item-copy">Upload the brand mark shown across the LMS.</span>
                      <span class="admin-settings-menu-item-status">{{ companyLogoUploading() ? 'Uploading…' : (branding.companyLogoDataUrl() ? 'Uploaded' : 'Default brand mark') }}</span>
                    </button>
                    <button type="button" class="admin-settings-menu-item" role="listitem" (click)="selectSettingsSection('theme')">
                      <span class="admin-settings-menu-item-title">Theme colour</span>
                      <span class="admin-settings-menu-item-copy">Choose the colour theme used across the admin, manager and student workspaces.</span>
                      <span class="admin-settings-menu-item-status">{{ branding.currentTheme().label }}</span>
                    </button>
                    <button type="button" class="admin-settings-menu-item" role="listitem" (click)="selectSettingsSection('hr-integration')">
                      <span class="admin-settings-menu-item-title">HR system integration</span>
                      <span class="admin-settings-menu-item-copy">Pull roster data automatically from an external HR system's API.</span>
                      <span class="admin-settings-menu-item-status">{{ hrIntegrationConfig()?.enabled ? 'Enabled' : 'Not connected' }}</span>
                    </button>
                    <button type="button" class="admin-settings-menu-item" role="listitem" (click)="selectSettingsSection('approval-settings')">
                      <span class="admin-settings-menu-item-title">Approval &amp; Reporting Settings</span>
                      <span class="admin-settings-menu-item-copy">Set how many people must sign off on KPI ratings and training requests, and manage who can approve them.</span>
                      <span class="admin-settings-menu-item-status">{{ managerData.explicitTrainingManagers().length }} approving {{ managerData.explicitTrainingManagers().length === 1 ? 'manager' : 'managers' }}</span>
                    </button>
                  </div>
                }

                @if (selectedSettingsSection()) {
                  <button type="button" class="admin-inline-btn admin-settings-back-btn" (click)="clearSettingsSection()">Back to settings</button>
                }

                @if (selectedSettingsSection() === 'profile-picture') {
                  <div class="admin-settings-section-detail">
                    <div class="admin-section-card-header">
                      <h2>Admin profile picture</h2>
                      <span>{{ uploadingProfileImage() ? 'Uploading…' : (adminProfileImageDataUrl() ? 'Uploaded' : 'Using initials avatar') }}</span>
                    </div>

                    <div class="admin-settings-item-controls admin-logo-panel">
                      <div class="admin-logo-preview" [class.admin-logo-preview-has-image]="!!adminProfileImageDataUrl()">
                        @if (adminProfileImageDataUrl()) {
                          <img [src]="adminProfileImageDataUrl()!" alt="Admin profile picture preview" />
                        } @else {
                          <span>{{ adminInitials() }}</span>
                        }
                      </div>

                      <div class="admin-logo-actions">
                        <label class="admin-upload-btn">
                          <span>{{ uploadingProfileImage() ? 'Uploading…' : 'Upload picture' }}</span>
                          <input type="file" accept="image/*" [disabled]="uploadingProfileImage()" (change)="onAdminProfileImageSelected($event)" />
                        </label>
                        <button type="button" class="admin-secondary-btn" [disabled]="!adminProfileImageDataUrl() || uploadingProfileImage()" (click)="clearAdminProfileImage()">Remove picture</button>
                      </div>
                    </div>
                  </div>
                }

                @if (selectedSettingsSection() === 'company-logo') {
                  <div class="admin-settings-section-detail">
                    <div class="admin-section-card-header">
                      <h2>Company logo</h2>
                      <span>{{ companyLogoUploading() ? 'Uploading…' : (branding.companyLogoDataUrl() ? 'Uploaded' : 'Default brand mark') }}</span>
                    </div>
                    @if (companyLogoUploadError()) {
                      <div class="admin-upload-feedback admin-upload-feedback-error" role="status" aria-live="polite">{{ companyLogoUploadError() }}</div>
                    }

                    <div class="admin-settings-item-controls admin-logo-panel">
                      <div class="admin-logo-preview" [class.admin-logo-preview-has-image]="!!branding.companyLogoDataUrl()">
                        @if (branding.companyLogoDataUrl()) {
                          <img [src]="branding.companyLogoDataUrl()!" alt="Selected company logo preview" />
                        } @else {
                          <span>AD</span>
                        }
                      </div>

                      <div class="admin-logo-actions">
                        <label class="admin-upload-btn" [class.admin-upload-btn-disabled]="companyLogoUploading()">
                          <span>{{ companyLogoUploading() ? 'Uploading…' : 'Upload logo' }}</span>
                          <input type="file" accept="image/*" [disabled]="companyLogoUploading()" (change)="onLogoSelected($event)" />
                        </label>
                        <button type="button" class="admin-secondary-btn" [disabled]="!branding.companyLogoDataUrl() || companyLogoUploading()" (click)="removeCompanyLogo()">Remove logo</button>
                      </div>
                    </div>
                  </div>
                }

                @if (selectedSettingsSection() === 'theme') {
                  <div class="admin-settings-section-detail">
                    <div class="admin-section-card-header">
                      <h2>Theme colour</h2>
                      <span>{{ branding.currentTheme().label }}</span>
                    </div>

                    <div class="admin-settings-item-controls admin-settings-item-controls-stack">
                      @if (themeUpdateError()) {
                        <div class="admin-upload-feedback admin-upload-feedback-error" role="status" aria-live="polite">{{ themeUpdateError() }}</div>
                      }

                      <label class="admin-settings-field">
                        <span>Colour</span>
                        <select [value]="branding.selectedThemeId()" (change)="onThemeSelectionChange($event)">
                          @for (theme of branding.themeOptions; track theme.id) {
                            <option [value]="theme.id">{{ theme.label }}</option>
                          }
                        </select>
                      </label>

                      <div class="admin-theme-selection-summary" aria-live="polite">
                        <div class="admin-theme-swatches" aria-hidden="true">
                          <span [style.background]="branding.currentTheme().primary"></span>
                          <span [style.background]="branding.currentTheme().secondary"></span>
                          <span [style.background]="branding.currentTheme().tint"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                }

                @if (selectedSettingsSection() === 'hr-integration') {
                  <div class="admin-settings-section-detail">
                    <div class="admin-section-card-header">
                      <h2>HR system integration</h2>
                      <span>{{ hrIntegrationConfig()?.enabled ? 'Enabled' : 'Not connected' }}</span>
                    </div>

                    <p class="admin-settings-hint">
                      The configured endpoint must return a JSON array of roster records with at least <code>email</code>, <code>name</code>, <code>surname</code>, <code>department</code>, <code>group</code>, <code>dateEnrolled</code> and <code>deadlineDate</code>. A matching email updates that user; a new email adds one. Nothing already in the roster is ever removed by a sync.
                    </p>

                    @if (hrIntegrationLoading()) {
                      <div class="admin-upload-feedback" aria-live="polite"><loading-spinner label="Loading…" /></div>
                    }

                    @if (hrIntegrationSaveError()) {
                      <div class="admin-upload-feedback admin-upload-feedback-error" role="status" aria-live="polite">{{ hrIntegrationSaveError() }}</div>
                    }

                    <form class="admin-settings-item-controls admin-settings-item-controls-stack" [formGroup]="hrIntegrationForm" (ngSubmit)="saveHrIntegrationConfig()">
                      <label class="admin-settings-field">
                        <span>Status</span>
                        <select formControlName="enabled">
                          <option [ngValue]="true">Enabled</option>
                          <option [ngValue]="false">Disabled</option>
                        </select>
                      </label>

                      <label class="admin-settings-field">
                        <span>HR endpoint URL</span>
                        <input type="url" formControlName="baseUrl" placeholder="https://hr.example.com/api/roster" />
                      </label>

                      <label class="admin-settings-field">
                        <span>Auth header name</span>
                        <input type="text" formControlName="authHeaderName" placeholder="Authorization" />
                      </label>

                      <label class="admin-settings-field">
                        <span>Auth header value</span>
                        <input
                          type="password"
                          formControlName="authHeaderValue"
                          autocomplete="off"
                          [placeholder]="hrIntegrationConfig()?.hasCredential ? 'API key configured — leave blank to keep it' : 'e.g. Bearer xyz123'" />
                      </label>

                      <button type="submit" class="admin-primary-btn" [disabled]="hrIntegrationForm.invalid || hrIntegrationSaving()">{{ hrIntegrationSaving() ? 'Saving…' : 'Save connection' }}</button>
                    </form>

                    <div class="admin-settings-item-controls admin-settings-item-controls-stack">
                      <button type="button" class="admin-secondary-btn" [disabled]="hrIntegrationSyncing() || !hrIntegrationConfig()?.enabled" (click)="syncHrRosterNow()">{{ hrIntegrationSyncing() ? 'Syncing…' : 'Sync now' }}</button>

                      @if (hrIntegrationSyncError()) {
                        <div class="admin-upload-feedback admin-upload-feedback-error" role="status" aria-live="polite">{{ hrIntegrationSyncError() }}</div>
                      }

                      @if (hrIntegrationConfig()?.lastSyncSummary; as summary) {
                        <div class="admin-upload-feedback" role="status" aria-live="polite">
                          Last synced {{ summary.syncedAt | date:'medium' }} — {{ summary.added }} added, {{ summary.updated }} updated, {{ summary.skipped }} skipped.
                        </div>

                        @if (summary.issues.length) {
                          <div class="admin-upload-issues" role="alert" aria-live="assertive">
                            <div class="admin-upload-issues-title">Sync issues</div>
                            <ul class="admin-upload-issues-list">
                              @for (issue of summary.issues; track issue) {
                                <li>{{ issue }}</li>
                              }
                            </ul>
                          </div>
                        }
                      }
                    </div>
                  </div>
                }

                @if (selectedSettingsSection() === 'approval-settings') {
                  <div class="admin-settings-section-detail">
                    <div class="admin-section-card-header">
                      <h2>Approval &amp; Reporting Settings</h2>
                      <span>{{ managerData.explicitTrainingManagers().length }} approving {{ managerData.explicitTrainingManagers().length === 1 ? 'manager' : 'managers' }}</span>
                    </div>

                    <p class="admin-settings-hint">
                      Set how many people must sign off on a KPI rating or an external training request before it's final. When more than one is required, the first approver picks who reviews it next from a dropdown, and so on until every required sign-off is collected — a rejection at any step sends it back to the first approver to revise and resubmit.
                    </p>

                    <div class="admin-report-actions">
                      <label class="admin-report-filter-field admin-report-download-field">
                        <span>KPI ratings require</span>
                        <select [value]="approvalWorkflowKpiApproversRequired()" (change)="approvalWorkflowKpiApproversRequired.set(+$any($event.target).value)">
                          @for (count of approverCountOptions; track count) {
                            <option [value]="count">{{ count }} {{ count === 1 ? 'approver' : 'approvers' }}</option>
                          }
                        </select>
                      </label>
                      <label class="admin-report-filter-field admin-report-download-field">
                        <span>Training requests require</span>
                        <select [value]="approvalWorkflowTrainingApproversRequired()" (change)="approvalWorkflowTrainingApproversRequired.set(+$any($event.target).value)">
                          @for (count of approverCountOptions; track count) {
                            <option [value]="count">{{ count }} {{ count === 1 ? 'approver' : 'approvers' }}</option>
                          }
                        </select>
                      </label>
                      <button type="button" class="admin-primary-btn" [disabled]="savingApprovalWorkflowSettings()" (click)="saveApprovalWorkflowSettings()">
                        {{ savingApprovalWorkflowSettings() ? 'Saving…' : 'Save' }}
                      </button>
                    </div>

                    @if (approvalWorkflowSettingsMessage(); as message) {
                      <div class="admin-upload-feedback" [class.admin-upload-feedback-error]="approvalWorkflowSettingsTone() === 'error'" role="status" aria-live="polite">
                        {{ message }}
                      </div>
                    }

                    <p class="admin-settings-hint">
                      Below is the list a student (or a chain's next approver) picks from. Any employee marked as a Manager under User Management is automatically available too, alongside anyone added here.
                    </p>

                    @if (!editingApprovingManagerId()) {
                      <div class="admin-bulk-upload-panel">
                        <div class="admin-bulk-upload-actions">
                          <label class="admin-settings-field admin-report-download-field admin-bulk-upload-template-field">
                            <span>Template format</span>
                            <select [value]="selectedManagerBulkUploadTemplateFormat()" (change)="selectedManagerBulkUploadTemplateFormat.set($any($event.target).value)">
                              <option value="CSV">Download CSV template</option>
                              <option value="XLSX">Download XLSX template</option>
                            </select>
                          </label>
                          <button type="button" class="admin-secondary-btn" (click)="downloadApprovingManagerUploadTemplate()">Download template</button>
                          <label class="admin-upload-btn">
                            <span>Upload approving managers file</span>
                            <input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" (change)="handleApprovingManagerBulkUpload($event)" />
                          </label>
                          <button type="button" class="admin-inline-btn" (click)="openNewApprovingManagerForm()">Add approving manager</button>
                          <span class="admin-chip">CSV or XLSX</span>
                        </div>
                      </div>

                      @if (managerBulkUploadMessage(); as message) {
                        <div class="admin-upload-feedback" [class.admin-upload-feedback-error]="managerBulkUploadTone() === 'error'" role="status" aria-live="polite">
                          {{ message }}
                        </div>
                      }

                      @if (managerBulkUploadIssues().length) {
                        <div class="admin-upload-issues" role="alert" aria-live="assertive">
                          <div class="admin-upload-issues-title">Upload issues</div>
                          <div class="admin-upload-issues-copy">Fix the rows below and upload the file again.</div>
                          <ul class="admin-upload-issues-list">
                            @for (issue of managerBulkUploadIssues(); track issue.lineNumber + issue.message) {
                              <li>Row {{ issue.lineNumber }}: {{ issue.message }}</li>
                            }
                          </ul>
                        </div>
                      }

                      @if (managerData.explicitTrainingManagers().length) {
                        <div class="admin-approver-grid">
                          @for (manager of managerData.explicitTrainingManagers(); track manager.id) {
                            <button type="button" class="admin-approver-row" (click)="openEditApprovingManagerForm(manager)">
                              <span class="admin-approver-avatar" aria-hidden="true">{{ approverInitials(manager.name) }}</span>
                              <span class="admin-approver-info">
                                <strong class="admin-approver-name">{{ manager.name }}</strong>
                                <span class="admin-approver-chip-row">
                                  <span class="admin-approver-chip">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" stroke="currentColor" stroke-width="1.8"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" stroke="currentColor" stroke-width="1.8"/></svg>
                                    {{ manager.role }}
                                  </span>
                                  <span class="admin-approver-chip">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 10v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    {{ manager.team }}
                                  </span>
                                </span>
                                <span class="admin-approver-email">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Z" stroke="currentColor" stroke-width="1.6"/><path d="m5 7 7 5.5L19 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                  {{ manager.email }}
                                </span>
                              </span>
                              <span class="admin-approver-chevron" aria-hidden="true">›</span>
                            </button>
                          }
                        </div>
                      } @else {
                        <div class="admin-empty-state">No approving managers have been added yet.</div>
                      }
                    } @else {
                      <button type="button" class="admin-inline-btn admin-settings-back-btn" (click)="closeApprovingManagerForm()">Back to approval settings</button>

                      <div class="admin-approver-form-header">
                        <span class="admin-approver-avatar admin-approver-avatar-lg" aria-hidden="true">{{ approverInitials(approvingManagerFormName()) }}</span>
                        <div>
                          <strong>{{ approvingManagerFormName() || 'New approving manager' }}</strong>
                          <span>{{ approvingManagerFormRole() || 'Their title will show here' }}</span>
                        </div>
                      </div>

                      <label class="admin-settings-field">
                        <span class="admin-approver-field-label">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                          Full name
                        </span>
                        <input type="text" [value]="approvingManagerFormName()" (input)="approvingManagerFormName.set($any($event.target).value)" placeholder="e.g. Jane Doe" />
                      </label>
                      <label class="admin-settings-field">
                        <span class="admin-approver-field-label">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" stroke="currentColor" stroke-width="1.8"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" stroke="currentColor" stroke-width="1.8"/></svg>
                          Title
                        </span>
                        <input type="text" [value]="approvingManagerFormRole()" (input)="approvingManagerFormRole.set($any($event.target).value)" placeholder="e.g. Training Manager" />
                      </label>
                      <label class="admin-settings-field">
                        <span class="admin-approver-field-label">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 10v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                          Team
                        </span>
                        <input type="text" [value]="approvingManagerFormTeam()" (input)="approvingManagerFormTeam.set($any($event.target).value)" placeholder="e.g. Learning & Development" />
                      </label>
                      <label class="admin-settings-field">
                        <span class="admin-approver-field-label">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Z" stroke="currentColor" stroke-width="1.8"/><path d="m5 7 7 5.5L19 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                          Email
                        </span>
                        <input type="email" [value]="approvingManagerFormEmail()" (input)="approvingManagerFormEmail.set($any($event.target).value)" placeholder="e.g. jane.doe@example.com" />
                      </label>

                      @if (approvingManagerFormNameConflict(); as conflict) {
                        <div class="admin-upload-feedback admin-upload-feedback-error" role="alert">
                          A User Management roster member also named "{{ conflict.name }} {{ conflict.surname }}" (role: Manager) already exists with a different email ({{ conflict.email }}). Students pick an approving manager by name only, so two entries with the same name but different emails can send a request to the wrong inbox. If this is the same person, use {{ conflict.email }} here instead.
                        </div>
                      }

                      @if (approvingManagerFormError()) {
                        <div class="admin-upload-feedback admin-upload-feedback-error" role="status" aria-live="polite">{{ approvingManagerFormError() }}</div>
                      }

                      <div class="admin-settings-item-controls">
                        <button type="button" class="admin-primary-btn" (click)="saveApprovingManagerForm()">Save</button>
                        @if (editingApprovingManagerId() !== 'new') {
                          <button type="button" class="admin-inline-btn admin-inline-btn-danger" (click)="deleteApprovingManagerFromForm()">Remove</button>
                        }
                      </div>
                    }
                  </div>
                }
              </section>
            </section>
          }

          @if (selectedPanel() === 'courses') {
            <section class="manager-panel">

              <div class="courses-panel-shell">
                <div class="courses-tab-nav" aria-label="Courses panel navigation">
                  <button type="button" class="courses-tab-btn" [class.courses-tab-btn-active]="selectedCoursesView() === 'create'" (click)="selectCoursesView('create')">
                    <span class="courses-tab-icon" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </span>
                    <span>Create Course</span>
                  </button>
                  <button type="button" class="courses-tab-btn" [class.courses-tab-btn-active]="selectedCoursesView() === 'created'" (click)="selectCoursesView('created')">
                    <span class="courses-tab-icon" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 6.75h10M7 12h10M7 17.25h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="4.5" cy="6.75" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="17.25" r="1" fill="currentColor"/></svg>
                    </span>
                    <span>My Created Courses</span>
                  </button>
                  <button type="button" class="courses-tab-btn" [class.courses-tab-btn-active]="selectedCoursesView() === 'submissions'" (click)="selectCoursesView('submissions')">
                    <span class="courses-tab-icon" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 6.75h10M7 12h10M7 17.25h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m17 16.5 1.75 1.75L22 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="4.5" cy="6.75" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="17.25" r="1" fill="currentColor"/></svg>
                    </span>
                    <span>Assignment Submissions</span>
                  </button>
                </div>

                @if (selectedCoursesView() === 'create') {
                  <section class="course-form-card course-studio-card">
                    <form class="course-form course-studio-form" [formGroup]="courseForm" (ngSubmit)="submitCourseForm()">
                      <aside class="course-studio-sidebar">
                        <div class="course-studio-topbar">
                          <button type="button" class="course-studio-icon-btn" aria-label="Back to created courses" (click)="selectCoursesView('created')">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                          </button>
                          <button type="submit" class="course-studio-publish-btn" [disabled]="courseForm.invalid">{{ editingCourseId() ? 'Save' : 'Publish' }}</button>
                        </div>

                        <div class="course-studio-sidebar-copy">
                          <strong>{{ courseForm.controls.title.value || 'New course' }}</strong>
                        </div>

                        <div class="course-studio-quick-actions">
                          <button type="button" class="course-studio-add-btn" (click)="toggleAddItemMenu()">
                            <span aria-hidden="true">+</span>
                            <span>Add</span>
                          </button>
                          <button type="button" class="course-studio-mini-btn" [class.course-studio-mini-btn-active]="selectedCreateSection() === 'basics'" aria-label="Open course details" (click)="openCreateSection('basics'); closeContentItemDetails()">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 7h12M6 12h12M6 17h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                          </button>
                          <button type="button" class="course-studio-mini-btn" [class.course-studio-mini-btn-active]="selectedCreateSection() === 'content'" aria-label="Open course units" (click)="openCreateSection('content')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="7" cy="6" r="1.25" fill="currentColor"/><circle cx="7" cy="12" r="1.25" fill="currentColor"/><circle cx="7" cy="18" r="1.25" fill="currentColor"/></svg>
                          </button>
                          <button type="button" class="course-studio-mini-btn" aria-label="Return to created courses" (click)="selectCoursesView('created')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                          </button>
                        </div>

                        @if (isAddItemMenuOpen()) {
                          <div class="content-add-menu course-studio-add-menu" role="menu" aria-label="Add item types">
                            @for (contentKind of contentKindOptions; track contentKind) {
                              <button type="button" class="content-add-menu-item" (click)="addContentItemFromMenu(contentKind)">
                                {{ contentKind }}
                              </button>
                            }
                          </div>
                        }

                        <div class="course-studio-unit-list">
                          <button type="button" class="course-studio-unit" [class.course-studio-unit-active]="selectedCreateSection() === 'basics' && expandedContentIndex() === null" (click)="openCreateSection('basics'); closeContentItemDetails()">
                            <span class="course-studio-unit-icon" aria-hidden="true">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 7h12M6 12h12M6 17h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                            </span>
                            <span class="course-studio-unit-copy">
                              <strong>Course details</strong>
                              <span>{{ createSectionStatus('basics') }}</span>
                            </span>
                          </button>

                          @for (item of contentItemsArray.controls; track $index; let itemIndex = $index) {
                              <button
                                type="button"
                                class="course-studio-unit"
                                draggable="true"
                                [class.course-studio-unit-active]="selectedCreateSection() === 'content' && expandedContentIndex() === itemIndex"
                                [class.course-studio-unit-dragging]="draggedContentIndex() === itemIndex"
                                [attr.aria-label]="'Drag to reorder or open ' + courseStudioItemTitle(itemIndex)"
                                (click)="openCreateSection('content'); openContentItemDetails(itemIndex)"
                                (dragstart)="onContentDragStart(itemIndex)"
                                (dragover)="onContentDragOver($event)"
                                (drop)="onContentDrop(itemIndex)"
                                (dragend)="onContentDragEnd()">
                              <span class="course-studio-unit-icon" aria-hidden="true">
                                @switch (item.controls.kind.value) {
                                  @case ('Video') {
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8 7.5v9l7-4.5-7-4.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><rect x="4.5" y="4.5" width="15" height="15" rx="3" stroke="currentColor" stroke-width="1.8"/></svg>
                                  }
                                  @case ('Document') {
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8 4.75h6.5l3.75 3.75V19A1.75 1.75 0 0 1 16.5 20.75h-8A1.75 1.75 0 0 1 6.75 19V6.5A1.75 1.75 0 0 1 8.5 4.75Z" stroke="currentColor" stroke-width="1.8"/><path d="M14.5 4.75V8.5h3.75" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
                                  }
                                  @case ('Assessment') {
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8 7h8M8 12h8M8 17h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="4.5" y="4.5" width="15" height="15" rx="3" stroke="currentColor" stroke-width="1.8"/></svg>
                                  }
                                }
                              </span>
                              <span class="course-studio-unit-copy">
                                <strong>{{ courseStudioItemTitle(itemIndex) }}</strong>
                                <span>{{ contentItemSummary(itemIndex) }}</span>
                              </span>
                              <span class="course-studio-unit-drag-handle" aria-hidden="true">::</span>
                            </button>
                          }

                          @if (contentItemsArray.length > 1) {
                            <div
                              class="course-studio-end-dropzone"
                              [class.course-studio-end-dropzone-active]="draggedContentIndex() !== null"
                              (dragover)="onContentDragOver($event)"
                              (drop)="onContentDrop(contentItemsArray.length)">
                              Drag a unit here to move it to the end
                            </div>
                          }

                        </div>
                      </aside>

                      <div class="course-studio-workspace">
                        <div class="course-studio-workspace-header">
                          <div>
                            <h2>{{ courseStudioWorkspaceTitle() }}</h2>
                          </div>

                          @if (selectedCreateSection() === 'content' && selectedContentItem()) {
                            <button type="button" class="builder-secondary-btn" (click)="removeContentItem(activeContentItemIndex())">Remove unit</button>
                          }
                        </div>

                        @if (selectedCreateSection() === 'basics') {
                          <section class="form-section-card course-studio-panel" aria-labelledby="course-studio-basics-title">
                            <div class="form-section-header">
                              <div>
                                <p class="form-section-eyebrow">New course</p>
                                <h3 id="course-studio-basics-title">Course settings</h3>
                              </div>
                              <span class="create-section-status-pill">{{ createSectionStatus('basics') }}</span>
                            </div>

                            <div class="form-grid form-grid-two">
                              <label title="Enter the course or programme name learners will see.">
                                <span class="required-label">Course Title <span class="required-marker" aria-hidden="true">*</span></span>
                                <input formControlName="title" type="text" placeholder="Enter course or programme title" />
                                @if (courseForm.controls.title.touched && courseForm.controls.title.invalid) {
                                  <span class="field-error">Add a title before creating the item.</span>
                                }
                              </label>

                              <label title="Choose when learners should complete this item.">
                                <span>Completion Deadline</span>
                                <input formControlName="completionDeadline" type="date" />
                              </label>

                              <label>
                                <span class="required-label">Type <span class="required-marker" aria-hidden="true">*</span></span>
                                <select formControlName="type">
                                  <option value="Course">Course</option>
                                  <option value="Programme">Programme</option>
                                </select>
                              </label>

                              <label title="Use a category to group related learning items.">
                                <span class="required-label">Category <span class="required-marker" aria-hidden="true">*</span></span>
                                <input formControlName="category" type="text" placeholder="Examples: Onboarding, Compliance, Leadership" />
                                @if (courseForm.controls.category.touched && courseForm.controls.category.invalid) {
                                  <span class="field-error">Add a category to organise the item.</span>
                                }
                              </label>

                              <label class="upload-field form-grid-span-two" title="Upload a cover image for the course card.">
                                Course Thumbnail
                                <input type="file" accept="image/*" [disabled]="thumbnailUploading()" (change)="onThumbnailSelected($event)" />
                                @if (thumbnailFileName()) {
                                  <span class="asset-preview-copy">Selected thumbnail: {{ thumbnailFileName() }}</span>
                                }
                              </label>

                              @if (thumbnailPreview()) {
                                <div class="course-studio-thumbnail-preview form-grid-span-two">
                                  <img [src]="thumbnailPreview()!" alt="Selected course thumbnail preview" />
                                </div>
                              }

                              <label class="form-grid-span-two" title="Add a compact summary learners will see before starting the item.">
                                <span class="required-label">Course Description <span class="required-marker" aria-hidden="true">*</span></span>
                                <textarea formControlName="description" rows="5" placeholder="Add a short summary of what learners will cover."></textarea>
                                @if (courseForm.controls.description.touched && courseForm.controls.description.invalid) {
                                  <span class="field-error">Add a longer description so learners know what to expect.</span>
                                }
                              </label>
                            </div>
                          </section>
                        } @else if (selectedContentItem(); as activeItem) {
                          <section class="form-section-card course-studio-panel course-item-detail-card" [formGroup]="activeItem" aria-labelledby="course-item-detail-title">
                            <div class="form-section-header course-item-detail-header">
                              <div>
                                <p class="form-section-eyebrow">{{ activeItem.controls.kind.value }} unit</p>
                                <h3 id="course-item-detail-title">{{ courseStudioWorkspaceTitle() }}</h3>
                              </div>
                              <span class="create-section-status-pill">{{ contentItemResourceState(activeContentItemIndex()) }}</span>
                            </div>

                            @if (activeItem.controls.kind.value === 'Assessment') {
                              <div class="form-grid form-grid-two">
                                <div title="The item type is chosen when you add the step.">
                                  <span class="required-label">Item Type</span>
                                  <div class="content-item-type-display">{{ activeItem.controls.kind.value }}</div>
                                </div>

                                <label title="Give this content step a short descriptive name.">
                                  <span class="required-label">Assessment Title <span class="required-marker" aria-hidden="true">*</span></span>
                                  <input formControlName="title" type="text" [attr.data-content-item-title]="activeContentItemIndex()" placeholder="Example: Knowledge Check" />
                                </label>

                                <label title="Choose how this assessment should be evaluated.">
                                  Assessment Type
                                  <select formControlName="assessmentType" (change)="onAssessmentTypeChanged(activeContentItemIndex(), $any($event.target).value)">
                                    @for (assessmentType of assessmentTypeOptions; track assessmentType) {
                                      <option [value]="assessmentType">{{ assessmentType }}</option>
                                    }
                                  </select>
                                </label>

                                <label title="Set the minimum percentage learners must achieve to pass this assessment.">
                                  <span class="required-label">Pass Mark (%) <span class="required-marker" aria-hidden="true">*</span></span>
                                  <input formControlName="passMarkPercentage" type="number" min="1" max="100" />
                                </label>

                                <label title="Set how many times a learner can submit or retry this assessment.">
                                  <span class="required-label">Attempts Allowed <span class="required-marker" aria-hidden="true">*</span></span>
                                  <input formControlName="maxAttempts" type="number" min="1" step="1" />
                                </label>
                              </div>

                              <div class="assessment-question-builder">
                                <div class="assessment-question-header">
                                  <div>
                                    <p class="form-section-eyebrow">{{ assessmentCollectionLabel(activeContentItemIndex()) }}</p>
                                    <h4>{{ assessmentBuilderHeading(activeContentItemIndex()) }}</h4>
                                  </div>
                                  <button type="button" class="assessment-add-btn" (click)="addAssessmentQuestion(activeContentItemIndex())">{{ assessmentAddButtonLabel(activeContentItemIndex()) }}</button>
                                </div>

                                @if (assessmentStatusMessage(activeContentItemIndex()); as assessmentStatus) {
                                  <div class="assessment-status-banner" [class.assessment-status-banner-success]="assessmentStatus.tone === 'success'" role="status" aria-live="polite">
                                    {{ assessmentStatus.message }}
                                  </div>
                                }

                                <div class="assessment-question-list" formArrayName="questions">
                                  @if (!assessmentQuestionsAt(activeContentItemIndex()).length) {
                                    <div class="assessment-status-banner" role="status" aria-live="polite">
                                      No {{ assessmentEntryLabel(activeContentItemIndex(), 2) }} added yet. Use {{ assessmentAddButtonLabel(activeContentItemIndex()).toLowerCase() }} to create the first one.
                                    </div>
                                  }

                                  @for (question of assessmentQuestionsAt(activeContentItemIndex()).controls; track $index; let questionIndex = $index) {
                                    <div class="assessment-question-card" [formGroupName]="questionIndex">
                                      <div class="assessment-question-topbar">
                                        <div class="assessment-question-summary">
                                          <strong>{{ question.controls.prompt.value || 'Untitled question' }}</strong>
                                          <span>{{ question.controls.questionType.value }} • {{ question.controls.points.value }} pts</span>
                                        </div>
                                        <div class="assessment-question-actions">
                                          <button type="button" class="content-item-toggle-btn" (click)="toggleAssessmentQuestion(activeContentItemIndex(), questionIndex)">
                                            {{ isAssessmentQuestionExpanded(activeContentItemIndex(), questionIndex) ? 'Collapse' : 'Expand' }}
                                          </button>
                                          <button type="button" class="assessment-remove-btn" (click)="removeAssessmentQuestion(activeContentItemIndex(), questionIndex)">Remove question</button>
                                        </div>
                                      </div>

                                      @if (isAssessmentQuestionExpanded(activeContentItemIndex(), questionIndex)) {
                                        <div class="assessment-question-grid">
                                          <label class="form-grid-span-two" title="Enter the learner question or task instruction.">
                                            <span class="required-label">{{ assessmentPromptLabel(activeContentItemIndex()) }} <span class="required-marker" aria-hidden="true">*</span></span>
                                            <textarea formControlName="prompt" rows="3" [placeholder]="assessmentPromptPlaceholder(activeContentItemIndex())"></textarea>
                                          </label>

                                          <label>
                                            <span class="required-label">{{ assessmentQuestionTypeLabel(activeContentItemIndex()) }} <span class="required-marker" aria-hidden="true">*</span></span>
                                            <select formControlName="questionType" [disabled]="assessmentQuestionTypeOptionsForItem(activeContentItemIndex()).length === 1" (change)="onAssessmentQuestionTypeChanged(activeContentItemIndex(), questionIndex, $any($event.target).value)">
                                              @for (questionType of assessmentQuestionTypeOptionsForItem(activeContentItemIndex()); track questionType) {
                                                <option [value]="questionType">{{ questionType }}</option>
                                              }
                                            </select>
                                          </label>

                                          <label>
                                            <span class="required-label">{{ assessmentPointsLabel(activeContentItemIndex()) }} <span class="required-marker" aria-hidden="true">*</span></span>
                                            <input formControlName="points" type="number" min="1" (input)="onAssessmentQuestionPointsChanged(activeContentItemIndex(), questionIndex)" />
                                          </label>

                                          @if (supportsAssessmentAttachment(activeContentItemIndex())) {
                                            <label class="upload-field form-grid-span-two" [title]="assessmentAttachmentTitle(activeContentItemIndex())">
                                              {{ assessmentAttachmentLabel(activeContentItemIndex()) }}
                                              <input accept=".pdf,.doc,.docx,.ppt,.pptx,.xlsx,.txt" type="file" (change)="onAssessmentQuestionFileSelected(activeContentItemIndex(), questionIndex, $event)" />
                                              @if (question.controls.attachmentFileName.value) {
                                                <span class="asset-preview-copy">Selected document: {{ question.controls.attachmentFileName.value }}</span>
                                                <button type="button" class="detail-action-btn detail-action-btn-subtle" (click)="removeAssessmentQuestionFile(activeContentItemIndex(), questionIndex); $event.preventDefault()">Remove document</button>
                                              } @else {
                                                <span class="asset-preview-copy">{{ assessmentAttachmentHint(activeContentItemIndex()) }}</span>
                                              }
                                            </label>
                                          }

                                          @if (isMultipleChoiceQuestion(activeContentItemIndex(), questionIndex)) {
                                            <div class="assessment-choice-builder form-grid-span-two">
                                              <div class="assessment-choice-header">
                                                <div>
                                                  <p class="form-section-eyebrow">Answer Options</p>
                                                </div>
                                                <button type="button" class="assessment-add-btn assessment-choice-add-btn" (click)="addAssessmentChoice(activeContentItemIndex(), questionIndex)">Add option</button>
                                              </div>

                                              <div class="assessment-choice-list" formArrayName="choices">
                                                @for (choice of assessmentChoicesAt(activeContentItemIndex(), questionIndex).controls; track $index; let choiceIndex = $index) {
                                                  <div class="assessment-choice-row" [formGroupName]="choiceIndex">
                                                    <label class="assessment-choice-text">
                                                      <span class="required-label">Option {{ choiceIndex + 1 }} <span class="required-marker" aria-hidden="true">*</span></span>
                                                      <input formControlName="text" type="text" [placeholder]="'Option ' + (choiceIndex + 1)" />
                                                    </label>

                                                    <label class="assessment-choice-points">
                                                      <span class="required-label">Choice Points</span>
                                                      <input formControlName="points" type="number" min="0" />
                                                    </label>

                                                    <label class="assessment-choice-correct" [class.assessment-choice-correct-active]="choice.controls.isCorrect.value">
                                                      <input formControlName="isCorrect" type="checkbox" />
                                                      <span>Correct</span>
                                                    </label>

                                                    <button type="button" class="assessment-remove-btn assessment-choice-remove-btn" [disabled]="assessmentChoicesAt(activeContentItemIndex(), questionIndex).length === 2" (click)="removeAssessmentChoice(activeContentItemIndex(), questionIndex, choiceIndex)">Remove option</button>
                                                  </div>
                                                }
                                              </div>

                                              @if (question.errors && (question.touched || courseForm.touched)) {
                                                @if (question.errors['multipleChoiceMinOptions']) {
                                                  <span class="field-error">Add at least two answer options for a multiple-choice question.</span>
                                                }
                                                @if (question.errors['multipleChoiceCorrectAnswerRequired']) {
                                                  <span class="field-error">Select at least one correct answer so the question can be graded.</span>
                                                }
                                              }
                                            </div>
                                          }

                                          @if (isTrueFalseQuestion(activeContentItemIndex(), questionIndex)) {
                                            <div class="assessment-choice-builder form-grid-span-two">
                                              <div class="assessment-choice-header">
                                                <div>
                                                  <p class="form-section-eyebrow">True Or False</p>
                                                </div>
                                              </div>

                                              <div class="assessment-binary-list">
                                                @for (choice of assessmentChoicesAt(activeContentItemIndex(), questionIndex).controls; track $index; let choiceIndex = $index) {
                                                  <div class="assessment-binary-row" [class.assessment-binary-row-active]="choice.controls.isCorrect.value">
                                                    <div class="assessment-binary-copy">
                                                      <strong>{{ choice.controls.text.value }}</strong>
                                                      <span>{{ choice.controls.isCorrect.value ? 'Marked as the correct answer.' : 'Available learner option.' }}</span>
                                                    </div>
                                                    <button type="button" class="detail-action-btn" [class.detail-action-btn-primary]="choice.controls.isCorrect.value" (click)="setTrueFalseCorrectAnswer(activeContentItemIndex(), questionIndex, choiceIndex)">
                                                      {{ choice.controls.isCorrect.value ? 'Correct answer' : 'Mark correct' }}
                                                    </button>
                                                  </div>
                                                }
                                              </div>
                                            </div>
                                          }

                                          @if (isMatchingQuestion(activeContentItemIndex(), questionIndex)) {
                                            <div class="assessment-choice-builder form-grid-span-two">
                                              <div class="assessment-choice-header">
                                                <div>
                                                  <p class="form-section-eyebrow">Matching Pairs</p>
                                                </div>
                                                <button type="button" class="assessment-add-btn assessment-choice-add-btn" (click)="addMatchingPair(activeContentItemIndex(), questionIndex)">Add pair</button>
                                              </div>

                                              <label class="assessment-drag-toggle" [class.assessment-drag-toggle-active]="question.controls.dragAndDropEnabled.value">
                                                <input formControlName="dragAndDropEnabled" type="checkbox" />
                                                <span>Enable drag-and-drop matching for learners</span>
                                              </label>

                                              <div class="assessment-matching-list" formArrayName="matchingPairs">
                                                @for (pair of matchingPairsAt(activeContentItemIndex(), questionIndex).controls; track $index; let pairIndex = $index) {
                                                  <div class="assessment-matching-row" [formGroupName]="pairIndex">
                                                    <label>
                                                      <span class="required-label">Prompt {{ pairIndex + 1 }} <span class="required-marker" aria-hidden="true">*</span></span>
                                                      <input formControlName="prompt" type="text" [placeholder]="'Prompt ' + (pairIndex + 1)" />
                                                    </label>
                                                    <label>
                                                      <span class="required-label">Match {{ pairIndex + 1 }} <span class="required-marker" aria-hidden="true">*</span></span>
                                                      <input formControlName="answer" type="text" [placeholder]="'Match ' + (pairIndex + 1)" />
                                                    </label>
                                                    <button type="button" class="assessment-remove-btn assessment-choice-remove-btn" [disabled]="matchingPairsAt(activeContentItemIndex(), questionIndex).length === 2" (click)="removeMatchingPair(activeContentItemIndex(), questionIndex, pairIndex)">Remove pair</button>
                                                  </div>
                                                }
                                              </div>

                                              @if (question.errors && (question.touched || courseForm.touched) && question.errors['matchingMinPairs']) {
                                                <span class="field-error">Add at least two matching pairs for a drag-and-drop matching question.</span>
                                              }
                                            </div>
                                          }
                                        </div>
                                      }
                                    </div>
                                  }
                                </div>

                                <div class="assessment-submit-row">
                                  <div class="assessment-submit-copy">
                                    <strong>Submit this assessment setup</strong>
                                  </div>
                                  <button type="button" class="detail-action-btn detail-action-btn-primary" (click)="submitAssessmentSetup(activeContentItemIndex())">Submit assessment</button>
                                </div>
                              </div>
                            } @else {
                              <div class="form-grid form-grid-two">
                                <div title="The item type is chosen when you add the step.">
                                  <span class="required-label">Item Type</span>
                                  <div class="content-item-type-display">{{ activeItem.controls.kind.value }}</div>
                                </div>

                                <label title="Give this content step a short descriptive name.">
                                  <span class="required-label">{{ activeItem.controls.kind.value }} Title <span class="required-marker" aria-hidden="true">*</span></span>
                                  <input formControlName="title" type="text" [attr.data-content-item-title]="activeContentItemIndex()" [placeholder]="'Example: ' + activeItem.controls.kind.value + ' unit'" />
                                </label>
                              </div>

                              <div class="course-studio-upload-grid">
                                <label class="course-studio-upload-card" [title]="'Upload the ' + activeItem.controls.kind.value.toLowerCase() + ' file'">
                                  <span class="course-studio-upload-icon" aria-hidden="true">
                                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none"><path d="M12 16V6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8.5 9.5 12 6l3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 16.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                                  </span>
                                  <strong>Upload a file</strong>
                                  <span class="course-studio-upload-caption">{{ activeItem.controls.uploadedFileName.value || 'or drag-and-drop here' }}</span>
                                  @if (contentUploadProgresses()[activeContentItemIndex()] !== null && contentUploadProgresses()[activeContentItemIndex()] !== undefined) {
                                    @if (contentUploadProgresses()[activeContentItemIndex()] === -1) {
                                      <span class="course-studio-upload-progress-label">Converting to PDF…</span>
                                    } @else {
                                      <span class="course-studio-upload-progress-bar" aria-hidden="true">
                                        <span class="course-studio-upload-progress-fill" [style.width.%]="contentUploadProgresses()[activeContentItemIndex()]"></span>
                                      </span>
                                      <span class="course-studio-upload-progress-label">{{ contentUploadProgresses()[activeContentItemIndex()] }}%</span>
                                    }
                                  }
                                  <input class="course-studio-upload-input" [accept]="contentUploadAccept(activeItem.controls.kind.value)" type="file" (change)="onContentFileSelected(activeContentItemIndex(), $event)" />
                                </label>

                                <label class="course-studio-upload-card course-studio-upload-card-link" title="Paste a hosted link if this item lives online.">
                                  <span class="course-studio-upload-icon" aria-hidden="true">
                                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none"><path d="M10 13a4 4 0 0 0 5.66 0l2.12-2.12a4 4 0 1 0-5.66-5.66L10.9 6.44" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 11a4 4 0 0 0-5.66 0l-2.12 2.12a4 4 0 1 0 5.66 5.66l1.22-1.22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                  </span>
                                  <strong>Use a link</strong>
                                  <input formControlName="resourceLink" type="url" placeholder="Paste a hosted link for this item" />
                                </label>
                              </div>

                              @if (presentationPreviewState(activeItem); as presentationPreview) {
                                <section class="form-section-card course-studio-presentation-panel">
                                  <div class="form-section-header">
                                    <div>
                                      <p class="form-section-eyebrow">PowerPoint file</p>
                                      <h3>{{ presentationPreview.fileName }}</h3>
                                    </div>
                                    @if (activeItem.controls.convertedPdfUrl.value) {
                                      <span class="create-section-status-pill">PDF ready for students</span>
                                    } @else {
                                      <span class="create-section-status-pill">Open in app</span>
                                    }
                                  </div>

                                  <powerpoint-window
                                    [viewerTitle]="'PowerPoint file for ' + presentationPreview.fileName"
                                    [sourceDataUrl]="activeItem.controls.uploadedFileDataUrl.value || null"
                                    [sourceFileName]="presentationPreview.fileName"
                                    [emptyMessage]="presentationPreview.message"></powerpoint-window>
                                </section>
                              }

                              @if (activeItem.controls.kind.value === 'Document') {
                                <div class="doc-toggle-row form-grid-span-two">
                                  <label class="doc-toggle" [class.doc-toggle-active]="activeItem.controls.requiresAcknowledgement.value" title="Learners must open this document in the LMS and confirm they've read it.">
                                    <input formControlName="requiresAcknowledgement" type="checkbox" class="doc-toggle-input" />
                                    <span class="doc-toggle-track" aria-hidden="true"><span class="doc-toggle-thumb"></span></span>
                                    <span class="doc-toggle-label">Requires acknowledgement</span>
                                  </label>
                                  <label class="doc-toggle" [class.doc-toggle-active]="activeItem.controls.allowDownload.value" title="Learners can download this document or open it in a new tab.">
                                    <input formControlName="allowDownload" type="checkbox" class="doc-toggle-input" />
                                    <span class="doc-toggle-track" aria-hidden="true"><span class="doc-toggle-thumb"></span></span>
                                    <span class="doc-toggle-label">Allow download</span>
                                  </label>
                                </div>
                              }
                            }
                          </section>
                        } @else {
                          <section class="form-section-card course-studio-empty-panel">
                            <div class="form-section-header">
                              <div>
                                <p class="form-section-eyebrow">Add content</p>
                                <h3>Choose the first unit to add</h3>
                              </div>
                              <span class="create-section-status-pill">{{ createSectionStatus('content') }}</span>
                            </div>

                            <div class="course-studio-empty-grid">
                              <button type="button" class="course-studio-empty-card" (click)="addContentItemFromMenu('Video')">
                                <span class="course-studio-upload-icon" aria-hidden="true">
                                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none"><path d="M8 7.5v9l7-4.5-7-4.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><rect x="4.5" y="4.5" width="15" height="15" rx="3" stroke="currentColor" stroke-width="1.8"/></svg>
                                </span>
                                <strong>Add a video unit</strong>
                                <span>Upload a video file or connect a hosted link.</span>
                              </button>
                              <button type="button" class="course-studio-empty-card" (click)="addContentItemFromMenu('Document')">
                                <span class="course-studio-upload-icon" aria-hidden="true">
                                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none"><path d="M8 4.75h6.5l3.75 3.75V19A1.75 1.75 0 0 1 16.5 20.75h-8A1.75 1.75 0 0 1 6.75 19V6.5A1.75 1.75 0 0 1 8.5 4.75Z" stroke="currentColor" stroke-width="1.8"/><path d="M14.5 4.75V8.5h3.75" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
                                </span>
                                <strong>Add a document unit</strong>
                                <span>Attach a learner document and decide if acknowledgement is required.</span>
                              </button>
                              <button type="button" class="course-studio-empty-card" (click)="addContentItemFromMenu('Scorm')">
                                <span class="course-studio-upload-icon" aria-hidden="true">
                                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none"><path d="M7.5 4.75h9A1.75 1.75 0 0 1 18.25 6.5v11A1.75 1.75 0 0 1 16.5 19.25h-9A1.75 1.75 0 0 1 5.75 17.5v-11A1.75 1.75 0 0 1 7.5 4.75Z" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 9.5h7M8.5 12h7M8.5 14.5h4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                                </span>
                                <strong>Add a SCORM unit</strong>
                                <span>Upload a SCORM package (.zip) or provide a hosted launch link.</span>
                              </button>
                              <button type="button" class="course-studio-empty-card" (click)="addContentItemFromMenu('Assessment')">
                                <span class="course-studio-upload-icon" aria-hidden="true">
                                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none"><path d="M8 7h8M8 12h8M8 17h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="4.5" y="4.5" width="15" height="15" rx="3" stroke="currentColor" stroke-width="1.8"/></svg>
                                </span>
                                <strong>Add an assessment unit</strong>
                                <span>Build a quiz, assignment, mentorship prompt, or acknowledgement flow.</span>
                              </button>
                            </div>
                          </section>
                        }

                        <div class="course-studio-footer">
                          <span class="form-action-copy">{{ courseForm.invalid ? 'Complete the required fields to publish.' : (editingCourseId() ? 'Save your changes.' : 'Ready to publish.') }}</span>
                          <div class="builder-step-actions">
                            <button type="button" class="builder-secondary-btn" [disabled]="!hasPreviousCreateSection()" (click)="goToPreviousCreateSection()">Previous</button>
                            <button type="button" class="builder-secondary-btn" [disabled]="!hasNextCreateSection()" (click)="goToNextCreateSection()">Next</button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </section>
                }

                @if (selectedCoursesView() === 'created') {
                  <section class="course-list-card">
                    <div class="section-heading-row">
                      <h2>Published Items</h2>
                      <span>{{ managerData.offerings().length }} total</span>
                    </div>

                    <div class="offering-list">
                      @if (!managerData.offerings().length) {
                        <p class="section-copy">No created courses yet. Publish a course or programme and it will appear here.</p>
                      }

                      @for (offering of managerData.offerings(); track offering.id) {
                        <published-offering-card
                          [offering]="offering"
                          [selected]="selectedPublishedOfferingId() === offering.id"
                          [assignedCount]="offeringEnrollmentCount(offering.id)"
                          (open)="openPublishedOffering(offering)" />
                      }
                    </div>
                  </section>
                }

                @if (selectedCoursesView() === 'submissions') {
                  <section class="activity-card mentorship-review-card">
                    <div class="section-heading-row mentorship-review-heading-row">
                      <div>
                        <h2>Assignment Submissions</h2>
                        <span>Review learner submissions in one workspace instead of opening each course overlay.</span>
                      </div>
                      <span class="student-search-count">{{ filteredAssignmentSubmissions().length }} shown</span>
                    </div>

                    <div class="student-search-row">
                      <label class="student-search-field">
                        <span class="student-search-label">Search submissions</span>
                        <input
                          type="search"
                          [value]="assignmentSubmissionSearchTerm()"
                          (input)="updateAssignmentSubmissionSearch($any($event.target).value)"
                          placeholder="Search by learner, course, email, type, or status" />
                      </label>

                      <div class="student-chip-row" aria-label="Assignment review status filters">
                        @for (status of assignmentSubmissionFilterOptions; track status) {
                          <button
                            type="button"
                            class="mentorship-panel-nav-btn"
                            [class.mentorship-panel-nav-btn-active]="assignmentSubmissionStatusFilter() === status"
                            (click)="setAssignmentSubmissionStatusFilter(status)">
                            {{ status }}
                          </button>
                        }
                      </div>
                    </div>

                    @if (filteredAssignmentSubmissions().length) {
                      <div class="mentorship-review-layout">
                        <div class="mentorship-review-list" role="list" aria-label="Assignment submissions list">
                          @for (submission of filteredAssignmentSubmissions(); track submission.id) {
                            <button
                              type="button"
                              class="mentorship-review-list-item"
                              [class.mentorship-review-list-item-active]="selectedAssignmentSubmission()?.id === submission.id"
                              (click)="openAssignmentSubmission(submission.id)">
                              <strong>{{ submission.studentName }}</strong>
                              <small>{{ submission.offeringTitle }}</small>
                              <small>{{ submission.questionType }} • Submitted {{ submission.submittedAt }}</small>
                              <div class="mentorship-review-chip-row">
                                @if (submission.awardedPoints !== null) {
                                  <span class="mentorship-review-score-chip">{{ formatAssignmentMark(submission) }}</span>
                                }
                                <span class="mentorship-review-status-pill" [class.mentorship-review-status-pill-approved]="submission.status === 'Approved'" [class.mentorship-review-status-pill-revision]="submission.status === 'Needs Revision'">
                                  {{ submission.status }}
                                </span>
                              </div>
                            </button>
                          }
                        </div>

                        @if (selectedAssignmentSubmission(); as activeSubmission) {
                          <div class="mentorship-review-detail-card">
                            <div class="mentorship-review-detail-header">
                              <div>
                                <h3>{{ activeSubmission.studentName }}</h3>
                                <span>{{ activeSubmission.offeringTitle }} • {{ activeSubmission.assessmentTitle }}</span>
                              </div>
                              <span class="mentorship-review-status-pill" [class.mentorship-review-status-pill-approved]="activeSubmission.status === 'Approved'" [class.mentorship-review-status-pill-revision]="activeSubmission.status === 'Needs Revision'">
                                {{ activeSubmission.status }}
                              </span>
                            </div>

                            <div class="mentorship-review-meta-grid">
                              <div>
                                <strong>Learner email</strong>
                                <span>{{ activeSubmission.studentEmail }}</span>
                              </div>
                              <div>
                                <strong>Submission type</strong>
                                <span>{{ activeSubmission.questionType }}</span>
                              </div>
                              <div>
                                <strong>Mark</strong>
                                <span>{{ formatAssignmentMark(activeSubmission) }}</span>
                              </div>
                              <div>
                                <strong>Submitted</strong>
                                <span>{{ activeSubmission.submittedAt }}</span>
                              </div>
                              <div>
                                <strong>Reviewed</strong>
                                <span>{{ activeSubmission.reviewedAt || 'Not reviewed yet' }}</span>
                              </div>
                            </div>

                            @if (activeSubmission.responseText) {
                              <div class="mentorship-review-action-plan">
                                <strong>Submitted response</strong>
                                <p>{{ activeSubmission.responseText }}</p>
                              </div>
                            }

                            @if (activeSubmission.documentFileName) {
                              <div class="mentorship-review-history">
                                <strong>Submitted document</strong>
                                <span>{{ activeSubmission.documentFileName }}</span>
                                <div class="mentorship-review-actions">
                                  <button type="button" class="detail-action-btn" (click)="downloadSupportingDocument(activeSubmission.documentDataUrl, activeSubmission.documentFileName)">Download assignment</button>
                                </div>
                              </div>
                            }

                            @if (activeSubmission.reviewerFeedback) {
                              <div class="mentorship-review-history">
                                <strong>{{ activeSubmission.reviewerName || 'Manager' }} feedback</strong>
                                <p>{{ activeSubmission.reviewerFeedback }}</p>
                              </div>
                            }

                            <form class="mentorship-review-form" [formGroup]="assignmentWorkspaceReviewForm" (ngSubmit)="applyAssignmentWorkspaceReview('Approved')">
                              <label>
                                Mark awarded
                                <input formControlName="awardedPoints" type="number" min="0" [max]="activeSubmission.possiblePoints" step="1" placeholder="Out of {{ activeSubmission.possiblePoints }}" />
                              </label>
                              <label>
                                Feedback for learner
                                <textarea formControlName="feedback" rows="5" placeholder="Add review feedback or revision guidance"></textarea>
                              </label>

                              @if (assignmentWorkspaceReviewError()) {
                                <span class="field-error">{{ assignmentWorkspaceReviewError() }}</span>
                              }

                              <div class="mentorship-review-actions">
                                <button type="button" class="detail-action-btn" (click)="applyAssignmentWorkspaceReview('Needs Revision')">Request revision</button>
                                <button type="submit" class="detail-action-btn detail-action-btn-primary">Approve submission</button>
                              </div>
                            </form>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="mentorship-review-empty-state mentorship-review-empty-state-detail">No assignment submissions match the current search and filter.</div>
                    }
                  </section>
                }
              </div>
            </section>
          }

          @if (selectedPanel() === 'courses' && selectedCoursesView() === 'created' && selectedPublishedOffering(); as activeOffering) {
            <div class="published-offering-overlay" role="dialog" aria-modal="true" aria-labelledby="published-offering-detail-title">
              <button
                type="button"
                class="published-offering-overlay-backdrop"
                aria-label="Close course details"
                (click)="closePublishedOfferingDetail()"></button>

              <div class="published-offering-overlay-panel">
                <published-offering-detail
                  [offering]="activeOffering"
                  [assignedCount]="offeringEnrollmentCount(activeOffering.id)"
                  [assessmentCount]="offeringAssessmentCount(activeOffering)"
                  [questionCount]="offeringQuestionCount(activeOffering)"
                  [contentSummary]="offeringContentSummary(activeOffering)"
                  [assignmentSubmissions]="offeringAssignmentSubmissions(activeOffering.id)"
                  (close)="closePublishedOfferingDetail()"
                  (editContent)="editPublishedOfferingContent(activeOffering)"
                  (deleteCourse)="confirmDeletePublishedOffering(activeOffering)"
                  (reviewAssignment)="applyAssignmentReview($event)"
                  (save)="savePublishedOffering($event)" />
              </div>
            </div>
          }
          @if (selectedPanel() === 'enrollment') {
            <section class="manager-panel">
              <div class="section-heading-row">
                <div class="section-heading-block">
                  <h1>Assign students to created courses</h1>
                </div>
                <button type="button" class="assign-btn assign-wizard-launch-btn" (click)="openAssignWizard()">+ New assignment</button>
              </div>

              <div class="enrollment-tab-nav" aria-label="Enrollment views">
                <button
                  type="button"
                  class="enrollment-tab-btn"
                  [class.enrollment-tab-btn-active]="selectedEnrollmentView() === 'students'"
                  (click)="selectEnrollmentView('students')">
                  Students
                </button>
                <button
                  type="button"
                  class="enrollment-tab-btn"
                  [class.enrollment-tab-btn-active]="selectedEnrollmentView() === 'groups'"
                  (click)="selectEnrollmentView('groups')">
                  Groups
                </button>
              </div>

              <div class="student-search-row">
                <label class="student-search-field">
                  <span class="student-search-label">Search students</span>
                  <input
                    type="search"
                    [value]="studentSearchTerm()"
                    (input)="studentSearchTerm.set($any($event.target).value)"
                    placeholder="Search by name, surname, group, email, department, or status" />
                </label>
                <span class="student-search-count">
                  {{ selectedEnrollmentView() === 'students' ? filteredEnrollmentStudents().length : filteredEnrollmentGroups().length }} shown
                </span>
              </div>

              @if (selectedEnrollmentView() === 'students') {
                <div class="roster-table-wrap">
                  <div class="roster-table roster-table-enrollment roster-table-head" aria-hidden="true">
                    <span>Student</span>
                    <span>Group</span>
                    <span>Enrollment</span>
                    <span>Status</span>
                    <span>Department</span>
                    <span>Actions</span>
                  </div>

                  <div class="roster-list" role="table" aria-label="Student enrollment list">
                    @for (student of filteredEnrollmentStudents(); track student.id) {
                      <article class="roster-table roster-table-enrollment roster-row" role="row">
                        <div class="roster-cell roster-primary" role="cell">
                          <span class="roster-avatar" aria-hidden="true">{{ student.name[0] }}{{ student.surname[0] }}</span>
                          <div class="roster-identity">
                            <div class="roster-name">{{ student.name }} {{ student.surname }}</div>
                            <div class="roster-secondary">{{ student.email }}</div>
                          </div>
                        </div>
                        <div class="roster-cell" role="cell">
                          <div class="roster-field-label">Group</div>
                          <span>{{ student.group }}</span>
                        </div>
                        <div class="roster-cell roster-dates" role="cell">
                          <div class="roster-date-row"><span class="roster-field-label roster-field-label-inline">Enrolled</span> {{ student.dateEnrolled }}</div>
                          <div class="roster-date-row"><span class="roster-field-label roster-field-label-inline">Deadline</span> {{ student.deadlineDate }}</div>
                        </div>
                        <div class="roster-cell" role="cell">
                          <div class="roster-field-label">Status</div>
                          <span class="student-active-pill" [class.student-active-pill-inactive]="student.activeStatus === 'Inactive'">{{ student.activeStatus }}</span>
                        </div>
                        <div class="roster-cell" role="cell">
                          <div class="roster-field-label">Department</div>
                          <span>{{ student.department }}</span>
                        </div>
                        <div class="roster-cell roster-actions" role="cell">
                          <button type="button" class="courses-btn" (click)="openManageEnrollmentStudent(student)">Courses ({{ managerData.offeringsForStudent(student).length }})</button>
                        </div>
                      </article>
                    }

                    @if (!filteredEnrollmentStudents().length) {
                      <div class="student-search-empty">No students match your current search.</div>
                    }
                  </div>
                </div>
              } @else {
                <div class="enrollment-group-toolbar">
                  <div>
                    <p class="form-section-eyebrow">Groups</p>
                    <p class="enrollment-group-toolbar-copy">Create a group and choose which students should belong to it.</p>
                  </div>
                  <button type="button" class="assign-btn" (click)="openCreateEnrollmentGroup()">Create group</button>
                </div>

                <div class="enrollment-groups-list" role="table" aria-label="Student groups list">
                  <div class="enrollment-groups-head" role="row">
                    <span role="columnheader">Group name</span>
                    <span role="columnheader">No. students</span>
                    <span role="columnheader">Start date</span>
                    <span role="columnheader">End date</span>
                    <span role="columnheader">Courses</span>
                    <span role="columnheader">Edit</span>
                    <span role="columnheader">Delete</span>
                  </div>

                  @for (group of filteredEnrollmentGroups(); track group.name) {
                    <article class="enrollment-group-row" role="row">
                      <span class="enrollment-group-cell enrollment-group-name" role="cell">{{ group.name }}</span>
                      <span class="enrollment-group-cell" role="cell">{{ group.members.length }}</span>
                      <span class="enrollment-group-cell" role="cell">{{ group.startDate }}</span>
                      <span class="enrollment-group-cell" role="cell">{{ group.endDate }}</span>
                      <div class="enrollment-group-cell enrollment-group-action-cell" role="cell">
                        <button type="button" class="courses-btn" (click)="openManageEnrollmentGroup(group)">{{ managerData.offeringsForGroup(group.members).length }}</button>
                      </div>
                      <div class="enrollment-group-cell enrollment-group-action-cell" role="cell">
                        <button type="button" class="edit-btn" (click)="openEnrollmentGroupEdit(group)">Edit</button>
                      </div>
                      <div class="enrollment-group-cell enrollment-group-action-cell" role="cell">
                        <button type="button" class="group-delete-btn" (click)="deleteEnrollmentGroup(group)">Delete</button>
                      </div>
                    </article>
                  }

                  @if (!filteredEnrollmentGroups().length) {
                    <div class="student-search-empty">No groups match your current search.</div>
                  }
                </div>
              }

              @if (creatingEnrollmentGroup()) {
                <div class="enrollment-modal" aria-label="Create group" role="dialog" aria-modal="true">
                  <button type="button" class="enrollment-modal-backdrop" aria-label="Close create group dialog" (click)="closeCreateEnrollmentGroup()"></button>

                  <section class="enrollment-modal-card enrollment-group-create-card">
                    <div class="enrollment-modal-header">
                      <div class="enrollment-modal-header-copy">
                        <p class="form-section-eyebrow">Create group</p>
                        <h3>Create a student group</h3>
                        <p class="enrollment-modal-copy">Set the shared group details, then select the students you want to add.</p>
                      </div>
                      <button type="button" class="builder-secondary-btn" (click)="closeCreateEnrollmentGroup()">Close</button>
                    </div>

                    <form class="form-grid form-grid-two enrollment-edit-form" [formGroup]="createEnrollmentGroupForm" (ngSubmit)="saveCreateEnrollmentGroup()">
                      <label class="form-grid-span-two enrollment-edit-field">
                        Group name
                        <input formControlName="name" type="text" />
                      </label>
                      <label class="enrollment-edit-field">
                        Start date
                        <input formControlName="startDate" type="date" />
                      </label>
                      <label class="enrollment-edit-field">
                        End date
                        <input formControlName="endDate" type="date" />
                      </label>

                      <div class="form-grid-span-two enrollment-student-picker">
                        <div class="enrollment-student-picker-header">
                          <div>
                            <div class="student-assignment-label">Select students</div>
                            <p class="enrollment-group-toolbar-copy">Choose the learners that should be added to this group.</p>
                          </div>
                          <span class="student-search-count">{{ selectedStudentsForNewGroupCount() }} selected</span>
                        </div>

                        <label class="student-search-field enrollment-student-picker-search">
                          <span class="student-search-label">Search students</span>
                          <input
                            type="search"
                            [value]="createGroupStudentSearchTerm()"
                            (input)="createGroupStudentSearchTerm.set($any($event.target).value)"
                            placeholder="Search by name, surname, group, email, department, or status" />
                        </label>

                        @if (groupCreationStudents().length) {
                          <div class="enrollment-student-picker-list">
                            @for (student of groupCreationStudents(); track student.id) {
                              <label class="enrollment-student-picker-item" [class.enrollment-student-picker-item-selected]="isStudentSelectedForNewGroup(student.id)">
                                <input
                                  type="checkbox"
                                  [checked]="isStudentSelectedForNewGroup(student.id)"
                                  (change)="toggleStudentForNewGroup(student.id, $any($event.target).checked)" />
                                <div class="enrollment-student-picker-copy">
                                  <span class="enrollment-student-picker-name">{{ student.name }} {{ student.surname }}</span>
                                  <span class="enrollment-student-picker-meta">{{ student.group }} • {{ student.department }}</span>
                                </div>
                              </label>
                            }
                          </div>
                        } @else {
                          <p class="enrollment-group-toolbar-copy">No students match your search.</p>
                        }
                      </div>

                      <div class="enrollment-modal-actions form-grid-span-two">
                        <button type="button" class="builder-secondary-btn" (click)="closeCreateEnrollmentGroup()">Cancel</button>
                        <button type="submit" class="assign-btn" [disabled]="createEnrollmentGroupForm.invalid || selectedStudentsForNewGroupCount() === 0">Create group</button>
                      </div>
                    </form>
                  </section>
                </div>
              }

              @if (editingEnrollmentGroup()) {
                <div class="enrollment-modal" aria-label="Edit group details" role="dialog" aria-modal="true">
                  <button type="button" class="enrollment-modal-backdrop" aria-label="Close edit group dialog" (click)="closeEnrollmentGroupEdit()"></button>

                  <section class="enrollment-modal-card enrollment-group-edit-card">
                    <div class="enrollment-modal-header">
                      <div class="enrollment-modal-header-copy">
                        <p class="form-section-eyebrow">Edit group</p>
                        <h3>Edit {{ editingEnrollmentGroup()!.name }}</h3>
                        <p class="enrollment-modal-copy">Update the group name and shared dates for all learners in this group.</p>
                      </div>
                      <button type="button" class="builder-secondary-btn" (click)="closeEnrollmentGroupEdit()">Close</button>
                    </div>

                    <form class="form-grid form-grid-two enrollment-edit-form" [formGroup]="enrollmentGroupForm" (ngSubmit)="saveEnrollmentGroupEdit()">
                      <label class="form-grid-span-two enrollment-edit-field">
                        Group name
                        <input formControlName="name" type="text" />
                      </label>
                      <label class="enrollment-edit-field">
                        Start date
                        <input formControlName="startDate" type="date" />
                      </label>
                      <label class="enrollment-edit-field">
                        End date
                        <input formControlName="endDate" type="date" />
                      </label>

                      <div class="form-grid-span-two enrollment-student-picker enrollment-group-members-panel">
                        <div class="enrollment-student-picker-header">
                          <div>
                            <div class="student-assignment-label">Students in group</div>
                            <p class="enrollment-group-toolbar-copy">Current learners already assigned to {{ editingEnrollmentGroup()!.name }}. Tick students you want to remove when you save.</p>
                          </div>
                          <span class="student-search-count">{{ currentEditingGroupMembers().length }} students</span>
                        </div>

                        @if (selectedStudentsForRemovalFromEditedGroupCount() > 0) {
                          <p class="enrollment-group-toolbar-copy">{{ selectedStudentsForRemovalFromEditedGroupCount() }} student{{ selectedStudentsForRemovalFromEditedGroupCount() === 1 ? '' : 's' }} marked for removal on save.</p>
                        }

                        <div class="enrollment-student-picker-list">
                          @for (student of currentEditingGroupMembers(); track student.id) {
                            <label
                              class="enrollment-student-picker-item enrollment-student-picker-item-static"
                              [class.enrollment-student-picker-item-selected]="isStudentSelectedForRemovalFromEditedGroup(student.id)"
                              [class.enrollment-student-picker-item-pending]="isStudentSelectedForRemovalFromEditedGroup(student.id)">
                              <input
                                type="checkbox"
                                [checked]="isStudentSelectedForRemovalFromEditedGroup(student.id)"
                                (change)="toggleStudentForRemovalFromEditedGroup(student.id)" />
                              <div class="enrollment-student-picker-copy">
                                <span class="enrollment-student-picker-name">{{ student.name }} {{ student.surname }}</span>
                                <span class="enrollment-student-picker-meta">{{ student.group }} • {{ student.department }}</span>
                              </div>
                            </label>
                          }
                        </div>
                      </div>

                      <div class="form-grid-span-two enrollment-student-picker">
                        <div class="enrollment-student-picker-header">
                          <div>
                            <div class="student-assignment-label">Add students</div>
                            <p class="enrollment-group-toolbar-copy">Select more learners to add to this group when you save.</p>
                          </div>
                          <span class="student-search-count">{{ selectedStudentsForEditedGroupCount() }} selected</span>
                        </div>

                        @if (availableStudentsForEditedGroup().length) {
                          <div class="enrollment-student-picker-list">
                            @for (student of availableStudentsForEditedGroup(); track student.id) {
                              <label class="enrollment-student-picker-item" [class.enrollment-student-picker-item-selected]="isStudentSelectedForEditedGroup(student.id)">
                                <input
                                  type="checkbox"
                                  [checked]="isStudentSelectedForEditedGroup(student.id)"
                                  (change)="toggleStudentForEditedGroup(student.id, $any($event.target).checked)" />
                                <div class="enrollment-student-picker-copy">
                                  <span class="enrollment-student-picker-name">{{ student.name }} {{ student.surname }}</span>
                                  <span class="enrollment-student-picker-meta">{{ student.group }} • {{ student.department }}</span>
                                </div>
                              </label>
                            }
                          </div>
                        } @else {
                          <p class="enrollment-group-toolbar-copy">All visible students are already in this group.</p>
                        }
                      </div>

                      <div class="enrollment-modal-actions form-grid-span-two">
                        <button type="button" class="builder-secondary-btn" (click)="closeEnrollmentGroupEdit()">Cancel</button>
                        <button type="submit" class="assign-btn">Save group</button>
                      </div>
                    </form>
                  </section>
                </div>
              }

              @if (managingEnrollmentStudent(); as managedStudent) {
                <div class="enrollment-modal" aria-label="Manage courses" role="dialog" aria-modal="true">
                  <button type="button" class="enrollment-modal-backdrop" aria-label="Close manage courses dialog" (click)="closeManageEnrollmentStudent()"></button>

                  <section class="enrollment-modal-card enrollment-modal-card-compact">
                    <div class="enrollment-modal-header">
                      <div>
                        <p class="form-section-eyebrow">Assigned courses</p>
                        <h3>{{ managedStudent.name }} {{ managedStudent.surname }}</h3>
                      </div>
                      <button type="button" class="builder-secondary-btn" (click)="closeManageEnrollmentStudent()">Close</button>
                    </div>

                    <div class="student-assignment-block">
                      <div class="student-chip-row">
                        @if (managerData.offeringsForStudent(managedStudent).length) {
                          @for (offering of managerData.offeringsForStudent(managedStudent); track offering.id) {
                            <span class="assignment-chip assignment-chip-action">
                              <span>{{ offering.title }}</span>
                              <button type="button" class="assignment-chip-remove" (click)="unassignStudentOffering(managedStudent, offering)" [attr.aria-label]="'Remove ' + offering.title + ' from ' + managedStudent.name + ' ' + managedStudent.surname">×</button>
                            </span>
                          }
                        } @else {
                          <span class="assignment-chip assignment-chip-muted">No courses assigned yet</span>
                        }
                      </div>
                    </div>

                  </section>
                </div>
              }

              @if (managingEnrollmentGroup(); as managedGroup) {
                <div class="enrollment-modal" aria-label="Manage group courses" role="dialog" aria-modal="true">
                  <button type="button" class="enrollment-modal-backdrop" aria-label="Close manage group courses dialog" (click)="closeManageEnrollmentGroup()"></button>

                  <section class="enrollment-modal-card enrollment-modal-card-compact">
                    <div class="enrollment-modal-header">
                      <div>
                        <p class="form-section-eyebrow">Assigned courses</p>
                        <h3>{{ managedGroup.name }}</h3>
                        <p class="enrollment-modal-copy">{{ managedGroup.members.length }} students</p>
                      </div>
                      <button type="button" class="builder-secondary-btn" (click)="closeManageEnrollmentGroup()">Close</button>
                    </div>

                    <div class="student-assignment-block">
                      <div class="student-chip-row">
                        @if (managerData.offeringsForGroup(managedGroup.members).length) {
                          @for (offering of managerData.offeringsForGroup(managedGroup.members); track offering.id) {
                            <span class="assignment-chip assignment-chip-action">
                              <span>{{ offering.title }}</span>
                              <button type="button" class="assignment-chip-remove" (click)="unassignGroupOffering(managedGroup, offering)" [attr.aria-label]="'Remove ' + offering.title + ' from group ' + managedGroup.name">×</button>
                            </span>
                          }
                        } @else {
                          <span class="assignment-chip assignment-chip-muted">No courses assigned yet</span>
                        }
                      </div>
                    </div>

                  </section>
                </div>
              }

              @if (assignWizardOpen()) {
                <div class="enrollment-modal" aria-label="Assign courses to students" role="dialog" aria-modal="true">
                  <button type="button" class="enrollment-modal-backdrop" aria-label="Close assignment wizard" (click)="closeAssignWizard()"></button>

                  <section class="enrollment-modal-card assign-wizard-card">
                    <div class="enrollment-modal-header">
                      <div>
                        <p class="form-section-eyebrow">New assignment</p>
                        <h3>Assign courses to students</h3>
                      </div>
                      <button type="button" class="builder-secondary-btn" (click)="closeAssignWizard()">Close</button>
                    </div>

                    <div class="course-builder-stepper assign-wizard-stepper">
                      <button
                        type="button"
                        class="course-step-btn"
                        [class.course-step-btn-active]="assignWizardStep() === 1"
                        (click)="assignWizardGoToStep(1)">
                        <span class="course-step-index">1</span>
                        <span class="course-step-copy">
                          <strong>Add course or assignment</strong>
                          <span>{{ assignWizardSelectedOfferingCount() }} selected</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        class="course-step-btn"
                        [class.course-step-btn-active]="assignWizardStep() === 2"
                        [disabled]="assignWizardSelectedOfferingCount() === 0"
                        (click)="assignWizardGoToStep(2)">
                        <span class="course-step-index">2</span>
                        <span class="course-step-copy">
                          <strong>Add students</strong>
                          <span>{{ assignWizardSelectedStudentCount() }} selected</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        class="course-step-btn"
                        [class.course-step-btn-active]="assignWizardStep() === 3"
                        [disabled]="assignWizardSelectedStudentCount() === 0"
                        (click)="assignWizardGoToStep(3)">
                        <span class="course-step-index">3</span>
                        <span class="course-step-copy">
                          <strong>Add details</strong>
                          <span>Completion deadline</span>
                        </span>
                      </button>
                    </div>

                    @if (assignWizardStep() === 1) {
                      <label class="student-search-field">
                        <span class="student-search-label">Search courses &amp; programmes</span>
                        <input
                          type="search"
                          [value]="assignWizardOfferingSearchTerm()"
                          (input)="assignWizardOfferingSearchTerm.set($any($event.target).value)"
                          placeholder="Search by title, type, category, or description" />
                      </label>

                      <div class="enrollment-offering-picker" role="listbox" aria-label="Courses and programmes" aria-multiselectable="true">
                        @if (assignWizardFilteredOfferings().length) {
                          <div class="enrollment-offering-picker-list">
                            @for (offering of assignWizardFilteredOfferings(); track offering.id) {
                              <label class="enrollment-offering-option" [class.enrollment-offering-option-selected]="isAssignWizardOfferingSelected(offering.id)">
                                <span class="enrollment-offering-option-check-wrap">
                                  <input
                                    type="checkbox"
                                    class="enrollment-offering-option-input"
                                    [checked]="isAssignWizardOfferingSelected(offering.id)"
                                    (change)="toggleAssignWizardOffering(offering.id, $any($event.target).checked)" />
                                  <span class="enrollment-offering-option-check" aria-hidden="true">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                  </span>
                                </span>
                                <span class="enrollment-offering-option-body">
                                  <span class="enrollment-offering-option-title">{{ offering.title }}</span>
                                  <span class="enrollment-offering-option-meta">{{ offering.type }} • {{ offering.category }} • {{ offeringEnrollmentCount(offering.id) }} assigned</span>
                                  <span class="enrollment-offering-option-copy">{{ offering.description }}</span>
                                </span>
                              </label>
                            }
                          </div>
                        } @else {
                          <p class="student-search-empty">No course or programme matches your search.</p>
                        }
                      </div>
                    }

                    @if (assignWizardStep() === 2) {
                      <div class="student-search-row">
                        <label class="student-search-field">
                          <span class="student-search-label">Search students</span>
                          <input
                            type="search"
                            [value]="assignWizardStudentSearchTerm()"
                            (input)="assignWizardStudentSearchTerm.set($any($event.target).value)"
                            placeholder="Search by name, surname, group, email, or department" />
                        </label>
                        <label class="student-search-group-field">
                          <span class="student-search-label">Group</span>
                          <select [value]="assignWizardStudentGroupFilter()" (change)="updateAssignWizardStudentGroupFilter($event)">
                            <option value="">All groups</option>
                            @for (group of assignWizardStudentGroups(); track group) {
                              <option [value]="group">{{ group }}</option>
                            }
                          </select>
                        </label>
                      </div>

                      <div class="enrollment-offering-picker" role="listbox" aria-label="Students" aria-multiselectable="true">
                        @if (assignWizardFilteredStudents().length) {
                          <label class="enrollment-offering-option enrollment-offering-select-all" [class.enrollment-offering-option-selected]="assignWizardAllFilteredStudentsSelected()">
                            <span class="enrollment-offering-option-check-wrap">
                              <input
                                type="checkbox"
                                class="enrollment-offering-option-input"
                                [checked]="assignWizardAllFilteredStudentsSelected()"
                                (change)="toggleAssignWizardSelectAllStudents($any($event.target).checked)" />
                              <span class="enrollment-offering-option-check" aria-hidden="true">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                              </span>
                            </span>
                            <span class="enrollment-offering-option-body">
                              <span class="enrollment-offering-option-title">Select all</span>
                              <span class="enrollment-offering-option-meta">{{ assignWizardFilteredStudents().length }} {{ assignWizardFilteredStudents().length === 1 ? 'student' : 'students' }} shown</span>
                            </span>
                          </label>

                          <div class="enrollment-offering-picker-list">
                            @for (student of assignWizardFilteredStudents(); track student.id) {
                              <label class="enrollment-offering-option" [class.enrollment-offering-option-selected]="isAssignWizardStudentSelected(student.id)">
                                <span class="enrollment-offering-option-check-wrap">
                                  <input
                                    type="checkbox"
                                    class="enrollment-offering-option-input"
                                    [checked]="isAssignWizardStudentSelected(student.id)"
                                    (change)="toggleAssignWizardStudent(student.id, $any($event.target).checked)" />
                                  <span class="enrollment-offering-option-check" aria-hidden="true">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                  </span>
                                </span>
                                <span class="enrollment-offering-option-body">
                                  <span class="enrollment-offering-option-title">{{ student.name }} {{ student.surname }}</span>
                                  <span class="enrollment-offering-option-meta">{{ student.group || 'Ungrouped' }} • {{ student.department }} • {{ student.email }}</span>
                                </span>
                              </label>
                            }
                          </div>
                        } @else {
                          <p class="student-search-empty">No student matches your search.</p>
                        }
                      </div>
                    }

                    @if (assignWizardStep() === 3) {
                      <div class="assign-wizard-summary">
                        <div class="student-assignment-block">
                          <div class="student-assignment-label">Courses &amp; programmes ({{ assignWizardSelectedOfferingCount() }})</div>
                          <div class="student-chip-row">
                            @for (offering of assignWizardSelectedOfferings(); track offering.id) {
                              <span class="assignment-chip">{{ offering.title }}</span>
                            }
                          </div>
                        </div>
                        <div class="student-assignment-block">
                          <div class="student-assignment-label">Students ({{ assignWizardSelectedStudentCount() }})</div>
                          <div class="student-chip-row">
                            @for (student of assignWizardSelectedStudents(); track student.id) {
                              <span class="assignment-chip">{{ student.name }} {{ student.surname }}</span>
                            }
                          </div>
                        </div>
                      </div>

                      <label class="student-search-field">
                        <span class="student-search-label">Deadline for completion</span>
                        <input
                          type="date"
                          [value]="assignWizardDeadline()"
                          (input)="assignWizardDeadline.set($any($event.target).value)" />
                      </label>
                      <p class="field-hint">
                        @if (assignWizardSelectedOfferingCount() > 1) {
                          Sets the completion deadline on every course/programme selected above — applies to everyone assigned to them, not just the students picked here.
                        } @else {
                          Sets this course's completion deadline — applies to everyone assigned to it, not just the students picked here.
                        }
                        Leave blank to keep the current deadline{{ assignWizardSelectedOfferingCount() > 1 ? 's' : '' }} unchanged.
                      </p>
                    }

                    <div class="enrollment-modal-actions">
                      @if (assignWizardStep() > 1) {
                        <button type="button" class="builder-secondary-btn" (click)="assignWizardBack()">Back</button>
                      }
                      @if (assignWizardStep() < 3) {
                        <button
                          type="button"
                          class="assign-btn"
                          [disabled]="assignWizardStep() === 1 ? assignWizardSelectedOfferingCount() === 0 : assignWizardSelectedStudentCount() === 0"
                          (click)="assignWizardNext()">
                          Next
                        </button>
                      } @else {
                        <button type="button" class="assign-btn" [disabled]="assignWizardSaving()" (click)="confirmAssignWizard()">
                          {{ assignWizardSaving() ? 'Assigning…' : 'Confirm assignment' }}
                        </button>
                      }
                    </div>
                  </section>
                </div>
              }

              @if (assignWizardToast(); as toastMessage) {
                <div class="assign-toast" role="status" aria-live="polite">
                  <span class="assign-toast-icon" aria-hidden="true">✓</span>
                  <span class="assign-toast-message">{{ toastMessage }}</span>
                  <button type="button" class="assign-toast-dismiss" aria-label="Dismiss notification" (click)="dismissAssignWizardToast()">×</button>
                </div>
              }
            </section>
          }
        <!-- removed extra closing main tag to fix template structure -->

      <logout-confirm-dialog
        [open]="showLogoutDialog()"
        [stage]="logoutDialogStage()"
        (confirmed)="confirmLogout()"
        (cancelled)="cancelLogout()"></logout-confirm-dialog>
  `,
  styles: [`
    :host {
      --ui-scale: 0.86;
      --sidebar-stack-offset: calc((3.7rem + 64px) * var(--ui-scale) + 4px);
      display: block;
      min-height: 100vh;
      background: #eef2f7;
      color: #173446;
      font-family: 'Inter', 'Segoe UI', 'Roboto', Arial, sans-serif;
    }

    .admin-shell {
      position: relative;
      isolation: isolate;
      min-height: 100vh;
      padding: calc(1rem * var(--ui-scale));
      box-sizing: border-box;
      background:
        radial-gradient(circle at top left, rgba(56, 189, 248, 0.08), transparent 20%),
        linear-gradient(180deg, #f6f8fc 0%, var(--admin-surface) 100%);
    }

    .admin-topbar,
    .admin-sidebar,
    .admin-panel,
    .admin-profile-card,
    .admin-metric-card,
    .admin-section-card {
      box-sizing: border-box;
      border: 1px solid rgba(15, 23, 42, 0.07);
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03), 0 4px 14px rgba(15, 23, 42, 0.045);
    }

    .admin-topbar {
      position: sticky;
      top: calc(1rem * var(--ui-scale));
      z-index: 70;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: calc(1rem * var(--ui-scale));
      min-height: calc(64px * var(--ui-scale));
      margin-bottom: calc(0.85rem * var(--ui-scale));
      background: linear-gradient(180deg, var(--admin-tint) 0%, #ffffff 70%);
      border-bottom: 3px solid var(--admin-primary);
      padding: calc(0.75rem * var(--ui-scale)) calc(1.1rem * var(--ui-scale));
      border-radius: calc(14px * var(--ui-scale));
      box-sizing: border-box;
    }

    .admin-topbar-dropdown-wrap {
      position: relative;
      z-index: 130;
    }

    .admin-topbar-profile-btn {
      display: inline-flex;
      align-items: center;
      gap: calc(0.7rem * var(--ui-scale));
      padding: calc(0.25rem * var(--ui-scale)) calc(0.55rem * var(--ui-scale)) calc(0.25rem * var(--ui-scale)) calc(0.25rem * var(--ui-scale));
      border: 1px solid transparent;
      border-radius: 999px;
      background: transparent;
      color: #475569;
      text-align: left;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .admin-topbar-profile-btn:hover,
    .admin-topbar-profile-btn:focus-visible {
      outline: none;
      background: rgba(15, 23, 42, 0.04);
      border-color: rgba(15, 23, 42, 0.1);
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
    }

    .admin-topbar-profile-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .admin-topbar-caret {
      color: #94a3b8;
      flex-shrink: 0;
    }

    .admin-topbar-menu {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      z-index: 120;
      min-width: calc(14rem * var(--ui-scale));
      display: grid;
      gap: calc(0.2rem * var(--ui-scale));
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: calc(12px * var(--ui-scale));
      background: #ffffff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
      padding: calc(0.35rem * var(--ui-scale));
    }

    .admin-topbar-menu-section-label {
      padding: calc(0.45rem * var(--ui-scale)) calc(0.85rem * var(--ui-scale)) calc(0.2rem * var(--ui-scale));
      font-size: calc(0.72rem * var(--ui-scale));
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #94a3b8;
    }

    .admin-topbar-menu-item {
      display: flex;
      align-items: center;
      gap: calc(0.55rem * var(--ui-scale));
      border: none;
      border-radius: calc(9px * var(--ui-scale));
      background: transparent;
      color: #0f172a;
      text-align: left;
      font-weight: 600;
      font-size: calc(0.9rem * var(--ui-scale));
      padding: calc(0.6rem * var(--ui-scale)) calc(0.85rem * var(--ui-scale));
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .admin-topbar-menu-item:hover,
    .admin-topbar-menu-item:focus-visible {
      outline: none;
      background: rgba(15, 23, 42, 0.06);
      color: var(--admin-primary);
    }

    .admin-topbar-menu-item-danger {
      color: #b91c1c;
    }

    .admin-topbar-menu-item-danger:hover,
    .admin-topbar-menu-item-danger:focus-visible {
      background: rgba(185, 28, 28, 0.08);
      color: #991b1b;
    }

    .admin-topbar-menu-divider {
      height: 1px;
      background: rgba(148, 163, 184, 0.18);
      margin: calc(0.2rem * var(--ui-scale)) calc(0.6rem * var(--ui-scale));
    }

    .admin-topbar-menu-backdrop {
      position: fixed;
      inset: 0;
      z-index: 60;
      border: none;
      background: rgba(15, 23, 42, 0.22);
      padding: 0;
      margin: 0;
      cursor: default;
    }

    .admin-brand-block,
    .admin-topbar-user,
    .admin-profile-card-header,
    .admin-user-primary,
    .admin-status-meta,
    .admin-progress-meta,
    .admin-section-card-header,
    .admin-logo-panel,
    .admin-logo-actions,
    .admin-report-actions,
    .admin-user-actions {
      display: flex;
      align-items: center;
      gap: calc(0.85rem * var(--ui-scale));
      min-width: 0;
    }

    .admin-brand-logo,
    .admin-avatar,
    .admin-profile-avatar,
    .admin-user-avatar,
    .admin-logo-preview {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 800;
      flex: 0 0 auto;
      overflow: hidden;
    }

    .admin-brand-logo,
    .admin-avatar {
      width: calc(2.6rem * var(--ui-scale));
      height: calc(2.6rem * var(--ui-scale));
      border-radius: calc(11px * var(--ui-scale));
      background: linear-gradient(135deg, var(--admin-primary), var(--admin-secondary));
    }

    .admin-brand-logo-has-image,
    .admin-avatar-has-image,
    .admin-logo-preview-has-image {
      background: #fff;
      border: 1px solid rgba(148, 163, 184, 0.22);
    }

    .admin-brand-logo img,
    .admin-avatar img,
    .admin-logo-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .admin-profile-avatar,
    .admin-logo-preview {
      width: 3.2rem;
      height: 3.2rem;
      border-radius: 0.9rem;
      background: linear-gradient(135deg, var(--admin-primary), var(--admin-secondary));
    }

    .admin-logo-preview {
      width: 4rem;
      height: 4rem;
      border-radius: 0.9rem;
      font-size: 1.15rem;
    }

    .admin-brand-name,
    .admin-user-name,
    .admin-metric-value,
    h1,
    h2,
    p {
      margin: 0;
    }

    .admin-brand-name {
      font-size: calc(1.02rem * var(--ui-scale));
      font-weight: 800;
    }

    .admin-user-name {
      max-width: calc(11rem * var(--ui-scale));
      color: #475569;
      font-size: calc(0.98rem * var(--ui-scale));
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .admin-brand-copy,
    .section-copy,
    .admin-metric-copy,
    .admin-empty-state {
      color: #475569;
      line-height: 1.5;
    }

    .admin-layout {
      display: grid;
      grid-template-columns: calc(296px * var(--ui-scale)) minmax(0, 1fr);
      gap: calc(1rem * var(--ui-scale));
      align-items: start;
    }

    .admin-layout.admin-layout-sidebar-collapsed {
      grid-template-columns: calc(96px * var(--ui-scale)) minmax(0, 1fr);
    }

    .admin-sidebar {
      position: sticky;
      top: var(--sidebar-stack-offset);
      display: flex;
      flex-direction: column;
      gap: calc(0.25rem * var(--ui-scale));
      align-self: start;
      height: calc(100vh - var(--sidebar-stack-offset) - calc(1rem * var(--ui-scale)));
      overflow: auto;
      padding: calc(0.6rem * var(--ui-scale));
      border-radius: calc(14px * var(--ui-scale));
      /* Tinted by the chosen theme rather than a flat fixed navy — color-mix keeps the sidebar
         dark enough for white text/icons to stay legible across every theme (including light
         theme colours like Sunrise's orange) while still visibly reflecting the pick. */
      background: linear-gradient(180deg, color-mix(in srgb, var(--admin-primary) 32%, #12152f) 0%, color-mix(in srgb, var(--admin-primary) 16%, #12152f) 100%);
      border: 1px solid rgba(255, 255, 255, 0.06);
      box-shadow: 0 20px 45px rgba(8, 10, 26, 0.35);
      scrollbar-width: none;
      scrollbar-color: transparent transparent;
    }

    .admin-sidebar.admin-sidebar-scrolling {
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
    }

    .admin-sidebar::-webkit-scrollbar {
      width: 6px;
    }

    .admin-sidebar::-webkit-scrollbar-track {
      background: transparent;
    }

    .admin-sidebar::-webkit-scrollbar-thumb {
      background-color: transparent;
      border-radius: 999px;
      transition: background-color 0.3s ease;
    }

    .admin-sidebar.admin-sidebar-scrolling::-webkit-scrollbar-thumb {
      background-color: rgba(255, 255, 255, 0.25);
    }

    .admin-sidebar-header {
      display: flex;
      justify-content: center;
    }

    .admin-sidebar-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: calc(2.1rem * var(--ui-scale));
      height: calc(2.1rem * var(--ui-scale));
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: calc(10px * var(--ui-scale));
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.85);
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease, color 0.15s ease;
    }

    .admin-sidebar-toggle:hover,
    .admin-sidebar-toggle:focus-visible {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.3);
      outline: none;
      transform: translateY(-1px);
    }

    .admin-sidebar-toggle svg {
      width: calc(1rem * var(--ui-scale));
      height: calc(1rem * var(--ui-scale));
      stroke: currentColor;
    }

    .admin-sidebar button:not(.admin-sidebar-toggle),
    .admin-upload-btn,
    .admin-secondary-btn,
    .admin-primary-btn,
    .admin-inline-btn,
    .admin-report-menu-item {
      border: none;
      cursor: pointer;
      font: inherit;
    }

    .admin-sidebar button:not(.admin-sidebar-toggle) {
      display: flex;
      align-items: center;
      gap: calc(0.6rem * var(--ui-scale));
      border-radius: calc(10px * var(--ui-scale));
      padding: calc(0.5rem * var(--ui-scale)) calc(0.7rem * var(--ui-scale));
      background: transparent;
      color: rgba(255, 255, 255, 0.68);
      text-align: left;
      font-size: calc(0.88rem * var(--ui-scale));
      font-weight: 700;
      transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease;
    }

    .admin-nav-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 calc(1.9rem * var(--ui-scale));
      width: calc(1.9rem * var(--ui-scale));
      height: calc(1.9rem * var(--ui-scale));
      border-radius: calc(9px * var(--ui-scale));
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: currentColor;
      flex-shrink: 0;
      transition: background 0.18s ease, color 0.18s ease;
    }

    .admin-nav-icon svg {
      width: calc(1rem * var(--ui-scale));
      height: calc(1rem * var(--ui-scale));
    }

    .admin-nav-label {
      min-width: 0;
    }

    .admin-sidebar button:not(.admin-sidebar-toggle):hover,
    .admin-sidebar button:not(.admin-sidebar-toggle):focus-visible {
      background: rgba(255, 255, 255, 0.07);
      color: #fff;
      outline: none;
      transform: translateX(2px);
    }

    .admin-sidebar button:not(.admin-sidebar-toggle).active {
      background: linear-gradient(135deg, var(--admin-primary), var(--admin-secondary));
      color: #fff;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
    }

    .admin-sidebar button:not(.admin-sidebar-toggle):hover .admin-nav-icon,
    .admin-sidebar button:not(.admin-sidebar-toggle):focus-visible .admin-nav-icon {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .admin-sidebar button:not(.admin-sidebar-toggle).active .admin-nav-icon {
      background: rgba(255, 255, 255, 0.18);
      border-color: rgba(255, 255, 255, 0.24);
    }

    .admin-sidebar button:not(.admin-sidebar-toggle).logout {
      margin-top: auto;
      background: rgba(248, 113, 113, 0.14);
      color: #fca5a5;
    }

    .admin-sidebar button:not(.admin-sidebar-toggle).logout .admin-nav-icon {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(248, 113, 113, 0.3);
      color: #fca5a5;
    }

    .admin-sidebar-collapsed {
      gap: calc(0.35rem * var(--ui-scale));
      padding-inline: calc(0.5rem * var(--ui-scale));
    }

    .admin-sidebar-collapsed .admin-sidebar-header {
      justify-content: center;
    }

    .admin-sidebar-collapsed button {
      justify-content: center;
      padding-inline: calc(0.5rem * var(--ui-scale));
    }

    .admin-sidebar-collapsed .admin-nav-label {
      display: none;
    }

    .admin-sidebar-collapsed .admin-nav-icon {
      flex-basis: calc(2.1rem * var(--ui-scale));
      width: calc(2.1rem * var(--ui-scale));
    }

    .admin-sidebar button:not(.admin-sidebar-toggle).logout:hover,
    .admin-sidebar button:not(.admin-sidebar-toggle).logout:focus-visible {
      background: rgba(248, 113, 113, 0.24);
      color: #fecaca;
    }

    .admin-main-panel {
      min-width: 0;
    }

    .admin-panel {
      display: grid;
      gap: 1rem;
      padding: calc(1rem * var(--ui-scale));
      border-radius: calc(16px * var(--ui-scale));
    }

    .section-heading-block {
      display: grid;
      gap: 0.45rem;
    }

    .eyebrow {
      margin: 0;
      color: var(--admin-secondary);
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 {
      color: #173446;
      font-size: calc(1.8rem * var(--ui-scale));
      font-weight: 800;
      line-height: 1.1;
    }

    h2 {
      color: #173446;
      font-size: 1.02rem;
      font-weight: 800;
    }

    .admin-dashboard-grid,
    .admin-snapshot-grid,
    .admin-report-builder-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      gap: 1rem;
      align-items: start;
    }

    .admin-report-picker {
      display: grid;
      gap: 1rem;
      width: 100%;
      max-width: 100%;
    }

    .admin-report-content-stack {
      display: grid;
      gap: 1rem;
      min-width: 0;
    }

    .admin-report-menu-card {
      display: grid;
      grid-template-rows: auto 1fr;
      width: 100%;
      max-width: none;
      overflow: hidden;
    }

    .admin-report-menu-card-primary {
      min-height: calc(100vh - 8rem);
    }

    .admin-report-menu-card .admin-report-menu {
      align-content: start;
    }

    .admin-report-menu {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
      gap: 1rem;
      min-width: 0;
      padding: 1rem;
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 14px;
      background: linear-gradient(180deg, #fbfdff 0%, #f6faff 100%);
      box-sizing: border-box;
    }

    .admin-report-open-card {
      gap: 1.15rem;
    }

    .admin-report-open-header {
      gap: 0.75rem;
    }

    .admin-report-open-heading {
      display: grid;
      gap: 0.3rem;
    }

    .admin-report-back-btn {
      justify-self: start;
    }

    .admin-primary-btn,
    .admin-secondary-btn,
    .admin-upload-btn,
    .admin-inline-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      min-height: 2.6rem;
      padding: 0.65rem 0.95rem;
      border: 1px solid transparent;
      border-radius: 10px;
      box-sizing: border-box;
      font-weight: 700;
      letter-spacing: 0.01em;
      line-height: 1;
      text-decoration: none;
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease, color 0.18s ease, opacity 0.18s ease;
    }

    .admin-primary-btn,
    .admin-upload-btn {
      background: linear-gradient(135deg, var(--admin-primary), var(--admin-secondary));
      color: #fff;
      box-shadow: 0 2px 6px rgba(23, 52, 70, 0.14);
    }

    .admin-secondary-btn,
    .admin-inline-btn {
      background: #ffffff;
      color: #173446;
      border-color: rgba(148, 163, 184, 0.32);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }

    .admin-inline-btn {
      min-height: 2.2rem;
      padding: 0.5rem 0.85rem;
      border-radius: 999px;
      font-size: 0.82rem;
    }

    .admin-inline-btn-danger {
      background: rgba(254, 242, 242, 0.98);
      color: #b91c1c;
      border-color: rgba(248, 113, 113, 0.28);
      box-shadow: none;
    }

    .admin-primary-btn:hover,
    .admin-primary-btn:focus-visible,
    .admin-upload-btn:hover,
    .admin-upload-btn:focus-within {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(23, 52, 70, 0.2);
      outline: none;
    }

    .admin-secondary-btn:hover,
    .admin-secondary-btn:focus-visible,
    .admin-inline-btn:hover,
    .admin-inline-btn:focus-visible {
      transform: translateY(-1px);
      border-color: rgba(56, 189, 248, 0.32);
      box-shadow: 0 3px 10px rgba(15, 23, 42, 0.1);
      outline: none;
    }

    .admin-inline-btn-danger:hover,
    .admin-inline-btn-danger:focus-visible {
      border-color: rgba(239, 68, 68, 0.34);
      box-shadow: 0 3px 10px rgba(239, 68, 68, 0.12);
    }

    .admin-primary-btn:disabled,
    .admin-secondary-btn:disabled,
    .admin-inline-btn:disabled {
      opacity: 0.58;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .admin-report-menu-item {
      display: grid;
      align-content: start;
      gap: 0.3rem;
      min-height: 12.5rem;
      width: 100%;
      max-width: 100%;
      padding: 1.2rem 1.2rem 1.05rem;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 14px;
      background: #ffffff;
      box-sizing: border-box;
      text-align: left;
      color: #173446;
      font: inherit;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
    }

    .admin-report-menu-item::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      opacity: 0;
      background: linear-gradient(160deg, rgba(56, 189, 248, 0.07), transparent 55%);
      transition: opacity 0.18s ease;
      pointer-events: none;
    }

    .admin-report-menu-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.8rem;
      height: 2.8rem;
      border-radius: 10px;
      margin-bottom: 0.8rem;
      flex-shrink: 0;
      position: relative;
      z-index: 1;
      transition: transform 0.18s ease;
    }

    .admin-report-menu-icon svg {
      width: 20px;
      height: 20px;
    }

    .admin-report-menu-item-annual .admin-report-menu-icon {
      background: rgba(14, 165, 233, 0.13);
      color: #0369a1;
    }

    .admin-report-menu-item-users .admin-report-menu-icon {
      background: rgba(16, 185, 129, 0.13);
      color: #047857;
    }

    .admin-report-menu-item-idp .admin-report-menu-icon {
      background: rgba(139, 92, 246, 0.13);
      color: #6d28d9;
    }

    .admin-report-menu-item-certs .admin-report-menu-icon {
      background: rgba(245, 158, 11, 0.14);
      color: #b45309;
    }

    .admin-report-menu-text {
      display: grid;
      gap: 0.32rem;
      position: relative;
      z-index: 1;
    }

    .admin-report-menu-item strong {
      font-size: 1.15rem;
      font-weight: 800;
      line-height: 1.32;
    }

    .admin-report-menu-item span {
      color: #64748b;
      font-size: 0.92rem;
      line-height: 1.5;
    }

    .admin-report-menu-cta {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      margin-top: 1.15rem;
      color: var(--admin-primary);
      font-size: 0.9rem;
      font-weight: 800;
      position: relative;
      z-index: 1;
      transition: gap 0.18s ease;
    }

    .admin-report-menu-cta svg {
      transition: transform 0.18s ease;
    }

    .admin-report-menu-item:hover,
    .admin-report-menu-item:focus-visible {
      border-color: rgba(56, 189, 248, 0.3);
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
      transform: translateY(-2px);
      outline: none;
    }

    .admin-report-menu-item:hover::after,
    .admin-report-menu-item:focus-visible::after {
      opacity: 1;
    }

    .admin-report-menu-item:hover .admin-report-menu-icon,
    .admin-report-menu-item:focus-visible .admin-report-menu-icon {
      transform: scale(1.06);
    }

    .admin-report-menu-item:hover .admin-report-menu-cta svg,
    .admin-report-menu-item:focus-visible .admin-report-menu-cta svg {
      transform: translateX(3px);
    }

    .admin-report-menu-item-active {
      border-color: rgba(56, 189, 248, 0.36);
      background: linear-gradient(180deg, rgba(240, 249, 255, 0.98) 0%, rgba(255, 255, 255, 0.92) 100%);
      box-shadow: 0 4px 12px rgba(56, 189, 248, 0.1);
    }

    .admin-settings-menu {
      display: grid;
      gap: 1rem;
    }

    .admin-report-builder-grid-stack {
      grid-template-columns: 1fr;
    }

    .admin-report-builder-grid-stack .section-copy {
      font-size: 0.88rem;
    }

    .admin-profile-card,
    .admin-section-card {
      display: grid;
      gap: 0.9rem;
      padding: 0.95rem;
      border-radius: 14px;
    }

    .admin-profile-card {
      min-height: 100%;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(246, 250, 255, 0.94) 100%);
    }

    .admin-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 80;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(3px);
      overflow-y: auto;
    }

    .admin-modal {
      width: min(860px, 100%);
      max-height: min(calc(100vh - 3rem), 860px);
      display: grid;
      gap: 0.9rem;
      padding: 1.1rem;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
      overflow-y: auto;
    }

    .admin-annual-report-documents-form {
      display: grid;
      gap: 1.1rem;
    }

    .admin-report-document-field {
      display: grid;
      gap: 0.5rem;
      align-items: start;
    }

    .admin-report-document-label {
      font-weight: 700;
      font-size: 0.88rem;
      color: #173446;
    }

    .admin-report-document-field .admin-upload-btn {
      justify-self: start;
      min-height: 2.6rem;
      padding: 0.6rem 1.2rem;
    }

    .admin-report-upload-status {
      font-size: 0.85rem;
      color: #475569;
    }

    .admin-report-upload-status a {
      color: #6366f1;
      font-weight: 600;
    }

    .admin-profile-meta-grid,
    .admin-metric-grid,
    .admin-edit-form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.85rem;
    }

    .admin-profile-meta-item {
      display: grid;
      gap: 0.28rem;
      padding: 0.7rem 0.8rem;
      border-radius: 10px;
      background: #f8fbff;
      border: 1px solid rgba(148, 163, 184, 0.16);
    }

    .admin-profile-meta-item span,
    .admin-metric-label,
    .admin-user-field-label,
    .admin-edit-form label {
      color: #64748b;
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .admin-edit-form label {
      display: grid;
      gap: 0.45rem;
      color: #173446;
      letter-spacing: 0.04em;
    }

    .admin-edit-form input,
    .admin-edit-form select,
    .admin-search-field input {
      width: 100%;
      padding: 0.65rem 0.8rem;
      border: 1px solid rgba(148, 163, 184, 0.32);
      border-radius: 10px;
      background: #fff;
      color: #173446;
      box-sizing: border-box;
      outline: none;
      font: inherit;
      text-transform: none;
      letter-spacing: normal;
    }

    .admin-edit-form input:focus,
    .admin-edit-form select:focus,
    .admin-search-field input:focus {
      border-color: var(--admin-secondary);
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.14);
    }

    .admin-profile-meta-item strong,
    .admin-progress-meta strong,
    .admin-status-row strong {
      color: #173446;
      font-size: 0.96rem;
    }

    .admin-metric-card {
      display: grid;
      gap: 0.4rem;
      padding: 0.85rem;
      border-radius: 12px;
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }

    .admin-metric-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
    }

    .admin-metric-card-accent {
      background: linear-gradient(180deg, rgba(240, 249, 255, 0.98) 0%, rgba(255, 255, 255, 0.92) 100%);
      border-color: rgba(56, 189, 248, 0.22);
    }

    .admin-metric-value {
      color: #173446;
      font-size: 1.6rem;
      font-weight: 800;
    }

    .admin-dashboard-top-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
      gap: 1rem;
      align-items: stretch;
    }

    .admin-metric-grid-2x2 {
      grid-template-rows: repeat(2, 1fr);
    }

    .admin-dashboard-heading {
      margin-bottom: 0.15rem;
    }

    .admin-metric-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.3rem;
      height: 2.3rem;
      border-radius: 9px;
      margin-bottom: 0.2rem;
    }

    .admin-metric-card-users .admin-metric-icon {
      background: rgba(14, 165, 233, 0.13);
      color: #0369a1;
    }

    .admin-metric-card-active .admin-metric-icon {
      background: rgba(16, 185, 129, 0.13);
      color: #047857;
    }

    .admin-metric-card-inactive .admin-metric-icon {
      background: rgba(148, 163, 184, 0.2);
      color: #475569;
    }

    .admin-metric-card-learners .admin-metric-icon {
      background: rgba(139, 92, 246, 0.13);
      color: #6d28d9;
    }

    .admin-section-card-heading {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .admin-section-card-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.2rem;
      height: 2.2rem;
      flex-shrink: 0;
      border-radius: 11px;
      background: rgba(56, 189, 248, 0.13);
      color: var(--admin-primary);
    }

    .admin-section-card-header,
    .admin-toolbar,
    .admin-chip-row,
    .admin-theme-swatches {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.85rem;
      flex-wrap: wrap;
    }

    .admin-report-actions,
    .admin-form-actions,
    .admin-user-actions {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      flex-wrap: wrap;
    }

    .admin-form-actions {
      grid-column: 1 / -1;
      justify-content: flex-end;
    }

    .admin-section-card-header span,
    .admin-status-row span,
    .admin-progress-meta span {
      color: #64748b;
      font-size: 0.88rem;
      font-weight: 700;
    }

    .admin-progress-group,
    .admin-status-list,
    .admin-user-list {
      display: grid;
      gap: 0.75rem;
    }

    /* The clickable rows in the collapsed settings menu (Admin profile picture / Company logo /
       Theme colour) — same list-of-cards-that-open-a-detail-view pattern as the student profile's
       Profile & Settings screen (student-profile-settings.component.ts), adapted to this
       component's --admin-* theme variables and existing .admin-secondary-btn-style palette
       instead of introducing new ones. */
    .admin-settings-menu-item {
      display: grid;
      gap: 0.35rem;
      width: 100%;
      padding: 1rem 1.1rem;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 14px;
      background: #ffffff;
      text-align: left;
      cursor: pointer;
      font: inherit;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
    }

    .admin-settings-menu-item:hover,
    .admin-settings-menu-item:focus-visible {
      border-color: var(--admin-secondary);
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
      transform: translateX(2px);
      outline: none;
    }

    .admin-settings-menu-item-title {
      color: var(--admin-primary);
      font-size: 1rem;
      font-weight: 700;
    }

    .admin-settings-menu-item-copy {
      color: #64748b;
      font-size: 0.88rem;
      line-height: 1.45;
    }

    .admin-approver-grid { display: grid; gap: 0.6rem; }
    .admin-approver-row {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      width: 100%;
      padding: 0.85rem 1rem;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 14px;
      background: #ffffff;
      text-align: left;
      cursor: pointer;
      font: inherit;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
    }
    .admin-approver-row:hover,
    .admin-approver-row:focus-visible {
      border-color: var(--admin-secondary);
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
      transform: translateX(2px);
      outline: none;
    }

    .admin-approver-avatar {
      flex-shrink: 0;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      font-weight: 800;
      color: #fff;
      background: linear-gradient(135deg, var(--admin-primary), var(--admin-secondary));
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.14);
    }
    .admin-approver-avatar-lg { width: 3rem; height: 3rem; font-size: 1rem; }

    .admin-approver-info { display: grid; gap: 0.3rem; flex: 1; min-width: 0; }
    .admin-approver-name { color: #14213d; font-size: 0.95rem; }
    .admin-approver-chip-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .admin-approver-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      background: #f1f5f9;
      color: #475569;
      font-size: 0.72rem;
      font-weight: 600;
    }
    .admin-approver-email {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: #64748b;
      font-size: 0.8rem;
    }
    .admin-approver-chevron { flex-shrink: 0; color: #94a3b8; font-size: 1.1rem; }

    .admin-approver-form-header {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.9rem 1rem;
      margin-bottom: 1rem;
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(56, 189, 248, 0.06), rgba(255, 255, 255, 0));
      border: 1px solid rgba(148, 163, 184, 0.22);
    }
    .admin-approver-form-header div { display: grid; gap: 0.15rem; }
    .admin-approver-form-header strong { color: #14213d; font-size: 0.98rem; }
    .admin-approver-form-header span { color: #64748b; font-size: 0.8rem; }

    .admin-approver-field-label {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--admin-primary);
    }

    .succession-report-table-wrap { overflow-x: auto; }
    .succession-report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;
    }
    .succession-report-table th,
    .succession-report-table td {
      text-align: left;
      padding: 0.65rem 0.85rem;
      border-bottom: 1px solid rgba(148, 163, 184, 0.24);
      white-space: nowrap;
    }
    .succession-report-table th {
      color: #64748b;
      font-weight: 700;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .succession-status-chip {
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      background: #e2e8f0;
      color: #334155;
      font-size: 0.76rem;
      font-weight: 700;
    }
    .succession-status-chip.succession-status-active { background: rgba(34, 197, 94, 0.16); color: #15803d; }
    .succession-status-chip.succession-status-withdrawn { background: rgba(148, 163, 184, 0.24); color: #475569; }

    .succession-org-view-tabs { margin-bottom: 0.25rem; }

    /* Pure-CSS org chart: each li draws its own elbow connector up to its siblings/parent via
       ::before/::after, and each ul (nested inside a parent li) draws the vertical drop from that
       parent down to its row of children. Root-level nodes opt out of the elbow since they have no
       shared parent to connect to. */
    .org-chart-scroll { overflow-x: auto; padding: 0.5rem 0 1rem; }
    .org-chart-root,
    .org-chart-children {
      display: flex;
      justify-content: center;
      gap: 0;
      padding-top: 28px;
      position: relative;
      list-style: none;
      margin: 0;
      min-width: max-content;
    }
    .org-chart-root { padding-top: 0; }
    .org-chart-children { position: relative; }
    .org-chart-children::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      width: 0;
      height: 28px;
      border-left: 2px solid #cbd5e1;
    }
    .org-chart-node {
      position: relative;
      padding: 28px 14px 0 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .org-chart-root > .org-chart-node { padding-top: 0; }
    .org-chart-node::before,
    .org-chart-node::after {
      content: '';
      position: absolute;
      top: 0;
      right: 50%;
      width: 50%;
      height: 28px;
      border-top: 2px solid #cbd5e1;
    }
    .org-chart-node::after { right: auto; left: 50%; border-left: 2px solid #cbd5e1; }
    .org-chart-node:first-child::before { border: 0 none; }
    .org-chart-node:last-child::after { border: 0 none; }
    .org-chart-node:last-child::before { border-right: 2px solid #cbd5e1; border-radius: 0 6px 0 0; }
    .org-chart-node:first-child::after { border-radius: 6px 0 0 0; }
    .org-chart-node:only-child::before,
    .org-chart-node:only-child::after { border: 0 none; }
    .org-chart-node:only-child { padding-top: 28px; }
    .org-chart-root > .org-chart-node::before,
    .org-chart-root > .org-chart-node::after { display: none; }

    .org-chart-card {
      background: #fff;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-top: 4px solid #cbd5e1;
      border-radius: 12px;
      padding: 0.85rem 1rem;
      width: 240px;
      text-align: left;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
    }
    .org-chart-card-ready-now { border-top-color: #22c55e; }
    .org-chart-card-1-2-years { border-top-color: #f59e0b; }
    .org-chart-card-3-plus-years { border-top-color: #38bdf8; }
    .org-chart-card-none { border-top-color: #ef4444; }

    .org-chart-card-top { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.6rem; }
    .org-chart-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--admin-primary);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.76rem;
      flex-shrink: 0;
    }
    .org-chart-card-title-group { display: flex; flex-direction: column; min-width: 0; }
    .org-chart-card-title { font-size: 0.9rem; color: #0f172a; }
    .org-chart-card-meta {
      font-size: 0.76rem;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .org-chart-readiness-pill {
      display: inline-block;
      padding: 0.18rem 0.55rem;
      border-radius: 999px;
      background: #fee2e2;
      color: #b91c1c;
      font-size: 0.72rem;
      font-weight: 700;
    }
    .org-chart-readiness-pill-ready-now { background: rgba(34, 197, 94, 0.16); color: #15803d; }
    .org-chart-readiness-pill-1-2-years { background: rgba(245, 158, 11, 0.18); color: #b45309; }
    .org-chart-readiness-pill-3-plus-years { background: rgba(56, 189, 248, 0.18); color: #0369a1; }
    .org-chart-readiness-pill-none { background: #fee2e2; color: #b91c1c; }
    .org-chart-readiness-pill-sm { font-size: 0.68rem; padding: 0.12rem 0.45rem; }

    .org-chart-successor-list {
      list-style: none;
      margin: 0.6rem 0 0;
      padding: 0.55rem 0 0;
      border-top: 1px dashed rgba(148, 163, 184, 0.4);
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .org-chart-successor-list li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      font-size: 0.78rem;
      color: #334155;
    }

    .org-chart-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(148, 163, 184, 0.24);
    }
    .org-chart-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.78rem;
      color: #475569;
    }
    .org-chart-legend-swatch { width: 10px; height: 10px; border-radius: 3px; }
    .org-chart-legend-swatch-ready-now { background: #22c55e; }
    .org-chart-legend-swatch-1-2-years { background: #f59e0b; }
    .org-chart-legend-swatch-3-plus-years { background: #38bdf8; }
    .org-chart-legend-swatch-none { background: #ef4444; }

    .admin-settings-menu-item-status {
      color: #173446;
      font-size: 0.82rem;
      font-weight: 700;
    }

    .admin-settings-back-btn {
      justify-self: start;
      margin-bottom: 1rem;
    }

    .admin-settings-section-detail {
      display: grid;
      gap: 0.75rem;
    }

    .admin-settings-hint {
      margin: 0;
      padding: 0.75rem 0.9rem;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 10px;
      background: #f8fbff;
      color: #475569;
      font-size: 0.85rem;
      line-height: 1.5;
    }

    .admin-settings-hint code {
      padding: 0.1rem 0.35rem;
      border-radius: 6px;
      background: rgba(15, 23, 42, 0.06);
      font-size: 0.82rem;
    }

    .admin-settings-item-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      min-width: 0;
    }

    .admin-settings-item-controls-stack {
      align-items: stretch;
      justify-content: flex-start;
      flex-wrap: wrap;
    }

    .admin-settings-field {
      display: grid;
      gap: 0.45rem;
      min-width: min(100%, 18rem);
      color: #173446;
      font-size: 0.82rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .admin-settings-field select {
      width: 100%;
      padding: 0.65rem 0.8rem;
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 10px;
      background: #fff;
      color: #173446;
      box-sizing: border-box;
      outline: none;
      font: inherit;
      font-weight: 700;
      text-transform: none;
      letter-spacing: normal;
    }

    .admin-settings-field select:focus {
      border-color: var(--admin-secondary);
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.14);
    }

    .admin-bulk-upload-template-field {
      min-width: min(100%, 16rem);
    }

    .admin-bulk-upload-template-field span {
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .admin-theme-selection-summary {
      display: grid;
      gap: 0.55rem;
      min-width: min(100%, 18rem);
      padding: 0.7rem 0.85rem;
      border-radius: 10px;
      background: #fbfdff;
      border: 1px solid rgba(148, 163, 184, 0.16);
    }

    .admin-report-filter-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.85rem;
    }

    .admin-report-filter-field {
      display: grid;
      gap: 0.45rem;
      color: #173446;
      font-size: 0.84rem;
      font-weight: 700;
    }

    .admin-report-filter-field span {
      color: #64748b;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .admin-report-filter-field input,
    .admin-report-filter-field select {
      width: 100%;
      padding: 0.6rem 0.75rem;
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 10px;
      background: #fff;
      color: #173446;
      box-sizing: border-box;
      outline: none;
      font: inherit;
    }

    .admin-report-filter-field input:focus,
    .admin-report-filter-field select:focus {
      border-color: var(--admin-secondary);
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.14);
    }

    .admin-report-download-field {
      min-width: min(100%, 10rem);
    }

    .admin-progress-row {
      display: grid;
      gap: 0.45rem;
    }

    .admin-progress-meta {
      justify-content: space-between;
    }

    .admin-progress-track {
      height: 0.72rem;
      border-radius: 999px;
      background: rgba(15, 118, 110, 0.12);
      overflow: hidden;
    }

    .admin-progress-track-muted {
      background: rgba(148, 163, 184, 0.16);
    }

    .admin-progress-track-alt {
      background: rgba(56, 189, 248, 0.12);
    }

    .admin-progress-fill {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--admin-primary), var(--admin-secondary));
      transition: width 0.4s ease;
    }

    .admin-progress-fill-muted {
      background: linear-gradient(90deg, #94a3b8, #64748b);
    }

    .admin-progress-fill-alt {
      background: linear-gradient(90deg, var(--admin-secondary), var(--admin-primary));
    }

    .admin-status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.65rem 0.8rem;
      border-radius: 10px;
      background: #f8fbff;
      border: 1px solid rgba(148, 163, 184, 0.16);
    }

    .admin-status-dot {
      width: 0.72rem;
      height: 0.72rem;
      border-radius: 999px;
      display: inline-flex;
      flex: 0 0 auto;
    }

    /* Overall performance gauge — bands are fixed value zones on the 1–5 KPI rating scale
       (< 2.5 rounds to 2, 2.5–3.5 rounds to 3, >= 3.5 rounds to 4 or 5), not proportional to the
       band's own employee count — the legend counts carry that instead, since packing both onto
       the arc geometry would make it lie about where the average actually sits on the scale.
       The card replays its pop-in every time the admin (re)opens the Dashboard tab: the outer
       @if in the template destroys and recreates this whole subtree on each visit, which is what
       lets a CSS animation (auto-plays from 0% on insertion) restart for free, while the bands/
       value/marker additionally wait for dashboardGaugeReady() before their transition fires —
       see the effect that drives that signal. */
    @keyframes admin-gauge-card-pop {
      0% { opacity: 0; transform: translateY(10px) scale(0.96); }
      60% { opacity: 1; transform: translateY(-2px) scale(1.015); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    .admin-gauge-card {
      background: linear-gradient(165deg, rgba(224, 242, 254, 0.55) 0%, rgba(255, 255, 255, 0.98) 55%);
      animation: admin-gauge-card-pop 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .admin-gauge-body {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      flex-wrap: wrap;
    }

    .admin-gauge-svg {
      width: 220px;
      height: auto;
      flex: 0 0 auto;
      filter: drop-shadow(0 6px 10px rgba(15, 23, 42, 0.08));
      overflow: visible;
    }

    .admin-gauge-band-track {
      fill: none;
      stroke: #eef0f3;
      stroke-width: 22;
      stroke-linecap: round;
    }

    .admin-gauge-band {
      fill: none;
      stroke-width: 22;
      stroke-linecap: round;
    }

    .admin-gauge-band-critical {
      stroke: #d03b3b;
      stroke-dasharray: 112;
      stroke-dashoffset: 112;
      transition: stroke-dashoffset 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.05s;
    }

    .admin-gauge-band-serious {
      stroke: #ec835a;
      stroke-dasharray: 74;
      stroke-dashoffset: 74;
      transition: stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.18s;
    }

    .admin-gauge-band-good {
      stroke: #0ca30c;
      stroke-dasharray: 112;
      stroke-dashoffset: 112;
      transition: stroke-dashoffset 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.3s;
    }

    .admin-gauge-band-ready {
      stroke-dashoffset: 0;
    }

    @keyframes admin-gauge-marker-pop {
      0% { opacity: 0; transform: scale(0.3); }
      65% { opacity: 1; transform: scale(1.25); }
      100% { opacity: 1; transform: scale(1); }
    }

    /* A plain dot at (cx, cy) rather than a rotated needle — see performanceGaugeMarker above for
       why. stroke/stroke-width give it a white ring so it stays visible sitting on top of any band
       colour; the scale animation is on transform, not r, so it can't shift the dot off its (cx,
       cy) position the way animating the needle's rotation used to shift its pivot. */
    .admin-gauge-marker {
      stroke: #ffffff;
      stroke-width: 2.5;
      filter: drop-shadow(0 1px 3px rgba(15, 23, 42, 0.35));
      opacity: 0;
      transform-box: fill-box;
      transform-origin: center;
    }

    .admin-gauge-marker-ready {
      animation: admin-gauge-marker-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.85s both;
    }

    @keyframes admin-gauge-value-pop {
      0% { opacity: 0; transform: scale(0.55); }
      65% { opacity: 1; transform: scale(1.12); }
      100% { opacity: 1; transform: scale(1); }
    }

    .admin-gauge-value {
      font-size: 1.9rem;
      font-weight: 800;
      fill: #0f172a;
      opacity: 0;
      transform-box: fill-box;
      transform-origin: center;
    }

    .admin-gauge-value-ready {
      animation: admin-gauge-value-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.55s both;
    }

    .admin-gauge-value-caption {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      fill: #898781;
    }

    .admin-gauge-scale-label {
      font-size: 0.78rem;
      font-weight: 700;
      fill: #52514e;
    }

    .admin-gauge-legend {
      display: grid;
      gap: 0.55rem;
      flex: 1 1 220px;
      min-width: 220px;
    }

    @keyframes admin-gauge-legend-row-in {
      0% { opacity: 0; transform: translateX(-6px); }
      100% { opacity: 1; transform: translateX(0); }
    }

    .admin-gauge-legend-row {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      animation: admin-gauge-legend-row-in 0.45s ease-out both;
    }

    .admin-gauge-legend-row:nth-child(1) { animation-delay: 0.15s; }
    .admin-gauge-legend-row:nth-child(2) { animation-delay: 0.28s; }
    .admin-gauge-legend-row:nth-child(3) { animation-delay: 0.41s; }

    .admin-gauge-legend-dot {
      width: 0.72rem;
      height: 0.72rem;
      border-radius: 999px;
      flex: 0 0 auto;
    }

    .admin-gauge-legend-dot-critical { background: #d03b3b; }
    .admin-gauge-legend-dot-serious { background: #ec835a; }
    .admin-gauge-legend-dot-good { background: #0ca30c; }

    .admin-gauge-legend-text {
      flex: 1 1 auto;
      font-size: 0.85rem;
      color: #52514e;
    }

    .admin-gauge-legend-text strong {
      color: #0f172a;
    }

    .admin-gauge-legend-count {
      font-weight: 800;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }

    .admin-gauge-empty-note {
      margin: 0.2rem 0 0;
      font-size: 0.8rem;
      color: #898781;
    }

    @media (prefers-reduced-motion: reduce) {
      .admin-gauge-card,
      .admin-gauge-legend-row,
      .admin-gauge-value-ready {
        animation: none;
      }

      .admin-gauge-band-critical,
      .admin-gauge-band-serious,
      .admin-gauge-band-good {
        transition: none;
      }

      .admin-gauge-value {
        opacity: 1;
      }
    }

    .admin-search-field {
      display: grid;
      gap: 0.45rem;
      min-width: min(100%, 28rem);
      color: #173446;
      font-size: 0.92rem;
      font-weight: 700;
    }

    .admin-single-user-hint {
      margin: 0;
      color: #475569;
      font-size: 0.86rem;
      line-height: 1.5;
    }

    .admin-single-user-actions {
      justify-content: flex-start;
    }

    .admin-bulk-upload-panel {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 0.85rem;
      padding: 0.85rem;
      border-radius: 12px;
      background: #f8fbff;
      border: 1px solid rgba(148, 163, 184, 0.18);
    }

    .admin-bulk-upload-title {
      color: #173446;
      font-size: 1rem;
      font-weight: 800;
    }

    .admin-bulk-upload-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .admin-upload-feedback {
      margin-bottom: 1rem;
      padding: 0.6rem 0.85rem;
      border-radius: 10px;
      background: rgba(16, 185, 129, 0.12);
      color: #047857;
      font-size: 0.9rem;
      font-weight: 700;
    }

    .admin-upload-feedback-error {
      background: rgba(239, 68, 68, 0.12);
      color: #b91c1c;
    }

    /* User Management's three toolbar CTAs (Download template / Upload users file / Add user)
       all read as one matched set: same compact size, and Upload users file/Add user both take on
       Download template's plain secondary look (white, bordered, no gradient/icon) instead of
       their app-wide default primary/gradient styling. Scoped to this one toolbar — every other
       .admin-upload-btn / .admin-primary-btn elsewhere in the admin app is untouched. */
    .admin-bulk-upload-actions .admin-secondary-btn,
    .admin-bulk-upload-actions .admin-upload-btn {
      min-height: 2.3rem;
      padding: 0.5rem 0.85rem;
      font-size: 0.85rem;
    }

    .admin-bulk-upload-actions .admin-upload-btn {
      background: #ffffff;
      color: #173446;
      border-color: rgba(148, 163, 184, 0.32);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }

    .admin-bulk-upload-actions .admin-upload-btn:hover,
    .admin-bulk-upload-actions .admin-upload-btn:focus-within {
      border-color: rgba(56, 189, 248, 0.32);
      box-shadow: 0 3px 10px rgba(15, 23, 42, 0.1);
    }

    .admin-upload-issues {
      margin-bottom: 0.85rem;
      padding: 0.85rem;
      border-radius: 10px;
      border: 1px solid rgba(239, 68, 68, 0.18);
      background: #fff7f7;
      color: #7f1d1d;
    }

    .admin-upload-issues-title {
      font-size: 0.95rem;
      font-weight: 800;
    }

    .admin-upload-issues-copy {
      margin-top: 0.3rem;
      font-size: 0.88rem;
    }

    .admin-upload-issues-list {
      margin: 0.8rem 0 0;
      padding-left: 1.2rem;
      display: grid;
      gap: 0.45rem;
      font-size: 0.9rem;
    }

    .admin-chip-row {
      justify-content: flex-end;
    }

    .admin-report-preview-meta {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      flex-wrap: wrap;
      font-size: 0.82rem;
    }

    .admin-report-note {
      margin: 0;
      padding: 0.65rem 0.9rem;
      border-radius: 12px;
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.18);
      font-size: 0.82rem;
      color: #334155;
      line-height: 1.45;
    }

    .admin-report-note-compact {
      margin-top: 0.75rem;
      padding: 0.5rem 0.75rem;
      font-size: 0.76rem;
    }

    .admin-field-hint {
      display: block;
      margin-top: 0.3rem;
      font-size: 0.78rem;
      color: #64748b;
    }

    .admin-report-table-wrap {
      overflow-x: auto;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      background: #fbfdff;
    }

    .admin-report-table {
      width: 100%;
      min-width: 720px;
      border-collapse: collapse;
    }

    .admin-report-table th,
    .admin-report-table td {
      padding: 0.55rem 0.7rem;
      text-align: left;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      color: #173446;
      font-size: 0.82rem;
      white-space: nowrap;
    }

    .admin-report-table th {
      position: sticky;
      top: 0;
      background: #f8fbff;
      color: #64748b;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      z-index: 1;
    }

    .admin-report-builder-grid-stack .admin-chip {
      padding: 0.35rem 0.62rem;
      font-size: 0.72rem;
    }

    /* Report-panel action buttons (Download report, Clear filters, Back to ATR/WSP, etc.) match
       User Management's toolbar size (2.3rem) rather than the app-wide 2.6rem default — same
       sizing values as .admin-bulk-upload-actions above, kept as separate scoped rules since the
       two toolbars are unrelated sections. Primary/secondary colors are untouched here (Download
       report stays the gradient CTA, Clear filters/Back stay the bordered look) — only size
       changed, unlike the User Management toolbar where the look was unified too. */
    .admin-report-actions .admin-primary-btn,
    .admin-report-actions .admin-secondary-btn,
    .admin-report-actions .admin-upload-btn {
      min-height: 2.3rem;
      padding: 0.5rem 0.85rem;
      font-size: 0.85rem;
    }

    .admin-report-table tbody tr:last-child td {
      border-bottom: none;
    }

    .admin-chip,
    .admin-status-pill,
    .admin-access-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      font-size: 0.79rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .admin-chip {
      padding: 0.42rem 0.72rem;
      background: rgba(56, 189, 248, 0.12);
      color: #0f4c81;
    }

    .admin-user-table-wrap {
      display: grid;
      gap: 0.7rem;
    }

    .admin-user-table {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 1fr);
      gap: 0.75rem;
      align-items: center;
    }

    .admin-user-table-head {
      padding: 0 0.2rem;
      color: #64748b;
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .admin-user-row {
      padding: 0.7rem 0.85rem;
      border-radius: 10px;
      background: #fbfdff;
      border: 1px solid rgba(148, 163, 184, 0.16);
    }

    .admin-user-cell {
      min-width: 0;
      color: #173446;
      font-size: 0.92rem;
    }

    .admin-user-field-label {
      display: none;
      margin-bottom: 0.25rem;
    }

    .admin-user-email {
      font-size: 0.86rem;
      overflow-wrap: anywhere;
    }

    .admin-logo-panel {
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .admin-logo-actions {
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      gap: 0.5rem;
      min-width: 9rem;
    }

    .admin-logo-actions .admin-upload-btn,
    .admin-logo-actions .admin-secondary-btn {
      width: 100%;
    }

    .admin-upload-btn {
      position: relative;
      overflow: hidden;
      cursor: pointer;
    }

    .admin-upload-btn-disabled {
      opacity: 0.6;
      cursor: not-allowed;
      pointer-events: none;
    }

    .admin-upload-btn input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }

    .admin-theme-swatches {
      justify-content: flex-start;
      gap: 0.4rem;
    }

    .admin-theme-swatches span {
      width: 1.2rem;
      height: 1.2rem;
      border-radius: 999px;
      display: inline-flex;
      border: 1px solid rgba(255, 255, 255, 0.55);
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
    }

    .admin-welcome-banner {
      position: fixed;
      top: calc(1rem * var(--ui-scale));
      left: 50%;
      z-index: 150;
      width: min(calc(360px * var(--ui-scale)), calc(100vw - 2rem));
      padding: calc(0.85rem * var(--ui-scale)) calc(1.1rem * var(--ui-scale));
      border: 1px solid rgba(56, 189, 248, 0.18);
      border-radius: calc(14px * var(--ui-scale));
      background: linear-gradient(135deg, var(--admin-primary), var(--admin-secondary));
      box-shadow: 0 8px 22px rgba(79, 70, 229, 0.22);
      color: #fff;
      text-align: center;
      transform: translate(-50%, -120%);
      opacity: 0;
      animation: admin-welcome-banner-drop 0.6s cubic-bezier(0.2, 0.9, 0.2, 1) forwards;
      pointer-events: none;
    }

    .admin-welcome-banner-leaving {
      animation: admin-welcome-banner-exit 0.45s ease forwards;
    }

    .admin-welcome-banner-title {
      font-size: calc(1rem * var(--ui-scale));
      font-weight: 800;
      letter-spacing: 0.01em;
    }

    .admin-welcome-banner-copy {
      margin-top: calc(0.2rem * var(--ui-scale));
      font-size: calc(0.86rem * var(--ui-scale));
      color: rgba(255, 255, 255, 0.88);
    }

    @keyframes admin-welcome-banner-drop {
      0% {
        transform: translate(-50%, -120%);
        opacity: 0;
      }

      100% {
        transform: translate(-50%, 0);
        opacity: 1;
      }
    }

    @keyframes admin-welcome-banner-exit {
      0% {
        transform: translate(-50%, 0);
        opacity: 1;
      }

      100% {
        transform: translate(-50%, -60%);
        opacity: 0;
      }
    }

    @media (max-width: 1120px) {
      .admin-dashboard-grid,
      .admin-dashboard-top-grid,
      .admin-snapshot-grid,
      .admin-report-builder-grid {
        grid-template-columns: 1fr 1fr;
      }

    }

    @media (max-width: 960px) {
      .admin-layout {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1rem;
        align-items: start;
        min-height: auto;
      }

      .admin-layout.admin-layout-sidebar-collapsed {
        grid-template-columns: 1fr;
      }

      .admin-sidebar {
        position: static;
        width: 100%;
        height: auto;
      }

      .admin-sidebar-header {
        justify-content: center;
      }

      .admin-sidebar-collapsed {
        padding-inline: calc(1rem * var(--ui-scale));
      }

      .admin-sidebar-collapsed button {
        justify-content: flex-start;
      }

      .admin-sidebar-collapsed .admin-nav-label {
        display: inline;
      }

      .admin-user-table,
      .admin-user-table-head {
        grid-template-columns: 1fr;
      }

      .admin-user-table-head {
        display: none;
      }

      .admin-user-field-label {
        display: block;
      }

      .admin-user-actions-cell {
        justify-self: stretch;
      }

      .admin-report-menu-card,
      .admin-report-menu-card-primary {
        max-width: 100%;
      }
    }

    @media (max-width: 720px) {
      .admin-topbar,
      .admin-section-card-header,
      .admin-toolbar,
      .admin-logo-panel,
      .admin-logo-actions,
      .admin-bulk-upload-panel,
      .admin-report-actions,
      .admin-form-actions {
        flex-direction: column;
        align-items: flex-start;
      }

      .admin-profile-meta-grid,
      .admin-metric-grid,
      .admin-dashboard-grid,
      .admin-dashboard-top-grid,
      .admin-snapshot-grid,
      .admin-report-builder-grid,
      .admin-edit-form,
      .admin-report-filter-grid {
        grid-template-columns: 1fr;
      }

      .admin-settings-item-controls,
      .admin-settings-item-controls-stack {
        flex-direction: column;
        align-items: flex-start;
      }

      .admin-settings-field,
      .admin-theme-selection-summary {
        min-width: 100%;
      }

      .admin-chip-row {
        justify-content: flex-start;
      }

      .admin-search-field {
        min-width: 100%;
      }
    }
  `,
  // ── Relocated from training-manager-profile.component.ts (Courses/Enrollment move) ──
  // Full stylesheet duplicated verbatim rather than cherry-picked: the moved Courses
  // (and later Enrollment) markup reuses this file's entire shared design system
  // (.manager-panel/.activity-card/.form-grid/.detail-action-btn/.mentorship-review-*
  // etc., not just courses-exclusive classes), and Angular's per-component style
  // encapsulation makes duplicating it here risk-free — there is no collision with
  // this file's own .admin-* styles above. A trim pass to drop the classes never
  // actually used once Courses+Enrollment templates are both in place is a reasonable
  // later cleanup, not required for correctness.
  `

    .manager-shell {
      position: relative;
      isolation: isolate;
      min-height: 100vh;
      padding: calc(1rem * var(--ui-scale));
      box-sizing: border-box;
      background:
        radial-gradient(circle at top left, var(--brand-tint), transparent 20%),
        linear-gradient(180deg, #f6f8fc 0%, var(--brand-surface) 100%);
    }

    .manager-topbar,
    .manager-sidebar,
    .manager-panel,
    .stat-card,
    .activity-card,
    .course-form-card,
    .course-list-card,
    .offering-card,
    .student-card {
      border: 1px solid rgba(15, 23, 42, 0.07);
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03), 0 4px 14px rgba(15, 23, 42, 0.045);
    }

    .manager-topbar {
      position: sticky;
      top: calc(1rem * var(--ui-scale));
      z-index: 70;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: calc(1rem * var(--ui-scale));
      margin-bottom: calc(1rem * var(--ui-scale));
      padding: calc(0.9rem * var(--ui-scale)) calc(1.2rem * var(--ui-scale));
      border-radius: calc(22px * var(--ui-scale));
      background: linear-gradient(180deg, var(--brand-tint) 0%, rgba(255, 255, 255, 0.92) 70%);
      border-bottom: 3px solid var(--brand-primary);
    }

    .manager-welcome-banner {
      position: fixed;
      top: calc(1rem * var(--ui-scale));
      left: 50%;
      z-index: 150;
      width: min(calc(360px * var(--ui-scale)), calc(100vw - 2rem));
      padding: calc(0.95rem * var(--ui-scale)) calc(1.2rem * var(--ui-scale));
      border: 1px solid rgba(129, 140, 248, 0.18);
      border-radius: calc(20px * var(--ui-scale));
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      box-shadow: 0 20px 40px rgba(79, 70, 229, 0.24);
      color: #fff;
      text-align: center;
      transform: translate(-50%, -120%);
      opacity: 0;
      animation: manager-welcome-banner-drop 0.6s cubic-bezier(0.2, 0.9, 0.2, 1) forwards;
      pointer-events: none;
    }

    .manager-welcome-banner-leaving {
      animation: manager-welcome-banner-exit 0.45s ease forwards;
    }

    .manager-welcome-banner-title {
      font-size: calc(1rem * var(--ui-scale));
      font-weight: 800;
      letter-spacing: 0.01em;
    }

    .manager-welcome-banner-copy {
      margin-top: calc(0.2rem * var(--ui-scale));
      font-size: calc(0.86rem * var(--ui-scale));
      color: rgba(255, 255, 255, 0.88);
    }

    @keyframes manager-welcome-banner-drop {
      0% {
        transform: translate(-50%, -120%);
        opacity: 0;
      }
      60% {
        transform: translate(-50%, 6%);
        opacity: 1;
      }
      100% {
        transform: translate(-50%, 0);
        opacity: 1;
      }
    }

    @keyframes manager-welcome-banner-exit {
      0% {
        transform: translate(-50%, 0);
        opacity: 1;
      }
      100% {
        transform: translate(-50%, -120%);
        opacity: 0;
      }
    }

    .manager-brand-block,
    .manager-topbar-user {
      display: flex;
      align-items: center;
      gap: calc(0.9rem * var(--ui-scale));
    }

    .manager-topbar-user {
      gap: calc(0.55rem * var(--ui-scale));
    }

    .manager-topbar-dropdown-wrap {
      position: relative;
      z-index: 35;
    }

    .manager-icon-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: calc(2.8rem * var(--ui-scale));
      height: calc(2.8rem * var(--ui-scale));
      border: 1px solid var(--brand-tint);
      border-radius: calc(16px * var(--ui-scale));
      background: var(--brand-surface);
      color: #64748b;
      cursor: pointer;
      transition: box-shadow 0.15s ease, background 0.15s ease;
    }

    .manager-icon-btn-active {
      border-color: var(--brand-secondary);
      background: var(--brand-tint);
    }

    .manager-icon-btn:hover,
    .manager-icon-btn:focus-visible {
      outline: none;
      background: var(--brand-tint);
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
    }

    .manager-icon-counter {
      position: absolute;
      top: calc(-0.2rem * var(--ui-scale));
      right: calc(-0.2rem * var(--ui-scale));
      min-width: calc(1.15rem * var(--ui-scale));
      height: calc(1.15rem * var(--ui-scale));
      padding: 0 calc(0.25rem * var(--ui-scale));
      border-radius: 999px;
      background: #ef4444;
      color: #fff;
      font-size: calc(0.72rem * var(--ui-scale));
      font-weight: 800;
      line-height: calc(1.15rem * var(--ui-scale));
      text-align: center;
      box-shadow: 0 6px 12px rgba(239, 68, 68, 0.25);
    }

    .manager-topbar-profile-btn {
      display: inline-flex;
      align-items: center;
      gap: calc(0.7rem * var(--ui-scale));
      min-height: calc(2.8rem * var(--ui-scale));
      padding: calc(0.25rem * var(--ui-scale)) calc(0.4rem * var(--ui-scale)) calc(0.25rem * var(--ui-scale)) calc(0.25rem * var(--ui-scale));
      border: 1px solid transparent;
      border-radius: 999px;
      background: transparent;
      color: #475569;
      text-align: left;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .manager-topbar-profile-btn:hover,
    .manager-topbar-profile-btn:focus-visible {
      outline: none;
      background: var(--brand-surface);
      border-color: var(--brand-tint);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
    }

    .manager-topbar-profile-copy {
      display: inline-flex;
      flex-direction: column;
      gap: 0;
    }

    .manager-topbar-preview-panel {
      position: absolute;
      top: calc(100% + calc(0.75rem * var(--ui-scale)));
      right: 0;
      z-index: 40;
      width: min(17rem, calc(100vw - 2rem));
      padding: calc(0.4rem * var(--ui-scale)) 0;
      border-radius: calc(12px * var(--ui-scale));
      border: 1px solid var(--brand-tint);
      background: #ffffff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
      overflow: hidden;
    }

    .manager-topbar-preview-title {
      display: grid;
      gap: calc(0.2rem * var(--ui-scale));
      padding: calc(0.7rem * var(--ui-scale)) calc(0.85rem * var(--ui-scale)) calc(0.8rem * var(--ui-scale));
      font-weight: 700;
      color: var(--brand-primary);
      font-size: calc(0.94rem * var(--ui-scale));
    }

    .manager-topbar-preview-empty {
      color: #64748b;
      font-size: calc(0.82rem * var(--ui-scale));
      padding: calc(0.2rem * var(--ui-scale)) calc(0.85rem * var(--ui-scale)) calc(0.6rem * var(--ui-scale));
    }

    .manager-topbar-preview-item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: calc(0.18rem * var(--ui-scale));
      width: calc(100% - calc(0.76rem * var(--ui-scale)));
      margin: 0 calc(0.38rem * var(--ui-scale));
      border: none;
      border-radius: calc(12px * var(--ui-scale));
      background: transparent;
      color: #475569;
      text-align: left;
      padding: calc(0.58rem * var(--ui-scale)) calc(0.62rem * var(--ui-scale));
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .manager-topbar-preview-item strong {
      width: 100%;
      font-size: calc(0.9rem * var(--ui-scale));
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .manager-topbar-preview-item span {
      width: 100%;
      font-size: calc(0.8rem * var(--ui-scale));
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .manager-topbar-preview-item small {
      width: 100%;
      font-size: calc(0.72rem * var(--ui-scale));
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .manager-topbar-preview-item:hover,
    .manager-topbar-preview-item:focus-visible {
      outline: none;
      background: var(--brand-tint);
      color: var(--brand-primary);
    }

    .manager-topbar-preview-link {
      width: calc(100% - calc(0.76rem * var(--ui-scale)));
      margin: calc(0.25rem * var(--ui-scale)) calc(0.38rem * var(--ui-scale)) 0;
      padding: calc(0.55rem * var(--ui-scale)) calc(0.62rem * var(--ui-scale));
      border: none;
      border-top: 1px solid var(--brand-tint);
      border-radius: calc(12px * var(--ui-scale));
      background: transparent;
      color: #475569;
      font-weight: 600;
      text-align: left;
      font-size: calc(0.9rem * var(--ui-scale));
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .manager-topbar-preview-link:hover,
    .manager-topbar-preview-link:focus-visible {
      outline: none;
      background: var(--brand-tint);
      color: var(--brand-primary);
    }

    .manager-topbar-menu {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      z-index: 40;
      min-width: calc(13rem * var(--ui-scale));
      display: grid;
      gap: calc(0.2rem * var(--ui-scale));
      border: 1px solid var(--brand-tint);
      border-radius: calc(12px * var(--ui-scale));
      background: #ffffff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
      padding: calc(0.35rem * var(--ui-scale));
    }

    .manager-topbar-caret {
      color: #94a3b8;
      flex-shrink: 0;
    }

    .manager-topbar-menu-item {
      border: none;
      border-radius: calc(12px * var(--ui-scale));
      background: transparent;
      color: #0f172a;
      text-align: left;
      font-weight: 600;
      font-size: calc(0.9rem * var(--ui-scale));
      padding: calc(0.6rem * var(--ui-scale)) calc(0.85rem * var(--ui-scale));
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .manager-topbar-menu-item:hover,
    .manager-topbar-menu-item:focus-visible {
      outline: none;
      background: var(--brand-tint);
      color: var(--brand-primary);
    }

    .manager-topbar-menu-item-danger {
      color: #b91c1c;
    }

    .manager-topbar-menu-item-danger:hover,
    .manager-topbar-menu-item-danger:focus-visible {
      background: rgba(185, 28, 28, 0.1);
      color: #991b1b;
    }

    .manager-topbar-menu-item {
      display: flex;
      align-items: center;
      gap: calc(0.55rem * var(--ui-scale));
    }

    .manager-topbar-menu-divider {
      height: 1px;
      background: var(--brand-tint);
      margin: calc(0.2rem * var(--ui-scale)) calc(0.6rem * var(--ui-scale));
    }

    .manager-topbar-menu-section-label {
      padding: calc(0.35rem * var(--ui-scale)) calc(0.85rem * var(--ui-scale)) calc(0.1rem * var(--ui-scale));
      font-size: calc(0.72rem * var(--ui-scale));
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #94a3b8;
    }

    .manager-topbar-profile-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .manager-topbar-menu-backdrop {
      position: fixed;
      inset: 0;
      z-index: 19;
      border: none;
      background: transparent;
      padding: 0;
      margin: 0;
      cursor: default;
    }

    .manager-brand-mark,
    .manager-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: calc(2.6rem * var(--ui-scale));
      height: calc(2.6rem * var(--ui-scale));
      border-radius: calc(16px * var(--ui-scale));
      color: #fff;
      font-weight: 800;
      letter-spacing: 0.03em;
    }

    .manager-brand-mark {
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      overflow: hidden;
    }

    .manager-avatar {
      width: calc(2.25rem * var(--ui-scale));
      height: calc(2.25rem * var(--ui-scale));
      border-radius: 999px;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      flex: 0 0 auto;
      font-size: calc(0.88rem * var(--ui-scale));
      overflow: hidden;
    }

    .manager-avatar-has-image {
      background: #fff;
      border: 1px solid rgba(148, 163, 184, 0.22);
    }

    .manager-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .manager-brand-name,
    .manager-user-name,
    .stat-value,
    .offering-title {
      margin: 0;
    }

    .manager-brand-name,
    .manager-user-name {
      font-size: calc(1.02rem * var(--ui-scale));
      font-weight: 800;
    }

    .manager-user-name {
      max-width: calc(11rem * var(--ui-scale));
      color: #475569;
      font-size: calc(0.98rem * var(--ui-scale));
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .manager-brand-copy,
    .manager-user-copy,
    .section-copy,
    .stat-detail,
    .offering-copy,
    .student-copy,
    .success-copy {
      color: #5b7080;
      line-height: 1.55;
    }

    .manager-field-error {
      display: block;
      color: #dc2626;
      font-size: 0.85rem;
      font-weight: 500;
      margin-top: 0.25rem;
    }

    .manager-field-hint {
      display: block;
      color: #64748b;
      font-size: 0.85rem;
      margin-top: 0.25rem;
    }

    .manager-layout {
      display: grid;
      grid-template-columns: calc(296px * var(--ui-scale)) minmax(0, 1fr);
      gap: calc(1rem * var(--ui-scale));
      align-items: start;
    }

    .manager-layout.manager-layout-sidebar-collapsed {
      grid-template-columns: calc(96px * var(--ui-scale)) minmax(0, 1fr);
    }

    .manager-sidebar {
      position: sticky;
      top: var(--sidebar-stack-offset);
      display: flex;
      flex-direction: column;
      gap: calc(0.25rem * var(--ui-scale));
      align-self: start;
      height: calc(100vh - var(--sidebar-stack-offset) - calc(1rem * var(--ui-scale)));
      overflow: auto;
      padding: calc(0.6rem * var(--ui-scale));
      border-radius: calc(14px * var(--ui-scale));
      /* Tinted by the chosen theme rather than a flat fixed navy — same recipe as the admin
         sidebar (color-mix keeps it dark enough for white text/icons across every theme). */
      background: linear-gradient(180deg, color-mix(in srgb, var(--brand-primary) 32%, #12152f) 0%, color-mix(in srgb, var(--brand-primary) 16%, #12152f) 100%);
      border: 1px solid rgba(255, 255, 255, 0.06);
      box-shadow: 0 20px 45px rgba(8, 10, 26, 0.35);
      scrollbar-width: none;
      scrollbar-color: transparent transparent;
    }

    .manager-sidebar.manager-sidebar-scrolling {
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
    }

    .manager-sidebar::-webkit-scrollbar {
      width: 6px;
    }

    .manager-sidebar::-webkit-scrollbar-track {
      background: transparent;
    }

    .manager-sidebar::-webkit-scrollbar-thumb {
      background-color: transparent;
      border-radius: 999px;
      transition: background-color 0.3s ease;
    }

    .manager-sidebar.manager-sidebar-scrolling::-webkit-scrollbar-thumb {
      background-color: rgba(255, 255, 255, 0.25);
    }

    .manager-sidebar-header {
      display: flex;
      justify-content: center;
    }

    .manager-sidebar-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: calc(2.1rem * var(--ui-scale));
      height: calc(2.1rem * var(--ui-scale));
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: calc(10px * var(--ui-scale));
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.85);
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease, color 0.15s ease;
    }

    .manager-sidebar-toggle:hover,
    .manager-sidebar-toggle:focus-visible {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.3);
      outline: none;
      transform: translateY(-1px);
    }

    .manager-sidebar-toggle svg {
      width: calc(1rem * var(--ui-scale));
      height: calc(1rem * var(--ui-scale));
      stroke: currentColor;
    }

    .manager-sidebar button:not(.manager-sidebar-toggle),
    .assign-btn,
    .course-form button {
      border: none;
      cursor: pointer;
      font: inherit;
    }

    .manager-sidebar button:not(.manager-sidebar-toggle) {
      display: flex;
      align-items: center;
      gap: calc(0.6rem * var(--ui-scale));
      border-radius: calc(10px * var(--ui-scale));
      padding: calc(0.5rem * var(--ui-scale)) calc(0.7rem * var(--ui-scale));
      background: transparent;
      color: rgba(255, 255, 255, 0.68);
      text-align: left;
      font-size: calc(0.88rem * var(--ui-scale));
      font-weight: 700;
      transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease;
    }

    .manager-nav-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 calc(1.9rem * var(--ui-scale));
      width: calc(1.9rem * var(--ui-scale));
      height: calc(1.9rem * var(--ui-scale));
      border-radius: calc(9px * var(--ui-scale));
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: currentColor;
      flex-shrink: 0;
      transition: background 0.18s ease, color 0.18s ease;
    }

    .manager-nav-icon svg {
      display: block;
      width: calc(1rem * var(--ui-scale));
      height: calc(1rem * var(--ui-scale));
    }

    .manager-nav-label {
      min-width: 0;
    }

    .manager-sidebar-collapsed {
      gap: calc(0.35rem * var(--ui-scale));
      padding-inline: calc(0.5rem * var(--ui-scale));
    }

    .manager-sidebar-collapsed .manager-sidebar-header {
      justify-content: center;
    }

    .manager-sidebar-collapsed button {
      justify-content: center;
      padding-inline: calc(0.5rem * var(--ui-scale));
    }

    .manager-sidebar-collapsed .manager-nav-label {
      display: none;
    }

    .manager-sidebar-collapsed .manager-nav-icon {
      flex-basis: calc(2.1rem * var(--ui-scale));
      width: calc(2.1rem * var(--ui-scale));
    }

    .manager-sidebar button:not(.manager-sidebar-toggle):hover,
    .manager-sidebar button:not(.manager-sidebar-toggle):focus-visible {
      background: rgba(255, 255, 255, 0.07);
      color: #fff;
      outline: none;
      transform: translateX(2px);
    }

    .manager-sidebar button:not(.manager-sidebar-toggle).active {
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      color: #fff;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
    }

    .manager-sidebar button:not(.manager-sidebar-toggle):hover .manager-nav-icon,
    .manager-sidebar button:not(.manager-sidebar-toggle):focus-visible .manager-nav-icon {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .manager-sidebar button:not(.manager-sidebar-toggle).active .manager-nav-icon {
      background: rgba(255, 255, 255, 0.18);
      border-color: rgba(255, 255, 255, 0.24);
    }

    .manager-sidebar button:not(.manager-sidebar-toggle).logout {
      margin-top: auto;
      background: rgba(248, 113, 113, 0.14);
      color: #fca5a5;
      border-color: rgba(248, 113, 113, 0.22);
    }

    .manager-sidebar button:not(.manager-sidebar-toggle).logout:hover,
    .manager-sidebar button:not(.manager-sidebar-toggle).logout:focus-visible {
      background: rgba(248, 113, 113, 0.24);
      color: #fecaca;
    }

    .manager-sidebar button:not(.manager-sidebar-toggle).logout .manager-nav-icon {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(248, 113, 113, 0.3);
      color: #fca5a5;
    }

    .manager-main-panel {
      min-width: 0;
    }

    .manager-panel {
      display: flex;
      flex-direction: column;
      gap: calc(1rem * var(--ui-scale));
      min-height: calc(100vh - 7rem);
      padding: calc(1.6rem * var(--ui-scale));
      border-radius: calc(24px * var(--ui-scale));
      box-sizing: border-box;
    }

    .published-offering-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      justify-content: flex-end;
      align-items: stretch;
      padding: 1rem;
    }

    .published-offering-overlay {
      z-index: 70;
    }

    .published-offering-overlay-backdrop {
      position: absolute;
      inset: 0;
      border: none;
      cursor: pointer;
    }

    .published-offering-overlay-backdrop {
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(3px);
    }

    .published-offering-overlay-panel {
      position: relative;
      z-index: 1;
      height: calc(100vh - 2rem);
      overflow: auto;
      animation: published-offering-panel-enter 0.26s ease-out;
    }

    .published-offering-overlay-panel {
      width: min(980px, 100%);
      border-radius: 16px;
      transform-origin: right center;
    }

    @keyframes published-offering-panel-enter {
      from {
        opacity: 0;
        transform: translateX(28px);
      }

      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    /* KPI table pops out into a large centered overlay instead of squeezing into the
       sidebar-constrained content column — a wide table needs room a narrow card can't give it. */
    .kpi-overlay {
      position: fixed;
      inset: 0;
      z-index: 80;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 1.5rem;
    }

    .kpi-overlay-backdrop {
      position: absolute;
      inset: 0;
      border: none;
      cursor: pointer;
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(3px);
    }

    .kpi-overlay-panel {
      position: relative;
      z-index: 1;
      width: min(1500px, 96vw);
      max-height: min(1000px, 92vh);
      overflow: auto;
      padding: 1.5rem;
      border-radius: 20px;
      background: #f8fafc;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
      animation: kpi-overlay-panel-enter 0.22s ease-out;
      box-sizing: border-box;
    }

    @keyframes kpi-overlay-panel-enter {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.98);
      }

      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .section-heading-block {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .eyebrow,
    .stat-label,
    .manager-summary-label,
    .student-assignment-label,
    .offering-type {
      color: #4f46e5;
      font-size: 0.82rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .dashboard-card-grid,
    .courses-layout {
      display: grid;
      gap: 1rem;
    }

    .dashboard-card-grid {
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }

    .courses-panel-shell {
      display: grid;
      gap: 1.1rem;
    }

    .courses-tab-nav {
      display: flex;
      gap: 1.5rem;
      align-items: center;
      padding: 0 0 0.2rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .courses-tab-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.1rem 0.1rem 0.9rem;
      border: none;
      background: transparent;
      color: #64748b;
      font: inherit;
      font-size: 0.98rem;
      font-weight: 700;
      cursor: pointer;
      transition: color 0.18s ease;
    }

    .courses-tab-btn::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 3px;
      border-radius: 999px;
      background: transparent;
      transition: background 0.18s ease;
    }

    .courses-tab-btn:hover,
    .courses-tab-btn:focus-visible {
      color: var(--brand-primary);
      outline: none;
    }

    .courses-tab-btn-active {
      color: var(--brand-primary);
    }

    .courses-tab-btn-active::after {
      background: var(--brand-primary);
    }

    .courses-tab-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #8b5cf6;
      flex: 0 0 auto;
    }

    .stat-card,
    .activity-card,
    .course-form-card,
    .course-list-card,
    .student-card {
      border-radius: 24px;
      padding: 1rem;
    }

    .stat-card {
      position: relative;
      overflow: hidden;
      transition: transform 0.18s cubic-bezier(.4,1.5,.5,1), box-shadow 0.18s cubic-bezier(.4,1.5,.5,1);
    }

    .stat-card:hover,
    .stat-card:focus-visible {
      transform: scale(1.06);
      box-shadow: 0 8px 32px rgba(79, 70, 229, 0.18), 0 2px 8px rgba(0,0,0,0.04);
      z-index: 2;
    }

    .stat-accent {
      position: absolute;
      inset: 0 auto auto 0;
      width: 100%;
      height: 4px;
    }

    .stat-value {
      margin-top: 0.45rem;
      font-size: 2rem;
      font-weight: 800;
      color: #173446;
    }

    .section-heading-row,
    .student-card-header,
    .enrollment-action-row,
    .offering-top-row,
    .offering-footer {
      display: flex;
      justify-content: space-between;
      gap: 0.85rem;
      align-items: center;
    }

    .activity-chart,
    .offering-list,
    .student-list,
    .course-form,
    .student-assignment-block {
      display: grid;
      gap: 1rem;
    }

    .course-builder-layout {
      grid-template-columns: 1fr;
      align-items: start;
      gap: 0.9rem;
    }

    .course-builder-stepper {
      position: sticky;
      top: 1rem;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.5rem;
      align-content: start;
      z-index: 2;
    }

    .course-step-btn {
      display: flex;
      gap: 0.65rem;
      align-items: center;
      width: 100%;
      padding: 0.68rem 0.72rem;
      border: 1px solid #dbe2ea;
      border-radius: 16px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      color: #334155;
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
    }

    .course-step-btn:hover,
    .course-step-btn:focus-visible {
      border-color: #a5b4fc;
      box-shadow: 0 10px 24px rgba(99, 102, 241, 0.12);
      outline: none;
    }

    .course-step-btn-active {
      border-color: #818cf8;
      background: linear-gradient(180deg, #eef2ff 0%, #ffffff 100%);
      box-shadow: 0 12px 28px rgba(99, 102, 241, 0.14);
    }

    .course-step-index {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.72rem;
      height: 1.72rem;
      border-radius: 999px;
      background: #e0e7ff;
      color: #4338ca;
      font-size: 0.76rem;
      font-weight: 800;
      flex: 0 0 auto;
    }

    .course-step-copy {
      display: grid;
      gap: 0.08rem;
      min-width: 0;
    }

    .course-step-copy strong {
      color: #173446;
      font-size: 0.86rem;
      line-height: 1.15;
    }

    .course-step-copy span {
      color: #64748b;
      font-size: 0.7rem;
      line-height: 1.15;
    }

    .course-builder-main {
      display: grid;
      gap: 0.8rem;
      align-content: start;
    }

    .form-section-card {
      border-radius: 18px;
      border: 1px solid #e2e8f0;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      padding: 0.82rem;
    }

    .form-section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .form-section-eyebrow {
      margin: 0 0 0.25rem;
      color: #4f46e5;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .form-section-header h3 {
      margin: 0;
      font-size: 0.96rem;
      line-height: 1.2;
      color: #173446;
    }

    .form-section-note,
    .field-hint,
    .form-action-copy,
    .asset-empty-state {
      color: #64748b;
      font-size: 0.8rem;
      line-height: 1.4;
    }

    .form-grid {
      display: grid;
      gap: 0.75rem;
    }

    .required-label {
      display: inline-flex;
      align-items: center;
      gap: 0.16rem;
    }

    .required-marker {
      color: #dc2626;
      font-weight: 800;
      line-height: 1;
    }

    .form-grid-span-two {
      grid-column: 1 / -1;
    }

    .doc-toggle-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }

    .doc-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.75rem;
      border: 1px solid rgba(148, 163, 184, 0.32);
      border-radius: 999px;
      background: #fff;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease;
    }

    .doc-toggle-active {
      border-color: var(--brand-primary);
      background: var(--brand-tint);
    }

    .doc-toggle-input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }

    .doc-toggle-track {
      position: relative;
      flex-shrink: 0;
      width: 2.1rem;
      height: 1.15rem;
      border-radius: 999px;
      background: #cbd5e1;
      transition: background 0.15s ease;
    }

    .doc-toggle-active .doc-toggle-track {
      background: var(--brand-primary);
    }

    .doc-toggle-thumb {
      position: absolute;
      top: 0.13rem;
      left: 0.13rem;
      width: 0.9rem;
      height: 0.9rem;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25);
      transition: transform 0.15s ease;
    }

    .doc-toggle-active .doc-toggle-thumb {
      transform: translateX(0.95rem);
    }

    .doc-toggle-input:focus-visible + .doc-toggle-track {
      outline: 2px solid var(--brand-primary);
      outline-offset: 2px;
    }

    .doc-toggle-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #173446;
    }

    .form-grid-two,
    .media-preview-grid {
      display: grid;
      gap: 0.75rem;
    }

    .form-grid-two,
    .media-preview-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .create-section-status-pill {
      padding: 0.18rem 0.45rem;
      border-radius: 999px;
      background: #eef2ff;
      color: #4f46e5;
      font-size: 0.68rem;
      font-weight: 800;
      line-height: 1.2;
      white-space: nowrap;
    }

    .summary-pill-grid,
    .summary-stat-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .field-hint,
    .field-error {
      display: block;
    }

    .field-hint-compact {
      font-size: 0.72rem;
      line-height: 1.2;
    }

    .field-error {
      color: #be123c;
      font-size: 0.76rem;
      font-weight: 700;
    }

    .content-item-type-display {
      display: flex;
      align-items: center;
      min-height: 3rem;
      padding: 0.72rem 0.9rem;
      border: 1px solid #dbe2ea;
      border-radius: 14px;
      background: #f8fafc;
      color: #173446;
      font-size: 0.92rem;
      font-weight: 700;
    }

    .upload-field input[type='file'] {
      padding: 0.62rem 0.72rem;
    }

    .asset-preview-card-compact {
      display: grid;
      gap: 0.8rem;
      min-height: 100%;
    }

    .asset-preview-header {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: center;
      color: #334155;
      font-size: 0.84rem;
      font-weight: 800;
    }

    .course-form-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.8rem;
      padding: 0.2rem 0;
    }

    .builder-step-actions {
      display: flex;
      gap: 0.55rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .builder-secondary-btn,
    .builder-submit-btn {
      min-width: 110px;
    }

    .builder-secondary-btn {
      background: #eef2ff;
      color: #4338ca;
      box-shadow: none;
    }

    .builder-secondary-btn:disabled {
      background: #e2e8f0;
      color: #94a3b8;
    }

    .builder-submit-btn {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
    }

    .detail-action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      min-height: 2.4rem;
      padding: 0.55rem 0.9rem;
      border: 1px solid rgba(148, 163, 184, 0.32);
      border-radius: 10px;
      background: #ffffff;
      color: #173446;
      font: inherit;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease;
    }

    .detail-action-btn:hover,
    .detail-action-btn:focus-visible {
      transform: translateY(-1px);
      border-color: var(--brand-secondary);
      box-shadow: 0 3px 10px rgba(15, 23, 42, 0.1);
      outline: none;
    }

    .detail-action-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .detail-action-btn-primary {
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      color: #fff;
      border-color: transparent;
      box-shadow: 0 2px 6px rgba(23, 52, 70, 0.14);
    }

    .detail-action-btn-primary:hover,
    .detail-action-btn-primary:focus-visible {
      box-shadow: 0 4px 12px rgba(23, 52, 70, 0.2);
    }

    .detail-action-btn-subtle {
      background: transparent;
      border-color: transparent;
      color: #64748b;
      box-shadow: none;
    }

    .detail-action-btn-subtle:hover,
    .detail-action-btn-subtle:focus-visible {
      background: rgba(15, 23, 42, 0.05);
      box-shadow: none;
      transform: none;
    }

    .activity-chart-shell {
      position: relative;
      display: grid;
      grid-template-columns: auto repeat(3, minmax(0, 1fr));
      gap: 1rem;
      align-items: end;
      min-height: 300px;
      padding: 1.25rem 1rem 0.75rem;
      border-radius: 22px;
      background:
        linear-gradient(180deg, rgba(248, 250, 252, 0.98) 0%, rgba(238, 242, 255, 0.82) 100%);
      overflow: hidden;
    }

    .activity-chart-shell::before {
      content: '';
      position: absolute;
      inset: 1.25rem 1rem 3.4rem 4rem;
      background-image:
        linear-gradient(to top, rgba(148, 163, 184, 0.18) 1px, transparent 1px);
      background-size: 100% 33.333%;
      pointer-events: none;
    }

    .activity-chart-scale {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-self: stretch;
      padding-bottom: 2.6rem;
      color: #94a3b8;
      font-size: 0.8rem;
      font-weight: 700;
      text-align: right;
    }

    .activity-column {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 0.85rem;
      justify-items: center;
    }

    .activity-column-stage {
      display: flex;
      align-items: end;
      justify-content: center;
      width: 100%;
      min-height: 220px;
    }

    .activity-column-track {
      display: flex;
      align-items: end;
      justify-content: center;
      width: min(96px, 100%);
      height: 220px;
      padding: 0.45rem;
      border-radius: 26px 26px 18px 18px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, rgba(226, 232, 240, 0.92) 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
    }

    .activity-bar-fill {
      display: block;
      width: 100%;
      border-radius: 20px;
      box-shadow: 0 14px 24px rgba(99, 102, 241, 0.16);
    }

    .activity-column-meta {
      display: grid;
      gap: 0.2rem;
      justify-items: center;
      text-align: center;
    }

    .activity-column-meta strong {
      color: #173446;
      font-size: 1.2rem;
      line-height: 1;
    }

    .activity-column-meta span {
      color: #64748b;
      font-size: 0.88rem;
      font-weight: 700;
      line-height: 1.35;
      max-width: 110px;
    }

    .activity-legend-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.85rem;
      align-items: center;
    }

    .activity-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.45rem 0.7rem;
      border-radius: 999px;
      background: #f8fafc;
      color: #475569;
      font-size: 0.85rem;
      font-weight: 700;
    }

    .activity-legend-dot {
      width: 0.7rem;
      height: 0.7rem;
      border-radius: 999px;
    }

    .course-form label,
    .enrollment-select-wrap {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      color: #1f2937;
      font-weight: 700;
      font-size: 0.86rem;
    }

    .course-form input,
    .course-form select,
    .course-form textarea,
    .enrollment-select-wrap select {
      width: 100%;
      border: 1px solid #dbe2ea;
      border-radius: 12px;
      padding: 0.68rem 0.8rem;
      font-size: 0.9rem;
      color: #173446;
      background: #fff;
      box-sizing: border-box;
    }

    .course-form input:focus,
    .course-form select:focus,
    .course-form textarea:focus,
    .enrollment-select-wrap select:focus {
      outline: none;
      border-color: #818cf8;
      box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
    }

    .course-form textarea {
      resize: vertical;
      min-height: 4.2rem;
      font-family: inherit;
    }

    .builder-secondary-btn,
    .builder-submit-btn,
    .assign-btn {
      border-radius: 10px;
      padding: 0.6rem 0.85rem;
      font-weight: 700;
      font-size: 0.85rem;
      color: #fff;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      box-shadow: 0 2px 6px rgba(79, 70, 229, 0.16);
    }

    .assign-btn-compact {
      padding: 0.4rem 0.7rem;
      font-size: 0.78rem;
      box-shadow: none;
    }

    .courses-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 2.1rem;
      padding: 0.4rem 0.75rem;
      border: 1px solid rgba(148, 163, 184, 0.32);
      border-radius: 9px;
      background: #ffffff;
      color: #173446;
      font: inherit;
      font-weight: 700;
      font-size: 0.78rem;
      white-space: nowrap;
      cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .courses-btn:hover,
    .courses-btn:focus-visible {
      border-color: var(--brand-tint);
      box-shadow: 0 3px 10px rgba(15, 23, 42, 0.08);
      outline: none;
    }

    .course-form button:disabled,
    .assign-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      box-shadow: none;
    }

    .asset-preview-card,
    .assessment-builder-card {
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      padding: 0.78rem;
    }

    .asset-preview-image {
      display: block;
      width: 100%;
      max-height: 220px;
      object-fit: cover;
      border-radius: 14px;
    }

    .asset-preview-copy {
      color: #475569;
      font-size: 0.9rem;
      font-weight: 700;
    }

    .assessment-list {
      display: grid;
      gap: 0.55rem;
      margin-top: 0.45rem;
    }

    .sequence-builder-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .content-add-menu-btn,
    .content-add-menu-item {
      border: none;
      border-radius: 12px;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
      box-shadow: none;
    }

    .content-add-menu-btn {
      padding: 0.62rem 0.8rem;
      background: #173446;
      color: #fff;
      font-size: 0.84rem;
    }

    .content-add-menu {
      position: absolute;
      top: calc(100% + 0.55rem);
      left: 0;
      z-index: 3;
      display: grid;
      gap: 0.45rem;
      min-width: 170px;
      padding: 0.45rem;
      border: 1px solid #dbe2ea;
      border-radius: 14px;
      background: #fff;
    }

    .content-add-menu-item {
      width: 100%;
      padding: 0.62rem 0.75rem;
      background: #f8fafc;
      color: #334155;
      text-align: left;
      font-size: 0.83rem;
    }

    

    .assessment-remove-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .offering-list {
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }

    .offering-meta-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.42rem 0.7rem;
      border-radius: 999px;
      background: #f8fafc;
      color: #475569;
      font-size: 0.82rem;
      font-weight: 700;
    }

    .offering-date,
    .offering-footer,
    .student-copy,
    .assignment-chip-muted {
      color: #64748b;
    }

    .student-list {
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }

    .student-list-compact {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.9rem;
    }

    /* Shared compact-list system — one visual language (avatar-led primary cell, labeled
       secondary cells, row hover) reused across every roster-style list in the manager view
       (Student Enrollment, Mentorship, and the IDP/Performance team-member pickers below) instead
       of each screen inventing its own table. Column count/proportions vary per screen via the
       roster-table-* modifiers; everything else (padding, hover, avatar, labels) is shared. */
    .roster-table-wrap { display: grid; gap: 0.6rem; }
    .roster-list { display: grid; gap: 0.6rem; }

    .roster-table {
      display: grid;
      gap: 0.75rem;
      align-items: center;
    }
    .roster-table-enrollment { grid-template-columns: minmax(0, 1.8fr) minmax(0, 0.9fr) minmax(0, 1.1fr) minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1.2fr); }
    .roster-table-mentorship-list { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1.3fr); }
    .roster-table-mentorship-submissions { grid-template-columns: minmax(0, 1.7fr) minmax(0, 1.7fr) minmax(0, 1.6fr); }

    .roster-table-head {
      padding: 0 0.9rem;
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .roster-row {
      padding: 0.65rem 0.9rem;
      border: 1px solid rgba(15, 23, 42, 0.07);
      border-radius: 10px;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
      transition: box-shadow 0.15s ease, border-color 0.15s ease;
    }

    .roster-row:hover,
    .roster-row:focus-within {
      border-color: var(--brand-tint);
      box-shadow: 0 3px 10px rgba(15, 23, 42, 0.08);
    }

    .roster-cell {
      min-width: 0;
      font-size: 0.86rem;
      color: #173446;
    }

    .roster-field-label {
      display: none;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 0.2rem;
    }

    .roster-primary { display: flex; align-items: center; gap: 0.65rem; }
    .roster-avatar {
      flex: 0 0 auto;
      width: 2.3rem;
      height: 2.3rem;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      color: #fff;
      font-weight: 800;
      font-size: 0.78rem;
    }
    .roster-identity { min-width: 0; }
    .roster-name {
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .roster-secondary {
      font-size: 0.8rem;
      color: #64748b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow-wrap: anywhere;
    }

    .roster-dates { display: grid; gap: 0.2rem; }
    .roster-date-row { font-size: 0.84rem; }
    .roster-field-label-inline {
      display: inline;
      margin-bottom: 0;
      margin-right: 0.35rem;
    }

    .roster-actions { display: flex; justify-content: flex-end; align-items: center; gap: 0.5rem; }

    /* Team-member pickers (IDP, Performance) — a simpler flex row (avatar + name/meta on the
       left, a count badge and chevron on the right) since these are single clickable rows with no
       header row to align columns against, unlike the table-style lists above. Reuses
       roster-row/roster-avatar/roster-identity/roster-name/roster-secondary for the same look. */
    .roster-picker-list { display: grid; gap: 0.5rem; }
    .roster-picker-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      text-align: left;
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    .roster-picker-row .roster-identity { flex: 1; }
    .roster-picker-status { flex: 0 0 auto; display: flex; align-items: center; gap: 0.5rem; }

    .student-active-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.24rem 0.6rem;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.14);
      color: #047857;
      font-size: 0.76rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .student-active-pill-inactive {
      background: rgba(148, 163, 184, 0.2);
      color: #475569;
    }

    .enrollment-groups-list {
      display: grid;
      gap: 0.6rem;
      overflow-x: auto;
      padding-bottom: 0.25rem;
    }

    .enrollment-groups-head,
    .enrollment-group-row {
      display: grid;
      grid-template-columns: 1.4fr 0.8fr 1fr 1fr 0.7fr 0.6fr 0.6fr;
      gap: 0.6rem;
      align-items: center;
      min-width: 46rem;
    }

    .enrollment-groups-head {
      padding: 0 0.9rem;
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .enrollment-group-row {
      padding: 0.65rem 0.9rem;
      border: 1px solid rgba(15, 23, 42, 0.07);
      border-radius: 10px;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
      transition: box-shadow 0.15s ease, border-color 0.15s ease;
    }

    .enrollment-group-row:hover,
    .enrollment-group-row:focus-within {
      border-color: var(--brand-tint);
      box-shadow: 0 3px 10px rgba(15, 23, 42, 0.08);
    }

    .enrollment-group-cell {
      min-width: 0;
      font-size: 0.86rem;
      color: #173446;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .enrollment-group-name {
      font-weight: 700;
    }

    .enrollment-group-action-cell {
      display: flex;
    }

    .edit-btn,
    .group-delete-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 2.1rem;
      padding: 0.4rem 0.75rem;
      border: 1px solid rgba(148, 163, 184, 0.32);
      border-radius: 9px;
      background: #ffffff;
      color: #173446;
      font: inherit;
      font-weight: 700;
      font-size: 0.8rem;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease;
    }

    .edit-btn:hover,
    .edit-btn:focus-visible {
      border-color: var(--brand-secondary);
      box-shadow: 0 3px 10px rgba(15, 23, 42, 0.1);
      outline: none;
    }

    .group-delete-btn {
      border-color: rgba(248, 113, 113, 0.35);
      color: #b91c1c;
      background: rgba(254, 242, 242, 0.9);
    }

    .group-delete-btn:hover,
    .group-delete-btn:focus-visible {
      border-color: rgba(239, 68, 68, 0.5);
      box-shadow: 0 3px 10px rgba(239, 68, 68, 0.14);
      outline: none;
    }

    .enrollment-modal {
      position: fixed;
      inset: 0;
      z-index: 45;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }

    .enrollment-modal-backdrop {
      position: absolute;
      inset: 0;
      border: none;
      background: rgba(15, 23, 42, 0.42);
      backdrop-filter: blur(4px);
      cursor: pointer;
    }

    .enrollment-modal-card {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 1rem;
      width: min(100%, 52rem);
      padding: 1.1rem;
      border-radius: 16px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      background: #fff;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
    }

    .enrollment-edit-modal-card {
      padding: 1.35rem;
      background:
        radial-gradient(circle at top right, rgba(99, 102, 241, 0.12), transparent 24%),
        linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    }

    .enrollment-modal-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .enrollment-modal-header-copy {
      display: grid;
      gap: 0.3rem;
    }

    .enrollment-modal-header h3 {
      margin: 0.2rem 0 0;
      color: #173446;
      font-size: 1.1rem;
      font-weight: 800;
    }

    .enrollment-modal-copy {
      margin: 0;
      color: #64748b;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .enrollment-edit-hero {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.95rem 1rem;
      border: 1px solid rgba(129, 140, 248, 0.18);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.84);
    }

    .enrollment-edit-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 3.1rem;
      height: 3.1rem;
      border-radius: 18px;
      background: linear-gradient(135deg, #6366f1, #38bdf8);
      color: #fff;
      font-size: 0.96rem;
      font-weight: 800;
      flex: 0 0 auto;
    }

    .enrollment-edit-hero-copy {
      display: grid;
      min-width: 0;
    }

    .enrollment-edit-hero-name {
      color: #173446;
      font-size: 1rem;
      font-weight: 800;
    }

    .enrollment-edit-hero-meta {
      color: #64748b;
    }

    .enrollment-edit-form {
      padding: 1rem;
      border: 1px solid rgba(15, 23, 42, 0.06);
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
    }

    .enrollment-modal-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.65rem;
    }

    .enrollment-action-row-modal {
      display: grid;
      gap: 1rem;
    }

    .enrollment-modal-card-compact {
      width: min(100%, 34rem);
    }

    /* Assign wizard — reuses the (previously unused-in-template) course-builder-stepper/
       course-step-btn styling from the course creation flow so both 3-step flows in this
       component look consistent, instead of inventing a second stepper design. */
    .assign-wizard-card {
      width: min(100%, 56rem);
      max-height: 88vh;
      overflow-y: auto;
    }

    .assign-wizard-stepper {
      position: static;
    }

    .course-step-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .enrollment-offering-picker {
      display: grid;
      gap: 0.5rem;
    }

    .enrollment-offering-picker-list {
      display: grid;
      gap: 0.5rem;
      max-height: 19rem;
      overflow-y: auto;
      padding-right: 0.2rem;
    }

    .enrollment-offering-option {
      display: flex;
      align-items: flex-start;
      gap: 0.65rem;
      padding: 0.65rem 0.8rem;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #fff;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
    }

    .enrollment-offering-option:hover {
      border-color: var(--brand-tint);
    }

    .enrollment-offering-option-selected {
      border-color: var(--brand-primary);
      background: var(--brand-tint);
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.12);
    }

    /* Custom check button — the native checkbox stays in the DOM (positioned invisibly over its
       own custom indicator) for real checkbox semantics/keyboard behaviour, while what's actually
       visible is the rounded square that fills in and shows a check mark via the :checked sibling
       selector below. No JS beyond the existing toggle handler is needed for the visual state. */
    .enrollment-offering-option-check-wrap {
      position: relative;
      flex: 0 0 auto;
      width: 1.35rem;
      height: 1.35rem;
      margin-top: 0.15rem;
    }

    .enrollment-offering-option-input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      opacity: 0;
      cursor: pointer;
    }

    .enrollment-offering-option-check {
      position: absolute;
      inset: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 7px;
      border: 2px solid #cbd5e1;
      background: #fff;
      color: #fff;
      pointer-events: none;
      transition: border-color 0.15s ease, background 0.15s ease;
    }

    .enrollment-offering-option-check svg {
      opacity: 0;
      transform: scale(0.5);
      transition: opacity 0.15s ease, transform 0.15s ease;
    }

    .enrollment-offering-option-input:hover ~ .enrollment-offering-option-check {
      border-color: var(--brand-primary);
    }

    .enrollment-offering-option-input:focus-visible ~ .enrollment-offering-option-check {
      outline: 2px solid var(--brand-primary);
      outline-offset: 2px;
    }

    .enrollment-offering-option-input:checked ~ .enrollment-offering-option-check {
      border-color: var(--brand-primary);
      background: var(--brand-primary);
    }

    .enrollment-offering-option-input:checked ~ .enrollment-offering-option-check svg {
      opacity: 1;
      transform: scale(1);
    }

    .enrollment-offering-option-body {
      display: grid;
      gap: 0.15rem;
      min-width: 0;
    }

    .enrollment-offering-option-title {
      font-weight: 700;
      color: #173446;
      font-size: 0.88rem;
    }

    /* Sits above the picker list (a sibling, not a list member) — the tinted background and
       dashed border keep it reading as a control acting ON the list rather than one more row
       in it, even though it reuses the same option/check-button markup and styling. */
    .enrollment-offering-select-all {
      background: #f8fafc;
      border-style: dashed;
    }

    .enrollment-offering-select-all.enrollment-offering-option-selected {
      border-style: solid;
    }

    .enrollment-offering-option-meta {
      color: #64748b;
      font-size: 0.76rem;
      font-weight: 600;
    }

    .enrollment-offering-option-copy {
      color: #64748b;
      font-size: 0.78rem;
      line-height: 1.4;
    }

    .student-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .assignment-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.7rem;
      border-radius: 999px;
      background: #eef2ff;
      color: #4338ca;
      font-size: 0.78rem;
      font-weight: 700;
    }

    .assignment-chip-action {
      padding-right: 0.4rem;
    }

    .assignment-chip-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.3rem;
      height: 1.3rem;
      border-radius: 999px;
      border: none;
      background: rgba(255, 255, 255, 0.6);
      color: #4338ca;
      font-size: 0.85rem;
      line-height: 1;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .assignment-chip-remove:hover,
    .assignment-chip-remove:focus-visible {
      background: #fee2e2;
      color: #b91c1c;
      outline: none;
    }

    .assign-wizard-summary {
      display: grid;
      gap: 0.85rem;
    }

    @keyframes assign-toast-in {
      0% { opacity: 0; transform: translateY(12px) scale(0.96); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    .assign-toast {
      position: fixed;
      right: 1.5rem;
      bottom: 1.5rem;
      z-index: 60;
      display: flex;
      align-items: center;
      gap: 0.65rem;
      max-width: min(24rem, calc(100vw - 2rem));
      padding: 0.85rem 0.85rem 0.85rem 1rem;
      border-radius: 14px;
      background: #173446;
      color: #fff;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.28);
      animation: assign-toast-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .assign-toast-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 999px;
      background: #22c55e;
      color: #fff;
      font-size: 0.85rem;
      font-weight: 800;
      flex: 0 0 auto;
    }

    .assign-toast-message {
      flex: 1 1 auto;
      font-size: 0.86rem;
      font-weight: 600;
      line-height: 1.4;
    }

    .assign-toast-dismiss {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border: none;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      font-size: 1rem;
      line-height: 1;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .assign-toast-dismiss:hover,
    .assign-toast-dismiss:focus-visible {
      background: rgba(255, 255, 255, 0.22);
      outline: none;
    }

    .course-studio-card {
      padding: 0;
      overflow: hidden;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 244, 239, 0.96) 100%);
    }

    .course-studio-form {
      display: grid;
      grid-template-columns: minmax(300px, 340px) minmax(0, 1fr);
      gap: 0;
      min-height: 760px;
    }

    .course-studio-sidebar {
      position: relative;
      display: grid;
      align-content: start;
      gap: 1rem;
      padding: 0 1rem 1rem;
      background: linear-gradient(180deg, #f2efe8 0%, #ece5db 100%);
      border-right: 1px solid rgba(118, 94, 70, 0.18);
    }

    .course-studio-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin: 0 -1rem;
      padding: 1rem;
      background: linear-gradient(135deg, #bc6015, #9e4b18);
    }

    .course-studio-icon-btn,
    .course-studio-publish-btn,
    .course-studio-add-btn,
    .course-studio-mini-btn,
    .course-studio-unit,
    .course-studio-empty-card {
      border: none;
      font: inherit;
      cursor: pointer;
    }

    .course-studio-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 11px;
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
    }

    .course-studio-publish-btn {
      min-width: 110px;
      padding: 0.6rem 0.95rem;
      border-radius: 10px;
      background: #fff;
      color: #a04c11;
      font-size: 0.88rem;
      font-weight: 800;
      box-shadow: 0 2px 8px rgba(70, 31, 4, 0.18);
    }

    .course-studio-publish-btn:disabled {
      background: rgba(255, 255, 255, 0.72);
      color: rgba(160, 76, 17, 0.58);
      box-shadow: none;
    }

    .course-studio-back-link {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 0.35rem;
      width: fit-content;
      padding: 0;
      border: none;
      background: transparent;
      color: #7c4a23;
      font: inherit;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
    }

    .course-studio-back-link::before {
      content: '←';
      font-size: 1rem;
      line-height: 1;
    }

    .course-studio-sidebar-copy {
      display: grid;
      gap: 0.32rem;
      padding: 0 0.15rem;
    }

    .course-studio-sidebar-copy strong {
      color: #173446;
      font-size: 1.45rem;
      line-height: 1.15;
    }

    .course-studio-sidebar-copy span {
      color: #6b7280;
      font-size: 0.84rem;
      line-height: 1.5;
    }

    .course-studio-quick-actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr) repeat(3, 2.85rem);
      gap: 0.55rem;
      align-items: center;
    }

    .course-studio-add-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      min-height: 2.85rem;
      border-radius: 16px;
      background: linear-gradient(135deg, #d86b1a, #b45415);
      color: #fff;
      font-size: 0.92rem;
      font-weight: 800;
      box-shadow: 0 12px 24px rgba(180, 84, 21, 0.2);
    }

    .course-studio-add-btn span:first-child {
      font-size: 1.15rem;
      line-height: 1;
    }

    .course-studio-mini-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.85rem;
      height: 2.85rem;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.86);
      color: #8b4b22;
      box-shadow: inset 0 0 0 1px rgba(139, 75, 34, 0.08);
    }

    .course-studio-mini-btn-active {
      background: #fff;
      color: #a04c11;
      box-shadow: 0 12px 22px rgba(180, 84, 21, 0.12);
    }

    .course-studio-add-menu {
      position: static;
      min-width: 0;
      width: 100%;
      box-shadow: 0 16px 30px rgba(15, 23, 42, 0.08);
    }

    .course-studio-unit-list {
      display: grid;
      gap: 0.65rem;
      align-content: start;
    }

    .course-studio-unit {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 0.75rem;
      align-items: center;
      width: 100%;
      padding: 0.88rem 0.92rem;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.82);
      color: #173446;
      text-align: left;
      transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
    }

    .course-studio-unit:hover,
    .course-studio-unit:focus-visible,
    .course-studio-empty-card:hover,
    .course-studio-empty-card:focus-visible,
    .course-studio-add-btn:hover,
    .course-studio-add-btn:focus-visible,
    .course-studio-mini-btn:hover,
    .course-studio-mini-btn:focus-visible,
    .course-studio-icon-btn:hover,
    .course-studio-icon-btn:focus-visible,
    .course-studio-back-link:focus-visible,
    .course-studio-publish-btn:focus-visible {
      outline: none;
      transform: translateY(-1px);
    }

    .course-studio-unit-active {
      background: #fff;
      box-shadow: 0 16px 28px rgba(180, 84, 21, 0.12);
    }

    .course-studio-unit-dragging {
      opacity: 0.55;
      box-shadow: none;
    }

    .course-studio-unit-icon,
    .course-studio-upload-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      border-radius: 18px;
      background: rgba(188, 96, 21, 0.12);
      color: #a04c11;
    }

    .course-studio-unit-icon {
      width: 2.5rem;
      height: 2.5rem;
    }

    .course-studio-upload-icon {
      width: 4rem;
      height: 4rem;
    }

    .course-studio-unit-copy {
      display: grid;
      gap: 0.18rem;
      min-width: 0;
    }

    .course-studio-unit-copy strong {
      color: #173446;
      font-size: 0.92rem;
      line-height: 1.2;
    }

    .course-studio-unit-copy span,
    .course-studio-unit-drag-handle {
      color: #7a7f86;
      font-size: 0.76rem;
      line-height: 1.35;
    }

    .course-studio-unit-drag-handle {
      font-size: 1rem;
      font-weight: 900;
      letter-spacing: 0.08em;
      cursor: grab;
    }

    .course-studio-end-dropzone {
      display: grid;
      place-items: center;
      min-height: 3.3rem;
      padding: 0.8rem 1rem;
      border: 1px dashed rgba(160, 76, 17, 0.26);
      border-radius: 18px;
      color: #8b4b22;
      font-size: 0.8rem;
      font-weight: 700;
      text-align: center;
      background: rgba(255, 255, 255, 0.52);
      transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
    }

    .course-studio-end-dropzone-active {
      background: rgba(255, 255, 255, 0.9);
      border-color: rgba(160, 76, 17, 0.52);
      color: #a04c11;
    }

    .course-studio-unit-ordering-note {
      margin: 0;
      color: #7a7f86;
      font-size: 0.76rem;
      line-height: 1.45;
    }

    .course-studio-workspace {
      display: grid;
      align-content: start;
      gap: 1rem;
      padding: 1.4rem 1.5rem 1.5rem;
      background: linear-gradient(180deg, #ffffff 0%, #faf8f4 100%);
    }

    .course-studio-workspace-header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
    }

    .course-studio-workspace-header h2 {
      margin: 0;
      color: #173446;
      font-size: 2rem;
      line-height: 1.08;
    }

    .course-studio-workspace-header p {
      margin: 0.35rem 0 0;
      color: #6b7280;
      font-size: 0.94rem;
      line-height: 1.5;
    }

    .course-studio-panel,
    .course-studio-empty-panel {
      padding: 1.2rem;
      border-radius: 24px;
      border-color: #ece5db;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
    }

    .course-studio-card .form-section-eyebrow {
      color: #a04c11;
    }

    .course-studio-card .create-section-status-pill {
      background: rgba(188, 96, 21, 0.12);
      color: #a04c11;
    }

    .course-studio-card .builder-secondary-btn {
      border: 1px solid rgba(188, 96, 21, 0.18);
      background: #fff;
      color: #8b4b22;
      box-shadow: none;
    }

    .course-studio-card .builder-secondary-btn:disabled {
      border-color: transparent;
      background: #f1ede7;
      color: #a8a29e;
    }

    .course-studio-thumbnail-preview {
      overflow: hidden;
      padding: 0.78rem;
      border: 1px dashed #d9c1aa;
      border-radius: 22px;
      background: #fbf4eb;
    }

    .course-studio-thumbnail-preview img {
      display: block;
      width: 100%;
      max-height: 240px;
      object-fit: cover;
      border-radius: 16px;
    }

    .course-studio-upload-grid,
    .course-studio-empty-grid {
      display: grid;
      gap: 1rem;
    }

    .course-studio-upload-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 1rem;
      margin-bottom: 1rem;
    }

    .course-studio-upload-card {
      position: relative;
      display: grid;
      justify-items: center;
      align-content: center;
      gap: 0.45rem;
      min-height: 250px;
      padding: 1.2rem;
      border: 1px dashed #d9d3ca;
      border-radius: 22px;
      background: linear-gradient(180deg, #fcfbf8 0%, #f4f0ea 100%);
      color: #173446;
      text-align: center;
      overflow: hidden;
    }

    .course-studio-upload-card strong,
    .course-studio-empty-card strong {
      font-size: 1.02rem;
      line-height: 1.2;
    }

    .course-studio-upload-caption,
    .course-studio-empty-card span {
      color: #6b7280;
      font-size: 0.84rem;
      line-height: 1.45;
    }

    .course-studio-upload-progress-bar {
      display: block;
      width: 100%;
      height: 6px;
      background: #e5e7eb;
      border-radius: 999px;
      overflow: hidden;
    }

    .course-studio-upload-progress-fill {
      display: block;
      height: 100%;
      background: var(--brand-primary, #2563eb);
      border-radius: 999px;
      transition: width 0.2s ease;
    }

    .course-studio-upload-progress-label {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--brand-primary, #2563eb);
    }

    .course-studio-upload-card-link {
      justify-items: stretch;
      align-content: stretch;
      text-align: left;
      gap: 0.75rem;
    }

    .course-studio-upload-card-link input {
      margin-top: auto;
    }

    .course-studio-upload-input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }

    .course-studio-presentation-panel {
      display: grid;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .course-studio-empty-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .course-studio-empty-card {
      display: grid;
      align-content: start;
      gap: 0.75rem;
      min-height: 220px;
      padding: 1.15rem;
      border-radius: 22px;
      background: #fff;
      color: #173446;
      text-align: left;
      box-shadow: inset 0 0 0 1px #ece5db;
    }

    .course-studio-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding-top: 0.2rem;
    }

    .course-studio-footer .form-action-copy {
      max-width: 36rem;
    }

    @media (max-width: 1080px) {
      .manager-layout,
      .courses-layout {
        grid-template-columns: 1fr;
      }

      .manager-layout.manager-layout-sidebar-collapsed {
        grid-template-columns: 1fr;
      }

      .manager-sidebar {
        position: static;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        height: auto;
        overflow: visible;
      }

      .manager-sidebar-header {
        grid-column: 1 / -1;
        justify-content: center;
      }

      .manager-sidebar-collapsed {
        padding-inline: calc(1rem * var(--ui-scale));
      }

      .manager-sidebar-collapsed button {
        justify-content: flex-start;
      }

      .manager-sidebar-collapsed .manager-nav-label {
        display: inline;
      }

      .course-studio-form {
        grid-template-columns: 1fr;
      }

      .course-studio-sidebar {
        border-right: none;
        border-bottom: 1px solid rgba(118, 94, 70, 0.18);
      }

      .course-studio-empty-grid {
        grid-template-columns: 1fr;
      }

    }

    @media (max-width: 720px) {
      .manager-shell {
        padding: 0.8rem;
      }

      .manager-topbar,
      .manager-topbar-user,
      .student-card-header,
      .section-heading-row,
      .enrollment-action-row,
      .offering-top-row,
      .offering-footer {
        flex-direction: column;
        align-items: flex-start;
      }

      .assessment-row {
        grid-template-columns: 1fr;
      }

      .student-list-row {
        grid-template-columns: 1fr;
      }

      .roster-table-head {
        display: none;
      }

      .roster-table {
        grid-template-columns: 1fr;
        gap: 0.35rem;
      }

      .roster-field-label {
        display: block;
      }

      .roster-actions {
        justify-content: flex-start;
      }

      .roster-picker-row {
        flex-wrap: wrap;
      }

      .form-section-header,
      .course-form-actions,
      .enrollment-modal-header,
      .enrollment-edit-hero,
      .enrollment-modal-actions,
      .asset-preview-header,
      .builder-step-actions {
        flex-direction: column;
        align-items: flex-start;
      }

      .content-add-menu {
        right: 0;
        left: auto;
        width: min(100%, 220px);
      }

      .form-grid-two,
      .media-preview-grid,
      .assessment-question-grid,
      .course-studio-upload-grid {
        grid-template-columns: 1fr;
      }

      .course-studio-workspace {
        padding: 1rem;
      }

      .course-studio-workspace-header,
      .course-studio-footer {
        flex-direction: column;
        align-items: flex-start;
      }

      .course-studio-quick-actions {
        grid-template-columns: minmax(0, 1fr) repeat(3, 2.65rem);
      }

      .course-studio-unit {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .course-studio-unit-drag-handle {
        display: none;
      }

      .courses-tab-nav {
        gap: 1rem;
        flex-wrap: wrap;
      }

      .published-offering-overlay {
        padding: 0.5rem;
      }

      .published-offering-overlay-panel {
        width: min(100%, 560px);
        height: calc(100vh - 1rem);
        border-radius: 22px;
      }

      .assign-btn {
        width: 100%;
      }

      .activity-chart-shell {
        grid-template-columns: 1fr;
        min-height: auto;
        padding: 1rem;
      }

      .activity-chart-shell::before {
        inset: 3.2rem 1rem 4.2rem 1rem;
      }

      .activity-chart-scale {
        display: none;
      }

      .activity-column-stage,
      .activity-column-track {
        width: 100%;
      }

      .activity-column-track {
        max-width: none;
      }
    }

    .mentorship-review-shell-overlay {
      position: relative;
    }

    .mentorship-review-request-overlay {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 1rem;
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(3px);
    }

    .mentorship-review-request-panel {
      width: min(860px, 100%);
      max-height: calc(100vh - 6rem);
      overflow: auto;
      animation: published-offering-panel-enter 0.26s ease-out;
    }

    .mentorship-review-detail-header-actions {
      display: grid;
      gap: 0.6rem;
      justify-items: end;
    }

    .mentorship-review-detail-close {
      border: 1px solid #dbe2ea;
      border-radius: 999px;
      padding: 0.55rem 0.95rem;
      background: #f8fafc;
      color: #173446;
      font: inherit;
      font-size: 0.84rem;
      font-weight: 700;
      cursor: pointer;
    }

    .mentorship-review-detail-close:hover,
    .mentorship-review-detail-close:focus-visible {
      background: #eef2ff;
      border-color: #c7d2fe;
      outline: none;
    }

    @media (max-width: 720px) {
      .mentorship-review-request-overlay {
        padding: 0.5rem;
      }

      .mentorship-review-detail-header-actions {
        justify-items: start;
      }
    }

    .mentorship-review-chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }

      .mentorship-review-score-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.35rem 0.7rem;
        border-radius: 999px;
        background: #eff6ff;
        color: #1d4ed8;
        font-size: 0.76rem;
        font-weight: 800;
      }

      /* ── IDP Form ──────────────────────────────────────────────────── */
      .idp-program-hero {
        padding: 1.5rem 0 1rem;
        border-bottom: 1px solid #f1f5f9;
        margin-bottom: 1.5rem;
      }
      .idp-program-hero h3 {
        font-size: 1.05rem;
        font-weight: 700;
        margin: 0 0 0.2rem;
        color: #0f172a;
      }
      .idp-program-hero p {
        font-size: 0.85rem;
        color: #64748b;
        margin: 0;
      }
      .idp-program-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        margin-bottom: 1.25rem;
        overflow: hidden;
      }
      .idp-program-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid #f1f5f9;
      }
      .idp-program-card-title-shell {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .idp-program-card-title {
        font-size: 0.9rem;
        font-weight: 700;
        color: #0f172a;
      }
      .idp-program-count {
        font-size: 0.72rem;
        font-weight: 800;
        padding: 0.15rem 0.55rem;
        border-radius: 999px;
        background: #eff6ff;
        color: #1d4ed8;
      }
      .idp-program-add {
        font-size: 0.8rem;
        padding: 0.35rem 0.9rem;
        border-radius: 6px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #334155;
        font-weight: 600;
        cursor: pointer;
      }
      .idp-program-add:hover { background: #e2e8f0; }
      .idp-program-card-body {
        padding: 0.75rem 1.25rem;
      }
      .idp-program-entry {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 0.75rem;
      }
      .idp-program-entry-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
      }
      .idp-program-entry-heading {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .idp-row-number {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #e2e8f0;
        color: #64748b;
        font-size: 0.72rem;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .idp-program-entry-label {
        font-size: 0.82rem;
        font-weight: 600;
        color: #334155;
      }
      .idp-program-remove {
        font-size: 0.78rem;
        color: #ef4444;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
      }
      .idp-program-remove:hover { background: #fef2f2; }
      .idp-program-remove:disabled { color: #cbd5e1; cursor: not-allowed; }
      .idp-form-field {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        margin-bottom: 0.75rem;
      }
      .idp-form-field span {
        font-size: 0.78rem;
        font-weight: 600;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }
      .idp-form-field input,
      .idp-form-field textarea,
      .idp-form-field select {
        width: 100%;
        padding: 0.55rem 0.75rem;
        border: 1px solid #e2e8f0;
        border-radius: 7px;
        font-size: 0.875rem;
        color: #0f172a;
        background: #fff;
        box-sizing: border-box;
        font-family: inherit;
      }
      .idp-form-field input:focus,
      .idp-form-field textarea:focus,
      .idp-form-field select:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      .idp-program-date-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }
      .idp-program-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.75rem;
        padding-top: 1rem;
        border-top: 1px solid #f1f5f9;
        margin-top: 0.5rem;
      }
      .idp-save-button {
        padding: 0.6rem 1.5rem;
        background: #1d4ed8;
        color: #fff;
        border: none;
        border-radius: 7px;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
      }
      .idp-save-button:hover { background: #1e40af; }
      .idp-save-button:disabled {
        background: #94a3b8;
        cursor: not-allowed;
      }
      .idp-save-button:disabled:hover { background: #94a3b8; }
      .idp-form-status {
        font-size: 0.82rem;
        color: #22c55e;
        font-weight: 600;
      }

      /* IDP Member List */
      .idp-member-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1rem;
        margin-top: 1rem;
      }
      .idp-member-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem 1.25rem;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        cursor: pointer;
        text-align: left;
        width: 100%;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .idp-member-card:hover {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.08);
      }
      .idp-member-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #eff6ff;
        color: #1d4ed8;
        font-size: 0.9rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        text-transform: uppercase;
      }
      .idp-member-avatar-lg {
        width: 52px;
        height: 52px;
        font-size: 1.1rem;
      }
      .idp-member-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        min-width: 0;
      }
      .idp-member-name {
        font-size: 0.9rem;
        font-weight: 700;
        color: #0f172a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .idp-member-meta {
        font-size: 0.8rem;
        color: #475569;
      }
      .idp-member-no-entries {
        font-size: 0.72rem;
        color: #94a3b8;
      }
      .idp-member-chevron {
        font-size: 1.2rem;
        color: #94a3b8;
        line-height: 1;
      }

      /* IDP Detail Header */
      /* IDP Read-only view */
      .idp-readonly-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.6rem;
        margin-top: 0.5rem;
      }
      .idp-readonly-field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.6rem 0.75rem;
        background: #fff;
        border: 1px solid #f1f5f9;
        border-radius: 7px;
      }
      .idp-readonly-field span {
        font-size: 0.72rem;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .idp-readonly-field strong {
        font-size: 0.875rem;
        color: #0f172a;
        font-weight: 500;
        line-height: 1.4;
      }
      .idp-readonly-field-full { grid-column: 1 / -1; }
      .idp-status-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.2rem 0.65rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 700;
        background: #f1f5f9;
        color: #475569;
      }
      .idp-status-badge.idp-status-in-progress { background: #eff6ff; color: #1d4ed8; }
      .idp-status-badge.idp-status-completed { background: #f0fdf4; color: #15803d; }
      .idp-status-badge.idp-status-on-hold { background: #fff7ed; color: #c2410c; }
      .idp-cancel-btn {
        padding: 0.55rem 1.1rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 7px;
        font-size: 0.875rem;
        font-weight: 600;
        color: #475569;
        cursor: pointer;
      }
      .idp-cancel-btn:hover { background: #e2e8f0; }

      /* ===== Succession Planning — high-tech treatment ===== */
      .succession-hq {
        --succ-primary: #4f46e5;
        --succ-cyan: #06b6d4;
        --succ-critical: #dc2626;
      }

      .succession-avatar {
        flex-shrink: 0;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        font-weight: 800;
        letter-spacing: 0.01em;
        color: #fff;
        background: linear-gradient(135deg, var(--succ-primary), var(--succ-cyan));
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.28);
      }
      .succession-avatar-critical { background: linear-gradient(135deg, #f97316, var(--succ-critical)); box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3); }
      .succession-avatar-lg { width: 3.1rem; height: 3.1rem; font-size: 1rem; }
      .succession-avatar-sm { width: 1.9rem; height: 1.9rem; font-size: 0.68rem; }

      .succession-role-card {
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(79, 70, 229, 0.18);
        background: linear-gradient(180deg, rgba(79, 70, 229, 0.05), rgba(255, 255, 255, 0));
      }
      .succession-role-card::before {
        content: '';
        position: absolute;
        inset: 0 0 auto 0;
        height: 3px;
        background: linear-gradient(90deg, var(--succ-critical), #f97316, var(--succ-primary), var(--succ-cyan));
        background-size: 300% 100%;
        animation: successionScanline 5s linear infinite;
      }
      @keyframes successionScanline {
        0% { background-position: 0% 0; }
        100% { background-position: 300% 0; }
      }

      .succession-team-card {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .succession-team-card .idp-member-info { flex: 1; }

      .succession-critical-chip,
      .succession-count-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 700;
        white-space: nowrap;
      }
      .succession-critical-chip {
        background: rgba(220, 38, 38, 0.12);
        color: #b91c1c;
        box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.18) inset;
        animation: successionPulse 2.4s ease-in-out infinite;
      }
      @keyframes successionPulse {
        0%, 100% { box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.18) inset, 0 0 0 0 rgba(220, 38, 38, 0.28); }
        50% { box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.18) inset, 0 0 0 5px rgba(220, 38, 38, 0); }
      }
      .succession-count-chip { background: #eef2ff; color: #4338ca; }

      .succession-flag-btn,
      .succession-nominate-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        white-space: nowrap;
        border: none;
        border-radius: 999px;
        padding: 0.6rem 1rem;
        font: inherit;
        font-size: 0.84rem;
        font-weight: 700;
        color: #fff;
        cursor: pointer;
        background: linear-gradient(135deg, var(--succ-primary), var(--succ-cyan));
        box-shadow: 0 6px 16px rgba(79, 70, 229, 0.28);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .succession-flag-btn:hover:not(:disabled),
      .succession-nominate-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 22px rgba(79, 70, 229, 0.34);
      }
      .succession-flag-btn:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }
      .succession-nominate-btn-sm { padding: 0.42rem 0.75rem; font-size: 0.78rem; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.24); }

      .succession-glow-card {
        border: 1px solid rgba(79, 70, 229, 0.22);
        box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.06) inset, 0 12px 28px rgba(79, 70, 229, 0.1);
      }

      .succession-nominate-form { display: grid; gap: 1rem; }
      .succession-form-field {
        display: grid;
        gap: 0.4rem;
        font-size: 0.85rem;
        font-weight: 600;
        color: #334155;
      }
      .succession-field-label { display: inline-flex; align-items: center; gap: 0.4rem; color: #4338ca; }
      .succession-form-field select,
      .succession-form-field textarea,
      .succession-form-field input {
        border: 1px solid #d7e2ee;
        border-radius: 10px;
        padding: 0.6rem 0.75rem;
        font: inherit;
        font-weight: 400;
        color: #14213d;
        background: #fff;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .succession-form-field select:focus,
      .succession-form-field textarea:focus,
      .succession-form-field input:focus {
        outline: none;
        border-color: var(--succ-primary, #4f46e5);
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.14);
      }

      .succession-progress-track {
        position: relative;
        width: 100%;
        height: 0.5rem;
        border-radius: 999px;
        background: #e7ebf5;
        overflow: hidden;
      }
      .succession-progress-track-thin { height: 0.35rem; }
      .succession-progress-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #f97316, #facc15);
        box-shadow: 0 0 8px rgba(249, 115, 22, 0.5);
        transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .succession-progress-fill.succession-progress-hot {
        background: linear-gradient(90deg, #22c55e, #06b6d4);
        box-shadow: 0 0 8px rgba(34, 197, 94, 0.55);
      }
      .succession-progress-percent { font-size: 0.76rem; font-weight: 800; color: #4338ca; white-space: nowrap; }

      .succession-readiness-row {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 0.6rem;
      }
      .succession-readiness-label { color: #334155; font-size: 0.82rem; }

      .succession-status-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.2rem 0.65rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 700;
        background: #f1f5f9;
        color: #475569;
      }
      .succession-status-draft { background: #eff6ff; color: #1d4ed8; }
      .succession-status-active { background: rgba(34, 197, 94, 0.14); color: #15803d; }
      .succession-status-withdrawn { background: rgba(148, 163, 184, 0.22); color: #475569; }

      .succession-nomination-card { display: grid; gap: 0.65rem; }
      .succession-gap-editor {
        display: grid;
        gap: 0.75rem;
        margin-top: 0.5rem;
        padding-top: 0.75rem;
        border-top: 1px solid #e2e8f0;
      }
      .succession-gap-card {
        display: grid;
        gap: 0.5rem;
        padding: 0.85rem;
        border-radius: 12px;
        background: #f8fafc;
        border: 1px solid rgba(79, 70, 229, 0.1);
      }
      .succession-gap-header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
      .succession-gap-title { display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 700; color: #14213d; font-size: 0.9rem; }
      .succession-gap-title svg { color: #f59e0b; }
      .succession-action-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.4rem; }
      .succession-action-item { display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.85rem; color: #475569; }
      .succession-action-status {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        flex-shrink: 0;
        padding: 0.12rem 0.5rem;
        border-radius: 999px;
        background: #e2e8f0;
        color: #334155;
        font-size: 0.7rem;
        font-weight: 700;
        white-space: nowrap;
      }
      .succession-action-status-completed { background: rgba(34, 197, 94, 0.16); color: #15803d; }
      .succession-action-status-in-progress { background: #eff6ff; color: #1d4ed8; }
      .succession-action-status-on-hold { background: #fff7ed; color: #c2410c; }
      .succession-action-add-row { display: flex; gap: 0.5rem; align-items: center; }
      .succession-action-add-row input { flex: 1; }

      .succession-unflag-row { justify-content: flex-end; margin-bottom: 0.5rem; }
      .succession-danger-btn { display: inline-flex; align-items: center; gap: 0.35rem; color: #b91c1c; }

      .succession-stats-row {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.85rem;
      }
      .succession-stat-card {
        display: grid;
        justify-items: start;
        gap: 0.3rem;
        padding: 0.95rem 1.05rem;
        border-radius: 16px;
        background: #fff;
        border: 1px solid rgba(148, 163, 184, 0.22);
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
      }
      .succession-stat-card svg { color: var(--succ-primary, #4f46e5); }
      .succession-stat-card-good svg { color: #16a34a; }
      .succession-stat-card-warn svg { color: #d97706; }
      .succession-stat-value { font-size: 1.5rem; font-weight: 800; color: #14213d; line-height: 1; }
      .succession-stat-label { font-size: 0.76rem; color: #64748b; font-weight: 600; }

      .succession-filter-tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .succession-filter-tab {
        border: 1px solid rgba(148, 163, 184, 0.32);
        background: #fff;
        color: #475569;
        border-radius: 999px;
        padding: 0.45rem 0.95rem;
        font: inherit;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
      }
      .succession-filter-tab:hover { border-color: rgba(79, 70, 229, 0.4); }
      .succession-filter-tab.active {
        background: linear-gradient(135deg, var(--succ-primary, #4f46e5), var(--succ-cyan, #06b6d4));
        border-color: transparent;
        color: #fff;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.28);
      }

      /* Compact list of critical roles — a card grid didn't scale for a manager with a large team
         (up to 50 direct reports could mean 50 rows here), so each position is one dense row with
         View/Edit actions instead of a full multi-section card. The detail view (opened via View
         or Edit) still shows the full successor/development-plan breakdown. */
      .succession-position-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
      .succession-position-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.65rem 0.9rem;
        border-radius: 12px;
        background: #fff;
        border: 1px solid rgba(148, 163, 184, 0.22);
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
      }
      .succession-position-title-group { display: grid; gap: 0.15rem; flex: 1; min-width: 0; }
      .succession-position-title { font-size: 0.92rem; font-weight: 800; color: #14213d; }
      .succession-position-meta {
        font-size: 0.78rem;
        color: #64748b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .succession-position-row-count { flex-shrink: 0; font-size: 0.78rem; color: #64748b; font-weight: 600; white-space: nowrap; }
      .succession-position-row-actions { flex-shrink: 0; display: flex; gap: 0.4rem; }
      .succession-row-btn {
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: #fff;
        color: #334155;
        border-radius: 8px;
        padding: 0.4rem 0.85rem;
        font: inherit;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.15s ease, border-color 0.15s ease;
      }
      .succession-row-btn:hover { border-color: rgba(79, 70, 229, 0.4); }
      .succession-row-btn-primary {
        background: linear-gradient(135deg, var(--succ-primary, #4f46e5), var(--succ-cyan, #06b6d4));
        border-color: transparent;
        color: #fff;
      }
      .succession-row-btn-primary:hover { opacity: 0.92; }

      .succession-readiness-pill {
        flex-shrink: 0;
        padding: 0.25rem 0.65rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 700;
        white-space: nowrap;
      }
      .succession-readiness-pill-sm { padding: 0.16rem 0.55rem; font-size: 0.68rem; }
      .succession-readiness-pill-ready-now { background: rgba(34, 197, 94, 0.16); color: #15803d; }
      .succession-readiness-pill-1-2-years { background: #eff6ff; color: #1d4ed8; }
      .succession-readiness-pill-3-plus-years { background: rgba(147, 51, 234, 0.12); color: #7e22ce; }
      .succession-readiness-pill-none { background: #f1f5f9; color: #64748b; }

      .succession-add-position-block { display: grid; gap: 0.85rem; }
      .succession-add-position-toggle {
        justify-self: start;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        border: 1px dashed rgba(79, 70, 229, 0.4);
        background: rgba(79, 70, 229, 0.05);
        color: #4338ca;
        border-radius: 999px;
        padding: 0.55rem 1rem;
        font: inherit;
        font-size: 0.84rem;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .succession-add-position-toggle:hover { background: rgba(79, 70, 229, 0.1); }

      @media (max-width: 900px) {
        .succession-stats-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .succession-position-row { flex-wrap: wrap; }
        .succession-position-row-actions { margin-left: auto; }
      }

      .idp-detail-header { margin-bottom: 1.25rem; }
      .idp-back-btn {
        background: none;
        border: none;
        font-size: 0.85rem;
        font-weight: 600;
        color: #3b82f6;
        cursor: pointer;
        padding: 0.4rem 0;
        margin-bottom: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }
      .idp-back-btn:hover { color: #1d4ed8; }
      .idp-detail-identity {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem 1.25rem;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
      }
      .idp-detail-name {
        font-size: 1.05rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 0.2rem;
      }
      .idp-detail-meta {
        font-size: 0.83rem;
        color: #64748b;
      }

      /* ── KPI Table ─────────────────────────────────────────────────── */
      /* .manager-panel is a column flexbox — without min-width: 0 here, a flex item won't
         shrink below its content's natural width, so the wide KPI table (min-width: 62rem)
         was forcing this whole card past its intended bounds instead of scrolling internally
         inside .kpi-table-wrap where it belongs. */
      .mentorship-review-card {
        min-width: 0;
      }
      .idp-program-card {
        min-width: 0;
      }
      .kpi-table-wrap {
        overflow-x: auto;
        min-width: 0;
        padding: 0 1.25rem 1.25rem;
      }
      .kpi-table {
        width: 100%;
        min-width: 46rem;
        table-layout: fixed;
        border-collapse: separate;
        border-spacing: 0;
        font-size: 0.83rem;
      }
      /* The editable table needs more floor width than the read-only one — a native date
         input can't shrink past its own internal minimum, so its column needs enough absolute
         room even at the table's narrowest. */
      .kpi-table-editable {
        min-width: 58rem;
      }
      .kpi-table th,
      .kpi-table td {
        padding: 0.75rem 0.85rem;
        text-align: left;
        vertical-align: middle;
        border-bottom: 1px solid #eef1f6;
        overflow-wrap: break-word;
      }
      .kpi-table thead th {
        padding-top: 0.7rem;
        padding-bottom: 0.7rem;
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        color: #64748b;
        white-space: normal;
        overflow-wrap: break-word;
        background: linear-gradient(180deg, #f8fafc 0%, #f3f6fb 100%);
        border-bottom: 1px solid #e7ecf3;
      }
      .kpi-table td {
        color: #1e293b;
        line-height: 1.45;
      }
      .kpi-table tbody tr:last-of-type td {
        border-bottom: none;
      }
      .kpi-table tbody tr:nth-child(even) td {
        background: #fbfcfe;
      }
      .kpi-table tbody tr:hover td {
        background: #f3f7ff;
      }
      .kpi-cell-weight {
        text-align: right;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .kpi-cell-center {
        text-align: center;
      }
      .kpi-table-editable textarea,
      .kpi-table-editable input,
      .kpi-table-editable select {
        display: block;
        width: 100%;
        max-width: 100%;
        padding: 0.5rem 0.6rem;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font: inherit;
        color: #0f172a;
        background: #fff;
        box-sizing: border-box;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .kpi-table-editable input[type='number'] {
        text-align: right;
      }
      .kpi-table-editable textarea {
        resize: vertical;
        min-height: 2.6rem;
      }
      .kpi-table-editable textarea:hover,
      .kpi-table-editable input:hover,
      .kpi-table-editable select:hover {
        border-color: #cbd5e1;
      }
      .kpi-table-editable textarea:focus,
      .kpi-table-editable input:focus,
      .kpi-table-editable select:focus {
        border-color: #60a5fa;
        outline: none;
        box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.16);
      }

      .kpi-score-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 0.3rem;
        max-width: 100%;
        padding: 0.28rem 0.6rem;
        border-radius: 14px;
        background: #eff6ff;
        color: #1d4ed8;
        font-size: 0.72rem;
        font-weight: 700;
        line-height: 1.3;
        white-space: normal;
        overflow-wrap: break-word;
      }
      .kpi-score-pill.kpi-score-empty {
        background: #f1f5f9;
        color: #94a3b8;
        font-weight: 600;
      }
      .kpi-score-pill.kpi-score-flag {
        background: #fef2f2;
        color: #b91c1c;
      }

      .kpi-total-weight {
        font-size: 0.76rem;
        font-weight: 700;
        color: #15803d;
        white-space: nowrap;
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
        background: #f0fdf4;
      }

      .kpi-total-weight-off {
        color: #b91c1c;
        background: #fef2f2;
      }

      .kpi-weight-error {
        margin: 0;
        flex-basis: 100%;
        font-size: 0.8rem;
        font-weight: 700;
        color: #b91c1c;
      }

      .kpi-year-banner {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        background: #f8fafc;
      }

      .kpi-year-banner-label {
        font-size: 0.9rem;
        color: #334155;
      }

      .kpi-year-banner-label strong {
        color: #0f172a;
      }

      .kpi-year-banner-hint {
        margin: 0.5rem 0 0;
        font-size: 0.8rem;
        color: #64748b;
      }

      .kpi-year-prompt {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.6rem;
      }

      .kpi-year-prompt-field {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.82rem;
        font-weight: 700;
        color: #334155;
      }

      .kpi-year-prompt-field input {
        width: 6rem;
        padding: 0.4rem 0.6rem;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font: inherit;
      }

      .kpi-year-prompt-error {
        margin: 0;
        flex-basis: 100%;
        font-size: 0.8rem;
        font-weight: 700;
        color: #b91c1c;
      }

      .kpi-year-selector-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin: 0.85rem 0;
      }

      .kpi-year-selector-label {
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
      }

      .kpi-year-selector {
        padding: 0.4rem 0.7rem;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font: inherit;
        color: #0f172a;
        background: #fff;
      }

      .kpi-year-readonly-badge {
        font-size: 0.76rem;
        font-weight: 700;
        color: #b45309;
        background: #fffbeb;
        border-radius: 999px;
        padding: 0.2rem 0.65rem;
      }

      .kpi-year-empty-note {
        margin: 0.75rem 0 0;
        font-size: 0.85rem;
        color: #64748b;
      }

      .kpi-approval-view-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        margin-bottom: 0.85rem;
      }

      .kpi-approval-badge {
        font-size: 0.76rem;
        font-weight: 700;
        white-space: nowrap;
        padding: 0.2rem 0.65rem;
        border-radius: 999px;
        color: #b45309;
        background: #fffbeb;
      }

      .kpi-approval-badge-approved {
        color: #15803d;
        background: #f0fdf4;
      }

      .kpi-approval-badge-revision {
        color: #b91c1c;
        background: #fef2f2;
      }

      .kpi-approval-submit-row {
        display: flex;
        align-items: flex-end;
        flex-wrap: wrap;
        gap: 0.6rem;
        margin-top: 0.85rem;
        padding-top: 0.85rem;
        border-top: 1px dashed #e2e8f0;
      }

      .kpi-approval-next-approver {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.78rem;
        font-weight: 700;
        color: #334155;
      }

      .kpi-approval-next-approver select {
        padding: 0.45rem 0.7rem;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font: inherit;
        min-width: 14rem;
      }

      .kpi-table-editable select.kpi-score-flag {
        border-color: #ef4444;
        background: #fef2f2;
        color: #b91c1c;
        font-weight: 700;
      }

      .kpi-totals-row td {
        font-weight: 800;
        color: #0f172a;
        background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
        border-top: 2px solid #e2e8f0;
        border-bottom: none;
      }

      .kpi-total-rating-pill {
        background: #eef2ff;
        color: #4338ca;
        font-size: 0.78rem;
      }

      /* Performance Gap Analysis — a distinct, slightly "alert" card (warm-tinted background,
         red-toned border) so it visually stands apart from the neutral KPI table above it rather
         than reading as just another data table. Each gap gets its own left-accented item card,
         colour-graded by severity (rating 1 vs 2), matching the red-for-low-score convention the
         KPI table itself already uses via kpi-score-flag. */
      .kpi-gap-card {
        background: linear-gradient(165deg, rgba(254, 242, 242, 0.65) 0%, rgba(255, 255, 255, 0.98) 60%);
        border: 1px solid #fecdd3;
      }

      .kpi-gap-card-header {
        border-bottom-color: #fecdd3;
      }

      .kpi-gap-icon {
        display: inline-flex;
        color: #dc2626;
      }

      .kpi-gap-count {
        background: #fee2e2;
        color: #b91c1c;
      }

      .kpi-gap-subtitle {
        margin: 0;
        padding: 0 1.25rem 0.9rem;
        font-size: 0.82rem;
        color: #7f1d1d;
      }

      .kpi-gap-empty {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin: 0 1.25rem 1.25rem;
        padding: 0.9rem 1rem;
        border: 1px dashed #bbf7d0;
        border-radius: 10px;
        background: #f0fdf4;
        color: #166534;
        font-size: 0.85rem;
        font-weight: 600;
      }

      .kpi-gap-empty-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.35rem;
        height: 1.35rem;
        border-radius: 999px;
        background: #16a34a;
        color: #fff;
        font-size: 0.78rem;
        font-weight: 800;
        flex: 0 0 auto;
      }

      .kpi-gap-list {
        display: grid;
        gap: 0.9rem;
        padding: 0 1.25rem 1.25rem;
      }

      .kpi-gap-item {
        background: #fff;
        border: 1px solid #fecaca;
        border-left: 4px solid #f59e0b;
        border-radius: 10px;
        padding: 0.95rem 1.1rem;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      }

      .kpi-gap-item-critical {
        border-left-color: #dc2626;
        background: linear-gradient(180deg, rgba(254, 226, 226, 0.5) 0%, #fff 45%);
      }

      .kpi-gap-item-warning {
        border-left-color: #f59e0b;
        background: linear-gradient(180deg, rgba(255, 247, 237, 0.6) 0%, #fff 45%);
      }

      .kpi-gap-item-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .kpi-gap-item-title {
        font-size: 0.92rem;
        color: #0f172a;
      }

      .kpi-gap-fields {
        display: grid;
        grid-template-columns: 1fr 1fr 11rem;
        gap: 0.85rem;
        margin-top: 0.85rem;
      }

      .kpi-gap-field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        min-width: 0;
      }

      .kpi-gap-field > span {
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        color: #78716c;
      }

      .kpi-gap-field textarea,
      .kpi-gap-field input[type='date'] {
        width: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 0.5rem 0.6rem;
        font: inherit;
        font-size: 0.85rem;
        color: #1f2937;
        resize: vertical;
        background: #fff;
      }

      .kpi-gap-field textarea:focus,
      .kpi-gap-field input[type='date']:focus {
        outline: none;
        border-color: #f59e0b;
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
      }

      .kpi-gap-field-date input[type='date'] {
        min-height: 2.35rem;
      }

      .kpi-gap-fields-readonly .kpi-gap-field p {
        margin: 0;
        padding: 0.5rem 0.6rem;
        min-height: 1.35rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 0.85rem;
        color: #334155;
        word-break: break-word;
      }

      .kpi-gap-actions {
        margin-inline: 1.25rem;
        padding-bottom: 1.25rem;
      }

      @media (max-width: 720px) {
        .kpi-gap-fields {
          grid-template-columns: 1fr;
        }
      }
  `],
})
export class AdminProfileComponent implements OnInit, OnDestroy {
  selectPanel(panel: AdminPanel) {
    // Mirrors training-manager-profile.component.ts's own selectPanel teardown for the same
    // reason it existed there: leaving the course builder open mid-edit while browsing away to
    // another panel and back would otherwise resurface stale in-progress state.
    if (panel !== 'courses') {
      if (this.editingCourseId()) {
        this.resetCourseBuilder();
      }
      this.closeCreateSectionDetail();
      this.closeContentItemDetails();
      this.closePublishedOfferingDetail();
    }

    this.selectedPanel.set(panel);
  }

  toggleAdminSidebar() {
    this.adminSidebarCollapsed.update((collapsed) => !collapsed);
  }
  readonly managerAccessOptions: ReadonlyArray<{ value: 'Yes' | 'No'; label: string }> = [
    { value: 'No', label: 'Student' },
    { value: 'Yes', label: 'Manager' },
  ];
  readonly adminAccessOptions: ReadonlyArray<{ value: 'Yes' | 'No'; label: string }> = [
    { value: 'No', label: 'No' },
    { value: 'Yes', label: 'Yes' },
  ];
  readonly managerData = inject(TrainingManagerDataService);
  private readonly backend = inject(LmsBackendService);
  private readonly http = inject(HttpClient);
  readonly ofoCodeOptions = signal<string[]>([]);
  readonly municipalityOptions = signal<string[]>([]);
  readonly branding = inject(LmsBrandingService);
  private readonly router = inject(Router);
  private readonly reportStudentCoursesById = signal<Record<string, StudentCourse[]>>({});
  private readonly reportStudentCertificatesById = signal<Record<string, StudentCertificateLicence[]>>({});
  private readonly requestedReportSnapshotIds = new Set<string>();

  private readonly _showWelcomeBanner = signal(true);
  readonly showWelcomeBanner = computed(() => this._showWelcomeBanner());
  private readonly _welcomeBannerLeaving = signal(false);
  readonly welcomeBannerLeaving = computed(() => this._welcomeBannerLeaving());

  readonly navItems: ReadonlyArray<{ label: string; value: AdminPanel }> = [
    { label: 'Dashboard', value: 'dashboard' },
    { label: 'Courses', value: 'courses' },
    { label: 'Student Enrollment', value: 'enrollment' },
    { label: 'User Management', value: 'users' },
    { label: 'Reports', value: 'reports' },
    { label: 'Succession Planning', value: 'succession' },
    { label: 'LMS Settings', value: 'settings' },
  ];
  // ── Succession Planning ───────────────────────────────────────────────
  // Fully read-only for admin — see server.ts's succession routes, all gated to
  // requireTrainingManager. ownerManagerId/nominatedByManagerId are the flagging/nominating
  // manager's own EnrollmentStudentRecord id (their team is students whose lineManagerId matches
  // it), so both resolve through the student roster rather than trainingManagers.
  ownerManagerName(managerId: string) {
    const manager = this.managerData.students().find((entry) => entry.id === managerId);
    return manager ? `${manager.name} ${manager.surname}` : 'Unassigned';
  }

  roleTitle(roleId: string) {
    return this.managerData.successionRoles().find((role) => role.id === roleId)?.title ?? 'Removed role';
  }

  successorName(studentId: string) {
    const student = this.managerData.students().find((entry) => entry.id === studentId);
    return student ? `${student.name} ${student.surname}` : 'Former team member';
  }

  successorInitials(studentId: string) {
    const student = this.managerData.students().find((entry) => entry.id === studentId);
    return student ? `${student.name[0] ?? ''}${student.surname[0] ?? ''}` : '?';
  }

  readonly canDownloadSuccessionReport = computed(() =>
    this.managerData.successionRoles().length > 0 || this.managerData.successorNominations().length > 0,
  );

  readonly selectedSuccessionAdminView = signal<'overview' | 'organogram'>('overview');

  nominationsForRole(roleId: string) {
    return this.managerData.successorNominations().filter((nomination) => nomination.roleId === roleId);
  }

  private static readonly orgReadinessOrder: SuccessionReadinessRating[] = ['Ready Now', 'Ready in 1-2 Years', 'Ready in 3+ Years'];

  // The Active nomination's readiness if one exists, otherwise the most-ready Draft candidate,
  // otherwise null — mirrors bestReadinessForRole in training-manager-profile.component.ts so the
  // organogram's "best readiness" pill agrees with what the flagging manager themselves sees.
  bestReadinessForRole(roleId: string): SuccessionReadinessRating | null {
    const nominations = this.nominationsForRole(roleId);
    if (!nominations.length) {
      return null;
    }

    const active = nominations.find((nomination) => nomination.status === 'Active');
    if (active) {
      return active.readinessRating;
    }

    return [...nominations].sort((left, right) =>
      AdminProfileComponent.orgReadinessOrder.indexOf(left.readinessRating)
      - AdminProfileComponent.orgReadinessOrder.indexOf(right.readinessRating),
    )[0].readinessRating;
  }

  readinessSlug(rating: SuccessionReadinessRating) {
    if (rating === 'Ready Now') return 'ready-now';
    if (rating === 'Ready in 1-2 Years') return '1-2-years';
    return '3-plus-years';
  }

  orgCardStatusSlug(roleId: string) {
    const bestRating = this.bestReadinessForRole(roleId);
    return bestRating ? this.readinessSlug(bestRating) : 'none';
  }

  // The organogram nests a critical role under another critical role wherever this role's owning
  // manager is themselves the incumbent of one — i.e. the succession plan mirrors the real
  // reporting line one level up. A role whose owning manager isn't flagged anywhere becomes a root
  // (the common case: most flagged roles won't chain into another flagged role above them). The
  // `visited` set defensively breaks any cycle a corrupt lineManagerId chain could otherwise cause
  // (a real org hierarchy can't cycle, but recursive rendering would hang the tab if one existed).
  readonly successionOrgTree = computed<SuccessionOrgNode[]>(() => {
    const roles = this.managerData.successionRoles();
    const incumbentIds = new Set(roles.map((role) => role.incumbentStudentId));
    const childrenByOwnerId = new Map<string, SuccessionRoleRecord[]>();

    for (const role of roles) {
      const siblings = childrenByOwnerId.get(role.ownerManagerId);
      if (siblings) {
        siblings.push(role);
      } else {
        childrenByOwnerId.set(role.ownerManagerId, [role]);
      }
    }

    const buildNode = (role: SuccessionRoleRecord, visited: ReadonlySet<string>): SuccessionOrgNode => {
      if (visited.has(role.id)) {
        return { role, children: [] };
      }

      const nextVisited = new Set(visited).add(role.id);
      const children = (childrenByOwnerId.get(role.incumbentStudentId) ?? []).map((child) => buildNode(child, nextVisited));
      return { role, children };
    };

    return roles
      .filter((role) => !incumbentIds.has(role.ownerManagerId))
      .map((role) => buildNode(role, new Set()));
  });

  readonly selectedPanel = signal<AdminPanel>('dashboard');
  readonly adminSidebarCollapsed = signal(false);
  readonly sidebarScrolling = signal(false);
  private sidebarScrollTimeout: ReturnType<typeof setTimeout> | null = null;
  readonly userSearchTerm = signal('');
  readonly editingUserId = signal<string | null>(null);
  readonly editingAnnualReportRequestId = signal<string | null>(null);
  readonly uploadingInvoice = signal(false);
  readonly uploadingProofOfPayment = signal(false);
  readonly uploadingCertificate = signal(false);
  readonly selectedAnnualReportDownloadFormat = signal<ReportDownloadFormat>('CSV');
  readonly selectedIdpReportDownloadFormat = signal<ReportDownloadFormat>('CSV');
  readonly selectedSuccessionReportDownloadFormat = signal<ReportDownloadFormat>('CSV');
  readonly selectedPerformanceReportDownloadFormat = signal<ReportDownloadFormat>('CSV');
  readonly selectedCertificateReportDownloadFormat = signal<ReportDownloadFormat>('CSV');
  readonly selectedAtrSubReportDownloadFormat = signal<ReportDownloadFormat>('CSV');
  readonly selectedWspSubReportDownloadFormat = signal<ReportDownloadFormat>('CSV');
  readonly selectedBulkUploadTemplateFormat = signal<ReportDownloadFormat>('CSV');
  readonly selectedReportView = signal<AdminReportView | null>(null);
  readonly selectedSetaReportTab = signal<SetaReportTab | null>(null);
  readonly selectedAtrSubReport = signal<AtrSubReport | null>(null);
  readonly selectedWspSubReport = signal<WspSubReport | null>(null);
  readonly selectedSettingsSection = signal<AdminSettingsSection | null>(null);
  readonly hrIntegrationConfig = signal<HrIntegrationConfig | null>(null);
  readonly hrIntegrationLoading = signal(false);
  readonly hrIntegrationSaving = signal(false);
  readonly hrIntegrationSaveError = signal<string | null>(null);
  readonly hrIntegrationSyncing = signal(false);
  readonly hrIntegrationSyncError = signal<string | null>(null);
  readonly hrIntegrationForm = new FormGroup({
    enabled: new FormControl(false, { nonNullable: true }),
    baseUrl: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    authHeaderName: new FormControl('Authorization', { nonNullable: true, validators: [Validators.required] }),
    // Left blank on load (the server never sends the real value back) — a blank save keeps
    // whatever credential is already stored, see updateHrIntegrationConfig in repository.ts.
    authHeaderValue: new FormControl('', { nonNullable: true }),
  });
  readonly annualReportSearchTerm = signal('');
  readonly selectedAnnualReportDepartment = signal('');
  readonly selectedAnnualReportSource = signal<TrainingReportSource>('All');
  readonly selectedAnnualReportDateFrom = signal('');
  readonly selectedAnnualReportDateTo = signal('');
  readonly selectedAtrReportDateFrom = signal('');
  readonly selectedAtrReportDateTo = signal('');
  readonly selectedWspReportDateFrom = signal('');
  readonly selectedWspReportDateTo = signal('');
  readonly showSingleUserModal = signal(false);
  readonly singleUserMessage = signal('');
  readonly singleUserTone = signal<'success' | 'error'>('success');
  readonly bulkUploadMessage = signal('');
  readonly bulkUploadTone = signal<'success' | 'error'>('success');
  readonly bulkUploadIssues = signal<BulkUploadIssue[]>([]);
  readonly trainingRecordUploadMessage = signal('');
  readonly trainingRecordUploadTone = signal<'success' | 'error'>('success');
  readonly trainingRecordUploadIssues = signal<BulkUploadIssue[]>([]);
  readonly trainingRecordUploadInProgress = signal(false);
  readonly trainingRecordApprovingManagerId = signal('');
  readonly adminProfileImageDataUrl = signal<string | null>(null);
  readonly uploadingProfileImage = signal(false);
  readonly companyLogoUploading = signal(false);
  readonly companyLogoUploadError = signal('');
  readonly themeUpdateError = signal('');
  readonly adminName = signal(
    readLmsSessionRecord()?.displayName
      ?? deriveDisplayNameFromIdentity(readLmsSessionRecord()?.username, readLmsSessionRecord()?.email),
  );
  readonly adminEmail = signal(readLmsSessionRecord()?.email?.trim() || 'admin@skillsconnect.app');
  readonly adminFirstName = computed(() => this.adminName().trim().split(/\s+/)[0] || 'Admin');
  readonly adminInitials = computed(() =>
    this.adminName()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'AD',
  );
  readonly topbarProfileMenuOpen = signal(false);
  readonly availableSwitchRoles = signal<LoginRole[]>(
    readLmsSessionRecord()?.role === 'administrator' ? ['training-manager', 'student'] : [],
  );
  readonly switchingRole = signal(false);
  private readonly reportSnapshotPrefetchEffect = effect(() => {
    for (const student of this.users()) {
      if (this.requestedReportSnapshotIds.has(student.id)) {
        continue;
      }

      this.requestedReportSnapshotIds.add(student.id);
      this.fetchReportSnapshot(student.id);
    }
  });

  // The per-student snapshots backing the reports (course completion, certificates) were
  // previously fetched exactly once per student id and never again, so a course finished or a
  // certificate uploaded while the admin had the Reports panel open (or from earlier in a
  // long-lived session) never showed up without a full page reload. Periodically re-fetch every
  // known student's snapshot to keep the reports live — same reasoning as
  // training-manager-data.service.ts's refreshBootstrapState, just re-run per student since
  // there's no single bulk endpoint for this data. A longer interval than the dashboard refresh
  // since this is N network calls, not one.
  private readonly reportSnapshotRefreshSub = interval(60000).subscribe(() => {
    for (const student of this.users()) {
      this.fetchReportSnapshot(student.id);
    }
  });

  private fetchReportSnapshot(studentId: string) {
    this.backend.getStudentSnapshot(studentId).subscribe({
      next: (snapshot) => {
        this.reportStudentCoursesById.update((current) => ({
          ...current,
          [studentId]: snapshot.courses,
        }));
        this.reportStudentCertificatesById.update((current) => ({
          ...current,
          [studentId]: snapshot.certificatesAndLicences ?? [],
        }));
      },
      error: () => {
        this.reportStudentCoursesById.update((current) => ({
          ...current,
          [studentId]: current[studentId] ?? [],
        }));
        this.reportStudentCertificatesById.update((current) => ({
          ...current,
          [studentId]: current[studentId] ?? [],
        }));
      },
    });
  }

  readonly users = computed(() =>
    [...this.managerData.students()].sort((left, right) => `${left.name} ${left.surname}`.localeCompare(`${right.name} ${right.surname}`)),
  );
  readonly lineManagerOptions = computed(() =>
    this.users().filter((s) => s.activeStatus === 'Active'),
  );
  readonly filteredUsers = computed(() => {
    const query = this.userSearchTerm().trim().toLowerCase();
    const users = this.users();

    if (!query) {
      return users;
    }

    return users.filter((student) =>
      [student.name, student.surname, student.email, student.jobTitle, student.idNumber, student.group, student.department, student.lineManager, student.activeStatus, student.status]
        .some((value) => value.toLowerCase().includes(query)),
    );
  });
  readonly editingUser = computed(() => {
    const selectedId = this.editingUserId();
    if (!selectedId) {
      return null;
    }

    return this.users().find((student) => student.id === selectedId) ?? null;
  });
  readonly editingAnnualReportRequest = computed(() => {
    const selectedId = this.editingAnnualReportRequestId();
    if (!selectedId) {
      return null;
    }

    return this.managerData.externalTrainingRequests().find((request) => request.id === selectedId) ?? null;
  });
  readonly totalUsersCount = computed(() => this.users().length);
  readonly activeUsersCount = computed(() => this.users().filter((student) => student.activeStatus === 'Active').length);
  readonly inactiveUsersCount = computed(() => this.totalUsersCount() - this.activeUsersCount());
  readonly activeUsersPercent = computed(() => this.percentage(this.activeUsersCount(), this.totalUsersCount()));
  readonly inactiveUsersPercent = computed(() => this.percentage(this.inactiveUsersCount(), this.totalUsersCount()));
  readonly activeRateLabel = computed(() => `${Math.round(this.activeUsersPercent())}%`);
  readonly learningStatusSummary = computed(() => {
    const users = this.users();
    const countBy = (label: EnrollmentStudent['status']) => users.filter((student) => this.resolveStudentOverallStatus(student) === label).length;

    return [
      { label: 'Completed', count: countBy('Completed'), color: '#10b981' },
      { label: 'In Progress', count: countBy('In Progress'), color: '#3b82f6' },
      { label: 'Not Yet Started', count: countBy('Not Yet Started'), color: '#f59e0b' },
    ];
  });
  readonly reportOfferingTitlesById = computed(() =>
    new Map(this.managerData.offerings().map((offering) => [offering.id, offering.title])),
  );
  readonly reportManagerNamesById = computed(() =>
    new Map(this.users().map((student) => [student.id, `${student.name} ${student.surname}`.trim()])),
  );
  // "Training that has occurred" — merges two very different sources into one row shape:
  // (a) external training requests that were requested and approved, and (b) internal LMS
  // courses the student has actually completed (with an assignment mark where the completion
  // was assignment-driven, since quiz/document/video completions have no per-student mark
  // visible admin-side, only a pass/complete state).
  readonly annualTrainingReportRows = computed<ConsolidatedTrainingReportRow[]>(() => {
    const rows: ConsolidatedTrainingReportRow[] = [];
    const studentsById = new Map(this.users().map((student) => [student.id, student]));
    const studentsByEmail = new Map(this.users().map((student) => [student.email.toLowerCase(), student]));

    for (const request of this.managerData.externalTrainingRequests()) {
      if (request.status !== 'Approved') {
        continue;
      }

      // Prefer the stable studentId captured at submission time. Older requests (submitted
      // before studentId existed on this record) fall back to matching by email, which breaks
      // if the student's email has since changed.
      const matchedStudent = (request.studentId ? studentsById.get(request.studentId) : undefined)
        ?? studentsByEmail.get(request.studentEmail.toLowerCase());
      const dateValue = this.normalizeReportDateValue(request.reviewedAt ?? request.submittedAt);

      rows.push({
        id: `external::${request.id}`,
        sourceId: request.id,
        learnerName: request.studentName,
        learnerEmail: request.studentEmail,
        idNumber: matchedStudent?.idNumber || 'Not provided',
        jobTitle: matchedStudent?.jobTitle || 'Not provided',
        department: matchedStudent?.department || 'Unassigned',
        ofoCode: matchedStudent?.ofoCode || 'Not provided',
        race: matchedStudent?.race || 'Not provided',
        gender: matchedStudent?.gender || 'Not provided',
        municipality: matchedStudent?.municipality || 'Not provided',
        trainingItem: request.courseName,
        source: 'External',
        trainingType: request.trainingType || 'External training',
        result: 'Approved',
        provider: request.provider || 'External provider',
        date: this.formatReportDateLabel(request.reviewedAt ?? request.submittedAt),
        dateValue,
        status: 'Approved',
      });
    }

    const offeringTitlesById = this.reportOfferingTitlesById();
    const coursesByStudentId = this.reportStudentCoursesById();
    const approvedAssignmentsByStudentOffering = new Map<string, string[]>();

    for (const submission of this.managerData.assignmentSubmissions()) {
      if (submission.status !== 'Approved') {
        continue;
      }

      const key = `${submission.studentId}::${submission.offeringId}`;
      const mark = `${submission.awardedPoints ?? 0}/${submission.possiblePoints}`;
      const existing = approvedAssignmentsByStudentOffering.get(key);
      if (existing) {
        existing.push(mark);
      } else {
        approvedAssignmentsByStudentOffering.set(key, [mark]);
      }
    }

    for (const student of this.users()) {
      const studentCourses = coursesByStudentId[student.id] ?? [];

      for (const offeringId of student.assignedOfferingIds) {
        const courseTitle = offeringTitlesById.get(offeringId) ?? 'Unknown course';
        if (this.resolveReportCompletionStatus(student, offeringId, courseTitle) !== 'Completed') {
          continue;
        }

        const matchedCourse = studentCourses.find((course) => course.offeringId === offeringId || course.name === courseTitle);
        const rawCompletedAt = matchedCourse?.completedAt ?? '';
        const marks = approvedAssignmentsByStudentOffering.get(`${student.id}::${offeringId}`);

        rows.push({
          id: `lms::${student.id}::${offeringId}`,
          sourceId: `${student.id}::${offeringId}`,
          learnerName: `${student.name} ${student.surname}`.trim(),
          learnerEmail: student.email,
          idNumber: student.idNumber || 'Not provided',
          jobTitle: student.jobTitle || 'Not provided',
          department: student.department || 'Unassigned',
          ofoCode: student.ofoCode || 'Not provided',
          race: student.race || 'Not provided',
          gender: student.gender || 'Not provided',
          municipality: student.municipality || 'Not provided',
          trainingItem: courseTitle,
          source: 'LMS',
          trainingType: marks ? 'Assignment' : 'Course',
          result: marks ? marks.join(', ') : 'Completed',
          provider: 'Internal LMS',
          date: this.formatReportDateLabel(rawCompletedAt),
          dateValue: this.normalizeReportDateValue(rawCompletedAt),
          status: 'Completed',
        });
      }
    }

    return rows.sort((left, right) => right.dateValue.localeCompare(left.dateValue));
  });
  // Reports flatten a student's IDP history across every opened year — unlike the manager/student
  // UI, which only ever shows one year at a time, a compliance-style report should keep including
  // everything ever captured, not narrow to just the current year. A past year's entries aren't
  // eagerly loaded (see idpEntriesForStudentYear's caching), so this also kicks off a best-effort
  // background fetch for any year not yet cached — idpEntriesForStudentYear reads a signal that
  // fetch populates, so this computed re-runs on its own once the fetch lands, no extra plumbing
  // needed. fetchIdpEntriesForStudentYear already no-ops for the current year and for anything
  // already cached or in flight, so calling it here on every recompute is harmless.
  private allIdpEntriesForStudent(studentId: string): StudentIdpEntry[] {
    const years = this.managerData.idpYearsOpened();
    for (const year of years) {
      void this.managerData.fetchIdpEntriesForStudentYear(studentId, year);
    }

    return years.flatMap((year) => this.managerData.idpEntriesForStudentYear(studentId, year));
  }

  readonly idpReportRows = computed<IdpReportRow[]>(() => {
    const managerNamesById = this.reportManagerNamesById();

    return this.users()
      .flatMap((student) => {
        // Prefer the live id-based lookup over the plain-text snapshot: the snapshot only
        // gets recomputed when the student's own record is next saved, so it goes stale the
        // moment the manager's own name changes (same fix as getReportCellValue's 'lineManager' case).
        const manager = (student.lineManagerId ? managerNamesById.get(student.lineManagerId) : undefined)
          || student.lineManager?.trim()
          || 'Not provided';

        return this.allIdpEntriesForStudent(student.id).map((entry, index) => ({
          id: `${student.id}::${index}`,
          name: student.name,
          surname: student.surname,
          idNumber: student.idNumber || 'Not provided',
          jobTitle: student.jobTitle || 'Not provided',
          ofoCode: student.ofoCode || 'Not provided',
          race: student.race || 'Not provided',
          gender: student.gender || 'Not provided',
          municipality: student.municipality || 'Not provided',
          manager,
          developmentNeed: entry.developmentNeed || 'Not provided',
          plannedAction: entry.plannedAction || 'Not provided',
          supportRequired: entry.supportRequired || 'Not provided',
          dateCaptured: this.formatReportDateLabel(entry.dateCaptured),
          dateCapturedValue: this.normalizeReportDateValue(entry.dateCaptured),
          targetDate: this.formatReportDateLabel(entry.targetDate),
          targetDateValue: this.normalizeReportDateValue(entry.targetDate),
          status: entry.status,
        }));
      })
      .sort((left, right) => {
        const nameComparison = `${left.name} ${left.surname}`.localeCompare(`${right.name} ${right.surname}`);
        if (nameComparison !== 0) {
          return nameComparison;
        }

        return right.dateCapturedValue.localeCompare(left.dateCapturedValue);
      });
  });
  // The rating scale moved from 5 points down to 4 (Exceeds/Meets/Needs Improvement/
  // Unsatisfactory); a KPI scored under the old scale before this change can still carry a raw
  // stored value of 5. Rather than rewriting that historical data, every place that turns a score
  // into a displayed number or feeds it into a weighted average clamps it down to the new max
  // first — the old top rating just reads as the new top rating.
  private clampKpiScoreToScale(score: number | null): number | null {
    return score === null ? null : Math.min(score, 4);
  }

  readonly performanceReportRows = computed<PerformanceReportRow[]>(() => {
    const managerNamesById = this.reportManagerNamesById();

    return this.users()
      .map((student) => {
        const manager = (student.lineManagerId ? managerNamesById.get(student.lineManagerId) : undefined)
          || student.lineManager?.trim()
          || 'Not provided';

        const entries = this.managerData.kpiEntriesForStudent(student.id);
        const totalWeight = entries.reduce((total, entry) => total + (entry.weight || 0), 0);

        // Same fallback as the student/manager KPI views: an entry counts toward the overall
        // rating using the manager's Overall score where set, otherwise the employee's own
        // self-score — so this report agrees with what those pages show instead of only ever
        // reflecting the manager's (possibly still-blank) Overall column. Clamped to the current
        // 4-point scale's max — a KPI rated 5 under the old 5-point scale (before Exceeds
        // Expectations/Meets Expectations/Needs Improvement/Unsatisfactory replaced it) still
        // reads as the new top rating rather than silently exceeding a scale that no longer goes
        // that high; the stored value itself is left untouched.
        const scoredEntries = entries
          .map((entry) => ({ weight: entry.weight, score: this.clampKpiScoreToScale(entry.overallScoring ?? entry.employeeScoring) }))
          .filter((entry) => entry.score !== null && entry.weight > 0);
        const scoredWeight = scoredEntries.reduce((total, entry) => total + entry.weight, 0);
        const overallRating = scoredWeight
          ? scoredEntries.reduce((total, entry) => total + entry.weight * (entry.score ?? 0), 0) / scoredWeight
          : null;

        const lastReviewDateValue = entries
          .map((entry) => this.normalizeReportDateValue(entry.dateOfReview))
          .filter(Boolean)
          .sort()
          .at(-1) ?? '';

        return {
          id: student.id,
          name: student.name,
          surname: student.surname,
          idNumber: student.idNumber || 'Not provided',
          jobTitle: student.jobTitle || 'Not provided',
          department: student.department || 'Unassigned',
          manager,
          kpiCount: entries.length,
          totalWeight,
          overallRating,
          overallRatingLabel: overallRating === null ? 'Not yet scored' : `${overallRating.toFixed(1)} / 4`,
          lastReviewDate: this.formatReportDateLabel(lastReviewDateValue || null),
          lastReviewDateValue,
        };
      })
      .sort((left, right) => `${left.name} ${left.surname}`.localeCompare(`${right.name} ${right.surname}`));
  });
  readonly certificateLicenceReportRows = computed<CertificateLicenceReportRow[]>(() => {
    const certificatesByStudentId = this.reportStudentCertificatesById();

    return this.users()
      .flatMap((student) => {
        const records = certificatesByStudentId[student.id] ?? [];

        return records.map((record, index) => ({
          id: `${student.id}::${record.id || index}`,
          name: `${student.name} ${student.surname}`.trim(),
          surname: student.surname,
          idNumber: student.idNumber || 'Not provided',
          department: student.department || 'Unassigned',
          certificateName: record.certificationName || 'Not provided',
          expiryDate: this.formatReportDateLabel(record.expiryDate),
          expiryDateValue: this.normalizeReportDateValue(record.expiryDate),
          renewalRequired: record.renewalRequired,
          status: this.resolveLiveCertificateStatus(record),
        }));
      })
      .sort((left, right) => {
        const surnameComparison = left.surname.localeCompare(right.surname);
        if (surnameComparison !== 0) {
          return surnameComparison;
        }

        const nameComparison = left.name.localeCompare(right.name);
        if (nameComparison !== 0) {
          return nameComparison;
        }

        return right.expiryDateValue.localeCompare(left.expiryDateValue);
      });
  });
  readonly annualReportDepartments = computed(() =>
    Array.from(new Set(this.annualTrainingReportRows().map((row) => row.department).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
  );
  readonly filteredAnnualTrainingReportRows = computed(() => {
    const searchQuery = this.annualReportSearchTerm().trim().toLowerCase();
    const department = this.selectedAnnualReportDepartment();
    const source = this.selectedAnnualReportSource();
    const dateFrom = this.selectedAnnualReportDateFrom();
    const dateTo = this.selectedAnnualReportDateTo();

    return this.annualTrainingReportRows().filter((row) => {
      if (searchQuery) {
        const matchesSearch = [
          row.learnerName,
          row.learnerEmail,
          row.idNumber,
          row.jobTitle,
          row.department,
          row.trainingItem,
          row.provider,
          row.trainingType,
        ].some((value) => value.toLowerCase().includes(searchQuery));

        if (!matchesSearch) {
          return false;
        }
      }

      if (department && row.department !== department) {
        return false;
      }

      if (source !== 'All' && row.source !== source) {
        return false;
      }

      if (dateFrom && (!row.dateValue || row.dateValue < dateFrom)) {
        return false;
      }

      if (dateTo && (!row.dateValue || row.dateValue > dateTo)) {
        return false;
      }

      return true;
    });
  });
  readonly canDownloadAnnualReport = computed(() => this.filteredAnnualTrainingReportRows().length > 0);
  readonly canDownloadIdpReport = computed(() => this.idpReportRows().length > 0);
  readonly canDownloadPerformanceReport = computed(() => this.performanceReportRows().length > 0);

  // ── Dashboard performance gauge ─────────────────────────────────────────
  // Scored employees only — someone with no KPIs set up yet has no rating to
  // average in, same exclusion the Performance Report itself uses.
  private readonly scoredPerformanceRows = computed(() =>
    this.performanceReportRows().filter(
      (row): row is PerformanceReportRow & { overallRating: number } => row.overallRating !== null,
    ),
  );

  readonly performanceGaugeAverage = computed<number | null>(() => {
    const rows = this.scoredPerformanceRows();
    if (!rows.length) {
      return null;
    }

    return rows.reduce((total, row) => total + row.overallRating, 0) / rows.length;
  });

  readonly performanceGaugeAverageLabel = computed(() => {
    const average = this.performanceGaugeAverage();
    return average === null ? '—' : average.toFixed(1);
  });

  // Where the average sits on the arc, as a plain (x, y) point — not a rotated needle. The gauge
  // used to have a rotating needle here; it was pulled after two rounds of animation bugs tied to
  // getting its resting angle and transform-origin/pivot right. A dot placed directly at its final
  // coordinates has no rotation and no pivot to get wrong, so it can't get stuck at the wrong angle
  // the way the needle did. The arc runs from value 1 at 180° through the top (value 2.5, 270°) to
  // value 4 at 0°/360° — see the fixed band <path> coordinates above, which this angle mapping was
  // reverse-derived from to stay pixel-consistent with them.
  readonly performanceGaugeMarker = computed<{ x: number; y: number } | null>(() => {
    const average = this.performanceGaugeAverage();
    if (average === null) {
      return null;
    }

    const clamped = Math.min(4, Math.max(1, average));
    const angleDegrees = 180 + 60 * (clamped - 1);
    const angleRadians = (angleDegrees * Math.PI) / 180;
    return {
      x: 120 + 90 * Math.cos(angleRadians),
      y: 120 + 90 * Math.sin(angleRadians),
    };
  });

  // Tints the marker to match the band it's sitting in, using the same 2.5 / 3.5 thresholds as
  // performanceGaugeBandCounts, so it visually agrees with which legend row the average falls under.
  readonly performanceGaugeMarkerColor = computed(() => {
    const average = this.performanceGaugeAverage();
    if (average === null) {
      return '#0f172a';
    }

    if (average < 2.5) {
      return '#d03b3b';
    }

    return average < 3.5 ? '#ec835a' : '#0ca30c';
  });

  // Band thresholds mirror the gauge's colour zones: below 2.5 rounds to a rating of 2, 2.5–3.5
  // rounds to 3, 3.5 and up rounds to 4 (the scale's max). Ratings that would round to 1 are
  // folded into the same red/critical band as 2 — there's no separate zone for it, and it's
  // clearly no better.
  readonly performanceGaugeBandCounts = computed(() => {
    const rows = this.scoredPerformanceRows();
    const critical = rows.filter((row) => row.overallRating < 2.5).length;
    const serious = rows.filter((row) => row.overallRating >= 2.5 && row.overallRating < 3.5).length;
    const good = rows.filter((row) => row.overallRating >= 3.5).length;
    return { critical, serious, good, total: rows.length };
  });

  // Parks the bands/value in a hidden "pre-reveal" state and flips them into view a beat later, so
  // the gauge plays its pop-in animation fresh every time the admin lands on or returns to the
  // dashboard tab.
  readonly dashboardGaugeReady = signal(false);
  private readonly dashboardGaugePopEffect = effect((onCleanup) => {
    if (this.selectedPanel() !== 'dashboard') {
      this.dashboardGaugeReady.set(false);
      return;
    }

    this.dashboardGaugeReady.set(false);
    const timer = setTimeout(() => this.dashboardGaugeReady.set(true), 60);
    onCleanup(() => clearTimeout(timer));
  });

  readonly canDownloadCertificateLicenceReport = computed(() => this.certificateLicenceReportRows().length > 0);
  // The 3 ATR sub-reports below share one base dataset — approved external training requests
  // matched to their beneficiary's student record. Built directly (rather than as a flat
  // per-request list) since each needs the raw student record for demographic bucketing
  // (resolveBeneficiaryDemographics) and, for the aggregate reports, group-by/summing.
  private readonly completedTrainingEvents = computed<CompletedTrainingEvent[]>(() => {
    const studentsById = new Map(this.users().map((student) => [student.id, student]));
    const studentsByEmail = new Map(this.users().map((student) => [student.email.toLowerCase(), student]));
    const dateFrom = this.selectedAtrReportDateFrom();
    const dateTo = this.selectedAtrReportDateTo();

    return this.managerData.externalTrainingRequests()
      .filter((request) => request.status === 'Approved')
      .filter((request) => {
        const dateValue = this.normalizeReportDateValue(request.reviewedAt ?? request.submittedAt);
        if (dateFrom && (!dateValue || dateValue < dateFrom)) {
          return false;
        }
        if (dateTo && (!dateValue || dateValue > dateTo)) {
          return false;
        }
        return true;
      })
      .map((request) => ({
        request,
        student: (request.studentId ? studentsById.get(request.studentId) : undefined)
          ?? studentsByEmail.get(request.studentEmail.toLowerCase()),
      }));
  });
  readonly beneficiariesCompletedTrainingRows = computed<BeneficiariesCompletedTrainingRow[]>(() => {
    const groups = new Map<string, { sample: CompletedTrainingEvent; demographics: BeneficiaryDemographicCounts[]; totalCost: number }>();

    // This table counts learning interventions completed (one row per occupation/municipality/
    // programme, and a given occupation can have more than one row — one per distinct
    // intervention run during the year), not unique beneficiaries — that unique headcount is
    // numberBeneficiariesRows below. So every approved completion counts here, including a
    // beneficiary who completed the same programme more than once in the period.
    for (const event of this.completedTrainingEvents()) {
      const ofoOccupation = event.student?.ofoCode || 'Not captured';
      const municipality = event.student?.municipality || 'Not captured';
      const groupKey = [ofoOccupation, municipality, event.request.courseName].join('::');
      const existing = groups.get(groupKey);
      const cost = Number(event.request.courseCost) || 0;
      const demographics = event.student ? this.resolveBeneficiaryDemographics(event.student) : this.resolveBeneficiaryDemographics({ race: undefined, gender: undefined, idNumber: '', dateOfBirth: undefined });

      if (existing) {
        existing.demographics.push(demographics);
        existing.totalCost += cost;
      } else {
        groups.set(groupKey, { sample: event, demographics: [demographics], totalCost: cost });
      }
    }

    return Array.from(groups.entries()).map(([groupKey, group]) => {
      const counts = this.sumBeneficiaryDemographics(group.demographics);
      const [ofoOccupation, municipality] = groupKey.split('::');

      return {
        id: groupKey,
        ofoOccupation,
        municipality,
        nqfAlignedTraining: 'Not captured',
        nqfLevel: group.sample.student?.nqfLevel || 'Not captured',
        programmeNeedsAddressed: 'Not captured',
        fundingType: 'Not captured',
        dgContractNumber: 'Not captured',
        socioEconomicStatus: 'Not captured',
        typeOfLearningProgramme: this.mapToSetaLearningProgrammeType(group.sample.request.trainingType),
        nameOfLearningProgramme: group.sample.request.courseName,
        typeOfEducationalInstitution: 'Not captured',
        totalActualCost: group.totalCost,
        entryLevel: 0,
        intermediateLevel: 0,
        advancedLevel: 0,
        ...counts,
      };
    }).sort((left, right) => left.ofoOccupation.localeCompare(right.ofoOccupation) || left.municipality.localeCompare(right.municipality));
  });
  readonly canDownloadBeneficiariesCompletedTrainingReport = computed(() => this.beneficiariesCompletedTrainingRows().length > 0);

  readonly numberBeneficiariesRows = computed<NumberBeneficiariesRow[]>(() => {
    const groups = new Map<string, { demographics: BeneficiaryDemographicCounts[]; countedBeneficiaryKeys: Set<string> }>();

    for (const event of this.completedTrainingEvents()) {
      const ofoOccupation = event.student?.ofoCode || 'Not captured';
      const municipality = event.student?.municipality || 'Not captured';
      const groupKey = [ofoOccupation, municipality].join('::');
      // This table's headcount is the number of beneficiaries trained, not the number of
      // interventions completed — per SETA's guidance, a beneficiary who completed several
      // different courses in the period must still be counted once here, not once per course.
      const beneficiaryKey = event.request.studentId || event.request.studentEmail.toLowerCase();
      const existing = groups.get(groupKey);

      if (existing) {
        if (!existing.countedBeneficiaryKeys.has(beneficiaryKey)) {
          existing.countedBeneficiaryKeys.add(beneficiaryKey);
          existing.demographics.push(event.student ? this.resolveBeneficiaryDemographics(event.student) : this.resolveBeneficiaryDemographics({ race: undefined, gender: undefined, idNumber: '', dateOfBirth: undefined }));
        }
      } else {
        const demographics = event.student ? this.resolveBeneficiaryDemographics(event.student) : this.resolveBeneficiaryDemographics({ race: undefined, gender: undefined, idNumber: '', dateOfBirth: undefined });
        groups.set(groupKey, { demographics: [demographics], countedBeneficiaryKeys: new Set([beneficiaryKey]) });
      }
    }

    return Array.from(groups.entries()).map(([groupKey, group]) => {
      const [ofoOccupation, municipality] = groupKey.split('::');
      return {
        id: groupKey,
        ofoOccupation,
        municipality,
        ...this.sumBeneficiaryDemographics(group.demographics),
      };
    }).sort((left, right) => left.ofoOccupation.localeCompare(right.ofoOccupation) || left.municipality.localeCompare(right.municipality));
  });
  readonly canDownloadNumberBeneficiariesReport = computed(() => this.numberBeneficiariesRows().length > 0);

  // Pivotal programmes are a specific SETA grant category (Apprenticeships, Bursaries,
  // Internships, Learnerships, etc.) — this LMS doesn't capture that distinction, so every
  // completed-training event is included here rather than silently dropping rows a real
  // submission would need. pivotalOfoOccupation reuses the beneficiary's own OFO code since
  // there's no separate "target occupation of the Pivotal programme" field captured.
  readonly pivotalActualTrainingRows = computed<PivotalActualTrainingRow[]>(() => {
    return this.completedTrainingEvents().map((event) => {
      const ofoOccupation = event.student?.ofoCode || 'Not captured';
      const demographics = event.student ? this.resolveBeneficiaryDemographics(event.student) : this.resolveBeneficiaryDemographics({ race: undefined, gender: undefined, idNumber: '', dateOfBirth: undefined });

      return {
        id: event.request.id,
        ofoOccupation,
        municipality: event.student?.municipality || 'Not captured',
        programmeNeedsAddressed: 'Not captured',
        fundingType: 'Not captured',
        dgContractNumber: 'Not captured',
        idNumber: event.student?.idNumber || 'Not provided',
        firstName: event.student?.name || event.request.studentName.trim().split(/\s+/)[0] || 'Not provided',
        surname: event.student?.surname || event.request.studentName.trim().split(/\s+/).slice(1).join(' ') || 'Not provided',
        socioEconomicStatus: 'Not captured',
        typeOfLearningProgramme: this.mapToSetaLearningProgrammeType(event.request.trainingType),
        nameOfLearningProgramme: event.request.courseName,
        pivotalOfoOccupation: ofoOccupation,
        typeOfEducationalInstitution: 'Not captured',
        nqfLevel: event.student?.nqfLevel || 'Not captured',
        cost: Number(event.request.courseCost) || 0,
        entryLevel: 0,
        intermediateLevel: 0,
        advancedLevel: 0,
        ...demographics,
      };
    }).sort((left, right) => left.surname.localeCompare(right.surname) || left.firstName.localeCompare(right.firstName));
  });
  readonly canDownloadPivotalActualTrainingReport = computed(() => this.pivotalActualTrainingRows().length > 0);

  // "Planned training" for WSP purposes comes from two places per student: internal LMS course
  // assignments not yet completed, and IDP entries (Development Need field, used as the training
  // intervention name) that aren't marked Completed. Neither source distinguishes Pivotal from
  // non-Pivotal programmes, so — same reasoning as the ATR Pivotal report — every planned event
  // is included in both the non-Pivotal aggregate and the Pivotal per-learner report rather than
  // silently dropping rows a real submission would need.
  private readonly plannedTrainingEvents = computed<PlannedTrainingEvent[]>(() => {
    const offeringsById = new Map(this.managerData.offerings().map((offering) => [offering.id, offering]));
    const dateFrom = this.selectedWspReportDateFrom();
    const dateTo = this.selectedWspReportDateTo();
    const events: PlannedTrainingEvent[] = [];

    // Planned events have no single canonical "date" — course assignments carry a completion
    // deadline, IDP entries carry a target date. Both stand in as "when this planned training is
    // due" for the purposes of the date range filter below.
    const withinDateRange = (rawDate: string | null | undefined) => {
      if (!dateFrom && !dateTo) {
        return true;
      }

      const dateValue = this.normalizeReportDateValue(rawDate);
      if (dateFrom && (!dateValue || dateValue < dateFrom)) {
        return false;
      }
      if (dateTo && (!dateValue || dateValue > dateTo)) {
        return false;
      }
      return true;
    };

    for (const student of this.users()) {
      for (const offeringId of student.assignedOfferingIds) {
        const offering = offeringsById.get(offeringId);
        if (!offering) {
          continue;
        }

        if (this.resolveReportCompletionStatus(student, offeringId, offering.title) === 'Completed') {
          continue;
        }

        if (!withinDateRange(offering.completionDeadline)) {
          continue;
        }

        events.push({
          student,
          nameOfLearningProgramme: offering.title,
          typeOfLearningProgramme: offering.type === 'Programme'
            ? 'Learnership'
            : 'Short Skills Programme / Courses (E.g. Accredited / Non-Accredited)',
        });
      }

      for (const entry of this.allIdpEntriesForStudent(student.id)) {
        const developmentNeed = entry.developmentNeed?.trim();
        if (!developmentNeed || entry.status === 'Completed') {
          continue;
        }

        if (!withinDateRange(entry.targetDate)) {
          continue;
        }

        events.push({ student, nameOfLearningProgramme: developmentNeed, typeOfLearningProgramme: 'Not captured' });
      }
    }

    return events;
  });
  readonly wspBeneficiariesPlannedRows = computed<WspBeneficiariesPlannedRow[]>(() => {
    const groups = new Map<string, { sample: PlannedTrainingEvent; demographics: BeneficiaryDemographicCounts[] }>();

    for (const event of this.plannedTrainingEvents()) {
      const ofoOccupation = event.student.ofoCode || 'Not captured';
      const municipality = event.student.municipality || 'Not captured';
      const groupKey = [ofoOccupation, municipality, event.nameOfLearningProgramme].join('::');
      const demographics = this.resolveBeneficiaryDemographics(event.student);
      const existing = groups.get(groupKey);

      if (existing) {
        existing.demographics.push(demographics);
      } else {
        groups.set(groupKey, { sample: event, demographics: [demographics] });
      }
    }

    return Array.from(groups.entries()).map(([groupKey, group]) => {
      const [ofoOccupation, municipality] = groupKey.split('::');

      return {
        id: groupKey,
        ofoOccupation,
        municipality,
        nqfAlignedTraining: 'Not captured',
        nqfLevel: group.sample.student.nqfLevel || 'Not captured',
        programmeNeedsAddressed: 'Not captured',
        fundingType: 'Not captured',
        dgContractNumber: 'Not captured',
        socioEconomicStatus: 'Not captured',
        typeOfLearningProgramme: group.sample.typeOfLearningProgramme,
        nameOfLearningProgramme: group.sample.nameOfLearningProgramme,
        typeOfEducationalInstitution: 'Not captured',
        // Neither internal course assignments nor IDP development needs carry a cost.
        totalEstimatedCost: 0,
        entryLevel: 0,
        intermediateLevel: 0,
        advancedLevel: 0,
        ...this.sumBeneficiaryDemographics(group.demographics),
      };
    }).sort((left, right) => left.ofoOccupation.localeCompare(right.ofoOccupation) || left.municipality.localeCompare(right.municipality));
  });
  readonly canDownloadWspBeneficiariesPlannedReport = computed(() => this.wspBeneficiariesPlannedRows().length > 0);

  // Unlike the other WSP/ATR reports, Employment Summary profiles the whole workforce (every
  // user in the LMS), not just those with planned training — that's the standard meaning of
  // "Employment Summary" in a WSP submission.
  readonly wspEmploymentSummaryRows = computed<WspEmploymentSummaryRow[]>(() => {
    const groups = new Map<string, BeneficiaryDemographicCounts[]>();

    for (const student of this.users()) {
      const ofoOccupation = student.ofoCode || 'Not captured';
      const municipality = student.municipality || 'Not captured';
      const groupKey = [ofoOccupation, municipality].join('::');
      const demographics = this.resolveBeneficiaryDemographics(student);
      const existing = groups.get(groupKey);

      if (existing) {
        existing.push(demographics);
      } else {
        groups.set(groupKey, [demographics]);
      }
    }

    return Array.from(groups.entries()).map(([groupKey, demographics]) => {
      const [ofoOccupation, municipality] = groupKey.split('::');
      return { id: groupKey, ofoOccupation, municipality, ...this.sumBeneficiaryDemographics(demographics) };
    }).sort((left, right) => left.ofoOccupation.localeCompare(right.ofoOccupation) || left.municipality.localeCompare(right.municipality));
  });
  readonly canDownloadWspEmploymentSummaryReport = computed(() => this.wspEmploymentSummaryRows().length > 0);

  readonly wspPivotalPlannedRows = computed<WspPivotalPlannedRow[]>(() => {
    return this.plannedTrainingEvents().map((event, index) => {
      const ofoOccupation = event.student.ofoCode || 'Not captured';

      return {
        id: `${event.student.id}::${index}`,
        ofoOccupation,
        municipality: event.student.municipality || 'Not captured',
        programmeNeedsAddressed: 'Not captured',
        fundingType: 'Not captured',
        dgContractNumber: 'Not captured',
        idNumber: event.student.idNumber || 'Not provided',
        firstName: event.student.name || 'Not provided',
        surname: event.student.surname || 'Not provided',
        socioEconomicStatus: 'Not captured',
        typeOfLearningProgramme: event.typeOfLearningProgramme,
        nameOfLearningProgramme: event.nameOfLearningProgramme,
        pivotalOfoOccupation: ofoOccupation,
        typeOfEducationalInstitution: 'Not captured',
        nqfLevel: event.student.nqfLevel || 'Not captured',
        cost: 0,
        entryLevel: 0,
        intermediateLevel: 0,
        advancedLevel: 0,
        ...this.resolveBeneficiaryDemographics(event.student),
      };
    }).sort((left, right) => left.surname.localeCompare(right.surname) || left.firstName.localeCompare(right.firstName));
  });
  readonly canDownloadWspPivotalPlannedReport = computed(() => this.wspPivotalPlannedRows().length > 0);

  readonly singleUserForm = this.createUserForm();
  readonly userEditForm = this.createUserForm();

  private welcomeBannerExitTimer: ReturnType<typeof setTimeout> | null = null;
  private welcomeBannerHideTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    this.loadSwitchableRoles();
    this.loadOwnIdentity();
    this.loadOfoCodeOptions();
    this.loadMunicipalityOptions();
    this.startWelcomeBannerSequence();
  }

  private loadOfoCodeOptions() {
    this.http.get<string[]>('/ofo-codes.json').subscribe({
      next: (codes) => this.ofoCodeOptions.set(codes),
      error: () => this.ofoCodeOptions.set([]),
    });
  }

  private loadMunicipalityOptions() {
    this.http.get<string[]>('/municipalities.json').subscribe({
      next: (names) => this.municipalityOptions.set(names),
      error: () => this.municipalityOptions.set([]),
    });
  }

  ngOnDestroy() {
    this.clearWelcomeBannerTimers();
    if (this.sidebarScrollTimeout) {
      clearTimeout(this.sidebarScrollTimeout);
    }
    if (this.assignWizardToastTimer) {
      clearTimeout(this.assignWizardToastTimer);
    }
    this.reportSnapshotRefreshSub.unsubscribe();
  }

  /** Shows the sidebar's scrollbar thumb only while actively scrolling, hiding it again
   *  shortly after — keeps the sidebar looking clean instead of a permanent scroll track. */
  onSidebarScroll() {
    this.sidebarScrolling.set(true);
    if (this.sidebarScrollTimeout) {
      clearTimeout(this.sidebarScrollTimeout);
    }
    this.sidebarScrollTimeout = setTimeout(() => this.sidebarScrolling.set(false), 900);
  }

  selectReportView(view: AdminReportView) {
    this.selectedReportView.set(view);
    this.selectedSetaReportTab.set(null);
    this.selectedAtrSubReport.set(null);
    this.selectedWspSubReport.set(null);
  }

  clearReportView() {
    this.selectedReportView.set(null);
    this.selectedSetaReportTab.set(null);
    this.selectedAtrSubReport.set(null);
    this.selectedWspSubReport.set(null);
  }

  selectSetaReportTab(tab: SetaReportTab) {
    this.selectedSetaReportTab.set(tab);
    this.selectedAtrSubReport.set(null);
    this.selectedWspSubReport.set(null);
  }

  selectAtrSubReport(subReport: AtrSubReport) {
    this.selectedAtrSubReport.set(subReport);
  }

  selectWspSubReport(subReport: WspSubReport) {
    this.selectedWspSubReport.set(subReport);
  }

  backFromReportView() {
    if (this.selectedReportView() === 'seta-report' && this.selectedSetaReportTab() === 'atr' && this.selectedAtrSubReport()) {
      this.selectedAtrSubReport.set(null);
      return;
    }

    if (this.selectedReportView() === 'seta-report' && this.selectedSetaReportTab() === 'wsp' && this.selectedWspSubReport()) {
      this.selectedWspSubReport.set(null);
      return;
    }

    if (this.selectedReportView() === 'seta-report' && this.selectedSetaReportTab()) {
      this.selectedSetaReportTab.set(null);
      return;
    }

    this.clearReportView();
  }

  selectSettingsSection(section: AdminSettingsSection) {
    this.selectedSettingsSection.set(section);
    if (section === 'hr-integration') {
      this.loadHrIntegrationConfig();
    }
    if (section === 'approval-settings') {
      const settings = this.managerData.approvalWorkflowSettings();
      this.approvalWorkflowKpiApproversRequired.set(settings.kpiApproversRequired);
      this.approvalWorkflowTrainingApproversRequired.set(settings.trainingApproversRequired);
      this.approvalWorkflowSettingsMessage.set('');
    }
  }

  clearSettingsSection() {
    this.selectedSettingsSection.set(null);
  }

  // ── Approval settings ─────────────────────────────────────────────────
  // The trainingManagers collection (patched via the existing PUT /api/manager-state — see
  // TrainingManagerDataService.upsertApprovingManager/deleteApprovingManager) is the admin-managed
  // pool a student picks from when choosing who should approve an external training request. It
  // had no management UI anywhere before this.
  readonly editingApprovingManagerId = signal<string | null>(null);
  readonly approvingManagerFormName = signal('');
  readonly approvingManagerFormRole = signal('');
  readonly approvingManagerFormTeam = signal('');
  readonly approvingManagerFormEmail = signal('');
  readonly approvingManagerFormError = signal('');
  readonly selectedManagerBulkUploadTemplateFormat = signal<ReportDownloadFormat>('CSV');
  readonly managerBulkUploadMessage = signal('');
  readonly managerBulkUploadTone = signal<'success' | 'error'>('success');
  readonly managerBulkUploadIssues = signal<BulkUploadIssue[]>([]);

  // How many approvers KPI ratings / training requests require (see
  // TrainingManagerDataService.approvalWorkflowSettings) — staged locally so an in-progress edit
  // isn't clobbered by a background bootstrap refresh, then pushed to the server on Save.
  readonly approverCountOptions = [1, 2, 3, 4, 5];
  readonly approvalWorkflowKpiApproversRequired = signal(1);
  readonly approvalWorkflowTrainingApproversRequired = signal(1);
  readonly savingApprovalWorkflowSettings = signal(false);
  readonly approvalWorkflowSettingsMessage = signal('');
  readonly approvalWorkflowSettingsTone = signal<'success' | 'error'>('success');

  async saveApprovalWorkflowSettings() {
    this.savingApprovalWorkflowSettings.set(true);
    this.approvalWorkflowSettingsMessage.set('');
    const result = await this.managerData.updateApprovalWorkflowSettings({
      kpiApproversRequired: this.approvalWorkflowKpiApproversRequired(),
      trainingApproversRequired: this.approvalWorkflowTrainingApproversRequired(),
    });
    this.savingApprovalWorkflowSettings.set(false);
    this.approvalWorkflowSettingsTone.set(result.success ? 'success' : 'error');
    this.approvalWorkflowSettingsMessage.set(result.success ? 'Approval settings saved.' : result.message);
  }

  // Flags the exact footgun that let a training request silently go to the wrong recipient: the
  // student's approving-manager dropdown shows only a name (see student-profile.component.ts), so
  // an explicit entry here sharing a name with an active roster manager but a DIFFERENT email is
  // indistinguishable to a student picking between them — whichever one they don't mean to pick
  // still "succeeds" (the request is created and confirmed), it just goes to the wrong inbox and
  // is never seen by the person who actually goes by that name. Purely advisory, not a save block:
  // a coincidental same-name-different-person case is legitimate and shouldn't be blocked.
  readonly approvingManagerFormNameConflict = computed(() => {
    const name = this.approvingManagerFormName().trim().toLowerCase();
    if (!name) {
      return null;
    }

    const email = this.approvingManagerFormEmail().trim().toLowerCase();
    return this.managerData.students().find((student) =>
      student.role === 'manager'
      && student.activeStatus === 'Active'
      && `${student.name} ${student.surname}`.trim().toLowerCase() === name
      && student.email.trim().toLowerCase() !== email,
    ) ?? null;
  });

  approverInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return '?';
    }

    return parts.length === 1 ? parts[0][0].toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  openNewApprovingManagerForm() {
    this.approvingManagerFormName.set('');
    this.approvingManagerFormRole.set('');
    this.approvingManagerFormTeam.set('');
    this.approvingManagerFormEmail.set('');
    this.approvingManagerFormError.set('');
    this.editingApprovingManagerId.set('new');
  }

  openEditApprovingManagerForm(manager: SystemTrainingManager) {
    this.approvingManagerFormName.set(manager.name);
    this.approvingManagerFormRole.set(manager.role);
    this.approvingManagerFormTeam.set(manager.team);
    this.approvingManagerFormEmail.set(manager.email);
    this.approvingManagerFormError.set('');
    this.editingApprovingManagerId.set(manager.id);
  }

  closeApprovingManagerForm() {
    this.editingApprovingManagerId.set(null);
  }

  saveApprovingManagerForm() {
    const name = this.approvingManagerFormName().trim();
    const role = this.approvingManagerFormRole().trim();
    const team = this.approvingManagerFormTeam().trim();
    const email = this.approvingManagerFormEmail().trim().toLowerCase();

    if (!name || !role || !team || !email) {
      this.approvingManagerFormError.set('Name, title, team and email are all required.');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.approvingManagerFormError.set('Enter a valid email address.');
      return;
    }

    const editingId = this.editingApprovingManagerId();
    const isNew = !editingId || editingId === 'new';
    const emailTaken = this.managerData.explicitTrainingManagers().some(
      (manager) => manager.email.trim().toLowerCase() === email && (isNew || manager.id !== editingId),
    );
    if (emailTaken) {
      this.approvingManagerFormError.set('Another approving manager already uses this email address.');
      return;
    }

    const id = isNew ? `training-manager-${Date.now()}` : editingId;

    this.managerData.upsertApprovingManager({ id, name, role, team, email });
    this.editingApprovingManagerId.set(null);
  }

  deleteApprovingManagerFromForm() {
    const managerId = this.editingApprovingManagerId();
    if (!managerId || managerId === 'new') {
      return;
    }

    this.managerData.deleteApprovingManager(managerId);
    this.editingApprovingManagerId.set(null);
  }

  private getApprovingManagerUploadTemplateRows() {
    return [
      ['Name', 'Title', 'Team', 'Email'],
      ['Jane Doe', 'Training Manager', 'Learning & Development', 'jane.doe@example.com'],
    ];
  }

  downloadApprovingManagerUploadTemplate() {
    if (this.selectedManagerBulkUploadTemplateFormat() === 'XLSX') {
      void this.downloadApprovingManagerUploadTemplateXlsx();
      return;
    }

    this.downloadApprovingManagerUploadTemplateCsv();
  }

  downloadApprovingManagerUploadTemplateCsv() {
    const csv = this.getApprovingManagerUploadTemplateRows()
      .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'LMS-Approving-Managers-Template.csv');
  }

  async downloadApprovingManagerUploadTemplateXlsx() {
    const xlsx = await import('xlsx');
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet(this.getApprovingManagerUploadTemplateRows());

    xlsx.utils.book_append_sheet(workbook, worksheet, 'Approving Managers');
    const workbookArray = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.triggerDownload(new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'LMS-Approving-Managers-Template.xlsx');
  }

  async handleApprovingManagerBulkUpload(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;

    if (!file) {
      return;
    }

    try {
      this.managerBulkUploadIssues.set([]);
      const parsedUpload = await this.parseApprovingManagerUploadFile(file);
      this.managerBulkUploadIssues.set(parsedUpload.issues);

      if (!parsedUpload.rows.length) {
        this.managerBulkUploadTone.set('error');
        this.managerBulkUploadMessage.set(
          parsedUpload.issues.length ? 'No valid rows were found. Review the upload issues below.' : 'No valid rows were found in the uploaded file.',
        );
        return;
      }

      const result = this.managerData.bulkUpsertApprovingManagers(parsedUpload.rows);
      this.managerBulkUploadTone.set(parsedUpload.issues.length ? 'error' : 'success');
      this.managerBulkUploadMessage.set(
        `Bulk upload complete. ${result.added} added, ${result.updated} updated.${parsedUpload.issues.length ? ` ${parsedUpload.issues.length} row issue(s) need attention.` : ''}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bulk upload failed.';
      this.managerBulkUploadTone.set('error');
      this.managerBulkUploadMessage.set(message);
      this.managerBulkUploadIssues.set([]);
    } finally {
      if (input) {
        input.value = '';
      }
    }
  }

  private async parseApprovingManagerUploadFile(file: File): Promise<{ rows: Omit<SystemTrainingManager, 'id'>[]; issues: BulkUploadIssue[] }> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'xlsx') {
      const xlsx = await import('xlsx');
      const fileBuffer = await file.arrayBuffer();
      const workbook = xlsx.read(fileBuffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        return { rows: [], issues: [] };
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = xlsx.utils.sheet_to_json<(string | number | boolean | Date)[]>(worksheet, {
        header: 1,
        raw: false,
        defval: '',
        blankrows: true,
      });

      return this.parseApprovingManagerUploadRows(rawRows.map((row) => row.map((value) => String(value ?? ''))));
    }

    const csvText = await file.text();
    const rawRows = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .map((line) => (line ? this.parseCsvLine(line) : []));

    return this.parseApprovingManagerUploadRows(rawRows);
  }

  private parseApprovingManagerUploadRows(rawRows: string[][]): { rows: Omit<SystemTrainingManager, 'id'>[]; issues: BulkUploadIssue[] } {
    if (rawRows.length < 2) {
      return { rows: [], issues: [] };
    }

    const headers = rawRows[0].map((header) => this.normalizeCsvHeader(header));
    const requiredHeaders = ['name', 'title', 'team', 'email'];

    if (requiredHeaders.some((header) => !headers.includes(header))) {
      throw new Error('The upload file is missing one or more required fields: Name, Title, Team, Email.');
    }

    const rows: Omit<SystemTrainingManager, 'id'>[] = [];
    const issues: BulkUploadIssue[] = [];
    const seenEmails = new Set<string>();

    rawRows.slice(1).forEach((values, rowIndex) => {
      const lineNumber = rowIndex + 2;

      if (values.length === 0 || values.every((value) => !value?.trim())) {
        return;
      }

      const record = new Map<string, string>();
      headers.forEach((header, index) => {
        record.set(header, values[index]?.trim() ?? '');
      });

      const row = this.buildApprovingManagerUploadRow(record, lineNumber, seenEmails);

      if ('message' in row) {
        issues.push(row);
        return;
      }

      rows.push(row);
    });

    return { rows, issues };
  }

  private buildApprovingManagerUploadRow(record: Map<string, string>, lineNumber: number, seenEmails: Set<string>): Omit<SystemTrainingManager, 'id'> | BulkUploadIssue {
    const name = (record.get('name') ?? '').trim();
    const role = (record.get('title') ?? '').trim();
    const team = (record.get('team') ?? '').trim();
    const email = (record.get('email') ?? '').trim().toLowerCase();

    if (!name || !role || !team || !email) {
      return { lineNumber, message: 'Name, title, team and email are all required.' };
    }

    if (!this.isValidEmail(email)) {
      return { lineNumber, message: 'Email address is invalid.' };
    }

    if (seenEmails.has(email)) {
      return { lineNumber, message: 'Email is duplicated in this file.' };
    }

    seenEmails.add(email);
    return { name, role, team, email };
  }

  private async loadHrIntegrationConfig() {
    this.hrIntegrationLoading.set(true);
    this.hrIntegrationSaveError.set(null);
    try {
      const config = await firstValueFrom(this.backend.getHrIntegrationConfig());
      this.hrIntegrationConfig.set(config);
      this.hrIntegrationForm.patchValue({
        enabled: config.enabled,
        baseUrl: config.baseUrl,
        authHeaderName: config.authHeaderName || 'Authorization',
        authHeaderValue: '',
      });
    } catch {
      this.hrIntegrationSaveError.set('Could not load the HR integration settings. Try again.');
    } finally {
      this.hrIntegrationLoading.set(false);
    }
  }

  async saveHrIntegrationConfig() {
    if (this.hrIntegrationForm.invalid || this.hrIntegrationSaving()) {
      return;
    }

    this.hrIntegrationSaving.set(true);
    this.hrIntegrationSaveError.set(null);
    const value = this.hrIntegrationForm.getRawValue();

    try {
      const config = await firstValueFrom(this.backend.updateHrIntegrationConfig({
        enabled: value.enabled,
        baseUrl: value.baseUrl.trim(),
        authHeaderName: value.authHeaderName.trim() || 'Authorization',
        authHeaderValue: value.authHeaderValue.trim() || undefined,
      }));
      this.hrIntegrationConfig.set(config);
      // Blank again after a successful save — the server never echoes the real credential back,
      // so leaving whatever was typed on screen would misleadingly suggest it wasn't saved.
      this.hrIntegrationForm.controls.authHeaderValue.setValue('');
    } catch {
      this.hrIntegrationSaveError.set('Could not save the HR integration settings. Check the URL and try again.');
    } finally {
      this.hrIntegrationSaving.set(false);
    }
  }

  async syncHrRosterNow() {
    if (this.hrIntegrationSyncing() || !this.hrIntegrationConfig()?.enabled) {
      return;
    }

    this.hrIntegrationSyncing.set(true);
    this.hrIntegrationSyncError.set(null);

    try {
      const summary = await firstValueFrom(this.backend.syncHrRoster());
      this.hrIntegrationConfig.update((current) => current ? { ...current, lastSyncSummary: summary } : current);
    } catch (error) {
      const message = error instanceof Object && 'error' in error && (error as { error?: { message?: string } }).error?.message
        ? (error as { error: { message: string } }).error.message
        : 'The sync could not be completed. Check the connection settings and try again.';
      this.hrIntegrationSyncError.set(message);
    } finally {
      this.hrIntegrationSyncing.set(false);
    }
  }

  private normalizeReportDateValue(dateValue: string | null | undefined) {
    const normalizedValue = dateValue?.trim() ?? '';

    if (!normalizedValue) {
      return '';
    }

    const isoDateMatch = normalizedValue.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoDateMatch) {
      return isoDateMatch[1];
    }

    const parsedDate = new Date(normalizedValue);
    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    const year = String(parsedDate.getFullYear());
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatReportDateLabel(dateValue: string | null | undefined) {
    const normalizedValue = dateValue?.trim() ?? '';

    if (!normalizedValue) {
      return 'Not captured';
    }

    const isoDateMatch = normalizedValue.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoDateMatch) {
      return isoDateMatch[1];
    }

    return normalizedValue;
  }

  updateUserSearch(event: Event) {
    const input = event.target as HTMLInputElement | null;
    this.userSearchTerm.set(input?.value ?? '');
  }

  updateBulkUploadTemplateFormat(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    this.selectedBulkUploadTemplateFormat.set(input?.value === 'XLSX' ? 'XLSX' : 'CSV');
  }

  updateAnnualReportDownloadFormat(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    this.selectedAnnualReportDownloadFormat.set(input?.value === 'XLSX' ? 'XLSX' : 'CSV');
  }

  updateIdpReportDownloadFormat(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    this.selectedIdpReportDownloadFormat.set(input?.value === 'XLSX' ? 'XLSX' : 'CSV');
  }

  updateSuccessionReportDownloadFormat(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    this.selectedSuccessionReportDownloadFormat.set(input?.value === 'XLSX' ? 'XLSX' : 'CSV');
  }

  updatePerformanceReportDownloadFormat(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    this.selectedPerformanceReportDownloadFormat.set(input?.value === 'XLSX' ? 'XLSX' : 'CSV');
  }

  updateCertificateReportDownloadFormat(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    this.selectedCertificateReportDownloadFormat.set(input?.value === 'XLSX' ? 'XLSX' : 'CSV');
  }

  updateAnnualReportSearch(event: Event) {
    const input = event.target as HTMLInputElement | null;
    this.annualReportSearchTerm.set(input?.value ?? '');
  }

  updateAnnualReportDepartment(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    this.selectedAnnualReportDepartment.set(input?.value ?? '');
  }

  updateTrainingRecordApprovingManager(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    this.trainingRecordApprovingManagerId.set(input?.value ?? '');
  }

  updateAnnualReportSource(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    const nextValue = input?.value === 'LMS' || input?.value === 'External' ? input.value : 'All';
    this.selectedAnnualReportSource.set(nextValue);
  }

  updateAnnualReportDateFrom(event: Event) {
    const input = event.target as HTMLInputElement | null;
    this.selectedAnnualReportDateFrom.set(input?.value ?? '');
  }

  updateAnnualReportDateTo(event: Event) {
    const input = event.target as HTMLInputElement | null;
    this.selectedAnnualReportDateTo.set(input?.value ?? '');
  }

  clearAnnualReportFilters() {
    this.annualReportSearchTerm.set('');
    this.selectedAnnualReportDepartment.set('');
    this.selectedAnnualReportSource.set('All');
    this.selectedAnnualReportDateFrom.set('');
    this.selectedAnnualReportDateTo.set('');
  }

  updateAtrReportDateFrom(event: Event) {
    const input = event.target as HTMLInputElement | null;
    this.selectedAtrReportDateFrom.set(input?.value ?? '');
  }

  updateAtrReportDateTo(event: Event) {
    const input = event.target as HTMLInputElement | null;
    this.selectedAtrReportDateTo.set(input?.value ?? '');
  }

  clearAtrReportDateFilters() {
    this.selectedAtrReportDateFrom.set('');
    this.selectedAtrReportDateTo.set('');
  }

  updateWspReportDateFrom(event: Event) {
    const input = event.target as HTMLInputElement | null;
    this.selectedWspReportDateFrom.set(input?.value ?? '');
  }

  updateWspReportDateTo(event: Event) {
    const input = event.target as HTMLInputElement | null;
    this.selectedWspReportDateTo.set(input?.value ?? '');
  }

  clearWspReportDateFilters() {
    this.selectedWspReportDateFrom.set('');
    this.selectedWspReportDateTo.set('');
  }


  updateAtrSubReportDownloadFormat(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    this.selectedAtrSubReportDownloadFormat.set(input?.value === 'XLSX' ? 'XLSX' : 'CSV');
  }

  updateWspSubReportDownloadFormat(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    this.selectedWspSubReportDownloadFormat.set(input?.value === 'XLSX' ? 'XLSX' : 'CSV');
  }

  async handleBulkUserUpload(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;

    if (!file) {
      return;
    }

    try {
      this.bulkUploadIssues.set([]);
      const parsedUpload = await this.parseBulkUploadFile(file);
      const rows = parsedUpload.rows;
      this.bulkUploadIssues.set(parsedUpload.issues);

      if (!rows.length) {
        this.bulkUploadTone.set('error');
        this.bulkUploadMessage.set(parsedUpload.issues.length ? 'No valid user rows were found. Review the upload issues below.' : 'No valid user rows were found in the uploaded file.');
        return;
      }

      const result = this.managerData.bulkUpsertStudents(rows.map((row) => row.student));

      try {
        const credentialResult = await this.syncManagedUserCredentials(rows.map((row) => ({
          email: row.student.email,
          password: row.password,
        })));
        const passwordSummary = this.buildBulkUploadPasswordSummary(credentialResult);
        this.bulkUploadTone.set(parsedUpload.issues.length ? 'error' : 'success');
        this.bulkUploadMessage.set(
          `Bulk upload complete. ${result.added} added, ${result.updated} updated, ${result.skipped} skipped.${passwordSummary}${parsedUpload.issues.length ? ` ${parsedUpload.issues.length} row issue(s) need attention.` : ''}`,
        );
      } catch {
        this.bulkUploadTone.set('error');
        this.bulkUploadMessage.set(
          `Bulk upload complete. ${result.added} added, ${result.updated} updated, ${result.skipped} skipped. Password details could not be saved.${parsedUpload.issues.length ? ` ${parsedUpload.issues.length} row issue(s) need attention.` : ''}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bulk upload failed.';
      this.bulkUploadTone.set('error');
      this.bulkUploadMessage.set(message);
      this.bulkUploadIssues.set([]);
    } finally {
      if (input) {
        input.value = '';
      }
    }
  }

  downloadTrainingRecordUploadTemplate() {
    const csv = this.getTrainingRecordUploadTemplateRows()
      .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'LMS-Training-Records-Template.csv');
  }

  private getTrainingRecordUploadTemplateRows() {
    return [
      ['Learner Email', 'Course Name', 'Provider', 'Training Type', 'Start Date', 'End Date'],
      ['lebo.mokoena@example.com', 'First Aid Level 1', 'Red Cross', 'Short Course', '2026-02-10', '2026-02-12'],
    ];
  }

  // Bulk-uploaded training records are backfilled, already-completed history (that's the whole
  // point of a bulk import for SETA compliance) — created via the same
  // POST /api/external-training-requests the single "add training request" form uses (so every
  // required-field/approving-manager check that endpoint already does still applies here), then
  // immediately approved via PUT /.../review with this admin as reviewer. Both calls go straight
  // through LmsBackendService rather than the optimistic managerData.submitExternalTrainingRequest/
  // reviewExternalTrainingRequest wrappers, because those update the local signal under a
  // temporary client-side id and fire the real HTTP write without awaiting it — this flow needs
  // the *real* server-assigned id back from the create call before it can review that same record,
  // which only a directly-awaited request can guarantee.
  async handleTrainingRecordUpload(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;

    if (!file) {
      return;
    }

    const approvingManagerId = this.trainingRecordApprovingManagerId();
    if (!approvingManagerId) {
      this.trainingRecordUploadTone.set('error');
      this.trainingRecordUploadMessage.set('Choose an approving manager before uploading.');
      this.trainingRecordUploadIssues.set([]);
      if (input) {
        input.value = '';
      }
      return;
    }

    this.trainingRecordUploadInProgress.set(true);
    this.trainingRecordUploadIssues.set([]);

    try {
      const parsedUpload = await this.parseTrainingRecordUploadFile(file);
      const issues = [...parsedUpload.issues];

      if (!parsedUpload.rows.length) {
        this.trainingRecordUploadTone.set('error');
        this.trainingRecordUploadMessage.set(issues.length ? 'No valid training records were found. Review the upload issues below.' : 'No valid training records were found in the uploaded file.');
        this.trainingRecordUploadIssues.set(issues);
        return;
      }

      let added = 0;
      const reviewerName = this.adminName().trim() || 'Administrator';

      for (const { lineNumber, row } of parsedUpload.rows) {
        try {
          const created = await firstValueFrom(this.backend.createExternalTrainingRequest({
            studentId: row.studentId,
            studentName: row.studentName,
            studentEmail: row.studentEmail,
            courseName: row.courseName,
            provider: row.provider,
            trainingType: row.trainingType,
            alignedToIdp: 'No',
            trainingStartDate: row.trainingStartDate,
            trainingEndDate: row.trainingEndDate,
            courseCost: '0',
            additionalCostRequired: 'No',
            travelCost: '',
            examCost: '',
            accommodationCost: '',
            approvingManagerId,
            invoiceFileName: '',
            invoiceDataUrl: '',
            brochureFileName: '',
            brochureDataUrl: '',
          }));

          await firstValueFrom(this.backend.reviewExternalTrainingRequest({
            requestId: created.id,
            reviewerName,
            status: 'Approved',
            feedback: 'Bulk-imported and approved.',
          }));

          added += 1;
        } catch {
          issues.push({ lineNumber, message: `Could not save the training record for ${row.studentEmail}.` });
        }
      }

      this.trainingRecordUploadIssues.set(issues);
      this.trainingRecordUploadTone.set(issues.length ? 'error' : 'success');
      this.trainingRecordUploadMessage.set(
        `Bulk upload complete. ${added} training record(s) added and approved.${issues.length ? ` ${issues.length} row issue(s) need attention.` : ''}`,
      );

      if (added) {
        // Pulls the freshly created+approved records into managerData's live signals immediately,
        // rather than leaving the report views to catch up on the next 20s poll.
        await this.managerData.refreshNow();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bulk upload failed.';
      this.trainingRecordUploadTone.set('error');
      this.trainingRecordUploadMessage.set(message);
      this.trainingRecordUploadIssues.set([]);
    } finally {
      this.trainingRecordUploadInProgress.set(false);
      if (input) {
        input.value = '';
      }
    }
  }

  private async parseTrainingRecordUploadFile(file: File): Promise<{ rows: Array<{ lineNumber: number; row: TrainingRecordUploadRow }>; issues: BulkUploadIssue[] }> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'xlsx') {
      const xlsx = await import('xlsx');
      const fileBuffer = await file.arrayBuffer();
      const workbook = xlsx.read(fileBuffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        return { rows: [], issues: [] };
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = xlsx.utils.sheet_to_json<(string | number | boolean | Date)[]>(worksheet, {
        header: 1,
        raw: false,
        defval: '',
        blankrows: true,
        dateNF: 'yyyy-mm-dd',
      });

      return this.parseTrainingRecordUploadRows(rawRows.map((row) => row.map((value) => String(value ?? ''))));
    }

    const csvText = await file.text();
    const rawRows = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .map((line) => (line ? this.parseCsvLine(line) : []));

    return this.parseTrainingRecordUploadRows(rawRows);
  }

  private parseTrainingRecordUploadRows(rawRows: string[][]): { rows: Array<{ lineNumber: number; row: TrainingRecordUploadRow }>; issues: BulkUploadIssue[] } {
    if (rawRows.length < 2) {
      return { rows: [], issues: [] };
    }

    const headers = rawRows[0].map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const requiredHeaders = ['learneremail', 'coursename', 'provider', 'trainingtype', 'startdate', 'enddate'];

    if (requiredHeaders.some((header) => !headers.includes(header))) {
      throw new Error('The upload file is missing one or more required fields: Learner Email, Course Name, Provider, Training Type, Start Date, End Date.');
    }

    const rows: Array<{ lineNumber: number; row: TrainingRecordUploadRow }> = [];
    const issues: BulkUploadIssue[] = [];

    rawRows.slice(1).forEach((values, rowIndex) => {
      const lineNumber = rowIndex + 2;

      if (values.length === 0 || values.every((value) => !value?.trim())) {
        return;
      }

      const record = new Map<string, string>();
      headers.forEach((header, index) => {
        record.set(header, values[index]?.trim() ?? '');
      });

      const built = this.buildTrainingRecordUploadRow(record, lineNumber);
      if ('message' in built) {
        issues.push(built);
        return;
      }

      rows.push({ lineNumber, row: built });
    });

    return { rows, issues };
  }

  private buildTrainingRecordUploadRow(record: Map<string, string>, lineNumber: number): TrainingRecordUploadRow | BulkUploadIssue {
    const email = (record.get('learneremail') ?? '').trim().toLowerCase();
    const courseName = (record.get('coursename') ?? '').trim();
    const provider = (record.get('provider') ?? '').trim();
    const rawTrainingType = (record.get('trainingtype') ?? '').trim();
    const trainingStartDate = this.normalizeBulkUploadDate(record.get('startdate') ?? '');
    const trainingEndDate = this.normalizeBulkUploadDate(record.get('enddate') ?? '');

    if (!email || !courseName || !provider || !rawTrainingType) {
      return { lineNumber, message: 'Required values are missing.' };
    }

    if (!this.isValidEmail(email)) {
      return { lineNumber, message: 'Learner email is invalid.' };
    }

    if (!trainingStartDate || !trainingEndDate) {
      return { lineNumber, message: 'Start date or end date is invalid.' };
    }

    const trainingType = this.normalizeTrainingType(rawTrainingType);
    if (!trainingType) {
      return { lineNumber, message: 'Training type must be Accredited, Workshop/Seminar, Informal Training, or Short Course.' };
    }

    const student = this.users().find((entry) => entry.email.toLowerCase() === email);
    if (!student) {
      return { lineNumber, message: `No matching learner found for ${email}.` };
    }

    return {
      studentId: student.id,
      studentName: `${student.name} ${student.surname}`.trim(),
      studentEmail: student.email,
      courseName,
      provider,
      trainingType,
      trainingStartDate,
      trainingEndDate,
    };
  }

  private normalizeTrainingType(value: string): TrainingRecordUploadRow['trainingType'] | null {
    switch (value.trim().toLowerCase()) {
      case 'accredited':
        return 'Accredited';
      case 'workshop/seminar':
      case 'workshop':
      case 'seminar':
        return 'Workshop/Seminar';
      case 'informal training':
      case 'informal':
        return 'Informal Training';
      case 'short course':
      case 'shortcourse':
        return 'Short Course';
      default:
        return null;
    }
  }

  openUserEditor(student: EnrollmentStudent) {
    this.editingUserId.set(student.id);
    this.userEditForm.setValue({
      name: student.name,
      surname: student.surname,
      email: student.email,
      password: '',
      jobTitle: student.jobTitle,
      idNumber: student.idNumber,
      ofoCode: student.ofoCode ?? '',
      race: student.race ?? '',
      gender: student.gender ?? '',
      municipality: student.municipality ?? '',
      dateOfBirth: student.dateOfBirth ?? '',
      nqfLevel: student.nqfLevel ?? '',
      department: student.department,
      lineManagerId: student.lineManagerId ?? '',
      group: student.group,
      dateEnrolled: student.dateEnrolled,
      deadlineDate: student.deadlineDate,
      activeStatus: student.activeStatus,
      managerAccess: student.role === 'manager' ? 'Yes' : 'No',
      isAdmin: student.isAdmin ? 'Yes' : 'No',
    });
  }

  openSingleUserForm() {
    this.resetUserForm(this.singleUserForm);
    this.singleUserTone.set('success');
    this.singleUserMessage.set('');
    this.showSingleUserModal.set(true);
  }

  closeSingleUserForm(clearMessage = true) {
    this.showSingleUserModal.set(false);
    this.resetUserForm(this.singleUserForm);

    if (clearMessage) {
      this.singleUserTone.set('success');
      this.singleUserMessage.set('');
    }
  }

  async saveSingleUser() {
    if (this.singleUserForm.invalid) {
      this.singleUserForm.markAllAsTouched();
      this.singleUserTone.set('error');
      this.singleUserMessage.set('Complete the required user fields before saving.');
      return;
    }

    const studentInput = this.buildStudentInputFromForm(this.singleUserForm);
    const password = this.passwordFromForm(this.singleUserForm);
    const result = this.managerData.bulkUpsertStudents([studentInput]);

    try {
      // Wait for the directory record to actually land on the server before asking it to link
      // login credentials to that record — otherwise the credentials call can silently skip
      // because it can't find a student that only exists in the local, not-yet-synced state yet.
      await firstValueFrom(this.backend.patchManagerState({ students: this.managerData.students() }));
    } catch {
      // The record only exists in this session's local state at this point — it was never
      // actually written to the server, so don't claim it was saved (that previously showed a
      // misleading "password could not be updated" message even when nothing had persisted).
      this.singleUserTone.set('error');
      this.singleUserMessage.set('User could not be saved. Please check your connection and try again.');
      return;
    }

    try {
      await this.syncManagedUserCredentials([{ email: studentInput.email, password }]);
    } catch {
      if (result.added || result.updated) {
        this.singleUserTone.set('error');
        this.singleUserMessage.set('User was saved, but the password could not be updated.');
        this.closeSingleUserForm(false);
        return;
      }
    }

    if (result.added) {
      this.singleUserTone.set('success');
      this.singleUserMessage.set(password ? 'User added to the LMS list. Login password saved.' : 'User added to the LMS list.');
      this.closeSingleUserForm(false);
      return;
    }

    if (result.updated) {
      this.singleUserTone.set('success');
      this.singleUserMessage.set(password ? 'A user with that email already existed, so the existing record was updated and the password was reset.' : 'A user with that email already existed, so the existing record was updated.');
      this.closeSingleUserForm(false);
      return;
    }

    this.singleUserTone.set('error');
    this.singleUserMessage.set('User could not be saved. Check the form values and try again.');
  }

  resetSingleUserForm() {
    this.resetUserForm(this.singleUserForm);
    this.singleUserTone.set('success');
    this.singleUserMessage.set('');
  }

  cancelUserEdit() {
    this.editingUserId.set(null);
    this.resetUserForm(this.userEditForm);
  }

  async saveUserEdit() {
    const activeUser = this.editingUser();
    if (!activeUser || this.userEditForm.invalid) {
      this.userEditForm.markAllAsTouched();
      return;
    }

    const studentInput = this.buildStudentInputFromForm(this.userEditForm);
    const password = this.passwordFromForm(this.userEditForm);
    this.managerData.updateStudent(activeUser.id, studentInput);

    try {
      // Wait for the directory record change (e.g. a role change) to actually land on the server
      // before syncing credentials against it — see saveSingleUser() for why this ordering matters.
      await firstValueFrom(this.backend.patchManagerState({ students: this.managerData.students() }));
    } catch {
      // The edit only exists in this session's local state at this point — it was never actually
      // written to the server, so don't claim it was saved and don't close the form, so the admin
      // knows to retry rather than assuming the change already went through.
      this.singleUserTone.set('error');
      this.singleUserMessage.set('User details could not be saved. Please check your connection and try again.');
      return;
    }

    try {
      await this.syncManagedUserCredentials([{ email: studentInput.email, password }]);
      this.singleUserTone.set('success');
      this.singleUserMessage.set(password ? 'User details saved. Password updated.' : 'User details saved.');
    } catch {
      this.singleUserTone.set('error');
      this.singleUserMessage.set('User details were saved, but the password could not be updated.');
    }

    this.cancelUserEdit();
  }

  deleteUser(student: EnrollmentStudent) {
    const shouldDelete = confirm(`Delete ${student.name} ${student.surname} from the LMS user list?`);
    if (!shouldDelete) {
      return;
    }

    this.managerData.deleteStudent(student.id);

    if (this.editingUserId() === student.id) {
      this.cancelUserEdit();
    }
  }

  async selectTheme(themeId: LmsBrandThemeId) {
    this.themeUpdateError.set('');
    const saved = await this.branding.selectTheme(themeId);
    if (!saved) {
      this.themeUpdateError.set('The theme could not be saved. Please check your connection and try again.');
    }
  }

  onThemeSelectionChange(event: Event) {
    const target = event.target as HTMLSelectElement | null;
    if (!target) {
      return;
    }

    void this.selectTheme(target.value as LmsBrandThemeId);
  }

  async downloadBulkUploadTemplateXlsx() {
    const xlsx = await import('xlsx');
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet(this.getBulkUploadTemplateRows());

    xlsx.utils.book_append_sheet(workbook, worksheet, 'Users');
    const workbookArray = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.triggerDownload(new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'LMS-Users-Template.xlsx');
  }

  downloadBulkUploadTemplate() {
    if (this.selectedBulkUploadTemplateFormat() === 'XLSX') {
      void this.downloadBulkUploadTemplateXlsx();
      return;
    }

    this.downloadBulkUploadTemplateCsv();
  }

  downloadBulkUploadTemplateCsv() {
    const csv = this.getBulkUploadTemplateRows()
      .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'LMS-Users-Template.csv');
  }

  private async parseBulkUploadFile(file: File): Promise<{ rows: ManagedUserUploadRow[]; issues: BulkUploadIssue[] }> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'xlsx') {
      const xlsx = await import('xlsx');
      const fileBuffer = await file.arrayBuffer();
      const workbook = xlsx.read(fileBuffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        return { rows: [], issues: [] };
      }

      const worksheet = workbook.Sheets[firstSheetName];
      // blankrows: true (not false) so a blank row in the source sheet still occupies a slot in
      // rawRows — parseBulkUploadRows below relies on each row's array index lining up with its
      // real position in the file to report an accurate line number; dropping blank rows here would
      // shift every row after one out of sync with the file the admin actually has open.
      const rawRows = xlsx.utils.sheet_to_json<(string | number | boolean | Date)[]>(worksheet, {
        header: 1,
        raw: false,
        defval: '',
        blankrows: true,
        dateNF: 'yyyy-mm-dd',
      });

      return this.parseBulkUploadRows(rawRows.map((row) => row.map((value) => String(value ?? ''))));
    }

    const csvText = await file.text();
    // Blank lines are kept as [] (not filtered out) for the same reason as blankrows above — the
    // line-number reported for a later row depends on earlier rows, blank or not, all still
    // occupying a slot.
    const rawRows = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .map((line) => (line ? this.parseCsvLine(line) : []));

    return this.parseBulkUploadRows(rawRows);
  }

  private parseBulkUploadRows(rawRows: string[][]): { rows: ManagedUserUploadRow[]; issues: BulkUploadIssue[] } {
    if (rawRows.length < 2) {
      return { rows: [], issues: [] };
    }

    const headers = rawRows[0].map((header) => this.normalizeCsvHeader(header));
    const requiredHeaders = ['name', 'surname', 'email', 'department', 'group', 'dateenrolled', 'deadlinedate'];

    if (requiredHeaders.some((header) => !headers.includes(header))) {
      throw new Error('The upload file is missing one or more required fields: Name, Surname, Email, Department, Group, Start Date, End Date.');
    }

    const rows: ManagedUserUploadRow[] = [];
    const issues: BulkUploadIssue[] = [];
    const seenEmails = new Set<string>();

    rawRows.slice(1).forEach((values, rowIndex) => {
      const lineNumber = rowIndex + 2;

      // A genuinely blank line/row in the source file (not filtered out earlier — see
      // parseBulkUploadFile — specifically so this index keeps lining up with the file's real line
      // numbers) isn't a data row to validate or report an issue against; just skip it in place.
      if (values.length === 0 || values.every((value) => !value?.trim())) {
        return;
      }

      const record = new Map<string, string>();

      headers.forEach((header, index) => {
        record.set(header, values[index]?.trim() ?? '');
      });

      const row = this.buildBulkUploadRow(record, lineNumber, seenEmails);

      if ('message' in row) {
        issues.push(row);
        return;
      }

      rows.push(row);
    });

    return { rows, issues };
  }

  private parseCsvLine(line: string) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];

      if (character === '"') {
        if (inQuotes && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (character === ',' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }

      current += character;
    }

    values.push(current);
    return values;
  }

  private normalizeCsvHeader(header: string) {
    const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');

    switch (normalizedHeader) {
      case 'firstname':
        return 'name';
      case 'lastname':
        return 'surname';
      case 'emailaddress':
        return 'email';
      case 'startdate':
        return 'dateenrolled';
      case 'enddate':
        return 'deadlinedate';
      case 'access':
      case 'accessstatus':
        return 'activestatus';
      case 'userpassword':
      case 'newpassword':
      case 'temppassword':
        return 'password';
      case 'trainingmanager':
      case 'ismanager':
      case 'manageraccess':
      case 'manageryesno':
        return 'manager';
      case 'isadmin':
      case 'administrator':
      case 'adminaccess':
      case 'adminyesno':
        return 'admin';
      default:
        return normalizedHeader;
    }
  }

  private createUserForm(): UserFormGroup {
    return new FormGroup<UserFormControls>({
      name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      surname: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
      password: new FormControl('', { nonNullable: true, validators: [Validators.minLength(8)] }),
      jobTitle: new FormControl('', { nonNullable: true }),
      idNumber: new FormControl('', { nonNullable: true }),
      ofoCode: new FormControl('', { nonNullable: true }),
      race: new FormControl('', { nonNullable: true }),
      gender: new FormControl('', { nonNullable: true }),
      municipality: new FormControl('', { nonNullable: true }),
      dateOfBirth: new FormControl('', { nonNullable: true }),
      nqfLevel: new FormControl('', { nonNullable: true }),
      department: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      lineManagerId: new FormControl('', { nonNullable: true }),
      group: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      dateEnrolled: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      deadlineDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      activeStatus: new FormControl<'Active' | 'Inactive'>('Active', { nonNullable: true, validators: [Validators.required] }),
      managerAccess: new FormControl<'Yes' | 'No'>('No', { nonNullable: true, validators: [Validators.required] }),
      isAdmin: new FormControl<'Yes' | 'No'>('No', { nonNullable: true, validators: [Validators.required] }),
    });
  }

  private resetUserForm(form: UserFormGroup) {
    form.reset({
      name: '',
      surname: '',
      email: '',
      password: '',
      jobTitle: '',
      idNumber: '',
      ofoCode: '',
      race: '',
      gender: '',
      municipality: '',
      dateOfBirth: '',
      nqfLevel: '',
      department: '',
      lineManagerId: '',
      group: '',
      dateEnrolled: '',
      deadlineDate: '',
      activeStatus: 'Active',
      managerAccess: 'No',
      isAdmin: 'No',
    });
  }

  private buildStudentInputFromForm(form: UserFormGroup): EnrollmentStudentInput {
    return {
      name: form.controls.name.value.trim(),
      surname: form.controls.surname.value.trim(),
      group: form.controls.group.value.trim(),
      dateEnrolled: form.controls.dateEnrolled.value,
      deadlineDate: form.controls.deadlineDate.value,
      email: form.controls.email.value.trim(),
      jobTitle: form.controls.jobTitle.value.trim(),
      idNumber: form.controls.idNumber.value.trim(),
      ofoCode: form.controls.ofoCode.value.trim(),
      race: form.controls.race.value.trim(),
      gender: form.controls.gender.value.trim(),
      municipality: form.controls.municipality.value.trim(),
      dateOfBirth: form.controls.dateOfBirth.value,
      nqfLevel: form.controls.nqfLevel.value.trim(),
      activeStatus: form.controls.activeStatus.value,
      department: form.controls.department.value.trim(),
      lineManagerId: form.controls.lineManagerId.value || undefined,
      lineManager: (() => {
        const lmId = form.controls.lineManagerId.value;
        const lm = this.managerData.students().find((s) => s.id === lmId);
        return lm ? `${lm.name} ${lm.surname}` : '';
      })(),
      role: this.roleFromManagerAccess(form.controls.managerAccess.value),
      isAdmin: form.controls.isAdmin.value === 'Yes',
    };
  }

  private passwordFromForm(form: UserFormGroup) {
    const password = form.controls.password.value.trim();
    return password || undefined;
  }

  private buildBulkUploadRow(record: Map<string, string>, lineNumber: number, seenEmails: Set<string>): ManagedUserUploadRow | BulkUploadIssue {
    const name = record.get('name') ?? '';
    const surname = record.get('surname') ?? '';
    const email = (record.get('email') ?? '').trim().toLowerCase();
    const password = record.has('password') ? (record.get('password') ?? '').trim() : undefined;
    const jobTitle = record.has('jobtitle') ? (record.get('jobtitle') ?? '').trim() : undefined;
    const idNumber = record.has('idnumber') ? (record.get('idnumber') ?? '').trim() : undefined;
    const ofoCode = record.has('ofocode') ? (record.get('ofocode') ?? '').trim() : undefined;
    const race = record.has('race') ? (record.get('race') ?? '').trim() : undefined;
    const gender = record.has('gender') ? (record.get('gender') ?? '').trim() : undefined;
    const municipality = record.has('municipality') ? (record.get('municipality') ?? '').trim() : undefined;
    const dateOfBirth = record.has('dateofbirth') ? (this.normalizeBulkUploadDate(record.get('dateofbirth') ?? '') ?? '') : undefined;
    const nqfLevel = record.has('nqflevel') ? (record.get('nqflevel') ?? '').trim() : undefined;
    const department = record.get('department') ?? '';
    const lineManager = record.has('linemanager') ? (record.get('linemanager') ?? '').trim() : undefined;
    const group = record.get('group') ?? '';
    const dateEnrolled = this.normalizeBulkUploadDate(record.get('dateenrolled') ?? '');
    const deadlineDate = this.normalizeBulkUploadDate(record.get('deadlinedate') ?? '');
    const rawStatus = (record.get('activestatus') ?? 'Active').trim();
    const rawManager = (record.get('manager') ?? '').trim().toLowerCase();
    const rawRole = (record.get('role') ?? '').trim().toLowerCase();
    const rawAdmin = (record.get('admin') ?? '').trim().toLowerCase();

    if (!name.trim() || !surname.trim() || !email || !department.trim() || !group.trim()) {
      return { lineNumber, message: 'Required values are missing.' };
    }

    if (!this.isValidEmail(email)) {
      return { lineNumber, message: 'Email address is invalid.' };
    }

    if (!dateEnrolled || !deadlineDate) {
      return { lineNumber, message: 'Start date or end date is invalid.' };
    }

    if (seenEmails.has(email)) {
      return { lineNumber, message: 'Email is duplicated in this file.' };
    }

    if (rawStatus && !['active', 'inactive'].includes(rawStatus.toLowerCase())) {
      return { lineNumber, message: 'Access must be Active or Inactive.' };
    }

    if (password && password.length < 8) {
      return { lineNumber, message: 'Password must be at least 8 characters long.' };
    }

    seenEmails.add(email);

    let role: 'student' | 'manager' = this.roleFromBulkUpload(rawManager);
    if (['student', 'manager'].includes(rawRole)) {
      role = rawRole as 'student' | 'manager';
    }
    const isAdmin = ['yes', 'y', 'true'].includes(rawAdmin);
    return {
      student: {
        name: name.trim(),
        surname: surname.trim(),
        email,
        ...(jobTitle !== undefined ? { jobTitle } : {}),
        ...(idNumber !== undefined ? { idNumber } : {}),
        ...(ofoCode !== undefined ? { ofoCode } : {}),
        ...(race !== undefined ? { race } : {}),
        ...(gender !== undefined ? { gender } : {}),
        ...(municipality !== undefined ? { municipality } : {}),
        ...(dateOfBirth !== undefined ? { dateOfBirth } : {}),
        ...(nqfLevel !== undefined ? { nqfLevel } : {}),
        department: department.trim(),
        ...(lineManager !== undefined ? { lineManager } : {}),
        group: group.trim(),
        dateEnrolled,
        deadlineDate,
        activeStatus: rawStatus.toLowerCase() === 'inactive' ? 'Inactive' : 'Active',
        role,
        isAdmin,
      },
      ...(password ? { password } : {}),
    };
  }

  private normalizeBulkUploadDate(value: string) {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return '';
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
      return trimmedValue;
    }

    const parsedDate = new Date(trimmedValue);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private getBulkUploadTemplateRows() {
    return [
      ['Name', 'Surname', 'Email', 'Password', 'Job Title', 'ID Number', 'OFO Code', 'Race', 'Gender', 'Municipality', 'Date of Birth', 'NQF Level', 'Department', 'Line Manager', 'Group', 'Start Date', 'End Date', 'Training Manager', 'Admin', 'Access'],
      ['Lebo', 'Mokoena', 'lebo.mokoena@example.com', 'Welcome@123', 'Operations Coordinator', '9201015800083', '2021-121202 - Education Training and Skills Development Manager', 'African', 'Female', 'Buffalo City', '1992-04-15', 'Level 07', 'Operations', 'Nandi Khumalo', 'Cohort A', '2026-04-01', '2026-10-30', 'No', 'No', 'Active'],
    ];
  }

  private roleFromManagerAccess(managerAccess: 'Yes' | 'No') {
    return managerAccess === 'Yes' ? 'manager' as const : 'student' as const;
  }

  private roleFromBulkUpload(rawManager: string) {
    return ['yes', 'y', 'true', 'manager'].includes(rawManager) ? 'manager' as const : 'student' as const;
  }

  private buildBulkUploadPasswordSummary(result: { created: number; updated: number; skipped: number }) {
    const total = result.created + result.updated;

    if (!total && !result.skipped) {
      return '';
    }

    let summary = total ? ` Passwords saved for ${total} account(s).` : '';
    if (result.skipped) {
      summary += ` ${result.skipped} password update(s) were skipped.`;
    }

    return summary;
  }

  private async syncManagedUserCredentials(drafts: Array<{ email: string; password?: string }>) {
    const users = drafts
      .map((draft) => {
        const password = draft.password?.trim() ?? '';
        if (!password) {
          return null;
        }

        const student = this.users().find((entry) => entry.email.toLowerCase() === draft.email.toLowerCase());
        if (!student) {
          return null;
        }

        return {
          studentId: student.id,
          email: student.email,
          role: student.role,
          password,
        } satisfies ManagedUserCredentialInput;
      })
      .filter((entry): entry is ManagedUserCredentialInput => entry !== null);

    if (!users.length) {
      return { created: 0, updated: 0, skipped: 0 };
    }

    return await firstValueFrom(this.backend.upsertManagedUserCredentials({ users }));
  }

  private buildIdpReportExportRows() {
    const columns = [
      'Name',
      'Surname',
      'ID Number',
      'Job Title',
      'OFO Code',
      'Race',
      'Gender',
      'Municipality',
      'Manager',
      'Development Need',
      'Planned Action',
      'Support Required',
      'Date Captured',
      'Target Date',
      'Status',
    ];
    const reportRows = this.idpReportRows();

    return {
      columns,
      reportRows,
      rows: reportRows.map((row) => [
        row.name,
        row.surname,
        row.idNumber,
        row.jobTitle,
        row.ofoCode,
        row.race,
        row.gender,
        row.municipality,
        row.manager,
        row.developmentNeed,
        row.plannedAction,
        row.supportRequired,
        row.dateCaptured,
        row.targetDate,
        row.status,
      ]),
    };
  }

  private buildSuccessionReportExportRows() {
    const roleColumns = ['Role', 'Department', 'Incumbent', 'Owning Manager'];
    const roles = this.managerData.successionRoles();
    const roleRows = roles.map((role) => [
      role.title,
      role.department,
      this.successorName(role.incumbentStudentId),
      this.ownerManagerName(role.ownerManagerId),
    ]);

    const nominationColumns = ['Role', 'Successor', 'Owning Manager', 'Readiness', 'Status'];
    const nominations = this.managerData.successorNominations();
    const nominationRows = nominations.map((nomination) => [
      this.roleTitle(nomination.roleId),
      this.successorName(nomination.successorStudentId),
      this.ownerManagerName(nomination.nominatedByManagerId),
      nomination.readinessRating,
      nomination.status,
    ]);

    return { roleColumns, roleRows, nominationColumns, nominationRows };
  }

  private buildPerformanceReportExportRows() {
    const columns = [
      'Name',
      'Surname',
      'ID Number',
      'Job Title',
      'Department',
      'Manager',
      'KPI Count',
      'Total Weight (%)',
      'Overall Rating',
      'Last Review Date',
    ];
    const reportRows = this.performanceReportRows();

    return {
      columns,
      reportRows,
      rows: reportRows.map((row) => [
        row.name,
        row.surname,
        row.idNumber,
        row.jobTitle,
        row.department,
        row.manager,
        String(row.kpiCount),
        String(row.totalWeight),
        row.overallRatingLabel,
        row.lastReviewDate,
      ]),
    };
  }

  private buildCertificateLicenceReportExportRows() {
    const columns = [
      'Full Name',
      'Surname',
      'ID Number',
      'Department',
      'Certificate Name',
      'Expiry Date',
      'Renewal Required',
      'Status',
    ];
    const reportRows = this.certificateLicenceReportRows();

    return {
      columns,
      reportRows,
      rows: reportRows.map((row) => [
        row.name,
        row.surname,
        row.idNumber,
        row.department,
        row.certificateName,
        row.expiryDate,
        row.renewalRequired,
        row.status,
      ]),
    };
  }

  resolveStudentOverallStatus(student: EnrollmentStudent): EnrollmentStudent['status'] {
    const courses = this.reportStudentCoursesById()[student.id];

    // Snapshot hasn't loaded yet — fall back to stored enrollment status.
    if (courses === undefined || !student.assignedOfferingIds.length) {
      return student.status;
    }

    const assignedCourseRecords = courses.filter(
      (c) => c.offeringId && student.assignedOfferingIds.includes(c.offeringId),
    );

    if (!assignedCourseRecords.length) {
      return student.status;
    }

    if (assignedCourseRecords.every((c) => c.completed)) {
      return 'Completed';
    }

    if (assignedCourseRecords.some((c) => c.completed || (c.progress ?? 0) > 0)) {
      return 'In Progress';
    }

    return 'Not Yet Started';
  }

  private resolveReportCompletionStatus(student: EnrollmentStudent, offeringId: string, courseTitle: string): EnrollmentStudent['status'] {
    const courses = this.reportStudentCoursesById()[student.id];

    // Snapshot hasn't loaded yet — fall back to stored enrollment status as a placeholder.
    if (courses === undefined) {
      return student.status;
    }

    const matchedCourse = courses.find((course) =>
      course.offeringId === offeringId || course.name === courseTitle,
    );

    // Snapshot is loaded but no course record for this offering — the student hasn't started it.
    if (!matchedCourse) {
      return 'Not Yet Started';
    }

    if (matchedCourse.completed) {
      return 'Completed';
    }

    return (matchedCourse.progress ?? 0) > 0 ? 'In Progress' : 'Not Yet Started';
  }

  private resolveReportCompletionDate(student: EnrollmentStudent, offeringId: string, courseTitle: string) {
    const matchedCourse = (this.reportStudentCoursesById()[student.id] ?? []).find((course) =>
      course.offeringId === offeringId || course.name === courseTitle,
    );

    if (!matchedCourse) {
      return student.status === 'Completed' ? 'Not recorded' : 'Not completed';
    }

    if (!matchedCourse.completed) {
      return 'Not completed';
    }

    return matchedCourse.completedAt || 'Not recorded';
  }

  // StudentCertificateLicence.status is a persisted field that only gets recalculated when the
  // owning student happens to open their own Certificates page (see student-badges.component.ts's
  // calculateCertificateStatus). A certificate that expires while the student never revisits that
  // page would keep reading "Active" forever in this report, so recompute it live from expiryDate
  // instead of trusting the stored value — same algorithm as calculateCertificateStatus.
  private resolveLiveCertificateStatus(record: StudentCertificateLicence): StudentCertificateStatus {
    const expiry = this.parseDateOnly(record.expiryDate);
    if (!expiry) {
      return record.status;
    }

    const today = this.startOfTodayLocal();
    if (expiry < today) {
      return 'Expired';
    }

    if (record.reminderNotification === 'Yes') {
      const safeReminderDays = Number.isFinite(record.reminderDaysBeforeExpiry) && record.reminderDaysBeforeExpiry > 0
        ? record.reminderDaysBeforeExpiry
        : 0;
      const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= safeReminderDays) {
        return 'Pending Renewal';
      }
    }

    return 'Active';
  }

  private parseDateOnly(value: string) {
    if (!value) {
      return null;
    }

    const [year, month, day] = value.split('-').map((part) => Number(part));
    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  private startOfTodayLocal() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  /** South African ID numbers encode date of birth as the first 6 digits (YYMMDD). This LMS
   *  doesn't capture age/date of birth directly, but the SETA MIS templates require an age-group
   *  bucket, so derive it here instead of leaving it blank. Returns null for anything that isn't
   *  a valid 13-digit SA ID number (e.g. a passport number, or simply not captured). */
  private deriveAgeGroupFromIdNumber(idNumber: string): 'lt35' | 'mid' | 'gt55' | null {
    const digits = idNumber.trim();
    if (!/^\d{13}$/.test(digits)) {
      return null;
    }

    const yy = Number(digits.slice(0, 2));
    const mm = Number(digits.slice(2, 4));
    const dd = Number(digits.slice(4, 6));
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
      return null;
    }

    const now = new Date();
    const currentYy = now.getFullYear() % 100;
    // A 2-digit birth year could mean either century — assume whichever gives a plausible
    // working-age person (i.e. treat it as the more recent century unless that would put their
    // birth year in the future).
    const century = yy <= currentYy ? 2000 : 1900;
    const birthDate = new Date(century + yy, mm - 1, dd);
    if (Number.isNaN(birthDate.getTime())) {
      return null;
    }

    let age = now.getFullYear() - birthDate.getFullYear();
    const hasHadBirthdayThisYear = now.getMonth() > birthDate.getMonth()
      || (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate());
    if (!hasHadBirthdayThisYear) {
      age -= 1;
    }

    if (age < 0 || age > 110) {
      return null;
    }

    if (age < 35) return 'lt35';
    if (age <= 55) return 'mid';
    return 'gt55';
  }

  /** Buckets one student into the SETA templates' race x gender x disability x age-group count
   *  columns. Disability status isn't captured by this LMS, so the *Disabled columns always stay
   *  0 — beneficiaries are counted under their race/gender combination only. A student whose race
   *  is 'Foreign' or unset, or whose gender is unset, contributes to none of the race/gender
   *  columns (the official templates only have African/Coloured/Indian/White buckets). */
  /** Computes a whole-number age in years from a YYYY-MM-DD date of birth — used both for the
   *  "Age: X" hint shown next to the Date of Birth field in the user form, and (via
   *  resolveAgeGroup) to bucket beneficiaries into the SETA reports' age-group columns. Returns
   *  null for an empty or unparseable date. */
  computeAge(dateOfBirth: string): number | null {
    const trimmed = dateOfBirth?.trim();
    if (!trimmed) {
      return null;
    }

    // Parsed via parseDateOnly (local midnight) rather than new Date(trimmed), which parses a bare
    // YYYY-MM-DD string as UTC midnight — for an admin browsing from a timezone behind UTC, that
    // shifts the birth date back a calendar day, making the "has the birthday happened yet this
    // year" check below fire a day early and undercount age by one on that specific day each year.
    const birthDate = this.parseDateOnly(trimmed);
    if (!birthDate || Number.isNaN(birthDate.getTime())) {
      return null;
    }

    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const hasHadBirthdayThisYear = now.getMonth() > birthDate.getMonth()
      || (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate());
    if (!hasHadBirthdayThisYear) {
      age -= 1;
    }

    return age >= 0 && age <= 130 ? age : null;
  }

  private ageGroupFromAge(age: number): 'lt35' | 'mid' | 'gt55' {
    if (age < 35) return 'lt35';
    if (age <= 55) return 'mid';
    return 'gt55';
  }

  /** Prefers the explicit Date of Birth captured on the student record; falls back to deriving
   *  age from the South African ID number when Date of Birth hasn't been captured. */
  private resolveAgeGroup(student: Pick<EnrollmentStudent, 'dateOfBirth' | 'idNumber'>): 'lt35' | 'mid' | 'gt55' | null {
    const age = student.dateOfBirth ? this.computeAge(student.dateOfBirth) : null;
    if (age !== null) {
      return this.ageGroupFromAge(age);
    }

    return student.idNumber ? this.deriveAgeGroupFromIdNumber(student.idNumber) : null;
  }

  private resolveBeneficiaryDemographics(student: Pick<EnrollmentStudent, 'race' | 'gender' | 'idNumber' | 'dateOfBirth'>): BeneficiaryDemographicCounts {
    const counts: BeneficiaryDemographicCounts = {
      africanMale: 0, africanFemale: 0, africanDisabled: 0,
      colouredMale: 0, colouredFemale: 0, colouredDisabled: 0,
      indianMale: 0, indianFemale: 0, indianDisabled: 0,
      whiteMale: 0, whiteFemale: 0, whiteDisabled: 0,
      age1: 0, age2: 0, age3: 0,
    };

    const race = student.race?.trim();
    const gender = student.gender?.trim();
    const key: keyof BeneficiaryDemographicCounts | null =
      race === 'African' && gender === 'Male' ? 'africanMale'
      : race === 'African' && gender === 'Female' ? 'africanFemale'
      : race === 'Coloured' && gender === 'Male' ? 'colouredMale'
      : race === 'Coloured' && gender === 'Female' ? 'colouredFemale'
      : race === 'Indian' && gender === 'Male' ? 'indianMale'
      : race === 'Indian' && gender === 'Female' ? 'indianFemale'
      : race === 'White' && gender === 'Male' ? 'whiteMale'
      : race === 'White' && gender === 'Female' ? 'whiteFemale'
      : null;

    if (key) {
      counts[key] = 1;
    }

    const ageGroup = this.resolveAgeGroup(student);
    if (ageGroup === 'lt35') counts.age1 = 1;
    else if (ageGroup === 'mid') counts.age2 = 1;
    else if (ageGroup === 'gt55') counts.age3 = 1;

    return counts;
  }

  private sumBeneficiaryDemographics(rows: BeneficiaryDemographicCounts[]): BeneficiaryDemographicCounts {
    return rows.reduce<BeneficiaryDemographicCounts>((total, row) => ({
      africanMale: total.africanMale + row.africanMale,
      africanFemale: total.africanFemale + row.africanFemale,
      africanDisabled: total.africanDisabled + row.africanDisabled,
      colouredMale: total.colouredMale + row.colouredMale,
      colouredFemale: total.colouredFemale + row.colouredFemale,
      colouredDisabled: total.colouredDisabled + row.colouredDisabled,
      indianMale: total.indianMale + row.indianMale,
      indianFemale: total.indianFemale + row.indianFemale,
      indianDisabled: total.indianDisabled + row.indianDisabled,
      whiteMale: total.whiteMale + row.whiteMale,
      whiteFemale: total.whiteFemale + row.whiteFemale,
      whiteDisabled: total.whiteDisabled + row.whiteDisabled,
      age1: total.age1 + row.age1,
      age2: total.age2 + row.age2,
      age3: total.age3 + row.age3,
    }), {
      africanMale: 0, africanFemale: 0, africanDisabled: 0,
      colouredMale: 0, colouredFemale: 0, colouredDisabled: 0,
      indianMale: 0, indianFemale: 0, indianDisabled: 0,
      whiteMale: 0, whiteFemale: 0, whiteDisabled: 0,
      age1: 0, age2: 0, age3: 0,
    });
  }

  /** Best-effort mapping from this LMS's training-type field to the closest official SETA
   *  "Type Of Learning Programme" dropdown value — there's no exact match since this LMS doesn't
   *  capture the full official taxonomy (Learnership, Bursary, Internship, etc.) separately. */
  private mapToSetaLearningProgrammeType(trainingType: string): string {
    switch (trainingType) {
      case 'Accredited':
      case 'Short Course':
        return 'Short Skills Programme / Courses (E.g. Accredited / Non-Accredited)';
      case 'Workshop/Seminar':
      case 'Informal Training':
        return 'Internal Training (E.g. Formal safety toolbox talks / Inductions)';
      default:
        return 'Not captured';
    }
  }

  // The 3 builders below intentionally do NOT prepend the "Report / Generated By / Generated On"
  // metadata block that this component's other exports use — these files are meant to be
  // uploaded directly into the SETA's MIS system, which expects the machine-key header on the
  // first row and the human-readable header on the second, with no extra rows above them.
  private readonly setaDemographicColumns = [
    'African Male', 'African Female', 'African Disabled',
    'Coloured Male', 'Coloured Female', 'Coloured Disabled',
    'Indian/Asian Male', 'Indian/Asian Female', 'Indian/Asian Disabled',
    'White Male', 'White Female', 'White Disabled',
    'Age Group - Less than 35', 'Age Group - 35 to 55', 'Age Group - Greater than 55',
  ];
  private readonly setaDemographicMachineKeys = [
    'AfricanMale', 'AfricanFemale', 'AfricanDisabled',
    'ColouredMale', 'ColouredFemale', 'ColouredDisabled',
    'IndianMale', 'IndianFemale', 'IndianDisabled',
    'WhiteMale', 'WhiteFemale', 'WhiteDisabled',
    'Age1', 'Age2', 'Age3',
  ];
  private demographicValues(row: BeneficiaryDemographicCounts) {
    return [
      row.africanMale, row.africanFemale, row.africanDisabled,
      row.colouredMale, row.colouredFemale, row.colouredDisabled,
      row.indianMale, row.indianFemale, row.indianDisabled,
      row.whiteMale, row.whiteFemale, row.whiteDisabled,
      row.age1, row.age2, row.age3,
    ];
  }

  private buildBeneficiariesCompletedTrainingExportRows() {
    const machineKeys = [
      'OFOOccupation', 'Municipality', 'NQFAlignedTraining', 'NQFLevel', 'FormProgrammeNeedsAddressed',
      'FormFundingType', 'DGContractNumber', 'SocioEconomicStatus', 'FormTypeOfLearningProgramme',
      'NameOfLearningProgramme', 'FormTypeOfEducationalInstitution', 'TotalActualCost',
      'EntryLevel', 'IntermediateLevel', 'AdvancedLevel', ...this.setaDemographicMachineKeys,
    ];
    const columns = [
      'OFO Occupation', 'Municipality', 'NQF Aligned Training', 'NQF Level', 'Programme Needs Addressed',
      'FundingTypeID', 'DG Contract Number', 'Socio Economic Status', 'Type Of Learning Programme',
      'Name Of Learning Programme', 'Type Of Educational Institution', 'Total Actual Cost',
      'Entry Level', 'Intermediate Level', 'Advanced Level', ...this.setaDemographicColumns,
    ];
    const reportRows = this.beneficiariesCompletedTrainingRows();

    return {
      machineKeys,
      columns,
      reportRows,
      rows: reportRows.map((row) => [
        row.ofoOccupation, row.municipality, row.nqfAlignedTraining, row.nqfLevel, row.programmeNeedsAddressed,
        row.fundingType, row.dgContractNumber, row.socioEconomicStatus, row.typeOfLearningProgramme,
        row.nameOfLearningProgramme, row.typeOfEducationalInstitution, row.totalActualCost,
        row.entryLevel, row.intermediateLevel, row.advancedLevel, ...this.demographicValues(row),
      ]),
    };
  }

  private buildNumberBeneficiariesExportRows() {
    const machineKeys = ['OFOOccupation', 'Municipality', ...this.setaDemographicMachineKeys];
    const columns = ['OFO Occupation', 'Municipality', ...this.setaDemographicColumns];
    const reportRows = this.numberBeneficiariesRows();

    return {
      machineKeys,
      columns,
      reportRows,
      rows: reportRows.map((row) => [
        row.ofoOccupation, row.municipality, ...this.demographicValues(row),
      ]),
    };
  }

  private buildPivotalActualTrainingExportRows() {
    const machineKeys = [
      'OFOOccupation', 'Municipality', 'FormProgrammeNeedsAddressed', 'FormFundingType', 'DGContractNumber',
      'IDNumber', 'FirstName', 'Surname', 'SocioEconomicStatus', 'FormTypeOfLearningProgramme',
      'NameOfLearningProgramme', 'PivotalOFOOccupation', 'FormTypeOfEducationalInstitution', 'NQFLevel',
      'Cost', 'EntryLevel', 'IntermediateLevel', 'AdvancedLevel', ...this.setaDemographicMachineKeys,
    ];
    const columns = [
      'OFO Occupation', 'Municipality', 'Programme Needs Addressed', 'FundingTypeID', 'DG Contract Number',
      'ID Number', 'First Name', 'Surname', 'Socio Economic Status', 'Type Of Learning Programme',
      'Name Of Learning Programme', 'Pivotal Programmes', 'Type Of Educational Institution', 'NQF Level',
      'Cost', 'Entry Level', 'Intermediate Level', 'Advanced Level', ...this.setaDemographicColumns,
    ];
    const reportRows = this.pivotalActualTrainingRows();

    return {
      machineKeys,
      columns,
      reportRows,
      rows: reportRows.map((row) => [
        row.ofoOccupation, row.municipality, row.programmeNeedsAddressed, row.fundingType, row.dgContractNumber,
        row.idNumber, row.firstName, row.surname, row.socioEconomicStatus, row.typeOfLearningProgramme,
        row.nameOfLearningProgramme, row.pivotalOfoOccupation, row.typeOfEducationalInstitution, row.nqfLevel,
        row.cost, row.entryLevel, row.intermediateLevel, row.advancedLevel, ...this.demographicValues(row),
      ]),
    };
  }

  private buildWspBeneficiariesPlannedExportRows() {
    const machineKeys = [
      'OFOOccupation', 'Municipality', 'NQFAlignedTraining', 'NQFLevel', 'FormProgrammeNeedsAddressed',
      'FormFundingType', 'DGContractNumber', 'SocioEconomicStatus', 'FormTypeOfLearningProgramme',
      'NameOfLearningProgramme', 'FormTypeOfEducationalInstitution', 'TotalEstimatedCost',
      'EntryLevel', 'IntermediateLevel', 'AdvancedLevel', ...this.setaDemographicMachineKeys,
    ];
    const columns = [
      'OFO Occupation', 'Municipality', 'NQF Aligned Training', 'NQF Level', 'Programme Needs Addressed',
      'FundingTypeID', 'DG Contract Number', 'Socio Economic Status', 'Type Of Learning Programme',
      'Name Of Learning Programme', 'Type Of Educational Institution', 'Total Estimated Cost',
      'Entry Level', 'Intermediate Level', 'Advanced Level', ...this.setaDemographicColumns,
    ];
    const reportRows = this.wspBeneficiariesPlannedRows();

    return {
      machineKeys,
      columns,
      reportRows,
      rows: reportRows.map((row) => [
        row.ofoOccupation, row.municipality, row.nqfAlignedTraining, row.nqfLevel, row.programmeNeedsAddressed,
        row.fundingType, row.dgContractNumber, row.socioEconomicStatus, row.typeOfLearningProgramme,
        row.nameOfLearningProgramme, row.typeOfEducationalInstitution, row.totalEstimatedCost,
        row.entryLevel, row.intermediateLevel, row.advancedLevel, ...this.demographicValues(row),
      ]),
    };
  }

  private buildWspEmploymentSummaryExportRows() {
    const machineKeys = ['OFOOccupation', 'Municipality', ...this.setaDemographicMachineKeys];
    const columns = ['OFO Occupation', 'Municipality', ...this.setaDemographicColumns];
    const reportRows = this.wspEmploymentSummaryRows();

    return {
      machineKeys,
      columns,
      reportRows,
      rows: reportRows.map((row) => [
        row.ofoOccupation, row.municipality, ...this.demographicValues(row),
      ]),
    };
  }

  private buildWspPivotalPlannedExportRows() {
    const machineKeys = [
      'OFOOccupation', 'Municipality', 'FormProgrammeNeedsAddressed', 'FormFundingType', 'DGContractNumber',
      'IDNumber', 'FirstName', 'Surname', 'SocioEconomicStatus', 'FormTypeOfLearningProgramme',
      'NameOfLearningProgramme', 'PivotalOFOOccupation', 'FormTypeOfEducationalInstitution', 'NQFLevel',
      'Cost', 'EntryLevel', 'IntermediateLevel', 'AdvancedLevel', ...this.setaDemographicMachineKeys,
    ];
    const columns = [
      'OFO Occupation', 'Municipality', 'Programme Needs Addressed', 'FundingType', 'DG Contract Number',
      'ID Number', 'First Name', 'Surname', 'Socio Economic Status', 'Type Of Learning Programme',
      'Name Of Learning Programme', 'Pivotal Programmes', 'Type Of Educational Institution', 'NQF Level',
      'Cost', 'Entry Level', 'Intermediate Level', 'Advanced Level', ...this.setaDemographicColumns,
    ];
    const reportRows = this.wspPivotalPlannedRows();

    return {
      machineKeys,
      columns,
      reportRows,
      rows: reportRows.map((row) => [
        row.ofoOccupation, row.municipality, row.programmeNeedsAddressed, row.fundingType, row.dgContractNumber,
        row.idNumber, row.firstName, row.surname, row.socioEconomicStatus, row.typeOfLearningProgramme,
        row.nameOfLearningProgramme, row.pivotalOfoOccupation, row.typeOfEducationalInstitution, row.nqfLevel,
        row.cost, row.entryLevel, row.intermediateLevel, row.advancedLevel, ...this.demographicValues(row),
      ]),
    };
  }

  private buildAnnualReportExportRows() {
    const columns = [
      'Name',
      'Email',
      'ID Number',
      'Job Title',
      'Department',
      'OFO Code',
      'Race',
      'Gender',
      'Municipality',
      'Training Item',
      'Source',
      'Type',
      'Result',
      'Provider',
      'Date',
      'Status',
    ];
    const reportRows = this.filteredAnnualTrainingReportRows();

    return {
      columns,
      reportRows,
      rows: reportRows.map((row) => [
        row.learnerName,
        row.learnerEmail,
        row.idNumber,
        row.jobTitle,
        row.department,
        row.ofoCode,
        row.race,
        row.gender,
        row.municipality,
        row.trainingItem,
        row.source,
        row.trainingType,
        row.result,
        row.provider,
        row.date,
        row.status,
      ]),
    };
  }

  private reportGeneratedOnLabel() {
    return new Intl.DateTimeFormat('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date());
  }

  private triggerDownload(blob: Blob, filename: string) {
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
  }

  // Uploads go to the account's linked directory record, the same one the student and
  // training-manager views read from, so the picture shows up consistently everywhere. Uses the
  // base64-JSON upload route rather than the direct-to-storage one — that path depends on the
  // storage bucket's CORS policy already being set up, which isn't guaranteed at any given moment.
  onAdminProfileImageSelected(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (input) {
      input.value = '';
    }

    if (!file || !file.type.startsWith('image/') || this.uploadingProfileImage()) {
      return;
    }

    this.uploadingProfileImage.set(true);
    this.backend.uploadFileBase64(file, 'profile-pictures').subscribe({
      next: ({ url }) => {
        this.adminProfileImageDataUrl.set(url);
        this.backend.updateMyProfileImage({ profileImageUrl: url, profileImageDataUrl: null }).subscribe({
          complete: () => this.uploadingProfileImage.set(false),
          error: () => this.uploadingProfileImage.set(false),
        });
      },
      error: () => {
        this.uploadingProfileImage.set(false);
      },
    });
  }

  clearAdminProfileImage() {
    this.adminProfileImageDataUrl.set(null);
    this.backend.updateMyProfileImage({ profileImageUrl: null, profileImageDataUrl: null }).subscribe();
  }

  openAnnualReportDocumentsEditor(requestId: string) {
    this.editingAnnualReportRequestId.set(requestId);
  }

  closeAnnualReportDocumentsEditor() {
    this.editingAnnualReportRequestId.set(null);
  }

  onInvoiceSelected(event: Event, requestId: string) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (input) {
      input.value = '';
    }

    if (!file || this.uploadingInvoice()) {
      return;
    }

    this.uploadingInvoice.set(true);
    this.backend.uploadFileBase64(file, 'external-training-documents').subscribe({
      next: ({ url }) => {
        this.uploadingInvoice.set(false);
        this.managerData.attachExternalTrainingRequestDocuments({
          requestId,
          invoiceFileName: file.name,
          invoiceDataUrl: url,
        });
      },
      error: () => {
        this.uploadingInvoice.set(false);
      },
    });
  }

  onProofOfPaymentSelected(event: Event, requestId: string) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (input) {
      input.value = '';
    }

    if (!file || this.uploadingProofOfPayment()) {
      return;
    }

    this.uploadingProofOfPayment.set(true);
    this.backend.uploadFileBase64(file, 'external-training-documents').subscribe({
      next: ({ url }) => {
        this.uploadingProofOfPayment.set(false);
        this.managerData.attachExternalTrainingRequestDocuments({
          requestId,
          proofOfPaymentFileName: file.name,
          proofOfPaymentUrl: url,
        });
      },
      error: () => {
        this.uploadingProofOfPayment.set(false);
      },
    });
  }

  onCertificateSelected(event: Event, requestId: string) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (input) {
      input.value = '';
    }

    if (!file || this.uploadingCertificate()) {
      return;
    }

    this.uploadingCertificate.set(true);
    this.backend.uploadFileBase64(file, 'external-training-documents').subscribe({
      next: ({ url }) => {
        this.uploadingCertificate.set(false);
        this.managerData.attachExternalTrainingRequestDocuments({
          requestId,
          certificateFileName: file.name,
          certificateUrl: url,
        });
      },
      error: () => {
        this.uploadingCertificate.set(false);
      },
    });
  }

  onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (input) {
      input.value = '';
    }

    this.companyLogoUploadError.set('');
    this.companyLogoUploading.set(true);

    this.backend.uploadFileBase64(file, 'branding').subscribe({
      next: async (result) => {
        const saved = await this.branding.setCompanyLogo(result.url);
        this.companyLogoUploading.set(false);
        if (!saved) {
          this.companyLogoUploadError.set('The logo was uploaded, but could not be saved. Please try again.');
        }
      },
      error: () => {
        this.companyLogoUploading.set(false);
        this.companyLogoUploadError.set('Could not upload the logo. Please try again.');
      },
    });
  }

  async removeCompanyLogo() {
    this.companyLogoUploadError.set('');
    const saved = await this.branding.clearCompanyLogo();
    if (!saved) {
      this.companyLogoUploadError.set('The logo could not be removed. Please try again.');
    }
  }

  downloadAnnualReportCsv() {
    const { columns, rows, reportRows } = this.buildAnnualReportExportRows();

    if (!rows.length) {
      return;
    }

    const lines = [
      ['Report', 'Training Report'],
      ['Generated By', this.adminName()],
      ['Generated On', this.reportGeneratedOnLabel()],
      ['Rows Included', String(reportRows.length)],
      [],
      columns,
      ...rows,
    ];

    const csv = lines
      .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'LMS-Training-Report.csv');
  }

  async downloadAnnualReportXlsx() {
    const { columns, rows, reportRows } = this.buildAnnualReportExportRows();

    if (!rows.length) {
      return;
    }

    const xlsx = await import('xlsx');
    const workbook = xlsx.utils.book_new();
    const worksheetRows = [
      ['Report', 'Training Report'],
      ['Generated By', this.adminName()],
      ['Generated On', this.reportGeneratedOnLabel()],
      ['Rows Included', String(reportRows.length)],
      [],
      columns,
      ...rows,
    ];
    const worksheet = xlsx.utils.aoa_to_sheet(worksheetRows);

    xlsx.utils.book_append_sheet(workbook, worksheet, 'Training Report');
    const workbookArray = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.triggerDownload(
      new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'LMS-Training-Report.xlsx',
    );
  }

  downloadAnnualReport() {
    if (this.selectedAnnualReportDownloadFormat() === 'XLSX') {
      void this.downloadAnnualReportXlsx();
      return;
    }

    this.downloadAnnualReportCsv();
  }

  downloadWspBeneficiariesPlannedCsv() {
    const { machineKeys, columns, rows } = this.buildWspBeneficiariesPlannedExportRows();
    if (!rows.length) {
      return;
    }

    const csv = [machineKeys, columns, ...rows]
      .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), '2024_Beneficiaries_Planned_Non_Pivotal_Training_V1.csv');
  }

  async downloadWspBeneficiariesPlannedXlsx() {
    const { machineKeys, columns, rows } = this.buildWspBeneficiariesPlannedExportRows();
    if (!rows.length) {
      return;
    }

    const xlsx = await import('xlsx');
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet([machineKeys, columns, ...rows]);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'NumberBeneficiaries');
    const workbookArray = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.triggerDownload(
      new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      '2024_Beneficiaries_Planned_Non_Pivotal_Training_V1.xlsx',
    );
  }

  downloadWspBeneficiariesPlannedReport() {
    if (this.selectedWspSubReportDownloadFormat() === 'XLSX') {
      void this.downloadWspBeneficiariesPlannedXlsx();
      return;
    }

    this.downloadWspBeneficiariesPlannedCsv();
  }

  downloadWspEmploymentSummaryCsv() {
    const { machineKeys, columns, rows } = this.buildWspEmploymentSummaryExportRows();
    if (!rows.length) {
      return;
    }

    const csv = [machineKeys, columns, ...rows]
      .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), '2024_Employment_Summary_V1.csv');
  }

  async downloadWspEmploymentSummaryXlsx() {
    const { machineKeys, columns, rows } = this.buildWspEmploymentSummaryExportRows();
    if (!rows.length) {
      return;
    }

    const xlsx = await import('xlsx');
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet([machineKeys, columns, ...rows]);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'EmploymentSummary');
    const workbookArray = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.triggerDownload(
      new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      '2024_Employment_Summary_V1.xlsx',
    );
  }

  downloadWspEmploymentSummaryReport() {
    if (this.selectedWspSubReportDownloadFormat() === 'XLSX') {
      void this.downloadWspEmploymentSummaryXlsx();
      return;
    }

    this.downloadWspEmploymentSummaryCsv();
  }

  downloadWspPivotalPlannedCsv() {
    const { machineKeys, columns, rows } = this.buildWspPivotalPlannedExportRows();
    if (!rows.length) {
      return;
    }

    const csv = [machineKeys, columns, ...rows]
      .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), '2024_Pivotal_Planned_Training_Report_V1.csv');
  }

  async downloadWspPivotalPlannedXlsx() {
    const { machineKeys, columns, rows } = this.buildWspPivotalPlannedExportRows();
    if (!rows.length) {
      return;
    }

    const xlsx = await import('xlsx');
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet([machineKeys, columns, ...rows]);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Pivotal Planned');
    const workbookArray = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.triggerDownload(
      new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      '2024_Pivotal_Planned_Training_Report_V1.xlsx',
    );
  }

  downloadWspPivotalPlannedReport() {
    if (this.selectedWspSubReportDownloadFormat() === 'XLSX') {
      void this.downloadWspPivotalPlannedXlsx();
      return;
    }

    this.downloadWspPivotalPlannedCsv();
  }

  downloadBeneficiariesCompletedTrainingCsv() {
    const { machineKeys, columns, rows } = this.buildBeneficiariesCompletedTrainingExportRows();
    if (!rows.length) {
      return;
    }

    const csv = [machineKeys, columns, ...rows]
      .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), '2023_Beneficiaries_Completed_Training_V1.csv');
  }

  async downloadBeneficiariesCompletedTrainingXlsx() {
    const { machineKeys, columns, rows } = this.buildBeneficiariesCompletedTrainingExportRows();
    if (!rows.length) {
      return;
    }

    const xlsx = await import('xlsx');
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet([machineKeys, columns, ...rows]);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'NumberBeneficiaries');
    const workbookArray = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.triggerDownload(
      new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      '2023_Beneficiaries_Completed_Training_V1.xlsx',
    );
  }

  downloadBeneficiariesCompletedTrainingReport() {
    if (this.selectedAtrSubReportDownloadFormat() === 'XLSX') {
      void this.downloadBeneficiariesCompletedTrainingXlsx();
      return;
    }

    this.downloadBeneficiariesCompletedTrainingCsv();
  }

  downloadNumberBeneficiariesCsv() {
    const { machineKeys, columns, rows } = this.buildNumberBeneficiariesExportRows();
    if (!rows.length) {
      return;
    }

    const csv = [machineKeys, columns, ...rows]
      .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), '2023_Number_Actual_Beneficiaries_V1.csv');
  }

  async downloadNumberBeneficiariesXlsx() {
    const { machineKeys, columns, rows } = this.buildNumberBeneficiariesExportRows();
    if (!rows.length) {
      return;
    }

    const xlsx = await import('xlsx');
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet([machineKeys, columns, ...rows]);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'NumberBeneficiaries');
    const workbookArray = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.triggerDownload(
      new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      '2023_Number_Actual_Beneficiaries_V1.xlsx',
    );
  }

  downloadNumberBeneficiariesReport() {
    if (this.selectedAtrSubReportDownloadFormat() === 'XLSX') {
      void this.downloadNumberBeneficiariesXlsx();
      return;
    }

    this.downloadNumberBeneficiariesCsv();
  }

  downloadPivotalActualTrainingCsv() {
    const { machineKeys, columns, rows } = this.buildPivotalActualTrainingExportRows();
    if (!rows.length) {
      return;
    }

    const csv = [machineKeys, columns, ...rows]
      .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), '2023_Pivotal_Actual_Training_Report_V1.csv');
  }

  async downloadPivotalActualTrainingXlsx() {
    const { machineKeys, columns, rows } = this.buildPivotalActualTrainingExportRows();
    if (!rows.length) {
      return;
    }

    const xlsx = await import('xlsx');
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet([machineKeys, columns, ...rows]);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Pivotal Actual');
    const workbookArray = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.triggerDownload(
      new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      '2023_Pivotal_Actual_Training_Report_V1.xlsx',
    );
  }

  downloadPivotalActualTrainingReport() {
    if (this.selectedAtrSubReportDownloadFormat() === 'XLSX') {
      void this.downloadPivotalActualTrainingXlsx();
      return;
    }

    this.downloadPivotalActualTrainingCsv();
  }

  downloadIdpReportCsv() {
    const { columns, rows, reportRows } = this.buildIdpReportExportRows();

    if (!rows.length) {
      return;
    }

    const lines = [
      ['Report', 'IDP Report'],
      ['Generated By', this.adminName()],
      ['Generated On', this.reportGeneratedOnLabel()],
      ['Rows Included', String(reportRows.length)],
      [],
      columns,
      ...rows,
    ];

    const csv = lines
      .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'LMS-IDP-Report.csv');
  }

  async downloadIdpReportXlsx() {
    const { columns, rows, reportRows } = this.buildIdpReportExportRows();

    if (!rows.length) {
      return;
    }

    const xlsx = await import('xlsx');
    const workbook = xlsx.utils.book_new();
    const worksheetRows = [
      ['Report', 'IDP Report'],
      ['Generated By', this.adminName()],
      ['Generated On', this.reportGeneratedOnLabel()],
      ['Rows Included', String(reportRows.length)],
      [],
      columns,
      ...rows,
    ];
    const worksheet = xlsx.utils.aoa_to_sheet(worksheetRows);

    xlsx.utils.book_append_sheet(workbook, worksheet, 'IDP Report');
    const workbookArray = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.triggerDownload(
      new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'LMS-IDP-Report.xlsx',
    );
  }

  downloadIdpReport() {
    if (this.selectedIdpReportDownloadFormat() === 'XLSX') {
      void this.downloadIdpReportXlsx();
      return;
    }

    this.downloadIdpReportCsv();
  }

  downloadSuccessionReportCsv() {
    const { roleColumns, roleRows, nominationColumns, nominationRows } = this.buildSuccessionReportExportRows();

    if (!roleRows.length && !nominationRows.length) {
      return;
    }

    const lines: (string | number)[][] = [
      ['Report', 'Succession Planning'],
      ['Generated By', this.adminName()],
      ['Generated On', this.reportGeneratedOnLabel()],
      ['Critical Roles', String(roleRows.length)],
      ['Nominations', String(nominationRows.length)],
      [],
      ['Critical Roles'],
      roleColumns,
      ...roleRows,
      [],
      ['All Nominations'],
      nominationColumns,
      ...nominationRows,
    ];

    const csv = lines
      .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'LMS-Succession-Planning-Report.csv');
  }

  async downloadSuccessionReportXlsx() {
    const { roleColumns, roleRows, nominationColumns, nominationRows } = this.buildSuccessionReportExportRows();

    if (!roleRows.length && !nominationRows.length) {
      return;
    }

    const xlsx = await import('xlsx');
    const workbook = xlsx.utils.book_new();

    const summarySheet = xlsx.utils.aoa_to_sheet([
      ['Report', 'Succession Planning'],
      ['Generated By', this.adminName()],
      ['Generated On', this.reportGeneratedOnLabel()],
      ['Critical Roles', String(roleRows.length)],
      ['Nominations', String(nominationRows.length)],
    ]);
    xlsx.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    const rolesSheet = xlsx.utils.aoa_to_sheet([roleColumns, ...roleRows]);
    xlsx.utils.book_append_sheet(workbook, rolesSheet, 'Critical Roles');

    const nominationsSheet = xlsx.utils.aoa_to_sheet([nominationColumns, ...nominationRows]);
    xlsx.utils.book_append_sheet(workbook, nominationsSheet, 'Nominations');

    const workbookArray = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.triggerDownload(
      new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'LMS-Succession-Planning-Report.xlsx',
    );
  }

  downloadSuccessionReport() {
    if (this.selectedSuccessionReportDownloadFormat() === 'XLSX') {
      void this.downloadSuccessionReportXlsx();
      return;
    }

    this.downloadSuccessionReportCsv();
  }

  downloadPerformanceReportCsv() {
    const { columns, rows, reportRows } = this.buildPerformanceReportExportRows();

    if (!rows.length) {
      return;
    }

    const lines = [
      ['Report', 'Performance Report'],
      ['Generated By', this.adminName()],
      ['Generated On', this.reportGeneratedOnLabel()],
      ['Rows Included', String(reportRows.length)],
      [],
      columns,
      ...rows,
    ];

    const csv = lines
      .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'LMS-Performance-Report.csv');
  }

  async downloadPerformanceReportXlsx() {
    const { columns, rows, reportRows } = this.buildPerformanceReportExportRows();

    if (!rows.length) {
      return;
    }

    const xlsx = await import('xlsx');
    const workbook = xlsx.utils.book_new();
    const worksheetRows = [
      ['Report', 'Performance Report'],
      ['Generated By', this.adminName()],
      ['Generated On', this.reportGeneratedOnLabel()],
      ['Rows Included', String(reportRows.length)],
      [],
      columns,
      ...rows,
    ];
    const worksheet = xlsx.utils.aoa_to_sheet(worksheetRows);

    xlsx.utils.book_append_sheet(workbook, worksheet, 'Performance Report');
    const workbookArray = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.triggerDownload(
      new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'LMS-Performance-Report.xlsx',
    );
  }

  downloadPerformanceReport() {
    if (this.selectedPerformanceReportDownloadFormat() === 'XLSX') {
      void this.downloadPerformanceReportXlsx();
      return;
    }

    this.downloadPerformanceReportCsv();
  }

  downloadCertificateLicenceReportCsv() {
    const { columns, rows, reportRows } = this.buildCertificateLicenceReportExportRows();

    if (!rows.length) {
      return;
    }

    const lines = [
      ['Report', 'Certificates and Licences Report'],
      ['Generated By', this.adminName()],
      ['Generated On', this.reportGeneratedOnLabel()],
      ['Rows Included', String(reportRows.length)],
      [],
      columns,
      ...rows,
    ];

    const csv = lines
      .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'LMS-Certificates-and-Licences-Report.csv');
  }

  async downloadCertificateLicenceReportXlsx() {
    const { columns, rows, reportRows } = this.buildCertificateLicenceReportExportRows();

    if (!rows.length) {
      return;
    }

    const xlsx = await import('xlsx');
    const workbook = xlsx.utils.book_new();
    const worksheetRows = [
      ['Report', 'Certificates and Licences Report'],
      ['Generated By', this.adminName()],
      ['Generated On', this.reportGeneratedOnLabel()],
      ['Rows Included', String(reportRows.length)],
      [],
      columns,
      ...rows,
    ];
    const worksheet = xlsx.utils.aoa_to_sheet(worksheetRows);

    xlsx.utils.book_append_sheet(workbook, worksheet, 'Certificates and Licences');
    const workbookArray = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.triggerDownload(
      new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'LMS-Certificates-and-Licences-Report.xlsx',
    );
  }

  downloadCertificateLicenceReport() {
    if (this.selectedCertificateReportDownloadFormat() === 'XLSX') {
      void this.downloadCertificateLicenceReportXlsx();
      return;
    }

    this.downloadCertificateLicenceReportCsv();
  }

  openTopbarProfileMenu() {
    this.topbarProfileMenuOpen.update((isOpen) => !isOpen);
  }

  closeTopbarProfileMenu() {
    this.topbarProfileMenuOpen.set(false);
  }

  canSwitchToRole(role: LoginRole) {
    return this.availableSwitchRoles().includes(role);
  }

  switchToRole(targetRole: ResolveRolesEntry['role']) {
    if (this.switchingRole()) {
      return;
    }

    this.switchingRole.set(true);
    this.closeTopbarProfileMenu();
    this.backend.switchRole(targetRole).subscribe({
      next: (result) => {
        localStorage.setItem('lms-session', JSON.stringify(createLmsSessionRecord({
          role: result.role,
          username: result.username,
          email: result.email,
          studentId: result.studentId ?? null,
          displayName: combineDisplayName(result.name, result.surname),
        })));
        localStorage.setItem('lms-token', result.token);
        void this.router.navigate([result.route]);
      },
      error: () => {
        this.switchingRole.set(false);
      },
    });
  }

  private loadSwitchableRoles() {
    this.backend.getSwitchableRoles().subscribe({
      next: (response) => {
        this.availableSwitchRoles.set(response.roles);
      },
      error: () => {
        this.availableSwitchRoles.set([]);
      },
    });
  }

  // Prefer the account's real directory name and picture (the same ones shown in the student and
  // training-manager views) over the username/email-derived fallback, so accounts with multiple
  // access roles show one consistent identity everywhere.
  private loadOwnIdentity() {
    this.backend.getMyIdentity().subscribe({
      next: (identity) => {
        const fullName = combineDisplayName(identity.name ?? undefined, identity.surname ?? undefined);
        if (fullName) {
          this.adminName.set(fullName);
        }
        this.adminProfileImageDataUrl.set(identity.profileImageUrl || identity.profileImageDataUrl || null);
      },
      error: () => {
        // Keep the derived fallback name and initials avatar if the lookup fails.
      },
    });
  }

  readonly showLogoutDialog = signal(false);
  readonly logoutDialogStage = signal<'confirm' | 'success'>('confirm');

  logout() {
    this.logoutDialogStage.set('confirm');
    this.showLogoutDialog.set(true);
  }

  cancelLogout() {
    this.showLogoutDialog.set(false);
  }

  confirmLogout() {
    this.logoutDialogStage.set('success');
    clearLmsAuthSession();
    setTimeout(() => {
      this.router.navigate(['/']);
    }, 1200);
  }

  private percentage(part: number, whole: number) {
    if (!whole) {
      return 0;
    }

    return (part / whole) * 100;
  }

  private startWelcomeBannerSequence() {
    this.clearWelcomeBannerTimers();
    this._showWelcomeBanner.set(true);
    this._welcomeBannerLeaving.set(false);

    this.welcomeBannerExitTimer = setTimeout(() => {
      this._welcomeBannerLeaving.set(true);
    }, 2600);

    this.welcomeBannerHideTimer = setTimeout(() => {
      this._showWelcomeBanner.set(false);
      this._welcomeBannerLeaving.set(false);
    }, 3200);
  }

  private clearWelcomeBannerTimers() {
    if (this.welcomeBannerExitTimer) {
      clearTimeout(this.welcomeBannerExitTimer);
      this.welcomeBannerExitTimer = null;
    }

    if (this.welcomeBannerHideTimer) {
      clearTimeout(this.welcomeBannerHideTimer);
      this.welcomeBannerHideTimer = null;
    }
  }

  // ── Courses panel (relocated from training-manager-profile.component.ts) ──────────
  readonly assessmentTypeOptions: ReadonlyArray<TrainingAssessmentType> = ['Quiz', 'Assignment'];
  readonly contentKindOptions: ReadonlyArray<TrainingContentKind> = ['Video', 'Assessment', 'Document', 'Scorm'];
  readonly questionTypeOptions: ReadonlyArray<TrainingQuestionType> = ['Multiple Choice', 'Short Answer', 'True or False', 'Matching'];
  readonly assignmentQuestionTypeOptions: ReadonlyArray<TrainingQuestionType> = ['Long Answer', 'Document Upload'];

  private readonly createSectionOrder: ReadonlyArray<CreateCourseSection> = ['basics', 'content'];

  readonly selectedCoursesView = signal<CoursesPanelView>('create');

  readonly selectedCreateSection = signal<CreateCourseSection>('basics');
  readonly assignmentSubmissionStatusFilter = signal<AssignmentSubmissionFilter>('All');
  readonly assignmentSubmissionSearchTerm = signal('');

  readonly thumbnailPreview = signal<string | null>(null);
  readonly thumbnailFileName = signal<string>('');
  readonly thumbnailUploading = signal(false);
  readonly selectedPublishedOfferingId = signal<string | null>(null);
  readonly selectedAssignmentSubmissionId = signal<string | null>(null);

  readonly createSectionDetailOpen = signal(false);
  readonly draggedContentIndex = signal<number | null>(null);
  readonly expandedContentIndex = signal<number | null>(null);
  readonly expandedQuestionByItem = signal<Record<number, number | null>>({});
  readonly assessmentStatusByItem = signal<Record<number, { tone: 'info' | 'success'; message: string }>>({});
  readonly submittedAssessmentByItem = signal<Record<number, boolean>>({});
  readonly addItemMenuOpen = signal(false);

  readonly editingCourseId = signal<string | null>(null);
  readonly presentationPreviewByItem = signal<Map<ContentItemFormGroup, PowerPointPreviewState>>(new Map());
  readonly contentUploadProgresses = signal<Record<number, number | null>>({});
  private readonly courseCreatedSignal = signal(false);
  readonly courseCreated = computed(() => this.courseCreatedSignal());
  readonly selectedPublishedOffering = computed(() => {
    const selectedId = this.selectedPublishedOfferingId();
    if (!selectedId) {
      return null;
    }

    return this.managerData.offerings().find((offering) => offering.id === selectedId) ?? null;
  });

  readonly filteredAssignmentSubmissions = computed<AssignmentSubmissionRecord[]>(() => {
    const query = this.assignmentSubmissionSearchTerm().trim().toLowerCase();
    const status = this.assignmentSubmissionStatusFilter();
    const submissions = this.managerData.assignmentSubmissions();

    return submissions.filter((submission) => {
      if (status !== 'All' && submission.status !== status) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        submission.studentName,
        submission.studentEmail,
        submission.offeringTitle,
        submission.assessmentTitle,
        submission.questionType,
        submission.status,
      ].some((value) => value.toLowerCase().includes(query));
    });
  });
  readonly selectedAssignmentSubmission = computed<AssignmentSubmissionRecord | null>(() => {
    const selectedId = this.selectedAssignmentSubmissionId();

    if (!selectedId) {
      return this.filteredAssignmentSubmissions()[0] ?? null;
    }

    return this.filteredAssignmentSubmissions().find((submission) => submission.id === selectedId) ?? this.filteredAssignmentSubmissions()[0] ?? null;
  });

  readonly courseForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    completionDeadline: new FormControl('', { nonNullable: true }),
    type: new FormControl<TrainingOfferingType>('Course', { nonNullable: true, validators: [Validators.required] }),
    category: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(12)] }),
    contentItems: new FormArray<ContentItemFormGroup>([]),
  });

  readonly assignmentWorkspaceReviewForm = new FormGroup({
    awardedPoints: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    feedback: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
  });
  readonly assignmentWorkspaceReviewError = signal('');
  readonly assignmentSubmissionFilterOptions: ReadonlyArray<AssignmentSubmissionFilter> = ['All', 'Pending Review', 'Approved', 'Needs Revision'];

  get contentItemsArray() {
    return this.courseForm.controls.contentItems;
  }

  async applyAssignmentReview(event: { submissionId: string; status: 'Approved' | 'Needs Revision'; feedback: string; awardedPoints: number | null }) {
    const result = await this.managerData.reviewAssignmentSubmission({
      submissionId: event.submissionId,
      reviewerName: this.managerData.profile().name,
      status: event.status,
      awardedPoints: event.awardedPoints,
      feedback: event.feedback,
    });

    if (!result.ok) {
      alert(result.message);
    }
  }

  selectCoursesView(view: CoursesPanelView) {
    if (view !== 'create') {
      if (this.editingCourseId()) {
        this.resetCourseBuilder();
      } else {
        this.editingCourseId.set(null);
      }
    }

    if (view !== 'create') {
      this.closeCreateSectionDetail();
      this.closeContentItemDetails();
    }

    if (view !== 'created') {
      this.closePublishedOfferingDetail();
    }

    if (view !== 'submissions') {
      this.selectedAssignmentSubmissionId.set(null);
      this.assignmentWorkspaceReviewForm.reset({ awardedPoints: null, feedback: '' });
    } else {
      const firstSubmission = this.filteredAssignmentSubmissions()[0] ?? null;
      this.selectedAssignmentSubmissionId.set(firstSubmission?.id ?? null);
      this.assignmentWorkspaceReviewForm.reset({ awardedPoints: firstSubmission?.awardedPoints ?? null, feedback: firstSubmission?.reviewerFeedback ?? '' });
    }
    this.assignmentWorkspaceReviewError.set('');

    this.selectedCoursesView.set(view);
  }

  updateAssignmentSubmissionSearch(value: string) {
    this.assignmentSubmissionSearchTerm.set(value);
    const firstSubmission = this.filteredAssignmentSubmissions()[0] ?? null;
    this.selectedAssignmentSubmissionId.set(firstSubmission?.id ?? null);
    this.assignmentWorkspaceReviewForm.reset({ awardedPoints: firstSubmission?.awardedPoints ?? null, feedback: firstSubmission?.reviewerFeedback ?? '' });
    this.assignmentWorkspaceReviewError.set('');
  }

  setAssignmentSubmissionStatusFilter(status: AssignmentSubmissionFilter) {
    this.assignmentSubmissionStatusFilter.set(status);
    const firstSubmission = this.filteredAssignmentSubmissions()[0] ?? null;
    this.selectedAssignmentSubmissionId.set(firstSubmission?.id ?? null);
    this.assignmentWorkspaceReviewForm.reset({ awardedPoints: firstSubmission?.awardedPoints ?? null, feedback: firstSubmission?.reviewerFeedback ?? '' });
    this.assignmentWorkspaceReviewError.set('');
  }

  openAssignmentSubmission(submissionId: string) {
    this.selectedAssignmentSubmissionId.set(submissionId);
    const activeSubmission = this.filteredAssignmentSubmissions().find((submission) => submission.id === submissionId) ?? null;
    this.assignmentWorkspaceReviewForm.reset({ awardedPoints: activeSubmission?.awardedPoints ?? null, feedback: activeSubmission?.reviewerFeedback ?? '' });
    this.assignmentWorkspaceReviewError.set('');
  }

  async applyAssignmentWorkspaceReview(status: 'Approved' | 'Needs Revision') {
    const activeSubmission = this.selectedAssignmentSubmission();
    if (!activeSubmission || this.assignmentWorkspaceReviewForm.invalid) {
      this.assignmentWorkspaceReviewForm.markAllAsTouched();
      return;
    }

    const awardedPoints = this.assignmentWorkspaceReviewForm.controls.awardedPoints.value;
    if (status === 'Approved' && awardedPoints === null) {
      this.assignmentWorkspaceReviewForm.controls.awardedPoints.markAsTouched();
      return;
    }

    this.assignmentWorkspaceReviewError.set('');
    const feedback = this.assignmentWorkspaceReviewForm.controls.feedback.value.trim();
    const result = await this.managerData.reviewAssignmentSubmission({
      submissionId: activeSubmission.id,
      reviewerName: this.managerData.profile().name,
      status,
      awardedPoints: status === 'Approved' ? awardedPoints : null,
      feedback,
    });

    if (!result.ok) {
      this.assignmentWorkspaceReviewError.set(result.message ?? 'Your review could not be saved. Please try again.');
      return;
    }

    this.assignmentWorkspaceReviewForm.reset({
      awardedPoints: status === 'Approved' ? awardedPoints : null,
      feedback,
    });
  }

  downloadSupportingDocument(documentDataUrl: string | null | undefined, fileName: string | null | undefined) {
    if (!documentDataUrl) {
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = documentDataUrl;
    anchor.download = fileName?.trim() || 'supporting-document';
    anchor.rel = 'noopener';
    anchor.style.display = 'none';

    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  formatAssignmentMark(submission: Pick<AssignmentSubmissionRecord, 'awardedPoints' | 'possiblePoints'>) {
    if (submission.awardedPoints === null || submission.possiblePoints <= 0) {
      return 'Not marked yet';
    }

    const percentage = Math.round((submission.awardedPoints / submission.possiblePoints) * 100);
    return `${submission.awardedPoints} / ${submission.possiblePoints} (${percentage}%)`;
  }

  openPublishedOffering(offering: TrainingOffering) {
    this.selectedPublishedOfferingId.set(offering.id);
  }

  closePublishedOfferingDetail() {
    this.selectedPublishedOfferingId.set(null);
  }

  editPublishedOfferingContent(offering: TrainingOffering) {
    this.closePublishedOfferingDetail();
    this.loadOfferingIntoCourseBuilder(offering, 'content');
  }

  savePublishedOffering(update: {
    id: string;
    title: string;
    type: TrainingOfferingType;
    category: string;
    completionDeadline: string;
    status: TrainingOffering['status'];
    description: string;
    thumbnailDataUrl: string | null;
  }) {
    this.managerData.updateOffering(update);
  }

  confirmDeletePublishedOffering(offering: TrainingOffering) {
    const confirmed = confirm(
      `Delete "${offering.title}"? This will remove the course from the created courses list and learners will no longer be able to access it.`,
    );

    if (!confirmed) {
      return;
    }

    const deleted = this.managerData.deleteOffering(offering.id);
    if (deleted) {
      this.closePublishedOfferingDetail();
    }
  }

  openCreateSection(section: CreateCourseSection) {
    if (section !== 'content') {
      this.closeContentItemDetails();
    }

    this.selectedCreateSection.set(section);
    this.createSectionDetailOpen.set(true);
  }

  closeCreateSectionDetail() {
    this.closeContentItemDetails();
    this.createSectionDetailOpen.set(false);
  }

  isCreateSectionComplete(section: CreateCourseSection) {
    if (section === 'basics') {
      return this.courseForm.controls.title.valid
        && this.courseForm.controls.completionDeadline.valid
        && this.courseForm.controls.type.valid
        && this.courseForm.controls.category.valid
        && this.courseForm.controls.description.valid;
    }

    return this.contentItemsArray.controls.every((item) => item.valid);
  }

  createSectionStatus(section: CreateCourseSection) {
    if (this.isCreateSectionComplete(section)) {
      if (section === 'content' && this.contentItemsArray.length === 0) {
        return 'Add later';
      }

      return 'Complete';
    }

    return section === 'content' ? 'Add later' : 'Required';
  }

  contentUploadAccept(kind: TrainingContentKind) {
    if (kind === 'Video') {
      return 'video/*';
    }

    if (kind === 'Scorm') {
      return '.zip,application/zip,application/x-zip-compressed';
    }

    return '.pdf,.doc,.docx,.ppt,.pptx,.xlsx,.txt';
  }

  courseStudioItemTitle(index: number) {
    const item = this.contentItemsArray.at(index);
    if (!item) {
      return 'Untitled unit';
    }

    const title = item.controls.title.value.trim();
    if (title) {
      return title;
    }

    if (item.controls.kind.value === 'Assessment') {
      const assessmentType = item.controls.assessmentType.value;
      if (assessmentType === 'Read and Acknowledge') {
        return 'Acknowledgement unit';
      }

      return `${assessmentType || 'Assessment'} unit`;
    }

    return `${item.controls.kind.value} unit`;
  }

  courseStudioWorkspaceTitle() {
    if (this.selectedCreateSection() === 'basics') {
      return this.courseForm.controls.title.value.trim() || 'New course';
    }

    const activeItem = this.selectedContentItem();
    if (!activeItem) {
      return 'Add content';
    }

    return activeItem.controls.title.value.trim() || 'Untitled';
  }

  isAddItemMenuOpen() {
    return this.addItemMenuOpen();
  }

  toggleAddItemMenu() {
    this.addItemMenuOpen.update((current) => !current);
  }

  addContentItemFromMenu(kind: TrainingContentKind) {
    this.addContentItem(kind);
    this.addItemMenuOpen.set(false);
  }

  hasPreviousCreateSection() {
    return this.createSectionOrder.indexOf(this.selectedCreateSection()) > 0;
  }

  hasNextCreateSection() {
    return this.createSectionOrder.indexOf(this.selectedCreateSection()) < this.createSectionOrder.length - 1;
  }

  goToPreviousCreateSection() {
    const currentIndex = this.createSectionOrder.indexOf(this.selectedCreateSection());
    if (currentIndex <= 0) {
      return;
    }

    this.openCreateSection(this.createSectionOrder[currentIndex - 1]);
  }

  goToNextCreateSection() {
    const currentIndex = this.createSectionOrder.indexOf(this.selectedCreateSection());
    if (currentIndex >= this.createSectionOrder.length - 1) {
      return;
    }

    this.openCreateSection(this.createSectionOrder[currentIndex + 1]);
  }

  createContentItemGroup(kind: TrainingContentKind, item?: Partial<TrainingOffering['contentItems'][number]>): ContentItemFormGroup {
    return new FormGroup({
      id: new FormControl(item?.id ?? '', { nonNullable: true }),
      kind: new FormControl<TrainingContentKind>(kind, { nonNullable: true, validators: [Validators.required] }),
      title: new FormControl(item?.title ?? '', { nonNullable: true, validators: [Validators.required] }),
      assessmentType: new FormControl<TrainingAssessmentType | null>(kind === 'Assessment' ? (item?.assessmentType ?? 'Quiz') : null),
      passMarkPercentage: new FormControl(item?.passMarkPercentage ?? 70, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(100)] }),
      maxAttempts: new FormControl(item?.maxAttempts ?? 3, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
      resourceLink: new FormControl(item?.resourceLink ?? '', { nonNullable: true }),
      uploadedFileName: new FormControl(item?.uploadedFileName ?? '', { nonNullable: true }),
      uploadedFileDataUrl: new FormControl(item?.uploadedFileDataUrl ?? '', { nonNullable: true }),
      convertedPdfUrl: new FormControl(item?.convertedPdfUrl ?? '', { nonNullable: true }),
      requiresAcknowledgement: new FormControl(Boolean(item?.requiresAcknowledgement), { nonNullable: true }),
      allowDownload: new FormControl(item?.allowDownload !== false, { nonNullable: true }),
      durationSeconds: new FormControl<number | null>(item?.durationSeconds ?? null),
      questions: new FormArray<AssessmentQuestionFormGroup>(
        item?.questions?.map((question) => this.createQuestionGroup(question.questionType, question)) ?? [],
      ),
    });
  }

  createQuestionGroup(
    questionType: TrainingQuestionType = 'Multiple Choice',
    questionValue?: Partial<TrainingOffering['contentItems'][number]['questions'][number]>,
  ): AssessmentQuestionFormGroup {
    const resolvedQuestionType = questionValue?.questionType ?? questionType;
    const question = new FormGroup({
      prompt: new FormControl(questionValue?.prompt ?? '', { nonNullable: true, validators: [Validators.required] }),
      questionType: new FormControl<TrainingQuestionType>(resolvedQuestionType, { nonNullable: true, validators: [Validators.required] }),
      points: new FormControl(questionValue?.points ?? 5, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
      choices: new FormArray<AssessmentChoiceFormGroup>(
        questionValue?.choices?.map((choice) => this.createChoiceGroup(choice)) ?? [],
      ),
      matchingPairs: new FormArray<MatchingPairFormGroup>(
        questionValue?.matchingPairs?.map((pair) => this.createMatchingPairGroup(pair)) ?? [],
      ),
      dragAndDropEnabled: new FormControl(questionValue?.dragAndDropEnabled ?? false, { nonNullable: true }),
      attachmentFileName: new FormControl(questionValue?.attachmentFileName ?? '', { nonNullable: true }),
      attachmentDataUrl: new FormControl(questionValue?.attachmentDataUrl ?? '', { nonNullable: true }),
    });

    question.addValidators((control) => this.validateAssessmentQuestion(control));
    this.normalizeQuestionDetails(question);
    return question;
  }

  createChoiceGroup(choice: Partial<TrainingAssessmentChoice> = {}): AssessmentChoiceFormGroup {
    return new FormGroup({
      text: new FormControl(choice.text ?? '', { nonNullable: true, validators: [Validators.required] }),
      points: new FormControl(choice.points ?? 0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
      isCorrect: new FormControl(choice.isCorrect ?? false, { nonNullable: true }),
    });
  }

  createMatchingPairGroup(pair: Partial<TrainingMatchingPair> = {}): MatchingPairFormGroup {
    return new FormGroup({
      prompt: new FormControl(pair.prompt ?? '', { nonNullable: true, validators: [Validators.required] }),
      answer: new FormControl(pair.answer ?? '', { nonNullable: true, validators: [Validators.required] }),
    });
  }

  assessmentTypeForItem(itemIndex: number) {
    return this.contentItemsArray.at(itemIndex).controls.assessmentType.value ?? 'Quiz';
  }

  assessmentQuestionTypeOptionsForItem(itemIndex: number): ReadonlyArray<TrainingQuestionType> {
    switch (this.assessmentTypeForItem(itemIndex)) {
      case 'Assignment':
        return this.assignmentQuestionTypeOptions;
      case 'Mentorship':
      case 'Read and Acknowledge':
        return ['Short Answer'];
      case 'Quiz':
      default:
        return this.questionTypeOptions;
    }
  }

  assessmentCollectionLabel(itemIndex: number) {
    switch (this.assessmentTypeForItem(itemIndex)) {
      case 'Assignment':
        return 'Tasks';
      case 'Mentorship':
        return 'Sessions';
      case 'Read and Acknowledge':
        return 'Acknowledgements';
      case 'Quiz':
      default:
        return 'Questions';
    }
  }

  assessmentEntryLabel(itemIndex: number, count: number) {
    switch (this.assessmentTypeForItem(itemIndex)) {
      case 'Assignment':
        return count === 1 ? 'task' : 'tasks';
      case 'Mentorship':
        return count === 1 ? 'session prompt' : 'session prompts';
      case 'Read and Acknowledge':
        return count === 1 ? 'acknowledgement step' : 'acknowledgement steps';
      case 'Quiz':
      default:
        return count === 1 ? 'question' : 'questions';
    }
  }

  assessmentBuilderHeading(itemIndex: number) {
    switch (this.assessmentTypeForItem(itemIndex)) {
      case 'Assignment':
        return 'Build the assignment brief';
      case 'Mentorship':
        return 'Build the mentorship check-in';
      case 'Read and Acknowledge':
        return 'Build the read-and-acknowledge step';
      case 'Quiz':
      default:
        return 'Build this assessment';
    }
  }

  assessmentAddButtonLabel(itemIndex: number) {
    switch (this.assessmentTypeForItem(itemIndex)) {
      case 'Assignment':
        return 'Add task';
      case 'Mentorship':
        return 'Add session prompt';
      case 'Read and Acknowledge':
        return 'Add acknowledgement step';
      case 'Quiz':
      default:
        return 'Add question';
    }
  }

  assessmentPromptLabel(itemIndex: number) {
    switch (this.assessmentTypeForItem(itemIndex)) {
      case 'Assignment':
        return 'Task Instructions';
      case 'Mentorship':
        return 'Mentorship Prompt';
      case 'Read and Acknowledge':
        return 'Acknowledgement Instructions';
      case 'Quiz':
      default:
        return 'Question Prompt';
    }
  }

  assessmentPromptPlaceholder(itemIndex: number) {
    switch (this.assessmentTypeForItem(itemIndex)) {
      case 'Assignment':
        return 'Describe what learners need to submit for this assignment task';
      case 'Mentorship':
        return 'Describe the mentorship reflection, coaching activity, or follow-up expected from the student';
      case 'Read and Acknowledge':
        return 'Explain what the learner must review and acknowledge once the document is opened';
      case 'Quiz':
      default:
        return 'Add the learner question or instruction';
    }
  }

  assessmentQuestionTypeLabel(itemIndex: number) {
    switch (this.assessmentTypeForItem(itemIndex)) {
      case 'Assignment':
        return 'Response Format';
      case 'Mentorship':
        return 'Mentorship Format';
      case 'Read and Acknowledge':
        return 'Acknowledgement Format';
      case 'Quiz':
      default:
        return 'Question Type';
    }
  }

  assessmentPointsLabel(itemIndex: number) {
    switch (this.assessmentTypeForItem(itemIndex)) {
      case 'Assignment':
        return 'Marks';
      case 'Mentorship':
        return 'Mentorship Credits';
      case 'Read and Acknowledge':
        return 'Acknowledgement Credits';
      case 'Quiz':
      default:
        return 'Points';
    }
  }

  supportsAssessmentAttachment(itemIndex: number) {
    return this.assessmentTypeForItem(itemIndex) !== 'Quiz';
  }

  assessmentAttachmentLabel(itemIndex: number) {
    switch (this.assessmentTypeForItem(itemIndex)) {
      case 'Read and Acknowledge':
        return 'Acknowledgement Document';
      case 'Mentorship':
        return 'Mentorship Guide';
      case 'Assignment':
      default:
        return 'Assignment Document';
    }
  }

  assessmentAttachmentTitle(itemIndex: number) {
    switch (this.assessmentTypeForItem(itemIndex)) {
      case 'Read and Acknowledge':
        return 'Attach the document the learner must open and acknowledge in the LMS.';
      case 'Mentorship':
        return 'Attach a coaching guide, reflection template, or mentor notes for this session.';
      case 'Assignment':
      default:
        return 'Attach a supporting document or assignment brief for this task.';
    }
  }

  assessmentAttachmentHint(itemIndex: number) {
    switch (this.assessmentTypeForItem(itemIndex)) {
      case 'Read and Acknowledge':
        return 'Add the policy, guideline, or compliance document that must be opened before acknowledgement.';
      case 'Mentorship':
        return 'Add a mentoring guide, reflection worksheet, or preparation notes for the student session.';
      case 'Assignment':
      default:
        return 'Add the assignment brief, worksheet, or reference document for this task.';
    }
  }

  defaultQuestionTypeForAssessment(assessmentType: TrainingAssessmentType): TrainingQuestionType {
    return this.assessmentQuestionTypeOptionsForAssessment(assessmentType)[0] ?? 'Multiple Choice';
  }

  assessmentQuestionTypeOptionsForAssessment(assessmentType: TrainingAssessmentType): ReadonlyArray<TrainingQuestionType> {
    switch (assessmentType) {
      case 'Assignment':
        return this.assignmentQuestionTypeOptions;
      case 'Mentorship':
      case 'Read and Acknowledge':
        return ['Short Answer'];
      case 'Quiz':
      default:
        return this.questionTypeOptions;
    }
  }

  onAssessmentTypeChanged(itemIndex: number, assessmentType: TrainingAssessmentType) {
    const item = this.contentItemsArray.at(itemIndex);
    item.patchValue({ assessmentType });
    this.normalizeAssessmentQuestionsForType(itemIndex, assessmentType);
  }

  private normalizeAssessmentQuestionsForType(itemIndex: number, assessmentType: TrainingAssessmentType) {
    const questions = this.assessmentQuestionsAt(itemIndex);
    const allowedQuestionTypes = this.assessmentQuestionTypeOptionsForAssessment(assessmentType);
    const defaultQuestionType = allowedQuestionTypes[0] ?? 'Multiple Choice';

    for (const question of questions.controls) {
      if (!allowedQuestionTypes.includes(question.controls.questionType.value)) {
        question.patchValue({ questionType: defaultQuestionType });
      }

      this.normalizeQuestionDetails(question);
    }
  }

  onAssessmentQuestionTypeChanged(itemIndex: number, questionIndex: number, questionType: TrainingQuestionType) {
    const question = this.assessmentQuestionsAt(itemIndex).at(questionIndex);
    question.controls.questionType.setValue(questionType);
    this.normalizeQuestionDetails(question);
    this.submittedAssessmentByItem.update((current) => ({ ...current, [itemIndex]: false }));
    this.assessmentStatusByItem.update((current) => ({
      ...current,
      [itemIndex]: { tone: 'info', message: `${questionType} format selected for this ${this.assessmentEntryLabel(itemIndex, 1)}.` },
    }));
  }

  addContentItem(kind: TrainingContentKind) {
    this.selectedCreateSection.set('content');
    this.createSectionDetailOpen.set(true);
    this.contentItemsArray.push(this.createContentItemGroup(kind));
    const nextIndex = this.contentItemsArray.length - 1;
    this.expandedContentIndex.set(nextIndex);
    if (kind === 'Assessment') {
      this.expandedQuestionByItem.update((current) => ({
        ...current,
        [nextIndex]: null,
      }));
    }

    this.focusContentItemTitle(nextIndex);
  }

  removeContentItem(index: number) {
    const item = this.contentItemsArray.at(index) ?? null;
    if (item) {
      this.setPresentationPreviewState(item, null);
    }

    this.contentItemsArray.removeAt(index);
    if (this.expandedContentIndex() === index) {
      this.expandedContentIndex.set(Math.max(0, index - 1));
    } else if ((this.expandedContentIndex() ?? -1) > index) {
      this.expandedContentIndex.update((current) => (current === null ? null : current - 1));
    }
    this.expandedQuestionByItem.update((current) => {
      const next: Record<number, number | null> = {};
      for (const [key, value] of Object.entries(current)) {
        const numericKey = Number(key);
        if (numericKey === index) {
          continue;
        }

        next[numericKey > index ? numericKey - 1 : numericKey] = value;
      }

      return next;
    });

    this.contentUploadProgresses.update((current) => {
      const next: Record<number, number | null> = {};
      for (const [key, value] of Object.entries(current)) {
        const numericKey = Number(key);
        if (numericKey === index) {
          continue;
        }

        next[numericKey > index ? numericKey - 1 : numericKey] = value;
      }

      return next;
    });

    if (!this.contentItemsArray.length) {
      this.expandedContentIndex.set(null);
    }
  }

  openContentItemDetails(index: number) {
    this.selectedCreateSection.set('content');
    this.createSectionDetailOpen.set(true);
    this.expandedContentIndex.set(index);
    this.focusContentItemTitle(index);
  }

  openContentItemDetailsFromKeyboard(index: number, event: Event) {
    event.preventDefault();
    this.openContentItemDetails(index);
  }

  closeContentItemDetails() {
    this.expandedContentIndex.set(null);
  }

  private focusContentItemTitle(index: number) {
    setTimeout(() => {
      const titleInput = document.querySelector<HTMLInputElement>(`input[data-content-item-title="${index}"]`);
      titleInput?.focus();
      titleInput?.select();
    });
  }

  selectedContentItem() {
    const index = this.expandedContentIndex();
    if (index === null) {
      return null;
    }

    return this.contentItemsArray.at(index) ?? null;
  }

  activeContentItemIndex() {
    return this.expandedContentIndex() ?? 0;
  }

  activeContentItemNumber() {
    return this.activeContentItemIndex() + 1;
  }

  presentationPreviewState(item: ContentItemFormGroup | null) {
    if (!item) {
      return null;
    }

    return this.presentationPreviewByItem().get(item) ?? null;
  }

  contentItemSummary(index: number) {
    const item = this.contentItemsArray.at(index);
    const kind = item.controls.kind.value;

    if (kind === 'Assessment') {
      const questionCount = this.assessmentQuestionsAt(index).length;
      return `${item.controls.assessmentType.value ?? 'Quiz'} • ${questionCount} ${this.assessmentEntryLabel(index, questionCount)}`;
    }

    if (item.controls.uploadedFileName.value) {
      return item.controls.uploadedFileName.value;
    }

    if (item.controls.resourceLink.value) {
      return 'Linked resource added';
    }

    return `${kind} details not added yet`;
  }

  contentItemResourceState(index: number) {
    const item = this.contentItemsArray.at(index);

    if (item.controls.kind.value === 'Assessment') {
      return this.submittedAssessmentByItem()[index] ? 'Assessment confirmed' : 'Assessment setup';
    }

    if (item.controls.kind.value === 'Document' && item.controls.requiresAcknowledgement.value) {
      return 'Acknowledgement required';
    }

    if (item.controls.kind.value === 'Scorm') {
      return 'SCORM package';
    }

    if (item.controls.uploadedFileName.value) {
      return 'File attached';
    }

    if (item.controls.resourceLink.value) {
      return 'Link attached';
    }

    return 'Resource pending';
  }

  assessmentQuestionsAt(itemIndex: number): FormArray<AssessmentQuestionFormGroup> {
    return this.contentItemsArray.at(itemIndex).controls.questions;
  }

  assessmentChoicesAt(itemIndex: number, questionIndex: number): FormArray<AssessmentChoiceFormGroup> {
    return this.assessmentQuestionsAt(itemIndex).at(questionIndex).controls.choices;
  }

  matchingPairsAt(itemIndex: number, questionIndex: number): FormArray<MatchingPairFormGroup> {
    return this.assessmentQuestionsAt(itemIndex).at(questionIndex).controls.matchingPairs;
  }

  isMultipleChoiceQuestion(itemIndex: number, questionIndex: number) {
    return this.assessmentQuestionsAt(itemIndex).at(questionIndex).controls.questionType.value === 'Multiple Choice';
  }

  isTrueFalseQuestion(itemIndex: number, questionIndex: number) {
    return this.assessmentQuestionsAt(itemIndex).at(questionIndex).controls.questionType.value === 'True or False';
  }

  isMatchingQuestion(itemIndex: number, questionIndex: number) {
    return this.assessmentQuestionsAt(itemIndex).at(questionIndex).controls.questionType.value === 'Matching';
  }

  assessmentStatusMessage(itemIndex: number) {
    return this.assessmentStatusByItem()[itemIndex] ?? null;
  }

  addAssessmentQuestion(itemIndex: number) {
    const questionType = this.defaultQuestionTypeForAssessment(this.assessmentTypeForItem(itemIndex));
    this.assessmentQuestionsAt(itemIndex).push(this.createQuestionGroup(questionType));
    this.expandedQuestionByItem.update((current) => ({
      ...current,
      [itemIndex]: this.assessmentQuestionsAt(itemIndex).length - 1,
    }));
    this.submittedAssessmentByItem.update((current) => ({ ...current, [itemIndex]: false }));
    this.assessmentStatusByItem.update((current) => ({
      ...current,
      [itemIndex]: { tone: 'info', message: `New ${this.assessmentEntryLabel(itemIndex, 1)} added with ${questionType.toLowerCase()} format.` },
    }));
  }

  addAssessmentChoice(itemIndex: number, questionIndex: number) {
    const question = this.assessmentQuestionsAt(itemIndex).at(questionIndex);
    question.controls.choices.push(this.createChoiceGroup());
    question.markAsTouched();
    question.updateValueAndValidity();
    this.submittedAssessmentByItem.update((current) => ({ ...current, [itemIndex]: false }));
  }

  setTrueFalseCorrectAnswer(itemIndex: number, questionIndex: number, correctChoiceIndex: number) {
    const question = this.assessmentQuestionsAt(itemIndex).at(questionIndex);
    const choices = question.controls.choices;

    choices.controls.forEach((choice, index) => {
      const isCorrect = index === correctChoiceIndex;
      choice.controls.isCorrect.setValue(isCorrect);
      choice.controls.points.setValue(isCorrect ? question.controls.points.value : 0);
    });

    question.markAsTouched();
    question.updateValueAndValidity();
    this.submittedAssessmentByItem.update((current) => ({ ...current, [itemIndex]: false }));
  }

  addMatchingPair(itemIndex: number, questionIndex: number) {
    const question = this.assessmentQuestionsAt(itemIndex).at(questionIndex);
    question.controls.matchingPairs.push(this.createMatchingPairGroup());
    question.markAsTouched();
    question.updateValueAndValidity();
    this.submittedAssessmentByItem.update((current) => ({ ...current, [itemIndex]: false }));
  }

  removeMatchingPair(itemIndex: number, questionIndex: number, pairIndex: number) {
    const question = this.assessmentQuestionsAt(itemIndex).at(questionIndex);
    const matchingPairs = question.controls.matchingPairs;

    if (matchingPairs.length === 2) {
      return;
    }

    matchingPairs.removeAt(pairIndex);
    question.markAsTouched();
    question.updateValueAndValidity();
    this.submittedAssessmentByItem.update((current) => ({ ...current, [itemIndex]: false }));
  }

  onAssessmentQuestionPointsChanged(itemIndex: number, questionIndex: number) {
    if (!this.isTrueFalseQuestion(itemIndex, questionIndex)) {
      return;
    }

    const question = this.assessmentQuestionsAt(itemIndex).at(questionIndex);
    const correctChoiceIndex = question.controls.choices.controls.findIndex((choice) => choice.controls.isCorrect.value);
    this.setTrueFalseCorrectAnswer(itemIndex, questionIndex, correctChoiceIndex === -1 ? 0 : correctChoiceIndex);
  }

  removeAssessmentChoice(itemIndex: number, questionIndex: number, choiceIndex: number) {
    const question = this.assessmentQuestionsAt(itemIndex).at(questionIndex);
    const choices = question.controls.choices;

    if (choices.length === 2) {
      return;
    }

    choices.removeAt(choiceIndex);

    if (!choices.controls.some((choice) => choice.controls.isCorrect.value) && choices.length) {
      choices.at(0).controls.isCorrect.setValue(true);
    }

    question.markAsTouched();
    question.updateValueAndValidity();
    this.submittedAssessmentByItem.update((current) => ({ ...current, [itemIndex]: false }));
  }

  removeAssessmentQuestion(itemIndex: number, questionIndex: number) {
    const questions = this.assessmentQuestionsAt(itemIndex);
    questions.removeAt(questionIndex);
    this.expandedQuestionByItem.update((current) => ({
      ...current,
      [itemIndex]: questions.length ? Math.max(0, questionIndex - 1) : null,
    }));
    this.submittedAssessmentByItem.update((current) => ({ ...current, [itemIndex]: false }));
  }

  toggleAssessmentQuestion(itemIndex: number, questionIndex: number) {
    this.expandedQuestionByItem.update((current) => ({
      ...current,
      [itemIndex]: current[itemIndex] === questionIndex ? null : questionIndex,
    }));
  }

  isAssessmentQuestionExpanded(itemIndex: number, questionIndex: number) {
    return this.expandedQuestionByItem()[itemIndex] === questionIndex;
  }

  submitAssessmentSetup(itemIndex: number) {
    const questions = this.assessmentQuestionsAt(itemIndex);
    const questionCount = questions.length;

    if (!questionCount) {
      this.assessmentStatusByItem.update((current) => ({
        ...current,
        [itemIndex]: {
          tone: 'info',
          message: `Add at least one ${this.assessmentEntryLabel(itemIndex, 1)} before submitting this assessment.`,
        },
      }));
      this.expandedQuestionByItem.update((current) => ({
        ...current,
        [itemIndex]: null,
      }));
      return;
    }

    questions.markAllAsTouched();
    questions.updateValueAndValidity();

    const invalidQuestionIndex = questions.controls.findIndex((question) => question.invalid);
    if (invalidQuestionIndex !== -1) {
      this.expandedQuestionByItem.update((current) => ({
        ...current,
        [itemIndex]: invalidQuestionIndex,
      }));
      return;
    }

    const assessmentType = this.assessmentTypeForItem(itemIndex);
    if (assessmentType === 'Read and Acknowledge' && !this.hasReadAndAcknowledgeDocument(itemIndex)) {
      this.assessmentStatusByItem.update((current) => ({
        ...current,
        [itemIndex]: {
          tone: 'info',
          message: 'Attach an acknowledgement document or add a hosted document link before submitting this item.',
        },
      }));
      this.expandedQuestionByItem.update((current) => ({
        ...current,
        [itemIndex]: 0,
      }));
      return;
    }

    this.submittedAssessmentByItem.update((current) => ({ ...current, [itemIndex]: true }));
    this.assessmentStatusByItem.update((current) => ({
      ...current,
      [itemIndex]: {
        tone: 'success',
        message: `${assessmentType} assessment submitted with ${questionCount} ${this.assessmentEntryLabel(itemIndex, questionCount)}.`,
      },
    }));
  }

  private validateAssessmentQuestion(control: AbstractControl): ValidationErrors | null {
    if (!(control instanceof FormGroup)) {
      return null;
    }

    const questionGroup = control as AssessmentQuestionFormGroup;

    if (questionGroup.controls.questionType.value === 'Matching') {
      if (questionGroup.controls.matchingPairs.length < 2) {
        return { matchingMinPairs: true };
      }

      return null;
    }

    if (questionGroup.controls.questionType.value === 'True or False') {
      const choices = questionGroup.controls.choices;
      const correctCount = choices.controls.filter((choice) => choice.controls.isCorrect.value).length;

      if (choices.length !== 2) {
        return { trueFalseChoicesInvalid: true };
      }

      if (correctCount !== 1) {
        return { trueFalseCorrectAnswerRequired: true };
      }

      return null;
    }

    if (questionGroup.controls.questionType.value !== 'Multiple Choice') {
      return null;
    }

    const choices = questionGroup.controls.choices;

    if (choices.length < 2) {
      return { multipleChoiceMinOptions: true };
    }

    if (!choices.controls.some((choice) => choice.controls.isCorrect.value)) {
      return { multipleChoiceCorrectAnswerRequired: true };
    }

    return null;
  }

  private createDefaultMultipleChoiceChoices(totalPoints: number) {
    return [
      this.createChoiceGroup({ points: Math.max(1, totalPoints || 1), isCorrect: true }),
      this.createChoiceGroup(),
    ];
  }

  private createDefaultTrueFalseChoices(totalPoints: number) {
    return [
      this.createChoiceGroup({ text: 'True', points: Math.max(1, totalPoints || 1), isCorrect: true }),
      this.createChoiceGroup({ text: 'False', points: 0, isCorrect: false }),
    ];
  }

  private createDefaultMatchingPairs() {
    return [
      this.createMatchingPairGroup(),
      this.createMatchingPairGroup(),
    ];
  }

  private normalizeQuestionDetails(question: AssessmentQuestionFormGroup) {
    const choices = question.controls.choices;
    const matchingPairs = question.controls.matchingPairs;

    if (question.controls.questionType.value === 'Multiple Choice') {
      while (matchingPairs.length) {
        matchingPairs.removeAt(0);
      }

      question.controls.dragAndDropEnabled.setValue(false, { emitEvent: false });

      if (choices.length < 2) {
        while (choices.length) {
          choices.removeAt(0);
        }

        for (const choice of this.createDefaultMultipleChoiceChoices(question.controls.points.value)) {
          choices.push(choice);
        }
      }

      if (!choices.controls.some((choice) => choice.controls.isCorrect.value)) {
        choices.at(0).controls.isCorrect.setValue(true);
      }

      question.updateValueAndValidity({ emitEvent: false });
      return;
    }

    if (question.controls.questionType.value === 'True or False') {
      while (matchingPairs.length) {
        matchingPairs.removeAt(0);
      }

      while (choices.length) {
        choices.removeAt(0);
      }

      for (const choice of this.createDefaultTrueFalseChoices(question.controls.points.value)) {
        choices.push(choice);
      }

      question.controls.dragAndDropEnabled.setValue(false, { emitEvent: false });
      question.updateValueAndValidity({ emitEvent: false });
      return;
    }

    if (question.controls.questionType.value === 'Matching') {
      while (choices.length) {
        choices.removeAt(0);
      }

      if (matchingPairs.length < 2) {
        while (matchingPairs.length) {
          matchingPairs.removeAt(0);
        }

        for (const pair of this.createDefaultMatchingPairs()) {
          matchingPairs.push(pair);
        }
      }

      question.controls.dragAndDropEnabled.setValue(true, { emitEvent: false });
      question.updateValueAndValidity({ emitEvent: false });
      return;
    }

    while (choices.length) {
      choices.removeAt(0);
    }

    while (matchingPairs.length) {
      matchingPairs.removeAt(0);
    }

    question.controls.dragAndDropEnabled.setValue(false, { emitEvent: false });
    question.updateValueAndValidity({ emitEvent: false });
  }

  isReadAndAcknowledgeAssessment(itemIndex: number) {
    return this.assessmentTypeForItem(itemIndex) === 'Read and Acknowledge';
  }

  private hasReadAndAcknowledgeDocument(itemIndex: number) {
    const item = this.contentItemsArray.at(itemIndex);

    if (item.controls.resourceLink.value.trim()) {
      return true;
    }

    return this.assessmentQuestionsAt(itemIndex).controls.some((question) =>
      question.controls.attachmentFileName.value.trim().length > 0 || question.controls.attachmentDataUrl.value.trim().length > 0,
    );
  }

  onContentKindChanged(index: number, nextKind: TrainingContentKind) {
    const item = this.contentItemsArray.at(index);
    const questions = item.controls.questions;

    if (nextKind === 'Assessment') {
      const assessmentType = item.controls.assessmentType.value ?? 'Quiz';
      item.patchValue({ assessmentType });
      this.normalizeAssessmentQuestionsForType(index, assessmentType);
      this.expandedQuestionByItem.update((current) => ({
        ...current,
        [index]: questions.length ? 0 : null,
      }));
      return;
    }

    item.patchValue({ assessmentType: null });
    if (nextKind !== 'Document') {
      item.controls.requiresAcknowledgement.setValue(false);
    }
    while (questions.length) {
      questions.removeAt(0);
    }
    this.expandedQuestionByItem.update((current) => ({
      ...current,
      [index]: null,
    }));
    this.expandedContentIndex.set(index);
  }

  onThumbnailSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || !file.type.startsWith('image/')) {
      this.thumbnailPreview.set(null);
      this.thumbnailFileName.set('');
      input.value = '';
      return;
    }

    this.thumbnailUploading.set(true);
    this.thumbnailFileName.set(`Uploading ${file.name}…`);
    input.value = '';

    this.backend.uploadFileChunked(file, 'course-thumbnails').subscribe({
      next: (uploadEvent) => {
        if (uploadEvent.type !== 'complete') return;
        this.thumbnailPreview.set(uploadEvent.url);
        this.thumbnailFileName.set(file.name);
        this.thumbnailUploading.set(false);
      },
      error: () => {
        this.thumbnailPreview.set(null);
        this.thumbnailFileName.set('');
        this.thumbnailUploading.set(false);
        alert(`Failed to upload "${file.name}". Please check your connection and try again.`);
      },
    });
  }

  onContentFileSelected(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      input.value = '';
      return;
    }

    const item = this.contentItemsArray.at(index);
    if (item.controls.kind.value === 'Scorm' && !/\.zip$/i.test(file.name)) {
      input.value = '';
      alert('SCORM uploads must be .zip packages. Please choose a SCORM package file.');
      return;
    }

    if (item.controls.kind.value === 'Scorm') {
      item.patchValue({ uploadedFileName: `Uploading ${file.name}…`, uploadedFileDataUrl: '' });
      this.contentUploadProgresses.update((prev) => ({ ...prev, [index]: 0 }));
      input.value = '';

      this.backend.uploadScormPackage(file).subscribe({
        next: (result) => {
          this.contentUploadProgresses.update((prev) => ({ ...prev, [index]: null }));
          item.patchValue({
            uploadedFileName: file.name,
            uploadedFileDataUrl: '',
            resourceLink: result.launchUrl,
            requiresAcknowledgement: false,
            // Keep the "Launch SCORM package" open-in-new-tab fallback visible — it's
            // gated on this same flag, so forcing it false hid that button entirely.
            allowDownload: true,
          });
        },
        error: () => {
          this.contentUploadProgresses.update((prev) => ({ ...prev, [index]: null }));
          item.patchValue({ uploadedFileName: '', uploadedFileDataUrl: '' });
          alert(`Failed to process SCORM package "${file.name}". Please ensure it contains a valid launch file and try again.`);
        },
      });

      return;
    }

    item.patchValue({ uploadedFileName: `Uploading ${file.name}…`, uploadedFileDataUrl: '' });
    this.contentUploadProgresses.update((prev) => ({ ...prev, [index]: 0 }));
    input.value = '';

    if (item.controls.kind.value === 'Video') {
      // Read the real video length so the student dashboard's "Total Hours Spent"
      // reflects this course's actual content instead of a flat guess.
      void this.readVideoDurationSeconds(file).then((durationSeconds) => {
        if (durationSeconds) {
          item.patchValue({ durationSeconds });
        }
      });
    }

    this.backend.uploadFileChunked(file, 'content-items').subscribe({
      next: (event) => {
        if (event.type === 'progress') {
          this.contentUploadProgresses.update((prev) => ({ ...prev, [index]: event.percent }));
          return;
        }

        this.contentUploadProgresses.update((prev) => ({ ...prev, [index]: null }));
        item.patchValue({
          uploadedFileName: file.name,
          uploadedFileDataUrl: '',
          resourceLink: event.url,
        });
        this.updatePresentationPreview(item, file.name, '');

        // After a successful PPTX upload, convert it to PDF for inline student preview.
        if (/\.pptx?$/i.test(file.name)) {
          this.contentUploadProgresses.update((prev) => ({ ...prev, [index]: -1 })); // -1 signals converting state
          this.backend.convertPptxToPdf(file).subscribe({
            next: (result) => {
              item.patchValue({ convertedPdfUrl: result.pdfUrl });
              this.contentUploadProgresses.update((prev) => ({ ...prev, [index]: null }));
            },
            error: () => {
              // Conversion failed — students will see the download-only fallback. Non-fatal.
              this.contentUploadProgresses.update((prev) => ({ ...prev, [index]: null }));
            },
          });
        }
      },
      error: () => {
        this.contentUploadProgresses.update((prev) => ({ ...prev, [index]: null }));
        item.patchValue({ uploadedFileName: '', uploadedFileDataUrl: '' });
        alert(`Failed to upload "${file.name}". Please check your connection and try again.`);
      },
    });
  }

  /** Reads a video file's real length client-side via its metadata — no upload or server round-trip needed. */
  private readVideoDurationSeconds(file: File): Promise<number | null> {
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';

      const cleanUp = () => {
        URL.revokeObjectURL(objectUrl);
        video.removeAttribute('src');
        video.load();
      };

      video.onloadedmetadata = () => {
        const duration = Number.isFinite(video.duration) ? video.duration : null;
        cleanUp();
        resolve(duration);
      };

      video.onerror = () => {
        cleanUp();
        resolve(null);
      };

      video.src = objectUrl;
    });
  }

  onAssessmentQuestionFileSelected(itemIndex: number, questionIndex: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      input.value = '';
      return;
    }

    const question = this.assessmentQuestionsAt(itemIndex).at(questionIndex);
    const reader = new FileReader();
    reader.onload = () => {
      question.controls.attachmentFileName.setValue(file.name);
      question.controls.attachmentDataUrl.setValue(typeof reader.result === 'string' ? reader.result : '');
      question.markAsTouched();
      this.submittedAssessmentByItem.update((current) => ({ ...current, [itemIndex]: false }));
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  removeAssessmentQuestionFile(itemIndex: number, questionIndex: number) {
    const question = this.assessmentQuestionsAt(itemIndex).at(questionIndex);
    question.controls.attachmentFileName.setValue('');
    question.controls.attachmentDataUrl.setValue('');
    question.markAsTouched();
    this.submittedAssessmentByItem.update((current) => ({ ...current, [itemIndex]: false }));
  }

  onContentDragStart(index: number) {
    this.draggedContentIndex.set(index);
  }

  onContentDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onContentDrop(targetIndex: number) {
    const sourceIndex = this.draggedContentIndex();
    if (sourceIndex === null || sourceIndex === targetIndex) {
      this.draggedContentIndex.set(null);
      return;
    }

    const current = this.contentItemsArray.at(sourceIndex);
    this.contentItemsArray.removeAt(sourceIndex);
    const destinationIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    this.contentItemsArray.insert(destinationIndex, current);
    if (this.expandedContentIndex() === sourceIndex) {
      this.expandedContentIndex.set(destinationIndex);
    } else if ((this.expandedContentIndex() ?? -1) > sourceIndex && (this.expandedContentIndex() ?? -1) <= destinationIndex) {
      this.expandedContentIndex.update((currentIndex) => (currentIndex === null ? null : currentIndex - 1));
    } else if ((this.expandedContentIndex() ?? -1) < sourceIndex && (this.expandedContentIndex() ?? -1) >= destinationIndex) {
      this.expandedContentIndex.update((currentIndex) => (currentIndex === null ? null : currentIndex + 1));
    }
    this.expandedQuestionByItem.update((currentMap) => {
      const next: Record<number, number | null> = {};
      const entries = Object.entries(currentMap).map(([key, value]) => [Number(key), value] as const);
      for (const [key, value] of entries) {
        if (key === sourceIndex) {
          next[destinationIndex] = value;
          continue;
        }

        if (sourceIndex < targetIndex && key > sourceIndex && key < targetIndex) {
          next[key - 1] = value;
          continue;
        }

        if (sourceIndex > targetIndex && key >= targetIndex && key < sourceIndex) {
          next[key + 1] = value;
          continue;
        }

        next[key] = value;
      }

      return next;
    });
    this.draggedContentIndex.set(null);
  }

  onContentDragEnd() {
    this.draggedContentIndex.set(null);
  }

  private setPresentationPreviewState(item: ContentItemFormGroup, preview: PowerPointPreviewState | null) {
    this.presentationPreviewByItem.update((current) => {
      const next = new Map(current);
      if (preview) {
        next.set(item, preview);
      } else {
        next.delete(item);
      }
      return next;
    });
  }

  private updatePresentationPreview(item: ContentItemFormGroup, fileName = item.controls.uploadedFileName.value, dataUrl = item.controls.uploadedFileDataUrl.value) {
    const previewableType = resolvePowerPointUploadType(fileName, dataUrl);

    if (!previewableType) {
      this.setPresentationPreviewState(item, null);
      return;
    }

    this.setPresentationPreviewState(item, {
      fileName,
      message:
        previewableType === 'pptx'
          ? 'Open this presentation in Microsoft PowerPoint to review the original slides and formatting before publishing.'
          : 'Open this legacy PowerPoint file in Microsoft PowerPoint to review the original slides and formatting.',
    });
  }

  private restorePresentationPreviews() {
    this.presentationPreviewByItem.set(new Map());
    for (const item of this.contentItemsArray.controls) {
      this.updatePresentationPreview(item);
    }
  }

  private revealFirstInvalidSection() {
    if (
      this.courseForm.controls.title.invalid ||
      this.courseForm.controls.completionDeadline.invalid ||
      this.courseForm.controls.type.invalid ||
      this.courseForm.controls.category.invalid
    ) {
      this.openCreateSection('basics');
      return;
    }

    const invalidContentIndex = this.contentItemsArray.controls.findIndex((item) => item.invalid);
    if (invalidContentIndex !== -1) {
      this.openCreateSection('content');
      this.expandedContentIndex.set(invalidContentIndex);

      const invalidQuestionIndex = this.assessmentQuestionsAt(invalidContentIndex).controls.findIndex((question) => question.invalid);
      if (invalidQuestionIndex !== -1) {
        this.expandedQuestionByItem.update((current) => ({
          ...current,
          [invalidContentIndex]: invalidQuestionIndex,
        }));
      }
      return;
    }

    if (this.courseForm.controls.description.invalid) {
      this.openCreateSection('basics');
    }
  }

  private contentItemsPayload() {
    return this.contentItemsArray.getRawValue().map((item) => ({
      ...item,
      durationSeconds: item.durationSeconds ?? undefined,
    }));
  }

  submitCourseForm() {
    if (this.courseForm.invalid) {
      this.courseForm.markAllAsTouched();
      this.courseCreatedSignal.set(false);
      this.revealFirstInvalidSection();
      return;
    }

    if (this.thumbnailUploading() || Object.values(this.contentUploadProgresses()).some((progress) => progress !== null && progress !== undefined)) {
      alert('Please wait for the thumbnail and content uploads to finish before saving.');
      this.courseCreatedSignal.set(false);
      return;
    }

    const editingOffering = this.editingCourseId()
      ? this.managerData.offerings().find((offering) => offering.id === this.editingCourseId()) ?? null
      : null;

    if (editingOffering) {
      const updatedOffering = this.managerData.updateOffering({
        id: editingOffering.id,
        title: this.courseForm.controls.title.value,
        completionDeadline: this.courseForm.controls.completionDeadline.value,
        type: this.courseForm.controls.type.value,
        category: this.courseForm.controls.category.value,
        thumbnailDataUrl: this.thumbnailPreview(),
        description: this.courseForm.controls.description.value,
        status: editingOffering.status,
        contentItems: this.contentItemsPayload(),
      });

      if (!updatedOffering) {
        this.courseCreatedSignal.set(false);
        return;
      }

      this.resetCourseBuilder();
      this.courseCreatedSignal.set(true);
      this.selectedCoursesView.set('created');
      this.openPublishedOffering(updatedOffering);
      return;
    }

    const createdOffering = this.managerData.createOffering({
      title: this.courseForm.controls.title.value,
      completionDeadline: this.courseForm.controls.completionDeadline.value,
      type: this.courseForm.controls.type.value,
      category: this.courseForm.controls.category.value,
      thumbnailDataUrl: this.thumbnailPreview(),
      description: this.courseForm.controls.description.value,
      contentItems: this.contentItemsPayload(),
    });

    if (!createdOffering) {
      this.courseCreatedSignal.set(false);
      return;
    }

    this.resetCourseBuilder();
    this.courseCreatedSignal.set(true);
    this.selectedCoursesView.set('created');
    this.openPublishedOffering(createdOffering);
  }

  cancelCourseEditing() {
    this.resetCourseBuilder();
  }

  private loadOfferingIntoCourseBuilder(offering: TrainingOffering, section: CreateCourseSection) {
    this.editingCourseId.set(offering.id);
    this.courseCreatedSignal.set(false);
    this.courseForm.reset({
      title: offering.title,
      completionDeadline: offering.completionDeadline,
      type: offering.type,
      category: offering.category,
      description: offering.description,
    });
    this.courseForm.setControl(
      'contentItems',
      new FormArray<ContentItemFormGroup>(
        offering.contentItems.map((item) => this.createContentItemGroup(item.kind, item)),
      ),
    );
    this.thumbnailPreview.set(offering.thumbnailDataUrl);
    this.thumbnailFileName.set('');
    this.thumbnailUploading.set(false);
    this.contentUploadProgresses.set({});
    this.assessmentStatusByItem.set({});
    this.submittedAssessmentByItem.set({});
    this.expandedQuestionByItem.set({});
    this.addItemMenuOpen.set(false);
    this.selectedCoursesView.set('create');
    this.openCreateSection(section);
    this.expandedContentIndex.set(section === 'content' && offering.contentItems.length ? 0 : null);
    this.restorePresentationPreviews();
  }

  private resetCourseBuilder() {
    this.courseForm.reset({
      title: '',
      completionDeadline: '',
      type: 'Course',
      category: '',
      description: '',
    });
    this.courseForm.setControl('contentItems', new FormArray<ContentItemFormGroup>([]));
    this.thumbnailPreview.set(null);
    this.thumbnailFileName.set('');
    this.thumbnailUploading.set(false);
    this.contentUploadProgresses.set({});
    this.createSectionDetailOpen.set(false);
    this.expandedContentIndex.set(null);
    this.expandedQuestionByItem.set({});
    this.assessmentStatusByItem.set({});
    this.submittedAssessmentByItem.set({});
    this.addItemMenuOpen.set(false);
    this.selectedCreateSection.set('basics');
    this.editingCourseId.set(null);
    this.presentationPreviewByItem.set(new Map());
  }

  offeringAssessmentCount(offering: TrainingOffering) {
    return offering.contentItems.filter((item) => item.kind === 'Assessment').length;
  }

  offeringContentSummary(offering: TrainingOffering) {
    const videos = offering.contentItems.filter((item) => item.kind === 'Video').length;
    const documents = offering.contentItems.filter((item) => item.kind === 'Document').length;
    const scormPackages = offering.contentItems.filter((item) => item.kind === 'Scorm').length;
    const parts = [
      videos ? `${videos} video${videos === 1 ? '' : 's'}` : '',
      documents ? `${documents} document${documents === 1 ? '' : 's'}` : '',
      scormPackages ? `${scormPackages} SCORM package${scormPackages === 1 ? '' : 's'}` : '',
    ].filter(Boolean);

    return parts.length ? parts.join(' • ') : 'Assessment only';
  }

  offeringQuestionCount(offering: TrainingOffering) {
    return offering.contentItems.reduce((total, item) => total + item.questions.length, 0);
  }


  offeringEnrollmentCount(offeringId: string) {
    return this.managerData.offeringAssignmentCounts().get(offeringId) ?? 0;
  }

  offeringAssignmentSubmissions(offeringId: string) {
    return this.managerData.assignmentSubmissions().filter((submission) => submission.offeringId === offeringId);
  }

  handleOverlayEscape() {
    if (this.selectedPanel() === 'courses' && this.selectedCoursesView() === 'create' && this.expandedContentIndex() !== null) {
      this.closeContentItemDetails();
      return;
    }

    if (this.selectedPanel() === 'courses' && this.selectedCoursesView() === 'create' && this.createSectionDetailOpen()) {
      this.closeCreateSectionDetail();
      return;
    }

    if (this.selectedPanel() === 'courses' && this.selectedCoursesView() === 'created' && this.selectedPublishedOfferingId()) {
      this.closePublishedOfferingDetail();
      return;
    }

    if (this.selectedPanel() === 'enrollment' && this.creatingEnrollmentGroup()) {
      this.closeCreateEnrollmentGroup();
      return;
    }

    if (this.selectedPanel() === 'enrollment' && this.editingEnrollmentGroup()) {
      this.closeEnrollmentGroupEdit();
      return;
    }

    if (this.selectedPanel() === 'enrollment' && this.assignWizardOpen()) {
      this.closeAssignWizard();
      return;
    }

    if (this.selectedPanel() === 'enrollment' && this.managingEnrollmentStudent()) {
      this.closeManageEnrollmentStudent();
      return;
    }

    if (this.selectedPanel() === 'enrollment' && this.managingEnrollmentGroup()) {
      this.closeManageEnrollmentGroup();
      return;
    }
  }

  // ── Student Enrollment panel (relocated from training-manager-profile.component.ts) ──
  readonly selectedEnrollmentView = signal<EnrollmentPanelView>('students');

  readonly studentSearchTerm = signal('');
  readonly createGroupStudentSearchTerm = signal('');
  readonly creatingEnrollmentGroup = signal(false);
  readonly selectedStudentsForNewGroup = signal<Record<string, boolean>>({});
  readonly selectedStudentsForEditedGroup = signal<Record<string, boolean>>({});
  readonly selectedStudentsForRemovalFromEditedGroup = signal<Record<string, boolean>>({});
  readonly editingEnrollmentStudentId = signal<string | null>(null);
  readonly editingEnrollmentGroupName = signal<string | null>(null);
  readonly managingEnrollmentStudentId = signal<string | null>(null);
  readonly managingEnrollmentGroupName = signal<string | null>(null);

  // ── Assign wizard (course/assignment → students → deadline) ─────────────
  readonly assignWizardOpen = signal(false);
  readonly assignWizardStep = signal<AssignWizardStep>(1);
  readonly assignWizardSelectedOfferingIds = signal<Record<string, boolean>>({});
  readonly assignWizardSelectedStudentIds = signal<Record<string, boolean>>({});
  readonly assignWizardOfferingSearchTerm = signal('');
  readonly assignWizardStudentSearchTerm = signal('');
  readonly assignWizardStudentGroupFilter = signal('');
  readonly assignWizardDeadline = signal('');
  readonly assignWizardSaving = signal(false);
  // Pop notification shown after a successful assignment — the wizard closes immediately rather
  // than showing its own in-modal success screen, so this is the only confirmation the manager
  // sees. Auto-dismisses; a timer handle (not a signal, since it's not rendered) lets a second
  // assignment landing before the first toast clears restart the countdown instead of the two
  // racing to clear each other's toast early.
  readonly assignWizardToast = signal<string | null>(null);
  private assignWizardToastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly editingEnrollmentGroup = computed(() => {
    const selectedName = this.editingEnrollmentGroupName();
    if (!selectedName) {
      return null;
    }

    return this.filteredEnrollmentGroups().find((group) => group.name === selectedName) ?? null;
  });
  readonly managingEnrollmentStudent = computed(() => {
    const selectedId = this.managingEnrollmentStudentId();
    if (!selectedId) {
      return null;
    }

    return this.managerData.students().find((student) => student.id === selectedId) ?? null;
  });
  readonly managingEnrollmentGroup = computed(() => {
    const selectedName = this.managingEnrollmentGroupName();
    if (!selectedName) {
      return null;
    }

    return this.filteredEnrollmentGroups().find((group) => group.name === selectedName) ?? null;
  });

  readonly assignWizardFilteredOfferings = computed(() => {
    const query = this.assignWizardOfferingSearchTerm().trim().toLowerCase();
    const offerings = this.managerData.offerings();

    if (!query) {
      return offerings;
    }

    return offerings.filter((offering) =>
      [offering.title, offering.type, offering.category, offering.description]
        .some((value) => value.toLowerCase().includes(query)),
    );
  });
  readonly assignWizardSelectedOfferings = computed(() => {
    const selected = this.assignWizardSelectedOfferingIds();
    return this.managerData.offerings().filter((offering) => selected[offering.id]);
  });
  readonly assignWizardSelectedOfferingCount = computed(() =>
    Object.values(this.assignWizardSelectedOfferingIds()).filter(Boolean).length,
  );
  // Distinct groups across the current roster, for the group filter dropdown in the assign
  // wizard's student-selection step — lets a manager narrow the list to one group (e.g. a single
  // intake cohort) and select everyone in it at once, rather than relying on search text alone.
  readonly assignWizardStudentGroups = computed(() => {
    const groups = new Set(this.managerData.students().map((student) => student.group.trim()).filter(Boolean));
    return Array.from(groups).sort((left, right) => left.localeCompare(right));
  });
  readonly assignWizardFilteredStudents = computed(() => {
    const query = this.assignWizardStudentSearchTerm().trim().toLowerCase();
    const groupFilter = this.assignWizardStudentGroupFilter();
    const students = groupFilter
      ? this.managerData.students().filter((student) => student.group === groupFilter)
      : this.managerData.students();

    if (!query) {
      return students;
    }

    return students.filter((student) =>
      [student.name, student.surname, student.group, student.email, student.department]
        .some((value) => value.toLowerCase().includes(query)),
    );
  });
  // "Select all" reflects and acts on whatever the search has currently filtered down to, not
  // literally every student in the system — the more useful reading when it's sitting right above
  // a search box, and it means searching to a smaller group and selecting all of them doesn't
  // silently pull in everyone else too.
  readonly assignWizardAllFilteredStudentsSelected = computed(() => {
    const filtered = this.assignWizardFilteredStudents();
    if (!filtered.length) {
      return false;
    }

    const selected = this.assignWizardSelectedStudentIds();
    return filtered.every((student) => selected[student.id]);
  });
  readonly assignWizardSelectedStudents = computed(() => {
    const selected = this.assignWizardSelectedStudentIds();
    return this.managerData.students().filter((student) => selected[student.id]);
  });
  readonly assignWizardSelectedStudentCount = computed(() =>
    Object.values(this.assignWizardSelectedStudentIds()).filter(Boolean).length,
  );
  readonly filteredEnrollmentStudents = computed(() => {
    const query = this.studentSearchTerm().trim().toLowerCase();
    const students = this.managerData.students();

    if (!query) {
      return students;
    }

    return students.filter((student) =>
      [
        student.name,
        student.surname,
        student.group,
        student.dateEnrolled,
        student.deadlineDate,
        student.email,
        student.activeStatus,
        student.department,
        student.status,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  });
  readonly filteredEnrollmentGroups = computed<EnrollmentGroupSummary[]>(() => {
    const groups = new Map<string, EnrollmentStudent[]>();

    for (const student of this.filteredEnrollmentStudents()) {
      const groupName = student.group.trim() || 'Ungrouped';
      groups.set(groupName, [...(groups.get(groupName) ?? []), student]);
    }

    return Array.from(groups.entries())
      .map(([name, members]) => {
        const startDates = members.map((student) => student.dateEnrolled).filter(Boolean).sort();
        const endDates = members.map((student) => student.deadlineDate).filter(Boolean).sort();

        return {
          name,
          members: [...members].sort((left, right) => `${left.name} ${left.surname}`.localeCompare(`${right.name} ${right.surname}`)),
          activeCount: members.filter((student) => student.activeStatus === 'Active').length,
          startDate: startDates[0] || 'No start date',
          endDate: endDates[endDates.length - 1] || 'No end date',
        } satisfies EnrollmentGroupSummary;
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  });
  readonly groupCreationStudents = computed(() => {
    const query = this.createGroupStudentSearchTerm().trim().toLowerCase();
    const students = [...this.managerData.students()].sort((left, right) => `${left.name} ${left.surname}`.localeCompare(`${right.name} ${right.surname}`));

    if (!query) {
      return students;
    }

    return students.filter((student) =>
      [student.name, student.surname, student.group, student.email, student.department, student.activeStatus]
        .some((value) => value.toLowerCase().includes(query)),
    );
  });
  readonly selectedStudentsForNewGroupCount = computed(() =>
    Object.values(this.selectedStudentsForNewGroup()).filter(Boolean).length,
  );
  readonly currentEditingGroupMembers = computed(() => this.editingEnrollmentGroup()?.members ?? []);
  readonly selectedStudentsForRemovalFromEditedGroupCount = computed(() =>
    Object.values(this.selectedStudentsForRemovalFromEditedGroup()).filter(Boolean).length,
  );
  readonly availableStudentsForEditedGroup = computed(() => {
    const editingGroup = this.editingEnrollmentGroup();

    if (!editingGroup) {
      return [];
    }

    const existingMemberIds = new Set(editingGroup.members.map((student) => student.id));

    return [...this.filteredEnrollmentStudents()]
      .filter((student) => !existingMemberIds.has(student.id))
      .sort((left, right) => `${left.name} ${left.surname}`.localeCompare(`${right.name} ${right.surname}`));
  });
  readonly selectedStudentsForEditedGroupCount = computed(() =>
    Object.values(this.selectedStudentsForEditedGroup()).filter(Boolean).length,
  );

  readonly enrollmentGroupForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    startDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    endDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly createEnrollmentGroupForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    startDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    endDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  selectEnrollmentView(view: EnrollmentPanelView) {
    this.selectedEnrollmentView.set(view);
  }

  openCreateEnrollmentGroup() {
    this.createEnrollmentGroupForm.reset({
      name: '',
      startDate: '',
      endDate: '',
    });
    this.selectedStudentsForNewGroup.set({});
    this.createGroupStudentSearchTerm.set('');
    this.creatingEnrollmentGroup.set(true);
  }

  closeCreateEnrollmentGroup() {
    this.creatingEnrollmentGroup.set(false);
    this.selectedStudentsForNewGroup.set({});
    this.createGroupStudentSearchTerm.set('');
  }

  toggleStudentForNewGroup(studentId: string, checked: boolean) {
    this.selectedStudentsForNewGroup.update((current) => ({
      ...current,
      [studentId]: checked,
    }));
  }

  isStudentSelectedForNewGroup(studentId: string) {
    return this.selectedStudentsForNewGroup()[studentId] ?? false;
  }

  toggleStudentForEditedGroup(studentId: string, checked: boolean) {
    this.selectedStudentsForEditedGroup.update((current) => ({
      ...current,
      [studentId]: checked,
    }));
  }

  isStudentSelectedForEditedGroup(studentId: string) {
    return this.selectedStudentsForEditedGroup()[studentId] ?? false;
  }

  toggleStudentForRemovalFromEditedGroup(studentId: string) {
    this.selectedStudentsForRemovalFromEditedGroup.update((current) => ({
      ...current,
      [studentId]: !current[studentId],
    }));
  }

  isStudentSelectedForRemovalFromEditedGroup(studentId: string) {
    return this.selectedStudentsForRemovalFromEditedGroup()[studentId] ?? false;
  }

  openEnrollmentGroupEdit(group: EnrollmentGroupSummary) {
    this.enrollmentGroupForm.reset({
      name: group.name,
      startDate: group.startDate,
      endDate: group.endDate,
    });
    this.selectedStudentsForEditedGroup.set({});
    this.selectedStudentsForRemovalFromEditedGroup.set({});
    this.editingEnrollmentGroupName.set(group.name);
  }

  closeEnrollmentGroupEdit() {
    this.editingEnrollmentGroupName.set(null);
    this.selectedStudentsForEditedGroup.set({});
    this.selectedStudentsForRemovalFromEditedGroup.set({});
  }

  saveEnrollmentGroupEdit() {
    const groupName = this.editingEnrollmentGroupName();

    if (!groupName) {
      return;
    }

    if (this.enrollmentGroupForm.invalid) {
      this.enrollmentGroupForm.markAllAsTouched();
      return;
    }

    this.managerData.updateGroup(groupName, {
      name: this.enrollmentGroupForm.controls.name.value,
      startDate: this.enrollmentGroupForm.controls.startDate.value,
      endDate: this.enrollmentGroupForm.controls.endDate.value,
      additionalStudentIds: Object.entries(this.selectedStudentsForEditedGroup())
        .filter(([, selected]) => selected)
        .map(([studentId]) => studentId),
      removedStudentIds: Object.entries(this.selectedStudentsForRemovalFromEditedGroup())
        .filter(([, selected]) => selected)
        .map(([studentId]) => studentId),
    });
    this.closeEnrollmentGroupEdit();
  }

  saveCreateEnrollmentGroup() {
    if (this.createEnrollmentGroupForm.invalid || this.selectedStudentsForNewGroupCount() === 0) {
      this.createEnrollmentGroupForm.markAllAsTouched();
      return;
    }

    const selectedStudentIds = Object.entries(this.selectedStudentsForNewGroup())
      .filter(([, selected]) => selected)
      .map(([studentId]) => studentId);

    this.managerData.createGroup({
      name: this.createEnrollmentGroupForm.controls.name.value,
      startDate: this.createEnrollmentGroupForm.controls.startDate.value,
      endDate: this.createEnrollmentGroupForm.controls.endDate.value,
      studentIds: selectedStudentIds,
    });
    this.closeCreateEnrollmentGroup();
  }

  deleteEnrollmentGroup(group: EnrollmentGroupSummary) {
    this.managerData.deleteGroup(group.name);
    if (this.editingEnrollmentGroupName() === group.name) {
      this.closeEnrollmentGroupEdit();
    }
    if (this.managingEnrollmentGroupName() === group.name) {
      this.closeManageEnrollmentGroup();
    }
  }

  openManageEnrollmentStudent(student: EnrollmentStudent) {
    this.managingEnrollmentStudentId.set(student.id);
  }

  closeManageEnrollmentStudent() {
    this.managingEnrollmentStudentId.set(null);
  }

  openManageEnrollmentGroup(group: EnrollmentGroupSummary) {
    this.managingEnrollmentGroupName.set(group.name);
  }

  closeManageEnrollmentGroup() {
    this.managingEnrollmentGroupName.set(null);
  }

  unassignGroupOffering(group: EnrollmentGroupSummary, offering: TrainingOffering) {
    this.managerData.removeGroupFromOffering(group.name, offering.id);
  }

  unassignStudentOffering(student: EnrollmentStudent, offering: TrainingOffering) {
    this.managerData.removeStudentFromOffering(student.id, offering.id);
  }

  // ── Assign wizard ─────────────────────────────────────────────────────
  // No preset parameter — "+ New assignment" in the panel header is the only entry point into
  // this wizard now, deliberately: it always starts from a clean slate rather than being
  // pre-filtered by whichever student, group, or course the manager happened to click from.
  openAssignWizard() {
    this.assignWizardSelectedOfferingIds.set({});
    this.assignWizardSelectedStudentIds.set({});
    this.assignWizardOfferingSearchTerm.set('');
    this.assignWizardStudentSearchTerm.set('');
    this.assignWizardStudentGroupFilter.set('');
    this.assignWizardDeadline.set('');
    this.assignWizardSaving.set(false);
    this.assignWizardStep.set(1);
    this.assignWizardOpen.set(true);
  }

  closeAssignWizard() {
    this.assignWizardOpen.set(false);
  }

  private showAssignWizardToast(message: string) {
    if (this.assignWizardToastTimer) {
      clearTimeout(this.assignWizardToastTimer);
    }
    this.assignWizardToast.set(message);
    this.assignWizardToastTimer = setTimeout(() => {
      this.assignWizardToast.set(null);
      this.assignWizardToastTimer = null;
    }, 4000);
  }

  dismissAssignWizardToast() {
    if (this.assignWizardToastTimer) {
      clearTimeout(this.assignWizardToastTimer);
      this.assignWizardToastTimer = null;
    }
    this.assignWizardToast.set(null);
  }

  toggleAssignWizardOffering(offeringId: string, checked: boolean) {
    this.assignWizardSelectedOfferingIds.update((current) => ({ ...current, [offeringId]: checked }));
  }

  isAssignWizardOfferingSelected(offeringId: string) {
    return this.assignWizardSelectedOfferingIds()[offeringId] ?? false;
  }

  toggleAssignWizardStudent(studentId: string, checked: boolean) {
    this.assignWizardSelectedStudentIds.update((current) => ({ ...current, [studentId]: checked }));
  }

  updateAssignWizardStudentGroupFilter(event: Event) {
    const target = event.target as HTMLSelectElement | null;
    this.assignWizardStudentGroupFilter.set(target?.value ?? '');
  }

  isAssignWizardStudentSelected(studentId: string) {
    return this.assignWizardSelectedStudentIds()[studentId] ?? false;
  }

  // Only ever touches the currently filtered/visible students — a student hidden by an active
  // search keeps whatever selection state they already had, whichever way this is clicked.
  toggleAssignWizardSelectAllStudents(checked: boolean) {
    const filtered = this.assignWizardFilteredStudents();
    this.assignWizardSelectedStudentIds.update((current) => {
      const next = { ...current };
      for (const student of filtered) {
        next[student.id] = checked;
      }
      return next;
    });
  }

  // Direct step-button navigation and Back/Next both funnel through this — later steps stay
  // unreachable (button disabled in the template too) until the step before them has at least
  // one selection, so the wizard can't be confirmed with an empty course or student list.
  assignWizardGoToStep(step: AssignWizardStep) {
    if (step >= 2 && this.assignWizardSelectedOfferingCount() === 0) {
      return;
    }

    if (step >= 3 && this.assignWizardSelectedStudentCount() === 0) {
      return;
    }

    this.assignWizardStep.set(step);
  }

  assignWizardNext() {
    this.assignWizardGoToStep((this.assignWizardStep() + 1) as AssignWizardStep);
  }

  assignWizardBack() {
    this.assignWizardStep.set(Math.max(1, this.assignWizardStep() - 1) as AssignWizardStep);
  }

  confirmAssignWizard() {
    const offerings = this.assignWizardSelectedOfferings();
    const students = this.assignWizardSelectedStudents();
    if (!offerings.length || !students.length || this.assignWizardSaving()) {
      return;
    }

    this.assignWizardSaving.set(true);

    // A course's completion deadline is shared by everyone assigned to it (there's no per-
    // student, per-course deadline in this app) — update it first so assignStudentToOffering
    // below picks up the new value for students newly assigned in this same run.
    const deadline = this.assignWizardDeadline().trim();
    if (deadline) {
      for (const offering of offerings) {
        this.managerData.updateOffering({
          id: offering.id,
          title: offering.title,
          type: offering.type,
          category: offering.category,
          description: offering.description,
          completionDeadline: deadline,
          status: offering.status,
          thumbnailDataUrl: offering.thumbnailDataUrl,
        });
      }
    }

    for (const offering of offerings) {
      for (const student of students) {
        this.managerData.assignStudentToOffering(student.id, offering.id);
      }
    }

    this.assignWizardSaving.set(false);
    const message = `Assigned ${offerings.length} ${offerings.length === 1 ? 'course' : 'courses'} to ${students.length} ${students.length === 1 ? 'student' : 'students'}.`;
    this.closeAssignWizard();
    this.showAssignWizardToast(message);
  }
}