import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PowerPointWindowComponent } from './powerpoint-window.component';
import { resolvePowerPointUploadType } from './powerpoint-preview';
import { AssignmentSubmissionRecord, TrainingOffering, TrainingOfferingType } from './training-manager-data.service';
import { LmsBackendService } from './lms-backend.service';

type PublishedOfferingUpdate = {
  id: string;
  title: string;
  type: TrainingOfferingType;
  category: string;
  description: string;
  completionDeadline: string;
  status: TrainingOffering['status'];
  thumbnailDataUrl: string | null;
};

type PublishedOfferingPresentationPreview = {
  fileName: string;
  message: string;
};

@Component({
  selector: 'published-offering-detail',
  imports: [CommonModule, ReactiveFormsModule, PowerPointWindowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="published-offering-detail-card" aria-labelledby="published-offering-detail-title">
      <div class="published-offering-detail-header">
        <div>
          <p class="published-offering-eyebrow">Course workspace</p>
          <h3 id="published-offering-detail-title">{{ offering().title }}</h3>
          <p class="published-offering-detail-copy">{{ offering().description }}</p>
        </div>
        <div class="published-offering-detail-actions">
          @if (editMode()) {
            <button type="button" class="detail-action-btn" (click)="cancelEdit()">Cancel</button>
            <button type="button" class="detail-action-btn detail-action-btn-primary" [disabled]="thumbnailUploading()" (click)="saveEdit()">Save changes</button>
          } @else {
            <button type="button" class="detail-action-btn" (click)="close.emit()">Close</button>
            <button type="button" class="detail-action-btn" (click)="startEdit()">Edit course</button>
            <button type="button" class="detail-action-btn" (click)="editContent.emit()">Edit content</button>
            <button type="button" class="detail-action-btn detail-action-btn-danger" (click)="deleteCourse.emit()">Delete course</button>
            <button type="button" class="detail-action-btn detail-action-btn-primary" (click)="enroll.emit()">Assign learners</button>
          }
        </div>
      </div>

      @if (saveSuccessVisible() && !editMode()) {
        <div class="published-offering-save-banner" role="status" aria-live="polite">
          Course changes saved successfully.
        </div>
      }

      @if (editMode()) {
        <form class="published-offering-edit-form" [formGroup]="editForm" (ngSubmit)="saveEdit()">
          <div class="published-offering-edit-grid">
            <label>
              <span>Course Title</span>
              <input formControlName="title" type="text" placeholder="Course title" />
            </label>

            <label>
              <span>Type</span>
              <select formControlName="type">
                @for (type of offeringTypes; track type) {
                  <option [value]="type">{{ type }}</option>
                }
              </select>
            </label>

            <label>
              <span>Category</span>
              <input formControlName="category" type="text" placeholder="Category" />
            </label>

            <label>
              <span>Completion Deadline</span>
              <input formControlName="completionDeadline" type="date" />
            </label>

            <label>
              <span>Status</span>
              <select formControlName="status">
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
              </select>
            </label>

            <label class="published-offering-edit-full">
              <span>Description</span>
              <textarea formControlName="description" rows="5" placeholder="Describe what learners will cover"></textarea>
            </label>

            <label class="published-offering-edit-full published-thumbnail-upload-field">
              <span>Course Thumbnail</span>
              <input type="file" accept="image/*" (change)="onThumbnailSelected($event)" />
              <div class="published-thumbnail-row">
                <span class="published-thumbnail-copy">{{ selectedThumbnailName() || (thumbnailRemoved() ? 'Thumbnail will be removed on save' : (offering().thumbnailDataUrl ? 'Current thumbnail in use' : 'No thumbnail selected')) }}</span>
                @if (effectiveThumbnailPreview()) {
                  <button type="button" class="detail-action-btn detail-action-btn-subtle" (click)="removeThumbnail()">Remove thumbnail</button>
                }
              </div>
            </label>

            <div class="published-offering-thumbnail-preview" [class.published-offering-thumbnail-preview-empty]="!effectiveThumbnailPreview()">
              @if (effectiveThumbnailPreview()) {
                <img [src]="effectiveThumbnailPreview()!" alt="{{ offering().title }} thumbnail preview" />
              } @else {
                <span>Thumbnail preview will appear here.</span>
              }
            </div>
          </div>

          @if (editForm.invalid && editForm.touched) {
            <p class="published-offering-form-error">Complete all required fields before saving.</p>
          }
        </form>
      } @else {
        <div class="published-offering-detail-meta">
          <span class="offering-meta-pill">Created: {{ offering().createdOn }}</span>
          <span class="offering-meta-pill">Deadline: {{ offering().completionDeadline || 'Not set' }}</span>
          <span class="offering-meta-pill">{{ offering().type }}</span>
          <span class="offering-meta-pill">{{ assignedCount() }} assigned</span>
          <span class="offering-meta-pill">{{ contentSummary() }}</span>
        </div>

        <div class="published-offering-detail-layout">
          <section class="published-offering-detail-section">
            <div class="published-offering-detail-section-title">Learning flow</div>
            <div class="offering-flow-list">
              @for (item of offering().contentItems; track item.id; let itemIndex = $index) {
                <div class="offering-flow-item">
                  <span class="offering-flow-index">{{ itemIndex + 1 }}</span>
                  <div class="offering-flow-copy">
                    <div class="offering-flow-title-row">
                      <span class="offering-flow-kind">{{ item.kind }}</span>
                      <strong>{{ item.title }}</strong>
                    </div>
                    <div class="offering-flow-detail">
                      @if (item.kind === 'Assessment') {
                        {{ assessmentFlowSummary(item) }}
                      } @else if (item.uploadedFileName) {
                        {{ item.uploadedFileName }}
                      } @else if (item.resourceLink) {
                        {{ item.resourceLink }}
                      } @else {
                        Resource pending
                      }
                    </div>

                    @if (presentationPreview(item, itemIndex); as preview) {
                      <div class="published-offering-presentation-preview">
                        <div class="published-offering-presentation-meta">
                          <span>PowerPoint</span>
                          <span>{{ preview.fileName }}</span>
                        </div>

                        <powerpoint-window
                          [viewerTitle]="'PowerPoint file for ' + preview.fileName"
                          [sourceDataUrl]="item.uploadedFileDataUrl || null"
                          [sourceFileName]="preview.fileName"
                          [emptyMessage]="preview.message"></powerpoint-window>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </section>

          <section class="published-offering-detail-section published-offering-detail-section-summary">
            <div class="published-offering-detail-section-title">At a glance</div>
            <div class="published-offering-summary-grid">
              <div class="published-offering-summary-card">
                <strong>{{ offering().contentItems.length }}</strong>
                <span>Flow items</span>
              </div>
              <div class="published-offering-summary-card">
                <strong>{{ assessmentCount() }}</strong>
                <span>Assessments</span>
              </div>
              <div class="published-offering-summary-card">
                <strong>{{ questionCount() }}</strong>
                <span>Questions</span>
              </div>
              <div class="published-offering-summary-card">
                <strong>{{ assignedCount() }}</strong>
                <span>Learners assigned</span>
              </div>
            </div>

            <div class="published-offering-question-list">
              <div class="published-offering-detail-section-title">Assessment prompts</div>
              @if (assessmentPrompts().length) {
                @for (prompt of assessmentPrompts(); track prompt.id) {
                  <div class="published-offering-question-item">
                    <strong>{{ prompt.title }}</strong>
                    <span>{{ prompt.prompt }}</span>
                    <span>{{ prompt.summary }}</span>
                  </div>
                }
              } @else {
                <div class="published-offering-question-item published-offering-question-item-empty">
                  <span>No assessment prompts added yet.</span>
                </div>
              }
            </div>

            <div class="published-offering-question-list">
              <div class="published-offering-detail-section-title">Assignment submissions</div>
              @if (assignmentSubmissions().length) {
                @for (submission of assignmentSubmissions(); track submission.id) {
                  <div class="published-offering-question-item">
                    <strong>{{ submission.studentName }}</strong>
                    <span>{{ submission.studentEmail }}</span>
                    <span>Submitted {{ submission.submittedAt }} • {{ submission.questionType }}</span>
                    <span>Review status: {{ submission.status }}</span>
                    @if (submission.awardedPoints !== null) {
                      <span>Mark: {{ formatAssignmentMark(submission) }}</span>
                    }
                    @if (submission.reviewedAt) {
                      <span>Reviewed {{ submission.reviewedAt }}</span>
                    }
                    @if (submission.responseText) {
                      <span>{{ submission.responseText }}</span>
                    }
                    @if (submission.documentFileName) {
                      <div class="published-offering-submission-document-row">
                        <span>{{ submission.documentFileName }}</span>
                        <button
                          type="button"
                          class="detail-action-btn detail-action-btn-subtle published-offering-submission-open-btn"
                          (click)="downloadAssignmentDocument(submission.documentDataUrl, submission.documentFileName)">
                          Download assignment
                        </button>
                      </div>
                    }
                    @if (submission.reviewerFeedback) {
                      <div class="published-offering-review-feedback">
                        <strong>{{ submission.reviewerName || 'Manager' }} feedback</strong>
                        <span>{{ submission.reviewerFeedback }}</span>
                      </div>
                    }
                    @if (selectedAssignmentReviewId() === submission.id) {
                      <form class="published-offering-review-form" [formGroup]="assignmentReviewForm" (ngSubmit)="applyAssignmentReview('Approved')">
                        <label>
                          <span>Mark awarded</span>
                          <input formControlName="awardedPoints" type="number" min="0" [max]="submission.possiblePoints" step="1" placeholder="Out of {{ submission.possiblePoints }}" />
                        </label>
                        <label>
                          <span>Manager feedback</span>
                          <textarea formControlName="feedback" rows="4" placeholder="Add feedback for the learner"></textarea>
                        </label>
                        <div class="published-offering-review-actions">
                          <button type="button" class="detail-action-btn" (click)="cancelAssignmentReview()">Cancel</button>
                          <button type="button" class="detail-action-btn" (click)="applyAssignmentReview('Needs Revision')">Request revision</button>
                          <button type="submit" class="detail-action-btn detail-action-btn-primary">Approve submission</button>
                        </div>
                      </form>
                    } @else {
                      <button type="button" class="detail-action-btn published-offering-review-trigger" (click)="openAssignmentReview(submission.id)">
                        {{ submission.status === 'Pending Review' ? 'Review submission' : 'Update review' }}
                      </button>
                    }
                  </div>
                }
              } @else {
                <div class="published-offering-question-item published-offering-question-item-empty">
                  <span>No assignment submissions yet.</span>
                </div>
              }
            </div>
          </section>
        </div>
      }
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }

    .published-offering-detail-card {
      display: grid;
      gap: 1rem;
      padding: 1.1rem;
      border-radius: 24px;
      border: 1px solid rgba(148, 163, 184, 0.24);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(240, 249, 255, 0.9));
      box-shadow: 0 22px 48px rgba(15, 23, 42, 0.08);
    }

    .published-offering-detail-header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
    }

    .published-offering-eyebrow,
    .published-offering-detail-copy,
    .published-offering-detail-section-title,
    .published-offering-summary-card strong,
    .published-offering-summary-card span,
    .published-offering-question-item strong,
    .published-offering-question-item span,
    .published-offering-form-error {
      margin: 0;
    }

    .published-offering-eyebrow {
      color: #4f46e5;
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h3 {
      margin: 0;
      color: #173446;
      font-size: 1.18rem;
      font-weight: 800;
      line-height: 1.18;
    }

    .published-offering-detail-copy {
      color: #475569;
      max-width: 50rem;
      line-height: 1.6;
    }

    .published-offering-detail-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
    }

    .published-offering-save-banner {
      padding: 0.82rem 0.95rem;
      border-radius: 16px;
      border: 1px solid rgba(74, 222, 128, 0.32);
      background: linear-gradient(135deg, rgba(240, 253, 244, 0.98), rgba(220, 252, 231, 0.96));
      color: #166534;
      font-size: 0.86rem;
      font-weight: 800;
      box-shadow: 0 12px 24px rgba(34, 197, 94, 0.08);
    }

    .detail-action-btn {
      border: 1px solid rgba(99, 102, 241, 0.18);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.92);
      color: #4338ca;
      padding: 0.72rem 1rem;
      font: inherit;
      font-size: 0.86rem;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, color 0.18s ease;
    }

    .detail-action-btn:hover,
    .detail-action-btn:focus-visible {
      transform: translateY(-1px);
      box-shadow: 0 12px 24px rgba(79, 70, 229, 0.12);
      outline: none;
    }

    .detail-action-btn-primary {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #fff;
      border-color: transparent;
    }

    .detail-action-btn-danger {
      border-color: rgba(239, 68, 68, 0.28);
      background: linear-gradient(135deg, #fef2f2, #fee2e2);
      color: #b91c1c;
    }

    .published-offering-edit-form,
    .published-offering-detail-section,
    .published-offering-question-list {
      display: grid;
      gap: 0.85rem;
    }

    .published-offering-edit-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.85rem;
    }

    .published-offering-edit-full {
      grid-column: 1 / -1;
    }

    .published-thumbnail-upload-field {
      align-content: start;
    }

    label {
      display: grid;
      gap: 0.35rem;
      color: #173446;
      font-size: 0.82rem;
      font-weight: 700;
    }

    input,
    select,
    textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #dbe2ea;
      border-radius: 14px;
      background: #fff;
      color: #173446;
      padding: 0.8rem 0.9rem;
      font: inherit;
      font-size: 0.9rem;
    }

    textarea {
      resize: vertical;
      min-height: 7.5rem;
    }

    .published-thumbnail-copy {
      color: #64748b;
      font-size: 0.8rem;
      font-weight: 700;
    }

    .published-thumbnail-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .detail-action-btn-subtle {
      padding: 0.5rem 0.85rem;
      font-size: 0.78rem;
      color: #b91c1c;
      border-color: rgba(248, 113, 113, 0.28);
      background: #fff5f5;
    }

    .published-offering-thumbnail-preview {
      grid-column: 1 / -1;
      min-height: 210px;
      border-radius: 18px;
      overflow: hidden;
      border: 1px dashed #cbd5e1;
      background: linear-gradient(135deg, #e0f2fe, #eef2ff);
      display: grid;
      place-items: center;
    }

    .published-offering-thumbnail-preview img {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 210px;
      object-fit: cover;
    }

    .published-offering-thumbnail-preview-empty {
      padding: 1rem;
      color: #64748b;
      font-size: 0.9rem;
      font-weight: 700;
      text-align: center;
    }

    .published-offering-form-error {
      color: #b91c1c;
      font-size: 0.82rem;
      font-weight: 700;
    }

    .published-offering-detail-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
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

    .published-offering-detail-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.9fr);
      gap: 1rem;
      align-items: start;
    }

    .published-offering-detail-section {
      padding: 0.95rem;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.82);
      border: 1px solid rgba(226, 232, 240, 0.95);
    }

    .published-offering-detail-section-summary {
      align-content: start;
    }

    .published-offering-detail-section-title {
      color: #173446;
      font-size: 0.9rem;
      font-weight: 800;
      letter-spacing: 0.02em;
    }

    .offering-flow-list {
      display: grid;
      gap: 0.7rem;
    }

    .offering-flow-item {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.7rem;
      align-items: start;
      padding: 0.8rem;
      border-radius: 16px;
      background: #fff;
      border: 1px solid #e2e8f0;
    }

    .offering-flow-index {
      display: inline-flex;
      width: 1.7rem;
      height: 1.7rem;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: #eef2ff;
      color: #4f46e5;
      font-size: 0.78rem;
      font-weight: 800;
    }

    .offering-flow-copy {
      display: grid;
      gap: 0.24rem;
      min-width: 0;
    }

    .offering-flow-title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.45rem;
    }

    .offering-flow-kind {
      color: #4f46e5;
      font-size: 0.74rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .offering-flow-title-row strong {
      color: #173446;
      font-size: 0.94rem;
      line-height: 1.35;
    }

    .offering-flow-detail {
      color: #64748b;
      font-size: 0.84rem;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .published-offering-presentation-preview {
      display: grid;
      gap: 0.7rem;
      margin-top: 0.6rem;
    }

    .published-offering-presentation-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      color: #475569;
      font-size: 0.77rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .published-offering-presentation-message {
      color: #b45309;
      font-size: 0.82rem;
      font-weight: 700;
      line-height: 1.5;
    }

    .published-offering-summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .published-offering-summary-card {
      display: grid;
      gap: 0.2rem;
      padding: 0.8rem;
      border-radius: 16px;
      background: linear-gradient(180deg, #ffffff 0%, #eff6ff 100%);
      border: 1px solid rgba(191, 219, 254, 0.8);
    }

    .published-offering-summary-card strong {
      color: #1e3a8a;
      font-size: 1.15rem;
      font-weight: 800;
    }

    .published-offering-summary-card span {
      color: #64748b;
      font-size: 0.8rem;
      font-weight: 700;
    }

    .published-offering-question-item {
      display: grid;
      gap: 0.18rem;
      padding: 0.75rem 0.8rem;
      border-radius: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }

    .published-offering-question-item strong {
      color: #173446;
      font-size: 0.82rem;
    }

    .published-offering-question-item span {
      color: #64748b;
      font-size: 0.82rem;
      line-height: 1.45;
    }

    .published-offering-submission-document-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.6rem;
    }

    .published-offering-submission-open-btn {
      justify-self: start;
    }

    .published-offering-review-feedback,
    .published-offering-review-form {
      display: grid;
      gap: 0.45rem;
      padding-top: 0.2rem;
    }

    .published-offering-review-feedback strong {
      color: #173446;
      font-size: 0.8rem;
    }

    .published-offering-review-form textarea {
      min-height: 6rem;
    }

    .published-offering-review-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }

    .published-offering-review-trigger {
      justify-self: start;
    }

    .published-offering-question-item-empty {
      background: #fff;
    }

    @media (max-width: 1080px) {
      .published-offering-detail-layout {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .published-offering-detail-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .published-offering-detail-actions,
      .detail-action-btn {
        width: 100%;
      }

      .published-offering-edit-grid,
      .published-offering-summary-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class PublishedOfferingDetailComponent {
  readonly offering = input.required<TrainingOffering>();
  readonly assignedCount = input(0);
  readonly assessmentCount = input(0);
  readonly questionCount = input(0);
  readonly contentSummary = input('');
  readonly assignmentSubmissions = input<AssignmentSubmissionRecord[]>([]);

  readonly close = output<void>();
  readonly enroll = output<void>();
  readonly editContent = output<void>();
  readonly deleteCourse = output<void>();
  readonly save = output<PublishedOfferingUpdate>();
  readonly reviewAssignment = output<{ submissionId: string; status: 'Approved' | 'Needs Revision'; feedback: string; awardedPoints: number | null }>();

  readonly editMode = signal(false);
  readonly saveSuccessVisible = signal(false);
  readonly selectedThumbnailDataUrl = signal<string | null>(null);
  readonly selectedThumbnailName = signal('');
  readonly thumbnailRemoved = signal(false);
  readonly thumbnailUploading = signal(false);
  readonly selectedAssignmentReviewId = signal<string | null>(null);
  private readonly backend = inject(LmsBackendService);
  readonly offeringTypes: ReadonlyArray<TrainingOfferingType> = ['Course', 'Programme'];
  readonly editForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl<TrainingOfferingType>('Course', { nonNullable: true, validators: [Validators.required] }),
    category: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    completionDeadline: new FormControl('', { nonNullable: true }),
    status: new FormControl<TrainingOffering['status']>('Published', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(12)] }),
  });
  readonly assignmentReviewForm = new FormGroup({
    awardedPoints: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    feedback: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
  });

  readonly assessmentPrompts = computed(() =>
    this.offering().contentItems.flatMap((item) =>
      item.kind === 'Assessment'
        ? item.questions.map((question, questionIndex) => ({
            id: `${item.id}-${questionIndex}`,
            title: `${item.title} ${questionIndex + 1}`,
            prompt: question.prompt,
            summary: this.assessmentQuestionSummary(question),
          }))
        : [],
    ),
  );
  readonly presentationPreviews = computed(() => {
    const previews = new Map<string, PublishedOfferingPresentationPreview>();

    this.offering().contentItems.forEach((item, itemIndex) => {
      if (item.kind !== 'Document' || !item.uploadedFileDataUrl) {
        return;
      }

      const fileName = item.uploadedFileName || item.title;
      const previewableType = resolvePowerPointUploadType(fileName, item.uploadedFileDataUrl);
      if (!previewableType) {
        return;
      }

      const previewKey = this.contentItemPreviewKey(item, itemIndex);
      previews.set(previewKey, {
        fileName,
        message:
          previewableType === 'pptx'
            ? 'Open this presentation in Microsoft PowerPoint to review the original slides and formatting.'
            : 'Open this legacy PowerPoint file in Microsoft PowerPoint to review the original slides and formatting.',
      });
    });

    return previews;
  });
  readonly effectiveThumbnailPreview = computed(() => {
    if (this.thumbnailRemoved()) {
      return null;
    }

    return this.selectedThumbnailDataUrl() ?? this.offering().thumbnailDataUrl;
  });
  private saveFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(
      () => {
        const offering = this.offering();
        this.editForm.reset({
          title: offering.title,
          type: offering.type,
          category: offering.category,
          completionDeadline: offering.completionDeadline,
          status: offering.status,
          description: offering.description,
        });
        this.selectedThumbnailDataUrl.set(null);
        this.selectedThumbnailName.set('');
        this.thumbnailRemoved.set(false);
        this.selectedAssignmentReviewId.set(null);
        this.assignmentReviewForm.reset({ awardedPoints: null, feedback: '' });
        this.editMode.set(false);
      },
      { allowSignalWrites: true },
    );
  }

  onThumbnailSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || !file.type.startsWith('image/')) {
      this.selectedThumbnailDataUrl.set(null);
      this.selectedThumbnailName.set('');
      input.value = '';
      return;
    }

    this.thumbnailUploading.set(true);
    this.selectedThumbnailName.set(`Uploading ${file.name}…`);
    input.value = '';

    this.backend.uploadFileChunked(file, 'thumbnails').subscribe({
      next: (uploadEvent) => {
        if (uploadEvent.type !== 'complete') return;
        this.selectedThumbnailDataUrl.set(uploadEvent.url);
        this.selectedThumbnailName.set(file.name);
        this.thumbnailRemoved.set(false);
        this.thumbnailUploading.set(false);
      },
      error: () => {
        this.selectedThumbnailDataUrl.set(null);
        this.selectedThumbnailName.set('');
        this.thumbnailUploading.set(false);
        alert(`Failed to upload "${file.name}". Please check your connection and try again.`);
      },
    });
  }

  removeThumbnail() {
    this.selectedThumbnailDataUrl.set(null);
    this.selectedThumbnailName.set('');
    this.thumbnailRemoved.set(true);
  }

  startEdit() {
    this.clearSaveSuccess();
    this.editMode.set(true);
  }

  cancelEdit() {
    const offering = this.offering();
    this.editForm.reset({
      title: offering.title,
      type: offering.type,
      category: offering.category,
      completionDeadline: offering.completionDeadline,
      status: offering.status,
      description: offering.description,
    });
    this.selectedThumbnailDataUrl.set(null);
    this.selectedThumbnailName.set('');
    this.thumbnailRemoved.set(false);
    this.clearSaveSuccess();
    this.editMode.set(false);
  }

  saveEdit() {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    if (this.thumbnailUploading()) {
      alert('Please wait for the thumbnail upload to finish before saving.');
      return;
    }

    this.save.emit({
      id: this.offering().id,
      title: this.editForm.controls.title.value,
      type: this.editForm.controls.type.value,
      category: this.editForm.controls.category.value,
      completionDeadline: this.editForm.controls.completionDeadline.value,
      status: this.editForm.controls.status.value,
      description: this.editForm.controls.description.value,
      thumbnailDataUrl: this.thumbnailRemoved() ? null : (this.selectedThumbnailDataUrl() ?? this.offering().thumbnailDataUrl),
    });
    this.showSaveSuccess();
    this.editMode.set(false);
  }

  presentationPreview(item: TrainingOffering['contentItems'][number], itemIndex: number) {
    return this.presentationPreviews().get(this.contentItemPreviewKey(item, itemIndex)) ?? null;
  }

  assessmentFlowSummary(item: TrainingOffering['contentItems'][number]) {
    if (item.kind !== 'Assessment') {
      return 'Resource pending';
    }

    const counts = new Map<string, number>();

    for (const question of item.questions) {
      counts.set(question.questionType, (counts.get(question.questionType) ?? 0) + 1);
    }

    const detail = Array.from(counts.entries())
      .map(([questionType, count]) => `${count} ${questionType.toLowerCase()}`)
      .join(' • ');

    return `${item.assessmentType} • ${item.questions.length} ${this.assessmentEntryLabel(item)}${detail ? ' • ' + detail : ''}`;
  }

  private contentItemPreviewKey(item: TrainingOffering['contentItems'][number], itemIndex: number) {
    return item.id || `${item.kind}-${item.title}-${itemIndex}`;
  }

  private assessmentEntryLabel(item: TrainingOffering['contentItems'][number]) {
    if (item.kind !== 'Assessment') {
      return 'items';
    }

    switch (item.assessmentType) {
      case 'Assignment':
        return item.questions.length === 1 ? 'task' : 'tasks';
      case 'Mentorship':
        return item.questions.length === 1 ? 'session prompt' : 'session prompts';
      case 'Read and Acknowledge':
        return item.questions.length === 1 ? 'acknowledgement step' : 'acknowledgement steps';
      case 'Quiz':
      default:
        return item.questions.length === 1 ? 'question' : 'questions';
    }
  }

  assessmentQuestionSummary(question: TrainingOffering['contentItems'][number]['questions'][number]) {
    switch (question.questionType) {
      case 'True or False': {
        const correctAnswer = question.choices.find((choice) => choice.isCorrect)?.text ?? 'Not set';
        return `True or False • Correct answer: ${correctAnswer}`;
      }
      case 'Matching':
        return `Matching • ${question.matchingPairs.length} pair${question.matchingPairs.length === 1 ? '' : 's'} • ${question.dragAndDropEnabled ? 'Drag and drop enabled' : 'Manual matching'}`;
      case 'Multiple Choice':
        return `Multiple Choice • ${question.choices.length} option${question.choices.length === 1 ? '' : 's'}`;
      case 'Document Upload':
        return `${question.questionType} • ${question.points} point${question.points === 1 ? '' : 's'}${question.attachmentFileName ? ' • Template: ' + question.attachmentFileName : ''}`;
      case 'Long Answer':
      case 'Short Answer':
      default:
        return `${question.questionType} • ${question.points} point${question.points === 1 ? '' : 's'}${question.attachmentFileName ? ' • Document: ' + question.attachmentFileName : ''}`;
    }
  }

  downloadAssignmentDocument(documentDataUrl?: string | null, fileName?: string | null) {
    if (!documentDataUrl) {
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = documentDataUrl;
    anchor.download = fileName?.trim() || 'assignment-submission';
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

  openAssignmentReview(submissionId: string) {
    const activeSubmission = this.assignmentSubmissions().find((submission) => submission.id === submissionId) ?? null;
    this.selectedAssignmentReviewId.set(submissionId);
    this.assignmentReviewForm.reset({ awardedPoints: activeSubmission?.awardedPoints ?? null, feedback: activeSubmission?.reviewerFeedback ?? '' });
  }

  cancelAssignmentReview() {
    this.selectedAssignmentReviewId.set(null);
    this.assignmentReviewForm.reset({ awardedPoints: null, feedback: '' });
  }

  applyAssignmentReview(status: 'Approved' | 'Needs Revision') {
    const submissionId = this.selectedAssignmentReviewId();
    if (!submissionId || this.assignmentReviewForm.invalid) {
      this.assignmentReviewForm.markAllAsTouched();
      return;
    }

    const awardedPoints = this.assignmentReviewForm.controls.awardedPoints.value;
    if (status === 'Approved' && awardedPoints === null) {
      this.assignmentReviewForm.controls.awardedPoints.markAsTouched();
      return;
    }

    this.reviewAssignment.emit({
      submissionId,
      status,
      awardedPoints: status === 'Approved' ? awardedPoints : null,
      feedback: this.assignmentReviewForm.controls.feedback.value.trim(),
    });
    this.cancelAssignmentReview();
  }

  private showSaveSuccess() {
    this.clearSaveSuccess();
    this.saveSuccessVisible.set(true);
    this.saveFeedbackTimer = setTimeout(() => {
      this.saveSuccessVisible.set(false);
      this.saveFeedbackTimer = null;
    }, 3200);
  }

  private clearSaveSuccess() {
    if (this.saveFeedbackTimer) {
      clearTimeout(this.saveFeedbackTimer);
      this.saveFeedbackTimer = null;
    }

    this.saveSuccessVisible.set(false);
  }
}
