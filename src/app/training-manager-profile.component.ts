import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PublishedOfferingDetailComponent } from './published-offering-detail.component';
import { PublishedOfferingCardComponent } from './published-offering-card.component';
import { PowerPointWindowComponent } from './powerpoint-window.component';
import { resolvePowerPointUploadType } from './powerpoint-preview';
import {
  AssignmentSubmissionRecord,
  ExternalTrainingRequestRecord,
  TrainingAssessmentChoice,
  TrainingContentKind,
  EnrollmentStudent,
  LearningActivityItem,
  LearningStatus,
  ManagerPanel,
  MentorshipAssignmentRecord,
  MentorshipSubmissionRecord,
  StudentKpiEntry,
  StudentKpiScore,
  TrainingAssessmentType,
  TrainingManagerDataService,
  TrainingMatchingPair,
  TrainingOffering,
  TrainingOfferingType,
  TrainingQuestionType,
} from './training-manager-data.service';
import { LmsBrandingService } from './lms-branding.service';
import { LmsBackendService, type LoginRole, type ResolveRolesEntry } from './lms-backend.service';
import type { StudentCourse } from './student-data.service';
import { clearLmsAuthSession, combineDisplayName, createLmsSessionRecord, readLmsSessionRecord } from './session-auth';

type CoursesPanelView = 'create' | 'created' | 'submissions';
type AssignmentSubmissionFilter = 'All' | 'Pending Review' | 'Approved' | 'Needs Revision';
type EnrollmentPanelView = 'students' | 'groups';
type AssignWizardStep = 1 | 2 | 3;
type CreateCourseSection = 'basics' | 'content';
type ManagerMessageSection = 'compose' | 'inbox' | null;
type MentorshipWorkspaceSection = 'list' | 'submissions';

type EnrollmentGroupSummary = {
  name: string;
  members: EnrollmentStudent[];
  activeCount: number;
  startDate: string;
  endDate: string;
};

