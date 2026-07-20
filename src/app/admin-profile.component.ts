  // ...existing imports and type definitions...
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { EnrollmentStudent, EnrollmentStudentInput, TrainingManagerDataService } from './training-manager-data.service';
import { LmsBackendService, type ManagedUserCredentialInput, type ResolveRolesEntry } from './lms-backend.service';
import { LmsBrandThemeId, LmsBrandingService } from './lms-branding.service';
import type { StudentCertificateLicence, StudentCourse } from './student-data.service';
import { clearLmsAuthSession, createLmsSessionRecord } from './session-auth';

type AdminPanel = 'dashboard' | 'users' | 'reports' | 'settings';

type BulkUploadIssue = {
  lineNumber: number;
  message: string;
};

type ReportFieldKey = 'name' | 'surname' | 'email' | 'jobTitle' | 'idNumber' | 'department' | 'lineManager' | 'course' | 'completionStatus' | 'dateCompleted' | 'mentorship' | 'dateEnrolled' | 'deadlineDate';

type ReportFieldOption = {
  key: ReportFieldKey;
  label: string;
};

type ReportAccessFilter = 'All' | 'Active' | 'Inactive';
type ReportDownloadFormat = 'CSV' | 'XLSX';
type AdminReportView = 'annual-training' | 'user-reports' | 'idp-report' | 'certificate-licence-report';

type LearnerReportRow = {
  id: string;
  student: EnrollmentStudent;
  offeringId: string | null;
  courseTitle: string;
  completionStatus: EnrollmentStudent['status'];
  dateCompleted: string;
};

type AnnualTrainingReportRow = {
  id: string;
  learnerName: string;
  learnerEmail: string;
  idNumber: string;
  department: string;
  trainingCourse: string;
  providerName: string;
  trainingType: string;
  alignedToIdp: string;
  trainingStartDate: string;
  trainingStartDateValue: string;
  trainingEndDate: string;
  trainingEndDateValue: string;
  courseCost: string;
  approvedBy: string;
  approvedDate: string;
  approvedDateValue: string;
};

type IdpReportRow = {
  id: string;
  name: string;
  surname: string;
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
  department: FormControl<string>;
  lineManagerId: FormControl<string>;
  group: FormControl<string>;
  dateEnrolled: FormControl<string>;
  deadlineDate: FormControl<string>;
  activeStatus: FormControl<'Active' | 'Inactive'>;
  managerAccess: FormControl<'Yes' | 'No'>;
};

type UserFormGroup = FormGroup<UserFormControls>;

const REPORT_FIELD_OPTIONS: ReadonlyArray<ReportFieldOption> = [
  { key: 'name', label: 'Name' },
  { key: 'surname', label: 'Surname' },
  { key: 'email', label: 'Email' },
  { key: 'jobTitle', label: 'Job Title' },
  { key: 'idNumber', label: 'ID Number' },
  { key: 'department', label: 'Department' },
  { key: 'lineManager', label: 'Line Manager' },
  { key: 'course', label: 'Course' },
  { key: 'completionStatus', label: 'Completion Status' },
  { key: 'dateCompleted', label: 'Date Completed' },
  { key: 'mentorship', label: 'Mentorship (Y/N)' },
  { key: 'dateEnrolled', label: 'Start Date' },
  { key: 'deadlineDate', label: 'End Date' },
];

const ADMIN_PROFILE_IMAGE_STORAGE_KEY = 'lms-app.admin-profile-image';

