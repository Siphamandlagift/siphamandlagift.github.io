import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LmsBackendService } from './lms-backend.service';
import { PdfViewerComponent } from './pdf-viewer.component';
import { PowerPointWindowComponent } from './powerpoint-window.component';
import { StudentAssessmentAttempt, StudentCourse, StudentDataService } from './student-data.service';
import { resolvePowerPointUploadType } from './powerpoint-preview';
import { AssignmentSubmissionRecord, TrainingAssessmentType, TrainingContentItem, TrainingContentKind, TrainingManagerDataService, TrainingOffering, TrainingQuestionType } from './training-manager-data.service';

type WorkspaceDocument = {
  title: string;
  fileName?: string;
  resourceLink?: string;
  uploadedDataUrl?: string;
  convertedPdfUrl?: string;
  requiresAcknowledgement?: boolean;
  allowDownload?: boolean;
};

type WorkspaceVideo = {
  title: string;
  fileName?: string;
  resourceLink?: string;
  uploadedDataUrl?: string;
  durationLabel?: string;
};

type WorkspaceStep = {
  id: string;
  kind: TrainingContentKind | 'Overview';
  title: string;
  summary: string;
  video?: WorkspaceVideo;
  document?: WorkspaceDocument;
  assessment?: WorkspaceAssessment;
};

type CourseWorkspace = {
  heroLabel: string;
  summary: string;
  videoDuration: string;
  sections: string[];
  steps: WorkspaceStep[];
  videos?: WorkspaceVideo[];
  documents: Array<string | WorkspaceDocument>;
  assessment: WorkspaceAssessment;
};

type WorkspaceAssessmentQuestion = {
  id: string;
  questionType: TrainingQuestionType;
  prompt: string;
  points: number;
  options?: string[];
  matchingPairs?: Array<{
    prompt: string;
    answer: string;
  }>;
  dragAndDropEnabled?: boolean;
  attachmentFileName?: string;
  attachmentDataUrl?: string;
};

type WorkspaceAssessment = {
  title: string;
  assessmentType: TrainingAssessmentType;
  passMarkPercentage?: number;
  maxAttempts?: number;
  resourceLink?: string;
  questions: WorkspaceAssessmentQuestion[];
};

type MentorshipSubmission = {
  mentorName: string;
  sessionDate: string;
  actionPlan: string;
};

type AssignmentDocumentSubmission = {
  fileName: string;
  dataUrl: string;
};

type WorkspaceDocumentPresentationPreview = {
  fileName: string;
  message: string;
};

type ScormRuntimeState = {
  initialized: boolean;
  completed: boolean;
  successStatus: 'unknown' | 'passed' | 'failed';
  scoreRaw: string;
  location: string;
  suspendData: string;
};