type CreateSectionOption = {
  value: CreateCourseSection;
  label: string;
  note: string;
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

type IdpStatus = 'Not Started' | 'In Progress' | 'Completed' | 'On Hold';

type IdpEntryFormGroup = FormGroup<{
  developmentNeed: FormControl<string | null>;
  plannedAction: FormControl<string | null>;
  supportRequired: FormControl<string | null>;
  dateCaptured: FormControl<string | null>;
  targetDate: FormControl<string | null>;
  status: FormControl<IdpStatus | null>;
}>;

type KpiEntryFormGroup = FormGroup<{
  id: FormControl<string | null>;
  keyResultArea: FormControl<string | null>;
  kpi: FormControl<string | null>;
  weight: FormControl<number | null>;
  target: FormControl<string | null>;
  actual: FormControl<string | null>;
  comments: FormControl<string | null>;
  overallScoring: FormControl<StudentKpiScore | null>;
  // Not shown or edited in the main table any more (Manager/Employee/Overall Scoring collapsed
  // into the single Final Rating column above; Measure and Date of Review dropped as visible
  // columns entirely) — held here purely so this form round-trips the values it loaded rather
  // than blanking them out on save. The server independently guards managerScoring/employeeScoring
  // against a full-table save overwriting them regardless, but shipping accurate values is still
  // better than relying solely on that backstop, and measure/dateOfReview have no other writer at
  // all so this is the only thing keeping them from silently going blank on the next save.
  managerScoring: FormControl<StudentKpiScore | null>;
  employeeScoring: FormControl<StudentKpiScore | null>;
  measure: FormControl<string | null>;
  dateOfReview: FormControl<string | null>;
  // Not shown or edited in the main table (see the Performance Gap Analysis card instead) — held
  // here purely so this form round-trips the values it loaded rather than blanking them out on
  // save. Same reasoning as employeeScoring above: the server independently guards against a
  // full-table save overwriting these regardless, but shipping accurate values is still better
  // than relying solely on that backstop.
  gapInitiative: FormControl<string | null>;
  gapComments: FormControl<string | null>;
  gapTargetDate: FormControl<string | null>;
}>;

@Component({
  selector: 'training-manager-profile',
  host: {
    '(document:keydown.escape)': 'handleOverlayEscape()',
  },
  imports: [CommonModule, ReactiveFormsModule, PublishedOfferingCardComponent, PublishedOfferingDetailComponent, PowerPointWindowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="manager-shell"
      [style.--brand-primary]="branding.currentTheme().primary"
      [style.--brand-secondary]="branding.currentTheme().secondary"
      [style.--brand-tint]="branding.currentTheme().tint"
      [style.--brand-surface]="branding.currentTheme().surface">
      @if (showWelcomeBanner()) {
        <div class="manager-welcome-banner" [class.manager-welcome-banner-leaving]="welcomeBannerLeaving()" role="status" aria-live="polite">
          <div>
            <div class="manager-welcome-banner-title">Welcome back, {{ managerFirstName() }}</div>
            <div class="manager-welcome-banner-copy">Your training manager workspace is ready.</div>
          </div>
        </div>
      }

      <header class="manager-topbar">
        <div class="manager-brand-block">
          <span class="manager-brand-mark" [class.manager-brand-mark-has-image]="!!branding.companyLogoDataUrl()">
            @if (branding.companyLogoDataUrl()) {
              <img [src]="branding.companyLogoDataUrl()!" alt="" />
            } @else {
              <span>TM</span>
            }
          </span>
          <div>
            <div class="manager-brand-name">skillsconnect</div>
            <div class="manager-brand-copy">Training manager workspace</div>
          </div>
        </div>

        <div class="manager-topbar-user">
          <div class="manager-topbar-dropdown-wrap">
            <button
              type="button"
              class="manager-icon-btn"
              aria-label="Pending requests"
              [class.manager-icon-btn-active]="topbarDropdown() === 'notifications'"
              [attr.aria-expanded]="topbarDropdown() === 'notifications'"
              (click)="toggleTopbarDropdown('notifications')">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path fill="#64748b" d="M12 2a6 6 0 0 0-6 6v3.09c0 .36-.19.7-.5.88A3.01 3.01 0 0 0 4 15v1c0 .55.45 1 1 1h14a1 1 0 0 0 1-1v-1c0-1.13-.61-2.16-1.5-2.69-.31-.18-.5-.52-.5-.88V8a6 6 0 0 0-6-6Zm0 20a2.5 2.5 0 0 1-2.45-2h4.9A2.5 2.5 0 0 1 12 22Z"/></svg>
              @if (managerData.pendingExternalTrainingRequestsCount()) {
                <span class="manager-icon-counter">{{ managerData.pendingExternalTrainingRequestsCount() }}</span>
              }
            </button>

            @if (topbarDropdown() === 'notifications') {
              <div class="manager-topbar-preview-panel" role="dialog" aria-label="Pending request notifications">
                <div class="manager-topbar-preview-title">Notifications</div>
                @if (!recentTopbarNotifications().length) {
                  <div class="manager-topbar-preview-empty">No recent notifications.</div>
                }
                @for (request of recentTopbarNotifications(); track request.id) {
                  <button type="button" class="manager-topbar-preview-item" (click)="openTopbarNotificationPreview(request.id)">
                    <strong>{{ request.studentName }}</strong>
                    <span>Requested {{ request.courseName }}</span>
                    <small>{{ request.submittedAt }}</small>
                  </button>
                }
                <button type="button" class="manager-topbar-preview-link" (click)="openTopbarNotificationsPanel()">View all requests</button>
              </div>
            }
          </div>

          <div class="manager-topbar-dropdown-wrap">
            <button
              type="button"
              class="manager-icon-btn"
              aria-label="Messages"
              [class.manager-icon-btn-active]="topbarDropdown() === 'messages'"
              [attr.aria-expanded]="topbarDropdown() === 'messages'"
              (click)="toggleTopbarDropdown('messages')">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path fill="#64748b" d="M21 6.5a2.5 2.5 0 0 0-2.5-2.5h-13A2.5 2.5 0 0 0 3 6.5v11A2.5 2.5 0 0 0 5.5 20h13a2.5 2.5 0 0 0 2.5-2.5v-11Zm-2.5-.5a.5.5 0 0 1 .5.5v.13l-7 4.67-7-4.67V6.5a.5.5 0 0 1 .5-.5h13ZM20 17.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5V8.37l6.65 4.43a1 1 0 0 0 1.1 0L20 8.37v9.13Z"/></svg>
              @if (managerData.unreadManagerMessagesCount()) {
                <span class="manager-icon-counter">{{ managerData.unreadManagerMessagesCount() }}</span>
              }
            </button>

            @if (topbarDropdown() === 'messages') {
              <div class="manager-topbar-preview-panel" role="dialog" aria-label="Unread messages preview">
                <div class="manager-topbar-preview-title">Messages</div>
                @if (!recentTopbarMessages().length) {
                  <div class="manager-topbar-preview-empty">No recent messages.</div>
                }
                @for (message of recentTopbarMessages(); track message.id) {
                  <button type="button" class="manager-topbar-preview-item" (click)="openTopbarMessagePreview(message.id)">
                    <strong>{{ message.sender }}</strong>
                    <span>{{ message.subject }}</span>
                    <small>{{ message.time }}</small>
                  </button>
                }
                <button type="button" class="manager-topbar-preview-link" (click)="openMessagesPanel()">View all messages</button>
              </div>
            }
          </div>

          <div class="manager-topbar-dropdown-wrap">
            <button
              type="button"
              class="manager-topbar-profile-btn"
              aria-label="Manager profile"
              [attr.aria-expanded]="topbarProfileMenuOpen()"
              [disabled]="switchingRole()"
              (click)="openTopbarProfile()">
              <span class="manager-avatar" [class.manager-avatar-has-image]="!!managerData.profile().profileImageUrl">
                @if (managerData.profile().profileImageUrl) {
                  <img [src]="managerData.profile().profileImageUrl!" alt="Profile picture" />
                } @else {
                  {{ managerInitials() }}
                }
              </span>
              <span class="manager-user-name">{{ managerData.profile().name }}</span>
              <svg class="manager-topbar-caret" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m7 10 5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            @if (topbarProfileMenuOpen()) {
              <div class="manager-topbar-menu" role="dialog" aria-label="Manager menu">
                <button type="button" class="manager-topbar-menu-item" (click)="openTopbarProfileDashboard()">Dashboard</button>
                <button type="button" class="manager-topbar-menu-item" (click)="openTopbarProfileMessages()">Messages</button>
                <div class="manager-topbar-menu-divider"></div>
                <label class="manager-topbar-menu-item">
                  <span>{{ uploadingProfileImage() ? 'Uploading…' : 'Change picture' }}</span>
                  <input type="file" accept="image/*" style="display:none" [disabled]="uploadingProfileImage()" (change)="onManagerProfileImageSelected($event)" />
                </label>
                @if (managerData.profile().profileImageUrl) {
                  <button type="button" class="manager-topbar-menu-item" (click)="clearManagerProfileImage()">Remove picture</button>
                }
                @if (canSwitchToRole('administrator') || canSwitchToRole('student')) {
                  <div class="manager-topbar-menu-divider"></div>
                  <div class="manager-topbar-menu-section-label">Switch role</div>
                  @if (canSwitchToRole('administrator')) {
                    <button type="button" class="manager-topbar-menu-item" (click)="switchToRole('administrator')">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.5 5 6.3v4.9c0 4.4 3 8.5 7 9.3 4-.8 7-4.9 7-9.3V6.3l-7-2.8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.3 12.2l1.9 1.9 3.5-3.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      Administrator
                    </button>
                  }
                  @if (canSwitchToRole('student')) {
                    <button type="button" class="manager-topbar-menu-item" (click)="switchToRole('student')">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="currentColor" d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82ZM12 3 1 9l11 6 9-4.91V17h2V9L12 3Z"/></svg>
                      Student
                    </button>
                  }
                }
                <div class="manager-topbar-menu-divider"></div>
                <button type="button" class="manager-topbar-menu-item manager-topbar-menu-item-danger" (click)="logout()">Log out</button>
              </div>
            }
          </div>
        </div>
      </header>

      @if (topbarProfileMenuOpen()) {
        <button type="button" class="manager-topbar-menu-backdrop" aria-label="Close manager menu" (click)="closeTopbarProfileMenu()"></button>
      }

      @if (topbarDropdown()) {
        <button type="button" class="manager-topbar-menu-backdrop" aria-label="Close topbar previews" (click)="closeTopbarDropdown()"></button>
      }

      <div class="manager-layout" [class.manager-layout-sidebar-collapsed]="managerSidebarCollapsed()">
        <aside class="manager-sidebar" [class.manager-sidebar-collapsed]="managerSidebarCollapsed()" [class.manager-sidebar-scrolling]="sidebarScrolling()" (scroll)="onSidebarScroll()" aria-label="Training manager navigation">
          <div class="manager-sidebar-header">
            <button
              type="button"
              class="manager-sidebar-toggle"
              [attr.aria-label]="managerSidebarCollapsed() ? 'Expand navigation panel' : 'Collapse navigation panel'"
              [attr.aria-expanded]="!managerSidebarCollapsed()"
              (click)="toggleManagerSidebar()">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 7.5h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                <path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                <path d="M6 16.5h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
              </svg>
            </button>
          </div>

          @for (item of navItems; track item.value) {
            <button type="button" [class.active]="selectedPanel() === item.value" [attr.aria-label]="item.label" (click)="selectPanel(item.value)">
              <span class="manager-nav-icon" aria-hidden="true">
                @switch (item.value) {
                  @case ('dashboard') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M4.75 12.25 12 5l7.25 7.25" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M7.25 10.75V19h9.5v-8.25" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  }
                  @case ('requested-training') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M7 6.75h10M7 12h10M7 17.25h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      <circle cx="4.5" cy="6.75" r="1" fill="currentColor"/>
                      <circle cx="4.5" cy="12" r="1" fill="currentColor"/>
                      <circle cx="4.5" cy="17.25" r="1" fill="currentColor"/>
                    </svg>
                  }
                  @case ('courses') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M4.75 7.5 12 4l7.25 3.5L12 11 4.75 7.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                      <path d="M4.75 11.5 12 15l7.25-3.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                      <path d="M4.75 15.5 12 19l7.25-3.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    </svg>
                  }
                  @case ('mentorship') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.8"/>
                      <circle cx="16" cy="10" r="2.5" stroke="currentColor" stroke-width="1.8"/>
                      <path d="M4.75 18.25c.95-1.8 2.72-2.75 5.25-2.75 1.05 0 2.02.16 2.9.49" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      <path d="M13.25 18.25c.72-1.4 2.08-2.1 4.05-2.1 1.01 0 1.99.18 2.95.55" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                  }
                  @case ('enrollment') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 6.5v11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      <path d="M6.5 12h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      <circle cx="12" cy="12" r="7.25" stroke="currentColor" stroke-width="1.8"/>
                    </svg>
                  }
                  @case ('messages') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M5.5 7.25h13a1.75 1.75 0 0 1 1.75 1.75v7a1.75 1.75 0 0 1-1.75 1.75h-13A1.75 1.75 0 0 1 3.75 16V9A1.75 1.75 0 0 1 5.5 7.25Z" stroke="currentColor" stroke-width="1.8"/>
                      <path d="m5 8 7 5 7-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  }
                  @case ('idp') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 3L12 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      <path d="M5 6h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      <path d="M7 10h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      <path d="M7 14h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      <path d="M9 18h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                  }
                  @case ('performance') {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M4.25 19.25V4.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      <path d="M4.25 19.25h15.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      <rect x="7" y="12" width="2.75" height="7.25" rx="1" fill="currentColor"/>
                      <rect x="12" y="8.5" width="2.75" height="10.75" rx="1" fill="currentColor"/>
                      <rect x="17" y="5.5" width="2.75" height="13.75" rx="1" fill="currentColor"/>
                    </svg>
                  }
                }
              </span>
              <span class="manager-nav-label">{{ item.label }}</span>
            </button>
          }

          <button type="button" class="logout" aria-label="Log out" (click)="logout()">
            <span class="manager-nav-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M10 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
                <path d="M14 16l4-4-4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M18 12H9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
              </svg>
            </span>
            <span class="manager-nav-label">Log out</span>
          </button>
        </aside>

        <main class="manager-main-panel">
          @if (selectedPanel() === 'dashboard') {
            <section class="manager-panel">

              <div class="dashboard-card-grid">
                @for (card of managerData.dashboardCards(); track card.label) {
                  <article class="stat-card">
                    <span class="stat-accent" [style.background]="card.accent"></span>
                    <div class="stat-label">{{ card.label }}</div>
                    <div class="stat-value">{{ card.value }}</div>
                    <div class="stat-detail">{{ card.detail }}</div>
                  </article>
                }
              </div>

              <section class="activity-card">
                <div class="section-heading-row">
                  <h2>Learning Activity</h2>
                  <span>{{ managerData.registeredStudentsCount() }} students tracked</span>
                </div>

                <div class="activity-chart-shell">
                  <div class="activity-chart-scale" aria-hidden="true">
                    <span>{{ activityMaxCount() }}</span>
                    <span>{{ activityMidpoint() }}</span>
                    <span>0</span>
                  </div>

                  @for (activity of learningActivityLive(); track activity.label) {
                    <div class="activity-column">
                      <div class="activity-column-stage" aria-hidden="true">
                        <div class="activity-column-track">
                          <span class="activity-bar-fill" [style.height.%]="activityHeight(activity)" [style.background]="activity.color"></span>
                        </div>
                      </div>

                      <div class="activity-column-meta">
                        <strong>{{ activity.count }}</strong>
                        <span>{{ activity.label }}</span>
                      </div>
                    </div>
                  }
                </div>

                <div class="activity-legend-row">
                  @for (activity of learningActivityLive(); track activity.label) {
                    <div class="activity-legend-item">
                      <span class="activity-legend-dot" [style.background]="activity.color"></span>
                      <span>{{ activity.label }}</span>
                    </div>
                  }
                </div>
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

          @if (selectedPanel() === 'mentorship') {
            <section class="manager-panel">
              <div class="section-heading-block">
                <h1>Mentorship</h1>
              </div>

              <div class="mentorship-panel-nav" aria-label="Mentorship sections">
                <button type="button" class="mentorship-panel-nav-btn" [class.mentorship-panel-nav-btn-active]="selectedMentorshipSection() === 'list'" (click)="selectedMentorshipSection.set('list')">Mentorship List</button>
                <button type="button" class="mentorship-panel-nav-btn" [class.mentorship-panel-nav-btn-active]="selectedMentorshipSection() === 'submissions'" (click)="selectedMentorshipSection.set('submissions')">Mentorship Submissions</button>
              </div>

              @if (selectedMentorshipSection() === 'list') {
                <section class="activity-card mentorship-review-card">
                  <div class="section-heading-row mentorship-review-heading-row">
                    <div>
                      <h2>Mentorship List</h2>
                      <span>Mentorship details for your team members.</span>
                    </div>
                  </div>

                  <div class="mentorship-list-table" role="table" aria-label="Mentorship assignment list">
                    <div class="mentorship-list-head" role="row">
                      <span role="columnheader">Mentee Name</span>
                      <span role="columnheader">Surname</span>
                      <span role="columnheader">Mentorship Start Date</span>
                      <span role="columnheader">Job Title</span>
                      <span role="columnheader">Mentor Name and Surname</span>
                      <span role="columnheader">Profile Form</span>
                    </div>

                    @for (assignment of mentorshipAssignments(); track assignment.id) {
                      <article class="mentorship-list-item" role="row">
                        <span class="mentorship-list-cell mentorship-list-cell-strong" role="cell">{{ assignment.menteeName }}</span>
                        <span class="mentorship-list-cell" role="cell">{{ assignment.menteeSurname }}</span>
                        <span class="mentorship-list-cell" role="cell">{{ assignment.mentorshipStartDate }}</span>
                        <span class="mentorship-list-cell" role="cell">{{ assignment.jobTitle }}</span>
                        <span class="mentorship-list-cell" role="cell">{{ formatMentorshipMentorDisplay(assignment) }}</span>
                        <div class="mentorship-list-actions" role="cell">
                          @if (mentorshipProfileSubmissionByMenteeId().get(assignment.menteeId); as profileSub) {
                            <span class="mentorship-review-status-pill" [class.mentorship-review-status-pill-approved]="profileSub.status === 'Approved'" [class.mentorship-review-status-pill-revision]="profileSub.status === 'Needs Revision'">{{ profileSub.status }}</span>
                            <button type="button" class="edit-btn" (click)="viewMentorshipListSubmission(profileSub.id)">View</button>
                          } @else {
                            <span class="mentorship-review-status-pill">Not submitted</span>
                          }
                        </div>
                      </article>
                    }

                    @if (!mentorshipAssignments().length) {
                      <div class="mentorship-review-empty-state mentorship-review-empty-state-detail">No mentorship assignments have been set up yet.</div>
                    }
                  </div>
                </section>
              } @else if (selectedMentorshipSection() === 'submissions') {
                <section class="activity-card mentorship-review-card">
                  <div class="section-heading-row mentorship-review-heading-row">
                    <div>
                      <h2>Mentorship Submissions</h2>
                      <span>View the mentorship forms submitted by students.</span>
                    </div>
                  </div>

                  @if (managerData.mentorshipSubmissionsForCurrentManager().length) {
                    <div class="mentorship-list-table" role="table" aria-label="Mentorship submission list">
                      <div class="mentorship-list-head" role="row" [style.gridTemplateColumns]="'minmax(200px, 1.2fr) minmax(200px, 1.2fr) minmax(120px, 0.55fr)'" [style.minWidth]="'720px'">
                        <span role="columnheader">Mentee Name and Surname</span>
                        <span role="columnheader">Mentor Name and Surname</span>
                        <span role="columnheader">Submitted Form</span>
                      </div>

                      @for (submission of managerData.mentorshipSubmissionsForCurrentManager(); track submission.id) {
                        <article class="mentorship-list-item" role="row" [style.gridTemplateColumns]="'minmax(200px, 1.2fr) minmax(200px, 1.2fr) minmax(120px, 0.55fr)'" [style.minWidth]="'720px'">
                          <span class="mentorship-list-cell mentorship-list-cell-strong" role="cell">{{ submission.studentName }}</span>
                          <span class="mentorship-list-cell" role="cell">{{ submission.mentorName }}</span>
                          <div class="mentorship-list-actions" role="cell">
                            <span class="mentorship-list-cell">{{ submission.assessmentTitle }}</span>
                            <button type="button" class="edit-btn" (click)="openMentorshipReview(submission.id)">View</button>
                          </div>
                        </article>
                      }
                    </div>

                    @if (selectedMentorshipReviewId() && selectedMentorshipReview(); as activeReview) {
                      <div class="mentorship-review-detail-card mentorship-submission-detail-card">
                        <div class="mentorship-review-detail-header">
                          <div>
                            <h3>{{ activeReview.studentName }}</h3>
                            <span>{{ activeReview.assessmentTitle }} • {{ activeReview.offeringTitle }}</span>
                          </div>
                          <div class="mentorship-review-actions">
                            <span class="mentorship-review-status-pill" [class.mentorship-review-status-pill-approved]="activeReview.status === 'Approved'" [class.mentorship-review-status-pill-revision]="activeReview.status === 'Needs Revision'">
                              {{ activeReview.status }}
                            </span>
                            <button type="button" class="builder-secondary-btn" (click)="clearMentorshipReview()">Close</button>
                          </div>
                        </div>

                        <div class="mentorship-review-meta-grid">
                          <div>
                            <strong>Mentee</strong>
                            <span>{{ activeReview.studentName }}</span>
                          </div>
                          <div>
                            <strong>Mentor</strong>
                            <span>{{ activeReview.mentorName }}</span>
                          </div>
                          <div>
                            <strong>Session date</strong>
                            <span>{{ activeReview.sessionDate }}</span>
                          </div>
                          <div>
                            <strong>Submitted</strong>
                            <span>{{ activeReview.submittedAt }}</span>
                          </div>
                        </div>

                        <div class="mentorship-review-action-plan">
                          <strong>Submitted mentorship form</strong>
                          <p>{{ activeReview.actionPlan }}</p>
                        </div>

                        @if (activeReview.reviewerFeedback) {
                          <div class="mentorship-review-history">
                            <strong>{{ activeReview.reviewerName || 'Manager' }} feedback</strong>
                            <p>{{ activeReview.reviewerFeedback }}</p>
                          </div>
                        }

                        <form class="mentorship-review-form" [formGroup]="mentorshipReviewForm" (ngSubmit)="applyMentorshipReview('Approved')">
                          <label>
                            Feedback for learner
                            <textarea formControlName="feedback" rows="5" placeholder="Add feedback or revision guidance"></textarea>
                          </label>

                          <div class="mentorship-review-actions">
                            <button type="button" class="detail-action-btn" (click)="applyMentorshipReview('Needs Revision')">Request revision</button>
                            <button type="submit" class="detail-action-btn detail-action-btn-primary">Approve submission</button>
                          </div>
                        </form>
                      </div>
                    }
                  } @else {
                    <div class="mentorship-review-empty-state mentorship-review-empty-state-detail">No mentorship forms have been submitted yet.</div>
                  }
                </section>
              }
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

          @if (selectedPanel() === 'requested-training') {
            <section class="manager-panel">
              <section class="activity-card mentorship-review-card">
                <div class="section-heading-row">
                  <h2>Training Requests</h2>
                  <span>{{ managerData.pendingExternalTrainingRequestsCount() }} pending review</span>
                </div>

                @if (managerData.externalTrainingRequestsForCurrentManager().length) {
                  <div class="mentorship-review-shell mentorship-review-shell-overlay">
                    <div class="mentorship-review-list" role="list" aria-label="External training requests awaiting review">
                      @for (request of managerData.externalTrainingRequestsForCurrentManager(); track request.id) {
                        <button
                          type="button"
                          class="mentorship-review-list-item"
                          [class.mentorship-review-list-item-active]="selectedExternalTrainingRequest()?.id === request.id"
                          (click)="openExternalTrainingRequestReview(request.id)">
                          <div>
                            <strong>{{ request.studentName }}</strong>
                            <span>{{ request.courseName }} • {{ request.provider }}</span>
                          </div>
                          <div class="mentorship-review-chip-row">
                            <span class="mentorship-review-status-pill" [class.mentorship-review-status-pill-approved]="request.status === 'Approved'" [class.mentorship-review-status-pill-revision]="request.status === 'Needs Revision'">
                              {{ request.status }}
                            </span>
                          </div>
                        </button>
                      }
                    </div>

                    @if (selectedExternalTrainingRequest(); as activeRequest) {
                      <div class="mentorship-review-request-overlay" (click)="closeExternalTrainingRequestReview()">
                        <article class="mentorship-review-detail-card mentorship-review-request-panel" role="dialog" aria-label="External training request review" (click)="$event.stopPropagation()">
                          <div class="mentorship-review-detail-header">
                            <div>
                              <h3>{{ activeRequest.studentName }}</h3>
                              <span>{{ activeRequest.courseName }} • {{ activeRequest.provider }}</span>
                            </div>

                            <div class="mentorship-review-detail-header-actions">
                              <span class="mentorship-review-status-pill" [class.mentorship-review-status-pill-approved]="activeRequest.status === 'Approved'" [class.mentorship-review-status-pill-revision]="activeRequest.status === 'Needs Revision'">
                                {{ activeRequest.status }}
                              </span>
                              <button type="button" class="mentorship-review-detail-close" (click)="closeExternalTrainingRequestReview()">Close</button>
                            </div>
                          </div>

                          <div class="mentorship-review-meta-grid">
                            <div>
                              <strong>Learner email</strong>
                              <span>{{ activeRequest.studentEmail }}</span>
                            </div>
                            <div>
                              <strong>Type of training</strong>
                              <span>{{ activeRequest.trainingType }}</span>
                            </div>
                            <div>
                              <strong>Aligned with IDP</strong>
                              <span>{{ activeRequest.alignedToIdp }}</span>
                            </div>
                            <div>
                              <strong>Requested cost</strong>
                              <span>{{ activeRequest.courseCost }}</span>
                            </div>
                            <div>
                              <strong>Additional costs</strong>
                              <span>{{ activeRequest.additionalCostRequired }}</span>
                            </div>
                            <div>
                              <strong>Training dates</strong>
                              <span>{{ activeRequest.trainingStartDate }} to {{ activeRequest.trainingEndDate }}</span>
                            </div>
                            <div>
                              <strong>Submitted</strong>
                              <span>{{ activeRequest.submittedAt }}</span>
                            </div>
                            <div>
                              <strong>Assigned manager</strong>
                              <span>{{ activeRequest.approvingManagerName }}</span>
                            </div>
                            <div>
                              <strong>Reviewed</strong>
                              <span>{{ activeRequest.reviewedAt || 'Not reviewed yet' }}</span>
                            </div>
                          </div>

                          @if (activeRequest.additionalCostRequired === 'Yes') {
                            <div class="mentorship-review-history">
                              <strong>Additional cost breakdown</strong>
                              <p>Travel: {{ activeRequest.travelCost }} | Exam: {{ activeRequest.examCost }} | Accomodation: {{ activeRequest.accommodationCost }}</p>
                            </div>
                          }

                          @if (activeRequest.invoiceFileName || activeRequest.brochureFileName) {
                            <div class="mentorship-review-history">
                              <strong>Supporting documents</strong>
                              <div class="mentorship-review-actions">
                                @if (activeRequest.invoiceFileName) {
                                  <button type="button" class="detail-action-btn" (click)="downloadSupportingDocument(activeRequest.invoiceDataUrl, activeRequest.invoiceFileName)">
                                    Download invoice
                                  </button>
                                }
                                @if (activeRequest.brochureFileName) {
                                  <button type="button" class="detail-action-btn" (click)="downloadSupportingDocument(activeRequest.brochureDataUrl, activeRequest.brochureFileName)">
                                    Download brochure
                                  </button>
                                }
                              </div>
                            </div>
                          }

                          @if (activeRequest.reviewerFeedback) {
                            <div class="mentorship-review-history">
                              <strong>{{ activeRequest.reviewerName || 'Manager' }} feedback</strong>
                              <p>{{ activeRequest.reviewerFeedback }}</p>
                            </div>
                          }

                          <form class="mentorship-review-form" [formGroup]="externalTrainingReviewForm" (ngSubmit)="applyExternalTrainingRequestReview('Approved')">
                            <label>
                              Feedback for learner
                              <textarea formControlName="feedback" rows="5" placeholder="Add approval notes or revision guidance"></textarea>
                            </label>

                            <div class="mentorship-review-actions">
                              <button type="button" class="detail-action-btn" (click)="applyExternalTrainingRequestReview('Needs Revision')">Request revision</button>
                              <button type="submit" class="detail-action-btn detail-action-btn-primary">Approve request</button>
                            </div>
                          </form>
                        </article>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="mentorship-review-empty-state mentorship-review-empty-state-detail">No training requests are assigned to this manager yet.</div>
                }
              </section>
            </section>
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
                <div class="student-enrollment-list" role="table" aria-label="Student enrollment list">
                  <div class="student-list-head" role="row">
                    <span role="columnheader">Name</span>
                    <span role="columnheader">Surname</span>
                    <span role="columnheader">Group</span>
                    <span role="columnheader">Date Enrolled</span>
                    <span role="columnheader">Deadline Date</span>
                    <span role="columnheader">Email Address</span>
                    <span role="columnheader">Active Status</span>
                    <span role="columnheader">Department</span>
                    <span role="columnheader">Actions</span>
                  </div>

                  @for (student of filteredEnrollmentStudents(); track student.id) {
                    <article class="student-list-item" role="row">
                      <span class="student-list-cell student-name" role="cell">{{ student.name }}</span>
                      <span class="student-list-cell" role="cell">{{ student.surname }}</span>
                      <span class="student-list-cell" role="cell">{{ student.group }}</span>
                      <span class="student-list-cell" role="cell">{{ student.dateEnrolled }}</span>
                      <span class="student-list-cell" role="cell">{{ student.deadlineDate }}</span>
                      <span class="student-list-cell student-list-email" role="cell">{{ student.email }}</span>
                      <span class="student-list-cell" role="cell">
                        <span class="student-active-pill" [class.student-active-pill-inactive]="student.activeStatus === 'Inactive'">{{ student.activeStatus }}</span>
                      </span>
                      <span class="student-list-cell" role="cell">{{ student.department }}</span>
                      <div class="student-list-actions" role="cell">
                        <button type="button" class="courses-btn" (click)="openManageEnrollmentStudent(student)">Courses ({{ managerData.offeringsForStudent(student).length }})</button>
                      </div>
                    </article>
                  }

                  @if (!filteredEnrollmentStudents().length) {
                    <div class="student-search-empty">No students match your current search.</div>
                  }
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

          @if (selectedPanel() === 'idp') {
            <section class="manager-panel">
              <div class="section-heading-block">
                <h1>IDP Management</h1>
              </div>

              @if (!selectedIdpStudentId()) {
                <!-- Team member list -->
                <div class="student-search-row">
                  <label class="student-search-field">
                    <input
                      type="search"
                      [value]="idpMemberSearchTerm()"
                      (input)="idpMemberSearchTerm.set($any($event.target).value)"
                      placeholder="Search by name, surname, department, or group" />
                  </label>
                  <span class="student-search-count">{{ filteredIdpMembers().length }} shown</span>
                </div>

                <div class="idp-member-grid">
                  @for (student of filteredIdpMembers(); track student.id) {
                    <button type="button" class="idp-member-card" (click)="selectIdpStudent(student.id)">
                      <div class="idp-member-avatar" aria-hidden="true">{{ student.name[0] }}{{ student.surname[0] }}</div>
                      <div class="idp-member-info">
                        <strong class="idp-member-name">{{ student.name }} {{ student.surname }}</strong>
                        <span class="idp-member-meta">{{ student.jobTitle || student.group }}</span>
                        <span class="idp-member-dept">{{ student.department }}</span>
                      </div>
                      <div class="idp-member-status">
                        @if (idpEntryCountForStudent(student.id) > 0) {
                          <span class="idp-program-count">{{ idpEntryCountForStudent(student.id) }} {{ idpEntryCountForStudent(student.id) === 1 ? 'entry' : 'entries' }}</span>
                        } @else {
                          <span class="idp-member-no-entries">No IDP</span>
                        }
                        <span class="idp-member-chevron" aria-hidden="true">›</span>
                      </div>
                    </button>
                  }
                  @if (!managerData.students().length) {
                    <div class="mentorship-review-empty-state mentorship-review-empty-state-detail">No team members found.</div>
                  } @else if (!filteredIdpMembers().length) {
                    <div class="student-search-empty">No team members match your search.</div>
                  }
                </div>
              } @else if (selectedIdpStudent(); as student) {
                <!-- Per-student IDP form -->
                <div class="idp-detail-header">
                  <button type="button" class="idp-back-btn" (click)="clearIdpStudent()">← Back to team</button>
                  <div class="idp-detail-identity">
                    <div class="idp-member-avatar idp-member-avatar-lg" aria-hidden="true">{{ student.name[0] }}{{ student.surname[0] }}</div>
                    <div>
                      <h2 class="idp-detail-name">{{ student.name }} {{ student.surname }}</h2>
                      <span class="idp-detail-meta">{{ student.jobTitle }} · {{ student.department }}</span>
                    </div>
                  </div>
                </div>

                <div class="activity-card mentorship-review-card">
                  @if (idpHasSavedEntries() && !idpEditMode()) {
                    <!-- Read-only view -->
                    <div class="idp-program-card">
                      <div class="idp-program-card-header">
                        <div class="idp-program-card-title-shell">
                          <span class="idp-program-card-title">Saved IDP Entries</span>
                          <span class="idp-program-count" aria-hidden="true">{{ savedIdpEntries().length }} {{ savedIdpEntries().length === 1 ? 'entry' : 'entries' }}</span>
                        </div>
                        <button type="button" class="idp-program-add" (click)="openIdpEdit()">Edit form</button>
                      </div>

                      <div class="idp-program-card-body">
                        @for (entry of savedIdpEntries(); track $index) {
                          <div class="idp-program-entry">
                            <div class="idp-program-entry-top">
                              <div class="idp-program-entry-heading">
                                <span class="idp-row-number" aria-hidden="true">{{ $index + 1 }}</span>
                                <span class="idp-program-entry-label">Entry {{ $index + 1 }}</span>
                              </div>
                              <span class="idp-status-badge"
                                [class.idp-status-in-progress]="entry.status === 'In Progress'"
                                [class.idp-status-completed]="entry.status === 'Completed'"
                                [class.idp-status-on-hold]="entry.status === 'On Hold'">
                                {{ entry.status }}
                              </span>
                            </div>

                            <div class="idp-readonly-grid">
                              <div class="idp-readonly-field idp-readonly-field-full">
                                <span>Development Need</span>
                                <strong>{{ entry.developmentNeed || 'Not provided' }}</strong>
                              </div>
                              <div class="idp-readonly-field idp-readonly-field-full">
                                <span>Planned Action</span>
                                <strong>{{ entry.plannedAction || 'Not provided' }}</strong>
                              </div>
                              <div class="idp-readonly-field">
                                <span>Support Required</span>
                                <strong>{{ entry.supportRequired || 'Not provided' }}</strong>
                              </div>
                              <div class="idp-readonly-field">
                                <span>Date Captured</span>
                                <strong>{{ entry.dateCaptured || 'Not provided' }}</strong>
                              </div>
                              <div class="idp-readonly-field">
                                <span>Target Date</span>
                                <strong>{{ entry.targetDate || 'Not provided' }}</strong>
                              </div>
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  } @else {
                    <!-- Editable form -->
                    <form [formGroup]="idpForm" (ngSubmit)="saveIdpEntries()">
                      <div class="idp-program-card" formArrayName="entries">
                        <div class="idp-program-card-header">
                          <div class="idp-program-card-title-shell">
                            <span class="idp-program-card-title">Development Plan Entries</span>
                            <span class="idp-program-count" aria-hidden="true">{{ idpEntriesControls().length }}</span>
                          </div>
                          <button class="idp-program-add" type="button" (click)="addIdpEntry()">+ Add Entry</button>
                        </div>

                        <div class="idp-program-card-body">
                          @for (entryControl of idpEntriesControls(); track $index) {
                            <div class="idp-program-entry" [formGroupName]="$index">
                              <div class="idp-program-entry-top">
                                <div class="idp-program-entry-heading">
                                  <span class="idp-row-number" aria-hidden="true">{{ $index + 1 }}</span>
                                  <span class="idp-program-entry-label">Entry {{ $index + 1 }}</span>
                                </div>
                                <button
                                  class="idp-program-remove"
                                  type="button"
                                  [disabled]="idpEntriesControls().length === 1"
                                  (click)="removeIdpEntry($index)">
                                  Remove
                                </button>
                              </div>

                              <label class="idp-form-field">
                                <span>Development Need</span>
                                <textarea rows="2" formControlName="developmentNeed" placeholder="Describe the development need..."></textarea>
                              </label>

                              <label class="idp-form-field">
                                <span>Planned Action</span>
                                <textarea rows="2" formControlName="plannedAction" placeholder="Describe the planned action..."></textarea>
                              </label>

                              <label class="idp-form-field">
                                <span>Support Required</span>
                                <input type="text" formControlName="supportRequired" placeholder="What support is needed?" />
                              </label>

                              <label class="idp-form-field">
                                <span>Date Captured</span>
                                <input type="date" formControlName="dateCaptured" />
                              </label>

                              <div class="idp-program-date-grid">
                                <label class="idp-form-field">
                                  <span>Target Date</span>
                                  <input type="date" formControlName="targetDate" />
                                </label>

                                <label class="idp-form-field">
                                  <span>Status</span>
                                  <select formControlName="status">
                                    <option value="Not Started">Not Started</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                    <option value="On Hold">On Hold</option>
                                  </select>
                                </label>
                              </div>
                            </div>
                          }
                        </div>
                      </div>

                      <div class="idp-program-actions">
                        @if (idpSaved()) {
                          <p class="idp-form-status" role="status" aria-live="polite">IDP entries saved.</p>
                        }
                        @if (idpHasSavedEntries()) {
                          <button type="button" class="idp-cancel-btn" (click)="cancelIdpEdit()">Cancel</button>
                        }
                        <button class="idp-save-button" type="submit">Save</button>
                      </div>
                    </form>
                  }
                </div>
              }
            </section>
          }

          @if (selectedPanel() === 'performance') {
            <section class="manager-panel">
              <div class="section-heading-block">
                <p class="eyebrow">Performance</p>
                <h1>KPI Management</h1>
              </div>

              <div class="kpi-year-banner">
                <span class="kpi-year-banner-label">Current KPI year: <strong>{{ managerData.currentKpiYear() }}</strong></span>
                @if (!kpiYearPromptOpen()) {
                  <button type="button" class="idp-program-add" (click)="openKpiYearPromptDialog()">Open new KPI year</button>
                } @else {
                  <div class="kpi-year-prompt">
                    <label class="kpi-year-prompt-field">
                      <span>New year</span>
                      <input type="number" [value]="kpiYearPromptValue()" (input)="kpiYearPromptValue.set(+$any($event.target).value)" />
                    </label>
                    <button type="button" class="idp-program-add" [disabled]="kpiYearOpening()" (click)="confirmOpenKpiYear()">{{ kpiYearOpening() ? 'Opening…' : 'Confirm' }}</button>
                    <button type="button" class="idp-cancel-btn" [disabled]="kpiYearOpening()" (click)="closeKpiYearPromptDialog()">Cancel</button>
                  </div>
                }
                @if (kpiYearOpenError()) {
                  <p class="kpi-year-prompt-error" role="alert">{{ kpiYearOpenError() }}</p>
                }
              </div>
              <p class="kpi-year-banner-hint">
                Opening a new year carries every team member's current KPI definitions forward with all scores cleared, and permanently closes {{ managerData.currentKpiYear() }} as a read-only record.
              </p>

              @if (!selectedKpiStudentId()) {
                <!-- Team member list -->
                <div class="student-search-row">
                  <label class="student-search-field">
                    <input
                      type="search"
                      [value]="kpiMemberSearchTerm()"
                      (input)="kpiMemberSearchTerm.set($any($event.target).value)"
                      placeholder="Search by name, surname, department, or group" />
                  </label>
                  <span class="student-search-count">{{ filteredKpiMembers().length }} shown</span>
                </div>

                <div class="idp-member-grid">
                  @for (student of filteredKpiMembers(); track student.id) {
                    <button type="button" class="idp-member-card" (click)="selectKpiStudent(student.id)">
                      <div class="idp-member-avatar" aria-hidden="true">{{ student.name[0] }}{{ student.surname[0] }}</div>
                      <div class="idp-member-info">
                        <strong class="idp-member-name">{{ student.name }} {{ student.surname }}</strong>
                        <span class="idp-member-meta">{{ student.jobTitle || student.group }}</span>
                        <span class="idp-member-dept">{{ student.department }}</span>
                      </div>
                      <div class="idp-member-status">
                        @if (kpiEntryCountForStudent(student.id) > 0) {
                          <span class="idp-program-count">{{ kpiEntryCountForStudent(student.id) }} {{ kpiEntryCountForStudent(student.id) === 1 ? 'KPI' : 'KPIs' }}</span>
                        } @else {
                          <span class="idp-member-no-entries">No KPIs</span>
                        }
                        <span class="idp-member-chevron" aria-hidden="true">›</span>
                      </div>
                    </button>
                  }
                  @if (!managerData.students().length) {
                    <div class="mentorship-review-empty-state mentorship-review-empty-state-detail">No team members found.</div>
                  } @else if (!filteredKpiMembers().length) {
                    <div class="student-search-empty">No team members match your search.</div>
                  }
                </div>
              } @else if (selectedKpiStudent(); as student) {
                <!-- Per-student KPI table pops out into a bigger overlay so the wide table has room to breathe -->
                <div class="kpi-overlay" role="dialog" aria-modal="true" aria-labelledby="kpi-overlay-title">
                  <button type="button" class="kpi-overlay-backdrop" aria-label="Close KPI table" (click)="clearKpiStudent()"></button>

                  <div class="kpi-overlay-panel">
                    <div class="idp-detail-header">
                      <button type="button" class="idp-back-btn" (click)="clearKpiStudent()">← Back to team</button>
                      <div class="idp-detail-identity">
                        <div class="idp-member-avatar idp-member-avatar-lg" aria-hidden="true">{{ student.name[0] }}{{ student.surname[0] }}</div>
                        <div>
                          <h2 class="idp-detail-name" id="kpi-overlay-title">{{ student.name }} {{ student.surname }}</h2>
                          <span class="idp-detail-meta">{{ student.jobTitle }} · {{ student.department }}</span>
                        </div>
                      </div>
                    </div>

                    <div class="kpi-year-selector-row">
                      <span class="kpi-year-selector-label">KPI year</span>
                      <select
                        class="kpi-year-selector"
                        [value]="selectedKpiYear()"
                        (change)="selectKpiYear(+$any($event.target).value)">
                        @for (year of managerData.kpiYearsOpened(); track year) {
                          <option [value]="year">{{ year }}{{ year === managerData.currentKpiYear() ? ' (current)' : '' }}</option>
                        }
                      </select>
                      @if (!isViewingCurrentKpiYear()) {
                        <span class="kpi-year-readonly-badge">Read-only — past year</span>
                      }
                    </div>

                    <div class="activity-card mentorship-review-card">
                      @if (!isViewingCurrentKpiYear() || (kpiHasSavedEntries() && !kpiEditMode())) {
                    <!-- Read-only view -->
                    <div class="idp-program-card">
                      <div class="idp-program-card-header">
                        <div class="idp-program-card-title-shell">
                          <span class="idp-program-card-title">{{ isViewingCurrentKpiYear() ? 'Saved KPIs' : selectedKpiYear() + ' KPIs' }}</span>
                          <span class="idp-program-count" aria-hidden="true">{{ savedKpiEntries().length }} {{ savedKpiEntries().length === 1 ? 'KPI' : 'KPIs' }}</span>
                          <span class="kpi-total-weight" [class.kpi-total-weight-off]="savedKpiTotalWeight() !== 100">
                            Total weight: {{ savedKpiTotalWeight() }}%
                          </span>
                        </div>
                        @if (isViewingCurrentKpiYear()) {
                          <button type="button" class="idp-program-add" (click)="openKpiEdit()">Edit table</button>
                        }
                      </div>

                      <div class="kpi-table-wrap">
                        <table class="kpi-table">
                          <colgroup>
                            <col style="width: 14%" />
                            <col style="width: 16%" />
                            <col style="width: 8%" />
                            <col style="width: 16%" />
                            <col style="width: 16%" />
                            <col style="width: 10%" />
                            <col style="width: 20%" />
                          </colgroup>
                          <thead>
                            <tr>
                              <th>Key Result Area</th>
                              <th>Key Performance Indicator</th>
                              <th class="kpi-cell-weight">Weight of KPI</th>
                              <th>Target</th>
                              <th>Actual</th>
                              <th class="kpi-cell-center">Final Rating</th>
                              <th>Comments</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (entry of savedKpiEntries(); track entry.id) {
                              <tr>
                                <td>{{ entry.keyResultArea || 'Not provided' }}</td>
                                <td>{{ entry.kpi || 'Not provided' }}</td>
                                <td class="kpi-cell-weight">{{ entry.weight }}%</td>
                                <td>{{ entry.target || 'Not provided' }}</td>
                                <td>{{ entry.actual || 'Not provided' }}</td>
                                <td class="kpi-cell-center"><span class="kpi-score-pill" [class.kpi-score-flag]="entry.overallScoring === 2" [class.kpi-score-empty]="entry.overallScoring === null">{{ kpiScoreLabel(entry.overallScoring) }}</span></td>
                                <td>{{ entry.comments || 'Not provided' }}</td>
                              </tr>
                            }
                          </tbody>
                          <tfoot>
                            <tr class="kpi-totals-row">
                              <td>Totals</td>
                              <td></td>
                              <td class="kpi-cell-weight" [class.kpi-total-weight-off]="savedKpiTotalWeight() !== 100">{{ savedKpiTotalWeight() }}%</td>
                              <td></td>
                              <td></td>
                              <td class="kpi-cell-center"><span class="kpi-score-pill kpi-total-rating-pill">{{ formatKpiOverallRating(savedKpiOverallWeightedRating()) }}</span></td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      @if (!savedKpiEntries().length) {
                        <p class="kpi-year-empty-note">No KPIs were recorded for {{ selectedKpiYear() }}.</p>
                      }
                    </div>
                  } @else {
                    <!-- Editable form -->
                    <form [formGroup]="kpiForm" (ngSubmit)="saveKpiEntries()">
                      <div class="idp-program-card" formArrayName="entries">
                        <div class="idp-program-card-header">
                          <div class="idp-program-card-title-shell">
                            <span class="idp-program-card-title">KPI Table</span>
                            <span class="idp-program-count" aria-hidden="true">{{ kpiEntriesControls().length }}</span>
                            <span class="kpi-total-weight" [class.kpi-total-weight-off]="kpiTotalWeight() !== 100">
                              Total weight: {{ kpiTotalWeight() }}% (must equal 100%)
                            </span>
                          </div>
                          <button class="idp-program-add" type="button" (click)="addKpiEntry()">+ Add KPI</button>
                        </div>

                        <div class="kpi-table-wrap">
                          <table class="kpi-table kpi-table-editable">
                            <colgroup>
                              <col style="width: 13%" />
                              <col style="width: 15%" />
                              <col style="width: 7%" />
                              <col style="width: 14%" />
                              <col style="width: 14%" />
                              <col style="width: 10%" />
                              <col style="width: 19%" />
                              <col style="width: 8%" />
                            </colgroup>
                            <thead>
                              <tr>
                                <th>Key Result Area</th>
                                <th>Key Performance Indicator</th>
                                <th class="kpi-cell-weight">Weight of KPI %</th>
                                <th>Target</th>
                                <th>Actual</th>
                                <th class="kpi-cell-center">Final Rating</th>
                                <th>Comments</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (entryControl of kpiEntriesControls(); track $index) {
                                <tr [formGroupName]="$index">
                                  <td><textarea rows="2" formControlName="keyResultArea" placeholder="e.g. Manufacturing"></textarea></td>
                                  <td><textarea rows="2" formControlName="kpi" placeholder="e.g. Manufacturing of silicon cups"></textarea></td>
                                  <td class="kpi-cell-weight"><input type="number" min="0" max="100" formControlName="weight" /></td>
                                  <td><textarea rows="2" formControlName="target" placeholder="e.g. Produce 1000 cups a month"></textarea></td>
                                  <td><textarea rows="2" formControlName="actual" placeholder="e.g. Produced 940"></textarea></td>
                                  <td class="kpi-cell-center">
                                    <select formControlName="overallScoring" [class.kpi-score-flag]="entryControl.controls.overallScoring.value === 2">
                                      <option [ngValue]="null">Not scored</option>
                                      @for (option of kpiScoreOptions; track option.value) {
                                        <option [ngValue]="option.value">{{ option.label }}</option>
                                      }
                                    </select>
                                  </td>
                                  <td><textarea rows="2" formControlName="comments" placeholder="Comments..."></textarea></td>
                                  <td>
                                    <button
                                      type="button"
                                      class="idp-program-remove"
                                      [disabled]="kpiEntriesControls().length === 1"
                                      (click)="removeKpiEntry($index)">
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              }
                            </tbody>
                            <tfoot>
                              <tr class="kpi-totals-row">
                                <td>Totals</td>
                                <td></td>
                                <td class="kpi-cell-weight" [class.kpi-total-weight-off]="kpiTotalWeight() !== 100">{{ kpiTotalWeight() }}%</td>
                                <td></td>
                                <td></td>
                                <td class="kpi-cell-center"><span class="kpi-score-pill kpi-total-rating-pill">{{ formatKpiOverallRating(kpiOverallWeightedRating()) }}</span></td>
                                <td></td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      <div class="idp-program-actions">
                        @if (kpiSaved()) {
                          <p class="idp-form-status" role="status" aria-live="polite">KPI table saved.</p>
                        }
                        @if (kpiTotalWeight() !== 100) {
                          <p class="kpi-weight-error" role="alert">Total weight must equal 100% before you can save — currently {{ kpiTotalWeight() }}%.</p>
                        }
                        @if (kpiHasSavedEntries()) {
                          <button type="button" class="idp-cancel-btn" (click)="cancelKpiEdit()">Cancel</button>
                        }
                        <button class="idp-save-button" type="submit" [disabled]="kpiTotalWeight() !== 100">Save</button>
                      </div>
                    </form>
                  }
                    </div>

                    <div class="activity-card kpi-gap-card">
                      <div class="idp-program-card-header kpi-gap-card-header">
                        <div class="idp-program-card-title-shell">
                          <span class="kpi-gap-icon" aria-hidden="true">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <path d="M12 3.5 21.5 20h-19L12 3.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                              <path d="M12 9.75v4.25" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                              <circle cx="12" cy="17.1" r="0.95" fill="currentColor"/>
                            </svg>
                          </span>
                          <span class="idp-program-card-title">Performance Gap Analysis</span>
                          <span class="idp-program-count kpi-gap-count" aria-hidden="true">{{ kpiGapEntries().length }} {{ kpiGapEntries().length === 1 ? 'gap' : 'gaps' }}</span>
                        </div>
                      </div>
                      <p class="kpi-gap-subtitle">
                        Every KPI rated 1 or 2 on Final Rating {{ isViewingCurrentKpiYear() ? 'needs' : 'needed' }} a documented plan to close the gap.
                      </p>

                      @if (!kpiGapEntries().length) {
                        <div class="kpi-gap-empty">
                          <span class="kpi-gap-empty-icon" aria-hidden="true">✓</span>
                          <span>No performance gaps for {{ selectedKpiYear() }} — every scored KPI is rated 3 or above.</span>
                        </div>
                      } @else {
                        <div class="kpi-gap-list">
                          @for (entry of kpiGapEntries(); track entry.id) {
                            <div class="kpi-gap-item" [class.kpi-gap-item-critical]="entry.overallScoring === 1" [class.kpi-gap-item-warning]="entry.overallScoring === 2">
                              <div class="kpi-gap-item-header">
                                <strong class="kpi-gap-item-title">{{ entry.kpi || 'Untitled KPI' }}</strong>
                                <span class="kpi-score-pill kpi-score-flag">{{ kpiScoreLabel(entry.overallScoring) }}</span>
                              </div>

                              @if (isViewingCurrentKpiYear()) {
                                <div class="kpi-gap-fields">
                                  <label class="kpi-gap-field">
                                    <span>Initiative to address the gap</span>
                                    <textarea
                                      rows="2"
                                      [value]="gapDraftFieldValue(entry, 'initiative')"
                                      (input)="updateGapDraftField(entry.id, 'initiative', $any($event.target).value)"
                                      placeholder="e.g. Enrol in a targeted coaching programme"></textarea>
                                  </label>
                                  <label class="kpi-gap-field">
                                    <span>Comments</span>
                                    <textarea
                                      rows="2"
                                      [value]="gapDraftFieldValue(entry, 'comments')"
                                      (input)="updateGapDraftField(entry.id, 'comments', $any($event.target).value)"
                                      placeholder="Additional context..."></textarea>
                                  </label>
                                  <label class="kpi-gap-field kpi-gap-field-date">
                                    <span>Target date</span>
                                    <input
                                      type="date"
                                      [value]="gapDraftFieldValue(entry, 'targetDate')"
                                      (input)="updateGapDraftField(entry.id, 'targetDate', $any($event.target).value)" />
                                  </label>
                                </div>
                              } @else {
                                <div class="kpi-gap-fields kpi-gap-fields-readonly">
                                  <div class="kpi-gap-field">
                                    <span>Initiative to address the gap</span>
                                    <p>{{ entry.gapInitiative || 'Not provided' }}</p>
                                  </div>
                                  <div class="kpi-gap-field">
                                    <span>Comments</span>
                                    <p>{{ entry.gapComments || 'Not provided' }}</p>
                                  </div>
                                  <div class="kpi-gap-field kpi-gap-field-date">
                                    <span>Target date</span>
                                    <p>{{ entry.gapTargetDate || 'Not provided' }}</p>
                                  </div>
                                </div>
                              }
                            </div>
                          }
                        </div>

                        @if (isViewingCurrentKpiYear()) {
                          <div class="idp-program-actions kpi-gap-actions">
                            @if (gapAnalysisSaved()) {
                              <p class="idp-form-status" role="status" aria-live="polite">Performance gap analysis saved.</p>
                            }
                            @if (gapAnalysisError()) {
                              <p class="kpi-year-prompt-error" role="alert">{{ gapAnalysisError() }}</p>
                            }
                            <button type="button" class="idp-save-button" [disabled]="gapAnalysisSaving()" (click)="saveGapAnalysis()">{{ gapAnalysisSaving() ? 'Saving…' : 'Save gap analysis' }}</button>
                          </div>
                        }
                      }
                    </div>
                  </div>
                </div>
              }
            </section>
          }

          @if (selectedPanel() === 'messages') {
            <section class="manager-panel">
              <div class="section-heading-block">
                <p class="eyebrow">Messages</p>
                <h1>Manage training conversations</h1>
                <p class="section-copy">Choose a message area first, then work inside the relevant view.</p>
              </div>

              @if (!selectedManagerMessageSection()) {
                <div class="manager-message-section-list" aria-label="Training manager message sections">
                  <button type="button" class="manager-message-section-item" (click)="selectManagerMessageSection('compose')">
                    <span class="manager-message-section-icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Z" stroke="currentColor" stroke-width="1.8"/><path d="M8 12h8M8 8.5h5M8 15.5h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </span>
                    <span class="manager-message-section-copy">
                      <span class="manager-message-section-title">Compose Message</span>
                      <span class="manager-message-section-body">Write and send a new message to support, HR, operations, or a learner.</span>
                    </span>
                  </button>

                  <button type="button" class="manager-message-section-item" (click)="selectManagerMessageSection('inbox')">
                    <span class="manager-message-section-icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v9A2.5 2.5 0 0 1 16.5 18h-9A2.5 2.5 0 0 1 5 15.5v-9Z" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 10h4l1.5 2h5L17.5 10H19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </span>
                    <span class="manager-message-section-copy">
                      <span class="manager-message-section-title">Inbox</span>
                      <span class="manager-message-section-body">Open recent threads and review incoming updates from training operations and learner support.</span>
                    </span>
                  </button>
                </div>
              }

              @if (selectedManagerMessageSection()) {
                <div class="manager-message-section-detail">
                  <button type="button" class="manager-message-back-btn" (click)="clearManagerMessageSection()">Back to message sections</button>
                </div>
              }

              @if (selectedManagerMessageSection() === 'inbox') {
                <section class="manager-messages-card" aria-label="Training manager inbox">
                  <div class="section-heading-row">
                    <div>
                      <h2>Inbox</h2>
                      <p class="section-copy">Recent threads for training operations and learner support.</p>
                    </div>
                    <span class="manager-messages-badge">{{ managerData.unreadManagerMessagesCount() }} unread</span>
                  </div>

                  @if (selectedManagerMessage(); as activeMessage) {
                    <div class="manager-message-section-detail">
                      <button type="button" class="manager-message-back-btn" (click)="clearSelectedManagerMessage()">Back to inbox</button>
                    </div>

                    <article class="manager-message-thread-card" aria-label="Opened manager message thread">
                      <div class="manager-message-thread-header">
                        <div class="manager-message-thread-sender-block">
                          <span class="manager-message-avatar">{{ activeMessage.sender[0] }}</span>
                          <div class="manager-message-thread-heading">
                            <strong>{{ activeMessage.sender }}</strong>
                            <span>{{ activeMessage.time }}</span>
                          </div>
                        </div>
                        @if (activeMessage.unread) {
                          <span class="manager-messages-badge">Unread</span>
                        }
                      </div>

                      <div class="manager-message-thread-subject">{{ activeMessage.subject }}</div>

                      <div class="manager-message-thread-conversation">
                        <article class="manager-message-thread-entry manager-message-thread-entry-incoming">
                          <div class="manager-message-thread-entry-meta">
                            <strong>{{ activeMessage.sender }}</strong>
                            <span>{{ activeMessage.time }}</span>
                          </div>
                          <p class="manager-message-thread-body">{{ activeMessage.body }}</p>
                        </article>

                        @for (reply of activeMessage.replies; track reply.id) {
                          <article class="manager-message-thread-entry" [class.manager-message-thread-entry-self]="reply.authorType === 'manager'">
                            <div class="manager-message-thread-entry-meta">
                              <strong>{{ reply.sender }}</strong>
                              <span class="manager-message-thread-entry-meta-detail">
                                <span>{{ reply.time }}</span>
                                @if (reply.deliveryState) {
                                  <span class="manager-message-thread-entry-status">{{ reply.deliveryState }}</span>
                                }
                              </span>
                            </div>
                            <p class="manager-message-thread-body">{{ reply.body }}</p>
                          </article>
                        }
                      </div>

                      <form class="manager-message-thread-reply-form" [formGroup]="managerThreadReplyForm" (ngSubmit)="replyToSelectedManagerMessage()">
                        <div class="manager-message-thread-reply-header">
                          <div>
                            <div class="manager-message-thread-reply-title">Reply to {{ activeMessage.sender }}</div>
                            <p class="manager-message-thread-reply-copy">Send a clearer follow-up from this thread view.</p>
                          </div>
                        </div>

                        <label>
                          Your reply
                          <textarea formControlName="message" rows="6" placeholder="Write your reply here..."></textarea>
                        </label>

                        <div class="manager-message-thread-reply-actions">
                          <button type="submit" class="assign-btn" [disabled]="managerThreadReplyForm.invalid">Send reply</button>
                        </div>
                      </form>
                    </article>
                  } @else {
                    <div class="manager-messages-list">
                      @for (message of managerData.managerMessages(); track message.id) {
                        <button type="button" class="manager-message-item" [class.manager-message-item-unread]="message.unread" (click)="openManagerMessage(message.id)">
                          <div class="manager-message-avatar">{{ message.sender[0] }}</div>
                          <div class="manager-message-copy">
                            <div class="manager-message-row">
                              <strong>{{ message.sender }}</strong>
                              <span>{{ message.time }}</span>
                            </div>
                            <div class="manager-message-subject">{{ message.subject }}</div>
                          </div>
                        </button>
                      }
                    </div>
                  }
                </section>
              }

              @if (selectedManagerMessageSection() === 'compose') {
                <section class="manager-messages-card" aria-label="Compose manager message">
                  <div class="section-heading-row">
                    <div>
                      <h2>Compose</h2>
                      <p class="section-copy">Send a message to a learner loaded in the LMS.</p>
                    </div>
                  </div>

                  <form class="manager-message-form" [formGroup]="managerMessageForm" (ngSubmit)="sendManagerMessage()">
                    <label>
                      Recipient
                      <input
                        formControlName="recipient"
                        type="text"
                        list="manager-message-recipient-options"
                        autocomplete="off"
                        placeholder="Select a learner from the list" />
                      <datalist id="manager-message-recipient-options">
                        @for (recipient of managerData.managerMessageRecipients(); track recipient) {
                          <option [value]="recipient"></option>
                        }
                      </datalist>
                      @if (managerMessageForm.controls.recipient.dirty && managerMessageForm.controls.recipient.hasError('unknownRecipient')) {
                        <span class="manager-field-error">Please select a learner from the list of loaded profiles.</span>
                      }
                      @if (managerData.managerMessageRecipients().length === 0) {
                        <span class="manager-field-hint">No learners are currently loaded in the system.</span>
                      }
                    </label>

                    <label>
                      Subject
                      <input formControlName="subject" type="text" placeholder="Enter subject" />
                    </label>

                    <label>
                      Message
                      <textarea formControlName="message" rows="7" placeholder="Write your message here"></textarea>
                    </label>

                    <div class="manager-message-actions">
                      <button type="submit" class="assign-btn" [disabled]="managerMessageForm.invalid">Send message</button>
                      @if (managerMessageSent()) {
                        <p class="success-copy manager-message-success">Message sent successfully.</p>
                      }
                    </div>
                  </form>
                </section>
              }
            </section>
          }
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --ui-scale: 0.86;
      --sidebar-stack-offset: calc(6.8rem * var(--ui-scale) + 4px);
      display: block;
      min-height: 100vh;
      background: #eef2f7;
      color: #173446;
      font-family: 'Inter', 'Segoe UI', 'Roboto', Arial, sans-serif;
    }

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
    .offering-title,
    .student-name,
    h1,
    h2,
    p {
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
      background: linear-gradient(180deg, #181d40 0%, #12152f 100%);
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

    h1 {
      font-size: clamp(1.45rem, 2.1vw, 2.05rem);
      line-height: 1.12;
      letter-spacing: -0.02em;
    }

    h2 {
      font-size: clamp(1.02rem, 1.4vw, 1.2rem);
      line-height: 1.2;
      letter-spacing: -0.01em;
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

    .student-enrollment-list {
      display: grid;
      gap: 0.6rem;
      width: 100%;
      overflow-x: auto;
      padding-bottom: 0.25rem;
    }

    .student-list-head,
    .student-list-item {
      display: grid;
      grid-template-columns: 1fr 1fr 0.8fr 1fr 1fr 1.4fr 0.9fr 1fr 1.5fr;
      gap: 0.6rem;
      align-items: center;
      min-width: 68rem;
    }

    .student-list-head {
      padding: 0 0.9rem;
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .student-list-item {
      padding: 0.65rem 0.9rem;
      border: 1px solid rgba(15, 23, 42, 0.07);
      border-radius: 10px;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
      transition: box-shadow 0.15s ease, border-color 0.15s ease;
    }

    .student-list-item:hover,
    .student-list-item:focus-within {
      border-color: var(--brand-tint);
      box-shadow: 0 3px 10px rgba(15, 23, 42, 0.08);
    }

    .student-list-cell {
      min-width: 0;
      font-size: 0.86rem;
      color: #173446;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .student-name {
      font-weight: 700;
    }

    .student-list-email {
      overflow-wrap: anywhere;
      white-space: normal;
    }

    .student-list-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

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

    .mentorship-list-table,
    .enrollment-groups-list {
      display: grid;
      gap: 0.6rem;
      overflow-x: auto;
      padding-bottom: 0.25rem;
    }

    .mentorship-list-head,
    .mentorship-list-item {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr 1.2fr 1fr;
      gap: 0.6rem;
      align-items: center;
      min-width: 52rem;
    }

    .mentorship-list-head {
      padding: 0 0.9rem;
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .mentorship-list-item {
      padding: 0.65rem 0.9rem;
      border: 1px solid rgba(15, 23, 42, 0.07);
      border-radius: 10px;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
      transition: box-shadow 0.15s ease, border-color 0.15s ease;
    }

    .mentorship-list-item:hover,
    .mentorship-list-item:focus-within {
      border-color: var(--brand-tint);
      box-shadow: 0 3px 10px rgba(15, 23, 42, 0.08);
    }

    .mentorship-list-cell {
      min-width: 0;
      font-size: 0.86rem;
      color: #173446;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mentorship-list-cell-strong {
      font-weight: 700;
    }

    .mentorship-list-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      justify-content: flex-end;
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

      .student-list-head {
        display: none;
      }

      .student-list-item {
        grid-template-columns: 1fr;
      }

      .student-list-actions {
        justify-content: flex-start;
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
      .idp-member-dept {
        font-size: 0.75rem;
        color: #94a3b8;
      }
      .idp-member-status {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.25rem;
        flex-shrink: 0;
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
export class TrainingManagerProfileComponent implements OnInit, OnDestroy {
  readonly managerData = inject(TrainingManagerDataService);
  readonly branding = inject(LmsBrandingService);
  private readonly backend = inject(LmsBackendService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly _showWelcomeBanner = signal(true);
  readonly showWelcomeBanner = computed(() => this._showWelcomeBanner());
  private readonly _welcomeBannerLeaving = signal(false);
  readonly welcomeBannerLeaving = computed(() => this._welcomeBannerLeaving());
  readonly assessmentTypeOptions: ReadonlyArray<TrainingAssessmentType> = ['Quiz', 'Assignment'];
  readonly contentKindOptions: ReadonlyArray<TrainingContentKind> = ['Video', 'Assessment', 'Document', 'Scorm'];
  readonly questionTypeOptions: ReadonlyArray<TrainingQuestionType> = ['Multiple Choice', 'Short Answer', 'True or False', 'Matching'];
  readonly assignmentQuestionTypeOptions: ReadonlyArray<TrainingQuestionType> = ['Long Answer', 'Document Upload'];
  readonly createSectionOptions: ReadonlyArray<CreateSectionOption> = [
    { value: 'basics', label: 'Course Details', note: 'Title, deadline, category, and description.' },
    { value: 'content', label: 'Course Content', note: 'Ordered videos, assessments, and docs.' },
  ];
  private readonly createSectionOrder: ReadonlyArray<CreateCourseSection> = ['basics', 'content'];
  readonly navItems: ReadonlyArray<{ label: string; value: ManagerPanel }> = [
    { label: 'Dashboard', value: 'dashboard' },
    { label: 'Requested Training', value: 'requested-training' },
    { label: 'Courses', value: 'courses' },
    { label: 'Mentorship', value: 'mentorship' },
    { label: 'Student Enrollment', value: 'enrollment' },
    { label: 'IDP', value: 'idp' },
    { label: 'Performance', value: 'performance' },
    { label: 'Messages', value: 'messages' },
  ];

  readonly selectedPanel = signal<ManagerPanel>('dashboard');
  readonly managerSidebarCollapsed = signal(false);
  readonly sidebarScrolling = signal(false);
  private sidebarScrollTimeout: ReturnType<typeof setTimeout> | null = null;

  // EnrollmentStudent.status is only ever set by seed data and one enrollment-time transition
  // (Not Yet Started -> In Progress); it never advances to Completed as a student actually
  // finishes their courses. The dashboard's "Learning Activity" chart used to read that stale
  // field directly, so real completions never showed up. This prefetches each student's course
  // snapshot (same approach admin-profile.component.ts uses for its reports) so the chart can
  // derive live status from actual course completion instead.
  private readonly learningActivitySnapshotRequestedIds = new Set<string>();
  private readonly learningActivityCoursesById = signal<Record<string, StudentCourse[]>>({});
  private readonly learningActivityPrefetchEffect = effect(() => {
    for (const student of this.managerData.students()) {
      if (this.learningActivitySnapshotRequestedIds.has(student.id)) {
        continue;
      }

      this.learningActivitySnapshotRequestedIds.add(student.id);
      this.backend.getStudentSnapshot(student.id).subscribe({
        next: (snapshot) => {
          this.learningActivityCoursesById.update((current) => ({ ...current, [student.id]: snapshot.courses }));
        },
        error: () => {
          this.learningActivityCoursesById.update((current) => ({ ...current, [student.id]: [] }));
        },
      });
    }
  });

  private resolveStudentLearningStatus(student: EnrollmentStudent): LearningStatus {
    const courses = this.learningActivityCoursesById()[student.id];

    if (courses === undefined || !student.assignedOfferingIds.length) {
      return student.status;
    }

    const assignedCourseRecords = courses.filter(
      (course) => course.offeringId && student.assignedOfferingIds.includes(course.offeringId),
    );

    if (!assignedCourseRecords.length) {
      return student.status;
    }

    if (assignedCourseRecords.every((course) => course.completed)) {
      return 'Completed';
    }

    if (assignedCourseRecords.some((course) => course.completed || (course.progress ?? 0) > 0)) {
      return 'In Progress';
    }

    return 'Not Yet Started';
  }

  readonly learningActivityLive = computed<LearningActivityItem[]>(() => {
    const students = this.managerData.students();
    const statuses = students.map((student) => this.resolveStudentLearningStatus(student));
    const countByStatus = (status: LearningStatus) => statuses.filter((value) => value === status).length;

    return [
      { label: 'Completed', count: countByStatus('Completed'), color: '#10b981' },
      { label: 'In Progress', count: countByStatus('In Progress'), color: '#3b82f6' },
      { label: 'Not Yet Started', count: countByStatus('Not Yet Started'), color: '#f59e0b' },
    ];
  });

  readonly selectedCoursesView = signal<CoursesPanelView>('create');
  readonly selectedEnrollmentView = signal<EnrollmentPanelView>('students');
  readonly selectedManagerMessageSection = signal<ManagerMessageSection>(null);
  readonly selectedMentorshipSection = signal<MentorshipWorkspaceSection>('list');
  readonly selectedCreateSection = signal<CreateCourseSection>('basics');
  readonly assignmentSubmissionStatusFilter = signal<AssignmentSubmissionFilter>('All');
  readonly assignmentSubmissionSearchTerm = signal('');
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
  readonly thumbnailPreview = signal<string | null>(null);
  readonly thumbnailFileName = signal<string>('');
  readonly thumbnailUploading = signal(false);
  readonly selectedPublishedOfferingId = signal<string | null>(null);
  readonly selectedAssignmentSubmissionId = signal<string | null>(null);
  readonly selectedManagerMessageId = signal<string | null>(null);
  readonly selectedExternalTrainingRequestId = signal<string | null>(null);
  readonly createSectionDetailOpen = signal(false);
  readonly draggedContentIndex = signal<number | null>(null);
  readonly expandedContentIndex = signal<number | null>(null);
  readonly expandedQuestionByItem = signal<Record<number, number | null>>({});
  readonly assessmentStatusByItem = signal<Record<number, { tone: 'info' | 'success'; message: string }>>({});
  readonly submittedAssessmentByItem = signal<Record<number, boolean>>({});
  readonly addItemMenuOpen = signal(false);
  readonly managerMessageSent = signal(false);
  readonly topbarDropdown = signal<'notifications' | 'messages' | null>(null);
  readonly topbarProfileMenuOpen = signal(false);
  readonly availableSwitchRoles = signal<LoginRole[]>(
    readLmsSessionRecord()?.role === 'training-manager' ? ['student'] : [],
  );
  readonly switchingRole = signal(false);
  readonly uploadingProfileImage = signal(false);
  readonly selectedMentorshipReviewId = signal<string | null>(null);
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
  readonly selectedManagerMessage = computed(() => {
    const selectedId = this.selectedManagerMessageId();
    if (!selectedId) {
      return null;
    }

    return this.managerData.managerMessages().find((message) => message.id === selectedId) ?? null;
  });
  readonly dismissedTopbarNotificationIds = signal<Record<string, boolean>>({});
  readonly recentTopbarNotifications = computed(() =>
    this.managerData.externalTrainingRequestsForCurrentManager()
      .filter((request) => request.status === 'Pending Review')
      .filter((request) => !this.dismissedTopbarNotificationIds()[request.id])
      .slice(0, 4),
  );
  readonly recentTopbarMessages = computed(() =>
    this.managerData.managerMessages().filter((message) => message.unread).slice(0, 4),
  );
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
  readonly selectedExternalTrainingRequest = computed<ExternalTrainingRequestRecord | null>(() => {
    const requests = this.managerData.externalTrainingRequestsForCurrentManager();
    const selectedId = this.selectedExternalTrainingRequestId();

    if (!selectedId) {
      return null;
    }

    return requests.find((request) => request.id === selectedId) ?? null;
  });
  readonly selectedMentorshipReview = computed(() => {
    const selectedId = this.selectedMentorshipReviewId();
    if (!selectedId) {
      return this.managerData.mentorshipSubmissionsForCurrentManager()[0] ?? null;
    }

    return this.managerData.mentorshipSubmissionsForCurrentManager().find((submission) => submission.id === selectedId) ?? null;
  });
  readonly mentorshipAssignments = computed(() => this.managerData.mentorshipAssignmentsForCurrentManager());
  readonly mentorshipProfileSubmissionByMenteeId = computed(() => {
    const map = new Map<string, MentorshipSubmissionRecord>();
    for (const submission of this.managerData.mentorshipSubmissionsForCurrentManager()) {
      if (submission.assessmentId === 'mentorship-form-profile') {
        map.set(submission.studentId, submission);
      }
    }
    return map;
  });
  readonly editingEnrollmentStudent = computed(() => {
    const selectedId = this.editingEnrollmentStudentId();
    if (!selectedId) {
      return null;
    }

    return this.managerData.students().find((student) => student.id === selectedId) ?? null;
  });
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
  readonly managerInitials = computed(() =>
    this.managerData.profile().name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
  );
  readonly managerFirstName = computed(() => this.managerData.profile().name.trim().split(/\s+/)[0] || 'Manager');
  private welcomeBannerExitTimer: ReturnType<typeof setTimeout> | null = null;
  private welcomeBannerHideTimer: ReturnType<typeof setTimeout> | null = null;

  readonly courseForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    completionDeadline: new FormControl('', { nonNullable: true }),
    type: new FormControl<TrainingOfferingType>('Course', { nonNullable: true, validators: [Validators.required] }),
    category: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(12)] }),
    contentItems: new FormArray<ContentItemFormGroup>([]),
  });
  readonly enrollmentEditForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    surname: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    group: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    dateEnrolled: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    deadlineDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    activeStatus: new FormControl<'Active' | 'Inactive'>('Active', { nonNullable: true, validators: [Validators.required] }),
    department: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    role: new FormControl<'student' | 'manager' | 'admin'>('student', { nonNullable: true, validators: [Validators.required] }),
  });
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
  readonly managerMessageForm = new FormGroup({
    recipient: new FormControl('', { nonNullable: true, validators: [Validators.required, (control: AbstractControl): ValidationErrors | null => {
      const value = typeof control.value === 'string' ? control.value.trim().toLocaleLowerCase() : '';
      if (!value) return null;
      const known = new Set(this.managerData.managerMessageRecipients().map((r) => r.toLocaleLowerCase()));
      return known.has(value) ? null : { unknownRecipient: true };
    }] }),
    subject: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    message: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(12)] }),
  });
  readonly managerThreadReplyForm = new FormGroup({
    message: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
  });
  readonly mentorshipReviewForm = new FormGroup({
    feedback: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
  });
  readonly externalTrainingReviewForm = new FormGroup({
    feedback: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
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

  ngOnInit() {
    this.loadSwitchableRoles();
    this.managerData.refreshOwnIdentity();
    this.startWelcomeBannerSequence();
  }

  ngOnDestroy() {
    this.clearWelcomeBannerTimers();
    if (this.sidebarScrollTimeout) {
      clearTimeout(this.sidebarScrollTimeout);
    }
    if (this.assignWizardToastTimer) {
      clearTimeout(this.assignWizardToastTimer);
    }
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

  selectPanel(panel: ManagerPanel) {
    this.closeTopbarDropdown();
    this.closeTopbarProfileMenu();

    if (panel !== 'courses') {
      if (this.editingCourseId()) {
        this.resetCourseBuilder();
      }
      this.closeCreateSectionDetail();
      this.closeContentItemDetails();
      this.closePublishedOfferingDetail();
    }

    if (panel !== 'mentorship') {
      this.clearMentorshipReview();
    }

    if (panel !== 'requested-training') {
      this.closeExternalTrainingRequestReview();
    }

    if (panel === 'messages') {
      this.clearManagerMessageSection();
    } else {
      this.managerMessageSent.set(false);
      this.selectedManagerMessageSection.set(null);
      this.selectedManagerMessageId.set(null);
    }

    this.selectedPanel.set(panel);
  }

  toggleManagerSidebar() {
    this.managerSidebarCollapsed.update((collapsed) => !collapsed);
  }

  toggleTopbarDropdown(dropdown: 'notifications' | 'messages') {
    this.closeTopbarProfileMenu();
    this.topbarDropdown.set(this.topbarDropdown() === dropdown ? null : dropdown);
  }

  openTopbarNotificationsPanel() {
    this.closeTopbarDropdown();
    this.selectPanel('requested-training');
  }

  openTopbarNotificationPreview(requestId: string) {
    this.dismissedTopbarNotificationIds.update((current) => ({
      ...current,
      [requestId]: true,
    }));
    this.closeTopbarDropdown();
    this.selectPanel('requested-training');
    this.openExternalTrainingRequestReview(requestId);
  }

  openMessagesPanel() {
    this.closeTopbarDropdown();
    this.selectPanel('messages');
    this.selectManagerMessageSection('inbox');
  }

  openTopbarMessagePreview(messageId: string) {
    this.openMessagesPanel();
    this.openManagerMessage(messageId);
  }

  closeTopbarDropdown() {
    this.topbarDropdown.set(null);
  }

  openTopbarProfile() {
    this.closeTopbarDropdown();
    this.topbarProfileMenuOpen.update((isOpen) => !isOpen);
  }

  closeTopbarProfileMenu() {
    this.topbarProfileMenuOpen.set(false);
  }

  canSwitchToRole(role: LoginRole) {
    return this.availableSwitchRoles().includes(role);
  }

  openTopbarProfileDashboard() {
    this.closeTopbarProfileMenu();
    this.selectPanel('dashboard');
  }

  openTopbarProfileMessages() {
    this.closeTopbarProfileMenu();
    this.openMessagesPanel();
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

  selectManagerMessageSection(section: Exclude<ManagerMessageSection, null>) {
    this.managerMessageSent.set(false);
    this.selectedManagerMessageId.set(null);
    this.selectedManagerMessageSection.set(section);
  }

  clearManagerMessageSection() {
    this.managerMessageSent.set(false);
    this.managerThreadReplyForm.reset({ message: '' });
    this.selectedManagerMessageId.set(null);
    this.selectedManagerMessageSection.set(null);
  }

  openManagerMessage(messageId: string) {
    this.managerData.markManagerMessageRead(messageId);
    this.managerThreadReplyForm.reset({ message: '' });
    this.selectedManagerMessageId.set(messageId);
  }

  clearSelectedManagerMessage() {
    this.managerThreadReplyForm.reset({ message: '' });
    this.selectedManagerMessageId.set(null);
  }

  openMentorshipReview(submissionId: string) {
    this.selectedMentorshipReviewId.set(submissionId);
    const activeReview = this.managerData.mentorshipSubmissionsForCurrentManager().find((submission) => submission.id === submissionId) ?? null;
    this.mentorshipReviewForm.reset({ feedback: activeReview?.reviewerFeedback ?? '' });
  }

  viewMentorshipListSubmission(submissionId: string) {
    this.selectedMentorshipSection.set('submissions');
    this.openMentorshipReview(submissionId);
  }

  openExternalTrainingRequestReview(requestId: string) {
    this.selectedExternalTrainingRequestId.set(requestId);
    const activeRequest = this.managerData.externalTrainingRequestsForCurrentManager().find((request) => request.id === requestId) ?? null;
    this.externalTrainingReviewForm.reset({ feedback: activeRequest?.reviewerFeedback ?? '' });
  }

  closeExternalTrainingRequestReview() {
    this.selectedExternalTrainingRequestId.set(null);
    this.externalTrainingReviewForm.reset({ feedback: '' });
  }

  clearMentorshipReview() {
    this.selectedMentorshipReviewId.set(null);
    this.mentorshipReviewForm.reset({ feedback: '' });
  }

  applyMentorshipReview(status: 'Approved' | 'Needs Revision') {
    const activeReview = this.selectedMentorshipReview();
    if (!activeReview || this.mentorshipReviewForm.invalid) {
      this.mentorshipReviewForm.markAllAsTouched();
      return;
    }

    this.managerData.reviewMentorshipSubmission({
      submissionId: activeReview.id,
      reviewerName: this.managerData.profile().name,
      status,
      feedback: this.mentorshipReviewForm.controls.feedback.value.trim(),
    });
  }

  applyExternalTrainingRequestReview(status: 'Approved' | 'Needs Revision') {
    const activeRequest = this.selectedExternalTrainingRequest();
    if (!activeRequest || this.externalTrainingReviewForm.invalid) {
      this.externalTrainingReviewForm.markAllAsTouched();
      return;
    }

    const feedback = this.externalTrainingReviewForm.controls.feedback.value.trim();
    this.managerData.reviewExternalTrainingRequest({
      requestId: activeRequest.id,
      reviewerName: this.managerData.profile().name,
      status,
      feedback,
    });
    this.externalTrainingReviewForm.reset({ feedback });
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

  replyToSelectedManagerMessage() {
    const activeMessage = this.selectedManagerMessage();
    if (!activeMessage || this.managerThreadReplyForm.invalid) {
      this.managerThreadReplyForm.markAllAsTouched();
      return;
    }

    this.managerData.replyToManagerMessage(activeMessage.id, this.managerThreadReplyForm.controls.message.value.trim());
    this.managerThreadReplyForm.reset({ message: '' });
  }

  sendManagerMessage() {
    if (this.managerMessageForm.invalid) {
      this.managerMessageForm.markAllAsTouched();
      return;
    }

    this.managerData.sendManagerMessage(
      this.managerMessageForm.controls.recipient.value,
      this.managerMessageForm.controls.subject.value,
      this.managerMessageForm.controls.message.value,
    );
    this.managerMessageForm.reset({ recipient: '', subject: '', message: '' });
    this.managerMessageSent.set(true);
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

  formatMentorshipMentorDisplay(assignment: Pick<MentorshipAssignmentRecord, 'mentorName' | 'mentorSurname'>) {
    const fullName = `${assignment.mentorName} ${assignment.mentorSurname}`.trim();
    return fullName || 'Pending student entry';
  }

  selectEnrollmentView(view: EnrollmentPanelView) {
    this.selectedEnrollmentView.set(view);
  }

  deleteMentorshipAssignment(_assignment: MentorshipAssignmentRecord) {}

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

  openPublishedOffering(offering: TrainingOffering) {
    this.selectedPublishedOfferingId.set(offering.id);
  }

  handleOverlayEscape() {
    if (this.topbarDropdown()) {
      this.closeTopbarDropdown();
      return;
    }

    if (this.topbarProfileMenuOpen()) {
      this.closeTopbarProfileMenu();
      return;
    }

    if (this.selectedPanel() === 'enrollment' && this.editingEnrollmentStudent()) {
      this.closeEnrollmentEdit();
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

    if (this.selectedPanel() === 'performance' && this.selectedKpiStudentId()) {
      this.clearKpiStudent();
    }
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
    const confirmed = this.document.defaultView?.confirm(
      `Delete "${offering.title}"? This will remove the course from the created courses list and learners will no longer be able to access it.`,
    ) ?? true;

    if (!confirmed) {
      return;
    }

    const deleted = this.managerData.deleteOffering(offering.id);
    if (deleted) {
      this.closePublishedOfferingDetail();
    }
  }

  selectCreateSection(section: CreateCourseSection) {
    this.openCreateSection(section);
  }

  openCreateSection(section: CreateCourseSection) {
    if (section !== 'content') {
      this.closeContentItemDetails();
    }

    this.selectedCreateSection.set(section);
    this.createSectionDetailOpen.set(true);
  }

  openCreateSectionFromKeyboard(section: CreateCourseSection, event: Event) {
    event.preventDefault();
    this.openCreateSection(section);
  }

  closeCreateSectionDetail() {
    this.closeContentItemDetails();
    this.createSectionDetailOpen.set(false);
  }

  isCreateSectionOpen(section: CreateCourseSection) {
    return this.selectedCreateSection() === section;
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

  activeCreateSectionLabel() {
    return this.createSectionOptions.find((section) => section.value === this.selectedCreateSection())?.label ?? 'Create section';
  }

  activeCreateSectionHeading() {
    switch (this.selectedCreateSection()) {
      case 'basics':
        return 'Start with the core setup';
      case 'content':
        return 'Add content now or later';
    }
  }

  activeCreateSectionDescription() {
    switch (this.selectedCreateSection()) {
      case 'basics':
        return 'Capture the course name, schedule, type, thumbnail, and learner-facing description before publishing.';
      case 'content':
        return 'Build the learning flow as cards when you are ready. You can also publish first and return later to add videos, documents, SCORM packages, and assessments.';
    }
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

  // Uploads go to the account's linked directory record, the same one the student and admin
  // views read from, so the picture shows up consistently everywhere. Uses the base64-JSON
  // upload route rather than the direct-to-storage one — that path depends on the storage
  // bucket's CORS policy already being set up, which isn't guaranteed at any given moment.
  onManagerProfileImageSelected(event: Event) {
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
        this.managerData.setOwnProfileImage(url);
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

  clearManagerProfileImage() {
    this.managerData.setOwnProfileImage(null);
    this.backend.updateMyProfileImage({ profileImageUrl: null, profileImageDataUrl: null }).subscribe();
  }

  logout() {
    clearLmsAuthSession();
    this.router.navigate(['/']);
  }

  activityWidth(activity: LearningActivityItem) {
    const maxCount = Math.max(...this.learningActivityLive().map((item) => item.count), 1);
    return (activity.count / maxCount) * 100;
  }

  activityHeight(activity: LearningActivityItem) {
    return this.activityWidth(activity);
  }

  activityMaxCount() {
    return Math.max(...this.learningActivityLive().map((item) => item.count), 1);
  }

  activityMidpoint() {
    return Math.max(1, Math.round(this.activityMaxCount() / 2));
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
      const titleInput = this.document.querySelector<HTMLInputElement>(`input[data-content-item-title="${index}"]`);
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

  openEnrollmentEdit(_student: EnrollmentStudent) {
    // Managers are intentionally restricted from editing student details in enrollment.
    this.editingEnrollmentStudentId.set(null);
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

  closeEnrollmentEdit() {
    this.editingEnrollmentStudentId.set(null);
  }

  closeEnrollmentGroupEdit() {
    this.editingEnrollmentGroupName.set(null);
    this.selectedStudentsForEditedGroup.set({});
    this.selectedStudentsForRemovalFromEditedGroup.set({});
  }

  saveEnrollmentEdit() {
    // Managers are intentionally restricted from editing student details in enrollment.
    this.closeEnrollmentEdit();
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

  // ── IDP ────────────────────────────────────────────────────────────────
  readonly selectedIdpStudentId = signal<string | null>(null);
  readonly idpSaved = signal(false);
  readonly idpEditMode = signal(false);
  readonly idpMemberSearchTerm = signal('');
  private readonly idpEntriesByStudent = this.managerData.idpEntriesByStudent;

  readonly filteredIdpMembers = computed(() => {
    const query = this.idpMemberSearchTerm().trim().toLowerCase();
    const students = this.managerData.students();

    if (!query) {
      return students;
    }

    return students.filter((student) =>
      [student.name, student.surname, `${student.name} ${student.surname}`, student.jobTitle, student.department, student.group]
        .some((value) => (value ?? '').toLowerCase().includes(query)),
    );
  });

  readonly selectedIdpStudent = computed(() => {
    const id = this.selectedIdpStudentId();
    return id ? this.managerData.students().find((s) => s.id === id) ?? null : null;
  });

  readonly savedIdpEntries = computed(() => {
    const id = this.selectedIdpStudentId();
    return id ? (this.idpEntriesByStudent()[id] ?? []) : [];
  });

  readonly idpHasSavedEntries = computed(() => this.savedIdpEntries().length > 0);

  private createIdpEntryGroup(): IdpEntryFormGroup {
    return new FormGroup({
      developmentNeed: new FormControl<string | null>(''),
      plannedAction: new FormControl<string | null>(''),
      supportRequired: new FormControl<string | null>(''),
      dateCaptured: new FormControl<string | null>(this.todayIsoDate()),
      targetDate: new FormControl<string | null>(''),
      status: new FormControl<IdpStatus | null>('Not Started'),
    }) as IdpEntryFormGroup;
  }

  private todayIsoDate() {
    // Built from local getFullYear/getMonth/getDate rather than toISOString() (which is UTC) — a
    // manager filling this form out in the evening west of UTC, or early morning east of UTC, would
    // otherwise get a default date that's a day off from what their own calendar/clock shows.
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  readonly idpForm = new FormGroup({
    entries: new FormArray<IdpEntryFormGroup>([this.createIdpEntryGroup()]),
  });

  idpEntriesControls(): IdpEntryFormGroup[] {
    return this.idpForm.controls.entries.controls as IdpEntryFormGroup[];
  }

  idpEntryCountForStudent(studentId: string): number {
    return this.idpEntriesByStudent()[studentId]?.length ?? 0;
  }

  private loadIdpFormForStudent(studentId: string) {
    const entriesArray = this.idpForm.controls.entries;
    while (entriesArray.length > 0) entriesArray.removeAt(0);
    const saved = this.idpEntriesByStudent()[studentId];
    if (saved?.length) {
      for (const entry of saved) {
        const g = this.createIdpEntryGroup();
        g.setValue(entry);
        entriesArray.push(g);
      }
    } else {
      entriesArray.push(this.createIdpEntryGroup());
    }
  }

  selectIdpStudent(studentId: string) {
    this.selectedIdpStudentId.set(studentId);
    this.loadIdpFormForStudent(studentId);
    // start in read-only if entries already saved, else jump straight to form
    const hasSaved = (this.idpEntriesByStudent()[studentId]?.length ?? 0) > 0;
    this.idpEditMode.set(!hasSaved);
    this.idpSaved.set(false);
  }

  clearIdpStudent() {
    this.selectedIdpStudentId.set(null);
    this.idpEditMode.set(false);
    this.idpSaved.set(false);
  }

  openIdpEdit() {
    const id = this.selectedIdpStudentId();
    if (id) this.loadIdpFormForStudent(id);
    this.idpEditMode.set(true);
  }

  cancelIdpEdit() {
    const id = this.selectedIdpStudentId();
    if (id) this.loadIdpFormForStudent(id);
    this.idpEditMode.set(false);
    this.idpSaved.set(false);
  }

  addIdpEntry() {
    this.idpForm.controls.entries.push(this.createIdpEntryGroup());
  }

  removeIdpEntry(index: number) {
    this.idpForm.controls.entries.removeAt(index);
  }

  saveIdpEntries() {
    const studentId = this.selectedIdpStudentId();
    if (!studentId) return;
    const entries = this.idpForm.controls.entries.controls.map((g) => ({
      developmentNeed: g.controls.developmentNeed.value ?? '',
      plannedAction: g.controls.plannedAction.value ?? '',
      supportRequired: g.controls.supportRequired.value ?? '',
      dateCaptured: g.controls.dateCaptured.value ?? '',
      targetDate: g.controls.targetDate.value ?? '',
      status: (g.controls.status.value ?? 'Not Started') as IdpStatus,
    }));
    this.managerData.setIdpEntriesForStudent(studentId, entries);
    this.idpEditMode.set(false);
    this.idpSaved.set(true);
    setTimeout(() => this.idpSaved.set(false), 3000);
  }

  // ── Performance / KPI ─────────────────────────────────────────────────
  readonly kpiScoreOptions: ReadonlyArray<{ value: StudentKpiScore; label: string }> = [
    { value: 1, label: '1 - Unsatisfactory' },
    { value: 2, label: '2 - Needs Improvement' },
    { value: 3, label: '3 - Meets Expectations' },
    { value: 4, label: '4 - Exceeds Expectations' },
  ];

  // A rating saved under the old 5-point scale (before it moved to this 4-point one) can still
  // carry a raw stored value of 5 — clamped to 4 here rather than rewriting that historical data,
  // so it reads as the new top rating instead of falling through to "Not scored" for having no
  // matching option any more.
  kpiScoreLabel(score: StudentKpiScore | null): string {
    const clamped = score === null ? null : (Math.min(score, 4) as StudentKpiScore);
    return this.kpiScoreOptions.find((option) => option.value === clamped)?.label ?? 'Not scored';
  }

  readonly selectedKpiStudentId = signal<string | null>(null);
  readonly kpiSaved = signal(false);
  readonly kpiEditMode = signal(false);
  readonly kpiMemberSearchTerm = signal('');
  private readonly kpiEntriesByStudent = this.managerData.kpiEntriesByStudent;

  // Which year's table is currently on screen for the selected student — defaults to the current
  // (editable) year whenever a student is (re)selected; the year selector switches this to browse
  // a past, permanently read-only year without touching the current year's live data at all.
  readonly selectedKpiYear = signal<number | null>(null);
  readonly isViewingCurrentKpiYear = computed(() => this.selectedKpiYear() === this.managerData.currentKpiYear());

  readonly kpiYearPromptOpen = signal(false);
  readonly kpiYearPromptValue = signal(new Date().getFullYear() + 1);
  readonly kpiYearOpening = signal(false);
  readonly kpiYearOpenError = signal<string | null>(null);

  readonly filteredKpiMembers = computed(() => {
    const query = this.kpiMemberSearchTerm().trim().toLowerCase();
    const students = this.managerData.students();

    if (!query) {
      return students;
    }

    return students.filter((student) =>
      [student.name, student.surname, `${student.name} ${student.surname}`, student.jobTitle, student.department, student.group]
        .some((value) => (value ?? '').toLowerCase().includes(query)),
    );
  });

  readonly selectedKpiStudent = computed(() => {
    const id = this.selectedKpiStudentId();
    return id ? this.managerData.students().find((s) => s.id === id) ?? null : null;
  });

  readonly savedKpiEntries = computed(() => {
    const id = this.selectedKpiStudentId();
    const year = this.selectedKpiYear();
    if (!id || year === null) {
      return [];
    }

    return this.managerData.kpiEntriesForStudentYear(id, year);
  });

  readonly kpiHasSavedEntries = computed(() => this.savedKpiEntries().length > 0);

  readonly savedKpiTotalWeight = computed(() =>
    this.savedKpiEntries().reduce((total, entry) => total + (entry.weight || 0), 0),
  );

  // ── Performance Gap Analysis ────────────────────────────────────────────
  // Every saved KPI rated 1 or 2 (on Overall Scoring, the authoritative final rating) needs a
  // documented plan to close the gap. Reads from savedKpiEntries — the server-confirmed table —
  // rather than the "Edit table" form's live draft, since the two are independent: a manager can
  // record a gap plan without opening the main table for editing at all.
  readonly kpiGapEntries = computed(() =>
    this.savedKpiEntries().filter((entry) => entry.overallScoring !== null && entry.overallScoring <= 2),
  );

  readonly gapAnalysisDraft = signal<Record<string, { initiative: string; comments: string; targetDate: string }>>({});
  readonly gapAnalysisSaving = signal(false);
  readonly gapAnalysisSaved = signal(false);
  readonly gapAnalysisError = signal<string | null>(null);

  // Rehydrates the draft from whatever's currently saved for this student/year. Called
  // imperatively at the same points the main KPI form is (re)loaded — selecting a student,
  // switching years, right after a table save, right after opening a new KPI year — rather than
  // from an effect reacting to the live entries signal, so an in-progress edit here can't get
  // silently discarded by an unrelated background bootstrap poll the way an earlier KPI bug did.
  private loadGapAnalysisDraft(studentId: string, year: number) {
    const draft: Record<string, { initiative: string; comments: string; targetDate: string }> = {};
    for (const entry of this.managerData.kpiEntriesForStudentYear(studentId, year)) {
      if (entry.overallScoring !== null && entry.overallScoring <= 2) {
        draft[entry.id] = { initiative: entry.gapInitiative, comments: entry.gapComments, targetDate: entry.gapTargetDate };
      }
    }

    this.gapAnalysisDraft.set(draft);
    this.gapAnalysisSaved.set(false);
    this.gapAnalysisError.set(null);
  }

  // Plain `record[id]` indexing types as always-present in this codebase's TS config (no
  // noUncheckedIndexedAccess), even though a given entry id may genuinely have no staged draft
  // yet — using `?.`/`??` on it is therefore a type error in a template (NG8102: "always
  // truthy") even though it's exactly the right runtime check. `in` sidesteps that by not
  // narrowing on the lookup's (inaccurate) static type at all.
  private stagedGapDraftFor(entryId: string) {
    const draft = this.gapAnalysisDraft();
    return entryId in draft ? draft[entryId] : null;
  }

  gapDraftFieldValue(entry: StudentKpiEntry, field: 'initiative' | 'comments' | 'targetDate'): string {
    const staged = this.stagedGapDraftFor(entry.id);
    if (staged) {
      return staged[field];
    }

    return field === 'initiative' ? entry.gapInitiative : field === 'comments' ? entry.gapComments : entry.gapTargetDate;
  }

  updateGapDraftField(entryId: string, field: 'initiative' | 'comments' | 'targetDate', value: string) {
    this.gapAnalysisDraft.update((current) => {
      const existing = this.stagedGapDraftFor(entryId) ?? { initiative: '', comments: '', targetDate: '' };
      return { ...current, [entryId]: { ...existing, [field]: value } };
    });
    this.gapAnalysisSaved.set(false);
    this.gapAnalysisError.set(null);
  }

  async saveGapAnalysis() {
    const studentId = this.selectedKpiStudentId();
    if (!studentId || this.gapAnalysisSaving()) {
      return;
    }

    const updates = this.kpiGapEntries().map((entry) => ({
      id: entry.id,
      gapInitiative: this.gapDraftFieldValue(entry, 'initiative'),
      gapComments: this.gapDraftFieldValue(entry, 'comments'),
      gapTargetDate: this.gapDraftFieldValue(entry, 'targetDate'),
    }));

    if (!updates.length) {
      return;
    }

    this.gapAnalysisSaving.set(true);
    this.gapAnalysisError.set(null);
    const success = await this.managerData.updateKpiGapAnalysis(studentId, updates);
    this.gapAnalysisSaving.set(false);

    if (success) {
      this.gapAnalysisSaved.set(true);
      setTimeout(() => this.gapAnalysisSaved.set(false), 3000);
    } else {
      this.gapAnalysisError.set('Could not save the performance gap analysis — please try again.');
    }
  }

  // Weight-weighted average of Overall Scoring across every KPI that's actually been given a
  // score — unscored rows are excluded from both the numerator and denominator so a still-blank
  // KPI doesn't silently drag the total down. Falls back to the employee's own self-score until
  // the manager finalizes an Overall score, so a student who rates themselves actually sees that
  // reflected here instead of the total staying "Not yet scored".
  readonly savedKpiOverallWeightedRating = computed(() => this.computeKpiOverallWeightedRating(this.savedKpiEntries()));

  private computeKpiOverallWeightedRating(entries: ReadonlyArray<{ weight: number; overallScoring: StudentKpiScore | null; employeeScoring: StudentKpiScore | null }>): number | null {
    // Clamped to 4 for the same reason as kpiScoreLabel above — a legacy 5 shouldn't be able to
    // pull this average past the current scale's max.
    const scoredEntries = entries
      .map((entry) => ({ weight: entry.weight, score: this.clampKpiScoreToScale(entry.overallScoring ?? entry.employeeScoring) }))
      .filter((entry) => entry.score !== null && entry.weight > 0);
    const totalWeight = scoredEntries.reduce((total, entry) => total + entry.weight, 0);
    if (!totalWeight) {
      return null;
    }

    const weightedSum = scoredEntries.reduce((total, entry) => total + entry.weight * (entry.score ?? 0), 0);
    return weightedSum / totalWeight;
  }

  private clampKpiScoreToScale(score: StudentKpiScore | null): number | null {
    return score === null ? null : Math.min(score, 4);
  }

  formatKpiOverallRating(rating: number | null): string {
    return rating === null ? 'Not yet scored' : `${rating.toFixed(1)} / 4`;
  }

  // Not computed(): FormControl values aren't signals, so these are recalculated on every change
  // detection pass instead — cheap enough for a handful of rows, and CD already runs on every
  // keystroke in this form (OnPush still checks a component when a DOM event fires in its own
  // template, which every Weight/Scoring edit does).
  kpiTotalWeight(): number {
    return this.kpiEntriesControls().reduce((total, control) => total + (control.controls.weight.value ?? 0), 0);
  }

  kpiOverallWeightedRating(): number | null {
    const entries = this.kpiEntriesControls().map((control) => ({
      weight: control.controls.weight.value ?? 0,
      overallScoring: control.controls.overallScoring.value,
      employeeScoring: control.controls.employeeScoring.value,
    }));
    return this.computeKpiOverallWeightedRating(entries);
  }

  private createKpiEntryGroup(): KpiEntryFormGroup {
    return new FormGroup({
      id: new FormControl<string | null>(''),
      keyResultArea: new FormControl<string | null>(''),
      kpi: new FormControl<string | null>(''),
      weight: new FormControl<number | null>(0),
      target: new FormControl<string | null>(''),
      actual: new FormControl<string | null>(''),
      comments: new FormControl<string | null>(''),
      overallScoring: new FormControl<StudentKpiScore | null>(null),
      managerScoring: new FormControl<StudentKpiScore | null>(null),
      employeeScoring: new FormControl<StudentKpiScore | null>(null),
      measure: new FormControl<string | null>(''),
      dateOfReview: new FormControl<string | null>(this.todayIsoDate()),
      gapInitiative: new FormControl<string | null>(''),
      gapComments: new FormControl<string | null>(''),
      gapTargetDate: new FormControl<string | null>(''),
    }) as KpiEntryFormGroup;
  }

  readonly kpiForm = new FormGroup({
    entries: new FormArray<KpiEntryFormGroup>([this.createKpiEntryGroup()]),
  });

  kpiEntriesControls(): KpiEntryFormGroup[] {
    return this.kpiForm.controls.entries.controls as KpiEntryFormGroup[];
  }

  kpiEntryCountForStudent(studentId: string): number {
    return this.kpiEntriesByStudent()[studentId]?.length ?? 0;
  }

  private loadKpiFormForStudent(studentId: string) {
    const entriesArray = this.kpiForm.controls.entries;
    while (entriesArray.length > 0) entriesArray.removeAt(0);
    const saved = this.kpiEntriesByStudent()[studentId];
    if (saved?.length) {
      for (const entry of saved) {
        const g = this.createKpiEntryGroup();
        // overallScoring is clamped to the current 4-point scale before populating the form: the
        // editable <select> only lists options 1-4, so a legacy row stored under the old 5-point
        // scale would otherwise set a value with no matching <option>, rendering as blank/unselected
        // in edit mode even though it shows correctly (clamped to 4) in the read-only view via
        // kpiScoreLabel above. managerScoring/employeeScoring are left untouched — they're not
        // editable here, just round-tripped as-is.
        g.setValue({
          ...entry,
          overallScoring: entry.overallScoring === null ? null : (Math.min(entry.overallScoring, 4) as StudentKpiScore),
        });
        entriesArray.push(g);
      }
    } else {
      entriesArray.push(this.createKpiEntryGroup());
    }
  }

  selectKpiStudent(studentId: string) {
    this.selectedKpiStudentId.set(studentId);
    const year = this.managerData.currentKpiYear();
    this.selectedKpiYear.set(year);
    this.loadKpiFormForStudent(studentId);
    this.loadGapAnalysisDraft(studentId, year);
    // start in read-only if entries already saved, else jump straight to form
    const hasSaved = (this.kpiEntriesByStudent()[studentId]?.length ?? 0) > 0;
    this.kpiEditMode.set(!hasSaved);
    this.kpiSaved.set(false);
  }

  clearKpiStudent() {
    this.selectedKpiStudentId.set(null);
    this.selectedKpiYear.set(null);
    this.kpiEditMode.set(false);
    this.kpiSaved.set(false);
    this.gapAnalysisDraft.set({});
  }

  // Switches which year's table is on screen for the selected student. Always drops out of edit
  // mode — editing only ever applies to the current year, and re-entering it after landing back
  // on the current year should be a deliberate "Edit table" click, not implicit from browsing.
  selectKpiYear(year: number) {
    this.selectedKpiYear.set(year);
    this.kpiEditMode.set(false);
    this.kpiSaved.set(false);

    const studentId = this.selectedKpiStudentId();
    if (studentId) {
      // Best-effort with whatever's cached right now (the current year always is); a past year
      // may not be yet, so reload the draft again once the fetch below actually lands it — but
      // only if the year selector hasn't since moved on to somewhere else.
      this.loadGapAnalysisDraft(studentId, year);
      void this.managerData.fetchKpiEntriesForStudentYear(studentId, year).then(() => {
        if (this.selectedKpiStudentId() === studentId && this.selectedKpiYear() === year) {
          this.loadGapAnalysisDraft(studentId, year);
        }
      });
    }
  }

  openKpiEdit() {
    if (!this.isViewingCurrentKpiYear()) {
      return;
    }

    const id = this.selectedKpiStudentId();
    if (id) this.loadKpiFormForStudent(id);
    this.kpiEditMode.set(true);
  }

  openKpiYearPromptDialog() {
    this.kpiYearPromptValue.set(this.managerData.currentKpiYear() + 1);
    this.kpiYearOpenError.set(null);
    this.kpiYearPromptOpen.set(true);
  }

  closeKpiYearPromptDialog() {
    this.kpiYearPromptOpen.set(false);
  }

  async confirmOpenKpiYear() {
    const year = this.kpiYearPromptValue();
    const currentYear = this.managerData.currentKpiYear();
    if (!Number.isInteger(year) || year <= currentYear) {
      this.kpiYearOpenError.set(`Year must be a whole number after ${currentYear}.`);
      return;
    }

    this.kpiYearOpening.set(true);
    const result = await this.managerData.openKpiYear(year);
    this.kpiYearOpening.set(false);

    if (result.success) {
      this.kpiYearPromptOpen.set(false);
      // The selected student's table just moved to a new (empty-scored, copied-forward) current
      // year — reload it so the on-screen table reflects that instead of stale pre-open data.
      const studentId = this.selectedKpiStudentId();
      if (studentId) {
        this.selectedKpiYear.set(year);
        this.kpiEditMode.set(false);
        this.loadGapAnalysisDraft(studentId, year);
      }
    } else {
      this.kpiYearOpenError.set(result.message);
    }
  }

  cancelKpiEdit() {
    const id = this.selectedKpiStudentId();
    if (id) this.loadKpiFormForStudent(id);
    this.kpiEditMode.set(false);
    this.kpiSaved.set(false);
  }

  addKpiEntry() {
    this.kpiForm.controls.entries.push(this.createKpiEntryGroup());
  }

  removeKpiEntry(index: number) {
    this.kpiForm.controls.entries.removeAt(index);
  }

  saveKpiEntries() {
    const studentId = this.selectedKpiStudentId();
    if (!studentId) return;
    // Backstop for the disabled Save button above — a plain HTML <form> can still submit on
    // Enter pressed inside a text field even while its submit button is disabled, so the actual
    // 100%-total requirement has to be enforced here too, not just via [disabled].
    if (this.kpiTotalWeight() !== 100) return;
    const entries = this.kpiForm.controls.entries.controls.map((g) => ({
      id: g.controls.id.value?.trim() || '',
      keyResultArea: g.controls.keyResultArea.value ?? '',
      kpi: g.controls.kpi.value ?? '',
      weight: g.controls.weight.value ?? 0,
      target: g.controls.target.value ?? '',
      actual: g.controls.actual.value ?? '',
      comments: g.controls.comments.value ?? '',
      overallScoring: g.controls.overallScoring.value ?? null,
      managerScoring: g.controls.managerScoring.value ?? null,
      employeeScoring: g.controls.employeeScoring.value ?? null,
      measure: g.controls.measure.value ?? '',
      dateOfReview: g.controls.dateOfReview.value ?? '',
      gapInitiative: g.controls.gapInitiative.value ?? '',
      gapComments: g.controls.gapComments.value ?? '',
      gapTargetDate: g.controls.gapTargetDate.value ?? '',
    }));
    this.managerData.setKpiEntriesForStudent(studentId, entries);
    this.kpiEditMode.set(false);
    this.kpiSaved.set(true);
    setTimeout(() => this.kpiSaved.set(false), 3000);
    // Which rows now qualify as a "gap" may have just changed (a row's Overall Scoring could
    // have moved above or below the 1-2 threshold) — refresh the draft to match.
    const year = this.selectedKpiYear();
    if (year !== null) {
      this.loadGapAnalysisDraft(studentId, year);
    }
  }
}