@Component({
  selector: 'admin-profile',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `

    <div
      class="admin-shell"
      [style.--admin-primary]="branding.currentTheme().primary"
      [style.--admin-secondary]="branding.currentTheme().secondary"
      [style.--admin-tint]="branding.currentTheme().tint"
      [style.--admin-surface]="branding.currentTheme().surface">
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
            <div>
              <div class="admin-user-name">{{ adminName() }}</div>
              <div class="admin-user-copy">{{ adminEmail() }}</div>
            </div>
            <svg class="admin-topbar-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m7 10 5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>

          @if (topbarProfileMenuOpen()) {
            <div class="admin-topbar-menu" role="dialog" aria-label="Admin profile menu">
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
        <aside class="admin-sidebar" [class.admin-sidebar-collapsed]="adminSidebarCollapsed()" aria-label="Admin navigation">
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
                    Training Manager
                    <select formControlName="managerAccess" style="width: 100%; background: #fffbe6; border: 2px solid #f9c74f; color: #222; padding: 8px; margin-top: 4px; display: block;">
                      @for (option of managerAccessOptions; track option.value) {
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
                    Training Manager
                    <select formControlName="managerAccess" style="width: 100%; background: #fffbe6; border: 2px solid #f9c74f; color: #222; padding: 8px; margin-top: 4px; display: block;">
                      @for (option of managerAccessOptions; track option.value) {
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
                <div class="admin-metric-grid">
                  <article class="admin-metric-card">
                    <div class="admin-metric-label">Total Users</div>
                    <div class="admin-metric-value">{{ totalUsersCount() }}</div>
                    <div class="admin-metric-copy">Students currently listed on the LMS.</div>
                  </article>

                  <article class="admin-metric-card">
                    <div class="admin-metric-label">Active Users</div>
                    <div class="admin-metric-value">{{ activeUsersCount() }}</div>
                    <div class="admin-metric-copy">Users with active LMS access status.</div>
                  </article>

                  <article class="admin-metric-card">
                    <div class="admin-metric-label">Non Active Users</div>
                    <div class="admin-metric-value">{{ inactiveUsersCount() }}</div>
                    <div class="admin-metric-copy">Users currently marked as inactive.</div>
                  </article>

                  <article class="admin-metric-card admin-metric-card-accent">
                    <div class="admin-metric-label">Assigned Learners</div>
                    <div class="admin-metric-value">{{ managerData.assignedStudentsCount() }}</div>
                    <div class="admin-metric-copy">Learners assigned to at least one offering.</div>
                  </article>
                </div>
              <!-- removed extra closing div to fix template structure -->
              <div class="admin-snapshot-grid">
                <article class="admin-section-card">
                  <div class="admin-section-card-header">
                    <h2>User access snapshot</h2>
                    <span>{{ activeRateLabel() }}</span>
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
                    <h2>Learning status summary</h2>
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
                    <label class="admin-upload-btn admin-upload-btn-prominent">
                      <span class="admin-upload-btn-icon" aria-hidden="true">+</span>
                      <span class="admin-upload-btn-label">Upload users file</span>
                      <input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" (change)="handleBulkUserUpload($event)" />
                    </label>
                    <button type="button" class="admin-primary-btn" (click)="openSingleUserForm()">Add user</button>
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
                  <article class="admin-section-card admin-report-menu-card">
                    <div class="admin-section-card-header">
                      <h2>Report List</h2>
                      <span>4 available</span>
                    </div>

                    <div class="admin-report-menu" role="list" aria-label="Admin report list">
                      <button type="button" class="admin-report-menu-item" (click)="selectReportView('annual-training')">
                        <strong>Annual Training Report</strong>
                        <span>Yearly LMS training overview and department summary.</span>
                      </button>
                      <button type="button" class="admin-report-menu-item" (click)="selectReportView('user-reports')">
                        <strong>User Reports</strong>
                        <span>Current learner report with filters, preview, and export.</span>
                      </button>
                      <button type="button" class="admin-report-menu-item" (click)="selectReportView('idp-report')">
                        <strong>IDP Report</strong>
                        <span>Employee IDP entries with manager and development details.</span>
                      </button>
                      <button type="button" class="admin-report-menu-item" (click)="selectReportView('certificate-licence-report')">
                        <strong>Certificates and Licences Report</strong>
                        <span>Track employee certificate and licence expiry, renewal, and status.</span>
                      </button>
                    </div>
                  </article>
                }

                @if (selectedReportView()) {
                  <article class="admin-section-card admin-report-open-card">
                    <div class="admin-section-card-header admin-report-open-header">
                      <div class="admin-report-open-heading">
                        @if (selectedReportView() === 'annual-training') {
                          <h2>Annual Training Report</h2>
                          <span>{{ filteredAnnualTrainingReportRows().length }} approved requests</span>
                        }

                        @if (selectedReportView() === 'user-reports') {
                          <h2>User Reports</h2>
                          <span>{{ filteredReportUsers().length }} of {{ totalUsersCount() }} users</span>
                        }

                        @if (selectedReportView() === 'idp-report') {
                          <h2>IDP Report</h2>
                          <span>{{ idpReportRows().length }} IDP entries</span>
                        }

                        @if (selectedReportView() === 'certificate-licence-report') {
                          <h2>Certificates and Licences Report</h2>
                          <span>{{ certificateLicenceReportRows().length }} records</span>
                        }
                      </div>

                      <button type="button" class="admin-inline-btn admin-report-back-btn" (click)="clearReportView()">Back to report list</button>
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
                              <input type="text" [value]="annualReportSearchTerm()" (input)="updateAnnualReportSearch($event)" placeholder="Name, course, provider" />
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
                              <span>Training Start Date</span>
                              <input type="date" [value]="selectedAnnualReportTrainingStartDate()" (input)="updateAnnualReportTrainingStartDate($event)" />
                            </label>

                            <label class="admin-report-filter-field">
                              <span>Training End Date</span>
                              <input type="date" [value]="selectedAnnualReportTrainingEndDate()" (input)="updateAnnualReportTrainingEndDate($event)" />
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

                        @if (filteredAnnualTrainingReportRows().length) {
                          <div class="admin-report-table-wrap">
                            <table class="admin-report-table">
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>Email</th>
                                  <th>ID Number</th>
                                  <th>Department</th>
                                  <th>Training Course</th>
                                  <th>Provider Name</th>
                                  <th>Type of Training</th>
                                  <th>IDP Aligned</th>
                                  <th>Training Start Date</th>
                                  <th>Training End Date</th>
                                  <th>Course Cost</th>
                                  <th>Approved By</th>
                                  <th>Approved Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                @for (row of filteredAnnualTrainingReportRows(); track row.id) {
                                  <tr>
                                    <td>{{ row.learnerName }}</td>
                                    <td>{{ row.learnerEmail }}</td>
                                    <td>{{ row.idNumber }}</td>
                                    <td>{{ row.department }}</td>
                                    <td>{{ row.trainingCourse }}</td>
                                    <td>{{ row.providerName }}</td>
                                    <td>{{ row.trainingType }}</td>
                                    <td>{{ row.alignedToIdp }}</td>
                                    <td>{{ row.trainingStartDate }}</td>
                                    <td>{{ row.trainingEndDate }}</td>
                                    <td>{{ row.courseCost }}</td>
                                    <td>{{ row.approvedBy }}</td>
                                    <td>{{ row.approvedDate }}</td>
                                  </tr>
                                }
                              </tbody>
                            </table>
                          </div>
                        } @else {
                          <div class="admin-empty-state">No approved external training requests match the current filters.</div>
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
                            <span class="admin-chip">9 fields</span>
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

                    @if (selectedReportView() === 'user-reports') {
                      <div class="admin-report-builder-grid admin-report-builder-grid-stack">
                        <article class="admin-section-card">
                        <div class="admin-section-card-header">
                          <h2>Report filters</h2>
                          <span>{{ filteredReportUsers().length }} of {{ totalUsersCount() }} users</span>
                        </div>

                        <div class="admin-report-filter-grid">
                          <label class="admin-report-filter-field">
                            <span>Department</span>
                            <select [value]="selectedReportDepartment()" (change)="updateReportDepartment($event)">
                              <option value="">All departments</option>
                              @for (department of reportDepartments(); track department) {
                                <option [value]="department">{{ department }}</option>
                              }
                            </select>
                          </label>

                          <label class="admin-report-filter-field">
                            <span>Group</span>
                            <select [value]="selectedReportGroup()" (change)="updateReportGroup($event)">
                              <option value="">All groups</option>
                              @for (group of reportGroups(); track group) {
                                <option [value]="group">{{ group }}</option>
                              }
                            </select>
                          </label>

                          <label class="admin-report-filter-field">
                            <span>Access Status</span>
                            <select [value]="selectedReportAccessStatus()" (change)="updateReportAccessStatus($event)">
                              <option value="All">All access statuses</option>
                              <option value="Active">Active</option>
                              <option value="Inactive">Inactive</option>
                            </select>
                          </label>

                          <label class="admin-report-filter-field">
                            <span>Start Date From</span>
                            <input type="date" [value]="selectedReportStartDate()" (input)="updateReportStartDate($event)" />
                          </label>

                          <label class="admin-report-filter-field">
                            <span>End Date To</span>
                            <input type="date" [value]="selectedReportEndDate()" (input)="updateReportEndDate($event)" />
                          </label>
                        </div>

                        <div class="admin-report-actions">
                          <button type="button" class="admin-secondary-btn" (click)="clearReportFilters()">Clear filters</button>
                        </div>
                      </article>

                        <article class="admin-section-card">
                        <div class="admin-section-card-header">
                          <h2>Report preview</h2>
                          <span>{{ filteredReportRows().length }} rows</span>
                        </div>

                        <div class="admin-report-preview-meta">
                          <span class="admin-chip">{{ reportColumns().length }} fields</span>
                          <span class="admin-chip">{{ filteredReportRows().length }} rows included</span>
                        </div>

                        <div class="admin-report-actions">
                          <label class="admin-report-filter-field admin-report-download-field">
                            <span>Download As</span>
                            <select [value]="selectedReportDownloadFormat()" (change)="updateReportDownloadFormat($event)">
                              <option value="CSV">CSV</option>
                              <option value="XLSX">XLSX</option>
                            </select>
                          </label>
                          <button type="button" class="admin-primary-btn" [disabled]="!canDownloadReport()" (click)="downloadReport()">Download report</button>
                        </div>

                        @if (filteredReportRows().length) {
                          <div class="admin-report-table-wrap">
                            <table class="admin-report-table">
                              <thead>
                                <tr>
                                  @for (column of reportColumns(); track column.key) {
                                    <th>{{ column.label }}</th>
                                  }
                                </tr>
                              </thead>
                              <tbody>
                                @for (row of filteredReportRows(); track row.id) {
                                  <tr>
                                    @for (column of reportColumns(); track column.key) {
                                      <td>{{ getReportCellValue(row, column.key) }}</td>
                                    }
                                  </tr>
                                }
                              </tbody>
                            </table>
                          </div>
                        } @else {
                          <div class="admin-empty-state">No users match the current report filters.</div>
                        }
                        </article>
                      </div>
                    }
                  </article>
                }
              </div>
            </section>
          }

          @if (selectedPanel() === 'settings') {
            <section class="admin-panel">
              <div class="admin-settings-list" role="list" aria-label="System options">
                <article class="admin-section-card admin-settings-item" role="listitem">
                  <div class="admin-settings-item-main">
                    <div class="admin-section-card-header">
                      <h2>Admin profile picture</h2>
                      <span>{{ adminProfileImageDataUrl() ? 'Uploaded' : 'Using initials avatar' }}</span>
                    </div>
                    <p class="admin-settings-item-copy">Upload a profile picture for the admin topbar avatar.</p>
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
                        <span>Upload picture</span>
                        <input type="file" accept="image/*" (change)="onAdminProfileImageSelected($event)" />
                      </label>
                      <button type="button" class="admin-secondary-btn" [disabled]="!adminProfileImageDataUrl()" (click)="clearAdminProfileImage()">Remove picture</button>
                    </div>
                  </div>
                </article>

                <article class="admin-section-card admin-settings-item" role="listitem">
                  <div class="admin-settings-item-main">
                    <div class="admin-section-card-header">
                      <h2>Company logo</h2>
                      <span>{{ branding.companyLogoDataUrl() ? 'Uploaded' : 'Default brand mark' }}</span>
                    </div>
                    <p class="admin-settings-item-copy">Upload a company logo used throughout the workspace.</p>
                  </div>

                  <div class="admin-settings-item-controls admin-logo-panel">
                    <div class="admin-logo-preview" [class.admin-logo-preview-has-image]="!!branding.companyLogoDataUrl()">
                      @if (branding.companyLogoDataUrl()) {
                        <img [src]="branding.companyLogoDataUrl()!" alt="Selected company logo preview" />
                      } @else {
                        <span>AD</span>
                      }
                    </div>

                    <div class="admin-logo-actions">
                      <label class="admin-upload-btn">
                        <span>Upload logo</span>
                        <input type="file" accept="image/*" (change)="onLogoSelected($event)" />
                      </label>
                      <button type="button" class="admin-secondary-btn" [disabled]="!branding.companyLogoDataUrl()" (click)="branding.clearCompanyLogo()">Remove logo</button>
                    </div>
                  </div>
                </article>

                <article class="admin-section-card admin-settings-item" role="listitem">
                  <div class="admin-settings-item-main">
                    <div class="admin-section-card-header">
                      <h2>Theme colour</h2>
                      <span>{{ branding.currentTheme().label }}</span>
                    </div>
                    <p class="admin-settings-item-copy">Choose one colour theme for the full system experience.</p>
                  </div>

                  <div class="admin-settings-item-controls admin-settings-item-controls-stack">
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
                      <div class="admin-theme-selection-copy">{{ branding.currentTheme().copy }}</div>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          }
        <!-- removed extra closing main tag to fix template structure -->
  `,
  styles: [`
    :host {
      --ui-scale: 0.9;
      display: block;
      min-height: 100vh;
      background: #eef3fb;
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
        radial-gradient(circle at top left, rgba(56, 189, 248, 0.12), transparent 20%),
        linear-gradient(180deg, #f5f9ff 0%, var(--admin-surface) 100%);
    }

    .admin-topbar,
    .admin-sidebar,
    .admin-panel,
    .admin-profile-card,
    .admin-metric-card,
    .admin-section-card {
      box-sizing: border-box;
      border: 1px solid rgba(15, 23, 42, 0.08);
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.06);
      backdrop-filter: blur(10px);
    }

    .admin-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: calc(1rem * var(--ui-scale));
      min-height: calc(72px * var(--ui-scale));
      margin-bottom: calc(1rem * var(--ui-scale));
      padding: calc(0.9rem * var(--ui-scale)) calc(1.2rem * var(--ui-scale));
      border-radius: calc(22px * var(--ui-scale));
      box-sizing: border-box;
    }

    .admin-topbar-dropdown-wrap {
      position: relative;
      z-index: 35;
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
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
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
      z-index: 40;
      min-width: calc(14rem * var(--ui-scale));
      display: grid;
      gap: calc(0.2rem * var(--ui-scale));
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: calc(18px * var(--ui-scale));
      background: rgba(255, 255, 255, 0.97);
      box-shadow: 0 22px 48px rgba(15, 23, 42, 0.18);
      padding: calc(0.4rem * var(--ui-scale));
      backdrop-filter: blur(8px);
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
      z-index: 19;
      border: none;
      background: transparent;
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
      width: calc(2.8rem * var(--ui-scale));
      height: calc(2.8rem * var(--ui-scale));
      border-radius: calc(16px * var(--ui-scale));
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
      width: 3.5rem;
      height: 3.5rem;
      border-radius: 1.2rem;
      background: linear-gradient(135deg, var(--admin-primary), var(--admin-secondary));
    }

    .admin-logo-preview {
      width: 6rem;
      height: 6rem;
      border-radius: 1.4rem;
      font-size: 1.45rem;
    }

    .admin-brand-name,
    .admin-user-name,
    .admin-metric-value,
    h1,
    h2,
    p {
      margin: 0;
    }

    .admin-brand-name,
    .admin-user-name {
      font-size: calc(1.02rem * var(--ui-scale));
      font-weight: 800;
    }

    .admin-brand-copy,
    .admin-user-copy,
    .section-copy,
    .admin-metric-copy,
    .admin-empty-state {
      color: #475569;
      line-height: 1.5;
    }

    .admin-layout {
      display: grid;
      grid-template-columns: calc(260px * var(--ui-scale)) minmax(0, 1fr);
      gap: calc(1rem * var(--ui-scale));
      align-items: start;
    }

    .admin-layout.admin-layout-sidebar-collapsed {
      grid-template-columns: calc(92px * var(--ui-scale)) minmax(0, 1fr);
    }

    .admin-sidebar {
      position: sticky;
      top: calc(1rem * var(--ui-scale));
      display: flex;
      flex-direction: column;
      gap: calc(0.65rem * var(--ui-scale));
      padding: calc(1rem * var(--ui-scale));
      border-radius: calc(24px * var(--ui-scale));
    }

    .admin-sidebar-header {
      display: flex;
      justify-content: center;
    }

    .admin-sidebar-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: calc(2.5rem * var(--ui-scale));
      height: calc(2.5rem * var(--ui-scale));
      border: 1px solid var(--admin-tint);
      border-radius: calc(14px * var(--ui-scale));
      background: var(--admin-surface);
      color: var(--admin-primary);
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease, color 0.15s ease;
    }

    .admin-sidebar-toggle:hover,
    .admin-sidebar-toggle:focus-visible {
      background: var(--admin-tint);
      border-color: var(--admin-primary);
      outline: none;
      transform: translateY(-1px);
    }

    .admin-sidebar-toggle svg {
      width: calc(1.1rem * var(--ui-scale));
      height: calc(1.1rem * var(--ui-scale));
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
      gap: calc(0.75rem * var(--ui-scale));
      border-radius: calc(14px * var(--ui-scale));
      padding: calc(0.85rem * var(--ui-scale)) calc(1rem * var(--ui-scale));
      background: transparent;
      color: #334155;
      text-align: left;
      font-weight: 700;
      transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease;
    }

    .admin-nav-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 calc(2.35rem * var(--ui-scale));
      width: calc(2.35rem * var(--ui-scale));
      height: calc(2.35rem * var(--ui-scale));
      border-radius: calc(14px * var(--ui-scale));
      background: rgba(148, 163, 184, 0.12);
      color: currentColor;
      flex-shrink: 0;
      transition: background 0.18s ease, color 0.18s ease;
    }

    .admin-nav-icon svg {
      width: calc(1.15rem * var(--ui-scale));
      height: calc(1.15rem * var(--ui-scale));
    }

    .admin-nav-label {
      min-width: 0;
    }

    .admin-sidebar button:not(.admin-sidebar-toggle):hover,
    .admin-sidebar button:not(.admin-sidebar-toggle):focus-visible {
      background: #f8fafc;
      color: #334155;
      outline: none;
      transform: translateX(2px);
    }

    .admin-sidebar button:not(.admin-sidebar-toggle).active {
      background: linear-gradient(135deg, var(--admin-primary), var(--admin-secondary));
      color: #fff;
      box-shadow: 0 12px 24px rgba(79, 70, 229, 0.18);
    }

    .admin-sidebar button:not(.admin-sidebar-toggle):hover .admin-nav-icon,
    .admin-sidebar button:not(.admin-sidebar-toggle):focus-visible .admin-nav-icon {
      background: rgba(148, 163, 184, 0.18);
    }

    .admin-sidebar button:not(.admin-sidebar-toggle).active .admin-nav-icon {
      background: rgba(255, 255, 255, 0.18);
    }

    .admin-sidebar button:not(.admin-sidebar-toggle).logout {
      margin-top: auto;
      background: #fee2e2;
      color: #b91c1c;
    }

    .admin-sidebar-collapsed {
      gap: calc(0.55rem * var(--ui-scale));
      padding-inline: calc(0.7rem * var(--ui-scale));
    }

    .admin-sidebar-collapsed .admin-sidebar-header {
      justify-content: center;
    }

    .admin-sidebar-collapsed button {
      justify-content: center;
      padding-inline: calc(0.7rem * var(--ui-scale));
    }

    .admin-sidebar-collapsed .admin-nav-label {
      display: none;
    }

    .admin-sidebar-collapsed .admin-nav-icon {
      flex-basis: calc(2.6rem * var(--ui-scale));
      width: calc(2.6rem * var(--ui-scale));
    }

    .admin-sidebar button:not(.admin-sidebar-toggle).logout:hover,
    .admin-sidebar button:not(.admin-sidebar-toggle).logout:focus-visible {
      background: #fecaca;
      color: #991b1b;
    }

    .admin-main-panel {
      min-width: 0;
    }

    .admin-panel {
      display: grid;
      gap: 1.2rem;
      padding: calc(1.2rem * var(--ui-scale));
      border-radius: calc(26px * var(--ui-scale));
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
      width: 100%;
      max-width: none;
      overflow: hidden;
    }

    .admin-report-menu {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.75rem;
      min-width: 0;
      padding: 0.9rem;
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 22px;
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
      gap: 0.55rem;
      min-height: 3rem;
      padding: 0.82rem 1rem;
      border: 1px solid transparent;
      border-radius: 16px;
      box-sizing: border-box;
      font-weight: 800;
      letter-spacing: 0.01em;
      line-height: 1;
      text-decoration: none;
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease, color 0.18s ease, opacity 0.18s ease;
    }

    .admin-primary-btn,
    .admin-upload-btn {
      background: linear-gradient(135deg, var(--admin-primary), var(--admin-secondary));
      color: #fff;
      box-shadow: 0 14px 28px rgba(23, 52, 70, 0.18);
    }

    .admin-secondary-btn,
    .admin-inline-btn {
      background: rgba(255, 255, 255, 0.96);
      color: #173446;
      border-color: rgba(148, 163, 184, 0.26);
      box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
    }

    .admin-inline-btn {
      min-height: 2.35rem;
      padding: 0.58rem 0.9rem;
      border-radius: 999px;
      font-size: 0.82rem;
    }

    .admin-inline-btn-danger {
      background: rgba(254, 242, 242, 0.98);
      color: #b91c1c;
      border-color: rgba(248, 113, 113, 0.28);
      box-shadow: 0 10px 20px rgba(239, 68, 68, 0.1);
    }

    .admin-primary-btn:hover,
    .admin-primary-btn:focus-visible,
    .admin-upload-btn:hover,
    .admin-upload-btn:focus-within {
      transform: translateY(-1px);
      box-shadow: 0 18px 32px rgba(23, 52, 70, 0.22);
      outline: none;
    }

    .admin-secondary-btn:hover,
    .admin-secondary-btn:focus-visible,
    .admin-inline-btn:hover,
    .admin-inline-btn:focus-visible {
      transform: translateY(-1px);
      border-color: rgba(56, 189, 248, 0.28);
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
      outline: none;
    }

    .admin-inline-btn-danger:hover,
    .admin-inline-btn-danger:focus-visible {
      border-color: rgba(239, 68, 68, 0.34);
      box-shadow: 0 14px 28px rgba(239, 68, 68, 0.14);
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
      gap: 0.32rem;
      min-height: 8.75rem;
      width: 100%;
      max-width: 100%;
      padding: 0.95rem 1rem;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.98);
      box-sizing: border-box;
      text-align: left;
      color: #173446;
      font: inherit;
      cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
    }

    .admin-report-menu-item strong {
      font-size: 0.98rem;
      font-weight: 800;
    }

    .admin-report-menu-item span {
      color: #64748b;
      font-size: 0.84rem;
      line-height: 1.45;
    }

    .admin-report-menu-item:hover,
    .admin-report-menu-item:focus-visible {
      border-color: rgba(56, 189, 248, 0.3);
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
      transform: translateY(-1px);
      outline: none;
    }

    .admin-report-menu-item-active {
      border-color: rgba(56, 189, 248, 0.36);
      background: linear-gradient(180deg, rgba(240, 249, 255, 0.98) 0%, rgba(255, 255, 255, 0.92) 100%);
      box-shadow: 0 16px 28px rgba(56, 189, 248, 0.12);
    }

    .admin-settings-list {
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
      gap: 1rem;
      padding: 1.15rem;
      border-radius: 22px;
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
      background: rgba(15, 23, 42, 0.36);
      backdrop-filter: blur(6px);
      overflow-y: auto;
    }

    .admin-modal {
      width: min(860px, 100%);
      max-height: min(calc(100vh - 3rem), 860px);
      display: grid;
      gap: 1rem;
      padding: 1.25rem;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 28px 60px rgba(15, 23, 42, 0.24);
      overflow-y: auto;
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
      padding: 0.9rem;
      border-radius: 18px;
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
      padding: 0.9rem 1rem;
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 14px;
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
      box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.14);
    }

    .admin-profile-meta-item strong,
    .admin-progress-meta strong,
    .admin-status-row strong {
      color: #173446;
      font-size: 0.96rem;
    }

    .admin-metric-card {
      display: grid;
      gap: 0.45rem;
      padding: 1.05rem;
      border-radius: 20px;
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

    .admin-metric-grid-four-up {
      grid-template-columns: repeat(4, minmax(0, 1fr));
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

    .admin-settings-item {
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      align-items: center;
      gap: 1.25rem;
    }

    .admin-settings-item-main {
      display: grid;
      gap: 0.45rem;
      min-width: 0;
    }

    .admin-settings-item-copy,
    .admin-theme-selection-copy {
      color: #475569;
      font-size: 0.92rem;
      line-height: 1.5;
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
      padding: 0.9rem 1rem;
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 14px;
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
      box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.14);
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
      padding: 0.95rem 1rem;
      border-radius: 18px;
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
      padding: 0.78rem 0.9rem;
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 14px;
      background: #fff;
      color: #173446;
      box-sizing: border-box;
      outline: none;
      font: inherit;
    }

    .admin-report-filter-field input:focus,
    .admin-report-filter-field select:focus {
      border-color: var(--admin-secondary);
      box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.14);
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
      padding: 0.85rem 0.95rem;
      border-radius: 16px;
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
      margin-bottom: 1rem;
      padding: 1rem;
      border-radius: 18px;
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
      padding: 0.8rem 1rem;
      border-radius: 14px;
      background: rgba(16, 185, 129, 0.12);
      color: #047857;
      font-size: 0.9rem;
      font-weight: 700;
    }

    .admin-upload-feedback-error {
      background: rgba(239, 68, 68, 0.12);
      color: #b91c1c;
    }

    .admin-upload-btn-prominent {
      gap: 0.75rem;
      min-height: 3.3rem;
      padding: 0.62rem 1rem;
      border-radius: 18px;
      box-shadow: 0 16px 28px rgba(23, 52, 70, 0.16);
    }

    .admin-upload-btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.7rem;
      height: 1.7rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.18);
      font-size: 1rem;
      font-weight: 900;
      line-height: 1;
      flex: 0 0 auto;
    }

    .admin-upload-btn-label {
      font-size: 0.9rem;
      font-weight: 800;
      line-height: 1.1;
    }

    .admin-upload-issues {
      margin-bottom: 1rem;
      padding: 1rem;
      border-radius: 16px;
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

    .admin-report-table-wrap {
      overflow-x: auto;
      border-radius: 18px;
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
      padding: 0.72rem 0.88rem;
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

    .admin-report-builder-grid-stack .admin-report-actions .admin-primary-btn,
    .admin-report-builder-grid-stack .admin-report-actions .admin-secondary-btn {
      font-size: 0.82rem;
      min-height: 2.75rem;
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
      padding: 0.95rem 1rem;
      border-radius: 18px;
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
      align-items: flex-start;
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .admin-logo-actions {
      align-items: stretch;
      flex-wrap: wrap;
    }

    .admin-upload-btn {
      position: relative;
      overflow: hidden;
      cursor: pointer;
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
      box-shadow: 0 6px 12px rgba(15, 23, 42, 0.08);
    }

    .admin-welcome-banner {
      position: fixed;
      top: calc(1rem * var(--ui-scale));
      left: 50%;
      z-index: 60;
      width: min(calc(360px * var(--ui-scale)), calc(100vw - 2rem));
      padding: calc(0.95rem * var(--ui-scale)) calc(1.2rem * var(--ui-scale));
      border: 1px solid rgba(56, 189, 248, 0.18);
      border-radius: calc(20px * var(--ui-scale));
      background: linear-gradient(135deg, var(--admin-primary), var(--admin-secondary));
      box-shadow: 0 20px 40px rgba(79, 70, 229, 0.24);
      color: #fff;
      transform: translate(-50%, -120%);
      opacity: 0;
      animation: admin-welcome-banner-drop 0.6s cubic-bezier(0.2, 0.9, 0.2, 1) forwards;
      backdrop-filter: blur(12px);
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
      .admin-snapshot-grid,
      .admin-report-builder-grid,
      .admin-metric-grid-four-up {
        grid-template-columns: 1fr 1fr;
      }

      .admin-settings-item {
        grid-template-columns: 1fr;
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

      .admin-report-menu-card {
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
      .admin-snapshot-grid,
      .admin-report-builder-grid,
      .admin-metric-grid-four-up,
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
    { value: 'No', label: 'No' },
    { value: 'Yes', label: 'Yes' },
  ];
  readonly managerData = inject(TrainingManagerDataService);
  private readonly backend = inject(LmsBackendService);
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
  readonly userSearchTerm = signal('');
  readonly editingUserId = signal<string | null>(null);
  readonly selectedReportDepartment = signal('');
  readonly selectedReportGroup = signal('');
  readonly selectedReportAccessStatus = signal<ReportAccessFilter>('All');
  readonly selectedReportStartDate = signal('');
  readonly selectedReportEndDate = signal('');
  readonly selectedReportDownloadFormat = signal<ReportDownloadFormat>('CSV');
  readonly selectedAnnualReportDownloadFormat = signal<ReportDownloadFormat>('CSV');
  readonly selectedIdpReportDownloadFormat = signal<ReportDownloadFormat>('CSV');
  readonly selectedCertificateReportDownloadFormat = signal<ReportDownloadFormat>('CSV');
  readonly selectedBulkUploadTemplateFormat = signal<ReportDownloadFormat>('CSV');
  readonly selectedReportView = signal<AdminReportView | null>(null);
  readonly annualReportSearchTerm = signal('');
  readonly selectedAnnualReportDepartment = signal('');
  readonly selectedAnnualReportTrainingStartDate = signal('');
  readonly selectedAnnualReportTrainingEndDate = signal('');
  readonly showSingleUserModal = signal(false);
  readonly singleUserMessage = signal('');
  readonly singleUserTone = signal<'success' | 'error'>('success');
  readonly bulkUploadMessage = signal('');
  readonly bulkUploadTone = signal<'success' | 'error'>('success');
  readonly bulkUploadIssues = signal<BulkUploadIssue[]>([]);
  readonly adminProfileImageDataUrl = signal<string | null>(null);
  readonly adminName = signal('Ava Mokoena');
  readonly adminEmail = signal('admin@skillsconnect.app');
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
  readonly switchingRole = signal(false);
  private readonly reportSnapshotPrefetchEffect = effect(() => {
    for (const student of this.users()) {
      if (this.requestedReportSnapshotIds.has(student.id)) {
        continue;
      }

      this.requestedReportSnapshotIds.add(student.id);
      this.backend.getStudentSnapshot(student.id).subscribe({
        next: (snapshot) => {
          this.reportStudentCoursesById.update((current) => ({
            ...current,
            [student.id]: snapshot.courses,
          }));
          this.reportStudentCertificatesById.update((current) => ({
            ...current,
            [student.id]: snapshot.certificatesAndLicences ?? [],
          }));
        },
        error: () => {
          this.reportStudentCoursesById.update((current) => ({
            ...current,
            [student.id]: [],
          }));
          this.reportStudentCertificatesById.update((current) => ({
            ...current,
            [student.id]: [],
          }));
        },
      });
    }
  });

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
  readonly reportColumns = computed(() => REPORT_FIELD_OPTIONS);
  readonly reportDepartments = computed(() =>
    Array.from(new Set(this.users().map((student) => student.department).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
  );
  readonly reportGroups = computed(() =>
    Array.from(new Set(this.users().map((student) => student.group).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
  );
  readonly reportOfferingTitlesById = computed(() =>
    new Map(this.managerData.offerings().map((offering) => [offering.id, offering.title])),
  );
  readonly reportManagerNamesById = computed(() =>
    new Map(this.users().map((student) => [student.id, `${student.name} ${student.surname}`.trim()])),
  );
  readonly mentorshipStudentIds = computed(() => {
    const studentIds = new Set<string>();

    for (const assignment of this.managerData.mentorshipAssignments()) {
      studentIds.add(assignment.menteeId);
    }

    for (const submission of this.managerData.mentorshipSubmissions()) {
      studentIds.add(submission.studentId);
    }

    return studentIds;
  });
  readonly filteredReportUsers = computed(() => {
    const department = this.selectedReportDepartment();
    const group = this.selectedReportGroup();
    const accessStatus = this.selectedReportAccessStatus();
    const startDate = this.selectedReportStartDate();
    const endDate = this.selectedReportEndDate();

    return this.users().filter((student) => {
      if (department && student.department !== department) {
        return false;
      }

      if (group && student.group !== group) {
        return false;
      }

      if (accessStatus !== 'All' && student.activeStatus !== accessStatus) {
        return false;
      }

      if (startDate && student.dateEnrolled < startDate) {
        return false;
      }

      if (endDate && student.deadlineDate > endDate) {
        return false;
      }

      return true;
    });
  });
  readonly filteredReportRows = computed(() => {
    const offeringTitlesById = this.reportOfferingTitlesById();
    const rows: LearnerReportRow[] = [];

    for (const student of this.filteredReportUsers()) {
      const assignedOfferings = student.assignedOfferingIds
        .map((offeringId) => ({ offeringId, title: offeringTitlesById.get(offeringId) ?? 'Unknown course' }));

      if (!assignedOfferings.length) {
        rows.push({
          id: `${student.id}::not-assigned`,
          student,
          offeringId: null,
          courseTitle: 'Not assigned',
          completionStatus: student.status,
          dateCompleted: 'Not completed',
        });
        continue;
      }

      for (const offering of assignedOfferings) {
        rows.push({
          id: `${student.id}::${offering.offeringId}`,
          student,
          offeringId: offering.offeringId,
          courseTitle: offering.title,
          completionStatus: this.resolveReportCompletionStatus(student, offering.offeringId, offering.title),
          dateCompleted: this.resolveReportCompletionDate(student, offering.offeringId, offering.title),
        });
      }
    }

    return rows;
  });
  readonly annualTrainingReportRows = computed<AnnualTrainingReportRow[]>(() => {
    const studentsByEmail = new Map(this.users().map((student) => [student.email.toLowerCase(), student]));

    return this.managerData.externalTrainingRequests()
      .filter((request) => request.status === 'Approved')
      .map((request) => {
        const matchedStudent = studentsByEmail.get(request.studentEmail.toLowerCase());
        const approvedDateValue = this.normalizeReportDateValue(request.reviewedAt ?? request.submittedAt);
        const approvedDate = this.formatReportDateLabel(request.reviewedAt ?? request.submittedAt);
        const trainingStartDateValue = this.normalizeReportDateValue(request.trainingStartDate);
        const trainingEndDateValue = this.normalizeReportDateValue(request.trainingEndDate);

        return {
          id: request.id,
          learnerName: request.studentName,
          learnerEmail: request.studentEmail,
          idNumber: matchedStudent?.idNumber || 'Not provided',
          department: matchedStudent?.department || 'Unassigned',
          trainingCourse: request.courseName,
          providerName: request.provider,
          trainingType: request.trainingType,
          alignedToIdp: request.alignedToIdp,
          trainingStartDate: this.formatReportDateLabel(request.trainingStartDate),
          trainingStartDateValue,
          trainingEndDate: this.formatReportDateLabel(request.trainingEndDate),
          trainingEndDateValue,
          courseCost: request.courseCost,
          approvedBy: request.reviewerName || request.approvingManagerName,
          approvedDate,
          approvedDateValue,
        };
      })
      .sort((left, right) => right.approvedDateValue.localeCompare(left.approvedDateValue));
  });
  readonly idpReportRows = computed<IdpReportRow[]>(() => {
    const managerNamesById = this.reportManagerNamesById();

    return this.users()
      .flatMap((student) => {
        const manager = student.lineManager?.trim()
          || (student.lineManagerId ? managerNamesById.get(student.lineManagerId) ?? '' : '')
          || 'Not provided';

        return this.managerData.idpEntriesForStudent(student.id).map((entry, index) => ({
          id: `${student.id}::${index}`,
          name: student.name,
          surname: student.surname,
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
          status: record.status,
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
    const trainingStartDate = this.selectedAnnualReportTrainingStartDate();
    const trainingEndDate = this.selectedAnnualReportTrainingEndDate();

    return this.annualTrainingReportRows().filter((row) => {
      if (searchQuery) {
        const matchesSearch = [
          row.learnerName,
          row.learnerEmail,
          row.idNumber,
          row.department,
          row.trainingCourse,
          row.providerName,
          row.trainingType,
          row.approvedBy,
        ].some((value) => value.toLowerCase().includes(searchQuery));

        if (!matchesSearch) {
          return false;
        }
      }

      if (department && row.department !== department) {
        return false;
      }

      if (trainingStartDate && (!row.trainingStartDateValue || row.trainingStartDateValue < trainingStartDate)) {
        return false;
      }

      if (trainingEndDate && (!row.trainingEndDateValue || row.trainingEndDateValue > trainingEndDate)) {
        return false;
      }

      return true;
    });
  });
  readonly canDownloadAnnualReport = computed(() => this.filteredAnnualTrainingReportRows().length > 0);
  readonly canDownloadReport = computed(() => this.filteredReportRows().length > 0);
  readonly canDownloadIdpReport = computed(() => this.idpReportRows().length > 0);
  readonly canDownloadCertificateLicenceReport = computed(() => this.certificateLicenceReportRows().length > 0);

  readonly singleUserForm = this.createUserForm();
  readonly userEditForm = this.createUserForm();

  private welcomeBannerExitTimer: ReturnType<typeof setTimeout> | null = null;
  private welcomeBannerHideTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    this.loadAdminProfileImage();
    this.startWelcomeBannerSequence();
  }

  ngOnDestroy() {
    this.clearWelcomeBannerTimers();
  }


  selectReportView(view: AdminReportView) {
    this.selectedReportView.set(view);
  }

  clearReportView() {
    this.selectedReportView.set(null);
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

  updateReportDepartment(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    this.selectedReportDepartment.set(input?.value ?? '');
  }

  updateReportGroup(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    this.selectedReportGroup.set(input?.value ?? '');
  }

  updateReportAccessStatus(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    const nextValue = input?.value === 'Active' || input?.value === 'Inactive' ? input.value : 'All';
    this.selectedReportAccessStatus.set(nextValue);
  }

  updateReportStartDate(event: Event) {
    const input = event.target as HTMLInputElement | null;
    this.selectedReportStartDate.set(input?.value ?? '');
  }

  updateReportEndDate(event: Event) {
    const input = event.target as HTMLInputElement | null;
    this.selectedReportEndDate.set(input?.value ?? '');
  }

  updateBulkUploadTemplateFormat(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    this.selectedBulkUploadTemplateFormat.set(input?.value === 'XLSX' ? 'XLSX' : 'CSV');
  }

  updateReportDownloadFormat(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    this.selectedReportDownloadFormat.set(input?.value === 'XLSX' ? 'XLSX' : 'CSV');
  }

  updateAnnualReportDownloadFormat(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    this.selectedAnnualReportDownloadFormat.set(input?.value === 'XLSX' ? 'XLSX' : 'CSV');
  }

  updateIdpReportDownloadFormat(event: Event) {
    const input = event.target as HTMLSelectElement | null;
    this.selectedIdpReportDownloadFormat.set(input?.value === 'XLSX' ? 'XLSX' : 'CSV');
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

  updateAnnualReportTrainingStartDate(event: Event) {
    const input = event.target as HTMLInputElement | null;
    this.selectedAnnualReportTrainingStartDate.set(input?.value ?? '');
  }

  updateAnnualReportTrainingEndDate(event: Event) {
    const input = event.target as HTMLInputElement | null;
    this.selectedAnnualReportTrainingEndDate.set(input?.value ?? '');
  }

  clearReportFilters() {
    this.selectedReportDepartment.set('');
    this.selectedReportGroup.set('');
    this.selectedReportAccessStatus.set('All');
    this.selectedReportStartDate.set('');
    this.selectedReportEndDate.set('');
  }

  clearAnnualReportFilters() {
    this.annualReportSearchTerm.set('');
    this.selectedAnnualReportDepartment.set('');
    this.selectedAnnualReportTrainingStartDate.set('');
    this.selectedAnnualReportTrainingEndDate.set('');
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

  openUserEditor(student: EnrollmentStudent) {
    this.editingUserId.set(student.id);
    this.userEditForm.setValue({
      name: student.name,
      surname: student.surname,
      email: student.email,
      password: '',
      jobTitle: student.jobTitle,
      idNumber: student.idNumber,
      department: student.department,
      lineManagerId: student.lineManagerId ?? '',
      group: student.group,
      dateEnrolled: student.dateEnrolled,
      deadlineDate: student.deadlineDate,
      activeStatus: student.activeStatus,
      managerAccess: student.role === 'manager' ? 'Yes' : 'No',
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

    const studentInput = this.buildStudentInputFromForm(this.userEditForm, activeUser.role);
    const password = this.passwordFromForm(this.userEditForm);
    this.managerData.updateStudent(activeUser.id, studentInput);

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

  selectTheme(themeId: LmsBrandThemeId) {
    this.branding.selectTheme(themeId);
  }

  onThemeSelectionChange(event: Event) {
    const target = event.target as HTMLSelectElement | null;
    if (!target) {
      return;
    }

    this.selectTheme(target.value as LmsBrandThemeId);
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
      const rawRows = xlsx.utils.sheet_to_json<(string | number | boolean | Date)[]>(worksheet, {
        header: 1,
        raw: false,
        defval: '',
        blankrows: false,
        dateNF: 'yyyy-mm-dd',
      });

      return this.parseBulkUploadRows(rawRows.map((row) => row.map((value) => String(value ?? ''))));
    }

    const csvText = await file.text();
    const rawRows = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => this.parseCsvLine(line));

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
      const record = new Map<string, string>();

      headers.forEach((header, index) => {
        record.set(header, values[index]?.trim() ?? '');
      });

      const lineNumber = rowIndex + 2;
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
      department: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      lineManagerId: new FormControl('', { nonNullable: true }),
      group: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      dateEnrolled: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      deadlineDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      activeStatus: new FormControl<'Active' | 'Inactive'>('Active', { nonNullable: true, validators: [Validators.required] }),
      managerAccess: new FormControl<'Yes' | 'No'>('No', { nonNullable: true, validators: [Validators.required] }),
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
      department: '',
      lineManagerId: '',
      group: '',
      dateEnrolled: '',
      deadlineDate: '',
      activeStatus: 'Active',
      managerAccess: 'No',
    });
  }

  private buildStudentInputFromForm(form: UserFormGroup, existingRole?: EnrollmentStudent['role']): EnrollmentStudentInput {
    return {
      name: form.controls.name.value.trim(),
      surname: form.controls.surname.value.trim(),
      group: form.controls.group.value.trim(),
      dateEnrolled: form.controls.dateEnrolled.value,
      deadlineDate: form.controls.deadlineDate.value,
      email: form.controls.email.value.trim(),
      jobTitle: form.controls.jobTitle.value.trim(),
      idNumber: form.controls.idNumber.value.trim(),
      activeStatus: form.controls.activeStatus.value,
      department: form.controls.department.value.trim(),
      lineManagerId: form.controls.lineManagerId.value || undefined,
      lineManager: (() => {
        const lmId = form.controls.lineManagerId.value;
        const lm = this.managerData.students().find((s) => s.id === lmId);
        return lm ? `${lm.name} ${lm.surname}` : '';
      })(),
      role: this.roleFromManagerAccess(form.controls.managerAccess.value, existingRole),
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
    const department = record.get('department') ?? '';
    const lineManager = record.has('linemanager') ? (record.get('linemanager') ?? '').trim() : undefined;
    const group = record.get('group') ?? '';
    const dateEnrolled = this.normalizeBulkUploadDate(record.get('dateenrolled') ?? '');
    const deadlineDate = this.normalizeBulkUploadDate(record.get('deadlinedate') ?? '');
    const rawStatus = (record.get('activestatus') ?? 'Active').trim();
    const rawManager = (record.get('manager') ?? '').trim().toLowerCase();
    const rawRole = (record.get('role') ?? '').trim().toLowerCase();

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

    let role: 'student' | 'manager' | 'admin' = this.roleFromBulkUpload(rawManager);
    if (['student', 'manager', 'admin'].includes(rawRole)) {
      role = rawRole as 'student' | 'manager' | 'admin';
    }
    return {
      student: {
        name: name.trim(),
        surname: surname.trim(),
        email,
        ...(jobTitle !== undefined ? { jobTitle } : {}),
        ...(idNumber !== undefined ? { idNumber } : {}),
        department: department.trim(),
        ...(lineManager !== undefined ? { lineManager } : {}),
        group: group.trim(),
        dateEnrolled,
        deadlineDate,
        activeStatus: rawStatus.toLowerCase() === 'inactive' ? 'Inactive' : 'Active',
        role,
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
      ['Name', 'Surname', 'Email', 'Password', 'Job Title', 'ID Number', 'Department', 'Line Manager', 'Group', 'Start Date', 'End Date', 'Training Manager', 'Access'],
      ['Lebo', 'Mokoena', 'lebo.mokoena@example.com', 'Welcome@123', 'Operations Coordinator', '9201015800083', 'Operations', 'Nandi Khumalo', 'Cohort A', '2026-04-01', '2026-10-30', 'No', 'Active'],
    ];
  }

  private roleFromManagerAccess(managerAccess: 'Yes' | 'No', existingRole?: EnrollmentStudent['role']) {
    if (existingRole === 'admin') {
      return 'admin' as const;
    }

    return managerAccess === 'Yes' ? 'manager' : 'student';
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
          role: student.role as 'student' | 'manager' | 'admin',
          password,
        } satisfies ManagedUserCredentialInput;
      })
      .filter((entry): entry is ManagedUserCredentialInput => entry !== null);

    if (!users.length) {
      return { created: 0, updated: 0, skipped: 0 };
    }

    return await firstValueFrom(this.backend.upsertManagedUserCredentials({ users }));
  }

  getReportCellValue(row: LearnerReportRow, field: ReportFieldKey) {
    const student = row.student;

    switch (field) {
      case 'name':
        return student.name;
      case 'surname':
        return student.surname;
      case 'email':
        return student.email;
      case 'jobTitle':
        return student.jobTitle || 'Not provided';
      case 'idNumber':
        return student.idNumber || 'Not provided';
      case 'department':
        return student.department;
      case 'lineManager':
        return student.lineManager || 'Not provided';
      case 'course':
        return row.courseTitle;
      case 'completionStatus':
        return row.completionStatus;
      case 'dateCompleted':
        return row.dateCompleted;
      case 'mentorship':
        return this.mentorshipStudentIds().has(student.id) ? 'Y' : 'N';
      case 'dateEnrolled':
        return student.dateEnrolled;
      case 'deadlineDate':
        return student.deadlineDate;
    }
  }

  private buildSelectedReportRows() {
    const columns = this.reportColumns();
    const reportRows = this.filteredReportRows();

    return {
      columns,
      students: this.filteredReportUsers(),
      reportRows,
      rows: reportRows.map((row) => columns.map((column) => this.getReportCellValue(row, column.key))),
    };
  }

  private buildIdpReportExportRows() {
    const columns = [
      'Name',
      'Surname',
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

  private buildAnnualReportExportRows() {
    const columns = [
      'Name',
      'Email',
      'ID Number',
      'Department',
      'Training Course',
      'Provider Name',
      'Type of Training',
      'IDP Aligned',
      'Training Start Date',
      'Training End Date',
      'Course Cost',
      'Approved By',
      'Approved Date',
    ];
    const reportRows = this.filteredAnnualTrainingReportRows();

    return {
      columns,
      reportRows,
      rows: reportRows.map((row) => [
        row.learnerName,
        row.learnerEmail,
        row.idNumber,
        row.department,
        row.trainingCourse,
        row.providerName,
        row.trainingType,
        row.alignedToIdp,
        row.trainingStartDate,
        row.trainingEndDate,
        row.courseCost,
        row.approvedBy,
        row.approvedDate,
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

  private loadAdminProfileImage() {
    if (typeof localStorage === 'undefined') {
      this.adminProfileImageDataUrl.set(null);
      return;
    }

    const storedImage = localStorage.getItem(ADMIN_PROFILE_IMAGE_STORAGE_KEY);
    this.adminProfileImageDataUrl.set(storedImage || null);
  }

  onAdminProfileImageSelected(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      this.adminProfileImageDataUrl.set(result);

      if (result) {
        localStorage.setItem(ADMIN_PROFILE_IMAGE_STORAGE_KEY, result);
      } else {
        localStorage.removeItem(ADMIN_PROFILE_IMAGE_STORAGE_KEY);
      }

      if (input) {
        input.value = '';
      }
    };
    reader.readAsDataURL(file);
  }

  clearAdminProfileImage() {
    this.adminProfileImageDataUrl.set(null);
    localStorage.removeItem(ADMIN_PROFILE_IMAGE_STORAGE_KEY);
  }

  onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      this.branding.setCompanyLogo(result);
      if (input) {
        input.value = '';
      }
    };
    reader.readAsDataURL(file);
  }

  downloadReportsCsv() {
    const { columns, rows, students, reportRows } = this.buildSelectedReportRows();

    if (!columns.length) {
      return;
    }

    const lines = [
      ['Report', 'Learner Export'],
      ['Generated By', this.adminName()],
      ['Generated On', this.reportGeneratedOnLabel()],
      ['Users Included', String(students.length)],
      ['Rows Included', String(reportRows.length)],
      [],
      columns.map((column) => column.label),
      ...rows,
    ];

    const csv = lines
      .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'LMS-Learner-Report.csv');
  }

  async downloadReportsXlsx() {
    const { columns, rows, students, reportRows } = this.buildSelectedReportRows();

    if (!columns.length) {
      return;
    }

    const xlsx = await import('xlsx');
    const workbook = xlsx.utils.book_new();
    const worksheetRows = [
      ['Report', 'Learner Export'],
      ['Generated By', this.adminName()],
      ['Generated On', this.reportGeneratedOnLabel()],
      ['Users Included', String(students.length)],
      ['Rows Included', String(reportRows.length)],
      [],
      columns.map((column) => column.label),
      ...rows,
    ];
    const worksheet = xlsx.utils.aoa_to_sheet(worksheetRows);

    xlsx.utils.book_append_sheet(workbook, worksheet, 'Learner Report');
    const workbookArray = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.triggerDownload(
      new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'LMS-Learner-Report.xlsx',
    );
  }

  downloadAnnualReportCsv() {
    const { columns, rows, reportRows } = this.buildAnnualReportExportRows();

    if (!rows.length) {
      return;
    }

    const lines = [
      ['Report', 'Annual Training Report'],
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

    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'LMS-Annual-Training-Report.csv');
  }

  async downloadAnnualReportXlsx() {
    const { columns, rows, reportRows } = this.buildAnnualReportExportRows();

    if (!rows.length) {
      return;
    }

    const xlsx = await import('xlsx');
    const workbook = xlsx.utils.book_new();
    const worksheetRows = [
      ['Report', 'Annual Training Report'],
      ['Generated By', this.adminName()],
      ['Generated On', this.reportGeneratedOnLabel()],
      ['Rows Included', String(reportRows.length)],
      [],
      columns,
      ...rows,
    ];
    const worksheet = xlsx.utils.aoa_to_sheet(worksheetRows);

    xlsx.utils.book_append_sheet(workbook, worksheet, 'Annual Training Report');
    const workbookArray = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.triggerDownload(
      new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'LMS-Annual-Training-Report.xlsx',
    );
  }

  downloadAnnualReport() {
    if (this.selectedAnnualReportDownloadFormat() === 'XLSX') {
      void this.downloadAnnualReportXlsx();
      return;
    }

    this.downloadAnnualReportCsv();
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

  downloadReport() {
    if (this.selectedReportDownloadFormat() === 'XLSX') {
      void this.downloadReportsXlsx();
      return;
    }

    this.downloadReportsCsv();
  }

  openTopbarProfileMenu() {
    this.topbarProfileMenuOpen.update((isOpen) => !isOpen);
  }

  closeTopbarProfileMenu() {
    this.topbarProfileMenuOpen.set(false);
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
        })));
        localStorage.setItem('lms-token', result.token);
        void this.router.navigate([result.route]);
      },
      error: () => {
        this.switchingRole.set(false);
      },
    });
  }

  logout() {
    clearLmsAuthSession();
    this.router.navigate(['/']);
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