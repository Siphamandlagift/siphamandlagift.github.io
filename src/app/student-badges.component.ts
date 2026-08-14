import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { StudentBadge, StudentCertificateLicence, StudentCertificateStatus, StudentDataService } from './student-data.service';

type ConfettiPiece = {
  id: number;
  left: string;
  delay: string;
  duration: string;
  rotation: string;
  color: string;
};

type FireworkBurst = {
  id: number;
  left: string;
  top: string;
  delay: string;
  color: string;
};

type BadgeWorkspaceSection = 'badges' | 'certificates' | null;

type StudentCertificate = {
  id: string;
  title: string;
  issuedOn: string;
  category: string;
  color: string;
};

@Component({
  selector: 'student-badges',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="badges-section">
      <div class="section-heading-row">
        <div>
          <h2>Badges & Certificates</h2>
          <p class="section-copy">Open a section folder to browse your badges or view issued certificates.</p>
        </div>
      </div>

      @if (!selectedSection()) {
        <div class="badge-section-list" aria-label="Badges and certificates sections">
          <button type="button" class="badge-section-item" (click)="selectSection('badges')">
            <span class="badge-section-item-title">Badges</span>
            <span class="badge-section-item-copy">Track earned badges and explore what to unlock next.</span>
            <span class="section-badge">{{ studentData.earnedBadgesCount() }} earned</span>
          </button>

          <button type="button" class="badge-section-item" (click)="selectSection('certificates')">
            <span class="badge-section-item-title">Certificates and Licences</span>
            <span class="badge-section-item-copy">Create, update, and save your professional certifications and licences.</span>
            <span class="section-badge section-badge-cert">{{ certificates().length }} issued</span>
          </button>
        </div>
      }

      @if (selectedSection()) {
        <div class="badge-section-detail">
          <button type="button" class="section-back-btn" (click)="clearSection()">Back to folders</button>
        </div>
      }

      @if (selectedSection() === 'badges') {
        <div class="section-heading-row section-heading-row-inner">
          <h3>Badges</h3>
          <span class="section-badge">{{ studentData.earnedBadgesCount() }} earned</span>
        </div>

        <div class="badges-grid">
          @for (badge of studentData.badges(); track badge.id) {
            <button
              type="button"
              class="badge-card"
              [class.badge-card-locked]="!badge.earned"
              [class.badge-card-selected]="selectedBadge()?.id === badge.id"
              (click)="openBadge(badge)">
              <div class="badge-mark" [style.background]="badge.color">
                @if (badge.icon === 'star') {
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 16.52l-5.3 2.79 1.01-5.9L3.42 9.23l5.93-.86L12 3Z" fill="currentColor"/></svg>
                }
                @if (badge.icon === 'bolt') {
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 2 6 13h4l-1 9 7-11h-4l1-9Z" fill="currentColor"/></svg>
                }
                @if (badge.icon === 'book') {
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15.5A2.5 2.5 0 0 0 16.5 16H5V5.5Z" fill="currentColor"/><path d="M5 16v1a2 2 0 0 0 2 2h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                }
                @if (badge.icon === 'flask') {
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 3h4M10 3v4.5l-4.8 7.7A3 3 0 0 0 7.76 20h8.48a3 3 0 0 0 2.56-4.8L14 7.5V3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 14h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                }
              </div>
              <span class="badge-title badge-title-card">{{ badge.title }}</span>
            </button>
          }
        </div>
      }

      @if (selectedSection() === 'certificates') {
        <div class="section-heading-row section-heading-row-inner">
          <h3>Certificates and Licences</h3>
          <span class="section-badge section-badge-cert">{{ certificates().length }} issued</span>
        </div>

        <form class="certificate-form" [formGroup]="certificateForm" (ngSubmit)="saveCertificate()" aria-label="Certificates and licences form">
          <label>
            Certification/Licence Name
            <input formControlName="certificationName" type="text" required aria-required="true" />
          </label>

          <label>
            Completion Date
            <input formControlName="completionDate" type="date" required aria-required="true" />
          </label>

          <label>
            Expiry Date
            <input formControlName="expiryDate" type="date" required aria-required="true" (change)="refreshCalculatedStatus()" />
          </label>

          <label>
            Status
            <select formControlName="status" [disabled]="true">
              <option value="Active">Active</option>
              <option value="Expired">Expired</option>
              <option value="Pending Renewal">Pending Renewal</option>
            </select>
            <span class="certificate-file-name">Auto-calculated from expiry date and reminder settings.</span>
          </label>

          <label>
            Renewal Required
            <select formControlName="renewalRequired" (change)="refreshCalculatedStatus()">
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </label>

          <label>
            Reminder Notification
            <select formControlName="reminderNotification" (change)="refreshCalculatedStatus()">
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </label>

          <label>
            Number of days before expiry to send alerts
            <input
              formControlName="reminderDaysBeforeExpiry"
              type="number"
              min="1"
              [disabled]="certificateForm.controls.reminderNotification.value === 'No'"
              (change)="refreshCalculatedStatus()" />
          </label>

          <div class="certificate-form-span-2 certificate-upload-field">
            <span class="certificate-upload-label">File</span>
            <label class="certificate-upload-dropzone" [class.certificate-upload-dropzone-has-file]="!!selectedFileName()">
              <input class="certificate-upload-input" type="file" (change)="onCertificateFileSelected($event)" />
              <span class="certificate-upload-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 16V6m0 0-4 4m4-4 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 17.5A2.5 2.5 0 0 0 6.5 20h11A2.5 2.5 0 0 0 20 17.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              </span>
              <span class="certificate-upload-title">{{ selectedFileName() ? 'File selected' : 'Upload certificate/licence file' }}</span>
              <span class="certificate-upload-copy">
                {{ selectedFileName() ? selectedFileName() : 'Click to browse and attach a document.' }}
              </span>
              <span class="certificate-upload-hint">PDF, image, or document files are supported.</span>
            </label>
            @if (selectedFileName()) {
              <div class="certificate-upload-actions">
                <span class="certificate-file-name">Selected file: {{ selectedFileName() }}</span>
                <button type="button" class="secondary-btn" (click)="clearSelectedCertificateFile()">Remove file</button>
              </div>
            }
          </div>

          <div class="certificate-form-actions certificate-form-span-2">
            <button type="submit">{{ editingCertificateId() ? 'Update record' : 'Save record' }}</button>
            @if (editingCertificateId()) {
              <button type="button" class="secondary-btn" (click)="cancelCertificateEdit()">Cancel edit</button>
            }
            @if (certificateSaveMessage()) {
              <span class="success">{{ certificateSaveMessage() }}</span>
            }
            @if (certificateErrorMessage()) {
              <span class="error">{{ certificateErrorMessage() }}</span>
            }
          </div>
        </form>

        @if (certificates().length) {
          <div class="certificates-grid">
            @for (certificate of certificates(); track certificate.id) {
              <article class="certificate-card">
                <div class="certificate-mark" [style.background]="certificate.status === 'Active' ? '#16a34a' : (certificate.status === 'Expired' ? '#dc2626' : '#ca8a04')"></div>
                <div class="certificate-body">
                  <div class="certificate-title">{{ certificate.certificationName }}</div>
                  <div class="certificate-meta">Completion Date: {{ certificate.completionDate }}</div>
                  <div class="certificate-meta">Expiry Date: {{ certificate.expiryDate }}</div>
                  <div class="certificate-meta">Status: {{ certificate.status }}</div>
                  <div class="certificate-meta">Renewal Required: {{ certificate.renewalRequired }}</div>
                  <div class="certificate-meta">Reminder Notification: {{ certificate.reminderNotification }}</div>
                  <div class="certificate-meta">Days Before Expiry Alert: {{ certificate.reminderNotification === 'Yes' ? certificate.reminderDaysBeforeExpiry : 'Not set' }}</div>
                  <div class="certificate-meta">File: {{ certificate.fileName || 'No file uploaded' }}</div>
                  <div class="certificate-actions">
                    <button type="button" class="secondary-btn" (click)="startCertificateEdit(certificate)">Edit</button>
                    @if (certificate.fileDataUrl) {
                      <a class="secondary-btn secondary-btn-link" [href]="certificate.fileDataUrl" [download]="certificate.fileName || 'certificate-file'">Download file</a>
                    }
                  </div>
                </div>
              </article>
            }
          </div>
        } @else {
          <article class="certificate-empty-card">
            <div class="certificate-empty-title">No certificates yet</div>
            <p>Earn badges first to generate certificate records in this folder.</p>
          </article>
        }
      }
    </section>

    @if (selectedBadge()) {
      <div class="badge-modal" aria-label="Selected badge details" role="dialog" aria-modal="true">
        <button type="button" class="badge-modal-backdrop" aria-label="Close badge details" (click)="closeBadge()"></button>

        <section class="badge-detail-card">
          <div class="badge-fireworks-layer" aria-hidden="true">
            @for (burst of fireworkBursts; track burst.id) {
              <span
                class="badge-firework-burst"
                [style.left]="burst.left"
                [style.top]="burst.top"
                [style.animation-delay]="burst.delay"
                [style.--firework-color]="burst.color">
                <span class="badge-firework-core"></span>
                @for (angle of fireworkRayAngles; track angle) {
                  <span class="badge-firework-ray" [style.--ray-angle]="angle"></span>
                }
              </span>
            }
          </div>

          <div class="badge-confetti-layer" aria-hidden="true">
            @for (piece of confettiPieces; track piece.id) {
              <span
                class="badge-confetti-piece"
                [style.left]="piece.left"
                [style.animation-delay]="piece.delay"
                [style.animation-duration]="piece.duration"
                [style.transform]="'rotate(' + piece.rotation + ')'"
                [style.background]="piece.color"></span>
            }
          </div>

          <div class="badge-detail-header">
            <div class="badge-mark badge-mark-large" [style.background]="selectedBadge()!.color">
              @if (selectedBadge()!.icon === 'star') {
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 16.52l-5.3 2.79 1.01-5.9L3.42 9.23l5.93-.86L12 3Z" fill="currentColor"/></svg>
              }
              @if (selectedBadge()!.icon === 'bolt') {
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 2 6 13h4l-1 9 7-11h-4l1-9Z" fill="currentColor"/></svg>
              }
              @if (selectedBadge()!.icon === 'book') {
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15.5A2.5 2.5 0 0 0 16.5 16H5V5.5Z" fill="currentColor"/><path d="M5 16v1a2 2 0 0 0 2 2h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              }
              @if (selectedBadge()!.icon === 'flask') {
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 3h4M10 3v4.5l-4.8 7.7A3 3 0 0 0 7.76 20h8.48a3 3 0 0 0 2.56-4.8L14 7.5V3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 14h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              }
            </div>

            <div class="badge-detail-copy">
              <div class="badge-title badge-title-large">{{ selectedBadge()!.title }}</div>
              <div class="badge-category badge-category-large">{{ selectedBadge()!.category }}</div>
              <p class="badge-copy badge-copy-large">{{ selectedBadge()!.description }}</p>
              <div class="badge-earned-on badge-earned-on-large">{{ selectedBadge()!.earned ? ('Earned ' + selectedBadge()!.earnedOn) : selectedBadge()!.earnedOn }}</div>
            </div>

            <button type="button" class="badge-close-btn" (click)="closeBadge()">Close</button>
          </div>
        </section>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 100%;
    }

    .badges-section {
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

    .section-heading-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
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

    .section-badge-cert {
      background: #ecfeff;
      color: #0f766e;
    }

    .badge-section-list {
      display: grid;
      gap: 1rem;
    }

    .badge-section-item {
      display: grid;
      gap: 0.45rem;
      width: 100%;
      padding: 1rem 1.1rem;
      border: 1px solid #dbe7f5;
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), #f8fbff);
      text-align: left;
      cursor: pointer;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.04);
      transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
      justify-items: start;
    }

    .badge-section-item:hover,
    .badge-section-item:focus-visible {
      background: linear-gradient(180deg, #f8fbff, #eef2ff);
      border-color: #a5b4fc;
      box-shadow: 0 16px 28px rgba(15, 23, 42, 0.08);
      transform: translateX(2px);
      outline: none;
    }

    .badge-section-item-title {
      color: #14213d;
      font-size: 1rem;
      font-weight: 700;
    }

    .badge-section-item-copy {
      color: #64748b;
      font-size: 0.92rem;
      line-height: 1.5;
    }

    .badge-section-detail {
      display: flex;
      justify-content: flex-start;
    }

    .section-back-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.55rem 0.9rem;
      border: 1px solid #dbe7f5;
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), #f8fbff);
      color: #14213d;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.05);
    }

    .section-heading-row-inner {
      align-items: center;
    }

    h3 {
      margin: 0;
      color: #14213d;
      font-size: 1.08rem;
      font-weight: 700;
    }

    .badges-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
    }

    .badge-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.8rem;
      width: 100%;
      min-height: 9.75rem;
      padding: 1.1rem 0.9rem;
      border-radius: 20px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      border: 1px solid #dbe7f5;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
      text-align: center;
      cursor: pointer;
      transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s ease, border-color 0.22s ease;
    }

    .badge-card:hover,
    .badge-card:focus-visible {
      transform: translateY(-6px) scale(1.012);
      border-color: #a5b4fc;
      box-shadow: 0 16px 36px rgba(99,102,241,0.16), 0 4px 14px rgba(15,23,42,0.08);
      outline: none;
    }

    .badge-card:hover .badge-mark,
    .badge-card:focus-visible .badge-mark {
      transform: scale(1.18) rotate(-4deg);
    }

    .badge-card-locked {
      opacity: 0.78;
    }

    .badge-card-selected {
      border-color: #6366f1;
      box-shadow: 0 18px 34px rgba(99, 102, 241, 0.14);
    }

    .badge-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 3.2rem;
      height: 3.2rem;
      border-radius: 18px;
      color: #fff;
      font-size: 0.95rem;
      font-weight: 800;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
      transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.28s ease;
    }

    .badge-title-card {
      display: -webkit-box;
      overflow: hidden;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      max-width: 100%;
      color: #14213d;
      font-size: 0.95rem;
      font-weight: 800;
      line-height: 1.35;
      text-wrap: balance;
    }

    .badge-mark-large {
      width: 5.25rem;
      height: 5.25rem;
      border-radius: 26px;
    }

    .badge-card-body {
      display: grid;
      gap: 0.45rem;
      min-width: 0;
    }

    .badge-card-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .badge-title {
      color: #14213d;
      font-size: 1rem;
      font-weight: 800;
    }

    .badge-category,
    .badge-earned-on,
    .badge-copy {
      color: #64748b;
      font-size: 0.88rem;
    }

    .badge-copy {
      margin: 0;
      line-height: 1.5;
    }

    .badge-state {
      display: inline-flex;
      align-items: center;
      padding: 0.35rem 0.65rem;
      border-radius: 999px;
      background: #dcfce7;
      color: #15803d;
      font-size: 0.78rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .badge-state-locked {
      background: #e2e8f0;
      color: #475569;
    }

    .badge-modal {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      z-index: 40;
    }

    .certificates-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 1rem;
    }

    .certificate-card {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.85rem;
      align-items: start;
      border: 1px solid #dbe7f5;
      border-radius: 18px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      padding: 1rem;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.05);
    }

    .certificate-mark {
      width: 0.55rem;
      min-height: 100%;
      border-radius: 999px;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.65) inset;
    }

    .certificate-body {
      display: grid;
      gap: 0.3rem;
    }

    .certificate-form {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.9rem;
      border: 1px solid #dbe7f5;
      border-radius: 18px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      padding: 1rem;
      box-sizing: border-box;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.05);
    }

    .certificate-form label {
      display: grid;
      gap: 0.4rem;
      color: #1f2937;
      font-size: 0.92rem;
      font-weight: 600;
    }

    .certificate-form input,
    .certificate-form select {
      border: 1px solid #dbe7f5;
      border-radius: 12px;
      padding: 0.75rem 0.9rem;
      background: #fff;
      color: #14213d;
      font: inherit;
    }

    .certificate-form input:focus,
    .certificate-form select:focus {
      outline: none;
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    }

    .certificate-form-span-2 {
      grid-column: 1 / -1;
    }

    .certificate-upload-field {
      display: grid;
      gap: 0.5rem;
    }

    .certificate-upload-label {
      color: #1f2937;
      font-size: 0.92rem;
      font-weight: 600;
    }

    .certificate-upload-dropzone {
      display: grid;
      justify-items: center;
      text-align: center;
      gap: 0.35rem;
      padding: 1rem;
      border: 1px dashed #a5b4fc;
      border-radius: 14px;
      background: linear-gradient(180deg, #f8fbff 0%, #eef2ff 100%);
      color: #4338ca;
      cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
    }

    .certificate-upload-dropzone:hover,
    .certificate-upload-dropzone:focus-within {
      border-color: #6366f1;
      box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.14);
      transform: translateY(-1px);
    }

    .certificate-upload-dropzone-has-file {
      border-style: solid;
      border-color: #16a34a;
      background: linear-gradient(180deg, #f0fdf4 0%, #ecfdf3 100%);
      color: #166534;
    }

    .certificate-upload-input {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }

    .certificate-upload-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.2rem;
      height: 2.2rem;
      border-radius: 999px;
      background: rgba(99, 102, 241, 0.14);
    }

    .certificate-upload-dropzone-has-file .certificate-upload-icon {
      background: rgba(22, 163, 74, 0.16);
    }

    .certificate-upload-title {
      color: #14213d;
      font-size: 0.95rem;
      font-weight: 700;
    }

    .certificate-upload-copy {
      color: #64748b;
      font-size: 0.84rem;
      font-weight: 500;
      line-height: 1.4;
      word-break: break-word;
      max-width: 100%;
    }

    .certificate-upload-hint {
      color: #64748b;
      font-size: 0.78rem;
      font-weight: 500;
    }

    .certificate-upload-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .certificate-form-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.6rem;
    }

    .certificate-form-actions button,
    .secondary-btn {
      border: 1px solid #c7d2fe;
      border-radius: 999px;
      background: #eef2ff;
      color: #4338ca;
      padding: 0.5rem 0.85rem;
      font-size: 0.84rem;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .certificate-form-actions > button[type='submit'] {
      background: linear-gradient(135deg, #4f46e5, #4338ca);
      color: #fff;
      border-color: transparent;
    }

    .secondary-btn-link {
      white-space: nowrap;
    }

    .certificate-file-name {
      color: #64748b;
      font-size: 0.84rem;
      font-weight: 500;
    }

    .certificate-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 0.35rem;
    }

    .certificate-title {
      color: #14213d;
      font-size: 0.98rem;
      font-weight: 800;
      line-height: 1.35;
    }

    .certificate-meta {
      color: #64748b;
      font-size: 0.86rem;
    }

    .certificate-empty-card {
      border: 1px dashed #cbd5e1;
      border-radius: 18px;
      background: #f8fafc;
      padding: 1.1rem;
      display: grid;
      gap: 0.35rem;
    }

    .certificate-empty-title {
      color: #14213d;
      font-size: 1rem;
      font-weight: 700;
    }

    .certificate-empty-card p {
      margin: 0;
      color: #64748b;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .badge-modal-backdrop {
      position: absolute;
      inset: 0;
      border: none;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
      cursor: pointer;
      animation: badge-modal-backdrop-in 180ms ease-out;
    }

    .badge-detail-card {
      position: relative;
      z-index: 2;
      width: min(100%, 42rem);
      padding: 1rem;
      border-radius: 22px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      border: 1px solid #dbe7f5;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.16);
      transform-origin: center;
      animation: badge-modal-card-in 220ms cubic-bezier(.2,.8,.2,1);
      overflow: hidden;
    }

    .badge-confetti-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 1;
    }

    .badge-fireworks-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 1;
    }

    .badge-firework-burst {
      --firework-color: #f59e0b;
      position: absolute;
      width: 0;
      height: 0;
      opacity: 0;
      animation: badge-firework-burst 1400ms cubic-bezier(.2,.8,.2,1) 1 both;
    }

    .badge-firework-core {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0.7rem;
      height: 0.7rem;
      border-radius: 999px;
      background: var(--firework-color);
      box-shadow: 0 0 18px color-mix(in srgb, var(--firework-color) 78%, white 22%);
      transform: translate(-50%, -50%);
    }

    .badge-firework-ray {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0.18rem;
      height: 2.9rem;
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, var(--firework-color) 38%, rgba(255, 255, 255, 0) 100%);
      transform-origin: 50% 0%;
      transform: translate(-50%, -50%) rotate(var(--ray-angle)) scaleY(0.2);
      opacity: 0;
      animation: badge-firework-ray 1400ms cubic-bezier(.2,.8,.2,1) 1 both;
      animation-delay: inherit;
    }

    .badge-confetti-piece {
      position: absolute;
      top: -1.25rem;
      width: 0.7rem;
      height: 1rem;
      border-radius: 999px;
      opacity: 0;
      animation-name: badge-confetti-fall;
      animation-timing-function: cubic-bezier(.18,.8,.22,1);
      animation-fill-mode: both;
    }

    @keyframes badge-modal-backdrop-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes badge-modal-card-in {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.94);
      }

      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes badge-firework-burst {
      0%,
      100% {
        opacity: 0;
        transform: scale(0.2);
      }

      12% {
        opacity: 1;
        transform: scale(0.35);
      }

      28% {
        opacity: 1;
        transform: scale(1);
      }

      48% {
        opacity: 0;
        transform: scale(1.2);
      }
    }

    @keyframes badge-firework-ray {
      0%,
      100% {
        opacity: 0;
        transform: translate(-50%, -50%) rotate(var(--ray-angle)) scaleY(0.15);
      }

      14% {
        opacity: 1;
        transform: translate(-50%, -50%) rotate(var(--ray-angle)) scaleY(0.35);
      }

      30% {
        opacity: 0.95;
        transform: translate(-50%, -50%) rotate(var(--ray-angle)) scaleY(1);
      }

      48% {
        opacity: 0;
        transform: translate(-50%, -50%) rotate(var(--ray-angle)) scaleY(1.18);
      }
    }

    @keyframes badge-confetti-fall {
      0% {
        opacity: 0;
        transform: translate3d(0, -0.75rem, 0) scale(0.8) rotate(0deg);
      }

      15% {
        opacity: 1;
      }

      100% {
        opacity: 0;
        transform: translate3d(1rem, 18rem, 0) scale(1) rotate(240deg);
      }
    }

    .badge-detail-header {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: start;
      position: relative;
      z-index: 2;
    }

    .badge-detail-copy {
      display: grid;
      gap: 0.35rem;
      min-width: 0;
    }

    .badge-close-btn {
      border: 1px solid #c7d2fe;
      border-radius: 999px;
      background: #eef2ff;
      color: #4338ca;
      padding: 0.5rem 0.85rem;
      font-size: 0.84rem;
      font-weight: 700;
      cursor: pointer;
    }

    .badge-title-large {
      font-size: 1.3rem;
    }

    .badge-category-large,
    .badge-earned-on-large,
    .badge-copy-large {
      font-size: 0.98rem;
    }

    .badge-copy-large {
      max-width: 34rem;
      line-height: 1.65;
    }

    @media (max-width: 720px) {
      .section-heading-row,
      .badge-card-row,
      .badge-detail-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .certificate-form {
        grid-template-columns: 1fr;
      }

      .certificate-form-span-2 {
        grid-column: auto;
      }

      .badge-detail-header {
        display: flex;
      }

      .badge-close-btn {
        width: 100%;
      }
    }
  `],
})
export class StudentBadgesComponent {
  readonly studentData = inject(StudentDataService);
  private static readonly legacyCertificateStorageKeyPrefix = 'lms-app.student-certificates-licences';

  private readonly selectedSectionSignal = signal<BadgeWorkspaceSection>(null);
  readonly selectedSection = computed(() => this.selectedSectionSignal());
  private readonly selectedBadgeSignal = signal<StudentBadge | null>(null);
  readonly selectedBadge = computed(() => this.selectedBadgeSignal());
  readonly certificates = this.studentData.certificatesAndLicences;
  private readonly editingCertificateIdSignal = signal<string | null>(null);
  readonly editingCertificateId = computed(() => this.editingCertificateIdSignal());
  private readonly selectedFileDataUrlSignal = signal('');
  readonly selectedFileDataUrl = computed(() => this.selectedFileDataUrlSignal());
  private readonly selectedFileNameSignal = signal('');
  readonly selectedFileName = computed(() => this.selectedFileNameSignal());
  private readonly certificateSaveMessageSignal = signal<string | null>(null);
  readonly certificateSaveMessage = computed(() => this.certificateSaveMessageSignal());
  private readonly certificateErrorMessageSignal = signal<string | null>(null);
  readonly certificateErrorMessage = computed(() => this.certificateErrorMessageSignal());
  readonly certificateForm = new FormGroup({
    certificationName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    completionDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    expiryDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    status: new FormControl<StudentCertificateStatus>('Active', { nonNullable: true, validators: [Validators.required] }),
    renewalRequired: new FormControl<'Yes' | 'No'>('No', { nonNullable: true, validators: [Validators.required] }),
    reminderNotification: new FormControl<'Yes' | 'No'>('No', { nonNullable: true, validators: [Validators.required] }),
    reminderDaysBeforeExpiry: new FormControl(30, { nonNullable: true, validators: [Validators.min(1)] }),
  });
  readonly fireworkRayAngles = ['0deg', '45deg', '90deg', '135deg', '180deg', '225deg', '270deg', '315deg'];
  readonly fireworkBursts: FireworkBurst[] = [
    { id: 1, left: '16%', top: '22%', delay: '80ms', color: '#f97316' },
    { id: 2, left: '50%', top: '16%', delay: '260ms', color: '#38bdf8' },
    { id: 3, left: '80%', top: '24%', delay: '520ms', color: '#a855f7' },
    { id: 4, left: '26%', top: '68%', delay: '760ms', color: '#22c55e' },
    { id: 5, left: '72%', top: '70%', delay: '1020ms', color: '#f43f5e' },
  ];
  readonly confettiPieces: ConfettiPiece[] = [
    { id: 1, left: '4%', delay: '0ms', duration: '940ms', rotation: '-22deg', color: '#f97316' },
    { id: 2, left: '10%', delay: '40ms', duration: '1100ms', rotation: '18deg', color: '#22c55e' },
    { id: 3, left: '16%', delay: '90ms', duration: '980ms', rotation: '-14deg', color: '#38bdf8' },
    { id: 4, left: '24%', delay: '30ms', duration: '1200ms', rotation: '30deg', color: '#f43f5e' },
    { id: 5, left: '31%', delay: '120ms', duration: '1050ms', rotation: '-35deg', color: '#facc15' },
    { id: 6, left: '38%', delay: '70ms', duration: '1150ms', rotation: '22deg', color: '#8b5cf6' },
    { id: 7, left: '45%', delay: '10ms', duration: '930ms', rotation: '-18deg', color: '#14b8a6' },
    { id: 8, left: '52%', delay: '140ms', duration: '1180ms', rotation: '24deg', color: '#ef4444' },
    { id: 9, left: '59%', delay: '50ms', duration: '1010ms', rotation: '-28deg', color: '#0ea5e9' },
    { id: 10, left: '66%', delay: '100ms', duration: '1120ms', rotation: '16deg', color: '#84cc16' },
    { id: 11, left: '73%', delay: '20ms', duration: '960ms', rotation: '-20deg', color: '#fb7185' },
    { id: 12, left: '80%', delay: '130ms', duration: '1160ms', rotation: '34deg', color: '#f59e0b' },
    { id: 13, left: '87%', delay: '60ms', duration: '1080ms', rotation: '-16deg', color: '#6366f1' },
    { id: 14, left: '93%', delay: '150ms', duration: '1220ms', rotation: '20deg', color: '#10b981' },
  ];

  constructor() {
    this.migrateLegacyCertificatesIfNeeded();

    effect(() => {
      this.refreshAllCertificateStatuses(this.certificates());
    });
  }

  selectSection(section: Exclude<BadgeWorkspaceSection, null>) {
    this.selectedSectionSignal.set(section);
    this.selectedBadgeSignal.set(null);
  }

  clearSection() {
    this.selectedSectionSignal.set(null);
    this.selectedBadgeSignal.set(null);
    this.cancelCertificateEdit();
  }

  openBadge(badge: StudentBadge) {
    this.selectedBadgeSignal.set(badge);
  }

  closeBadge() {
    this.selectedBadgeSignal.set(null);
  }

  onCertificateFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return;
      }

      this.selectedFileDataUrlSignal.set(reader.result);
      this.selectedFileNameSignal.set(file.name);
    };

    reader.readAsDataURL(file);
    input.value = '';
  }

  clearSelectedCertificateFile() {
    this.selectedFileNameSignal.set('');
    this.selectedFileDataUrlSignal.set('');
  }

  saveCertificate() {
    if (!this.certificateForm.valid) {
      this.certificateErrorMessageSignal.set('Please complete all required certificate/licence fields.');
      this.certificateSaveMessageSignal.set(null);
      return;
    }

    const form = this.certificateForm.controls;

    if (form.reminderNotification.value === 'Yes' && (!form.reminderDaysBeforeExpiry.value || form.reminderDaysBeforeExpiry.value < 1)) {
      this.certificateErrorMessageSignal.set('Enter valid reminder days when reminder notification is enabled.');
      this.certificateSaveMessageSignal.set(null);
      return;
    }

    this.refreshCalculatedStatus();

    const existingId = this.editingCertificateIdSignal();
    const existing = existingId ? this.certificates().find((item) => item.id === existingId) : null;

    const nextRecord: StudentCertificateLicence = {
      id: existingId ?? `certificate-${Date.now()}`,
      certificationName: form.certificationName.value.trim(),
      completionDate: form.completionDate.value,
      expiryDate: form.expiryDate.value,
      fileName: this.selectedFileNameSignal() || existing?.fileName || '',
      fileDataUrl: this.selectedFileDataUrlSignal() || existing?.fileDataUrl || '',
      status: this.calculateCertificateStatus(
        form.expiryDate.value,
        form.reminderNotification.value,
        Number(form.reminderDaysBeforeExpiry.value),
      ),
      renewalRequired: form.renewalRequired.value,
      reminderNotification: form.reminderNotification.value,
      reminderDaysBeforeExpiry: form.reminderNotification.value === 'Yes' ? Number(form.reminderDaysBeforeExpiry.value) : 0,
    };

    const nextRecords = existingId
      ? this.certificates().map((record) => record.id === existingId ? nextRecord : record)
      : [nextRecord, ...this.certificates()];

    this.studentData.updateCertificatesAndLicences(nextRecords);
    this.certificateErrorMessageSignal.set(null);
    this.certificateSaveMessageSignal.set(existingId ? 'Record updated.' : 'Record saved.');
    this.cancelCertificateEdit();
  }

  startCertificateEdit(certificate: StudentCertificateLicence) {
    this.editingCertificateIdSignal.set(certificate.id);
    this.certificateForm.setValue({
      certificationName: certificate.certificationName,
      completionDate: certificate.completionDate,
      expiryDate: certificate.expiryDate,
      status: this.calculateCertificateStatus(
        certificate.expiryDate,
        certificate.reminderNotification,
        certificate.reminderDaysBeforeExpiry,
      ),
      renewalRequired: certificate.renewalRequired,
      reminderNotification: certificate.reminderNotification,
      reminderDaysBeforeExpiry: certificate.reminderDaysBeforeExpiry || 30,
    });
    this.selectedFileNameSignal.set(certificate.fileName);
    this.selectedFileDataUrlSignal.set(certificate.fileDataUrl);
    this.certificateErrorMessageSignal.set(null);
    this.certificateSaveMessageSignal.set(null);
  }

  cancelCertificateEdit() {
    this.editingCertificateIdSignal.set(null);
    this.certificateForm.reset({
      certificationName: '',
      completionDate: '',
      expiryDate: '',
      status: 'Active',
      renewalRequired: 'No',
      reminderNotification: 'No',
      reminderDaysBeforeExpiry: 30,
    });
    this.selectedFileNameSignal.set('');
    this.selectedFileDataUrlSignal.set('');
    this.refreshCalculatedStatus();
  }

  refreshCalculatedStatus() {
    const form = this.certificateForm.controls;
    const nextStatus = this.calculateCertificateStatus(
      form.expiryDate.value,
      form.reminderNotification.value,
      Number(form.reminderDaysBeforeExpiry.value),
    );
    form.status.setValue(nextStatus, { emitEvent: false });
  }

  private migrateLegacyCertificatesIfNeeded() {
    if (this.certificates().length || typeof localStorage === 'undefined') {
      return;
    }

    const raw = localStorage.getItem(this.legacyCertificateStorageKey());
    if (!raw) {
      return;
    }

    const records = this.parseCertificateRecords(raw);
    if (!records.length) {
      return;
    }

    this.studentData.updateCertificatesAndLicences(records);
    localStorage.removeItem(this.legacyCertificateStorageKey());
  }

  private parseCertificateRecords(raw: string): StudentCertificateLicence[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      const records = parsed.filter((item): item is StudentCertificateLicence =>
        typeof item?.id === 'string' &&
        typeof item?.certificationName === 'string' &&
        typeof item?.completionDate === 'string' &&
        typeof item?.expiryDate === 'string' &&
        typeof item?.fileName === 'string' &&
        typeof item?.fileDataUrl === 'string' &&
        (item?.status === 'Active' || item?.status === 'Expired' || item?.status === 'Pending Renewal') &&
        (item?.renewalRequired === 'Yes' || item?.renewalRequired === 'No') &&
        (item?.reminderNotification === 'Yes' || item?.reminderNotification === 'No') &&
        typeof item?.reminderDaysBeforeExpiry === 'number',
      );

      const normalizedRecords = records.map((record) => ({
        ...record,
        status: this.calculateCertificateStatus(
          record.expiryDate,
          record.reminderNotification,
          record.reminderDaysBeforeExpiry,
        ),
      }));

      return normalizedRecords;
    } catch {
      return [];
    }
  }

  private refreshAllCertificateStatuses(records: StudentCertificateLicence[]) {
    if (!records.length) {
      return;
    }

    const normalizedRecords = records.map((record) => ({
      ...record,
      status: this.calculateCertificateStatus(
        record.expiryDate,
        record.reminderNotification,
        record.reminderDaysBeforeExpiry,
      ),
    }));

    const hasStatusChanges = normalizedRecords.some((record, index) => record.status !== records[index]?.status);
    if (!hasStatusChanges) {
      return;
    }

    this.studentData.updateCertificatesAndLicences(normalizedRecords);
  }

  private calculateCertificateStatus(
    expiryDate: string,
    reminderNotification: 'Yes' | 'No',
    reminderDaysBeforeExpiry: number,
  ): StudentCertificateStatus {
    const expiry = this.parseDateOnly(expiryDate);
    if (!expiry) {
      return 'Active';
    }

    const today = this.startOfToday();
    if (expiry < today) {
      return 'Expired';
    }

    if (reminderNotification === 'Yes') {
      const safeReminderDays = Number.isFinite(reminderDaysBeforeExpiry) && reminderDaysBeforeExpiry > 0
        ? reminderDaysBeforeExpiry
        : 0;
      const msUntilExpiry = expiry.getTime() - today.getTime();
      const daysUntilExpiry = Math.ceil(msUntilExpiry / (1000 * 60 * 60 * 24));

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

  private startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private currentSessionStudentId() {
    try {
      const session = JSON.parse(localStorage.getItem('lms-session') || '{}') as { studentId?: string | null };
      if (typeof session.studentId === 'string' && session.studentId.trim()) {
        return session.studentId.trim();
      }
    } catch {
      // Ignore malformed session state and fall back to default scope.
    }

    return 'default';
  }

  private legacyCertificateStorageKey() {
    return `${StudentBadgesComponent.legacyCertificateStorageKeyPrefix}.${this.currentSessionStudentId()}`;
  }

}
