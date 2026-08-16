import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LmsBrandingService, LmsBrandThemeId } from './lms-branding.service';
import { StudentDataService } from './student-data.service';
import { FirebaseStorageService } from './firebase-storage.service';
import { LmsBackendService } from './lms-backend.service';

type ProfileSection = 'profile' | 'appearance' | null;

@Component({
  selector: 'student-profile-settings',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="profile-section"
      [style.--brand-primary]="selectedThemeOption().primary"
      [style.--brand-secondary]="selectedThemeOption().secondary"
      [style.--brand-tint]="selectedThemeOption().tint"
      [style.--brand-surface]="selectedThemeOption().surface">
      <div class="section-heading-row">
        <div>
          <h2>Profile & Settings</h2>
          <p class="section-copy">Choose a section first, then manage your profile details or workspace appearance in a focused view.</p>
        </div>
      </div>

      @if (!selectedSection()) {
        <div class="profile-section-list" aria-label="Profile and settings sections">
          <button type="button" class="profile-section-item" (click)="selectSection('profile')">
            <span class="profile-section-item-title">Profile</span>
            <span class="profile-section-item-copy">Update your photo, contact details, password, and personal information.</span>
          </button>
          <button type="button" class="profile-section-item" (click)="selectSection('appearance')">
            <span class="profile-section-item-title">Appearance</span>
            <span class="profile-section-item-copy">Choose the colour theme you want to use in your student workspace.</span>
          </button>
        </div>
      }

      @if (selectedSection()) {
        <div class="profile-section-detail">
          <button type="button" class="section-back-btn" (click)="clearSection()">Back to sections</button>
        </div>
      }

      @if (selectedSection() === 'profile') {
        <div class="profile-section-stack">
          <div class="profile-summary-grid">
            @for (item of studentData.profileHighlights(); track item.label) {
              <article class="profile-summary-card">
                <div class="profile-summary-label">{{ item.label }}</div>
                <div class="profile-summary-value">{{ item.value }}</div>
              </article>
            }
          </div>

          <section class="profile-media-card" aria-label="Student profile picture">
            <div class="profile-avatar" [class.profile-avatar-has-image]="!!profileImageSrc()">
              @if (profileImageSrc()) {
                <img [src]="profileImageSrc()!" alt="Student profile picture preview" />
              } @else {
                <span>{{ profileInitials() }}</span>
              }
            </div>

            <div class="profile-media-copy">
              <div class="profile-media-title">Profile picture</div>
              <div class="profile-media-text">Upload a clear headshot so tutors and classmates can recognize you.</div>
              @if (imageUploading()) {
                <div class="profile-upload-progress" role="status" aria-live="polite">
                  <div class="profile-upload-progress-bar" [style.width.%]="imageUploadPercent()"></div>
                  <span>Uploading… {{ imageUploadPercent() }}%</span>
                </div>
              }
              @if (imageUploadError()) {
                <div class="error" role="alert">{{ imageUploadError() }}</div>
              }
            </div>

            <label class="upload-photo-btn" [class.upload-photo-btn--disabled]="imageUploading()">
              <input type="file" accept="image/*" [disabled]="imageUploading()" (change)="onProfileImageSelected($event)" />
              {{ imageUploading() ? 'Uploading…' : 'Upload photo' }}
            </label>
          </section>

          <form [formGroup]="profileForm" (ngSubmit)="onSubmit()" aria-label="Student Profile Form">
            <div class="profile-form-grid">
              <label>
                ID Number
                <input formControlName="idNumber" type="text" />
              </label>
              <label>
                Name
                <input formControlName="name" required aria-required="true" />
              </label>
              <label>
                Email
                <input formControlName="email" type="email" required aria-required="true" />
              </label>
              <label>
                Contact number
                <input formControlName="contactNumber" type="tel" required aria-required="true" />
              </label>
              <label>
                Age
                <input formControlName="age" type="number" min="1" required aria-required="true" />
              </label>
              <label class="profile-form-span-2">
                Address
                <textarea formControlName="address" rows="3" required aria-required="true"></textarea>
              </label>
              <label class="profile-form-span-2">
                New password
                <input formControlName="newPassword" type="password" placeholder="Enter a new password" />
              </label>
            </div>
            <button type="submit" [disabled]="!profileForm.valid || saving()">{{ saving() ? 'Saving...' : 'Save Profile' }}</button>
            @if (submitted()) {
              <div class="success">Profile saved!</div>
            }
            @if (errorMessage()) {
              <div class="error">{{ errorMessage() }}</div>
            }
          </form>
        </div>
      }

      @if (selectedSection() === 'appearance') {
        <div class="utility-grid">
          <form class="utility-card" [formGroup]="appearanceSettingsForm" (ngSubmit)="onAppearanceSettingsSubmit()">
            <div class="utility-card-title">Colour Theme</div>
            <p class="utility-card-copy">Pick the student workspace theme that fits how you want the LMS to look.</p>

            <label class="settings-select-field">
              <span>Theme</span>
              <select formControlName="themePreference">
                @for (theme of branding.themeOptions; track theme.id) {
                  <option [value]="theme.id">{{ theme.label }}</option>
                }
              </select>
            </label>

            <div class="theme-selection-summary" aria-live="polite">
              <div class="theme-swatches" aria-hidden="true">
                <span [style.background]="selectedThemeOption().primary"></span>
                <span [style.background]="selectedThemeOption().secondary"></span>
                <span [style.background]="selectedThemeOption().tint"></span>
              </div>
              <div class="theme-selection-copy">{{ selectedThemeOption().copy }}</div>
            </div>

            <div class="utility-actions">
              <button type="submit" [disabled]="saving()">{{ saving() ? 'Saving...' : 'Save Theme' }}</button>
              @if (submitted() && successMessage()) {
                <div class="success">{{ successMessage() }}</div>
              }
              @if (errorMessage()) {
                <div class="error">{{ errorMessage() }}</div>
              }
            </div>
          </form>
        </div>
      }
    </section>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 100%;
    }

    .profile-section {
      width: 100%;
      min-height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.6rem;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), var(--brand-surface));
      border: 1px solid var(--brand-tint);
      border-radius: 24px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
    }

    .section-heading-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    h2 {
      margin: 0;
      color: var(--brand-primary);
      font-size: 1.5rem;
      font-weight: 700;
    }

    .section-copy {
      margin: 0.3rem 0 0;
      color: #64748b;
      font-size: 0.96rem;
    }

    .profile-section-list,
    .profile-section-stack {
      display: grid;
      gap: 1rem;
    }

    .profile-section-item {
      display: grid;
      gap: 0.35rem;
      width: 100%;
      padding: 1rem 1.1rem;
      border: 1px solid var(--brand-tint);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), var(--brand-surface));
      text-align: left;
      cursor: pointer;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.04);
      transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
    }

    .profile-section-item:hover,
    .profile-section-item:focus-visible {
      background: linear-gradient(180deg, var(--brand-surface), var(--brand-tint));
      border-color: var(--brand-primary);
      box-shadow: 0 16px 28px rgba(15, 23, 42, 0.08);
      transform: translateX(2px);
      outline: none;
    }

    .profile-section-item-title {
      color: var(--brand-primary);
      font-size: 1rem;
      font-weight: 700;
    }

    .profile-section-item-copy {
      color: #64748b;
      font-size: 0.92rem;
      line-height: 1.5;
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
      border: 1px solid var(--brand-tint);
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), var(--brand-surface));
      color: var(--brand-primary);
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.05);
    }

    .profile-summary-grid,
    .utility-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
    }

    .profile-summary-card,
    .utility-card {
      padding: 1rem;
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.97), var(--brand-surface));
      border: 1px solid var(--brand-tint);
      display: grid;
      gap: 0.35rem;
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.04);
    }

    .profile-summary-label {
      color: var(--brand-primary);
      font-size: 0.88rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .profile-summary-value,
    .utility-card-title {
      color: #14213d;
      font-size: 1.05rem;
      font-weight: 700;
    }

    .utility-card-copy {
      margin: 0;
      color: #64748b;
      font-size: 0.92rem;
      line-height: 1.5;
    }

    .utility-pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .utility-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.4rem 0.7rem;
      border-radius: 999px;
      background: #e2e8f0;
      color: #475569;
      font-size: 0.8rem;
      font-weight: 700;
    }

    .utility-pill-active {
      background: #e0e7ff;
      color: #4338ca;
    }

    .utility-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.9rem 0;
      border-top: 1px solid #e6edf5;
    }

    .utility-toggle strong {
      color: #14213d;
      font-size: 0.96rem;
    }

    .utility-toggle span {
      color: #64748b;
      font-size: 0.88rem;
      line-height: 1.5;
    }

    .utility-toggle input {
      width: 1.15rem;
      height: 1.15rem;
      flex: 0 0 auto;
    }

    .utility-actions {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      flex-wrap: wrap;
      padding-top: 0.4rem;
    }

    .settings-select-field {
      display: grid;
      gap: 0.45rem;
      color: #0f172a;
      font-size: 0.95rem;
      font-weight: 600;
    }

    .settings-select-field select {
      width: 100%;
      border-radius: 16px;
      border: 1px solid var(--brand-tint);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), var(--brand-surface));
      padding: 0.85rem 1rem;
      font: inherit;
      color: #0f172a;
    }

    .settings-select-field select:focus {
      outline: none;
      border-color: var(--brand-primary);
      box-shadow: 0 0 0 4px var(--brand-tint);
    }

    .theme-selection-summary {
      display: grid;
      gap: 0.65rem;
      padding: 1rem 1.1rem;
      border-radius: 18px;
      background: linear-gradient(135deg, var(--brand-tint), rgba(255, 255, 255, 0.98));
      border: 1px solid var(--brand-tint);
    }

    .theme-swatches {
      display: flex;
      align-items: center;
      gap: 0.55rem;
    }

    .theme-swatches span {
      width: 1.4rem;
      height: 1.4rem;
      border-radius: 999px;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.65);
    }

    .theme-selection-copy {
      color: #475569;
      font-size: 0.92rem;
      line-height: 1.5;
    }

    .profile-media-card {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.1rem;
      border-radius: 20px;
      background: linear-gradient(135deg, var(--brand-tint), var(--brand-surface));
      border: 1px solid var(--brand-tint);
      box-shadow: 0 16px 30px rgba(15, 23, 42, 0.05);
    }

    .profile-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 92px;
      height: 92px;
      border-radius: 28px;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      color: #fff;
      font-size: 1.6rem;
      font-weight: 800;
      overflow: hidden;
      box-shadow: 0 16px 32px rgba(79, 70, 229, 0.18);
    }

    .profile-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .profile-avatar-has-image {
      background: #fff;
      border: 1px solid var(--brand-tint);
    }

    .profile-media-copy {
      display: grid;
      gap: 0.35rem;
    }

    .profile-media-title {
      color: #14213d;
      font-size: 1rem;
      font-weight: 700;
    }

    .profile-media-text {
      color: #64748b;
      font-size: 0.94rem;
      max-width: 38rem;
    }

    .upload-photo-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.85rem 1.2rem;
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), var(--brand-surface));
      border: 1px solid var(--brand-tint);
      color: var(--brand-primary);
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      box-shadow: 0 10px 22px rgba(15, 23, 42, 0.05);
    }

    .upload-photo-btn--disabled {
      opacity: 0.55;
      cursor: not-allowed;
      pointer-events: none;
    }

    .upload-photo-btn input {
      display: none;
    }

    .profile-upload-progress {
      display: grid;
      gap: 0.25rem;
      font-size: 0.82rem;
      color: var(--brand-primary);
    }

    .profile-upload-progress-bar {
      height: 4px;
      border-radius: 99px;
      background: var(--brand-primary);
      transition: width 0.2s ease;
      max-width: 100%;
    }

    .profile-form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .profile-form-span-2 {
      grid-column: 1 / -1;
    }

    form {
      width: 100%;
      min-height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    form label {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      color: #1f2937;
      font-weight: 600;
      font-size: 0.95rem;
    }

    form input,
    form textarea {
      border: 1px solid var(--brand-tint);
      border-radius: 12px;
      padding: 0.9rem 1rem;
      font-size: 1rem;
      color: #14213d;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), var(--brand-surface));
      outline: none;
      font-family: inherit;
    }

    form textarea {
      resize: vertical;
      min-height: 6.5rem;
    }

    form input:focus,
    form textarea:focus {
      border-color: var(--brand-primary);
      box-shadow: 0 0 0 4px var(--brand-tint);
    }

    form button[type='submit'] {
      align-self: flex-start;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      color: #fff;
      padding: 0.85rem 1.4rem;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
    }

    form button[type='submit']:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      box-shadow: none;
    }

    .success {
      color: #15803d;
      font-weight: 700;
    }

    .error {
      color: #b91c1c;
      font-weight: 700;
    }

    @media (max-width: 720px) {
      .profile-section,
      form {
        padding: 1rem;
        border-radius: 20px;
      }

      .section-heading-row {
        flex-direction: column;
      }

      .profile-media-card,
      .profile-form-grid {
        grid-template-columns: 1fr;
      }

      .upload-photo-btn {
        width: 100%;
      }
    }
  `],
})
export class StudentProfileSettingsComponent {
  readonly studentData = inject(StudentDataService);
  readonly branding = inject(LmsBrandingService);
  private readonly storageService = inject(FirebaseStorageService);
  private readonly backend = inject(LmsBackendService);
  readonly profileForm = new FormGroup({
    idNumber: new FormControl(this.studentData.profile().idNumber, { nonNullable: true }),
    name: new FormControl(this.studentData.profile().name, { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl(this.studentData.profile().email, { nonNullable: true, validators: [Validators.required, Validators.email] }),
    contactNumber: new FormControl(this.studentData.profile().contactNumber, { nonNullable: true, validators: [Validators.required] }),
    age: new FormControl(this.studentData.profile().age, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    address: new FormControl(this.studentData.profile().address, { nonNullable: true, validators: [Validators.required] }),
    newPassword: new FormControl('', { nonNullable: true, validators: [Validators.minLength(8)] }),
  });
  readonly appearanceSettingsForm = new FormGroup({
    themePreference: new FormControl<LmsBrandThemeId>(this.studentData.settings().themePreference, { nonNullable: true }),
  });

  private readonly selectedSectionSignal = signal<ProfileSection>(null);
  readonly selectedSection = computed(() => this.selectedSectionSignal());
  private readonly submittedSignal = signal(false);
  readonly submitted = computed(() => this.submittedSignal());
  private readonly savingSignal = signal(false);
  readonly saving = computed(() => this.savingSignal());
  private readonly successMessageSignal = signal<string | null>(null);
  readonly successMessage = computed(() => this.successMessageSignal());
  private readonly errorMessageSignal = signal<string | null>(null);
  readonly errorMessage = computed(() => this.errorMessageSignal());
  private readonly imageUploadingSignal = signal(false);
  readonly imageUploading = computed(() => this.imageUploadingSignal());
  private readonly imageUploadPercentSignal = signal(0);
  readonly imageUploadPercent = computed(() => this.imageUploadPercentSignal());
  private readonly imageUploadErrorSignal = signal<string | null>(null);
  readonly imageUploadError = computed(() => this.imageUploadErrorSignal());
  /** Resolved display source: Firebase Storage URL takes priority over legacy base64 data URL. */
  readonly profileImageSrc = computed(() => {
    const profile = this.studentData.profile();
    return profile.profileImageUrl || profile.profileImageDataUrl || null;
  });
  readonly selectedThemeOption = computed(
    () => this.branding.themeOptions.find((theme) => theme.id === this.appearanceSettingsForm.controls.themePreference.value) ?? this.branding.themeOptions[0],
  );
  readonly profileInitials = computed(() => {
    const parts = this.studentData.profile().name.trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'S';
  });

  constructor() {
    effect(() => {
      const profile = this.studentData.profile();
      const settings = this.studentData.settings();

      if (!this.profileForm.dirty || this.selectedSection() !== 'profile') {
        this.profileForm.patchValue({
          idNumber: profile.idNumber,
          name: profile.name,
          email: profile.email,
          contactNumber: profile.contactNumber,
          age: profile.age,
          address: profile.address,
        }, { emitEvent: false });
      }

      if (!this.appearanceSettingsForm.dirty || this.selectedSection() !== 'appearance') {
        this.appearanceSettingsForm.patchValue({ themePreference: settings.themePreference }, { emitEvent: false });
      }
    });
  }

  selectSection(section: Exclude<ProfileSection, null>) {
    this.selectedSectionSignal.set(section);
    this.submittedSignal.set(false);
    this.successMessageSignal.set(null);
    this.errorMessageSignal.set(null);
  }

  clearSection() {
    this.selectedSectionSignal.set(null);
    this.submittedSignal.set(false);
    this.successMessageSignal.set(null);
    this.errorMessageSignal.set(null);
  }

  onProfileImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.imageUploadErrorSignal.set('Please select an image file (JPEG, PNG, WebP, etc.).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.imageUploadErrorSignal.set('Image must be smaller than 5 MB.');
      return;
    }

    this.imageUploadingSignal.set(true);
    this.imageUploadPercentSignal.set(0);
    this.imageUploadErrorSignal.set(null);

    this.storageService.uploadWithProgress(file, 'profile-pictures').subscribe({
      next: (uploadEvent) => {
        if (uploadEvent.type === 'progress') {
          this.imageUploadPercentSignal.set(uploadEvent.percent);
          return;
        }

        // Upload complete — store the Firebase Storage URL.
        const profileImageUrl = uploadEvent.url;
        this.imageUploadingSignal.set(false);
        this.imageUploadPercentSignal.set(100);
        void this.studentData.updateProfile({
          idNumber: this.profileForm.controls.idNumber.value,
          name: this.profileForm.controls.name.value,
          email: this.profileForm.controls.email.value,
          contactNumber: this.profileForm.controls.contactNumber.value,
          age: Number(this.profileForm.controls.age.value),
          address: this.profileForm.controls.address.value,
          profileImageUrl,
          // Clear any legacy base64 data URL so the Storage URL is used exclusively.
          profileImageDataUrl: null,
        });
      },
      error: () => {
        // The direct-to-storage upload depends on the storage bucket's CORS policy already being
        // set up, which isn't guaranteed at any given moment — fall back to the base64-JSON route,
        // which still produces a durable Storage URL (not a fragile locally-held blob that a later
        // save could silently wipe).
        this.backend.uploadFileBase64(file, 'profile-pictures').subscribe({
          next: ({ url }) => {
            this.imageUploadingSignal.set(false);
            this.imageUploadPercentSignal.set(100);
            void this.studentData.updateProfile({
              idNumber: this.profileForm.controls.idNumber.value,
              name: this.profileForm.controls.name.value,
              email: this.profileForm.controls.email.value,
              contactNumber: this.profileForm.controls.contactNumber.value,
              age: Number(this.profileForm.controls.age.value),
              address: this.profileForm.controls.address.value,
              profileImageUrl: url,
              profileImageDataUrl: null,
            });
          },
          error: () => {
            this.imageUploadingSignal.set(false);
            this.imageUploadPercentSignal.set(0);
            this.imageUploadErrorSignal.set('The picture could not be uploaded right now. Please try again.');
          },
        });
      },
    });
  }

  async onSubmit() {
    if (!this.profileForm.valid || this.saving()) {
      return;
    }

    this.savingSignal.set(true);
    this.successMessageSignal.set(null);
    this.errorMessageSignal.set(null);
    const newPassword = this.profileForm.controls.newPassword.value;
    const result = await this.studentData.updateProfile({
      idNumber: this.profileForm.controls.idNumber.value,
      name: this.profileForm.controls.name.value,
      email: this.profileForm.controls.email.value,
      contactNumber: this.profileForm.controls.contactNumber.value,
      age: Number(this.profileForm.controls.age.value),
      address: this.profileForm.controls.address.value,
      newPassword: newPassword.trim() || undefined,
    });
    this.savingSignal.set(false);
    this.profileForm.controls.newPassword.reset('');
    this.submittedSignal.set(result.success);
    this.successMessageSignal.set(result.success ? 'Profile saved!' : null);
    this.errorMessageSignal.set(result.errorMessage ?? null);
  }

  async onAppearanceSettingsSubmit() {
    if (this.saving()) {
      return;
    }

    this.savingSignal.set(true);
    this.submittedSignal.set(false);
    this.successMessageSignal.set(null);
    this.errorMessageSignal.set(null);

    const result = await this.studentData.updateThemePreference(this.appearanceSettingsForm.controls.themePreference.value);
    this.savingSignal.set(false);
    this.appearanceSettingsForm.markAsPristine();
    this.submittedSignal.set(result.success);
    this.successMessageSignal.set(result.success ? 'Theme saved!' : null);
    this.errorMessageSignal.set(result.errorMessage ?? null);
  }
}
