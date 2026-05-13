import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
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
  ManagerPanel,
  MentorshipAssignmentRecord,
  TrainingAssessmentType,
  TrainingManagerDataService,
  TrainingMatchingPair,
  TrainingOffering,
  TrainingOfferingType,
  TrainingQuestionType,
} from './training-manager-data.service';
import { LmsBrandingService } from './lms-branding.service';
import { LmsBackendService } from './lms-backend.service';

type CoursesPanelView = 'create' | 'created' | 'submissions';
type AssignmentSubmissionFilter = 'All' | 'Pending Review' | 'Approved' | 'Needs Revision';
type EnrollmentPanelView = 'students' | 'groups';
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
  requiresAcknowledgement: FormControl<boolean>;
  questions: FormArray<AssessmentQuestionFormGroup>;
}>;

type PowerPointPreviewState = {
  fileName: string;
  message: string;
};

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
      [style.--surface-tone]="branding.currentTheme().surface">
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
          <span class="manager-avatar">{{ managerInitials() }}</span>
          <div>
            <div class="manager-user-name">{{ managerData.profile().name }}</div>
            <div class="manager-user-copy">{{ managerData.profile().role }}</div>
          </div>
        </div>
      </header>

      <div class="manager-layout">
        <aside class="manager-sidebar" aria-label="Training manager navigation">
          @for (item of navItems; track item.value) {
            <button type="button" [class.active]="selectedPanel() === item.value" (click)="selectPanel(item.value)">
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
                }
              </span>
              <span class="manager-nav-label">{{ item.label }}</span>
            </button>
          }

          <button type="button" class="logout" (click)="logout()">Log out</button>
        </aside>

        <main class="manager-main-panel">
          @if (selectedPanel() === 'dashboard') {
            <section class="manager-panel">
              <div class="section-heading-block">
                <p class="eyebrow">Dashboard</p>
                <h1>Training manager overview</h1>
                <p class="section-copy">Monitor student registrations, published courses, and overall learning activity.</p>
              </div>

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

                  @for (activity of managerData.learningActivity(); track activity.label) {
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
                  @for (activity of managerData.learningActivity(); track activity.label) {
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
              <div class="section-heading-block">
                <p class="eyebrow">Courses</p>
                <h1>Create courses and programmes</h1>
                <p class="section-copy">Build new learning items for students, then publish them for enrollment.</p>
              </div>

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

                        <button type="button" class="course-studio-back-link" (click)="editingCourseId() ? cancelCourseEditing() : selectCoursesView('created')">Back</button>

                        <div class="course-studio-sidebar-copy">
                          <strong>{{ courseForm.controls.title.value || 'New course' }}</strong>
                          <span>{{ editingCourseId() ? 'Update the existing course flow and save your changes.' : 'Build the course structure and publish when you are ready.' }}</span>
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

                          @if (contentItemsArray.length > 1) {
                            <p class="course-studio-unit-ordering-note">Drag units in this list to reorder the course flow.</p>
                          }
                        </div>
                      </aside>

                      <div class="course-studio-workspace">
                        <div class="course-studio-workspace-header">
                          <div>
                            <h2>{{ courseStudioWorkspaceTitle() }}</h2>
                            <p>{{ courseStudioWorkspaceSubtitle() }}</p>
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
                                <span class="required-label">Completion Deadline <span class="required-marker" aria-hidden="true">*</span></span>
                                <input formControlName="completionDeadline" type="date" />
                                @if (courseForm.controls.completionDeadline.touched && courseForm.controls.completionDeadline.invalid) {
                                  <span class="field-error">Choose a completion deadline.</span>
                                }
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
                                <input type="file" accept="image/*" (change)="onThumbnailSelected($event)" />
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
                                  <span class="field-hint">{{ assessmentTypeHelperText(activeContentItemIndex()) }}</span>
                                </label>

                                <label title="Set the minimum percentage learners must achieve to pass this assessment.">
                                  <span class="required-label">Pass Mark (%) <span class="required-marker" aria-hidden="true">*</span></span>
                                  <input formControlName="passMarkPercentage" type="number" min="1" max="100" />
                                  <span class="field-hint">Use a percentage target for quiz pass/fail checks and assignment scoring guidance.</span>
                                </label>

                                <label title="Set how many times a learner can submit or retry this assessment.">
                                  <span class="required-label">Attempts Allowed <span class="required-marker" aria-hidden="true">*</span></span>
                                  <input formControlName="maxAttempts" type="number" min="1" step="1" />
                                  <span class="field-hint">After the final attempt, the learner can no longer retry this assessment.</span>
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
                                                  <h5>Set the available options and correct answers</h5>
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
                                                  <h5>Choose the correct answer</h5>
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
                                                  <h5>Build the drag-and-drop matches</h5>
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
                                    <span>Confirm all questions together once the assessment is ready.</span>
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
                                  <input class="course-studio-upload-input" [accept]="activeItem.controls.kind.value === 'Video' ? 'video/*' : '.pdf,.doc,.docx,.ppt,.pptx,.xlsx,.txt'" type="file" (change)="onContentFileSelected(activeContentItemIndex(), $event)" />
                                </label>

                                <label class="course-studio-upload-card course-studio-upload-card-link" title="Paste a hosted link if this item lives online.">
                                  <span class="course-studio-upload-icon" aria-hidden="true">
                                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none"><path d="M10 13a4 4 0 0 0 5.66 0l2.12-2.12a4 4 0 1 0-5.66-5.66L10.9 6.44" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 11a4 4 0 0 0-5.66 0l-2.12 2.12a4 4 0 1 0 5.66 5.66l1.22-1.22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                  </span>
                                  <strong>Use a link</strong>
                                  <span class="course-studio-upload-caption">Paste a hosted link for this unit.</span>
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
                                    <span class="create-section-status-pill">Open in app</span>
                                  </div>

                                  <powerpoint-window
                                    [viewerTitle]="'PowerPoint file for ' + presentationPreview.fileName"
                                    [sourceDataUrl]="activeItem.controls.uploadedFileDataUrl.value || null"
                                    [sourceFileName]="presentationPreview.fileName"
                                    [emptyMessage]="presentationPreview.message"></powerpoint-window>
                                </section>
                              }

                              @if (activeItem.controls.kind.value === 'Document') {
                                <label class="assessment-drag-toggle form-grid-span-two" [class.assessment-drag-toggle-active]="activeItem.controls.requiresAcknowledgement.value">
                                  <input formControlName="requiresAcknowledgement" type="checkbox" />
                                  <span>Require learners to open this document in the LMS and acknowledge that they have read it.</span>
                                </label>
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
                          <span class="form-action-copy">{{ courseForm.invalid ? 'Complete the required course details before publishing.' : (editingCourseId() ? 'Save your updates when the course flow looks right.' : 'Publish when your course setup is ready. You can keep adding units later.') }}</span>
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
                          (open)="openPublishedOffering(offering)"
                          (enroll)="goToEnrollmentForOffering(offering)" />
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
                <p class="eyebrow">Mentorship</p>
                <h1>Mentorship workspace</h1>
                <p class="section-copy">Manage mentorship assignments and submissions from one workspace.</p>
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
                      <span>Assign mentorship to listed employees and manage mentor pairings.</span>
                    </div>
                    <div class="student-chip-row">
                      <button type="button" class="builder-secondary-btn" (click)="openBulkAssignMentorship()">Bulk Assign</button>
                      <button type="button" class="assign-btn" (click)="openAssignMentorship()">Assign Mentorship</button>
                    </div>
                  </div>

                  <div class="mentorship-list-table" role="table" aria-label="Mentorship assignment list">
                    <div class="mentorship-list-head" role="row">
                      <span role="columnheader">Mentee Name</span>
                      <span role="columnheader">Surname</span>
                      <span role="columnheader">Mentorship Start Date</span>
                      <span role="columnheader">Job Title</span>
                      <span role="columnheader">Mentor Name and Surname</span>
                      <span role="columnheader">Edit</span>
                      <span role="columnheader">Delete</span>
                    </div>

                    @for (assignment of mentorshipAssignments(); track assignment.id) {
                      <article class="mentorship-list-item" role="row">
                        <span class="mentorship-list-cell mentorship-list-cell-strong" role="cell">{{ assignment.menteeName }}</span>
                        <span class="mentorship-list-cell" role="cell">{{ assignment.menteeSurname }}</span>
                        <span class="mentorship-list-cell" role="cell">{{ assignment.mentorshipStartDate }}</span>
                        <span class="mentorship-list-cell" role="cell">{{ assignment.jobTitle }}</span>
                        <span class="mentorship-list-cell" role="cell">{{ formatMentorshipMentorDisplay(assignment) }}</span>
                        <div class="mentorship-list-actions" role="cell">
                          <button type="button" class="edit-btn" (click)="openEditMentorshipAssignment(assignment)">Edit</button>
                        </div>
                        <div class="mentorship-list-actions" role="cell">
                          <button type="button" class="group-delete-btn" (click)="deleteMentorshipAssignment(assignment)">Delete</button>
                        </div>
                      </article>
                    }

                    @if (!mentorshipAssignments().length) {
                      <div class="mentorship-review-empty-state mentorship-review-empty-state-detail">No mentorship assignments yet. Use Assign Mentorship to add the first employee.</div>
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

              @if (mentorshipAssignmentModalOpen()) {
                <div class="enrollment-modal" aria-label="Assign mentorship" role="dialog" aria-modal="true">
                  <button type="button" class="enrollment-modal-backdrop" aria-label="Close mentorship dialog" (click)="closeMentorshipAssignmentModal()"></button>

                  <section class="enrollment-modal-card mentorship-assignment-modal-card">
                    <div class="enrollment-modal-header">
                      <div class="enrollment-modal-header-copy">
                        <p class="form-section-eyebrow">Mentorship list</p>
                        <h3>{{ editingMentorshipAssignment() ? 'Edit mentorship assignment' : 'Assign mentorship' }}</h3>
                        <p class="enrollment-modal-copy">Select an employee and capture the mentor pairing details.</p>
                      </div>
                      <button type="button" class="builder-secondary-btn" (click)="closeMentorshipAssignmentModal()">Close</button>
                    </div>

                    <form class="form-grid form-grid-two enrollment-edit-form" [formGroup]="mentorshipAssignmentForm" (ngSubmit)="saveMentorshipAssignment()">
                      <label class="form-grid-span-two enrollment-edit-field">
                        Employee
                        <select formControlName="menteeId">
                          <option value="">Select employee</option>
                          @for (employee of mentorshipEmployees(); track employee.id) {
                            <option [value]="employee.id">{{ employee.name }} {{ employee.surname }}</option>
                          }
                        </select>
                      </label>

                      <label class="enrollment-edit-field">
                        Mentorship Start Date
                        <input formControlName="mentorshipStartDate" type="date" />
                      </label>

                      <label class="enrollment-edit-field">
                        Job Title
                        <input formControlName="jobTitle" type="text" placeholder="Enter job title" />
                      </label>

                      <label class="enrollment-edit-field">
                        Mentor Name
                        <input formControlName="mentorName" type="text" placeholder="Enter mentor name" />
                      </label>

                      <label class="enrollment-edit-field">
                        Mentor Surname
                        <input formControlName="mentorSurname" type="text" placeholder="Enter mentor surname" />
                      </label>

                      <div class="enrollment-modal-actions form-grid-span-two">
                        <button type="button" class="builder-secondary-btn" (click)="closeMentorshipAssignmentModal()">Cancel</button>
                        <button type="submit" class="assign-btn" [disabled]="mentorshipAssignmentForm.invalid">{{ editingMentorshipAssignment() ? 'Save changes' : 'Assign mentorship' }}</button>
                      </div>
                    </form>
                  </section>
                </div>
              }

              @if (bulkMentorshipAssignmentModalOpen()) {
                <div class="enrollment-modal" aria-label="Bulk assign mentorship" role="dialog" aria-modal="true">
                  <button type="button" class="enrollment-modal-backdrop" aria-label="Close bulk mentorship dialog" (click)="closeBulkMentorshipAssignmentModal()"></button>

                  <section class="enrollment-modal-card enrollment-group-create-card">
                    <div class="enrollment-modal-header">
                      <div class="enrollment-modal-header-copy">
                        <p class="form-section-eyebrow">Mentorship list</p>
                        <h3>Bulk assign mentorship</h3>
                        <p class="enrollment-modal-copy">Select the employees who should appear on the mentorship list. Students will complete their own mentor details later.</p>
                      </div>
                      <button type="button" class="builder-secondary-btn" (click)="closeBulkMentorshipAssignmentModal()">Close</button>
                    </div>

                    <form class="form-grid form-grid-two enrollment-edit-form" [formGroup]="bulkMentorshipAssignmentForm" (ngSubmit)="saveBulkMentorshipAssignments()">
                      <div class="form-grid-span-two enrollment-student-picker">
                        <div class="enrollment-student-picker-header">
                          <div>
                            <div class="student-assignment-label">Select employees</div>
                            <p class="enrollment-group-toolbar-copy">Choose every employee who should be added to the mentorship list.</p>
                          </div>
                          <div class="enrollment-student-picker-header-actions">
                            <span class="student-search-count">{{ selectedEmployeesForBulkMentorshipCount() }} selected</span>
                            @if (filteredBulkMentorshipEmployees().length) {
                              <button type="button" class="builder-secondary-btn" (click)="toggleSelectAllEmployeesForBulkMentorship()">
                                {{ allFilteredEmployeesSelectedForBulkMentorship() ? 'Clear visible' : 'Select all visible' }}
                              </button>
                            }
                          </div>
                        </div>

                        <label class="student-search-field enrollment-student-picker-search">
                          <span class="student-search-label">Search employees</span>
                          <input
                            type="search"
                            [value]="bulkMentorshipSearchTerm()"
                            (input)="bulkMentorshipSearchTerm.set($any($event.target).value)"
                            placeholder="Search by name, surname, group, email, or department" />
                        </label>

                        @if (filteredBulkMentorshipEmployees().length) {
                          <div class="enrollment-student-picker-list">
                            @for (employee of filteredBulkMentorshipEmployees(); track employee.id) {
                              <label class="enrollment-student-picker-item" [class.enrollment-student-picker-item-selected]="isEmployeeSelectedForBulkMentorship(employee.id)">
                                <input
                                  type="checkbox"
                                  [checked]="isEmployeeSelectedForBulkMentorship(employee.id)"
                                  (change)="toggleEmployeeForBulkMentorship(employee.id, $any($event.target).checked)" />
                                <div class="enrollment-student-picker-copy">
                                  <span class="enrollment-student-picker-name">{{ employee.name }} {{ employee.surname }}</span>
                                  <span class="enrollment-student-picker-meta">{{ employee.group }} • {{ employee.department }}</span>
                                </div>
                              </label>
                            }
                          </div>
                        } @else {
                          <p class="enrollment-group-toolbar-copy">No employees match your search.</p>
                        }
                      </div>

                      <div class="enrollment-modal-actions form-grid-span-two">
                        <button type="button" class="builder-secondary-btn" (click)="closeBulkMentorshipAssignmentModal()">Cancel</button>
                        <button type="submit" class="assign-btn" [disabled]="selectedEmployeesForBulkMentorshipCount() === 0">Assign mentorship in bulk</button>
                      </div>
                    </form>
                  </section>
                </div>
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
                  (enroll)="goToEnrollmentForOffering(activeOffering)"
                  (reviewAssignment)="applyAssignmentReview($event)"
                  (save)="savePublishedOffering($event)" />
              </div>
            </div>
          }

          @if (selectedPanel() === 'requested-training') {
            <section class="manager-panel">
              <section class="activity-card mentorship-review-card">
                <div class="section-heading-row">
                  <h2>External Training Requests</h2>
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
                  <div class="mentorship-review-empty-state mentorship-review-empty-state-detail">No external training requests are assigned to this manager yet.</div>
                }
              </section>
            </section>
          }

          @if (selectedPanel() === 'enrollment') {
            <section class="manager-panel">
              <div class="section-heading-block">
                <p class="eyebrow">Student Enrollment</p>
                <h1>Assign students to created courses</h1>
                <p class="section-copy">Review each learner in one list, edit their details, and assign courses or programmes from the row actions.</p>
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
                        <button type="button" class="edit-btn" (click)="openEnrollmentEdit(student)">Edit</button>
                        <button type="button" class="assign-btn" (click)="openEnrollmentAssign(student)">Assign</button>
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
                    <span role="columnheader">Assign</span>
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
                        <button type="button" class="assign-btn" (click)="openEnrollmentGroupAssign(group)">Assign</button>
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

              @if (editingEnrollmentStudent()) {
                <div class="enrollment-modal" aria-label="Edit student details" role="dialog" aria-modal="true">
                  <button type="button" class="enrollment-modal-backdrop" aria-label="Close edit student dialog" (click)="closeEnrollmentEdit()"></button>

                  <section class="enrollment-modal-card enrollment-edit-modal-card">
                    <div class="enrollment-modal-header">
                      <div class="enrollment-modal-header-copy">
                        <p class="form-section-eyebrow">Edit student</p>
                        <h3>Edit {{ editingEnrollmentStudent()!.name }} {{ editingEnrollmentStudent()!.surname }}</h3>
                        <p class="enrollment-modal-copy">Update learner details, contact information, and active status from one focused editor.</p>
                      </div>
                      <button type="button" class="builder-secondary-btn" (click)="closeEnrollmentEdit()">Close</button>
                    </div>

                    <div class="enrollment-edit-hero">
                      <div class="enrollment-edit-avatar">{{ editingEnrollmentStudent()!.name[0] }}{{ editingEnrollmentStudent()!.surname[0] }}</div>
                      <div class="enrollment-edit-hero-copy">
                        <div class="enrollment-edit-hero-name">{{ editingEnrollmentStudent()!.name }} {{ editingEnrollmentStudent()!.surname }}</div>
                        <div class="enrollment-edit-hero-meta">{{ editingEnrollmentStudent()!.department }} • {{ editingEnrollmentStudent()!.group }}</div>
                      </div>
                      <span class="student-active-pill" [class.student-active-pill-inactive]="editingEnrollmentStudent()!.activeStatus === 'Inactive'">{{ editingEnrollmentStudent()!.activeStatus }}</span>
                    </div>

                    <form class="form-grid form-grid-two enrollment-edit-form" [formGroup]="enrollmentEditForm" (ngSubmit)="saveEnrollmentEdit()">
                      <label class="enrollment-edit-field">
                        Name
                        <input formControlName="name" type="text" />
                      </label>
                      <label class="enrollment-edit-field">
                        Surname
                        <input formControlName="surname" type="text" />
                      </label>
                      <label class="enrollment-edit-field">
                        Group
                        <input formControlName="group" type="text" />
                      </label>
                      <label class="enrollment-edit-field">
                        Department
                        <input formControlName="department" type="text" />
                      </label>
                      <label class="enrollment-edit-field">
                        Date Enrolled
                        <input formControlName="dateEnrolled" type="date" />
                      </label>
                      <label class="enrollment-edit-field">
                        Deadline Date
                        <input formControlName="deadlineDate" type="date" />
                      </label>
                      <label class="form-grid-span-two enrollment-edit-field">
                        Email Address
                        <input formControlName="email" type="email" />
                      </label>
                      <label class="enrollment-edit-field">
                        Active Status
                        <select formControlName="activeStatus">
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </label>

                      <div class="enrollment-modal-actions form-grid-span-two">
                        <button type="button" class="builder-secondary-btn" (click)="closeEnrollmentEdit()">Cancel</button>
                        <button type="submit" class="assign-btn">Save changes</button>
                      </div>
                    </form>
                  </section>
                </div>
              }

              @if (assigningEnrollmentStudent()) {
                <div class="enrollment-modal" aria-label="Assign student" role="dialog" aria-modal="true">
                  <button type="button" class="enrollment-modal-backdrop" aria-label="Close assign student dialog" (click)="closeEnrollmentAssign()"></button>

                  <section class="enrollment-modal-card">
                    <div class="enrollment-modal-header">
                      <div>
                        <p class="form-section-eyebrow">Assign learning item</p>
                        <h3>Assign {{ assigningEnrollmentStudent()!.name }} {{ assigningEnrollmentStudent()!.surname }}</h3>
                      </div>
                      <button type="button" class="builder-secondary-btn" (click)="closeEnrollmentAssign()">Close</button>
                    </div>

                    <div class="student-assignment-block">
                      <div class="student-assignment-label">Current assignments</div>
                      <div class="student-chip-row">
                        @if (managerData.offeringsForStudent(assigningEnrollmentStudent()!).length) {
                          @for (offering of managerData.offeringsForStudent(assigningEnrollmentStudent()!); track offering.id) {
                            <span class="assignment-chip assignment-chip-action">
                              <span>{{ offering.title }}</span>
                              <button type="button" class="assignment-chip-remove" (click)="unassignStudentOffering(assigningEnrollmentStudent()!, offering)" [attr.aria-label]="'Remove ' + offering.title + ' from ' + assigningEnrollmentStudent()!.name + ' ' + assigningEnrollmentStudent()!.surname">
                                Remove
                              </button>
                            </span>
                          }
                        } @else {
                          <span class="assignment-chip assignment-chip-muted">No assignments yet</span>
                        }
                      </div>
                    </div>

                    <label class="student-search-field">
                      <span class="student-search-label">Search courses</span>
                      <input
                        type="search"
                        [value]="assignStudentOfferingSearchTerm()"
                        (input)="updateAssignStudentOfferingSearch($any($event.target).value)"
                        placeholder="Search by title, type, category, or description" />
                    </label>

                    <div class="enrollment-action-row enrollment-action-row-modal">
                      <div class="enrollment-offering-picker" role="listbox" aria-label="Available courses for student assignment">
                        <span class="student-search-label">Assign to</span>

                        @if (filteredAssignableOfferingsForEnrollmentStudent().length) {
                          <div class="enrollment-offering-picker-list">
                            @for (offering of filteredAssignableOfferingsForEnrollmentStudent(); track offering.id) {
                              <button
                                type="button"
                                class="enrollment-offering-option"
                                [class.enrollment-offering-option-selected]="selectedEnrollmentByStudent()[assigningEnrollmentStudent()!.id] === offering.id"
                                (click)="setEnrollmentSelection(assigningEnrollmentStudent()!.id, offering.id)">
                                <span class="enrollment-offering-option-title">{{ offering.title }}</span>
                                <span class="enrollment-offering-option-meta">{{ offering.type }} • {{ offering.category }}</span>
                                <span class="enrollment-offering-option-copy">{{ offering.description }}</span>
                              </button>
                            }
                          </div>
                        }
                      </div>

                      <div class="enrollment-modal-actions">
                        <button type="button" class="builder-secondary-btn" (click)="closeEnrollmentAssign()">Cancel</button>
                        <button type="button" class="assign-btn" [disabled]="!selectedEnrollmentByStudent()[assigningEnrollmentStudent()!.id] || !filteredAssignableOfferingsForEnrollmentStudent().length" (click)="assignStudent(assigningEnrollmentStudent()!)">
                          Assign student
                        </button>
                      </div>
                    </div>

                    @if (!assignableOfferingsForEnrollmentStudent().length) {
                      <p class="student-search-empty">Every available course or programme is already assigned to this student.</p>
                    } @else if (!filteredAssignableOfferingsForEnrollmentStudent().length) {
                      <p class="student-search-empty">No course or programme matches your search.</p>
                    }

                    @if (enrollmentStudentAssignmentFeedback()) {
                      <p class="enrollment-assignment-feedback">{{ enrollmentStudentAssignmentFeedback() }}</p>
                    }
                  </section>
                </div>
              }

              @if (assigningEnrollmentGroup()) {
                <div class="enrollment-modal" aria-label="Assign group" role="dialog" aria-modal="true">
                  <button type="button" class="enrollment-modal-backdrop" aria-label="Close assign group dialog" (click)="closeEnrollmentGroupAssign()"></button>

                  <section class="enrollment-modal-card">
                    <div class="enrollment-modal-header">
                      <div>
                        <p class="form-section-eyebrow">Assign learning item</p>
                        <h3>Assign {{ assigningEnrollmentGroup()!.name }}</h3>
                        <p class="enrollment-modal-copy">Assign a course or programme to every student in this group.</p>
                      </div>
                      <button type="button" class="builder-secondary-btn" (click)="closeEnrollmentGroupAssign()">Close</button>
                    </div>

                    <div class="student-assignment-block">
                      <div class="student-assignment-label">Group members</div>
                      <div class="student-chip-row">
                        <span class="assignment-chip">{{ assigningEnrollmentGroup()!.members.length }} students</span>
                        <span class="assignment-chip assignment-chip-muted">{{ assigningEnrollmentGroup()!.startDate }} to {{ assigningEnrollmentGroup()!.endDate }}</span>
                      </div>
                    </div>

                    <div class="student-assignment-block">
                      <div class="student-assignment-label">Current assignments</div>
                      <div class="student-chip-row">
                        @if (managerData.offeringsForGroup(assigningEnrollmentGroup()!.members).length) {
                          @for (offering of managerData.offeringsForGroup(assigningEnrollmentGroup()!.members); track offering.id) {
                            <span class="assignment-chip assignment-chip-action">
                              <span>{{ offering.title }}</span>
                              <button type="button" class="assignment-chip-remove" (click)="unassignGroupOffering(assigningEnrollmentGroup()!, offering)" [attr.aria-label]="'Remove ' + offering.title + ' from group ' + assigningEnrollmentGroup()!.name">
                                Remove
                              </button>
                            </span>
                          }
                        } @else {
                          <span class="assignment-chip assignment-chip-muted">No assignments yet</span>
                        }
                      </div>
                    </div>

                    <label class="student-search-field">
                      <span class="student-search-label">Search courses</span>
                      <input
                        type="search"
                        [value]="assignGroupOfferingSearchTerm()"
                        (input)="updateAssignGroupOfferingSearch($any($event.target).value)"
                        placeholder="Search by title, type, category, or description" />
                    </label>

                    <div class="enrollment-action-row enrollment-action-row-modal">
                      <div class="enrollment-offering-picker" role="listbox" aria-label="Available courses for group assignment">
                        <span class="student-search-label">Assign to</span>

                        @if (filteredAssignableOfferingsForEnrollmentGroup().length) {
                          <div class="enrollment-offering-picker-list">
                            @for (offering of filteredAssignableOfferingsForEnrollmentGroup(); track offering.id) {
                              <button
                                type="button"
                                class="enrollment-offering-option"
                                [class.enrollment-offering-option-selected]="selectedEnrollmentByGroup()[assigningEnrollmentGroup()!.name] === offering.id"
                                (click)="setEnrollmentGroupSelection(assigningEnrollmentGroup()!.name, offering.id)">
                                <span class="enrollment-offering-option-title">{{ offering.title }}</span>
                                <span class="enrollment-offering-option-meta">{{ offering.type }} • {{ offering.category }}</span>
                                <span class="enrollment-offering-option-copy">{{ offering.description }}</span>
                              </button>
                            }
                          </div>
                        }
                      </div>

                      <div class="enrollment-modal-actions">
                        <button type="button" class="builder-secondary-btn" (click)="closeEnrollmentGroupAssign()">Cancel</button>
                        <button type="button" class="assign-btn" [disabled]="!selectedEnrollmentByGroup()[assigningEnrollmentGroup()!.name] || !filteredAssignableOfferingsForEnrollmentGroup().length" (click)="assignGroup(assigningEnrollmentGroup()!)">
                          Assign group
                        </button>
                      </div>
                    </div>

                    @if (enrollmentGroupAssignmentFeedback()) {
                      <p class="enrollment-assignment-feedback">{{ enrollmentGroupAssignmentFeedback() }}</p>
                    }

                    @if (!assignableOfferingsForEnrollmentGroup().length) {
                      <p class="student-search-empty">Every available course or programme is already assigned to this group.</p>
                    } @else if (!filteredAssignableOfferingsForEnrollmentGroup().length) {
                      <p class="student-search-empty">No course or programme matches your search.</p>
                    }
                  </section>
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
      --ui-scale: 0.9;
      display: block;
      min-height: 100vh;
      background: #eef3fb;
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
        linear-gradient(180deg, #f5f8ff 0%, var(--brand-surface) 100%);
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
      border: 1px solid rgba(15, 23, 42, 0.08);
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.06);
      backdrop-filter: blur(10px);
    }

    .manager-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: calc(1rem * var(--ui-scale));
      margin-bottom: calc(1rem * var(--ui-scale));
      padding: calc(0.9rem * var(--ui-scale)) calc(1.2rem * var(--ui-scale));
      border-radius: calc(22px * var(--ui-scale));
    }

    .manager-brand-block,
    .manager-topbar-user {
      display: flex;
      align-items: center;
      gap: calc(0.9rem * var(--ui-scale));
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
      width: calc(2.7rem * var(--ui-scale));
      height: calc(2.7rem * var(--ui-scale));
      border-radius: calc(16px * var(--ui-scale));
      background: linear-gradient(135deg, #818cf8, #38bdf8);
      flex: 0 0 auto;
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
      grid-template-columns: calc(260px * var(--ui-scale)) minmax(0, 1fr);
      gap: calc(1rem * var(--ui-scale));
      align-items: start;
    }

    .manager-sidebar {
      position: sticky;
      top: calc(1rem * var(--ui-scale));
      display: flex;
      flex-direction: column;
      gap: calc(0.65rem * var(--ui-scale));
      padding: calc(1rem * var(--ui-scale));
      border-radius: calc(24px * var(--ui-scale));
    }

    .manager-sidebar button,
    .assign-btn,
    .course-form button {
      border: none;
      cursor: pointer;
      font: inherit;
    }

    .manager-sidebar button {
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

    .manager-nav-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: calc(2rem * var(--ui-scale));
      height: calc(2rem * var(--ui-scale));
      border-radius: calc(12px * var(--ui-scale));
      background: rgba(148, 163, 184, 0.12);
      color: currentColor;
      flex-shrink: 0;
      transition: background 0.18s ease, color 0.18s ease;
    }

    .manager-nav-icon svg {
      display: block;
    }

    .manager-nav-label {
      min-width: 0;
    }

    .manager-sidebar button:hover,
    .manager-sidebar button:focus-visible {
      background: #f8fafc;
      color: #334155;
      outline: none;
      transform: translateX(2px);
    }

    .manager-sidebar button.active {
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      color: #fff;
      box-shadow: 0 12px 24px rgba(79, 70, 229, 0.18);
    }

    .manager-sidebar button:hover .manager-nav-icon,
    .manager-sidebar button:focus-visible .manager-nav-icon {
      background: rgba(148, 163, 184, 0.18);
    }

    .manager-sidebar button.active .manager-nav-icon {
      background: rgba(255, 255, 255, 0.18);
    }

    .manager-sidebar button.logout {
      margin-top: auto;
      background: #fee2e2;
      color: #b91c1c;
      border-color: #fecaca;
    }

    .manager-sidebar button.logout:hover,
    .manager-sidebar button.logout:focus-visible {
      background: #fecaca;
      color: #991b1b;
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
      background: rgba(15, 23, 42, 0.52);
      backdrop-filter: blur(8px);
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
      border-radius: 28px;
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
      border-radius: 12px;
      padding: 0.72rem 0.88rem;
      font-weight: 700;
      font-size: 0.88rem;
      color: #fff;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      box-shadow: 0 12px 24px rgba(79, 70, 229, 0.18);
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
      gap: 0.75rem;
      width: 100%;
      overflow-x: auto;
      padding-bottom: 0.25rem;
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
      padding: 1.2rem;
      border-radius: 22px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      background: #fff;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
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
      width: 2.85rem;
      height: 2.85rem;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
    }

    .course-studio-publish-btn {
      min-width: 120px;
      padding: 0.72rem 1.05rem;
      border-radius: 16px;
      background: #fff;
      color: #a04c11;
      font-size: 0.9rem;
      font-weight: 800;
      box-shadow: 0 12px 24px rgba(70, 31, 4, 0.16);
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

      .manager-sidebar {
        position: static;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
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
      backdrop-filter: blur(8px);
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
  readonly contentKindOptions: ReadonlyArray<TrainingContentKind> = ['Video', 'Assessment', 'Document'];
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
    { label: 'Messages', value: 'messages' },
  ];

  readonly selectedPanel = signal<ManagerPanel>('dashboard');
  readonly selectedCoursesView = signal<CoursesPanelView>('create');
  readonly selectedEnrollmentView = signal<EnrollmentPanelView>('students');
  readonly selectedManagerMessageSection = signal<ManagerMessageSection>(null);
  readonly selectedMentorshipSection = signal<MentorshipWorkspaceSection>('list');
  readonly selectedCreateSection = signal<CreateCourseSection>('basics');
  readonly assignmentSubmissionStatusFilter = signal<AssignmentSubmissionFilter>('All');
  readonly assignmentSubmissionSearchTerm = signal('');
  readonly studentSearchTerm = signal('');
  readonly createGroupStudentSearchTerm = signal('');
  readonly assignStudentOfferingSearchTerm = signal('');
  readonly assignGroupOfferingSearchTerm = signal('');
  readonly selectedEnrollmentByStudent = signal<Record<string, string>>({});
  readonly selectedEnrollmentByGroup = signal<Record<string, string>>({});
  readonly enrollmentStudentAssignmentFeedback = signal<string | null>(null);
  readonly enrollmentGroupAssignmentFeedback = signal<string | null>(null);
  readonly creatingEnrollmentGroup = signal(false);
  readonly selectedStudentsForNewGroup = signal<Record<string, boolean>>({});
  readonly selectedStudentsForEditedGroup = signal<Record<string, boolean>>({});
  readonly selectedStudentsForRemovalFromEditedGroup = signal<Record<string, boolean>>({});
  readonly editingEnrollmentStudentId = signal<string | null>(null);
  readonly editingEnrollmentGroupName = signal<string | null>(null);
  readonly assigningEnrollmentGroupName = signal<string | null>(null);
  readonly assigningEnrollmentStudentId = signal<string | null>(null);
  readonly thumbnailPreview = signal<string | null>(null);
  readonly thumbnailFileName = signal<string>('');
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
  readonly mentorshipAssignmentModalOpen = signal(false);
  readonly bulkMentorshipAssignmentModalOpen = signal(false);
  readonly editingMentorshipAssignmentId = signal<string | null>(null);
  readonly selectedMentorshipReviewId = signal<string | null>(null);
  readonly bulkMentorshipSearchTerm = signal('');
  readonly selectedEmployeesForBulkMentorship = signal<Record<string, boolean>>({});
  readonly editingCourseId = signal<string | null>(null);
  readonly presentationPreviewByItem = signal<Map<ContentItemFormGroup, PowerPointPreviewState>>(new Map());
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
  readonly mentorshipAssignments = computed(() => this.managerData.mentorshipAssignments());
  readonly mentorshipEmployees = computed(() =>
    [...this.managerData.students()].sort((left, right) => `${left.name} ${left.surname}`.localeCompare(`${right.name} ${right.surname}`)),
  );
  readonly filteredBulkMentorshipEmployees = computed(() => {
    const query = this.bulkMentorshipSearchTerm().trim().toLowerCase();
    const employees = this.mentorshipEmployees();

    if (!query) {
      return employees;
    }

    return employees.filter((employee) =>
      [employee.name, employee.surname, employee.group, employee.email, employee.department]
        .some((value) => value.toLowerCase().includes(query)),
    );
  });
  readonly selectedEmployeesForBulkMentorshipCount = computed(() =>
    Object.values(this.selectedEmployeesForBulkMentorship()).filter(Boolean).length,
  );
  readonly allFilteredEmployeesSelectedForBulkMentorship = computed(() => {
    const employees = this.filteredBulkMentorshipEmployees();

    if (!employees.length) {
      return false;
    }

    const selected = this.selectedEmployeesForBulkMentorship();
    return employees.every((employee) => selected[employee.id]);
  });
  readonly editingMentorshipAssignment = computed(() => {
    const selectedId = this.editingMentorshipAssignmentId();
    if (!selectedId) {
      return null;
    }

    return this.mentorshipAssignments().find((assignment) => assignment.id === selectedId) ?? null;
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
  readonly assigningEnrollmentStudent = computed(() => {
    const selectedId = this.assigningEnrollmentStudentId();
    if (!selectedId) {
      return null;
    }

    return this.managerData.students().find((student) => student.id === selectedId) ?? null;
  });
  readonly assignableOfferingsForEnrollmentStudent = computed(() => {
    const student = this.assigningEnrollmentStudent();

    if (!student) {
      return [];
    }

    return this.managerData.assignableOfferingsForStudent(student);
  });
  readonly filteredAssignableOfferingsForEnrollmentStudent = computed(() => {
    const query = this.assignStudentOfferingSearchTerm().trim().toLowerCase();
    const offerings = this.assignableOfferingsForEnrollmentStudent();

    if (!query) {
      return offerings;
    }

    return offerings.filter((offering) =>
      [offering.title, offering.type, offering.category, offering.description]
        .some((value) => value.toLowerCase().includes(query)),
    );
  });
  readonly assigningEnrollmentGroup = computed(() => {
    const selectedName = this.assigningEnrollmentGroupName();
    if (!selectedName) {
      return null;
    }

    return this.filteredEnrollmentGroups().find((group) => group.name === selectedName) ?? null;
  });
  readonly assignableOfferingsForEnrollmentGroup = computed(() => {
    const group = this.assigningEnrollmentGroup();

    if (!group) {
      return [];
    }

    return this.managerData.assignableOfferingsForGroup(group.members);
  });
  readonly filteredAssignableOfferingsForEnrollmentGroup = computed(() => {
    const query = this.assignGroupOfferingSearchTerm().trim().toLowerCase();
    const offerings = this.assignableOfferingsForEnrollmentGroup();

    if (!query) {
      return offerings;
    }

    return offerings.filter((offering) =>
      [offering.title, offering.type, offering.category, offering.description]
        .some((value) => value.toLowerCase().includes(query)),
    );
  });
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
    completionDeadline: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
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
  readonly mentorshipAssignmentForm = new FormGroup({
    menteeId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    mentorshipStartDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    jobTitle: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    mentorName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    mentorSurname: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly bulkMentorshipAssignmentForm = new FormGroup({});
  readonly assignmentSubmissionFilterOptions: ReadonlyArray<AssignmentSubmissionFilter> = ['All', 'Pending Review', 'Approved', 'Needs Revision'];

  get contentItemsArray() {
    return this.courseForm.controls.contentItems;
  }

  ngOnInit() {
    this.startWelcomeBannerSequence();
  }

  ngOnDestroy() {
    this.clearWelcomeBannerTimers();
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
    if (panel !== 'courses') {
      if (this.editingCourseId()) {
        this.resetCourseBuilder();
      }
      this.closeCreateSectionDetail();
      this.closeContentItemDetails();
      this.closePublishedOfferingDetail();
    }

    if (panel !== 'mentorship') {
      this.closeMentorshipAssignmentModal();
      this.closeBulkMentorshipAssignmentModal();
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

  applyAssignmentReview(event: { submissionId: string; status: 'Approved' | 'Needs Revision'; feedback: string; awardedPoints: number | null }) {
    this.managerData.reviewAssignmentSubmission({
      submissionId: event.submissionId,
      reviewerName: this.managerData.profile().name,
      status: event.status,
      awardedPoints: event.awardedPoints,
      feedback: event.feedback,
    });
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

    this.selectedCoursesView.set(view);
  }

  updateAssignmentSubmissionSearch(value: string) {
    this.assignmentSubmissionSearchTerm.set(value);
    const firstSubmission = this.filteredAssignmentSubmissions()[0] ?? null;
    this.selectedAssignmentSubmissionId.set(firstSubmission?.id ?? null);
    this.assignmentWorkspaceReviewForm.reset({ awardedPoints: firstSubmission?.awardedPoints ?? null, feedback: firstSubmission?.reviewerFeedback ?? '' });
  }

  setAssignmentSubmissionStatusFilter(status: AssignmentSubmissionFilter) {
    this.assignmentSubmissionStatusFilter.set(status);
    const firstSubmission = this.filteredAssignmentSubmissions()[0] ?? null;
    this.selectedAssignmentSubmissionId.set(firstSubmission?.id ?? null);
    this.assignmentWorkspaceReviewForm.reset({ awardedPoints: firstSubmission?.awardedPoints ?? null, feedback: firstSubmission?.reviewerFeedback ?? '' });
  }

  openAssignmentSubmission(submissionId: string) {
    this.selectedAssignmentSubmissionId.set(submissionId);
    const activeSubmission = this.filteredAssignmentSubmissions().find((submission) => submission.id === submissionId) ?? null;
    this.assignmentWorkspaceReviewForm.reset({ awardedPoints: activeSubmission?.awardedPoints ?? null, feedback: activeSubmission?.reviewerFeedback ?? '' });
  }

  applyAssignmentWorkspaceReview(status: 'Approved' | 'Needs Revision') {
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

    this.managerData.reviewAssignmentSubmission({
      submissionId: activeSubmission.id,
      reviewerName: this.managerData.profile().name,
      status,
      awardedPoints: status === 'Approved' ? awardedPoints : null,
      feedback: this.assignmentWorkspaceReviewForm.controls.feedback.value.trim(),
    });
    this.assignmentWorkspaceReviewForm.reset({
      awardedPoints: status === 'Approved' ? awardedPoints : null,
      feedback: this.assignmentWorkspaceReviewForm.controls.feedback.value.trim(),
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

  openAssignMentorship() {
    this.closeBulkMentorshipAssignmentModal();
    this.editingMentorshipAssignmentId.set(null);
    this.mentorshipAssignmentForm.reset({
      menteeId: '',
      mentorshipStartDate: '',
      jobTitle: '',
      mentorName: '',
      mentorSurname: '',
    });
    this.mentorshipAssignmentModalOpen.set(true);
  }

  openBulkAssignMentorship() {
    this.closeMentorshipAssignmentModal();
    this.bulkMentorshipAssignmentForm.reset();
    this.selectedEmployeesForBulkMentorship.set({});
    this.bulkMentorshipSearchTerm.set('');
    this.bulkMentorshipAssignmentModalOpen.set(true);
  }

  openEditMentorshipAssignment(assignment: MentorshipAssignmentRecord) {
    this.editingMentorshipAssignmentId.set(assignment.id);
    this.mentorshipAssignmentForm.reset({
      menteeId: assignment.menteeId,
      mentorshipStartDate: assignment.mentorshipStartDate,
      jobTitle: assignment.jobTitle,
      mentorName: assignment.mentorName,
      mentorSurname: assignment.mentorSurname,
    });
    this.mentorshipAssignmentModalOpen.set(true);
  }

  closeMentorshipAssignmentModal() {
    this.mentorshipAssignmentModalOpen.set(false);
    this.editingMentorshipAssignmentId.set(null);
    this.mentorshipAssignmentForm.reset({
      menteeId: '',
      mentorshipStartDate: '',
      jobTitle: '',
      mentorName: '',
      mentorSurname: '',
    });
  }

  closeBulkMentorshipAssignmentModal() {
    this.bulkMentorshipAssignmentModalOpen.set(false);
    this.bulkMentorshipAssignmentForm.reset();
    this.selectedEmployeesForBulkMentorship.set({});
    this.bulkMentorshipSearchTerm.set('');
  }

  saveMentorshipAssignment() {
    if (this.mentorshipAssignmentForm.invalid) {
      this.mentorshipAssignmentForm.markAllAsTouched();
      return;
    }

    const payload = {
      menteeId: this.mentorshipAssignmentForm.controls.menteeId.value,
      mentorshipStartDate: this.mentorshipAssignmentForm.controls.mentorshipStartDate.value,
      jobTitle: this.mentorshipAssignmentForm.controls.jobTitle.value,
      mentorName: this.mentorshipAssignmentForm.controls.mentorName.value,
      mentorSurname: this.mentorshipAssignmentForm.controls.mentorSurname.value,
    };

    const editingAssignment = this.editingMentorshipAssignment();

    if (editingAssignment) {
      this.managerData.updateMentorshipAssignment(editingAssignment.id, payload);
    } else {
      this.managerData.createMentorshipAssignment(payload);
    }

    this.closeMentorshipAssignmentModal();
  }

  toggleEmployeeForBulkMentorship(employeeId: string, checked: boolean) {
    this.selectedEmployeesForBulkMentorship.update((current) => ({
      ...current,
      [employeeId]: checked,
    }));
  }

  toggleSelectAllEmployeesForBulkMentorship() {
    const employees = this.filteredBulkMentorshipEmployees();

    if (!employees.length) {
      return;
    }

    const shouldSelectAll = !this.allFilteredEmployeesSelectedForBulkMentorship();

    this.selectedEmployeesForBulkMentorship.update((current) => {
      const nextSelection = { ...current };

      for (const employee of employees) {
        nextSelection[employee.id] = shouldSelectAll;
      }

      return nextSelection;
    });
  }

  isEmployeeSelectedForBulkMentorship(employeeId: string) {
    return this.selectedEmployeesForBulkMentorship()[employeeId] ?? false;
  }

  saveBulkMentorshipAssignments() {
    if (this.selectedEmployeesForBulkMentorshipCount() === 0) {
      return;
    }

    const menteeIds = Object.entries(this.selectedEmployeesForBulkMentorship())
      .filter(([, selected]) => selected)
      .map(([employeeId]) => employeeId);

    this.managerData.createBulkMentorshipAssignments({
      menteeIds,
    });

    this.closeBulkMentorshipAssignmentModal();
  }

  deleteMentorshipAssignment(assignment: MentorshipAssignmentRecord) {
    this.managerData.deleteMentorshipAssignment(assignment.id);

    if (this.editingMentorshipAssignmentId() === assignment.id) {
      this.closeMentorshipAssignmentModal();
    }
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

  openPublishedOffering(offering: TrainingOffering) {
    this.selectedPublishedOfferingId.set(offering.id);
  }

  handleOverlayEscape() {
    if (this.selectedPanel() === 'mentorship' && this.mentorshipAssignmentModalOpen()) {
      this.closeMentorshipAssignmentModal();
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

    if (this.selectedPanel() === 'enrollment' && this.assigningEnrollmentGroup()) {
      this.closeEnrollmentGroupAssign();
      return;
    }

    if (this.selectedPanel() === 'enrollment' && this.assigningEnrollmentStudent()) {
      this.closeEnrollmentAssign();
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

  goToEnrollmentForOffering(offering: TrainingOffering, event?: Event) {
    event?.stopPropagation();
    this.closePublishedOfferingDetail();
    this.selectedPanel.set('enrollment');
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
        return 'Build the learning flow as cards when you are ready. You can also publish first and return later to add videos, documents, and assessments.';
    }
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

    const title = activeItem.controls.title.value.trim();
    if (title) {
      return title;
    }

    return this.courseStudioItemTitle(this.activeContentItemIndex());
  }

  courseStudioWorkspaceSubtitle() {
    if (this.selectedCreateSection() === 'basics') {
      return 'Set up the course summary, dates, and learner-facing description.';
    }

    const activeItem = this.selectedContentItem();
    if (!activeItem) {
      return 'Select a unit from the left or add a new one to start building the flow.';
    }

    if (activeItem.controls.kind.value === 'Assessment') {
      return 'Configure the activity, questions, and submission flow for learners.';
    }

    return `Add the ${activeItem.controls.kind.value.toLowerCase()} file or hosted link for this unit.`;
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

  logout() {
    localStorage.removeItem('lms-token');
    localStorage.removeItem('lms-session');
    this.router.navigate(['/']);
  }

  activityWidth(activity: LearningActivityItem) {
    const maxCount = Math.max(...this.managerData.learningActivity().map((item) => item.count), 1);
    return (activity.count / maxCount) * 100;
  }

  activityHeight(activity: LearningActivityItem) {
    return this.activityWidth(activity);
  }

  activityMaxCount() {
    return Math.max(...this.managerData.learningActivity().map((item) => item.count), 1);
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
      requiresAcknowledgement: new FormControl(Boolean(item?.requiresAcknowledgement), { nonNullable: true }),
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

  assessmentTypeHelperText(itemIndex: number) {
    switch (this.assessmentTypeForItem(itemIndex)) {
      case 'Assignment':
        return 'Assignments use task-style prompts with either a long-answer response or a document submission.';
      case 'Mentorship':
        return 'Mentorship assessments capture coach check-ins, reflections, and action plans for a student.';
      case 'Read and Acknowledge':
        return 'Read-and-acknowledge items require the learner to open the attached document and confirm they have read it.';
      case 'Quiz':
      default:
        return 'Quizzes support standard knowledge-check questions.';
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

    const reader = new FileReader();
    reader.onload = () => {
      this.thumbnailPreview.set(typeof reader.result === 'string' ? reader.result : null);
      this.thumbnailFileName.set(file.name);
    };
    reader.readAsDataURL(file);
  }

  onContentFileSelected(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      input.value = '';
      return;
    }

    const item = this.contentItemsArray.at(index);
    item.patchValue({ uploadedFileName: `Uploading ${file.name}…`, uploadedFileDataUrl: '' });
    input.value = '';

    this.backend.uploadFile(file, 'content-items').subscribe({
      next: ({ url }) => {
        item.patchValue({
          uploadedFileName: file.name,
          uploadedFileDataUrl: '',
          resourceLink: url,
        });
        this.updatePresentationPreview(item, file.name, '');
      },
      error: () => {
        item.patchValue({ uploadedFileName: '', uploadedFileDataUrl: '' });
        alert(`Failed to upload "${file.name}". Please check your connection and try again. For large videos, use a YouTube or Vimeo link instead.`);
      },
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

  submitCourseForm() {
    if (this.courseForm.invalid) {
      this.courseForm.markAllAsTouched();
      this.courseCreatedSignal.set(false);
      this.revealFirstInvalidSection();
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
        contentItems: this.contentItemsArray.getRawValue(),
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
      contentItems: this.contentItemsArray.getRawValue(),
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
    const parts = [
      videos ? `${videos} video${videos === 1 ? '' : 's'}` : '',
      documents ? `${documents} document${documents === 1 ? '' : 's'}` : '',
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

  openEnrollmentEdit(student: EnrollmentStudent) {
    this.enrollmentEditForm.reset({
      name: student.name,
      surname: student.surname,
      group: student.group,
      dateEnrolled: student.dateEnrolled,
      deadlineDate: student.deadlineDate,
      email: student.email,
      activeStatus: student.activeStatus,
      department: student.department,
    });
    this.editingEnrollmentStudentId.set(student.id);
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
    const studentId = this.editingEnrollmentStudentId();
    if (!studentId) {
      return;
    }

    if (this.enrollmentEditForm.invalid) {
      this.enrollmentEditForm.markAllAsTouched();
      return;
    }

    this.managerData.updateStudent(studentId, {
      name: this.enrollmentEditForm.controls.name.value,
      surname: this.enrollmentEditForm.controls.surname.value,
      group: this.enrollmentEditForm.controls.group.value,
      dateEnrolled: this.enrollmentEditForm.controls.dateEnrolled.value,
      deadlineDate: this.enrollmentEditForm.controls.deadlineDate.value,
      email: this.enrollmentEditForm.controls.email.value,
      activeStatus: this.enrollmentEditForm.controls.activeStatus.value,
      department: this.enrollmentEditForm.controls.department.value,
      role: this.enrollmentEditForm.controls.role.value,
    });
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
    if (this.assigningEnrollmentGroupName() === group.name) {
      this.closeEnrollmentGroupAssign();
    }
  }

  openEnrollmentGroupAssign(group: EnrollmentGroupSummary) {
    this.enrollmentGroupAssignmentFeedback.set(null);
    this.assignGroupOfferingSearchTerm.set('');
    this.setEnrollmentGroupSelection(group.name, '');
    this.assigningEnrollmentGroupName.set(group.name);
  }

  closeEnrollmentGroupAssign() {
    this.enrollmentGroupAssignmentFeedback.set(null);
    this.assignGroupOfferingSearchTerm.set('');
    this.assigningEnrollmentGroupName.set(null);
  }

  updateAssignGroupOfferingSearch(query: string) {
    this.assignGroupOfferingSearchTerm.set(query);

    const group = this.assigningEnrollmentGroup();
    if (!group) {
      return;
    }

    const selectedOfferingId = this.selectedEnrollmentByGroup()[group.name];
    if (!selectedOfferingId) {
      return;
    }

    const hasSelectedOffering = this.filteredAssignableOfferingsForEnrollmentGroup()
      .some((offering) => offering.id === selectedOfferingId);

    if (!hasSelectedOffering) {
      this.setEnrollmentGroupSelection(group.name, '');
    }
  }

  setEnrollmentGroupSelection(groupName: string, offeringId: string) {
    this.selectedEnrollmentByGroup.update((current) => ({
      ...current,
      [groupName]: offeringId,
    }));
  }

  assignGroup(group: EnrollmentGroupSummary) {
    const offeringId = this.selectedEnrollmentByGroup()[group.name];
    if (!offeringId) {
      return;
    }

    const assignedCount = this.managerData.assignGroupToOffering(group.name, offeringId);
    const assignedOffering = this.managerData.offerings().find((offering) => offering.id === offeringId);

    if (assignedOffering) {
      this.enrollmentGroupAssignmentFeedback.set(
        assignedCount > 0
          ? `${assignedCount} student${assignedCount === 1 ? '' : 's'} assigned to ${assignedOffering.title}.`
          : `All students in ${group.name} already have ${assignedOffering.title}.`,
      );
    }

    this.selectedEnrollmentByGroup.update((current) => ({
      ...current,
      [group.name]: '',
    }));
  }

  unassignGroupOffering(group: EnrollmentGroupSummary, offering: TrainingOffering) {
    const removedCount = this.managerData.removeGroupFromOffering(group.name, offering.id);

    this.enrollmentGroupAssignmentFeedback.set(
      removedCount > 0
        ? `${removedCount} student${removedCount === 1 ? '' : 's'} unassigned from ${offering.title}.`
        : `No students in ${group.name} had ${offering.title}.`,
    );
  }

  openEnrollmentAssign(student: EnrollmentStudent) {
    this.enrollmentStudentAssignmentFeedback.set(null);
    this.assignStudentOfferingSearchTerm.set('');
    this.setEnrollmentSelection(student.id, '');
    this.assigningEnrollmentStudentId.set(student.id);
  }

  closeEnrollmentAssign() {
    this.enrollmentStudentAssignmentFeedback.set(null);
    this.assignStudentOfferingSearchTerm.set('');
    this.assigningEnrollmentStudentId.set(null);
  }

  updateAssignStudentOfferingSearch(query: string) {
    this.assignStudentOfferingSearchTerm.set(query);

    const student = this.assigningEnrollmentStudent();
    if (!student) {
      return;
    }

    const selectedOfferingId = this.selectedEnrollmentByStudent()[student.id];
    if (!selectedOfferingId) {
      return;
    }

    const hasSelectedOffering = this.filteredAssignableOfferingsForEnrollmentStudent()
      .some((offering) => offering.id === selectedOfferingId);

    if (!hasSelectedOffering) {
      this.setEnrollmentSelection(student.id, '');
    }
  }

  setEnrollmentSelection(studentId: string, offeringId: string) {
    this.selectedEnrollmentByStudent.update((current) => ({
      ...current,
      [studentId]: offeringId,
    }));
  }

  assignStudent(student: EnrollmentStudent) {
    const offeringId = this.selectedEnrollmentByStudent()[student.id];
    if (!offeringId) {
      return;
    }

    this.managerData.assignStudentToOffering(student.id, offeringId);
    this.selectedEnrollmentByStudent.update((current) => ({
      ...current,
      [student.id]: '',
    }));
    this.closeEnrollmentAssign();
  }

  unassignStudentOffering(student: EnrollmentStudent, offering: TrainingOffering) {
    const removedCount = this.managerData.removeStudentFromOffering(student.id, offering.id);

    this.enrollmentStudentAssignmentFeedback.set(
      removedCount > 0
        ? `${student.name} ${student.surname} was unassigned from ${offering.title}.`
        : `${student.name} ${student.surname} did not have ${offering.title}.`,
    );
  }
}
