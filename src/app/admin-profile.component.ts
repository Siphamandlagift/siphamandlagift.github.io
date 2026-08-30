  // ...existing imports and type definitions...
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, interval } from 'rxjs';
import { EnrollmentStudent, EnrollmentStudentInput, ExternalTrainingRequestRecord, TrainingManagerDataService } from './training-manager-data.service';
import { LmsBackendService, type HrIntegrationConfig, type HrIntegrationConfigUpdate, type HrIntegrationSyncSummary, type LoginRole, type ManagedUserCredentialInput, type ResolveRolesEntry } from './lms-backend.service';
import { LmsBrandThemeId, LmsBrandingService } from './lms-branding.service';
import type { StudentCertificateLicence, StudentCertificateStatus, StudentCourse } from './student-data.service';
import { clearLmsAuthSession, combineDisplayName, createLmsSessionRecord, readLmsSessionRecord } from './session-auth';
import { LogoutConfirmDialogComponent } from './logout-confirm-dialog.component';

type AdminPanel = 'dashboard' | 'users' | 'reports' | 'settings';

type BulkUploadIssue = {
  lineNumber: number;
  message: string;
};

type AdminSettingsSection = 'profile-picture' | 'company-logo' | 'theme' | 'hr-integration';
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
  imports: [CommonModule, ReactiveFormsModule, LogoutConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
                      <div class="admin-upload-feedback" role="status" aria-live="polite">Loading…</div>
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
              </section>
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
      background: linear-gradient(180deg, #181d40 0%, #12152f 100%);
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
  `],
})
export class AdminProfileComponent implements OnInit, OnDestroy {
  selectPanel(panel: AdminPanel) {
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
    { label: 'User Management', value: 'users' },
    { label: 'Reports', value: 'reports' },
    { label: 'LMS Settings', value: 'settings' },
  ];
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

        return this.managerData.idpEntriesForStudent(student.id).map((entry, index) => ({
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
    const groups = new Map<string, BeneficiaryDemographicCounts[]>();

    for (const event of this.completedTrainingEvents()) {
      const ofoOccupation = event.student?.ofoCode || 'Not captured';
      const municipality = event.student?.municipality || 'Not captured';
      const groupKey = [ofoOccupation, municipality].join('::');
      const demographics = event.student ? this.resolveBeneficiaryDemographics(event.student) : this.resolveBeneficiaryDemographics({ race: undefined, gender: undefined, idNumber: '', dateOfBirth: undefined });

      const existing = groups.get(groupKey);
      if (existing) {
        existing.push(demographics);
      } else {
        groups.set(groupKey, [demographics]);
      }
    }

    return Array.from(groups.entries()).map(([groupKey, demographics]) => {
      const [ofoOccupation, municipality] = groupKey.split('::');
      return {
        id: groupKey,
        ofoOccupation,
        municipality,
        ...this.sumBeneficiaryDemographics(demographics),
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

      for (const entry of this.managerData.idpEntriesForStudent(student.id)) {
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
  }

  clearSettingsSection() {
    this.selectedSettingsSection.set(null);
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
}