@Component({
  selector: 'student-courses',
  imports: [CommonModule, PowerPointWindowComponent, PdfViewerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="courses-content">
      <ng-container *ngIf="!selectedCourse(); else courseWorkspaceView">
        <div class="courses-tabs-row">
          <div class="courses-tabs">
            <button [class.active]="activeTab() === 'inprogress'" (click)="activeTab.set('inprogress')">In Progress</button>
            <button [class.active]="activeTab() === 'completed'" (click)="activeTab.set('completed')">Completed</button>
          </div>
          <div class="courses-search-wrap">
            <svg class="courses-search-icon" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="#94a3b8" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/></svg>
            <input class="courses-search-input" type="search" placeholder="Search courses..." [value]="searchQuery()" (input)="searchQuery.set($any($event.target).value)" aria-label="Search courses" />
          </div>
        </div>

        <div class="courses-grid">
          <div *ngIf="!filteredCourses().length" class="courses-empty-state">
            <h3>No courses yet</h3>
            <p>Your assigned or published courses will appear here once the training manager loads them.</p>
          </div>

          <ng-container *ngFor="let course of filteredCourses()">
            <article class="course-card" [class.completed]="course.completed" (click)="openCourse(course)">
              <div class="course-card-top" [style.background-image]="'url(' + course.image + ')'">
                <span class="course-status-pill">{{ course.completed ? 'Completed' : 'In Progress' }}</span>
                <div class="eye-overlay">
                  <svg class="eye-icon" width="38" height="38" fill="none" viewBox="0 0 24 24"><path fill="#fff" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 12c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>
                </div>
                @if (courseDeadlineLabel(course); as deadlineLabel) {
                  <div
                    class="course-deadline-badge"
                    [class.course-deadline-badge-overdue]="courseDeadlineStatus(course) === 'overdue'"
                    [class.course-deadline-badge-soon]="courseDeadlineStatus(course) === 'soon'">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/>
                      <path d="M12 7.5v5l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>{{ courseDeadlineStatus(course) === 'overdue' ? 'Overdue' : 'Due' }} {{ deadlineLabel }}</span>
                  </div>
                }
              </div>

              <div class="course-card-body">
                <div class="course-title">{{ course.name }}</div>
                <div class="course-description">{{ course.description }}</div>
                <div class="progress-bar">
                  <div class="progress-bar-fill" [style.width.%]="course.completed ? 100 : course.progress || 0"></div>
                </div>
                <div class="progress-label">Progress: {{ course.completed ? 100 : course.progress || 0 }}%</div>
              </div>
            </article>
          </ng-container>
        </div>
      </ng-container>

      <ng-template #courseWorkspaceView>
        <section class="course-workspace" *ngIf="selectedCourse() && selectedCourseWorkspace()">
          <header class="workspace-header">
            <div>
              <button type="button" class="workspace-back-btn" (click)="closeCourse()">Back to courses</button>
              <h2>{{ selectedCourse()!.name }}</h2>
              <p class="workspace-meta">Course ID: {{ workspaceCourseId() }} | Progress: {{ selectedCourse()!.completed ? 100 : selectedCourse()!.progress || 0 }}%</p>
            </div>
          </header>

          <div class="workspace-layout">
            <aside class="workspace-sidebar">
              <div class="workspace-side-group">
                <div class="workspace-side-title">Course Steps</div>
                <button
                  *ngFor="let step of orderedCourseSteps(); let stepIndex = index"
                  type="button"
                  class="workspace-side-item"
                  [class.workspace-side-item-active]="selectedCourseStep()?.id === step.id"
                  (click)="selectCourseStep(step)">
                  <span class="workspace-step-index">{{ stepIndex + 1 }}</span>
                  <span class="workspace-step-copy">
                    <span class="workspace-step-title">{{ step.title }}</span>
                    <span class="workspace-step-meta">{{ workspaceStepMeta(step) }}</span>
                  </span>
                </button>
              </div>
            </aside>

            <div class="workspace-main">
              <section *ngIf="selectedCourseStep()?.document as document" class="workspace-document-card">
                <ng-container *ngIf="selectedDocumentPresentationPreview() as presentationPreview; else standardDocumentSection">
                  <div class="workspace-document-preview" style="padding:1rem;">
                    <powerpoint-window
                      [viewerTitle]="'PowerPoint file for ' + presentationPreview.fileName"
                      [sourceDataUrl]="document.uploadedDataUrl || null"
                      [sourceFileName]="presentationPreview.fileName"
                      [emptyMessage]="presentationPreview.message"
                      (downloaded)="handleSelectedDocumentDownload()"></powerpoint-window>
                  </div>
                </ng-container>

                <ng-template #standardDocumentSection>
                  <div class="workspace-document-card-copy">
                    <div class="workspace-document-card-title">{{ document.title }}</div>
                    <div class="workspace-document-card-meta">
                      {{ document.fileName || 'Linked document' }}
                      <span *ngIf="selectedCourseStep()?.kind === 'Scorm'">SCORM package</span>
                      <span *ngIf="document.requiresAcknowledgement">Requires read and acknowledge</span>
                    </div>
                  </div>

                  <div class="workspace-document-card-actions">
                    <button *ngIf="document.allowDownload !== false" type="button" class="workspace-document-open-btn" [disabled]="!hasSelectedDocumentLink()" (click)="openSelectedDocument()">{{ selectedCourseStep()?.kind === 'Scorm' ? 'Launch SCORM package' : (hasSelectedDocumentPreview() ? 'Open in new tab' : 'Open document') }}</button>
                    <button *ngIf="document.requiresAcknowledgement" type="button" class="workspace-assessment-submit-btn" [disabled]="!canAcknowledgeSelectedDocument() || isSelectedDocumentAcknowledged()" (click)="acknowledgeSelectedDocument()">
                      {{ isSelectedDocumentAcknowledged() ? 'Acknowledged' : 'Acknowledge Read' }}
                    </button>
                  </div>

                  <div *ngIf="selectedDocumentPptViewerUrl()" class="workspace-document-preview">
                    <iframe
                      class="workspace-document-embed"
                      [attr.title]="document.title + ' slides'"
                      [src]="selectedDocumentPptViewerUrl()"></iframe>
                  </div>

                  <div *ngIf="!selectedDocumentPptViewerUrl() && selectedDocumentPreviewUrl()" class="workspace-document-preview">
                    <ng-container *ngIf="isPdfDocumentSource(); else iframePreview">
                      <pdf-viewer [src]="selectedDocumentSource()" [allowDownload]="selectedDocument()?.allowDownload !== false"></pdf-viewer>
                    </ng-container>
                    <ng-template #iframePreview>
                      <iframe
                        class="workspace-document-embed"
                        [attr.title]="document.title + ' preview'"
                        [src]="selectedDocumentPreviewUrl()"></iframe>
                    </ng-template>
                  </div>

                  <p *ngIf="hasSelectedDocumentLink() && !hasSelectedDocumentPreview()" class="workspace-acknowledgement-note workspace-acknowledgement-note-warning">{{ selectedCourseStep()?.kind === 'Scorm' ? 'This SCORM package opens in a new tab. Ensure your LMS hosting serves the package entry point for full playback.' : 'This file opens in a new tab because an inline preview is not available for its format.' }}</p>
                </ng-template>

                <div *ngIf="selectedCourseStep()?.kind === 'Scorm' && selectedScormLaunchUrl()" class="workspace-scorm-player">
                  <iframe
                    class="workspace-scorm-frame"
                    [attr.title]="(selectedCourseStep()?.title || 'SCORM package') + ' player'"
                    [src]="selectedScormLaunchUrl()"
                    allow="fullscreen"
                    referrerpolicy="strict-origin-when-cross-origin"></iframe>
                </div>

                <div *ngIf="selectedDocumentPresentationPreview() && document.requiresAcknowledgement" class="workspace-document-card-actions">
                  <button type="button" class="workspace-assessment-submit-btn" [disabled]="!canAcknowledgeSelectedDocument() || isSelectedDocumentAcknowledged()" (click)="acknowledgeSelectedDocument()">
                    {{ isSelectedDocumentAcknowledged() ? 'Acknowledged' : 'Acknowledge Read' }}
                  </button>
                </div>

                <p *ngIf="document.requiresAcknowledgement && !hasReviewedSelectedDocument()" class="workspace-acknowledgement-note">Review the document before you can acknowledge it.</p>
                <p *ngIf="document.requiresAcknowledgement && hasReviewedSelectedDocument() && !isSelectedDocumentAcknowledged()" class="workspace-acknowledgement-note workspace-acknowledgement-note-success">Document ready for review. You can now acknowledge that you have read it.</p>
                <p *ngIf="document.requiresAcknowledgement && isSelectedDocumentAcknowledged()" class="workspace-acknowledgement-note workspace-acknowledgement-note-success">This document has been acknowledged.</p>
              </section>

              <div *ngIf="selectedCourseStep()?.video as video" class="workspace-video-card">
                  <iframe
                    *ngIf="selectedEmbeddedVideoUrl(); else workspaceInlineOrFallback"
                    class="workspace-video-embed"
                    [attr.title]="video.title"
                    [src]="selectedEmbeddedVideoUrl()"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen></iframe>

                  <ng-template #workspaceInlineOrFallback>
                    <video
                      *ngIf="canPlaySelectedVideoInline(); else workspaceVideoFallback"
                      class="workspace-video-player"
                      controls
                      controlsList="nodownload"
                      disablePictureInPicture
                      playsinline
                      preload="metadata"
                      [attr.aria-label]="video.title"
                      [src]="selectedVideoSource()"
                      (contextmenu)="$event.preventDefault()"
                      (loadedmetadata)="onSelectedVideoMetadataLoaded($event)"></video>
                  </ng-template>

                  <ng-template #workspaceVideoFallback>
                    <div class="workspace-video-placeholder">
                      <div class="workspace-video-play-icon" aria-hidden="true">
                        <svg width="76" height="76" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#fff" stroke-width="1.5" opacity="0.55"/><path d="M10 8.9 16 12l-6 3.1V8.9Z" fill="#fff"/></svg>
                      </div>
                      <span>{{ hasSelectedVideoSource() ? 'Video link is available to open.' : 'No video available' }}</span>
                      <span class="workspace-video-placeholder-copy">{{ video.title }}</span>
                    </div>
                  </ng-template>
              </div>

              <div *ngIf="selectedCourseStep()?.video" class="workspace-video-duration">{{ selectedVideoMeta() }}</div>

              <section *ngIf="selectedCourseStep()?.assessment" class="workspace-question-card">
                <h3>{{ selectedCourseWorkspace()!.heroLabel }}</h3>
                <div class="workspace-question-title">{{ selectedAssessment()!.title }}</div>
                <div class="workspace-question-prompt">{{ selectedAssessmentQuestionNumber() }}. {{ selectedAssessmentQuestion()!.prompt }}</div>

                <div class="workspace-assessment-setting-row">
                  @if (assessmentQuestionProgressLabel(); as questionProgressLabel) {
                    <span class="workspace-assessment-setting-pill">{{ questionProgressLabel }}</span>
                  }
                  @if (assessmentQuestionPointsLabel(); as questionPointsLabel) {
                    <span class="workspace-assessment-setting-pill">{{ questionPointsLabel }}</span>
                  }
                  @if (assessmentPassMarkLabel(); as passMarkLabel) {
                    <span class="workspace-assessment-setting-pill">{{ passMarkLabel }}</span>
                  }
                  @if (assessmentAttemptSummaryLabel(); as attemptLabel) {
                    <span class="workspace-assessment-setting-pill">{{ attemptLabel }}</span>
                  }
                  @if (quizScoreSummaryLabel(); as quizScoreLabel) {
                    <span class="workspace-assessment-setting-pill">{{ quizScoreLabel }}</span>
                  }
                </div>

                <div *ngIf="selectedAssessmentQuestion()!.attachmentFileName" class="workspace-assignment-brief">
                  <div class="workspace-assignment-brief-copy">
                    <strong>{{ assessmentAttachmentHeading() }}</strong>
                    <span>{{ selectedAssessmentQuestion()!.attachmentFileName }}</span>
                  </div>

                  <button *ngIf="hasAssessmentDocument()" type="button" class="workspace-document-open-btn" (click)="openAssessmentDocument()">
                    Open attached document
                  </button>
                </div>

                <div *ngIf="currentMentorshipReview() && selectedAssessment()?.assessmentType === 'Mentorship'" class="workspace-mentorship-status-card">
                  <div class="workspace-mentorship-status-row">
                    <strong>Review status</strong>
                    <span class="workspace-mentorship-status-pill" [class.workspace-mentorship-status-pill-approved]="currentMentorshipReview()!.status === 'Approved'" [class.workspace-mentorship-status-pill-revision]="currentMentorshipReview()!.status === 'Needs Revision'">
                      {{ currentMentorshipReview()!.status }}
                    </span>
                  </div>
                  @if (mentorshipAttemptStatusLabel(); as attemptStatusLabel) {
                    <div class="workspace-mentorship-status-row">
                      <strong>Attempts</strong>
                      <span>{{ attemptStatusLabel }}</span>
                    </div>
                  }
                  <div class="workspace-mentorship-status-meta">
                    <span>Submitted {{ currentMentorshipReview()!.submittedAt }}</span>
                    @if (currentMentorshipReview()!.reviewedAt) {
                      <span>Reviewed {{ currentMentorshipReview()!.reviewedAt }}</span>
                    }
                  </div>
                  @if (currentMentorshipReview()!.reviewerFeedback) {
                    <div class="workspace-mentorship-feedback-block">
                      <strong>{{ currentMentorshipReview()!.reviewerName || 'Manager' }} feedback</strong>
                      <p>{{ currentMentorshipReview()!.reviewerFeedback }}</p>
                    </div>
                  }
                </div>

                <div *ngIf="currentAssignmentSubmission() && selectedAssessment()?.assessmentType === 'Assignment'" class="workspace-mentorship-status-card">
                  <div class="workspace-mentorship-status-row">
                    <strong>Review status</strong>
                    <span class="workspace-mentorship-status-pill" [class.workspace-mentorship-status-pill-approved]="currentAssignmentSubmission()!.status === 'Approved'" [class.workspace-mentorship-status-pill-revision]="currentAssignmentSubmission()!.status === 'Needs Revision'">
                      {{ currentAssignmentSubmission()!.status }}
                    </span>
                  </div>
                  @if (currentAssignmentSubmission()!.awardedPoints !== null) {
                    <div class="workspace-mentorship-status-row">
                      <strong>Mark</strong>
                      <span>{{ formatAssignmentMark(currentAssignmentSubmission()) }}</span>
                    </div>
                  }
                  @if (assessmentPassMarkLabel(); as passMarkLabel) {
                    <div class="workspace-mentorship-status-row">
                      <strong>Pass mark</strong>
                      <span>{{ passMarkLabel }}</span>
                    </div>
                  }
                  @if (assignmentAttemptStatusLabel(); as attemptStatusLabel) {
                    <div class="workspace-mentorship-status-row">
                      <strong>Attempts</strong>
                      <span>{{ attemptStatusLabel }}</span>
                    </div>
                  }
                  @if (assignmentPassResultLabel(); as assignmentResultLabel) {
                    <div class="workspace-mentorship-status-row">
                      <strong>Result</strong>
                      <span>{{ assignmentResultLabel }}</span>
                    </div>
                  }
                  <div class="workspace-mentorship-status-meta">
                    <span>Submitted {{ currentAssignmentSubmission()!.submittedAt }}</span>
                    @if (currentAssignmentSubmission()!.reviewedAt) {
                      <span>Reviewed {{ currentAssignmentSubmission()!.reviewedAt }}</span>
                    }
                  </div>
                  @if (currentAssignmentSubmission()!.reviewerFeedback) {
                    <div class="workspace-mentorship-feedback-block">
                      <strong>{{ currentAssignmentSubmission()!.reviewerName || 'Manager' }} feedback</strong>
                      <p>{{ currentAssignmentSubmission()!.reviewerFeedback }}</p>
                    </div>
                  }
                </div>

                <ng-container *ngIf="selectedAssessment()?.assessmentType === 'Mentorship'; else standardAssessmentResponseView">
                  <div class="mentorship-response-card">
                    <div class="mentorship-response-header">
                      <strong>Mentorship Session Details</strong>
                      <span>Capture the mentor, session date, and follow-up actions for this check-in.</span>
                    </div>

                    <div class="mentorship-response-grid">
                      <label class="workspace-response-field mentorship-response-field">
                        <span>Mentor name</span>
                        <input
                          type="text"
                          [value]="selectedMentorshipMentorName()"
                          [disabled]="isAssessmentSubmitted()"
                          placeholder="Enter the mentor's name"
                          (input)="updateMentorshipMentorName($any($event.target).value)" />
                      </label>

                      <label class="workspace-response-field mentorship-response-field">
                        <span>Session date</span>
                        <input
                          type="date"
                          [value]="selectedMentorshipSessionDate()"
                          [disabled]="isAssessmentSubmitted()"
                          (input)="updateMentorshipSessionDate($any($event.target).value)" />
                      </label>

                      <label class="workspace-response-field mentorship-response-field mentorship-response-field-full">
                        <span>Action plan</span>
                        <textarea
                          rows="6"
                          [value]="selectedMentorshipActionPlan()"
                          [disabled]="isAssessmentSubmitted()"
                          placeholder="Summarise the coaching discussion, agreed actions, and your next steps."
                          (input)="updateMentorshipActionPlan($any($event.target).value)"></textarea>
                      </label>
                    </div>
                  </div>

                </ng-container>

                <ng-template #standardAssessmentResponseView>
                  <ng-container *ngIf="usesTextAssessmentResponse(); else nonTextAssessmentResponseView">
                    <label class="workspace-response-field">
                      <span>Your response</span>
                      <textarea
                        rows="5"
                        [value]="selectedAssessmentResponse()"
                        [disabled]="isAssessmentSubmitted()"
                        [placeholder]="assessmentResponsePlaceholder()"
                        (input)="updateAssessmentResponse($any($event.target).value)"></textarea>
                    </label>
                  </ng-container>
                </ng-template>

                <ng-template #nonTextAssessmentResponseView>
                  <ng-container *ngIf="selectedAssessmentQuestion()?.questionType === 'Document Upload'; else nonShortAnswerAssessmentView">
                    <div class="workspace-document-response-card">
                      <div class="workspace-document-response-copy">
                        <strong>Upload your assignment document</strong>
                        <span>Upload a PDF, Word, PowerPoint, Excel, or text file for this submission.</span>
                      </div>

                      <div class="workspace-document-response-actions">
                        <label class="workspace-document-upload-btn" [class.workspace-document-upload-btn-disabled]="isAssessmentSubmitted()">
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.xlsx,.txt"
                            [disabled]="isAssessmentSubmitted()"
                            (change)="onAssignmentDocumentSelected($event)" />
                          <span>{{ selectedAssignmentDocumentSubmission().fileName ? 'Replace document' : 'Choose document' }}</span>
                        </label>

                        <button
                          *ngIf="selectedAssignmentDocumentSubmission().fileName"
                          type="button"
                          class="workspace-document-open-btn"
                          [disabled]="isAssessmentSubmitted()"
                          (click)="clearAssignmentDocumentSubmission()">
                          Remove document
                        </button>
                      </div>

                      <p class="workspace-document-response-note" *ngIf="selectedAssignmentDocumentSubmission().fileName; else noAssignmentDocumentSelected">
                        Selected file: {{ selectedAssignmentDocumentSubmission().fileName }}
                      </p>

                      <ng-template #noAssignmentDocumentSelected>
                        <p class="workspace-document-response-note">No document selected yet.</p>
                      </ng-template>
                    </div>
                  </ng-container>
                </ng-template>

                <ng-template #nonShortAnswerAssessmentView>
                  <ng-container *ngIf="selectedAssessmentQuestion()!.questionType !== 'Matching'; else matchingAssessmentView">
                  <label
                    *ngFor="let option of selectedAssessmentQuestion()!.options || []"
                    class="workspace-option"
                    [class.workspace-option-selected]="selectedAssessmentOption() === option"
                    [class.workspace-option-locked]="isAssessmentSubmitted()">
                    <input
                      type="radio"
                      name="workspace-assessment-option"
                      [checked]="selectedAssessmentOption() === option"
                      [disabled]="isAssessmentSubmitted()"
                      (change)="selectAssessmentOption(option)" />
                    <span>{{ option }}</span>
                  </label>
                  </ng-container>
                </ng-template>

                <ng-template #matchingAssessmentView>
                  <div class="workspace-matching-shell" *ngIf="selectedAssessmentQuestion()!.matchingPairs as matchingPairs">
                    <div class="workspace-matching-bank" *ngIf="availableMatchingAnswers().length">
                      <div class="workspace-matching-bank-title">Drag answers into the correct row</div>
                      <div class="workspace-matching-chip-row">
                        <button
                          *ngFor="let answer of availableMatchingAnswers()"
                          type="button"
                          class="workspace-matching-chip"
                          [draggable]="!isAssessmentSubmitted()"
                          [disabled]="isAssessmentSubmitted()"
                          (dragstart)="startMatchingDrag(answer)"
                          (dragend)="endMatchingDrag()"
                          (click)="pickMatchingAnswer(answer)">
                          {{ answer }}
                        </button>
                      </div>
                    </div>

                    <div class="workspace-matching-list">
                      <div
                        *ngFor="let pair of matchingPairs"
                        class="workspace-matching-row"
                        [class.workspace-matching-row-filled]="matchingAssignmentFor(pair.prompt)"
                        [class.workspace-matching-row-locked]="isAssessmentSubmitted()"
                        (dragover)="allowMatchingDrop($event)"
                        (drop)="dropMatchingAnswer(pair.prompt, $event)">
                        <div class="workspace-matching-prompt">{{ pair.prompt }}</div>
                        <div class="workspace-matching-dropzone" [class.workspace-matching-dropzone-empty]="!matchingAssignmentFor(pair.prompt)">
                          <span>{{ matchingAssignmentFor(pair.prompt) || 'Drop answer here' }}</span>
                          <button
                            *ngIf="matchingAssignmentFor(pair.prompt) && !isAssessmentSubmitted()"
                            type="button"
                            class="workspace-matching-clear-btn"
                            (click)="clearMatchingAssignment(pair.prompt)">
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </ng-template>

                <div *ngIf="selectedAssessmentQuestionCount() > 1" class="workspace-assessment-question-navigation">
                  <span class="workspace-assessment-question-navigation-copy">{{ assessmentQuestionProgressLabel() }}</span>
                  <div class="workspace-assessment-question-navigation-actions">
                    <button
                      type="button"
                      class="workspace-assessment-nav-btn"
                      [disabled]="!hasPreviousAssessmentQuestion()"
                      (click)="goToPreviousAssessmentQuestion()">
                      Previous question
                    </button>
                    <button
                      type="button"
                      class="workspace-assessment-nav-btn"
                      [disabled]="!hasNextAssessmentQuestion()"
                      (click)="goToNextAssessmentQuestion()">
                      Next question
                    </button>
                  </div>
                </div>

                <div *ngIf="quizResultBanner() as quizResult" class="workspace-assessment-result-card" [class.workspace-assessment-result-card-error]="quizResult.tone === 'error'" aria-live="polite">
                  <div class="workspace-assessment-result-icon-shell" [class.workspace-assessment-result-icon-shell-error]="quizResult.tone === 'error'" aria-hidden="true">
                    <svg *ngIf="quizResult.tone === 'success'; else failedQuizResultIcon" class="workspace-assessment-result-icon" viewBox="0 0 48 48" fill="none">
                      <circle cx="24" cy="24" r="18" class="workspace-assessment-result-ring"></circle>
                      <path d="M16 24.5 21.5 30 32 19.5" class="workspace-assessment-result-mark"></path>
                    </svg>

                    <ng-template #failedQuizResultIcon>
                      <svg class="workspace-assessment-result-icon" viewBox="0 0 48 48" fill="none">
                        <circle cx="24" cy="24" r="18" class="workspace-assessment-result-ring"></circle>
                        <path d="M18 18 30 30" class="workspace-assessment-result-mark"></path>
                        <path d="M30 18 18 30" class="workspace-assessment-result-mark"></path>
                      </svg>
                    </ng-template>
                  </div>

                  <div class="workspace-assessment-result-copy">
                    <strong>{{ quizResult.title }}</strong>
                    <span>{{ quizResult.summary }}</span>
                    <span *ngIf="quizResult.prompt" class="workspace-assessment-result-prompt">{{ quizResult.prompt }}</span>
                  </div>
                </div>

                <div class="workspace-assessment-actions">
                  <p *ngIf="assessmentStatusNotice() as assessmentNotice" class="workspace-assessment-note" [class.workspace-assessment-note-error]="assessmentNotice.tone === 'error'" aria-live="polite">{{ assessmentNotice.message }}</p>
                  <button
                    type="button"
                    class="workspace-assessment-submit-btn"
                    [disabled]="!canSubmitAssessment() || isAssessmentSubmitted()"
                    (click)="submitAssessment()">
                    {{ isAssessmentSubmitted() ? submittedAssessmentButtonLabel() : submitAssessmentButtonLabel() }}
                  </button>
                  <button
                    *ngIf="canStartQuizRetake()"
                    type="button"
                    class="workspace-assessment-submit-btn"
                    (click)="startQuizRetake()">
                    Retake Assessment
                  </button>
                </div>

                <div *ngIf="isAssessmentSubmitted() && selectedAssessment()?.assessmentType === 'Mentorship'" class="workspace-submitted-response-card workspace-submitted-mentorship-card">
                  <div class="workspace-submitted-response-title">{{ submittedResponseTitle() }}</div>
                  <div class="workspace-submitted-mentorship-grid">
                    <div>
                      <strong>Mentor</strong>
                      <span>{{ selectedMentorshipMentorName() || 'Not provided' }}</span>
                    </div>
                    <div>
                      <strong>Session date</strong>
                      <span>{{ selectedMentorshipSessionDate() || 'Not provided' }}</span>
                    </div>
                    <div class="workspace-submitted-mentorship-full">
                      <strong>Action plan</strong>
                      <p>{{ selectedMentorshipActionPlan().trim() || 'Not provided' }}</p>
                    </div>
                  </div>
                </div>

                <div *ngIf="currentAssignmentSubmission() && selectedAssessment()?.assessmentType === 'Assignment' && selectedAssessmentQuestion()?.questionType === 'Short Answer' && currentAssignmentSubmission()?.responseText" class="workspace-submitted-response-card">
                  <div class="workspace-submitted-response-title">{{ submittedResponseTitle() }}</div>
                  @if (assignmentResultSummaryLabel(); as assignmentResultSummary) {
                    <div class="workspace-submitted-assignment-result">
                      <strong>Manager mark</strong>
                      <span>{{ assignmentResultSummary }}</span>
                    </div>
                  }
                  <p>{{ currentAssignmentSubmission()?.responseText }}</p>
                </div>

                <div *ngIf="currentAssignmentSubmission() && selectedAssessment()?.assessmentType === 'Assignment' && selectedAssessmentQuestion()?.questionType === 'Long Answer' && currentAssignmentSubmission()?.responseText" class="workspace-submitted-response-card">
                  <div class="workspace-submitted-response-title">{{ submittedResponseTitle() }}</div>
                  @if (assignmentResultSummaryLabel(); as assignmentResultSummary) {
                    <div class="workspace-submitted-assignment-result">
                      <strong>Manager mark</strong>
                      <span>{{ assignmentResultSummary }}</span>
                    </div>
                  }
                  <p>{{ currentAssignmentSubmission()?.responseText }}</p>
                </div>

                <div *ngIf="currentAssignmentSubmission() && selectedAssessment()?.assessmentType === 'Assignment' && selectedAssessmentQuestion()?.questionType === 'Document Upload' && currentAssignmentSubmission()?.documentFileName" class="workspace-submitted-response-card">
                  <div class="workspace-submitted-response-title">{{ submittedResponseTitle() }}</div>
                  @if (assignmentResultSummaryLabel(); as assignmentResultSummary) {
                    <div class="workspace-submitted-assignment-result">
                      <strong>Manager mark</strong>
                      <span>{{ assignmentResultSummary }}</span>
                    </div>
                  }
                  <div class="workspace-submitted-document-row">
                    <span>{{ currentAssignmentSubmission()?.documentFileName }}</span>
                    <button type="button" class="workspace-document-open-btn" (click)="openAssignmentDocumentSubmission()">Open submitted document</button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </ng-template>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      flex: 1;
    }

    .courses-content {
      width: 100%;
      min-height: 100%;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      padding: 1.75rem;
      box-sizing: border-box;
      font-family: 'Inter', 'Segoe UI', 'Roboto', Arial, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(99, 102, 241, 0.12), transparent 28%),
        linear-gradient(180deg, #f8faff 0%, #f3f6fb 100%);
      border-radius: 28px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
    }

    .course-workspace {
      display: grid;
      gap: 1rem;
      min-height: 100%;
    }

    .courses-header {
      display: flex;
      flex-direction: column;
      text-align: left;
    }

    .courses-subtitle {
      margin: 0;
      color: #64748b;
      font-size: 1rem;
      max-width: 40rem;
    }

    .courses-tabs-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .courses-search-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .courses-search-icon {
      position: absolute;
      left: 0.75rem;
      pointer-events: none;
      flex-shrink: 0;
    }

    .courses-search-input {
      border: 1px solid rgba(99, 102, 241, 0.18);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.88);
      color: #1e293b;
      padding: 0.65rem 1rem 0.65rem 2.25rem;
      font-size: 0.95rem;
      width: 16rem;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .courses-search-input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
    }

    .courses-search-input::placeholder {
      color: #94a3b8;
    }

    .courses-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .courses-tabs button {
      border: 1px solid rgba(99, 102, 241, 0.14);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.88);
      color: #6366f1;
      padding: 0.75rem 1.35rem;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
    }

    .courses-tabs button.active,
    .courses-tabs button:hover,
    .courses-tabs button:focus-visible {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #fff;
      box-shadow: 0 12px 24px rgba(79, 70, 229, 0.18);
      transform: translateY(-1px);
      outline: none;
    }

    .courses-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 280px));
      justify-content: start;
      gap: 1.25rem;
    }

    .courses-empty-state {
      grid-column: 1 / -1;
      display: grid;
      gap: 0.45rem;
      padding: 1.4rem;
      border-radius: 20px;
      border: 1px solid #dbeafe;
      background: linear-gradient(135deg, rgba(239, 246, 255, 0.96), rgba(255, 255, 255, 0.98));
      color: #1e3a8a;
    }

    .courses-empty-state h3 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 800;
    }

    .courses-empty-state p {
      margin: 0;
      color: #475569;
      line-height: 1.6;
    }

    .course-card {
      background: rgba(255, 255, 255, 0.92);
      border-radius: 20px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-width: 0;
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.06);
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }

    .course-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 18px 36px rgba(15, 23, 42, 0.09);
    }

    .course-card.completed {
      border: 1px solid rgba(56, 189, 248, 0.35);
    }

    .course-card-top {
      position: relative;
      height: 96px;
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      padding: 0.7rem;
      isolation: isolate;
    }

    .course-card-top::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.14), rgba(15, 23, 42, 0.32));
      z-index: -1;
      transition: background 0.22s ease;
    }

    .course-status-pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.92);
      color: #4f46e5;
      padding: 0.28rem 0.65rem;
      font-size: 0.78rem;
      font-weight: 700;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
    }

    .eye-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      background: rgba(100, 116, 139, 0.26);
      transition: opacity 0.22s cubic-bezier(.4,0,.2,1);
    }

    .eye-icon {
      filter: drop-shadow(0 2px 12px rgba(0,0,0,0.18));
      transform: scale(0.7);
      opacity: 0;
      transition: transform 0.28s cubic-bezier(.4,0,.2,1), opacity 0.22s cubic-bezier(.4,0,.2,1);
    }

    .course-card:hover .eye-overlay {
      opacity: 1;
    }

    .course-card:hover .course-card-top::after {
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.34), rgba(15, 23, 42, 0.52));
    }

    .course-card:hover .eye-icon {
      transform: scale(1.18);
      opacity: 1;
    }

    .course-card-body {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      padding: 0.9rem 1rem;
      text-align: center;
    }

    .course-title {
      color: #14213d;
      font-size: 1rem;
      font-weight: 700;
    }

    /* Clamped to 2 lines (instead of a fixed min-height reserving that space even when the
       description is short) so a long description gets an ellipsis rather than stretching the
       card, and a short one doesn't leave dead space below it. */
    .course-description {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      color: #64748b;
      font-size: 0.86rem;
      line-height: 1.35;
    }

    /* Only rendered for a not-yet-completed course whose offering has a deadline set — neutral
       blue normally, amber inside the last 7 days, red once it's passed, matching the same
       urgency colours used for this course's deadline everywhere else it appears (the manager's
       course card, the calendar). Floats directly over the thumbnail (bottom-left, no background
       box); a text-shadow instead of a solid pill keeps it legible against whatever image happens
       to be behind it. */
    .course-deadline-badge {
      position: absolute;
      left: 0.65rem;
      bottom: 0.65rem;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      color: #eff6ff;
      font-size: 0.72rem;
      font-weight: 700;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
    }

    .course-deadline-badge-soon {
      color: #fde68a;
    }

    .course-deadline-badge-overdue {
      color: #fecaca;
    }

    .progress-bar {
      width: 100%;
      height: 0.5rem;
      border-radius: 999px;
      background: #e5e7eb;
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #818cf8, #38bdf8);
      transition: width 0.3s ease;
    }

    .progress-label {
      color: #475569;
      font-size: 0.82rem;
      font-weight: 600;
    }

    .workspace-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .workspace-header h2 {
      margin: 0.35rem 0 0;
      color: #14213d;
      font-size: clamp(1.7rem, 2.5vw, 2.1rem);
      font-weight: 800;
    }

    .workspace-meta {
      margin: 0.35rem 0 0;
      color: #64748b;
      font-size: 0.95rem;
    }

    .workspace-back-btn {
      border: 1px solid #c7d2fe;
      border-radius: 999px;
      background: #eef2ff;
      color: #4338ca;
      padding: 0.5rem 0.9rem;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
    }

    .workspace-layout {
      display: grid;
      grid-template-columns: 240px minmax(0, 1fr);
      gap: 1rem;
      min-height: 34rem;
    }

    .workspace-sidebar {
      display: grid;
      gap: 1rem;
      padding: 1rem;
      border-radius: 22px;
      background: #111827;
      color: #fff;
      align-content: start;
    }

    .workspace-side-group {
      display: grid;
      gap: 0.55rem;
    }

    .workspace-side-title {
      color: rgba(255, 255, 255, 0.64);
      font-size: 0.74rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .workspace-side-item,
    .workspace-doc-item {
      border: 1px solid transparent;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.04);
      color: #e5e7eb;
      padding: 0.75rem 0.8rem;
      font-size: 0.9rem;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
      display: flex;
      align-items: flex-start;
      gap: 0.8rem;
    }

    .workspace-doc-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.65rem;
    }

    .workspace-side-item-active {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #fff;
    }

    .workspace-step-index {
      width: 1.8rem;
      height: 1.8rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
      color: inherit;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.78rem;
      font-weight: 800;
      flex: 0 0 auto;
    }

    .workspace-step-copy {
      display: grid;
      gap: 0.18rem;
      min-width: 0;
    }

    .workspace-step-title {
      color: inherit;
      font-size: 0.92rem;
      font-weight: 700;
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }

    .workspace-step-meta {
      color: rgba(229, 231, 235, 0.72);
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .workspace-doc-item-active {
      border-color: rgba(99, 102, 241, 0.38);
      background: rgba(99, 102, 241, 0.16);
      color: #fff;
    }

    .workspace-doc-badge {
      border-radius: 999px;
      background: rgba(251, 191, 36, 0.18);
      color: #fde68a;
      padding: 0.18rem 0.5rem;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .workspace-side-group-docs {
      padding-top: 0.85rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }

    .workspace-main {
      display: grid;
      gap: 1rem;
      align-content: start;
    }

    .workspace-summary {
      color: #475569;
      font-size: 0.95rem;
      line-height: 1.6;
    }

    .workspace-step-card {
      padding: 1rem 1.1rem;
      border-radius: 18px;
      border: 1px solid rgba(99, 102, 241, 0.15);
      background: linear-gradient(135deg, rgba(238, 242, 255, 0.94), rgba(255, 255, 255, 0.98));
    }

    .workspace-step-card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .workspace-step-card-eyebrow {
      color: #4f46e5;
      font-size: 0.74rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .workspace-step-card h3 {
      margin: 0.35rem 0 0;
      color: #14213d;
      font-size: 1.1rem;
      font-weight: 800;
    }

    .workspace-step-card p {
      margin: 0.35rem 0 0;
      color: #475569;
      line-height: 1.6;
    }

    .workspace-step-pill {
      border-radius: 999px;
      background: rgba(79, 70, 229, 0.1);
      color: #4338ca;
      padding: 0.45rem 0.8rem;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .workspace-document-card {
      display: grid;
      gap: 0.85rem;
      padding: 1rem;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(239, 246, 255, 0.96), rgba(255, 255, 255, 0.98));
      border: 1px solid rgba(37, 99, 235, 0.15);
    }

    .workspace-document-card-copy {
      display: grid;
      gap: 0.22rem;
    }

    .workspace-document-card-title {
      color: #173446;
      font-size: 1rem;
      font-weight: 800;
    }

    .workspace-document-card-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      color: #475569;
      font-size: 0.88rem;
      font-weight: 700;
    }

    .workspace-document-card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
    }

    .workspace-document-preview {
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(37, 99, 235, 0.16);
      background: #fff;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }

    .workspace-document-embed {
      display: block;
      width: 100%;
      min-height: 28rem;
      height: min(42rem, 70vh);
      border: none;
      background: #f8fafc;
    }

    .workspace-scorm-player {
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(37, 99, 235, 0.16);
      background: #fff;
      min-height: 32rem;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }

    .workspace-scorm-frame {
      display: block;
      width: 100%;
      min-height: 32rem;
      height: min(48rem, 75vh);
      border: none;
      background: #fff;
    }

    .workspace-video-card {
      border-radius: 18px;
      overflow: hidden;
      background: #0f172a;
      min-height: 15rem;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    .workspace-video-player {
      display: block;
      width: 100%;
      min-height: 15rem;
      max-height: 28rem;
      background: #020617;
    }

    .workspace-video-embed {
      display: block;
      width: 100%;
      min-height: 15rem;
      height: min(28rem, 56.25vw);
      border: none;
      background: #020617;
    }

    .workspace-video-placeholder {
      display: grid;
      place-items: center;
      align-content: center;
      gap: 0.8rem;
      min-height: 15rem;
      color: #fff;
      font-size: 0.95rem;
      font-weight: 700;
      text-align: center;
      padding: 1.25rem;
      box-sizing: border-box;
    }

    .workspace-video-placeholder-copy {
      color: rgba(255, 255, 255, 0.72);
      font-size: 0.9rem;
      font-weight: 600;
    }

    .workspace-video-play-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 6rem;
      height: 6rem;
      border-radius: 999px;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.04));
      box-shadow: 0 18px 36px rgba(15, 23, 42, 0.3);
      transition: transform 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;
      cursor: pointer;
    }

    .workspace-video-play-icon svg {
      display: block;
      transition: transform 0.22s ease, filter 0.22s ease;
    }

    .workspace-video-play-icon:hover,
    .workspace-video-play-icon:focus-visible {
      transform: translateY(-2px) scale(1.05);
      background: radial-gradient(circle, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.08));
      box-shadow: 0 24px 42px rgba(15, 23, 42, 0.34);
      outline: none;
    }

    .workspace-video-play-icon:hover svg,
    .workspace-video-play-icon:focus-visible svg {
      transform: scale(1.08);
      filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.22));
    }

    .workspace-video-duration {
      padding: 0.65rem 0.85rem;
      border-radius: 10px;
      background: #fff;
      border: 1px solid #e2e8f0;
      color: #64748b;
      font-size: 0.88rem;
    }

    .workspace-question-card {
      display: grid;
      gap: 0.9rem;
      padding: 1rem;
      border-radius: 18px;
      background: #fff;
      border: 1px solid #e2e8f0;
    }

    .workspace-question-card h3 {
      margin: 0;
      color: #14213d;
      font-size: 1.1rem;
      font-weight: 800;
    }

    .workspace-question-title {
      color: #4338ca;
      font-size: 0.88rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .workspace-question-prompt {
      color: #14213d;
      font-size: 0.95rem;
      font-weight: 700;
    }

    .workspace-assessment-question-navigation {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.8rem 0.9rem;
      border-radius: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }

    .workspace-assessment-question-navigation-copy {
      color: #334155;
      font-size: 0.86rem;
      font-weight: 700;
    }

    .workspace-assessment-question-navigation-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
    }

    .workspace-assessment-nav-btn {
      border: 1px solid rgba(99, 102, 241, 0.18);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.96);
      color: #4338ca;
      padding: 0.65rem 0.9rem;
      font: inherit;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
    }

    .workspace-assessment-nav-btn:hover,
    .workspace-assessment-nav-btn:focus-visible {
      transform: translateY(-1px);
      box-shadow: 0 10px 18px rgba(79, 70, 229, 0.12);
      outline: none;
    }

    .workspace-assessment-nav-btn:disabled {
      cursor: not-allowed;
      opacity: 0.45;
      transform: none;
      box-shadow: none;
    }

    .workspace-assessment-setting-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
    }

    .workspace-assessment-setting-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.4rem 0.72rem;
      border-radius: 999px;
      background: #eef2ff;
      color: #4338ca;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.03em;
    }

    .workspace-assignment-brief {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
      padding: 0.9rem 0.95rem;
      border-radius: 16px;
      border: 1px solid rgba(99, 102, 241, 0.18);
      background: linear-gradient(135deg, rgba(238, 242, 255, 0.98), rgba(255, 255, 255, 0.98));
      box-shadow: 0 12px 24px rgba(79, 70, 229, 0.08);
    }

    .workspace-assignment-brief-copy {
      display: grid;
      gap: 0.12rem;
    }

    .workspace-assignment-brief-copy strong,
    .workspace-assignment-brief-copy span {
      margin: 0;
    }

    .workspace-assignment-brief-copy strong {
      color: #3730a3;
      font-size: 0.86rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .workspace-assignment-brief-copy span {
      color: #4338ca;
      font-size: 0.92rem;
      font-weight: 700;
      line-height: 1.45;
    }

    .workspace-document-open-btn {
      border: none;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.1);
      color: #1d4ed8;
      padding: 0.72rem 1rem;
      font: inherit;
      font-size: 0.88rem;
      font-weight: 800;
      cursor: pointer;
      transition: background 0.16s ease, color 0.16s ease, opacity 0.16s ease;
    }

    .workspace-document-open-btn:hover,
    .workspace-document-open-btn:focus-visible {
      background: rgba(37, 99, 235, 0.16);
      color: #1e40af;
      outline: none;
    }

    .workspace-document-open-btn:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .workspace-document-upload-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: linear-gradient(135deg, #0f766e, #0d9488);
      color: #fff;
      padding: 0.78rem 1.15rem;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 14px 26px rgba(13, 148, 136, 0.18);
      transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
    }

    .workspace-document-upload-btn:hover,
    .workspace-document-upload-btn:focus-within {
      transform: translateY(-1px);
      box-shadow: 0 16px 30px rgba(13, 148, 136, 0.22);
    }

    .workspace-document-upload-btn input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }

    .workspace-document-upload-btn-disabled {
      cursor: not-allowed;
      opacity: 0.55;
      box-shadow: none;
      transform: none;
    }

    .workspace-document-upload-btn-disabled input {
      cursor: not-allowed;
    }

    .workspace-acknowledgement-card {
      display: grid;
      gap: 0.9rem;
      padding: 1rem;
      border-radius: 18px;
      border: 1px solid rgba(14, 116, 144, 0.18);
      background: linear-gradient(135deg, rgba(236, 254, 255, 0.95), rgba(255, 255, 255, 0.98));
    }

    .workspace-acknowledgement-copy {
      display: grid;
      gap: 0.3rem;
    }

    .workspace-acknowledgement-copy strong {
      color: #0f766e;
      font-size: 0.95rem;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .workspace-acknowledgement-copy span {
      color: #475569;
      font-size: 0.92rem;
      line-height: 1.55;
    }

    .workspace-acknowledgement-note {
      margin: 0;
      color: #155e75;
      font-size: 0.9rem;
      font-weight: 700;
    }

    .workspace-acknowledgement-note-success {
      color: #047857;
    }

    .workspace-acknowledgement-note-warning {
      color: #b45309;
    }

    .workspace-mentorship-status-card {
      display: grid;
      gap: 0.55rem;
      padding: 0.95rem 1rem;
      border-radius: 16px;
      border: 1px solid rgba(59, 130, 246, 0.16);
      background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
    }

    .workspace-mentorship-status-row,
    .workspace-mentorship-status-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.6rem;
    }

    .workspace-mentorship-status-row strong {
      color: #173446;
      font-size: 0.9rem;
    }

    .workspace-mentorship-status-meta {
      color: #64748b;
      font-size: 0.82rem;
      justify-content: flex-start;
    }

    .workspace-mentorship-status-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.35rem 0.7rem;
      border-radius: 999px;
      background: #fef3c7;
      color: #b45309;
      font-size: 0.78rem;
      font-weight: 800;
    }

    .workspace-mentorship-status-pill-approved {
      background: #dcfce7;
      color: #15803d;
    }

    .workspace-mentorship-status-pill-revision {
      background: #ffedd5;
      color: #c2410c;
    }

    .workspace-mentorship-feedback-block {
      display: grid;
      gap: 0.25rem;
      padding-top: 0.25rem;
      border-top: 1px solid rgba(148, 163, 184, 0.2);
    }

    .workspace-mentorship-feedback-block strong {
      color: #0f766e;
      font-size: 0.8rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .workspace-mentorship-feedback-block p {
      margin: 0;
      color: #334155;
      font-size: 0.9rem;
      line-height: 1.55;
      white-space: pre-wrap;
    }

    .workspace-response-field {
      display: grid;
      gap: 0.45rem;
      color: #173446;
      font-size: 0.86rem;
      font-weight: 800;
    }

    .workspace-response-field textarea {
      width: 100%;
      box-sizing: border-box;
      min-height: 9.5rem;
      border: 1px solid #dbe2ea;
      border-radius: 16px;
      background: #f8fafc;
      color: #173446;
      padding: 0.95rem 1rem;
      font: inherit;
      font-size: 0.92rem;
      line-height: 1.6;
      resize: vertical;
    }

    .workspace-response-field input {
      width: 100%;
      box-sizing: border-box;
      min-height: 3.25rem;
      border: 1px solid #dbe2ea;
      border-radius: 16px;
      background: #f8fafc;
      color: #173446;
      padding: 0.85rem 1rem;
      font: inherit;
      font-size: 0.92rem;
    }

    .workspace-response-field input:focus-visible,
    .workspace-response-field textarea:focus-visible {
      outline: 3px solid rgba(99, 102, 241, 0.22);
      outline-offset: 1px;
      border-color: #818cf8;
      background: #fff;
    }

    .workspace-document-response-card {
      display: grid;
      gap: 0.9rem;
      padding: 1rem;
      border-radius: 18px;
      border: 1px solid rgba(13, 148, 136, 0.18);
      background: linear-gradient(135deg, rgba(240, 253, 250, 0.96), rgba(255, 255, 255, 0.98));
    }

    .workspace-document-response-copy {
      display: grid;
      gap: 0.3rem;
    }

    .workspace-document-response-copy strong {
      color: #0f766e;
      font-size: 0.94rem;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .workspace-document-response-copy span,
    .workspace-document-response-note {
      margin: 0;
      color: #134e4a;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .workspace-document-response-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
    }

    .mentorship-response-card {
      display: grid;
      gap: 0.9rem;
      padding: 1rem;
      border-radius: 18px;
      border: 1px solid rgba(59, 130, 246, 0.16);
      background: linear-gradient(135deg, rgba(239, 246, 255, 0.96), rgba(255, 255, 255, 0.98));
    }

    .mentorship-response-header {
      display: grid;
      gap: 0.25rem;
    }

    .mentorship-response-header strong {
      color: #1d4ed8;
      font-size: 0.95rem;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .mentorship-response-header span {
      color: #475569;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .mentorship-response-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.85rem;
    }

    .mentorship-response-field {
      gap: 0.4rem;
    }

    .mentorship-response-field-full {
      grid-column: 1 / -1;
    }

    .workspace-option {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      padding: 0.85rem 0.95rem;
      border-radius: 14px;
      border: 1px solid #e5e7eb;
      background: #f8fafc;
      color: #334155;
      font-size: 0.92rem;
      transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
    }

    .workspace-option input {
      margin: 0;
    }

    .workspace-option-selected {
      border-color: #818cf8;
      background: #eef2ff;
      box-shadow: 0 10px 24px rgba(99, 102, 241, 0.12);
    }

    .workspace-option-locked {
      cursor: default;
      opacity: 0.9;
    }

    .workspace-matching-shell {
      display: grid;
      gap: 0.9rem;
    }

    .workspace-matching-bank {
      display: grid;
      gap: 0.55rem;
      padding: 0.85rem 0.95rem;
      border-radius: 16px;
      border: 1px solid #dbe5f0;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
    }

    .workspace-matching-bank-title {
      color: #4338ca;
      font-size: 0.82rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .workspace-matching-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
    }

    .workspace-matching-chip {
      border: 1px solid rgba(79, 70, 229, 0.14);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.94);
      color: #3730a3;
      padding: 0.62rem 0.9rem;
      font: inherit;
      font-size: 0.86rem;
      font-weight: 700;
      cursor: grab;
      box-shadow: 0 8px 18px rgba(79, 70, 229, 0.08);
    }

    .workspace-matching-chip:disabled {
      cursor: not-allowed;
      opacity: 0.55;
      box-shadow: none;
    }

    .workspace-matching-list {
      display: grid;
      gap: 0.7rem;
    }

    .workspace-matching-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(220px, 0.9fr);
      gap: 0.8rem;
      align-items: stretch;
      padding: 0.85rem;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .workspace-matching-row-filled {
      border-color: rgba(59, 130, 246, 0.28);
      background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
    }

    .workspace-matching-row-locked {
      opacity: 0.92;
    }

    .workspace-matching-prompt {
      display: flex;
      align-items: center;
      color: #14213d;
      font-size: 0.92rem;
      font-weight: 700;
      line-height: 1.45;
    }

    .workspace-matching-dropzone {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      min-height: 3.4rem;
      padding: 0.75rem 0.85rem;
      border-radius: 14px;
      border: 1px dashed #94a3b8;
      background: #fff;
      color: #1e3a8a;
      font-size: 0.88rem;
      font-weight: 700;
    }

    .workspace-matching-dropzone-empty {
      color: #94a3b8;
      font-weight: 600;
    }

    .workspace-matching-clear-btn {
      border: none;
      border-radius: 999px;
      background: #eef2ff;
      color: #4338ca;
      padding: 0.45rem 0.75rem;
      font: inherit;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
    }

    .workspace-assessment-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding-top: 0.2rem;
    }

    .workspace-assessment-result-card {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.95rem;
      align-items: center;
      padding: 1rem 1.05rem;
      border-radius: 18px;
      border: 1px solid rgba(34, 197, 94, 0.26);
      background: linear-gradient(135deg, rgba(240, 253, 244, 0.98), rgba(255, 255, 255, 0.98));
      box-shadow: 0 14px 28px rgba(34, 197, 94, 0.12);
    }

    .workspace-assessment-result-card-error {
      border-color: rgba(239, 68, 68, 0.24);
      background: linear-gradient(135deg, rgba(254, 242, 242, 0.98), rgba(255, 255, 255, 0.98));
      box-shadow: 0 14px 28px rgba(239, 68, 68, 0.1);
    }

    .workspace-assessment-result-icon-shell {
      width: 3.35rem;
      height: 3.35rem;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: radial-gradient(circle at top, rgba(255, 255, 255, 0.96), rgba(187, 247, 208, 0.9));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 12px 24px rgba(34, 197, 94, 0.18);
      animation: workspace-result-burst 0.55s cubic-bezier(0.2, 0.9, 0.2, 1) both;
    }

    .workspace-assessment-result-icon-shell-error {
      background: radial-gradient(circle at top, rgba(255, 255, 255, 0.96), rgba(254, 202, 202, 0.9));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 12px 24px rgba(239, 68, 68, 0.16);
    }

    .workspace-assessment-result-icon {
      width: 2.4rem;
      height: 2.4rem;
    }

    .workspace-assessment-result-ring,
    .workspace-assessment-result-mark {
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .workspace-assessment-result-ring {
      stroke: #16a34a;
      stroke-width: 2.4;
      opacity: 0.28;
    }

    .workspace-assessment-result-card-error .workspace-assessment-result-ring {
      stroke: #dc2626;
    }

    .workspace-assessment-result-mark {
      stroke: #15803d;
      stroke-width: 3.25;
      stroke-dasharray: 30;
      stroke-dashoffset: 30;
      animation: workspace-result-draw 0.42s ease-out 0.18s forwards;
    }

    .workspace-assessment-result-card-error .workspace-assessment-result-mark {
      stroke: #b91c1c;
    }

    .workspace-assessment-result-copy {
      display: grid;
      gap: 0.2rem;
    }

    .workspace-assessment-result-copy strong {
      color: #166534;
      font-size: 0.98rem;
      font-weight: 800;
    }

    .workspace-assessment-result-card-error .workspace-assessment-result-copy strong {
      color: #991b1b;
    }

    .workspace-assessment-result-copy span {
      color: #166534;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .workspace-assessment-result-card-error .workspace-assessment-result-copy span {
      color: #991b1b;
    }

    .workspace-assessment-result-prompt {
      font-weight: 700;
    }

    .workspace-assessment-note {
      margin: 0;
      color: #15803d;
      font-size: 0.9rem;
      font-weight: 700;
    }

    .workspace-assessment-note-error {
      color: #b91c1c;
    }

    .workspace-submitted-response-card {
      display: grid;
      gap: 0.35rem;
      padding: 0.95rem 1rem;
      border-radius: 16px;
      border: 1px solid rgba(16, 185, 129, 0.24);
      background: linear-gradient(135deg, rgba(236, 253, 245, 0.98), rgba(255, 255, 255, 0.98));
      box-shadow: 0 10px 22px rgba(16, 185, 129, 0.08);
    }

    .workspace-submitted-response-title {
      color: #047857;
      font-size: 0.82rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .workspace-submitted-response-card p {
      margin: 0;
      color: #14532d;
      font-size: 0.92rem;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .workspace-submitted-assignment-result {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem 0.75rem;
      padding: 0.65rem 0.8rem;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(16, 185, 129, 0.18);
      color: #14532d;
    }

    .workspace-submitted-assignment-result strong {
      color: #047857;
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .workspace-submitted-assignment-result span {
      font-size: 0.9rem;
      font-weight: 700;
    }

    .workspace-submitted-document-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      color: #14532d;
      font-size: 0.92rem;
      font-weight: 700;
    }

    .workspace-submitted-mentorship-card {
      gap: 0.7rem;
    }

    .workspace-submitted-mentorship-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.85rem;
    }

    .workspace-submitted-mentorship-grid div {
      display: grid;
      gap: 0.25rem;
    }

    .workspace-submitted-mentorship-grid strong {
      color: #047857;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .workspace-submitted-mentorship-grid span,
    .workspace-submitted-mentorship-grid p {
      margin: 0;
      color: #14532d;
      font-size: 0.92rem;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .workspace-submitted-mentorship-full {
      grid-column: 1 / -1;
    }

    .workspace-assessment-submit-btn {
      border: none;
      border-radius: 999px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff;
      padding: 0.78rem 1.15rem;
      font-size: 0.92rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 14px 26px rgba(37, 99, 235, 0.2);
      transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
    }

    .workspace-assessment-submit-btn:hover,
    .workspace-assessment-submit-btn:focus-visible {
      transform: translateY(-1px);
      box-shadow: 0 16px 30px rgba(37, 99, 235, 0.24);
      outline: none;
    }

    .workspace-assessment-submit-btn:disabled {
      cursor: not-allowed;
      opacity: 0.55;
      transform: none;
      box-shadow: none;
    }

    @keyframes workspace-result-burst {
      0% {
        opacity: 0;
        transform: scale(0.7);
      }

      70% {
        opacity: 1;
        transform: scale(1.08);
      }

      100% {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes workspace-result-draw {
      to {
        stroke-dashoffset: 0;
      }
    }

    @media (max-width: 720px) {
      .courses-content {
        padding: 1rem;
        border-radius: 22px;
      }

      .course-card {
        border-radius: 18px;
      }

      .workspace-header,
      .workspace-layout {
        grid-template-columns: 1fr;
      }

      .workspace-header {
        flex-direction: column;
      }

      .workspace-matching-row {
        grid-template-columns: 1fr;
      }

      .workspace-assessment-result-card {
        grid-template-columns: 1fr;
        justify-items: start;
      }

      .mentorship-response-grid,
      .workspace-submitted-mentorship-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class StudentCoursesComponent {
  private static readonly scormRuntimeStorageKey = 'lms-student-scorm-runtime';
  readonly backend = inject(LmsBackendService);
  readonly studentData = inject(StudentDataService);
  readonly managerData = inject(TrainingManagerDataService);
  readonly sanitizer = inject(DomSanitizer);
  readonly document = inject(DOCUMENT);
  readonly activeTab = signal<'inprogress' | 'completed'>('inprogress');
  readonly selectedCourse = signal<StudentCourse | null>(null);
  readonly selectedDocumentTitle = signal('');
  readonly selectedVideoTitle = signal('');
  readonly assessmentSelections = signal<Record<string, string>>({});
  readonly assessmentResponses = signal<Record<string, string>>({});
  readonly assignmentDocumentSubmissions = signal<Record<string, AssignmentDocumentSubmission>>({});
  readonly mentorshipSubmissions = signal<Record<string, MentorshipSubmission>>({});
  readonly matchingAssignments = signal<Record<string, Record<string, string>>>({});
  readonly openedDocumentAcknowledgements = signal<Record<string, boolean>>({});
  readonly acknowledgedDocuments = signal<Record<string, boolean>>({});
  readonly scormRuntime = signal<Record<string, ScormRuntimeState>>(this.loadPersistedScormRuntime());
  readonly loadedVideoDurations = signal<Record<string, string>>({});
  readonly completedCourseSteps = signal<Record<string, boolean>>({});
  readonly draggedMatchingAnswer = signal('');
  readonly pickedMatchingAnswer = signal('');
  readonly selectedCourseStepId = signal('');
  readonly selectedAssessmentQuestionIndex = signal(0);
  readonly assessmentSubmissionFeedback = signal<{ message: string; tone: 'success' | 'error' } | null>(null);
  readonly retakingQuizAssessments = signal<Record<string, boolean>>({});
  readonly searchQuery = signal('');
  readonly filteredCourses = computed(() => {
    const tab = this.activeTab() === 'inprogress' ? this.studentData.inProgressCourses() : this.studentData.completedCourses();
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return tab;
    return tab.filter((c) => c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q));
  });

  // Same match-by-offeringId-then-title fallback the calendar's buildCalendarEvents uses to find
  // a course's offering — see student-data.service.ts.
  private resolveCourseOffering(course: StudentCourse): TrainingOffering | undefined {
    const offerings = this.managerData.offerings();
    return course.offeringId
      ? offerings.find((offering) => offering.id === course.offeringId)
      : offerings.find((offering) => offering.title === course.name);
  }

  // Parsed as LOCAL midnight, matching parseCalendarDate in student-data.service.ts (which the
  // Calendar tab and Dashboard both key off for this exact same completionDeadline field). Parsing
  // as UTC midnight here instead — as an earlier version of this method did — made the two tabs
  // disagree on whether a course was overdue for any student west of UTC in the evening (UTC has
  // already rolled to the next day while the student's local "today" hasn't), and the other way
  // around for students east of UTC.
  private courseDeadlineDate(course: StudentCourse): Date | null {
    // A completed course has no pending deadline to act on any more, same exclusion the calendar
    // applies — a finished course keeping a "Due ..." badge would read as still outstanding work.
    if (course.completed) {
      return null;
    }

    const raw = this.resolveCourseOffering(course)?.completionDeadline?.trim();
    if (!raw) {
      return null;
    }

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!isoMatch) {
      return null;
    }

    const [, year, month, day] = isoMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  courseDeadlineLabel(course: StudentCourse): string | null {
    const date = this.courseDeadlineDate(course);
    return date ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  }

  courseDeadlineStatus(course: StudentCourse): 'overdue' | 'soon' | 'normal' {
    const date = this.courseDeadlineDate(course);
    if (!date) {
      return 'normal';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysRemaining = Math.round((date.getTime() - today.getTime()) / 86_400_000);

    if (daysRemaining < 0) {
      return 'overdue';
    }

    return daysRemaining <= 7 ? 'soon' : 'normal';
  }
  readonly selectedCourseWorkspace = computed(() => {
    const course = this.selectedCourse();
    if (!course) {
      return null;
    }

    const baseWorkspace = this.courseWorkspaces[course.name] ?? this.buildFallbackWorkspace(course.name);
    return this.mergeManagerAssessmentWorkspace(course, baseWorkspace);
  });
  readonly selectedDocuments = computed<WorkspaceDocument[]>(() =>
    (this.selectedCourseWorkspace()?.documents ?? []).map((document) =>
      typeof document === 'string' ? { title: document } : document,
    ),
  );
  readonly orderedCourseSteps = computed(() => this.selectedCourseWorkspace()?.steps ?? []);
  readonly selectedCourseStep = computed<WorkspaceStep | null>(() => {
    const selectedStepId = this.selectedCourseStepId().trim();
    const steps = this.orderedCourseSteps();

    if (!steps.length) {
      return null;
    }

    return steps.find((step) => step.id === selectedStepId) ?? steps[0] ?? null;
  });
  readonly selectedCourseStepNumber = computed(() => {
    const selectedStep = this.selectedCourseStep();

    if (!selectedStep) {
      return 0;
    }

    return this.orderedCourseSteps().findIndex((step) => step.id === selectedStep.id) + 1;
  });
  readonly selectedVideos = computed<WorkspaceVideo[]>(() => {
    const workspace = this.selectedCourseWorkspace();

    if (!workspace) {
      return [];
    }

    if (workspace.videos?.length) {
      return workspace.videos;
    }

    return workspace.sections.map((section, index) => ({
      title: section,
      durationLabel: index === 0 ? workspace.videoDuration : undefined,
    }));
  });
  readonly selectedDocument = computed<WorkspaceDocument | null>(() => {
    const selectedStepDocument = this.selectedCourseStep()?.document;
    if (selectedStepDocument) {
      return selectedStepDocument;
    }

    const selectedTitle = this.selectedDocumentTitle().trim();
    const documents = this.selectedDocuments();

    if (!documents.length) {
      return null;
    }

    return documents.find((document) => document.title === selectedTitle) ?? documents[0] ?? null;
  });
  readonly selectedVideo = computed<WorkspaceVideo | null>(() => {
    const selectedStepVideo = this.selectedCourseStep()?.video;
    if (selectedStepVideo) {
      return selectedStepVideo;
    }

    const selectedTitle = this.selectedVideoTitle().trim();
    const videos = this.selectedVideos();

    if (!videos.length) {
      return null;
    }

    return videos.find((video) => video.title === selectedTitle) ?? videos[0] ?? null;
  });
  readonly selectedDocumentSource = computed(() => this.selectedDocument()?.convertedPdfUrl || this.selectedDocument()?.resourceLink || this.selectedDocument()?.uploadedDataUrl || '');
  readonly isPdfDocumentSource = computed(() => {
    const src = this.selectedDocumentSource().trim();
    return src.startsWith('data:application/pdf') || /\.pdf(\?.*)?$/i.test(src);
  });
  readonly selectedDocumentPreviewUrl = computed<SafeResourceUrl | null>(() => {
    const documentSource = this.selectedDocumentSource().trim();
    return this.canPreviewDocumentSource(documentSource)
      ? this.sanitizer.bypassSecurityTrustResourceUrl(documentSource)
      : null;
  });
  readonly selectedScormLaunchUrl = computed<SafeResourceUrl | null>(() => {
    const selectedStep = this.selectedCourseStep();
    if (!selectedStep || selectedStep.kind !== 'Scorm') {
      return null;
    }

    const source = (selectedStep.document?.resourceLink || selectedStep.document?.uploadedDataUrl || '').trim();
    if (!source) {
      return null;
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl(source);
  });
  /** Google Docs Viewer URL for PPTX files that don't have a converted PDF yet. */
  readonly selectedDocumentPptViewerUrl = computed<SafeResourceUrl | null>(() => {
    const doc = this.selectedDocument();
    if (!doc || doc.convertedPdfUrl) {
      return null; // PDF viewer handles it
    }
    const src = (doc.resourceLink || doc.uploadedDataUrl || '').trim();
    if (!src || src.startsWith('data:') || !/\.pptx?(\?.*)?$/i.test(src)) {
      return null;
    }
    const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(src)}&embedded=true`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(viewerUrl);
  });
  readonly selectedDocumentPresentationPreview = computed<WorkspaceDocumentPresentationPreview | null>(() => {
    const document = this.selectedDocument();
    const uploadedDataUrl = document?.uploadedDataUrl?.trim() ?? '';

    if (!document || !uploadedDataUrl) {
      return null;
    }

    const fileName = document.fileName || document.title || 'PowerPoint presentation';
    const previewableType = resolvePowerPointUploadType(fileName, uploadedDataUrl);

    if (!previewableType) {
      return null;
    }

    return {
      fileName,
      message:
        previewableType === 'pptx'
          ? 'Open this presentation in Microsoft PowerPoint to review the original slides and formatting.'
          : 'Open this legacy PowerPoint file in Microsoft PowerPoint to review the original slides and formatting.',
    };
  });
  readonly selectedVideoSource = computed(() => {
    const video = this.selectedVideo();
    if (!video) return '';
    const src = video.resourceLink || video.uploadedDataUrl || '';
    // Training managers sometimes paste a URL directly as the title — treat it as the source.
    if (!src && /^https?:\/\//i.test(video.title.trim())) return video.title.trim();
    return src;
  });
  readonly selectedEmbeddedVideoUrl = computed<SafeResourceUrl | null>(() => {
    const embeddedUrl = this.getEmbeddedVideoUrl(this.selectedVideoSource().trim());
    return embeddedUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(embeddedUrl) : null;
  });
  readonly selectedVideoMeta = computed(() => {
    const video = this.selectedVideo();
    const loadedDuration = this.loadedVideoDurations()[this.selectedVideoKey()];

    if (!video) {
      return 'No video selected';
    }

    if (loadedDuration) {
      return `Video Duration: ${loadedDuration}`;
    }

    if (video.durationLabel) {
      return `Video Duration: ${video.durationLabel}`;
    }

    if (video.fileName) {
      return `Selected video: ${video.fileName}`;
    }

    if (video.uploadedDataUrl) {
      return 'Selected video: uploaded file ready to play';
    }

    if (video.resourceLink) {
      return 'Selected video: linked source';
    }

    return 'No video available';
  });
  readonly workspaceCourseId = computed(() => this.selectedCourse()?.name.slice(0, 3).toUpperCase() + '-101');
  readonly selectedAssessment = computed(() => this.selectedCourseStep()?.assessment ?? null);
  readonly selectedAssessmentQuestionIndexValue = computed(() => {
    const questionCount = this.selectedAssessment()?.questions.length ?? 0;

    if (!questionCount) {
      return 0;
    }

    return Math.min(this.selectedAssessmentQuestionIndex(), questionCount - 1);
  });
  readonly selectedAssessmentQuestion = computed<WorkspaceAssessmentQuestion | null>(() => {
    const assessment = this.selectedAssessment();

    if (!assessment?.questions.length) {
      return null;
    }

    return assessment.questions[this.selectedAssessmentQuestionIndexValue()] ?? assessment.questions[0] ?? null;
  });
  readonly selectedAssessmentQuestionNumber = computed(() => this.selectedAssessmentQuestion() ? this.selectedAssessmentQuestionIndexValue() + 1 : 0);
  readonly selectedAssessmentQuestionCount = computed(() => this.selectedAssessment()?.questions.length ?? 0);
  readonly currentAssessmentQuestionStepId = computed(() => this.selectedAssessmentQuestion()?.id ?? '');
  readonly hasPreviousAssessmentQuestion = computed(() => this.selectedAssessmentQuestionIndexValue() > 0);
  readonly hasNextAssessmentQuestion = computed(() => this.selectedAssessmentQuestionIndexValue() + 1 < this.selectedAssessmentQuestionCount());
  readonly currentAssessmentAttemptKey = computed(() => {
    const selectedCourse = this.selectedCourse();
    const selectedQuestionStepId = this.currentAssessmentQuestionStepId();

    if (!selectedCourse || !selectedQuestionStepId) {
      return '';
    }

    return this.assessmentAttemptKey(selectedCourse, selectedQuestionStepId);
  });
  readonly currentQuizAttemptKey = computed(() => {
    const selectedCourse = this.selectedCourse();
    const selectedStepId = this.selectedCourseStep()?.id?.trim() ?? '';

    if (!selectedCourse || !selectedStepId || this.selectedAssessment()?.assessmentType !== 'Quiz') {
      return '';
    }

    return this.assessmentAttemptKey(selectedCourse, selectedStepId);
  });
  readonly currentStudentRecord = computed(() =>
    this.managerData.students().find((student) => student.email === this.studentData.profile().email || `${student.name} ${student.surname}` === this.studentData.profile().name) ?? null,
  );
  readonly selectedManagerOffering = computed(() => {
    const selectedCourse = this.selectedCourse();
    if (!selectedCourse) {
      return null;
    }

    return this.managerData.offerings().find((offering) => offering.id === selectedCourse.offeringId || offering.title === selectedCourse.name) ?? null;
  });
  readonly currentMentorshipReview = computed(() => {
    const student = this.currentStudentRecord();
    const offering = this.selectedManagerOffering();
    const assessmentStepId = this.currentAssessmentQuestionStepId();

    if (!student || !offering || !assessmentStepId || this.selectedAssessment()?.assessmentType !== 'Mentorship') {
      return null;
    }

    return this.managerData.mentorshipSubmissionForStudentOffering(student.id, offering.id, assessmentStepId, false);
  });
  readonly currentAssignmentSubmission = computed<AssignmentSubmissionRecord | null>(() => {
    const student = this.currentStudentRecord();
    const offering = this.selectedManagerOffering();
    const assessmentStepId = this.currentAssessmentQuestionStepId();

    if (!student || !offering || !assessmentStepId || this.selectedAssessment()?.assessmentType !== 'Assignment') {
      return null;
    }

    return this.managerData.assignmentSubmissionForStudentOffering(student.id, offering.id, assessmentStepId, false);
  });
  readonly currentQuizAttempt = computed<StudentAssessmentAttempt | null>(() => {
    if (this.selectedAssessment()?.assessmentType !== 'Quiz') {
      return null;
    }

    const assessmentKey = this.currentQuizAttemptKey();
    return assessmentKey ? this.studentData.assessmentAttempts()[assessmentKey] ?? null : null;
  });
  readonly selectedAssessmentOption = computed(() => {
    const assessmentKey = this.currentAssessmentAttemptKey();
    if (!assessmentKey) {
      return '';
    }

    return this.assessmentSelections()[assessmentKey] ?? '';
  });
  readonly selectedAssessmentResponse = computed(() => {
    const assessmentKey = this.currentAssessmentAttemptKey();
    if (!assessmentKey) {
      return '';
    }

    const savedResponse = this.assessmentResponses()[assessmentKey];
    if (savedResponse !== undefined) {
      return savedResponse;
    }

    if (this.selectedAssessment()?.assessmentType === 'Assignment') {
      return this.currentAssignmentSubmission()?.responseText ?? '';
    }

    return '';
  });
  readonly selectedAssignmentDocumentSubmission = computed<AssignmentDocumentSubmission>(() => {
    const assessmentKey = this.currentAssessmentAttemptKey();
    if (!assessmentKey) {
      return { fileName: '', dataUrl: '' };
    }

    const draftSubmission = this.assignmentDocumentSubmissions()[assessmentKey];
    if (draftSubmission) {
      return draftSubmission;
    }

    return {
      fileName: this.currentAssignmentSubmission()?.documentFileName ?? '',
      dataUrl: this.currentAssignmentSubmission()?.documentDataUrl ?? '',
    };
  });
  readonly selectedMentorshipSubmission = computed<MentorshipSubmission>(() => {
    const assessmentKey = this.currentAssessmentAttemptKey();
    if (!assessmentKey) {
      return { mentorName: '', sessionDate: '', actionPlan: '' };
    }

    const draftSubmission = this.mentorshipSubmissions()[assessmentKey];
    if (draftSubmission) {
      return draftSubmission;
    }

    return {
      mentorName: this.currentMentorshipReview()?.mentorName ?? '',
      sessionDate: this.currentMentorshipReview()?.sessionDate ?? '',
      actionPlan: this.currentMentorshipReview()?.actionPlan ?? '',
    };
  });
  readonly selectedMentorshipMentorName = computed(() => this.selectedMentorshipSubmission().mentorName);
  readonly selectedMentorshipSessionDate = computed(() => this.selectedMentorshipSubmission().sessionDate);
  readonly selectedMentorshipActionPlan = computed(() => this.selectedMentorshipSubmission().actionPlan);
  readonly hasOpenedSelectedDocument = computed(() => {
    const key = this.selectedDocumentKey();
    return key ? this.openedDocumentAcknowledgements()[key] ?? false : false;
  });
  readonly isSelectedDocumentAcknowledged = computed(() => {
    const key = this.selectedDocumentKey();
    return key ? this.acknowledgedDocuments()[key] ?? false : false;
  });
  readonly isAssessmentSubmitted = computed(() => {
    if (this.selectedAssessment()?.assessmentType === 'Mentorship') {
      const review = this.currentMentorshipReview();
      if (!review) {
        return false;
      }

      if (review.status !== 'Needs Revision') {
        return true;
      }

      return !this.hasAssessmentAttemptsRemaining();
    }

    if (this.selectedAssessment()?.assessmentType === 'Assignment') {
      const submission = this.currentAssignmentSubmission();
      if (!submission) {
        return false;
      }

      if (submission.status !== 'Needs Revision') {
        return true;
      }

      return !this.hasAssessmentAttemptsRemaining();
    }

    const quizAttempt = this.currentQuizAttempt();
    if (!quizAttempt) {
      return false;
    }

    if (quizAttempt.passed || !this.hasAssessmentAttemptsRemaining()) {
      return true;
    }

    return !this.isCurrentQuizRetakeActive();
  });
  readonly currentMatchingAssignments = computed(() => {
    const assessmentKey = this.currentAssessmentAttemptKey();
    if (!assessmentKey) {
      return {};
    }

    return this.matchingAssignments()[assessmentKey] ?? {};
  });
  readonly submittedQuizFeedback = computed<{ message: string; tone: 'success' | 'error' } | null>(() => {
    const assessment = this.selectedAssessment();
    const attempt = this.currentQuizAttempt();
    if (!assessment || assessment.assessmentType !== 'Quiz' || !attempt) {
      return null;
    }

    const passMark = this.selectedAssessmentPassMarkPercentage();
    const attemptsRemaining = this.assessmentAttemptsRemaining();
    const scoreSummary = attempt.lastScorePossible > 0
      ? `${attempt.lastScoreEarned} / ${attempt.lastScorePossible} (${attempt.lastScorePercentage}%)`
      : `${attempt.lastScorePercentage}%`;

    if (attempt.passed) {
      return {
        message: passMark !== null
          ? `Assessment passed with ${scoreSummary}. Pass mark ${passMark}% reached.`
          : `Assessment passed with ${scoreSummary}.`,
        tone: 'success',
      };
    }

    return {
      message: `Assessment scored ${scoreSummary}.${passMark !== null ? ` Pass mark ${passMark}%.` : ''}${attemptsRemaining === null ? ' Please retake the assessment.' : attemptsRemaining > 0 ? ` Please retake the assessment. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.` : ' No attempts remaining.'}`,
      tone: 'error',
    };
  });
  readonly quizResultBanner = computed<{
    tone: 'success' | 'error';
    title: string;
    summary: string;
    prompt: string;
  } | null>(() => {
    const assessment = this.selectedAssessment();
    const attempt = this.currentQuizAttempt();

    if (!assessment || assessment.assessmentType !== 'Quiz' || !attempt) {
      return null;
    }

    const passMark = this.selectedAssessmentPassMarkPercentage();
    const attemptsRemaining = this.assessmentAttemptsRemaining();
    const scoreSummary = attempt.lastScorePossible > 0
      ? `${attempt.lastScoreEarned} / ${attempt.lastScorePossible} (${attempt.lastScorePercentage}%)`
      : `${attempt.lastScorePercentage}%`;

    if (attempt.passed) {
      return {
        tone: 'success',
        title: 'Assessment Passed',
        summary: passMark === null
          ? `Final mark: ${scoreSummary}.`
          : `Final mark: ${scoreSummary}. Required pass mark ${passMark}% achieved.`,
        prompt: 'You can continue to the next learning item.',
      };
    }

    return {
      tone: 'error',
      title: 'Assessment Not Passed',
      summary: passMark === null
        ? `Final mark: ${scoreSummary}.`
        : `Final mark: ${scoreSummary}. Required pass mark ${passMark}% was not reached.`,
      prompt: attemptsRemaining === null || attemptsRemaining > 0
        ? 'Please retake the assessment.'
        : 'No attempts remain for this assessment.',
    };
  });
  readonly availableMatchingAnswers = computed(() => {
    const question = this.selectedAssessmentQuestion();
    if (!question?.matchingPairs?.length) {
      return [];
    }

    const assignedAnswers = new Set(Object.values(this.currentMatchingAssignments()));
    return question.matchingPairs
      .map((pair) => pair.answer)
      .filter((answer, index, allAnswers) => allAnswers.indexOf(answer) === index)
      .filter((answer) => !assignedAnswers.has(answer));
  });
  readonly canSubmitAssessment = computed(() => {
    if (this.isAssessmentSubmitted()) {
      return false;
    }

    const assessment = this.selectedAssessment();
    const question = this.selectedAssessmentQuestion();
    if (!assessment || !question) {
      return false;
    }

    if (!this.hasAssessmentAttemptsRemaining()) {
      return false;
    }

    if (assessment.assessmentType === 'Quiz') {
      return assessment.questions.length > 0 && assessment.questions.every((quizQuestion) => this.isQuizQuestionAnswered(quizQuestion));
    }

    if (question.questionType === 'Matching') {
      const pairCount = question.matchingPairs?.length ?? 0;
      return pairCount > 0 && Object.keys(this.currentMatchingAssignments()).length === pairCount;
    }

    if (question.questionType === 'Document Upload') {
      return this.selectedAssignmentDocumentSubmission().dataUrl.trim().length > 0;
    }

    if (question.questionType === 'Short Answer' || question.questionType === 'Long Answer') {
      if (assessment.assessmentType === 'Mentorship') {
        return this.selectedMentorshipMentorName().trim().length > 0
          && this.selectedMentorshipSessionDate().trim().length > 0
          && this.selectedMentorshipActionPlan().trim().length > 0;
      }

      return this.selectedAssessmentResponse().trim().length > 0;
    }

    return this.selectedAssessmentOption().length > 0;
  });

  private readonly courseWorkspaces: Record<string, CourseWorkspace> = {};

  constructor() {
    effect(() => {
      const request = this.studentData.courseNavigationRequest();

      if (!request) {
        return;
      }

      const matchingCourse = [...this.studentData.inProgressCourses(), ...this.studentData.completedCourses()].find((course) =>
        (request.offeringId && course.offeringId === request.offeringId) || course.name === request.courseName,
      );

      if (!matchingCourse) {
        this.studentData.clearCourseNavigationRequest();
        return;
      }

      this.openCourse(matchingCourse);

      if (request.stepId) {
        this.selectedCourseStepId.set(request.stepId);
      }

      this.studentData.clearCourseNavigationRequest();
    });

    effect(() => {
      const course = this.selectedCourse();
      const workspace = this.selectedCourseWorkspace();
      this.completedCourseSteps();
      this.acknowledgedDocuments();
      this.openedDocumentAcknowledgements();
      this.currentQuizAttempt();
      this.currentAssignmentSubmission();
      this.currentMentorshipReview();

      if (!course || !workspace?.steps.length) {
        return;
      }

      const nextProgress = this.calculateCourseProgress(course.name, workspace.steps);
      const updatedCourse = this.studentData.syncCourseProgress(course.name, nextProgress);

      if (updatedCourse && this.selectedCourse()?.name === course.name) {
        this.selectedCourse.set(updatedCourse);
      }
    });

    effect(() => {
      const selectedStep = this.selectedCourseStep();
      if (!selectedStep || selectedStep.kind !== 'Scorm') {
        return;
      }

      this.installScormApiBridge();
    });

    effect(() => {
      this.persistScormRuntime();
    });

  }

  openCourse(course: StudentCourse) {
    this.selectedCourse.set(course);
    this.selectedCourseStepId.set('');
    this.selectedAssessmentQuestionIndex.set(0);
    this.clearAssessmentSubmissionFeedback();
    this.selectedDocumentTitle.set('');
    this.selectedVideoTitle.set('');
    this.draggedMatchingAnswer.set('');
    this.pickedMatchingAnswer.set('');
  }

  closeCourse() {
    this.selectedCourse.set(null);
    this.selectedCourseStepId.set('');
    this.selectedAssessmentQuestionIndex.set(0);
    this.clearAssessmentSubmissionFeedback();
    this.selectedDocumentTitle.set('');
    this.selectedVideoTitle.set('');
    this.draggedMatchingAnswer.set('');
    this.pickedMatchingAnswer.set('');
  }

  selectDocument(document: WorkspaceDocument) {
    this.selectedDocumentTitle.set(document.title);
  }

  selectVideo(video: WorkspaceVideo) {
    this.selectedVideoTitle.set(video.title);
  }

  selectCourseStep(step: WorkspaceStep) {
    this.selectedCourseStepId.set(step.id);
    this.selectedAssessmentQuestionIndex.set(0);
    this.clearAssessmentSubmissionFeedback();

    if (step.document) {
      this.selectedDocumentTitle.set(step.document.title);
    }

    if (step.video) {
      this.selectedVideoTitle.set(step.video.title);
    }

    if (step.kind === 'Video' || (step.kind === 'Document' && !step.document?.requiresAcknowledgement)) {
      this.markStepComplete(step);
    }
  }

  workspaceStepMeta(step: WorkspaceStep) {
    if (step.kind === 'Assessment') {
      const questionCount = step.assessment?.questions.length ?? 0;
      const assessmentType = step.assessment?.assessmentType ?? 'Assessment';
      return questionCount > 1 ? `${assessmentType} • ${questionCount} questions` : assessmentType;
    }

    if (step.kind === 'Document' && step.document?.requiresAcknowledgement) {
      return 'Read and acknowledge';
    }

    if (step.kind === 'Scorm') {
      return 'SCORM package';
    }

    return step.kind;
  }

  onSelectedVideoMetadataLoaded(event: Event) {
    const element = event.target as HTMLVideoElement | null;
    const key = this.selectedVideoKey();

    if (!element || !Number.isFinite(element.duration) || element.duration <= 0 || !key) {
      return;
    }

    this.loadedVideoDurations.update((current) => ({
      ...current,
      [key]: this.formatVideoDuration(element.duration),
    }));

    this.markSelectedStepComplete();
  }

  selectAssessmentOption(option: string) {
    const assessmentKey = this.currentAssessmentAttemptKey();
    if (!assessmentKey || this.isAssessmentSubmitted()) {
      return;
    }

    this.clearAssessmentSubmissionFeedback();

    this.assessmentSelections.update((selections) => ({
      ...selections,
      [assessmentKey]: option,
    }));
  }

  updateAssessmentResponse(value: string) {
    const assessmentKey = this.currentAssessmentAttemptKey();
    if (!assessmentKey || this.isAssessmentSubmitted()) {
      return;
    }

    this.clearAssessmentSubmissionFeedback();

    this.assessmentResponses.update((responses) => ({
      ...responses,
      [assessmentKey]: value,
    }));
  }

  onAssignmentDocumentSelected(event: Event) {
    const assessmentKey = this.currentAssessmentAttemptKey();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!assessmentKey || this.isAssessmentSubmitted() || !file) {
      input.value = '';
      return;
    }

    this.clearAssessmentSubmissionFeedback();

    const reader = new FileReader();
    reader.onload = () => {
      this.assignmentDocumentSubmissions.update((submissions) => ({
        ...submissions,
        [assessmentKey]: {
          fileName: file.name,
          dataUrl: typeof reader.result === 'string' ? reader.result : '',
        },
      }));
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  clearAssignmentDocumentSubmission() {
    const assessmentKey = this.currentAssessmentAttemptKey();
    if (!assessmentKey || this.isAssessmentSubmitted()) {
      return;
    }

    this.clearAssessmentSubmissionFeedback();

    this.assignmentDocumentSubmissions.update((submissions) => ({
      ...submissions,
      [assessmentKey]: {
        fileName: '',
        dataUrl: '',
      },
    }));
  }

  updateMentorshipMentorName(value: string) {
    this.updateMentorshipSubmission({ mentorName: value });
  }

  updateMentorshipSessionDate(value: string) {
    this.updateMentorshipSubmission({ sessionDate: value });
  }

  updateMentorshipActionPlan(value: string) {
    this.updateMentorshipSubmission({ actionPlan: value });
  }

  assessmentAttachmentHeading() {
    switch (this.selectedAssessment()?.assessmentType) {
      case 'Mentorship':
        return 'Mentorship Guide Attached';
      case 'Assignment':
      default:
        return 'Assignment Brief Attached';
    }
  }

  assessmentResponsePlaceholder() {
    const assessment = this.selectedAssessment();
    const question = this.selectedAssessmentQuestion();

    switch (assessment?.assessmentType) {
      case 'Mentorship':
        return 'Write your mentorship reflection, action plan, or session notes here.';
      case 'Assignment':
        return question?.questionType === 'Long Answer'
          ? 'Write your long-form assignment response here.'
          : 'Write your assignment response here.';
      default:
        return 'Write your response here.';
    }
  }

  assessmentStatusNotice() {
    const feedback = this.assessmentSubmissionFeedback();
    if (feedback) {
      return feedback;
    }

    const assessment = this.selectedAssessment();

    if (!assessment) {
      return null;
    }

    if (assessment.assessmentType === 'Quiz') {
      return this.submittedQuizFeedback();
    }

    if (assessment.assessmentType === 'Assignment' && !this.currentAssignmentSubmission()) {
      return null;
    }

    if (assessment.assessmentType === 'Mentorship' && !this.currentMentorshipReview()) {
      return null;
    }

    return {
      message: this.assessmentSubmissionMessage(),
      tone: this.assessmentSubmissionTone(),
    };
  }

  assessmentPassMarkLabel() {
    const passMark = this.selectedAssessmentPassMarkPercentage();
    return passMark === null ? '' : `Pass mark: ${passMark}%`;
  }

  assessmentQuestionProgressLabel() {
    const questionCount = this.selectedAssessmentQuestionCount();

    if (questionCount <= 1) {
      return '';
    }

    return `Question ${this.selectedAssessmentQuestionNumber()} of ${questionCount}`;
  }

  assessmentQuestionPointsLabel() {
    const points = this.selectedAssessmentQuestion()?.points;

    if (typeof points !== 'number' || !Number.isFinite(points) || points <= 0) {
      return '';
    }

    return `${points} mark${points === 1 ? '' : 's'}`;
  }

  assessmentAttemptSummaryLabel() {
    const maxAttempts = this.selectedAssessmentMaxAttempts();
    if (maxAttempts === null) {
      return '';
    }

    return `Attempts used: ${this.assessmentAttemptsUsed()} / ${maxAttempts}`;
  }

  quizScoreSummaryLabel() {
    const attempt = this.currentQuizAttempt();

    if (this.selectedAssessment()?.assessmentType !== 'Quiz' || !attempt) {
      return '';
    }

    return attempt.lastScorePossible > 0
      ? `Final mark: ${attempt.lastScoreEarned} / ${attempt.lastScorePossible} (${attempt.lastScorePercentage}%)`
      : `Final mark: ${attempt.lastScorePercentage}%`;
  }

  assignmentAttemptStatusLabel() {
    const submission = this.currentAssignmentSubmission();
    const maxAttempts = this.selectedAssessmentMaxAttempts();

    if (!submission || maxAttempts === null) {
      return '';
    }

    return `${this.recordedSubmissionAttemptsUsed(submission)} of ${maxAttempts} used`;
  }

  mentorshipAttemptStatusLabel() {
    const review = this.currentMentorshipReview();
    const maxAttempts = this.selectedAssessmentMaxAttempts();

    if (!review || maxAttempts === null) {
      return '';
    }

    return `${this.recordedSubmissionAttemptsUsed(review)} of ${maxAttempts} used`;
  }

  recordedSubmissionAttemptsUsed(record: { attemptsUsed?: number } | null | undefined) {
    if (!record) {
      return 0;
    }

    return record.attemptsUsed ?? 1;
  }

  assignmentPassResultLabel() {
    const submission = this.currentAssignmentSubmission();
    const passMark = this.selectedAssessmentPassMarkPercentage();

    if (!submission || submission.awardedPoints === null || passMark === null || submission.possiblePoints <= 0) {
      return '';
    }

    const percentage = Math.round((submission.awardedPoints / submission.possiblePoints) * 100);
    return percentage >= passMark ? 'Passed' : 'Below pass mark';
  }

  selectedAssessmentPassMarkPercentage() {
    const passMark = this.selectedAssessment()?.passMarkPercentage;
    return typeof passMark === 'number' && Number.isFinite(passMark) ? passMark : null;
  }

  selectedAssessmentMaxAttempts() {
    const maxAttempts = this.selectedAssessment()?.maxAttempts;
    return typeof maxAttempts === 'number' && Number.isFinite(maxAttempts) ? maxAttempts : null;
  }

  assessmentAttemptsUsed() {
    switch (this.selectedAssessment()?.assessmentType) {
      case 'Assignment':
        return this.recordedSubmissionAttemptsUsed(this.currentAssignmentSubmission());
      case 'Mentorship':
        return this.recordedSubmissionAttemptsUsed(this.currentMentorshipReview());
      case 'Quiz':
        return this.currentQuizAttempt()?.attemptsUsed ?? 0;
      default:
        return 0;
    }
  }

  assessmentAttemptsRemaining() {
    const maxAttempts = this.selectedAssessmentMaxAttempts();
    if (maxAttempts === null) {
      return null;
    }

    return Math.max(0, maxAttempts - this.assessmentAttemptsUsed());
  }

  hasAssessmentAttemptsRemaining() {
    const attemptsRemaining = this.assessmentAttemptsRemaining();
    return attemptsRemaining === null || attemptsRemaining > 0;
  }

  isCurrentQuizRetakeActive() {
    const assessmentKey = this.currentQuizAttemptKey();
    return assessmentKey ? this.retakingQuizAssessments()[assessmentKey] ?? false : false;
  }

  canStartQuizRetake() {
    const attempt = this.currentQuizAttempt();

    return this.selectedAssessment()?.assessmentType === 'Quiz'
      && !!attempt
      && !attempt.passed
      && this.hasAssessmentAttemptsRemaining()
      && !this.isCurrentQuizRetakeActive();
  }

  startQuizRetake() {
    const assessmentKey = this.currentQuizAttemptKey();

    if (!assessmentKey || !this.canStartQuizRetake()) {
      return;
    }

    this.clearAssessmentSubmissionFeedback();
    this.retakingQuizAssessments.update((retakes) => ({
      ...retakes,
      [assessmentKey]: true,
    }));
  }

  assessmentSubmissionMessage() {
    switch (this.selectedAssessment()?.assessmentType) {
      case 'Mentorship': {
        const review = this.currentMentorshipReview();
        const attemptsRemaining = this.assessmentAttemptsRemaining();

        if (review?.status === 'Needs Revision') {
          return attemptsRemaining === null || attemptsRemaining > 0
            ? `Mentorship response updated and ready to resubmit.${attemptsRemaining === null ? '' : ` ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`}`
            : 'Mentorship response needs revision, but all attempts have been used. Contact the training manager for another attempt.';
        }

        return `Mentorship response submitted successfully.${this.selectedAssessmentMaxAttempts() === null ? '' : ` Attempts used: ${this.assessmentAttemptsUsed()} / ${this.selectedAssessmentMaxAttempts()}.`}`;
      }
      case 'Assignment': {
        const review = this.currentAssignmentSubmission();
        const attemptsRemaining = this.assessmentAttemptsRemaining();
        if (review?.status === 'Needs Revision') {
          return attemptsRemaining === null || attemptsRemaining > 0
            ? `Revision requested. Update your assignment and resubmit it to the training manager.${attemptsRemaining === null ? '' : ` ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`}`
            : 'Revision requested, but all attempts have been used. Contact the training manager for another attempt.';
        }

        if (review?.status === 'Approved') {
          return review.awardedPoints !== null
            ? `Assignment approved by the training manager. Mark awarded: ${this.formatAssignmentMark(review)}.${this.assignmentPassResultLabel() ? ' ' + this.assignmentPassResultLabel() + '.' : ''}`
            : 'Assignment approved by the training manager.';
        }

        return `Assignment submitted successfully and is now visible to the training manager.${this.selectedAssessmentMaxAttempts() === null ? '' : ` Attempts used: ${this.assessmentAttemptsUsed()} / ${this.selectedAssessmentMaxAttempts()}.`}`;
      }
      case 'Quiz':
      default:
        return this.submittedQuizFeedback()?.message ?? 'Assessment submitted successfully.';
    }
  }

  assessmentSubmissionTone() {
    switch (this.selectedAssessment()?.assessmentType) {
      case 'Mentorship':
        return this.currentMentorshipReview()?.status === 'Needs Revision' ? 'error' : 'success';
      case 'Assignment':
        return this.currentAssignmentSubmission()?.status === 'Needs Revision' || this.assignmentPassResultLabel() === 'Below pass mark' ? 'error' : 'success';
      case 'Quiz':
      default:
        return this.submittedQuizFeedback()?.tone === 'error' ? 'error' : 'success';
    }
  }

  formatAssignmentMark(submission: Pick<AssignmentSubmissionRecord, 'awardedPoints' | 'possiblePoints'> | null) {
    if (!submission || submission.awardedPoints === null || submission.possiblePoints <= 0) {
      return 'Not marked yet';
    }

    const percentage = Math.round((submission.awardedPoints / submission.possiblePoints) * 100);
    return `${submission.awardedPoints} / ${submission.possiblePoints} (${percentage}%)`;
  }

  assignmentResultSummaryLabel() {
    const submission = this.currentAssignmentSubmission();

    if (!submission || submission.awardedPoints === null) {
      return '';
    }

    const passResult = this.assignmentPassResultLabel();
    return passResult ? `${this.formatAssignmentMark(submission)} • ${passResult}` : this.formatAssignmentMark(submission);
  }

  formatAssessmentAnswerList(options: string[]) {
    const uniqueOptions = options.filter((option, index, allOptions) => allOptions.indexOf(option) === index);

    if (uniqueOptions.length <= 1) {
      return uniqueOptions[0] ?? '';
    }

    if (uniqueOptions.length === 2) {
      return `${uniqueOptions[0]} and ${uniqueOptions[1]}`;
    }

    return `${uniqueOptions.slice(0, -1).join(', ')}, and ${uniqueOptions[uniqueOptions.length - 1]}`;
  }

  submitAssessmentButtonLabel() {
    switch (this.selectedAssessment()?.assessmentType) {
      case 'Mentorship':
        return this.currentMentorshipReview()?.status === 'Needs Revision' ? 'Resubmit Mentorship Response' : 'Submit Mentorship Response';
      case 'Assignment':
        if (this.currentAssignmentSubmission()?.status === 'Needs Revision') {
          return this.hasAssessmentAttemptsRemaining() ? 'Resubmit Assignment' : 'Attempts Exhausted';
        }

        return 'Submit Assignment';
      case 'Quiz':
        if (this.isCurrentQuizRetakeActive()) {
          return 'Submit Retake';
        }

        return this.selectedAssessmentQuestionCount() > 1 ? 'Submit All Questions' : 'Submit Assessment';
      default:
        return 'Submit Assessment';
    }
  }

  submittedAssessmentButtonLabel() {
    switch (this.selectedAssessment()?.assessmentType) {
      case 'Mentorship':
        if (this.currentMentorshipReview()?.status === 'Approved') {
          return 'Mentorship Approved';
        }

        return this.hasAssessmentAttemptsRemaining() ? 'Mentorship Submitted' : 'Attempts Exhausted';
      case 'Assignment':
        if (this.currentAssignmentSubmission()?.status === 'Approved') {
          return 'Assignment Approved';
        }

        return this.hasAssessmentAttemptsRemaining() ? 'Assignment Submitted' : 'Attempts Exhausted';
      case 'Quiz':
        if (this.currentQuizAttempt()?.passed) {
          return 'Assessment Passed';
        }

        return this.hasAssessmentAttemptsRemaining() ? 'Assessment Not Passed' : 'Attempts Exhausted';
      default:
        return 'Assessment Submitted';
    }
  }

  submittedResponseTitle() {
    const assessment = this.selectedAssessment();
    const question = this.selectedAssessmentQuestion();

    switch (assessment?.assessmentType) {
      case 'Mentorship':
        return 'Submitted mentorship notes';
      case 'Assignment':
        return question?.questionType === 'Document Upload' ? 'Submitted document' : 'Submitted response';
      default:
        return 'Submitted response';
    }
  }

  usesTextAssessmentResponse() {
    const questionType = this.selectedAssessmentQuestion()?.questionType;
    return questionType === 'Short Answer' || questionType === 'Long Answer';
  }

  goToPreviousAssessmentQuestion() {
    if (!this.hasPreviousAssessmentQuestion()) {
      return;
    }

    this.selectedAssessmentQuestionIndex.update((currentIndex) => Math.max(0, currentIndex - 1));
    this.clearAssessmentSubmissionFeedback();
    this.draggedMatchingAnswer.set('');
    this.pickedMatchingAnswer.set('');
  }

  goToNextAssessmentQuestion() {
    const questionCount = this.selectedAssessmentQuestionCount();
    if (!questionCount || !this.hasNextAssessmentQuestion()) {
      return;
    }

    this.selectedAssessmentQuestionIndex.update((currentIndex) => Math.min(questionCount - 1, currentIndex + 1));
    this.clearAssessmentSubmissionFeedback();
    this.draggedMatchingAnswer.set('');
    this.pickedMatchingAnswer.set('');
  }

  startMatchingDrag(answer: string) {
    if (this.isAssessmentSubmitted()) {
      return;
    }

    this.draggedMatchingAnswer.set(answer);
  }

  endMatchingDrag() {
    this.draggedMatchingAnswer.set('');
  }

  pickMatchingAnswer(answer: string) {
    if (this.isAssessmentSubmitted()) {
      return;
    }

    this.pickedMatchingAnswer.set(this.pickedMatchingAnswer() === answer ? '' : answer);
  }

  allowMatchingDrop(event: DragEvent) {
    event.preventDefault();
  }

  dropMatchingAnswer(prompt: string, event?: DragEvent) {
    event?.preventDefault();

    const assessmentKey = this.currentAssessmentAttemptKey();
    const answer = this.draggedMatchingAnswer() || this.pickedMatchingAnswer();

    if (!assessmentKey || !answer || this.isAssessmentSubmitted()) {
      return;
    }

    this.matchingAssignments.update((assignments) => {
      const currentCourseAssignments = { ...(assignments[assessmentKey] ?? {}) };

      for (const [assignedPrompt, assignedAnswer] of Object.entries(currentCourseAssignments)) {
        if (assignedAnswer === answer && assignedPrompt !== prompt) {
          delete currentCourseAssignments[assignedPrompt];
        }
      }

      currentCourseAssignments[prompt] = answer;

      return {
        ...assignments,
        [assessmentKey]: currentCourseAssignments,
      };
    });

    this.draggedMatchingAnswer.set('');
    this.pickedMatchingAnswer.set('');
  }

  clearMatchingAssignment(prompt: string) {
    const assessmentKey = this.currentAssessmentAttemptKey();
    if (!assessmentKey || this.isAssessmentSubmitted()) {
      return;
    }

    this.matchingAssignments.update((assignments) => {
      const currentCourseAssignments = { ...(assignments[assessmentKey] ?? {}) };
      delete currentCourseAssignments[prompt];

      return {
        ...assignments,
        [assessmentKey]: currentCourseAssignments,
      };
    });
  }

  matchingAssignmentFor(prompt: string) {
    return this.currentMatchingAssignments()[prompt] ?? '';
  }

  // Grading itself now happens server-side (see gradeQuizAttempt in repository.ts) — the browser
  // is never sent the answer key (choices[].isCorrect/matchingPairs[].answer) to grade against.
  // submitAssessment() posts the raw answers and applies the attempt the server returns.

  async submitAssessment() {
    if (!this.canSubmitAssessment() || this.isAssessmentSubmitted()) {
      return;
    }

    if (this.selectedAssessment()?.assessmentType === 'Mentorship') {
      const student = this.currentStudentRecord();
      const offering = this.selectedManagerOffering();
      const assessmentStepId = this.currentAssessmentQuestionStepId();
      const assessmentTitle = this.selectedAssessment()?.title;
      const question = this.selectedAssessmentQuestion();

      if (!student || !offering || !assessmentStepId || !assessmentTitle || !question) {
        this.setAssessmentSubmissionError('This mentorship response could not be submitted right now. Refresh the course and try again.');
        return;
      }

      const submissionResult = this.managerData.submitMentorshipSubmission({
        studentId: student.id,
        offeringId: offering.id,
        assessmentStepId,
        assessmentTitle,
        mentorName: this.selectedMentorshipMentorName().trim(),
        sessionDate: this.selectedMentorshipSessionDate().trim(),
        actionPlan: this.selectedMentorshipActionPlan().trim(),
      });

      if (!submissionResult.ok) {
        this.setAssessmentSubmissionError(submissionResult.message);
        return;
      }

      this.clearAssessmentSubmissionFeedback();
      this.markSelectedStepComplete();
      return;
    }

    if (this.selectedAssessment()?.assessmentType === 'Assignment') {
      const student = this.currentStudentRecord();
      const offering = this.selectedManagerOffering();
      const assessment = this.selectedAssessment();
      const question = this.selectedAssessmentQuestion();
      const assessmentStepId = this.currentAssessmentQuestionStepId();

      if (!student || !offering || !assessment || !question || !assessmentStepId) {
        this.setAssessmentSubmissionError('This assignment could not be submitted right now. Refresh the course and try again.');
        return;
      }

      const assignmentQuestionType = question.questionType;
      if (
        assignmentQuestionType !== 'Short Answer'
        && assignmentQuestionType !== 'Long Answer'
        && assignmentQuestionType !== 'Document Upload'
      ) {
        this.setAssessmentSubmissionError('This assignment question is not supported for learner submissions yet.');
        return;
      }

      const textResponse = this.selectedAssessmentResponse().trim();
      const documentSubmission = this.selectedAssignmentDocumentSubmission();

      const submissionResult = await this.managerData.submitAssignmentSubmission({
        studentId: student.id,
        offeringId: offering.id,
        assessmentStepId,
        assessmentTitle: assessment.title,
        questionType: assignmentQuestionType,
        responseText: assignmentQuestionType === 'Short Answer' || assignmentQuestionType === 'Long Answer' ? textResponse : undefined,
        documentFileName: assignmentQuestionType === 'Document Upload' ? documentSubmission.fileName : undefined,
        documentDataUrl: assignmentQuestionType === 'Document Upload' ? documentSubmission.dataUrl : undefined,
      });

      if (!submissionResult.ok) {
        this.setAssessmentSubmissionError(submissionResult.message);
        return;
      }

      this.clearAssessmentSubmissionFeedback();
      return;
    }

    const assessment = this.selectedAssessment();
    const student = this.currentStudentRecord();
    const offering = this.selectedManagerOffering();
    const assessmentId = this.selectedCourseStep()?.id?.trim() ?? '';
    const attemptKey = this.currentQuizAttemptKey();
    if (!assessment || !student || !offering || !assessmentId || !attemptKey) {
      this.setAssessmentSubmissionError('This assessment could not be submitted right now. Refresh the course and try again.');
      return;
    }

    this.clearAssessmentSubmissionFeedback();

    // Graded server-side (see gradeQuizAttempt in repository.ts) rather than computed here and
    // then just reported to the backend — the server holds the answer key
    // (choices[].isCorrect/matchingPairs[].answer) and never sends it to the browser, so grading
    // can no longer happen client-side. That also means, unlike the old flow, the result isn't
    // known until this call resolves — there's nothing to optimistically record locally first.
    try {
      const nextAttempt = await firstValueFrom(
        this.backend.gradeQuizAttempt(student.id, offering.id, assessmentId, this.buildQuizSubmissionAnswers(assessment)),
      );

      this.studentData.recordAssessmentAttempt(attemptKey, nextAttempt);
      this.retakingQuizAssessments.update((retakes) => ({ ...retakes, [attemptKey]: false }));

      if (nextAttempt.passed) {
        this.markSelectedStepComplete();
      }
    } catch {
      this.setAssessmentSubmissionError('This assessment could not be submitted right now. Check your connection and try again.');
    }
  }

  hasAssessmentDocument() {
    const assessment = this.selectedAssessment();
    const question = this.selectedAssessmentQuestion();
    return Boolean(question?.attachmentDataUrl || assessment?.resourceLink);
  }

  openAssessmentDocument() {
    const documentUrl = this.selectedAssessmentQuestion()?.attachmentDataUrl || this.selectedAssessment()?.resourceLink;

    if (!documentUrl) {
      return;
    }

    if (this.openDocumentInNewTab(documentUrl)) {
      this.markSelectedStepComplete();
    }
  }

  openAssignmentDocumentSubmission() {
    const documentUrl = this.currentAssignmentSubmission()?.documentDataUrl || this.selectedAssignmentDocumentSubmission().dataUrl;

    if (!documentUrl) {
      return;
    }

    this.openDocumentInNewTab(documentUrl);
  }

  hasSelectedDocumentLink() {
    return this.selectedDocumentSource().trim().length > 0;
  }

  hasSelectedDocumentPreview() {
    return Boolean(this.selectedDocumentPreviewUrl() || this.selectedDocumentPptViewerUrl());
  }

  hasReviewedSelectedDocument() {
    return this.hasOpenedSelectedDocument() || this.hasSelectedDocumentPreview();
  }

  hasSelectedVideoSource() {
    return this.selectedVideoSource().trim().length > 0;
  }

  canPlaySelectedVideoInline() {
    const videoSource = this.selectedVideoSource().trim();

    if (!videoSource) {
      return false;
    }

    if (this.getEmbeddedVideoUrl(videoSource)) {
      return false;
    }

    if (videoSource.startsWith('data:video/') || videoSource.startsWith('blob:')) {
      return true;
    }

    return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(videoSource);
  }

  openSelectedVideo() {
    const videoSource = this.selectedVideoSource().trim();

    if (!videoSource) {
      return;
    }

    window.open(videoSource, '_blank', 'noopener,noreferrer');
    this.markSelectedStepComplete();
  }

  canAcknowledgeSelectedDocument() {
    const document = this.selectedDocument();
    return Boolean(document?.requiresAcknowledgement && this.hasSelectedDocumentLink() && this.hasReviewedSelectedDocument());
  }

  openSelectedDocument() {
    const document = this.selectedDocument();
    const documentUrl = document?.resourceLink || document?.uploadedDataUrl;
    const key = this.selectedDocumentKey();

    if (!documentUrl || !key) {
      return;
    }

    if (!this.openDocumentInNewTab(documentUrl)) {
      return;
    }

    this.openedDocumentAcknowledgements.update((current) => ({
      ...current,
      [key]: true,
    }));

    if (!document.requiresAcknowledgement) {
      this.markSelectedStepComplete();
    }
  }

  private openDocumentInNewTab(documentUrl: string) {
    const normalizedUrl = documentUrl.trim();
    if (!normalizedUrl) {
      return false;
    }

    if (!normalizedUrl.startsWith('data:')) {
      return this.openUrlInNewTab(normalizedUrl);
    }

    const objectUrl = URL.createObjectURL(this.dataUrlToBlob(normalizedUrl));
    const opened = this.openUrlInNewTab(objectUrl);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    return opened;
  }

  private openUrlInNewTab(url: string) {
    const popup = globalThis.open?.(url, '_blank', 'noopener,noreferrer');

    if (popup) {
      return true;
    }

    const link = this.document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';

    this.document.body.append(link);
    link.click();
    link.remove();
    return true;
  }

  private dataUrlToBlob(dataUrl: string) {
    const [metadata, base64Payload = ''] = dataUrl.split(',', 2);
    const mimeType = metadata.match(/^data:([^;]+)/i)?.[1] || 'application/octet-stream';
    const binary = atob(base64Payload);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: mimeType });
  }

  handleSelectedDocumentDownload() {
    const document = this.selectedDocument();
    const key = this.selectedDocumentKey();

    if (!document || !key) {
      return;
    }

    this.openedDocumentAcknowledgements.update((current) => ({
      ...current,
      [key]: true,
    }));

    if (!document.requiresAcknowledgement) {
      this.markSelectedStepComplete();
    }
  }

  acknowledgeSelectedDocument() {
    const key = this.selectedDocumentKey();
    if (!key || !this.canAcknowledgeSelectedDocument()) {
      return;
    }

    this.acknowledgedDocuments.update((current) => ({
      ...current,
      [key]: true,
    }));

    this.markSelectedStepComplete();
  }

  private activeScormRuntimeKey() {
    const selectedCourse = this.selectedCourse();
    const selectedStep = this.selectedCourseStep();

    if (!selectedCourse || !selectedStep || selectedStep.kind !== 'Scorm') {
      return '';
    }

    return this.courseStepKey(selectedCourse.name, selectedStep.id);
  }

  private defaultScormRuntimeState(): ScormRuntimeState {
    return {
      initialized: false,
      completed: false,
      successStatus: 'unknown',
      scoreRaw: '',
      location: '',
      suspendData: '',
    };
  }

  private loadPersistedScormRuntime() {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    try {
      const raw = localStorage.getItem(StudentCoursesComponent.scormRuntimeStorageKey);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as Record<string, ScormRuntimeState>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private persistScormRuntime() {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(StudentCoursesComponent.scormRuntimeStorageKey, JSON.stringify(this.scormRuntime()));
    } catch {
      return;
    }
  }

  private getActiveScormRuntimeState() {
    const key = this.activeScormRuntimeKey();
    if (!key) {
      return this.defaultScormRuntimeState();
    }

    return this.scormRuntime()[key] ?? this.defaultScormRuntimeState();
  }

  private updateActiveScormRuntimeState(patch: Partial<ScormRuntimeState>) {
    const key = this.activeScormRuntimeKey();
    if (!key) {
      return;
    }

    const current = this.scormRuntime()[key] ?? this.defaultScormRuntimeState();
    const next = { ...current, ...patch };

    this.scormRuntime.update((runtime) => ({
      ...runtime,
      [key]: next,
    }));

    if (next.completed || next.successStatus === 'passed') {
      this.markSelectedStepComplete();
    }
  }

  private installScormApiBridge() {
    const hostWindow = this.document.defaultView as (Window & { API?: unknown; API_1484_11?: unknown }) | null;
    if (!hostWindow) {
      return;
    }

    hostWindow.API = {
      LMSInitialize: () => {
        this.updateActiveScormRuntimeState({ initialized: true });
        return 'true';
      },
      LMSFinish: () => 'true',
      LMSGetValue: (element: string) => this.scorm12GetValue(element),
      LMSSetValue: (element: string, value: string) => this.scorm12SetValue(element, value),
      LMSCommit: () => 'true',
      LMSGetLastError: () => '0',
      LMSGetErrorString: () => 'No error',
      LMSGetDiagnostic: () => '',
    };

    hostWindow.API_1484_11 = {
      Initialize: () => {
        this.updateActiveScormRuntimeState({ initialized: true });
        return 'true';
      },
      Terminate: () => 'true',
      GetValue: (element: string) => this.scorm2004GetValue(element),
      SetValue: (element: string, value: string) => this.scorm2004SetValue(element, value),
      Commit: () => 'true',
      GetLastError: () => '0',
      GetErrorString: () => 'No error',
      GetDiagnostic: () => '',
    };
  }

  private scorm12GetValue(element: string) {
    const state = this.getActiveScormRuntimeState();

    switch ((element || '').trim()) {
      case 'cmi.core.lesson_status':
        return state.completed ? 'completed' : 'incomplete';
      case 'cmi.core.score.raw':
        return state.scoreRaw;
      case 'cmi.core.lesson_location':
      case 'cmi.core.location':
        return state.location;
      case 'cmi.suspend_data':
        return state.suspendData;
      default:
        return '';
    }
  }

  private scorm12SetValue(element: string, value: string) {
    const normalizedElement = (element || '').trim();
    const normalizedValue = (value || '').toString();

    switch (normalizedElement) {
      case 'cmi.core.lesson_status': {
        const completed = normalizedValue === 'completed' || normalizedValue === 'passed';
        this.updateActiveScormRuntimeState({ completed, successStatus: normalizedValue === 'passed' ? 'passed' : this.getActiveScormRuntimeState().successStatus });
        return 'true';
      }
      case 'cmi.core.score.raw':
        this.updateActiveScormRuntimeState({ scoreRaw: normalizedValue });
        return 'true';
      case 'cmi.core.lesson_location':
      case 'cmi.core.location':
        this.updateActiveScormRuntimeState({ location: normalizedValue });
        return 'true';
      case 'cmi.suspend_data':
        this.updateActiveScormRuntimeState({ suspendData: normalizedValue });
        return 'true';
      default:
        return 'true';
    }
  }

  private scorm2004GetValue(element: string) {
    const state = this.getActiveScormRuntimeState();

    switch ((element || '').trim()) {
      case 'cmi.completion_status':
        return state.completed ? 'completed' : 'incomplete';
      case 'cmi.success_status':
        return state.successStatus;
      case 'cmi.score.raw':
        return state.scoreRaw;
      case 'cmi.location':
        return state.location;
      case 'cmi.suspend_data':
        return state.suspendData;
      default:
        return '';
    }
  }

  private scorm2004SetValue(element: string, value: string) {
    const normalizedElement = (element || '').trim();
    const normalizedValue = (value || '').toString();

    switch (normalizedElement) {
      case 'cmi.completion_status':
        this.updateActiveScormRuntimeState({ completed: normalizedValue === 'completed' });
        return 'true';
      case 'cmi.success_status':
        this.updateActiveScormRuntimeState({
          successStatus: normalizedValue === 'passed' ? 'passed' : normalizedValue === 'failed' ? 'failed' : 'unknown',
          completed: normalizedValue === 'passed' ? true : this.getActiveScormRuntimeState().completed,
        });
        return 'true';
      case 'cmi.score.raw':
        this.updateActiveScormRuntimeState({ scoreRaw: normalizedValue });
        return 'true';
      case 'cmi.location':
        this.updateActiveScormRuntimeState({ location: normalizedValue });
        return 'true';
      case 'cmi.suspend_data':
        this.updateActiveScormRuntimeState({ suspendData: normalizedValue });
        return 'true';
      default:
        return 'true';
    }
  }

  private buildFallbackWorkspace(courseName: string): CourseWorkspace {
    return {
      heroLabel: courseName,
      summary: 'Review the core learning materials, supporting documents, and quick knowledge checks for this module.',
      videoDuration: '5 minutes',
      sections: ['Course Overview', 'Key Learning Points', 'Section Summary'],
      steps: [
        {
          id: `${courseName}-step-1`,
          kind: 'Video',
          title: 'Course Overview',
          summary: 'Start with the introductory walkthrough for this learning item.',
          video: {
            title: 'Course Overview',
            durationLabel: '5 minutes',
          },
        },
        {
          id: `${courseName}-step-2`,
          kind: 'Video',
          title: 'Key Learning Points',
          summary: 'Continue with the main learning points in the order provided.',
          video: {
            title: 'Key Learning Points',
          },
        },
        {
          id: `${courseName}-step-3`,
          kind: 'Document',
          title: 'Reference Guide',
          summary: 'Review the supporting guide for this module.',
          document: {
            title: 'Reference Guide',
          },
        },
        {
          id: `${courseName}-step-4`,
          kind: 'Assessment',
          title: 'Section Questions',
          summary: 'Complete the knowledge check after reviewing the material.',
          assessment: {
            title: 'Section Questions',
            assessmentType: 'Quiz',
            questions: [
              {
                id: `${courseName}-step-4-question-1`,
                questionType: 'Multiple Choice',
                prompt: 'Which statement best reflects the purpose of this course?',
                points: 1,
                options: ['To reinforce workplace learning', 'To skip onboarding steps', 'To avoid compliance policies'],
              },
            ],
          },
        },
      ],
      documents: ['Course Overview PDF', 'Supporting Notes', 'Reference Guide'],
      assessment: {
        title: 'Section Questions',
        assessmentType: 'Quiz',
        questions: [
          {
            id: `${courseName}-step-4-question-1`,
            questionType: 'Multiple Choice',
            prompt: 'Which statement best reflects the purpose of this course?',
            points: 1,
            options: ['To reinforce workplace learning', 'To skip onboarding steps', 'To avoid compliance policies'],
          },
        ],
      },
    };
  }

  private mergeManagerAssessmentWorkspace(course: StudentCourse, baseWorkspace: CourseWorkspace): CourseWorkspace {
    const managerOffering = this.managerData.offerings().find((offering) => offering.id === course.offeringId || offering.title === course.name);
    if (!managerOffering) {
      return baseWorkspace;
    }

    const managerVideos = managerOffering.contentItems
      .filter((item) => item.kind === 'Video')
      .map((item) => ({
        title: item.title,
        fileName: item.uploadedFileName || undefined,
        resourceLink: item.resourceLink || undefined,
        uploadedDataUrl: item.uploadedFileDataUrl || undefined,
      } satisfies WorkspaceVideo));

    const managerDocuments = managerOffering.contentItems
      .filter((item) => item.kind === 'Document' || item.kind === 'Scorm')
      .map((item) => ({
        title: item.title,
        fileName: item.uploadedFileName || item.title,
        resourceLink: item.resourceLink || undefined,
        uploadedDataUrl: item.uploadedFileDataUrl || undefined,
        convertedPdfUrl: item.convertedPdfUrl || undefined,
        requiresAcknowledgement: item.kind === 'Document' ? Boolean(item.requiresAcknowledgement) : false,
        allowDownload: item.allowDownload !== false,
      } satisfies WorkspaceDocument));
    const orderedSteps = managerOffering.contentItems.reduce<WorkspaceStep[]>((steps, item, itemIndex) => {
      if (item.kind === 'Video') {
        const video = {
          title: item.title,
          fileName: item.uploadedFileName || undefined,
          resourceLink: item.resourceLink || undefined,
          uploadedDataUrl: item.uploadedFileDataUrl || undefined,
        } satisfies WorkspaceVideo;

        steps.push({
          id: item.id || `${managerOffering.id}-video-${itemIndex + 1}`,
          kind: 'Video',
          title: item.title,
          summary: '',
          video,
        } satisfies WorkspaceStep);

        return steps;
      }

      if (item.kind === 'Document') {
        const document = {
          title: item.title,
          fileName: item.uploadedFileName || item.title,
          resourceLink: item.resourceLink || undefined,
          uploadedDataUrl: item.uploadedFileDataUrl || undefined,
          convertedPdfUrl: item.convertedPdfUrl || undefined,
          requiresAcknowledgement: Boolean(item.requiresAcknowledgement),
          allowDownload: item.allowDownload !== false,
        } satisfies WorkspaceDocument;

        steps.push({
          id: item.id || `${managerOffering.id}-document-${itemIndex + 1}`,
          kind: 'Document',
          title: item.title,
          summary: document.requiresAcknowledgement
            ? 'Review this document and acknowledge it before moving on.'
            : 'Open the supporting document for this step.',
          document,
        } satisfies WorkspaceStep);

        return steps;
      }

      if (item.kind === 'Scorm') {
        const scormPackage = {
          title: item.title,
          fileName: item.uploadedFileName || item.title,
          resourceLink: item.resourceLink || undefined,
          uploadedDataUrl: item.uploadedFileDataUrl || undefined,
          convertedPdfUrl: undefined,
          requiresAcknowledgement: false,
          allowDownload: item.allowDownload !== false,
        } satisfies WorkspaceDocument;

        steps.push({
          id: item.id || `${managerOffering.id}-scorm-${itemIndex + 1}`,
          kind: 'Scorm',
          title: item.title,
          summary: 'Launch this SCORM package in a new tab.',
          document: scormPackage,
        } satisfies WorkspaceStep);

        return steps;
      }

      steps.push({
        id: this.createAssessmentUnitStepId(managerOffering.id, item.id, itemIndex),
        kind: 'Assessment',
        title: item.title,
        summary: item.questions[0]?.prompt || `Complete this ${item.assessmentType?.toLowerCase() ?? 'assessment'} step in sequence.`,
        assessment: this.buildWorkspaceAssessment(item, managerOffering.id, itemIndex, baseWorkspace.assessment),
      } satisfies WorkspaceStep);

      return steps;
    }, []);

    return {
      ...baseWorkspace,
      heroLabel: managerOffering.title,
      summary: managerOffering.description || baseWorkspace.summary,
      sections: orderedSteps.length
        ? orderedSteps.map((step) => step.title)
        : managerVideos.length
          ? managerVideos.map((item) => item.title)
          : baseWorkspace.sections,
      steps: orderedSteps.length ? orderedSteps : baseWorkspace.steps,
      videos: managerVideos.length ? managerVideos : baseWorkspace.videos,
      documents: managerDocuments.length ? managerDocuments : baseWorkspace.documents,
    };
  }

  private buildWorkspaceAssessment(item: TrainingContentItem, offeringId: string, itemIndex: number, fallback: WorkspaceAssessment): WorkspaceAssessment {
    const fallbackQuestions = fallback.questions.length
      ? fallback.questions
      : [
          {
            id: this.createAssessmentStepId(offeringId, item.id, itemIndex, 0),
            questionType: 'Multiple Choice' as TrainingQuestionType,
            prompt: item.title || fallback.title,
            points: 1,
            options: [],
          },
        ];

    const questions = item.questions.length
      ? item.questions.map((question, questionIndex) => ({
          id: this.createAssessmentStepId(offeringId, item.id, itemIndex, questionIndex),
          questionType: question.questionType || fallbackQuestions[0]?.questionType || 'Multiple Choice',
          prompt: question.prompt || fallbackQuestions[0]?.prompt || item.title || fallback.title,
          points: typeof question.points === 'number' && Number.isFinite(question.points) && question.points > 0 ? question.points : 1,
          options: question.choices.map((choice) => choice.text).filter(Boolean),
          matchingPairs: question.matchingPairs.length ? question.matchingPairs : undefined,
          dragAndDropEnabled: question.dragAndDropEnabled,
          attachmentFileName: question.attachmentFileName || undefined,
          attachmentDataUrl: question.attachmentDataUrl || undefined,
        }))
      : fallbackQuestions;

    return {
      ...fallback,
      assessmentType: item.assessmentType ?? fallback.assessmentType,
      title: item.title || fallback.title,
      passMarkPercentage: item.passMarkPercentage,
      maxAttempts: item.maxAttempts,
      resourceLink: item.resourceLink || fallback.resourceLink,
      questions,
    };
  }

  private createAssessmentUnitStepId(offeringId: string, itemId: string, itemIndex: number) {
    return itemId || `${offeringId}-assessment-${itemIndex + 1}`;
  }

  private createAssessmentStepId(offeringId: string, itemId: string, itemIndex: number, questionIndex: number) {
    const baseId = itemId || `${offeringId}-assessment-${itemIndex + 1}`;
    return `${baseId}-question-${questionIndex + 1}`;
  }

  private selectedDocumentKey() {
    const courseName = this.selectedCourse()?.name;
    const documentTitle = this.selectedDocument()?.title;

    if (!courseName || !documentTitle) {
      return '';
    }

    return `${courseName}::${documentTitle}`;
  }

  private selectedVideoKey() {
    const courseName = this.selectedCourse()?.name;
    const videoTitle = this.selectedVideo()?.title;

    if (!courseName || !videoTitle) {
      return '';
    }

    return `${courseName}::${videoTitle}`;
  }

  private formatVideoDuration(durationSeconds: number) {
    const totalSeconds = Math.max(0, Math.round(durationSeconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private getEmbeddedVideoUrl(videoSource: string) {
    if (!videoSource) {
      return '';
    }

    const youTubeId = this.extractYouTubeVideoId(videoSource);
    if (youTubeId) {
      return `https://www.youtube.com/embed/${youTubeId}`;
    }

    const vimeoId = this.extractVimeoVideoId(videoSource);
    if (vimeoId) {
      return `https://player.vimeo.com/video/${vimeoId}`;
    }

    return '';
  }

  private canPreviewDocumentSource(documentSource: string) {
    if (!documentSource) {
      return false;
    }

    if (documentSource.startsWith('data:application/pdf')) {
      return true;
    }

    if (documentSource.startsWith('data:image/')) {
      return true;
    }

    if (documentSource.startsWith('data:text/plain')) {
      return true;
    }

    return /\.(pdf|png|jpe?g|gif|webp|svg|txt)(\?.*)?$/i.test(documentSource);
  }

  private extractYouTubeVideoId(videoSource: string) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/i,
      /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/i,
      /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/i,
      /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/i,
    ];

    for (const pattern of patterns) {
      const match = videoSource.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return '';
  }

  private extractVimeoVideoId(videoSource: string) {
    const match = videoSource.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    return match?.[1] ?? '';
  }

  private updateMentorshipSubmission(update: Partial<MentorshipSubmission>) {
    const assessmentKey = this.currentAssessmentAttemptKey();
    if (!assessmentKey || this.isAssessmentSubmitted()) {
      return;
    }

    this.clearAssessmentSubmissionFeedback();

    this.mentorshipSubmissions.update((submissions) => ({
      ...submissions,
      [assessmentKey]: {
        mentorName: submissions[assessmentKey]?.mentorName ?? this.currentMentorshipReview()?.mentorName ?? '',
        sessionDate: submissions[assessmentKey]?.sessionDate ?? this.currentMentorshipReview()?.sessionDate ?? '',
        actionPlan: submissions[assessmentKey]?.actionPlan ?? this.currentMentorshipReview()?.actionPlan ?? '',
        ...update,
      },
    }));
  }

  private calculateCourseProgress(courseName: string, steps: WorkspaceStep[]) {
    if (!steps.length) {
      return 0;
    }

    const completedStepCount = steps.filter((step) => this.isStepCompleted(courseName, step)).length;
    return (completedStepCount / steps.length) * 100;
  }

  private isStepCompleted(courseName: string, step: WorkspaceStep) {
    if (step.kind === 'Assessment') {
      return this.isAssessmentComplete(courseName, step);
    }

    const completedSteps = this.completedCourseSteps();
    const stepKey = this.courseStepKey(courseName, step.id);

    if (completedSteps[stepKey]) {
      return true;
    }

    if (step.kind === 'Document' && step.document?.requiresAcknowledgement) {
      return this.acknowledgedDocuments()[this.documentKey(courseName, step.document.title)] ?? false;
    }

    return false;
  }

  private isAssessmentComplete(courseName: string, step: WorkspaceStep) {
    const assessmentType = step.assessment?.assessmentType;
    const student = this.currentStudentRecord();
    const course = this.selectedCourse();
    const offering = this.selectedManagerOffering();
    const questionIds = step.assessment?.questions.map((question) => question.id).filter(Boolean) ?? [];

    if (!questionIds.length) {
      return false;
    }

    if (assessmentType === 'Mentorship') {
      return Boolean(
        student
        && course
        && offering
        && questionIds.every((questionId) => this.managerData.mentorshipSubmissionForStudentOffering(student.id, offering.id, questionId, false)?.status === 'Approved'),
      );
    }

    if (assessmentType === 'Assignment') {
      return Boolean(
        student
        && course
        && offering
        && questionIds.every((questionId) => this.managerData.assignmentSubmissionForStudentOffering(student.id, offering.id, questionId, false)?.status === 'Approved'),
      );
    }

    if (!course) {
      return false;
    }

    return Boolean(this.studentData.assessmentAttempts()[this.assessmentAttemptKey(course, step.id)]?.passed);
  }

  private markSelectedStepComplete() {
    const step = this.selectedCourseStep();
    if (!step) {
      return;
    }

    this.markStepComplete(step);
  }

  private markStepComplete(step: WorkspaceStep) {
    const courseName = this.selectedCourse()?.name;
    if (!courseName || step.kind === 'Assessment') {
      return;
    }

    const stepKey = this.courseStepKey(courseName, step.id);
    this.completedCourseSteps.update((current) => ({
      ...current,
      [stepKey]: true,
    }));
  }

  private courseStepKey(courseName: string, stepId: string) {
    return `${courseName}::${stepId}`;
  }

  private assessmentAttemptKey(course: StudentCourse, stepId: string) {
    return `${course.offeringId || course.name}::${stepId}`;
  }

  private assessmentDraftKeyForQuestion(questionId: string) {
    const course = this.selectedCourse();
    const normalizedQuestionId = questionId.trim();

    if (!course || !normalizedQuestionId) {
      return '';
    }

    return this.assessmentAttemptKey(course, normalizedQuestionId);
  }

  private submittedQuizAnswerForQuestion(question: WorkspaceAssessmentQuestion) {
    const assessmentKey = this.assessmentDraftKeyForQuestion(question.id);

    if (!assessmentKey) {
      return '';
    }

    if (question.questionType === 'Short Answer' || question.questionType === 'Long Answer') {
      return this.assessmentResponses()[assessmentKey]?.trim() ?? '';
    }

    return this.assessmentSelections()[assessmentKey]?.trim() ?? '';
  }

  private matchingAssignmentsForQuestion(questionId: string) {
    const assessmentKey = this.assessmentDraftKeyForQuestion(questionId);
    return assessmentKey ? this.matchingAssignments()[assessmentKey] ?? {} : {};
  }

  private buildQuizSubmissionAnswers(assessment: WorkspaceAssessment) {
    return assessment.questions.map((question) => {
      const matchingAssignments = this.matchingAssignmentsForQuestion(question.id);

      return {
        questionId: question.id,
        prompt: question.prompt,
        questionType: question.questionType,
        responseText: question.questionType === 'Short Answer' || question.questionType === 'Long Answer'
          ? this.submittedQuizAnswerForQuestion(question)
          : '',
        selectedOption: question.questionType !== 'Matching' && question.questionType !== 'Short Answer' && question.questionType !== 'Long Answer'
          ? this.submittedQuizAnswerForQuestion(question)
          : '',
        matchingResponses: question.questionType === 'Matching'
          ? (question.matchingPairs ?? []).map((pair) => ({
              prompt: pair.prompt,
              answer: matchingAssignments[pair.prompt] ?? '',
            }))
          : [],
      };
    });
  }

  private isQuizQuestionAnswered(question: WorkspaceAssessmentQuestion) {
    if (question.questionType === 'Matching') {
      const pairCount = question.matchingPairs?.length ?? 0;
      return pairCount > 0 && Object.keys(this.matchingAssignmentsForQuestion(question.id)).length === pairCount;
    }

    if (question.questionType === 'Document Upload') {
      const assessmentKey = this.assessmentDraftKeyForQuestion(question.id);
      return assessmentKey ? this.assignmentDocumentSubmissions()[assessmentKey]?.dataUrl?.trim().length > 0 : false;
    }

    if (question.questionType === 'Short Answer' || question.questionType === 'Long Answer') {
      return this.submittedQuizAnswerForQuestion(question).length > 0;
    }

    return this.submittedQuizAnswerForQuestion(question).length > 0;
  }

  private setAssessmentSubmissionError(message: string) {
    this.assessmentSubmissionFeedback.set({ message, tone: 'error' });
  }

  private clearAssessmentSubmissionFeedback() {
    this.assessmentSubmissionFeedback.set(null);
  }

  private documentKey(courseName: string, documentTitle: string) {
    return `${courseName}::${documentTitle}`;
  }
}
