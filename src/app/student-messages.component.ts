import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { StudentDataService } from './student-data.service';

type MessageSection = 'compose' | 'inbox' | null;

const trimmedRequiredValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  return typeof value === 'string' && value.trim().length === 0 ? { trimmedRequired: true } : null;
};

const trimmedMinLengthValidator = (minLength: number): ValidatorFn => (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  if (typeof value !== 'string') {
    return null;
  }

  return value.trim().length >= minLength
    ? null
    : { minlength: { requiredLength: minLength, actualLength: value.trim().length } };
};

@Component({
  selector: 'student-messages',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="messages-section">
      <div>
        <h2>Messages</h2>
        <p class="section-copy">Choose a message area first, then work inside the relevant view.</p>
      </div>

      @if (!selectedSection()) {
        <div class="message-section-list" aria-label="Message sections">
          <button type="button" class="message-section-item" (click)="selectSection('compose')">
            <span class="message-section-item-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Z" stroke="currentColor" stroke-width="1.8"/><path d="M8 12h8M8 8.5h5M8 15.5h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </span>
            <span class="message-section-item-content">
              <span class="message-section-item-title">Compose Message</span>
              <span class="message-section-item-copy">Write and send a new message to a tutor, support team, or course contact.</span>
            </span>
          </button>
          <button type="button" class="message-section-item" (click)="selectSection('inbox')">
            <span class="message-section-item-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v9A2.5 2.5 0 0 1 16.5 18h-9A2.5 2.5 0 0 1 5 15.5v-9Z" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 10h4l1.5 2h5L17.5 10H19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
            <span class="message-section-item-content">
              <span class="message-section-item-title">Inbox</span>
              <span class="message-section-item-copy">Open recent threads and review incoming updates from tutors and support.</span>
            </span>
          </button>
        </div>
      }

      @if (selectedSection()) {
        <div class="profile-section-detail">
          <button type="button" class="section-back-btn" (click)="clearSection()">Back to message sections</button>
        </div>
      }

      @if (selectedSection() === 'compose') {
        <section class="message-compose-card" aria-label="Compose a new message">
          <div class="message-compose-title">Compose New Message</div>

          <form class="message-compose-form" [formGroup]="composeMessageForm" (ngSubmit)="onComposeMessage()">
            <label class="message-field message-field-full">
              To (Recipient)
              <input
                formControlName="recipient"
                type="text"
                list="student-message-recipient-options"
                autocomplete="off"
                placeholder="Select a recipient from the list"
                aria-label="Search recipient" />
              <datalist id="student-message-recipient-options">
                @for (recipient of messageRecipients(); track recipient) {
                  <option [value]="recipient"></option>
                }
              </datalist>
              @if (composeMessageForm.controls.recipient.dirty && composeMessageForm.controls.recipient.hasError('unknownRecipient')) {
                <span class="field-error">Please select a recipient from the list of system profiles.</span>
              }
              @if (messageRecipients().length === 0) {
                <span class="field-hint">No training managers are currently loaded in the system.</span>
              }
            </label>

            <label class="message-field message-field-full">
              Subject
              <input formControlName="subject" type="text" placeholder="Enter message subject" />
            </label>

            <label class="message-field message-field-full">
              Message
              <textarea formControlName="message" rows="7" placeholder="Write your message here..."></textarea>
            </label>

            <div class="message-actions">
              <button type="submit" [disabled]="!composeMessageForm.valid">Send Message</button>
              @if (messageSubmitted()) {
                <span class="success">Message sent to the recipient successfully.</span>
              }
            </div>
          </form>
        </section>
      }

      @if (selectedSection() === 'inbox') {
        <div class="section-heading-row">
          <div>
            <div class="message-subsection-title">Inbox</div>
            <p class="section-copy">Messages from tutors and course support.</p>
          </div>
          <span class="section-badge">{{ studentData.messages().length }} threads</span>
        </div>

        @if (selectedMessage(); as activeMessage) {
          <div class="profile-section-detail">
            <button type="button" class="section-back-btn" (click)="clearSelectedMessage()">Back to inbox</button>
          </div>

          <article class="message-thread-card" aria-label="Opened message thread">
            <div class="message-thread-header">
              <div class="message-thread-sender-block">
                <span class="message-avatar">{{ activeMessage.sender[0] }}</span>
                <div class="message-thread-heading">
                  <strong>{{ activeMessage.sender }}</strong>
                  <span>{{ activeMessage.time }}</span>
                </div>
              </div>
              @if (activeMessage.unread) {
                <span class="section-badge">Unread</span>
              }
            </div>

            <div class="message-thread-subject">{{ activeMessage.subject }}</div>

            <div class="message-thread-conversation">
              <article class="message-thread-entry message-thread-entry-incoming">
                <div class="message-thread-entry-meta">
                  <strong>{{ activeMessage.sender }}</strong>
                  <span>{{ activeMessage.time }}</span>
                </div>
                <p class="message-thread-body">{{ activeMessage.body }}</p>
              </article>

              @for (reply of activeMessage.replies; track reply.id) {
                <article class="message-thread-entry" [class.message-thread-entry-self]="reply.authorType === 'student'">
                  <div class="message-thread-entry-meta">
                    <strong>{{ reply.sender }}</strong>
                    <span class="message-thread-entry-meta-detail">
                      <span>{{ reply.time }}</span>
                      @if (reply.deliveryState) {
                        <span class="message-thread-entry-status">{{ reply.deliveryState }}</span>
                      }
                    </span>
                  </div>
                  <p class="message-thread-body">{{ reply.body }}</p>
                </article>
              }
            </div>

            <form class="message-thread-reply-form" [formGroup]="replyMessageForm" (ngSubmit)="replyToSelectedMessage()">
              <div class="message-thread-reply-header">
                <div>
                  <div class="message-thread-reply-title">Reply to {{ activeMessage.sender }}</div>
                  <p class="message-thread-reply-copy">Continue the conversation with a fuller message.</p>
                </div>
              </div>

              <label class="message-field message-field-full">
                Your reply
                <textarea formControlName="message" rows="6" placeholder="Write your reply here..."></textarea>
              </label>

              <div class="message-thread-reply-actions">
                <button type="submit" [disabled]="replyMessageForm.invalid">Send reply</button>
              </div>
            </form>
          </article>
        } @else {
          <div class="message-list">
            @for (message of studentData.messages(); track message.id) {
              <button type="button" class="message-card" [class.message-card-unread]="message.unread" (click)="openMessage(message.id)">
                <div class="message-avatar">{{ message.sender[0] }}</div>
                <div class="message-body">
                  <div class="message-row">
                    <div class="message-sender">{{ message.sender }}</div>
                    <div class="message-time">{{ message.time }}</div>
                  </div>
                  <div class="message-subject">{{ message.subject }}</div>
                </div>
              </button>
            }
          </div>
        }
      }
    </section>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 100%;
    }

    .messages-section {
      width: 100%;
      min-height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.6rem;
      background: rgba(255, 255, 255, 0.94);
      border-radius: 24px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
    }

    h2 {
      margin: 0;
      color: #14213d;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .section-copy {
      margin: 0.3rem 0 0;
      color: #64748b;
      font-size: 0.96rem;
    }

    .section-heading-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .section-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.45rem 0.8rem;
      border-radius: 999px;
      background: #eef2ff;
      color: #4f46e5;
      font-size: 0.88rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .profile-section-detail {
      display: flex;
      justify-content: flex-start;
    }

    .section-back-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.55rem 0.9rem;
      border: 1px solid #c7d2fe;
      border-radius: 999px;
      background: #eef2ff;
      color: #4338ca;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
    }

    .message-section-list {
      display: grid;
      gap: 1rem;
    }

    .message-section-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: start;
      gap: 0.85rem;
      width: 100%;
      padding: 1rem 1.1rem;
      border: 1px solid #e6edf5;
      border-radius: 18px;
      background: #f8fafc;
      text-align: left;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
    }

    .message-section-item:hover,
    .message-section-item:focus-visible {
      background: #f5f7ff;
      border-color: #c7d2fe;
      transform: translateX(2px);
      outline: none;
    }

    .message-section-item-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 14px;
      background: #eef2ff;
      color: #4338ca;
      box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.08);
    }

    .message-section-item-content {
      display: grid;
      gap: 0.35rem;
      min-width: 0;
    }

    .message-section-item-title {
      color: #14213d;
      font-size: 1rem;
      font-weight: 700;
    }

    .message-section-item-copy {
      color: #64748b;
      font-size: 0.92rem;
      line-height: 1.5;
    }

    .message-compose-card {
      display: grid;
      gap: 1.25rem;
      padding: 1.5rem;
      border-radius: 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
    }

    .message-compose-title,
    .message-subsection-title {
      color: #334155;
      font-size: 1.05rem;
      font-weight: 700;
    }

    .message-compose-form {
      display: grid;
      gap: 1rem;
      padding: 0;
      background: transparent;
      box-shadow: none;
    }

    .message-field {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      color: #374151;
      font-size: 0.95rem;
      font-weight: 700;
    }

    .message-field-full {
      grid-column: 1 / -1;
    }

    .message-compose-form select,
    .message-compose-form input,
    .message-compose-form textarea,
    .message-thread-reply-form textarea {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 0.95rem 1rem;
      font-size: 1rem;
      color: #14213d;
      background: #fff;
      outline: none;
      font-family: inherit;
      box-sizing: border-box;
      width: 100%;
    }

    .message-compose-form textarea,
    .message-thread-reply-form textarea {
      min-height: 10rem;
      resize: vertical;
    }

    .message-compose-form select:focus,
    .message-compose-form input:focus,
    .message-compose-form textarea:focus,
    .message-thread-reply-form textarea:focus {
      border-color: #818cf8;
      box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
    }

    .message-actions {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      flex-wrap: wrap;
    }

    .field-error {
      color: #dc2626;
      font-size: 0.85rem;
      font-weight: 500;
    }

    .field-hint {
      color: #64748b;
      font-size: 0.85rem;
    }

    button[type='submit'] {
      align-self: flex-start;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #fff;
      padding: 0.85rem 1.4rem;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 12px 24px rgba(79, 70, 229, 0.18);
    }

    button[type='submit']:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      box-shadow: none;
    }

    .success {
      color: #15803d;
      font-weight: 700;
    }

    .message-list {
      display: grid;
      gap: 0.9rem;
    }

    .message-card {
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr);
      gap: 0.9rem;
      align-items: start;
      padding: 1rem;
      border-radius: 18px;
      background: #f8fafc;
      border: 1px solid #e6edf5;
      width: 100%;
      text-align: left;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
    }

    .message-card:hover,
    .message-card:focus-visible {
      background: #f5f7ff;
      border-color: #c7d2fe;
      transform: translateY(-1px);
      outline: none;
    }

    .message-card-unread {
      border-color: #c7d2fe;
      background: #f5f7ff;
    }

    .message-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 16px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #fff;
      font-weight: 800;
      font-size: 1rem;
    }

    .message-body {
      display: grid;
      gap: 0.3rem;
      min-width: 0;
    }

    .message-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .message-sender,
    .message-subject {
      color: #14213d;
      font-weight: 700;
    }

    .message-time,
    .message-preview {
      color: #64748b;
      font-size: 0.92rem;
    }

    .message-thread-card {
      display: grid;
      gap: 1rem;
      padding: 1.25rem;
      border-radius: 20px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
    }

    .message-thread-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .message-thread-sender-block {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
    }

    .message-thread-heading {
      display: grid;
      gap: 0.16rem;
    }

    .message-thread-heading strong {
      color: #14213d;
      font-size: 1rem;
    }

    .message-thread-heading span {
      color: #64748b;
      font-size: 0.88rem;
      font-weight: 700;
    }

    .message-thread-subject {
      color: #14213d;
      font-size: 1.12rem;
      font-weight: 800;
    }

    .message-thread-body {
      margin: 0;
      color: #475569;
      font-size: 0.95rem;
      line-height: 1.75;
      white-space: pre-wrap;
    }

    .message-thread-conversation {
      display: grid;
      gap: 0.85rem;
      padding: 1rem;
      border-radius: 22px;
      background:
        radial-gradient(circle at top left, rgba(99, 102, 241, 0.08), transparent 34%),
        linear-gradient(180deg, #fbfdff 0%, #f5f9ff 100%);
      border: 1px solid #e2eaf4;
    }

    .message-thread-entry {
      display: grid;
      gap: 0.45rem;
      padding: 0.95rem 1rem;
      max-width: min(100%, 38rem);
      border-radius: 18px 18px 18px 8px;
      background: #ffffff;
      border: 1px solid #dfe7f2;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.05);
    }

    .message-thread-entry-incoming {
      justify-self: start;
    }

    .message-thread-entry-self {
      justify-self: end;
      border-radius: 18px 18px 8px 18px;
      background: linear-gradient(180deg, #eef6ff 0%, #e0efff 100%);
      border-color: rgba(59, 130, 246, 0.22);
    }

    .message-thread-entry-meta {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .message-thread-entry-meta strong {
      color: #14213d;
      font-size: 0.92rem;
    }

    .message-thread-entry-meta span {
      color: #64748b;
      font-size: 0.84rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .message-thread-entry-meta-detail {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
    }

    .message-thread-entry-status {
      padding: 0.18rem 0.45rem;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.12);
      color: #2563eb;
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.01em;
      text-transform: uppercase;
    }

    .message-thread-reply-form {
      display: grid;
      gap: 1rem;
      padding: 1.1rem;
      border: 1px solid #dbe4f0;
      border-radius: 24px;
      background: linear-gradient(180deg, #fbfdff 0%, #eef6ff 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
    }

    .message-thread-reply-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .message-thread-reply-title {
      color: #14213d;
      font-size: 1rem;
      font-weight: 800;
    }

    .message-thread-reply-copy {
      margin: 0.28rem 0 0;
      color: #64748b;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .message-thread-reply-form .message-field {
      gap: 0.6rem;
      color: #1e293b;
    }

    .message-thread-reply-form textarea {
      line-height: 1.65;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .message-thread-reply-actions {
      display: flex;
      justify-content: flex-end;
    }

    @media (max-width: 720px) {
      .messages-section {
        padding: 1rem;
        border-radius: 20px;
      }

      .section-heading-row,
      .message-row {
        flex-direction: column;
      }

      .message-thread-entry,
      .message-thread-entry-self,
      .message-thread-entry-incoming {
        max-width: 100%;
      }

      .message-thread-entry-meta {
        flex-direction: column;
        align-items: flex-start;
      }

      .message-thread-reply-actions {
        justify-content: stretch;
      }

      .message-thread-reply-actions button {
        width: 100%;
      }
    }
  `],
})
export class StudentMessagesComponent {
  readonly studentData = inject(StudentDataService);
  readonly initialSection = input<MessageSection>(null);

  readonly messageRecipients = computed(() =>
    this.studentData.loadedTrainingManagers().map((manager) => manager.name).sort((a, b) => a.localeCompare(b)),
  );
  private readonly knownManagerNames = computed(() => new Set(this.messageRecipients().map((n) => n.toLocaleLowerCase())));
  private readonly knownManagerValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value.trim().toLocaleLowerCase() : '';
    if (!value) return null;
    return this.knownManagerNames().has(value) ? null : { unknownRecipient: true };
  };

  readonly composeMessageForm = new FormGroup({
    recipient: new FormControl('', { nonNullable: true, validators: [Validators.required, trimmedRequiredValidator, this.knownManagerValidator] }),
    subject: new FormControl('', { nonNullable: true, validators: [Validators.required, trimmedRequiredValidator] }),
    message: new FormControl('', { nonNullable: true, validators: [Validators.required, trimmedRequiredValidator, trimmedMinLengthValidator(5)] }),
  });
  readonly replyMessageForm = new FormGroup({
    message: new FormControl('', { nonNullable: true, validators: [Validators.required, trimmedRequiredValidator, trimmedMinLengthValidator(2)] }),
  });

  private readonly selectedSectionSignal = signal<MessageSection>(null);
  readonly selectedSection = computed(() => this.selectedSectionSignal());
  private readonly selectedMessageIdSignal = signal<string | null>(null);
  readonly selectedMessage = computed(() => {
    const selectedId = this.selectedMessageIdSignal();
    if (!selectedId) {
      return null;
    }

    return this.studentData.messages().find((message) => message.id === selectedId) ?? null;
  });
  private readonly messageSubmittedSignal = signal(false);
  readonly messageSubmitted = computed(() => this.messageSubmittedSignal());

  constructor() {
    effect(
      () => {
        const nextSection = this.initialSection();
        this.selectedSectionSignal.set(nextSection);
        this.selectedMessageIdSignal.set(null);
      },
      { allowSignalWrites: true },
    );
  }

  selectSection(section: Exclude<MessageSection, null>) {
    this.selectedSectionSignal.set(section);
    this.selectedMessageIdSignal.set(null);
    this.messageSubmittedSignal.set(false);
  }

  clearSection() {
    this.selectedSectionSignal.set(null);
    this.selectedMessageIdSignal.set(null);
    this.messageSubmittedSignal.set(false);
  }

  openMessage(messageId: string) {
    this.studentData.markMessageRead(messageId);
    this.replyMessageForm.reset({ message: '' });
    this.selectedMessageIdSignal.set(messageId);
  }

  clearSelectedMessage() {
    this.replyMessageForm.reset({ message: '' });
    this.selectedMessageIdSignal.set(null);
  }

  replyToSelectedMessage() {
    const activeMessage = this.selectedMessage();
    if (!activeMessage || this.replyMessageForm.invalid) {
      this.replyMessageForm.markAllAsTouched();
      return;
    }

    this.studentData.replyToMessage(activeMessage.id, this.replyMessageForm.controls.message.value.trim());
    this.replyMessageForm.reset({ message: '' });
  }

  onComposeMessage() {
    if (!this.composeMessageForm.valid) {
      this.composeMessageForm.markAllAsTouched();
      this.messageSubmittedSignal.set(false);
      return;
    }

    const recipient = this.composeMessageForm.controls.recipient.value.trim();
    const subject = this.composeMessageForm.controls.subject.value.trim();
    const message = this.composeMessageForm.controls.message.value.trim();

    this.studentData.sendMessage(recipient, subject, message);

    this.composeMessageForm.reset({
      recipient: '',
      subject: '',
      message: '',
    });
    this.messageSubmittedSignal.set(true);
  }
}
