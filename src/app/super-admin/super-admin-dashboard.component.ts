import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import {
  AdministratorAccountSummary,
  CompanyWithUsage,
  PlatformBackendService,
  PlatformBrandingSettings,
  PlatformUsageOverview,
  SubscriptionPlan,
  SubscriptionStatus,
  SuperAdminSummary,
} from './platform-backend.service';
import { clearPlatformAuthSession, readPlatformSessionRecord } from './platform-session-auth';
import { LMS_BRAND_THEME_OPTIONS, type LmsBrandThemeId } from '../lms-brand-themes';

type ActivePanel = 'none' | 'create-company' | 'edit-subscription' | 'manage-admins' | 'edit-branding' | 'manage-super-admins';

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  host: {
    '(document:keydown.escape)': 'closePanel()',
  },
  template: `
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark">SC</span>
          <div class="brand-copy">
            <h1>SkillsConnect</h1>
            <p>Super Admin</p>
          </div>
        </div>

        <div class="topbar-right">
          <span class="admin-name">{{ adminName() }}</span>
          <button type="button" class="ghost-btn" (click)="openManageSuperAdmins()">Manage Super Admins</button>
          <button type="button" class="ghost-btn" (click)="logout()">Log out</button>
        </div>
      </header>

      <main class="content">
        @if (loadError()) {
          <div class="banner banner-error">{{ loadError() }}</div>
        }

        <section class="stat-row">
          <div class="stat-card">
            <span class="stat-label">Companies</span>
            <span class="stat-value">{{ usageOverview()?.companyCount ?? (loading() ? '—' : companies().length) }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Total users</span>
            <span class="stat-value">{{ usageOverview()?.totalUsers ?? '—' }}</span>
          </div>
        </section>

        <section class="companies-section">
          <div class="section-heading">
            <h2>Login page branding</h2>
          </div>

          <p class="branding-hint">
            Every company signs in through the same login screen — this is the one look shown
            before anyone signs in. Each company's own branding still applies once they're inside.
          </p>

          @if (platformBrandingLoading()) {
            <div class="empty-state">Loading…</div>
          } @else {
            <div class="branding-editor">
              <div class="branding-logo-block">
                <div class="branding-logo-preview" [class.branding-logo-preview-has-image]="!!(pendingLogoDataUrl() ?? platformBranding()?.companyLogoDataUrl)">
                  @if (pendingLogoDataUrl() ?? platformBranding()?.companyLogoDataUrl; as previewUrl) {
                    <img [src]="previewUrl" alt="" />
                  } @else {
                    <span>SC</span>
                  }
                </div>
                <div class="branding-logo-actions">
                  @if (pendingLogoDataUrl()) {
                    <span class="branding-pending-chip">Not saved yet</span>
                    <button type="button" class="secondary-btn branding-save-btn" [disabled]="platformBrandingLogoUploading()" (click)="saveLogo()">
                      {{ platformBrandingLogoUploading() ? 'Saving…' : 'Save logo' }}
                    </button>
                    <button type="button" class="secondary-btn" [disabled]="platformBrandingLogoUploading()" (click)="cancelPendingLogo()">Cancel</button>
                  } @else {
                    <label class="secondary-btn branding-upload-btn">
                      <span>Upload logo</span>
                      <input type="file" accept="image/*" (change)="onPlatformLogoSelected($event)" />
                    </label>
                    <button type="button" class="secondary-btn" [disabled]="!platformBranding()?.companyLogoDataUrl || platformBrandingSaving()" (click)="removePlatformLogo()">Remove logo</button>
                  }
                </div>
              </div>

              <div class="branding-theme-field">
                <label>
                  <span>Theme colour</span>
                  <select [value]="pendingThemeId() ?? platformBranding()?.themeId" (change)="onPlatformThemeSelected($event)" [disabled]="platformBrandingSaving()">
                    @for (theme of themeOptions; track theme.id) {
                      <option [value]="theme.id">{{ theme.label }}</option>
                    }
                  </select>
                </label>
                @if (pendingThemeId()) {
                  <div class="branding-theme-actions">
                    <span class="branding-pending-chip">Not saved yet</span>
                    <button type="button" class="secondary-btn branding-save-btn" [disabled]="platformBrandingSaving()" (click)="saveTheme()">
                      {{ platformBrandingSaving() ? 'Saving…' : 'Save theme' }}
                    </button>
                    <button type="button" class="secondary-btn" [disabled]="platformBrandingSaving()" (click)="cancelPendingTheme()">Cancel</button>
                  </div>
                }
              </div>

              <div class="branding-logo-block">
                <div class="branding-bg-preview" [class.branding-bg-preview-has-image]="!!(pendingBackgroundImageUrl() ?? platformBranding()?.backgroundImageUrl)">
                  @if (pendingBackgroundImageUrl() ?? platformBranding()?.backgroundImageUrl; as previewUrl) {
                    <img [src]="previewUrl" alt="" />
                  } @else {
                    <span>No image set</span>
                  }
                </div>
                <div class="branding-logo-actions">
                  @if (pendingBackgroundImageUrl() !== null) {
                    <span class="branding-pending-chip">Not saved yet</span>
                    <button type="button" class="secondary-btn branding-save-btn" [disabled]="platformBrandingSaving()" (click)="saveBackgroundImage()">
                      {{ platformBrandingSaving() ? 'Saving…' : 'Save background' }}
                    </button>
                    <button type="button" class="secondary-btn" [disabled]="platformBrandingSaving()" (click)="cancelPendingBackgroundImage()">Cancel</button>
                  } @else {
                    <label class="secondary-btn branding-upload-btn">
                      <span>{{ platformBrandingBackgroundUploading() ? 'Uploading…' : 'Upload background' }}</span>
                      <input type="file" accept="image/*" [disabled]="platformBrandingBackgroundUploading()" (change)="onPlatformBackgroundImageSelected($event)" />
                    </label>
                    <button type="button" class="secondary-btn" [disabled]="!platformBranding()?.backgroundImageUrl || platformBrandingSaving()" (click)="removePlatformBackgroundImage()">Remove background</button>
                  }
                </div>
              </div>

              @if (platformBrandingError()) {
                <div class="error">{{ platformBrandingError() }}</div>
              }
            </div>
          }
        </section>

        <section class="companies-section">
          <div class="section-heading">
            <h2>Companies</h2>
            <button type="button" class="primary-btn" (click)="openCreateCompany()">+ New company</button>
          </div>

          @if (loading()) {
            <div class="empty-state">Loading companies…</div>
          } @else if (companies().length === 0) {
            <div class="empty-state">No companies yet — create the first one above.</div>
          } @else {
            <div class="company-table">
              <div class="company-row company-row-head" aria-hidden="true">
                <span>Company</span>
                <span>Plan</span>
                <span>Usage</span>
                <span>Status</span>
                <span>Subscription</span>
                <span>Actions</span>
              </div>

              @for (company of companies(); track company.id) {
                <article class="company-row">
                  <div class="company-cell">
                    <div class="company-name">{{ company.name }}</div>
                    <div class="company-id">{{ company.id }}</div>
                  </div>
                  <div class="company-cell">
                    <span class="pill pill-plan">{{ company.subscription.plan }}</span>
                  </div>
                  <div class="company-cell">
                    <span [class.usage-over]="company.usage.userCount >= company.usage.licenseLimit">
                      {{ company.usage.userCount }} / {{ company.usage.licenseLimit }}
                    </span>
                  </div>
                  <div class="company-cell">
                    <span class="pill" [class]="statusPillClass(effectiveStatusLabel(company))">{{ effectiveStatusLabel(company) }}</span>
                  </div>
                  <div class="company-cell company-cell-dates">
                    {{ company.subscription.startDate }} → {{ company.subscription.endDate }}
                  </div>
                  <div class="company-cell company-cell-actions">
                    <button type="button" class="inline-btn" (click)="openEditSubscription(company)">Edit subscription</button>
                    <button type="button" class="inline-btn" (click)="openManageAdmins(company)">Admins</button>
                    <button type="button" class="inline-btn" (click)="openEditBranding(company)">Login URL &amp; branding</button>
                  </div>
                </article>
              }
            </div>
          }
        </section>
      </main>
    </div>

    @if (activePanel() !== 'none') {
      <div class="overlay-backdrop" (click)="closePanel()"></div>
    }

    @if (activePanel() === 'create-company') {
      <div class="overlay-panel" role="dialog" aria-modal="true">
        <div class="overlay-header">
          <h3>New company</h3>
          <button type="button" class="icon-btn" (click)="closePanel()" aria-label="Close">✕</button>
        </div>

        <form (ngSubmit)="submitCreateCompany()">
          <label>
            <span>Company name</span>
            <input type="text" name="name" [(ngModel)]="newCompanyName" required />
          </label>

          <label>
            <span>Plan</span>
            <select name="plan" [(ngModel)]="newCompanyPlan">
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </label>

          <label>
            <span>Licence limit (total users)</span>
            <input type="number" name="licenseLimit" min="1" [(ngModel)]="newCompanyLicenseLimit" required />
          </label>

          <div class="field-row">
            <label>
              <span>Start date</span>
              <input type="date" name="startDate" [(ngModel)]="newCompanyStartDate" required />
            </label>
            <label>
              <span>End date</span>
              <input type="date" name="endDate" [(ngModel)]="newCompanyEndDate" required />
            </label>
          </div>

          @if (createCompanyError()) {
            <div class="error">{{ createCompanyError() }}</div>
          }

          <div class="overlay-footer">
            <button type="button" class="secondary-btn" (click)="closePanel()">Cancel</button>
            <button type="submit" class="primary-btn" [disabled]="creatingCompany()">
              {{ creatingCompany() ? 'Creating…' : 'Create company' }}
            </button>
          </div>
        </form>
      </div>
    }

    @if (activePanel() === 'edit-subscription' && editingCompany(); as company) {
      <div class="overlay-panel" role="dialog" aria-modal="true">
        <div class="overlay-header">
          <h3>Edit subscription — {{ company.name }}</h3>
          <button type="button" class="icon-btn" (click)="closePanel()" aria-label="Close">✕</button>
        </div>

        <form (ngSubmit)="submitEditSubscription()">
          <label>
            <span>Plan</span>
            <select name="editPlan" [(ngModel)]="editPlan">
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </label>

          <label>
            <span>Licence limit (total users)</span>
            <input type="number" name="editLicenseLimit" min="1" [(ngModel)]="editLicenseLimit" required />
          </label>

          <div class="field-row">
            <label>
              <span>Start date</span>
              <input type="date" name="editStartDate" [(ngModel)]="editStartDate" required />
            </label>
            <label>
              <span>End date</span>
              <input type="date" name="editEndDate" [(ngModel)]="editEndDate" required />
            </label>
          </div>

          <label>
            <span>Status</span>
            <select name="editStatus" [(ngModel)]="editStatus">
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>

          @if (editSubscriptionError()) {
            <div class="error">{{ editSubscriptionError() }}</div>
          }

          <div class="overlay-footer">
            <button type="button" class="secondary-btn" (click)="closePanel()">Cancel</button>
            <button type="submit" class="primary-btn" [disabled]="savingSubscription()">
              {{ savingSubscription() ? 'Saving…' : 'Save subscription' }}
            </button>
          </div>
        </form>
      </div>
    }

    @if (activePanel() === 'manage-admins' && editingCompany(); as company) {
      <div class="overlay-panel" role="dialog" aria-modal="true">
        <div class="overlay-header">
          <h3>Administrators — {{ company.name }}</h3>
          <button type="button" class="icon-btn" (click)="closePanel()" aria-label="Close">✕</button>
        </div>

        @if (loadingCompanyAdmins()) {
          <div class="empty-state">Loading…</div>
        } @else {
          <div class="admin-list">
            @for (admin of companyAdmins(); track admin.id) {
              <div class="admin-list-row">
                <span class="admin-list-email">{{ admin.email }}</span>
                @if (resettingPasswordForAdminId() === admin.id) {
                  <div class="admin-reset-inline">
                    <input
                      type="password"
                      name="resetAdminPasswordValue"
                      [(ngModel)]="resetAdminPasswordValue"
                      placeholder="New password"
                      autocomplete="new-password" />
                    <button type="button" class="inline-btn" [disabled]="resettingPassword()" (click)="submitResetAdminPassword(admin)">
                      {{ resettingPassword() ? 'Saving…' : 'Save' }}
                    </button>
                    <button type="button" class="inline-btn" [disabled]="resettingPassword()" (click)="cancelResetAdminPassword()">Cancel</button>
                  </div>
                } @else {
                  <button type="button" class="inline-btn" (click)="startResetAdminPassword(admin)">Reset password</button>
                }
              </div>
            } @empty {
              <div class="empty-state">No administrators yet — add the first one below.</div>
            }
          </div>

          @if (resetAdminPasswordError()) {
            <div class="error">{{ resetAdminPasswordError() }}</div>
          }
          @if (resetAdminPasswordSuccess()) {
            <div class="success">{{ resetAdminPasswordSuccess() }}</div>
          }
        }

        <div class="overlay-divider"></div>
        <h4 class="overlay-subheading">Add administrator</h4>

        <form (ngSubmit)="submitAddAdmin()">
          <label>
            <span>Email</span>
            <input type="email" name="newAdminEmail" [(ngModel)]="newAdminEmail" required />
          </label>

          <label>
            <span>Temporary password</span>
            <input type="password" name="newAdminPassword" [(ngModel)]="newAdminPassword" required autocomplete="new-password" />
          </label>

          @if (addAdminError()) {
            <div class="error">{{ addAdminError() }}</div>
          }
          @if (addAdminSuccess()) {
            <div class="success">{{ addAdminSuccess() }}</div>
          }

          <div class="overlay-footer">
            <button type="button" class="secondary-btn" (click)="closePanel()">Close</button>
            <button type="submit" class="primary-btn" [disabled]="creatingAdmin()">
              {{ creatingAdmin() ? 'Creating…' : 'Add administrator' }}
            </button>
          </div>
        </form>
      </div>
    }

    @if (activePanel() === 'edit-branding' && editingCompany(); as company) {
      <div class="overlay-panel" role="dialog" aria-modal="true">
        <div class="overlay-header">
          <h3>Login URL &amp; branding — {{ company.name }}</h3>
          <button type="button" class="icon-btn" (click)="closePanel()" aria-label="Close">✕</button>
        </div>

        @if (companyBrandingLoading()) {
          <div class="empty-state">Loading…</div>
        } @else {
          <form (ngSubmit)="submitEditBranding()">
            <label>
              <span>Login URL</span>
              <div class="slug-input-row">
                <span class="slug-input-prefix">/login/</span>
                <input type="text" name="editBrandingSlug" [(ngModel)]="editBrandingSlug" placeholder="acme-corp" pattern="[a-z0-9-]*" />
              </div>
              <span class="branding-hint">
                @if (editBrandingSlug.trim()) {
                  Visitors reach {{ company.name }}'s own branded login at .../login/{{ editBrandingSlug.trim().toLowerCase() }}
                } @else {
                  No custom login URL set yet — {{ company.name }} still shows the shared default login screen.
                }
              </span>
            </label>

            <div class="overlay-divider"></div>

            <div class="branding-editor">
              <div class="branding-logo-block">
                <div class="branding-logo-preview" [class.branding-logo-preview-has-image]="!!companyBrandingLogoPreview()">
                  @if (companyBrandingLogoPreview(); as previewUrl) {
                    <img [src]="previewUrl" alt="" />
                  } @else {
                    <span>{{ company.name.slice(0, 2).toUpperCase() }}</span>
                  }
                </div>
                <div class="branding-logo-actions">
                  <label class="secondary-btn branding-upload-btn">
                    <span>Upload logo</span>
                    <input type="file" accept="image/*" (change)="onCompanyBrandingLogoSelected($event)" />
                  </label>
                  <button type="button" class="secondary-btn" [disabled]="!companyBrandingLogoPreview()" (click)="removeCompanyBrandingLogo()">Remove logo</button>
                </div>
              </div>

              <div class="branding-theme-field">
                <label>
                  <span>Theme colour</span>
                  <select name="editBrandingThemeId" [(ngModel)]="editBrandingThemeId">
                    @for (theme of themeOptions; track theme.id) {
                      <option [value]="theme.id">{{ theme.label }}</option>
                    }
                  </select>
                </label>
              </div>

              <div class="branding-logo-block">
                <div class="branding-bg-preview" [class.branding-bg-preview-has-image]="!!companyBrandingBackgroundImagePreview()">
                  @if (companyBrandingBackgroundImagePreview(); as previewUrl) {
                    <img [src]="previewUrl" alt="" />
                  } @else {
                    <span>No image set</span>
                  }
                </div>
                <div class="branding-logo-actions">
                  <label class="secondary-btn branding-upload-btn">
                    <span>{{ companyBrandingBackgroundUploading() ? 'Uploading…' : 'Upload background' }}</span>
                    <input type="file" accept="image/*" [disabled]="companyBrandingBackgroundUploading()" (change)="onCompanyBrandingBackgroundImageSelected($event, company.id)" />
                  </label>
                  <button type="button" class="secondary-btn" [disabled]="!companyBrandingBackgroundImagePreview()" (click)="removeCompanyBrandingBackgroundImage()">Remove background</button>
                </div>
              </div>
            </div>

            @if (companyBrandingError()) {
              <div class="error">{{ companyBrandingError() }}</div>
            }

            <div class="overlay-footer">
              <button type="button" class="secondary-btn" (click)="closePanel()">Cancel</button>
              <button type="submit" class="primary-btn" [disabled]="companyBrandingSaving()">
                {{ companyBrandingSaving() ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </form>
        }
      </div>
    }

    @if (activePanel() === 'manage-super-admins') {
      <div class="overlay-panel" role="dialog" aria-modal="true">
        <div class="overlay-header">
          <h3>Super Admins</h3>
          <button type="button" class="icon-btn" (click)="closePanel()" aria-label="Close">✕</button>
        </div>

        @if (loadingSuperAdmins()) {
          <div class="empty-state">Loading…</div>
        } @else {
          <div class="admin-list">
            @for (admin of superAdmins(); track admin.id) {
              <div class="admin-list-row">
                <span class="admin-list-email">{{ admin.name }} — {{ admin.email }}</span>
              </div>
            } @empty {
              <div class="empty-state">No other Super Admins yet.</div>
            }
          </div>
        }

        <div class="overlay-divider"></div>
        <h4 class="overlay-subheading">Add Super Admin</h4>

        <form (ngSubmit)="submitAddSuperAdmin()">
          <label>
            <span>Name</span>
            <input type="text" name="newSuperAdminName" [(ngModel)]="newSuperAdminName" required />
          </label>

          <label>
            <span>Email</span>
            <input type="email" name="newSuperAdminEmail" [(ngModel)]="newSuperAdminEmail" required />
          </label>

          <label>
            <span>Password</span>
            <input type="password" name="newSuperAdminPassword" [(ngModel)]="newSuperAdminPassword" required autocomplete="new-password" />
          </label>

          @if (addSuperAdminError()) {
            <div class="error">{{ addSuperAdminError() }}</div>
          }
          @if (addSuperAdminSuccess()) {
            <div class="success">{{ addSuperAdminSuccess() }}</div>
          }

          <div class="overlay-footer">
            <button type="button" class="secondary-btn" (click)="closePanel()">Close</button>
            <button type="submit" class="primary-btn" [disabled]="creatingSuperAdmin()">
              {{ creatingSuperAdmin() ? 'Creating…' : 'Add Super Admin' }}
            </button>
          </div>
        </form>
      </div>
    }

    @if (cropModalOpen() && cropImageSrc(); as cropSrc) {
      <div class="overlay-backdrop" (click)="cancelCrop()"></div>
      <div class="overlay-panel crop-panel" role="dialog" aria-modal="true" aria-label="Crop logo">
        <div class="overlay-header">
          <h3>Crop logo</h3>
          <button type="button" class="icon-btn" (click)="cancelCrop()" aria-label="Close">✕</button>
        </div>

        <p class="branding-hint crop-hint">Drag to reposition, use the slider to zoom, then confirm.</p>

        <div
          class="crop-viewport"
          (pointerdown)="onCropPointerDown($event)"
          (pointermove)="onCropPointerMove($event)"
          (pointerup)="onCropPointerUp($event)"
          (pointercancel)="onCropPointerUp($event)"
          (pointerleave)="onCropPointerUp($event)">
          <img
            #cropImageEl
            [src]="cropSrc"
            alt=""
            draggable="false"
            (dragstart)="$event.preventDefault()"
            (load)="onCropImageLoad(cropImageEl)"
            [ngStyle]="cropImageStyle()"
            class="crop-image" />
        </div>

        <label class="crop-zoom-field">
          <span>Zoom</span>
          <input type="range" min="1" max="3" step="0.01" [value]="cropZoom()" (input)="onCropZoomChange($event)" />
        </label>

        <div class="overlay-footer">
          <button type="button" class="secondary-btn" (click)="cancelCrop()">Cancel</button>
          <button type="button" class="primary-btn" [disabled]="!cropNaturalSize()" (click)="applyCrop()">Use this photo</button>
        </div>
      </div>
    }

    @if (platformBrandingToast(); as toastMessage) {
      <div class="branding-toast" role="status" aria-live="polite">
        <span class="branding-toast-icon" aria-hidden="true">✓</span>
        <span class="branding-toast-message">{{ toastMessage }}</span>
        <button type="button" class="branding-toast-dismiss" aria-label="Dismiss notification" (click)="dismissPlatformBrandingToast()">×</button>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #f1f5f9;
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #0f172a;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.75rem;
      background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%);
      color: #fff;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.4rem;
      height: 2.4rem;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.12);
      font-weight: 800;
      font-size: 0.85rem;
    }

    .brand-copy h1 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 800;
    }

    .brand-copy p {
      margin: 0.05rem 0 0;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.7;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .admin-name {
      font-size: 0.86rem;
      font-weight: 600;
      opacity: 0.9;
    }

    .ghost-btn {
      padding: 0.45rem 0.9rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      background: transparent;
      color: #fff;
      font-weight: 700;
      font-size: 0.82rem;
      cursor: pointer;
    }

    .content {
      max-width: 72rem;
      margin: 0 auto;
      padding: 1.75rem;
      display: grid;
      gap: 1.5rem;
    }

    .banner {
      padding: 0.75rem 1rem;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 600;
    }

    .banner-error {
      background: rgba(220, 38, 38, 0.08);
      border: 1px solid rgba(220, 38, 38, 0.25);
      color: #b91c1c;
    }

    .stat-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: 1rem;
    }

    .stat-card {
      background: #fff;
      border-radius: 14px;
      padding: 1.1rem 1.3rem;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
      display: grid;
      gap: 0.3rem;
    }

    .stat-label {
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #64748b;
    }

    .stat-value {
      font-size: 1.8rem;
      font-weight: 800;
      color: #0f172a;
    }

    .companies-section {
      background: #fff;
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
    }

    .section-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.1rem;
    }

    .section-heading h2 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 800;
    }

    .empty-state {
      padding: 2rem 1rem;
      text-align: center;
      color: #64748b;
      font-size: 0.9rem;
    }

    .branding-hint {
      margin: -0.4rem 0 1.1rem;
      font-size: 0.84rem;
      color: #64748b;
      line-height: 1.5;
    }

    .branding-editor {
      display: grid;
      gap: 1.1rem;
    }

    .branding-logo-block {
      display: flex;
      align-items: center;
      gap: 1.1rem;
      flex-wrap: wrap;
    }

    .branding-logo-preview {
      width: 4rem;
      height: 4rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(145deg, #eef2ff 0%, #e0f2fe 100%);
      border: 1px solid rgba(99, 102, 241, 0.2);
      overflow: hidden;
      flex-shrink: 0;
    }

    .branding-logo-preview span {
      font-size: 0.9rem;
      font-weight: 800;
      color: #3730a3;
    }

    .branding-logo-preview-has-image {
      background: #fff;
      border-color: rgba(100, 116, 139, 0.25);
    }

    .branding-logo-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .branding-bg-preview {
      width: 6rem;
      height: 4rem;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(145deg, #eef2ff 0%, #e0f2fe 100%);
      border: 1px solid rgba(99, 102, 241, 0.2);
      overflow: hidden;
      flex-shrink: 0;
    }

    .branding-bg-preview span {
      font-size: 0.72rem;
      font-weight: 700;
      color: #64748b;
      text-align: center;
      padding: 0 0.4rem;
    }

    .branding-bg-preview-has-image {
      background: #fff;
      border-color: rgba(100, 116, 139, 0.25);
    }

    .branding-bg-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .branding-logo-actions {
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .branding-upload-btn {
      position: relative;
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .branding-upload-btn input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }

    .branding-theme-field {
      display: grid;
      gap: 0.6rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: #334155;
      max-width: 16rem;
    }

    .branding-theme-field label {
      display: grid;
      gap: 0.35rem;
    }

    .branding-theme-actions {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .crop-panel {
      width: min(24rem, calc(100vw - 2rem));
    }

    .crop-hint {
      margin: -0.4rem 0 1rem;
    }

    .crop-viewport {
      position: relative;
      width: 260px;
      height: 260px;
      margin: 0 auto 1rem;
      border-radius: 50%;
      overflow: hidden;
      background: #0f172a;
      cursor: grab;
      touch-action: none;
      user-select: none;
    }

    .crop-viewport:active {
      cursor: grabbing;
    }

    .crop-image {
      position: absolute;
      max-width: none;
      pointer-events: none;
    }

    .crop-zoom-field {
      display: grid;
      gap: 0.35rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: #334155;
      margin-bottom: 0.3rem;
    }

    .crop-zoom-field input[type="range"] {
      width: 100%;
      padding: 0;
      border: none;
      accent-color: #0f172a;
    }

    .branding-pending-chip {
      font-size: 0.76rem;
      font-weight: 700;
      color: #92400e;
      background: #fef3c7;
      padding: 0.3rem 0.65rem;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
    }

    .branding-save-btn {
      background: linear-gradient(135deg, #0f172a, #334155);
      color: #fff;
      border: none;
    }

    @keyframes branding-toast-in {
      0% { opacity: 0; transform: translateY(12px) scale(0.96); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    .branding-toast {
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
      background: #0f172a;
      color: #fff;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.28);
      animation: branding-toast-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .branding-toast-icon {
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

    .branding-toast-message {
      flex: 1 1 auto;
      font-size: 0.86rem;
      font-weight: 600;
      line-height: 1.4;
    }

    .branding-toast-dismiss {
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

    .branding-toast-dismiss:hover,
    .branding-toast-dismiss:focus-visible {
      background: rgba(255, 255, 255, 0.22);
      outline: none;
    }

    .company-table {
      display: grid;
      gap: 0.5rem;
      overflow-x: auto;
    }

    .company-row {
      display: grid;
      grid-template-columns: 1.4fr 0.7fr 0.8fr 0.8fr 1.1fr 1.3fr;
      gap: 0.75rem;
      align-items: center;
      padding: 0.75rem 0.5rem;
      border-radius: 10px;
      min-width: 44rem;
    }

    .company-row:not(.company-row-head):hover {
      background: #f8fafc;
    }

    .company-row-head {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #64748b;
      border-bottom: 1px solid rgba(148, 163, 184, 0.25);
      padding-bottom: 0.6rem;
    }

    .company-name {
      font-weight: 700;
      font-size: 0.92rem;
    }

    .company-id {
      font-size: 0.74rem;
      color: #94a3b8;
    }

    .company-cell-dates {
      font-size: 0.82rem;
      color: #475569;
    }

    .usage-over {
      color: #b91c1c;
      font-weight: 700;
    }

    .pill {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: capitalize;
    }

    .pill-plan {
      background: #e0e7ff;
      color: #3730a3;
    }

    .pill-active {
      background: #dcfce7;
      color: #166534;
    }

    .pill-suspended {
      background: #fef3c7;
      color: #92400e;
    }

    .pill-cancelled {
      background: #fee2e2;
      color: #991b1b;
    }

    .company-cell-actions {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .primary-btn,
    .secondary-btn,
    .inline-btn {
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      border: none;
    }

    .primary-btn {
      padding: 0.6rem 1.1rem;
      background: linear-gradient(135deg, #0f172a, #334155);
      color: #fff;
      font-size: 0.86rem;
    }

    .primary-btn:disabled {
      opacity: 0.6;
      cursor: default;
    }

    .secondary-btn {
      padding: 0.6rem 1.1rem;
      background: #fff;
      color: #0f172a;
      border: 1px solid rgba(100, 116, 139, 0.35);
      font-size: 0.86rem;
    }

    .inline-btn {
      padding: 0.35rem 0.7rem;
      background: #eef2f7;
      color: #0f172a;
      font-size: 0.76rem;
      border: 1px solid rgba(100, 116, 139, 0.2);
    }

    .overlay-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      z-index: 20;
    }

    .overlay-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: min(28rem, calc(100vw - 2rem));
      max-height: calc(100vh - 3rem);
      overflow-y: auto;
      background: #fff;
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 30px 60px rgba(2, 6, 23, 0.35);
      z-index: 21;
      box-sizing: border-box;
    }

    .overlay-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .overlay-header h3 {
      margin: 0;
      font-size: 1.02rem;
      font-weight: 800;
    }

    .icon-btn {
      border: none;
      background: transparent;
      font-size: 1rem;
      cursor: pointer;
      color: #64748b;
    }

    form {
      display: grid;
      gap: 0.9rem;
    }

    label {
      display: grid;
      gap: 0.35rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: #334155;
    }

    input,
    select {
      padding: 0.6rem 0.75rem;
      border: 1px solid rgba(100, 116, 139, 0.35);
      border-radius: 8px;
      font: inherit;
      color: #0f172a;
      box-sizing: border-box;
    }

    input:focus,
    select:focus {
      outline: none;
      border-color: #334155;
      box-shadow: 0 0 0 3px rgba(51, 65, 85, 0.18);
    }

    .field-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }

    .slug-input-row {
      display: flex;
      align-items: center;
      border: 1px solid rgba(100, 116, 139, 0.35);
      border-radius: 8px;
      overflow: hidden;
    }

    .slug-input-row input {
      border: none;
      border-radius: 0;
      flex: 1;
    }

    .slug-input-row input:focus {
      box-shadow: none;
    }

    .slug-input-prefix {
      padding: 0.6rem 0 0.6rem 0.75rem;
      color: #64748b;
      font-size: 0.9rem;
      white-space: nowrap;
    }

    .admin-list {
      display: grid;
      gap: 0.5rem;
      margin-bottom: 0.9rem;
    }

    .admin-list-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.55rem 0.7rem;
      border-radius: 10px;
      background: #f8fafc;
      border: 1px solid rgba(100, 116, 139, 0.18);
      flex-wrap: wrap;
    }

    .admin-list-email {
      font-size: 0.86rem;
      font-weight: 600;
      color: #0f172a;
      word-break: break-all;
    }

    .admin-reset-inline {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .admin-reset-inline input {
      padding: 0.4rem 0.6rem;
      border: 1px solid rgba(100, 116, 139, 0.35);
      border-radius: 8px;
      font: inherit;
      font-size: 0.82rem;
      color: #0f172a;
      box-sizing: border-box;
    }

    .overlay-divider {
      height: 1px;
      background: rgba(100, 116, 139, 0.2);
      margin: 1.1rem 0;
    }

    .overlay-subheading {
      margin: 0 0 0.7rem;
      font-size: 0.86rem;
      font-weight: 800;
      color: #334155;
    }

    .overlay-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.6rem;
      margin-top: 0.3rem;
    }

    .error {
      background: rgba(220, 38, 38, 0.08);
      border: 1px solid rgba(220, 38, 38, 0.25);
      color: #b91c1c;
      border-radius: 8px;
      padding: 0.55rem 0.7rem;
      font-size: 0.82rem;
    }

    .success {
      background: rgba(22, 163, 74, 0.08);
      border: 1px solid rgba(22, 163, 74, 0.25);
      color: #166534;
      border-radius: 8px;
      padding: 0.55rem 0.7rem;
      font-size: 0.82rem;
    }
  `],
})
export class SuperAdminDashboardComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly backend = inject(PlatformBackendService);

  readonly adminName = signal(readPlatformSessionRecord()?.name ?? readPlatformSessionRecord()?.email ?? 'Super Admin');

  readonly companies = signal<CompanyWithUsage[]>([]);
  readonly usageOverview = signal<PlatformUsageOverview | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');

  readonly themeOptions = LMS_BRAND_THEME_OPTIONS;
  readonly platformBranding = signal<PlatformBrandingSettings | null>(null);
  readonly platformBrandingLoading = signal(true);
  readonly platformBrandingSaving = signal(false);
  readonly platformBrandingLogoUploading = signal(false);
  readonly platformBrandingBackgroundUploading = signal(false);
  readonly platformBrandingError = signal('');
  // Set once a logo file is picked, cleared once it's saved (or cancelled) — a newly selected
  // logo is only previewed, never actually sent to the server, until "Save logo" is clicked.
  readonly pendingLogoDataUrl = signal<string | null>(null);
  // Same staging pattern, for the background image — null means "no pending change", a string
  // (including '' is never used; a real upload always returns a real URL) is a newly uploaded
  // image awaiting Save. No crop step here (unlike the logo): a background image fills the
  // viewport via background-size: cover, so precise per-pixel cropping isn't needed the way it is
  // for the small circular logo mark.
  readonly pendingBackgroundImageUrl = signal<string | null>(null);
  // Same staging pattern as the logo, for the same reason: picking a theme in the dropdown
  // should only preview it until "Save theme" is explicitly clicked, not save on every change.
  readonly pendingThemeId = signal<LmsBrandThemeId | null>(null);
  // Success confirmation for every branding save (theme, logo save, logo remove) — same toast
  // pattern as admin-profile.component.ts's assign-wizard confirmation.
  readonly platformBrandingToast = signal<string | null>(null);
  private platformBrandingToastTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Per-company login URL & branding (edit-branding panel) ─────────────
  // Single-form-with-one-Save-button, unlike the immediate-autosave platform editor above —
  // matches this dashboard's own edit-subscription/manage-admins panels instead. Reuses the same
  // crop modal below for the logo (see cropTarget).
  readonly companyBranding = signal<PlatformBrandingSettings | null>(null);
  readonly companyBrandingLoading = signal(false);
  readonly companyBrandingSaving = signal(false);
  readonly companyBrandingError = signal('');
  editBrandingSlug = '';
  editBrandingThemeId: LmsBrandThemeId = 'ocean';
  // Staged new logo (via the crop modal) or an explicit removal — undefined means "no change,
  // still showing whatever companyBranding() already had" (see companyBrandingLogoPreview below).
  private readonly companyBrandingPendingLogoDataUrl = signal<string | null | undefined>(undefined);
  readonly companyBrandingLogoPreview = computed(() => {
    const pending = this.companyBrandingPendingLogoDataUrl();
    return pending !== undefined ? pending : this.companyBranding()?.companyLogoDataUrl ?? null;
  });

  // Same staging pattern as the logo, for the background image — uploaded immediately on
  // selection (no crop step, see pendingBackgroundImageUrl's own comment) straight to a
  // companyId-scoped Storage path.
  readonly companyBrandingBackgroundUploading = signal(false);
  private readonly companyBrandingPendingBackgroundImageUrl = signal<string | null | undefined>(undefined);
  readonly companyBrandingBackgroundImagePreview = computed(() => {
    const pending = this.companyBrandingPendingBackgroundImageUrl();
    return pending !== undefined ? pending : this.companyBranding()?.backgroundImageUrl ?? null;
  });

  // ── Logo crop modal ───────────────────────────────────────────────────
  // A freshly picked file is never staged as the pending logo directly — it opens this modal
  // first so the admin can pan/zoom to the exact region they want before it becomes the preview.
  // cropTarget routes applyCrop()'s result to the right pending-logo signal — the platform-wide
  // editor's own, or this one company's, since both reuse this one shared modal.
  private cropTarget: 'platform' | 'company' = 'platform';
  readonly cropModalOpen = signal(false);
  readonly cropImageSrc = signal<string | null>(null);
  readonly cropNaturalSize = signal<{ width: number; height: number } | null>(null);
  readonly cropZoom = signal(1);
  readonly cropOffsetX = signal(0);
  readonly cropOffsetY = signal(0);
  private cropImageElement: HTMLImageElement | null = null;
  private cropDragging = false;
  private cropDragPointerId: number | null = null;
  private cropDragStartClientX = 0;
  private cropDragStartClientY = 0;
  private cropDragStartOffsetX = 0;
  private cropDragStartOffsetY = 0;
  // Visible crop frame size (CSS px) — must match .crop-viewport's width/height below.
  private readonly cropViewportSize = 260;
  // Fixed output resolution (px) the cropped logo is rendered at, regardless of source size or
  // zoom — comfortably sharp for the small circular mark this ends up shown at everywhere, while
  // staying well under the server's 1 MB data: URI cap.
  private readonly cropOutputSize = 480;

  // "cover"-style base scale: the smaller of the two ratios would leave gaps, so use the larger
  // one — the shorter source dimension exactly fills the viewport before any user zoom is applied.
  private cropBaseScale(): number {
    const size = this.cropNaturalSize();
    if (!size || !size.width || !size.height) {
      return 1;
    }
    return Math.max(this.cropViewportSize / size.width, this.cropViewportSize / size.height);
  }

  private cropDisplaySize(): { width: number; height: number } {
    const size = this.cropNaturalSize();
    if (!size) {
      return { width: 0, height: 0 };
    }
    const scale = this.cropBaseScale() * this.cropZoom();
    return { width: size.width * scale, height: size.height * scale };
  }

  readonly cropImageStyle = computed(() => {
    // Re-evaluate whenever any of these change — cropDisplaySize/cropBaseScale read the same
    // signals directly, but computed() only tracks signals read during ITS OWN execution, so
    // touching them here (rather than only inside the private helpers) is what makes this
    // recompute on zoom/pan/image-load.
    this.cropNaturalSize();
    this.cropZoom();
    const offsetX = this.cropOffsetX();
    const offsetY = this.cropOffsetY();

    const { width, height } = this.cropDisplaySize();
    const left = (this.cropViewportSize - width) / 2 + offsetX;
    const top = (this.cropViewportSize - height) / 2 + offsetY;
    return {
      width: `${width}px`,
      height: `${height}px`,
      left: `${left}px`,
      top: `${top}px`,
    };
  });

  readonly activePanel = signal<ActivePanel>('none');
  private readonly activeCompanyId = signal<string | null>(null);
  // Falls back to a snapshot taken at open-time when the id isn't in `companies()` yet — the
  // gap right after creating a company, before its own list-refresh (fired but not awaited)
  // resolves. Without this fallback, opening "Add admin" immediately after creating a company
  // would find nothing, and the panel content (gated on this being non-null) would silently
  // never render behind the dimmed backdrop — permanently, if that refresh happens to fail.
  private readonly activeCompanySnapshot = signal<CompanyWithUsage | null>(null);
  readonly editingCompany = computed(() =>
    this.companies().find((company) => company.id === this.activeCompanyId()) ?? this.activeCompanySnapshot(),
  );

  newCompanyName = '';
  newCompanyPlan: SubscriptionPlan = 'starter';
  newCompanyLicenseLimit = 25;
  newCompanyStartDate = '';
  newCompanyEndDate = '';
  readonly createCompanyError = signal('');
  readonly creatingCompany = signal(false);

  editPlan: SubscriptionPlan = 'starter';
  editLicenseLimit = 25;
  editStartDate = '';
  editEndDate = '';
  editStatus: SubscriptionStatus = 'active';
  readonly editSubscriptionError = signal('');
  readonly savingSubscription = signal(false);

  newAdminEmail = '';
  newAdminPassword = '';
  readonly addAdminError = signal('');
  readonly addAdminSuccess = signal('');
  readonly creatingAdmin = signal(false);

  readonly companyAdmins = signal<AdministratorAccountSummary[]>([]);
  readonly loadingCompanyAdmins = signal(false);
  readonly resettingPasswordForAdminId = signal<string | null>(null);
  resetAdminPasswordValue = '';
  readonly resettingPassword = signal(false);
  readonly resetAdminPasswordError = signal('');
  readonly resetAdminPasswordSuccess = signal('');

  // ── Manage Super Admins panel — platform-level, not company-scoped ─────
  readonly superAdmins = signal<SuperAdminSummary[]>([]);
  readonly loadingSuperAdmins = signal(false);
  newSuperAdminName = '';
  newSuperAdminEmail = '';
  newSuperAdminPassword = '';
  readonly addSuperAdminError = signal('');
  readonly addSuperAdminSuccess = signal('');
  readonly creatingSuperAdmin = signal(false);

  ngOnInit() {
    this.loadAll();
    this.loadPlatformBranding();
  }

  ngOnDestroy() {
    if (this.platformBrandingToastTimer) {
      clearTimeout(this.platformBrandingToastTimer);
    }
  }

  private loadAll() {
    this.loading.set(true);
    this.loadError.set('');

    this.backend.listCompanies()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (companies) => this.companies.set(companies),
        error: () => this.loadError.set('Could not load companies right now.'),
      });

    this.backend.getUsageOverview().subscribe({
      next: (overview) => this.usageOverview.set(overview),
      error: () => { /* stat row just shows a dash — non-critical */ },
    });
  }

  private loadPlatformBranding() {
    this.platformBrandingLoading.set(true);
    this.backend.getBranding()
      .pipe(finalize(() => this.platformBrandingLoading.set(false)))
      .subscribe({
        next: (branding) => this.platformBranding.set(branding),
        error: () => this.platformBrandingError.set('Could not load the login page branding right now.'),
      });
  }

  // The server's own gate (getCompanySubscriptionContext) already treats a company outside its
  // start/end date window as inactive regardless of the stored status field — but that field
  // itself is never updated to say so, so a lapsed or not-yet-started subscription still reads
  // "active" here unless this view derives the same condition itself. Without this, a Super Admin
  // has no way to tell "still active" apart from "silently locking out every user in this
  // company" just by scanning the list.
  effectiveStatusLabel(company: CompanyWithUsage): SubscriptionStatus | 'expired' | 'scheduled' {
    if (company.subscription.status !== 'active') {
      return company.subscription.status;
    }

    const now = Date.now();
    if (now < new Date(company.subscription.startDate).getTime()) {
      return 'scheduled';
    }
    if (now > new Date(company.subscription.endDate).getTime()) {
      return 'expired';
    }

    return 'active';
  }

  statusPillClass(status: SubscriptionStatus | 'expired' | 'scheduled') {
    return status === 'active' ? 'pill-active' : status === 'suspended' || status === 'expired' || status === 'scheduled' ? 'pill-suspended' : 'pill-cancelled';
  }

  openCreateCompany() {
    this.newCompanyName = '';
    this.newCompanyPlan = 'starter';
    this.newCompanyLicenseLimit = 25;
    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(today.getFullYear() + 1);
    this.newCompanyStartDate = today.toISOString().slice(0, 10);
    this.newCompanyEndDate = nextYear.toISOString().slice(0, 10);
    this.createCompanyError.set('');
    this.activePanel.set('create-company');
  }

  submitCreateCompany() {
    if (this.creatingCompany()) {
      return;
    }

    if (!this.newCompanyName.trim() || !this.newCompanyStartDate || !this.newCompanyEndDate) {
      this.createCompanyError.set('All fields are required.');
      return;
    }

    this.creatingCompany.set(true);
    this.createCompanyError.set('');

    this.backend.createCompany({
      name: this.newCompanyName.trim(),
      plan: this.newCompanyPlan,
      licenseLimit: Number(this.newCompanyLicenseLimit),
      startDate: this.newCompanyStartDate,
      endDate: this.newCompanyEndDate,
    })
      .pipe(finalize(() => this.creatingCompany.set(false)))
      .subscribe({
        next: (company) => {
          this.closePanel();
          this.loadAll();
          this.openManageAdmins(company);
        },
        error: (error) => {
          this.createCompanyError.set(error?.error?.message || 'Could not create this company.');
        },
      });
  }

  openEditSubscription(company: CompanyWithUsage) {
    this.activeCompanyId.set(company.id);
    this.activeCompanySnapshot.set(company);
    this.editPlan = company.subscription.plan;
    this.editLicenseLimit = company.subscription.licenseLimit;
    this.editStartDate = company.subscription.startDate;
    this.editEndDate = company.subscription.endDate;
    this.editStatus = company.subscription.status;
    this.editSubscriptionError.set('');
    this.activePanel.set('edit-subscription');
  }

  submitEditSubscription() {
    const companyId = this.activeCompanyId();
    if (!companyId || this.savingSubscription()) {
      return;
    }

    this.savingSubscription.set(true);
    this.editSubscriptionError.set('');

    this.backend.updateSubscription(companyId, {
      plan: this.editPlan,
      licenseLimit: Number(this.editLicenseLimit),
      startDate: this.editStartDate,
      endDate: this.editEndDate,
      status: this.editStatus,
    })
      .pipe(finalize(() => this.savingSubscription.set(false)))
      .subscribe({
        next: () => {
          this.closePanel();
          this.loadAll();
        },
        error: (error) => {
          this.editSubscriptionError.set(error?.error?.message || 'Could not save this subscription.');
        },
      });
  }

  openManageAdmins(company: CompanyWithUsage) {
    this.activeCompanyId.set(company.id);
    this.activeCompanySnapshot.set(company);
    this.newAdminEmail = '';
    this.newAdminPassword = '';
    this.addAdminError.set('');
    this.addAdminSuccess.set('');
    this.companyAdmins.set([]);
    this.cancelResetAdminPassword();
    this.activePanel.set('manage-admins');
    this.loadCompanyAdmins(company.id);
  }

  private loadCompanyAdmins(companyId: string) {
    this.loadingCompanyAdmins.set(true);
    this.backend.listCompanyAdmins(companyId)
      .pipe(finalize(() => this.loadingCompanyAdmins.set(false)))
      .subscribe({
        next: (admins) => this.companyAdmins.set(admins),
        error: () => this.companyAdmins.set([]),
      });
  }

  submitAddAdmin() {
    const companyId = this.activeCompanyId();
    if (!companyId || this.creatingAdmin()) {
      return;
    }

    this.creatingAdmin.set(true);
    this.addAdminError.set('');
    this.addAdminSuccess.set('');

    this.backend.createCompanyAdmin(companyId, {
      email: this.newAdminEmail.trim(),
      password: this.newAdminPassword,
    })
      .pipe(finalize(() => this.creatingAdmin.set(false)))
      .subscribe({
        next: (account) => {
          this.addAdminSuccess.set(`Admin account created: ${account.email}`);
          this.newAdminEmail = '';
          this.newAdminPassword = '';
          this.loadAll();
          this.loadCompanyAdmins(companyId);
        },
        error: (error) => {
          this.addAdminError.set(error?.error?.message || 'Could not create this administrator account.');
        },
      });
  }

  openManageSuperAdmins() {
    this.newSuperAdminName = '';
    this.newSuperAdminEmail = '';
    this.newSuperAdminPassword = '';
    this.addSuperAdminError.set('');
    this.addSuperAdminSuccess.set('');
    this.superAdmins.set([]);
    this.activePanel.set('manage-super-admins');
    this.loadSuperAdmins();
  }

  private loadSuperAdmins() {
    this.loadingSuperAdmins.set(true);
    this.backend.listAdmins()
      .pipe(finalize(() => this.loadingSuperAdmins.set(false)))
      .subscribe({
        next: (admins) => this.superAdmins.set(admins),
        error: () => this.superAdmins.set([]),
      });
  }

  submitAddSuperAdmin() {
    if (this.creatingSuperAdmin()) {
      return;
    }

    this.creatingSuperAdmin.set(true);
    this.addSuperAdminError.set('');
    this.addSuperAdminSuccess.set('');

    this.backend.createAdmin({
      name: this.newSuperAdminName.trim(),
      email: this.newSuperAdminEmail.trim(),
      password: this.newSuperAdminPassword,
    })
      .pipe(finalize(() => this.creatingSuperAdmin.set(false)))
      .subscribe({
        next: (admin) => {
          this.addSuperAdminSuccess.set(`Super Admin account created: ${admin.email}`);
          this.newSuperAdminName = '';
          this.newSuperAdminEmail = '';
          this.newSuperAdminPassword = '';
          this.loadSuperAdmins();
        },
        error: (error) => {
          this.addSuperAdminError.set(error?.error?.message || 'Could not create this Super Admin account.');
        },
      });
  }

  startResetAdminPassword(admin: AdministratorAccountSummary) {
    this.resettingPasswordForAdminId.set(admin.id);
    this.resetAdminPasswordValue = '';
    this.resetAdminPasswordError.set('');
    this.resetAdminPasswordSuccess.set('');
  }

  cancelResetAdminPassword() {
    this.resettingPasswordForAdminId.set(null);
    this.resetAdminPasswordValue = '';
    this.resetAdminPasswordError.set('');
  }

  submitResetAdminPassword(admin: AdministratorAccountSummary) {
    const companyId = this.activeCompanyId();
    if (!companyId || this.resettingPassword()) {
      return;
    }

    this.resettingPassword.set(true);
    this.resetAdminPasswordError.set('');
    this.resetAdminPasswordSuccess.set('');

    this.backend.resetCompanyAdminPassword(companyId, admin.id, this.resetAdminPasswordValue)
      .pipe(finalize(() => this.resettingPassword.set(false)))
      .subscribe({
        next: () => {
          this.resetAdminPasswordSuccess.set(`Password reset for ${admin.email}.`);
          this.cancelResetAdminPassword();
        },
        error: (error) => {
          this.resetAdminPasswordError.set(error?.error?.message || 'Could not reset this password.');
        },
      });
  }

  openEditBranding(company: CompanyWithUsage) {
    this.activeCompanyId.set(company.id);
    this.activeCompanySnapshot.set(company);
    this.editBrandingSlug = company.slug ?? '';
    this.companyBrandingPendingLogoDataUrl.set(undefined);
    this.companyBrandingPendingBackgroundImageUrl.set(undefined);
    this.companyBranding.set(null);
    this.companyBrandingError.set('');
    this.activePanel.set('edit-branding');

    this.companyBrandingLoading.set(true);
    this.backend.getCompanyBranding(company.id)
      .pipe(finalize(() => this.companyBrandingLoading.set(false)))
      .subscribe({
        next: (branding) => {
          this.companyBranding.set(branding);
          this.editBrandingThemeId = branding.themeId;
        },
        error: () => {
          this.companyBrandingError.set('Could not load this company\'s current branding.');
        },
      });
  }

  removeCompanyBrandingLogo() {
    this.companyBrandingPendingLogoDataUrl.set(null);
  }

  onCompanyBrandingBackgroundImageSelected(event: Event, companyId: string) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (input) {
      input.value = '';
    }

    if (!file || this.companyBrandingBackgroundUploading()) {
      return;
    }

    this.companyBrandingError.set('');
    this.companyBrandingBackgroundUploading.set(true);
    this.backend.uploadBrandingImage(file, companyId)
      .pipe(finalize(() => this.companyBrandingBackgroundUploading.set(false)))
      .subscribe({
        next: (result) => this.companyBrandingPendingBackgroundImageUrl.set(result.url),
        error: () => this.companyBrandingError.set(`Could not upload "${file.name}". Please check your connection and try again.`),
      });
  }

  removeCompanyBrandingBackgroundImage() {
    this.companyBrandingPendingBackgroundImageUrl.set(null);
  }

  // Slug and branding are two separate endpoints server-side (see platform-backend.service.ts) —
  // saved in sequence here so one combined form/Save button still reports a single clear error if
  // either half fails, matching this panel's own single-form design (unlike the platform-wide
  // editor's per-field autosave above).
  submitEditBranding() {
    const companyId = this.activeCompanyId();
    if (!companyId || this.companyBrandingSaving()) {
      return;
    }

    this.companyBrandingSaving.set(true);
    this.companyBrandingError.set('');

    const trimmedSlug = this.editBrandingSlug.trim().toLowerCase();
    const currentSlug = this.activeCompanySnapshot()?.slug ?? '';
    const slugChanged = trimmedSlug !== '' && trimmedSlug !== currentSlug;

    const saveBranding = () => {
      const pendingLogo = this.companyBrandingPendingLogoDataUrl();
      const pendingBackgroundImage = this.companyBrandingPendingBackgroundImageUrl();
      const nextBranding: PlatformBrandingSettings = {
        themeId: this.editBrandingThemeId,
        companyLogoDataUrl: pendingLogo !== undefined ? pendingLogo : this.companyBranding()?.companyLogoDataUrl ?? null,
        backgroundImageUrl: pendingBackgroundImage !== undefined ? pendingBackgroundImage : this.companyBranding()?.backgroundImageUrl ?? null,
      };

      this.backend.updateCompanyBranding(companyId, nextBranding)
        .pipe(finalize(() => this.companyBrandingSaving.set(false)))
        .subscribe({
          next: () => {
            this.closePanel();
            this.loadAll();
          },
          error: (error) => {
            this.companyBrandingError.set(error?.error?.message || 'Could not save this branding.');
          },
        });
    };

    if (slugChanged) {
      this.backend.updateCompanySlug(companyId, trimmedSlug).subscribe({
        next: saveBranding,
        error: (error) => {
          this.companyBrandingSaving.set(false);
          this.companyBrandingError.set(error?.error?.message || 'Could not save this login URL.');
        },
      });
    } else {
      saveBranding();
    }
  }

  // Only stages a preview — nothing is sent to the server until "Save theme" is clicked (see
  // saveTheme below). Re-picking the currently-saved value clears the pending state entirely
  // rather than leaving a pointless "Not saved yet" chip for a no-op change.
  onPlatformThemeSelected(event: Event) {
    const themeId = (event.target as HTMLSelectElement).value as LmsBrandThemeId;
    const current = this.platformBranding();
    if (!current || current.themeId === themeId) {
      this.pendingThemeId.set(null);
      return;
    }

    this.pendingThemeId.set(themeId);
  }

  cancelPendingTheme() {
    this.pendingThemeId.set(null);
  }

  saveTheme() {
    const current = this.platformBranding();
    const pending = this.pendingThemeId();
    if (!current || pending === null) {
      return;
    }

    this.savePlatformBranding(
      { ...current, themeId: pending },
      'Theme updated — every company\'s login screen now shows it.',
      () => this.pendingThemeId.set(null),
    );
  }

  // Opens the crop modal rather than staging the raw file directly — applyCrop() below is what
  // actually sets pendingLogoDataUrl, once the admin has picked the region they want.
  onPlatformLogoSelected(event: Event) {
    this.cropTarget = 'platform';
    this.openCropModalForFile(event, (message) => this.platformBrandingError.set(message));
  }

  // Same flow, for the per-company edit-branding panel — see cropTarget/applyCrop.
  onCompanyBrandingLogoSelected(event: Event) {
    this.cropTarget = 'company';
    this.openCropModalForFile(event, (message) => this.companyBrandingError.set(message));
  }

  private openCropModalForFile(event: Event, onError: (message: string) => void) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    if (input) {
      input.value = '';
    }

    onError('');

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        onError('Could not read the selected file.');
        return;
      }

      this.cropImageElement = null;
      this.cropNaturalSize.set(null);
      this.cropZoom.set(1);
      this.cropOffsetX.set(0);
      this.cropOffsetY.set(0);
      this.cropImageSrc.set(dataUrl);
      this.cropModalOpen.set(true);
    };
    reader.onerror = () => {
      onError('Could not read the selected file.');
    };
    reader.readAsDataURL(file);
  }

  onCropImageLoad(imageEl: HTMLImageElement) {
    this.cropImageElement = imageEl;
    this.cropNaturalSize.set({ width: imageEl.naturalWidth, height: imageEl.naturalHeight });
    // Starts filling the frame at no extra zoom, centered — clampCropOffsets is a no-op here
    // since offsets are already (0, 0), but keeps this the single source of truth for the rule.
    this.cropZoom.set(1);
    this.cropOffsetX.set(0);
    this.cropOffsetY.set(0);
  }

  onCropZoomChange(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    this.cropZoom.set(Number.isFinite(value) ? value : 1);
    this.clampCropOffsets();
  }

  onCropPointerDown(event: PointerEvent) {
    if (!this.cropNaturalSize()) {
      return;
    }

    this.cropDragging = true;
    this.cropDragPointerId = event.pointerId;
    this.cropDragStartClientX = event.clientX;
    this.cropDragStartClientY = event.clientY;
    this.cropDragStartOffsetX = this.cropOffsetX();
    this.cropDragStartOffsetY = this.cropOffsetY();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  onCropPointerMove(event: PointerEvent) {
    if (!this.cropDragging || event.pointerId !== this.cropDragPointerId) {
      return;
    }

    this.cropOffsetX.set(this.cropDragStartOffsetX + (event.clientX - this.cropDragStartClientX));
    this.cropOffsetY.set(this.cropDragStartOffsetY + (event.clientY - this.cropDragStartClientY));
    this.clampCropOffsets();
  }

  onCropPointerUp(event: PointerEvent) {
    if (event.pointerId !== this.cropDragPointerId) {
      return;
    }

    this.cropDragging = false;
    this.cropDragPointerId = null;
  }

  // Keeps the image covering the whole viewport at all times — without this, panning or zooming
  // out could leave a gap (transparent/empty edge) inside the crop frame instead of image content.
  private clampCropOffsets() {
    const { width, height } = this.cropDisplaySize();
    const maxOffsetX = Math.max(0, (width - this.cropViewportSize) / 2);
    const maxOffsetY = Math.max(0, (height - this.cropViewportSize) / 2);
    this.cropOffsetX.set(Math.min(maxOffsetX, Math.max(-maxOffsetX, this.cropOffsetX())));
    this.cropOffsetY.set(Math.min(maxOffsetY, Math.max(-maxOffsetY, this.cropOffsetY())));
  }

  cancelCrop() {
    this.cropModalOpen.set(false);
    this.cropImageSrc.set(null);
    this.cropImageElement = null;
    this.cropNaturalSize.set(null);
  }

  // Renders exactly the region currently visible inside the circular crop frame onto a fixed-size
  // canvas — the same left/top/scale math cropImageStyle used to position the <img> on screen,
  // solved in reverse to find which source-image rectangle that frame is currently showing.
  applyCrop() {
    const image = this.cropImageElement;
    const size = this.cropNaturalSize();
    if (!image || !size) {
      return;
    }

    const scale = this.cropBaseScale() * this.cropZoom();
    const { width, height } = this.cropDisplaySize();
    const left = (this.cropViewportSize - width) / 2 + this.cropOffsetX();
    const top = (this.cropViewportSize - height) / 2 + this.cropOffsetY();

    const sourceX = -left / scale;
    const sourceY = -top / scale;
    const sourceSize = this.cropViewportSize / scale;

    const canvas = document.createElement('canvas');
    canvas.width = this.cropOutputSize;
    canvas.height = this.cropOutputSize;
    const context = canvas.getContext('2d');
    if (!context) {
      const setError = this.cropTarget === 'company' ? this.companyBrandingError : this.platformBrandingError;
      setError.set('Could not crop this image. Please try again.');
      return;
    }

    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, this.cropOutputSize, this.cropOutputSize);
    const croppedDataUrl = canvas.toDataURL('image/png');
    if (this.cropTarget === 'company') {
      this.companyBrandingPendingLogoDataUrl.set(croppedDataUrl);
    } else {
      this.pendingLogoDataUrl.set(croppedDataUrl);
    }
    this.cancelCrop();
  }

  cancelPendingLogo() {
    this.pendingLogoDataUrl.set(null);
    this.platformBrandingError.set('');
  }

  saveLogo() {
    const current = this.platformBranding();
    const pending = this.pendingLogoDataUrl();
    if (!current || pending === null) {
      return;
    }

    this.platformBrandingLogoUploading.set(true);
    this.savePlatformBranding(
      { ...current, companyLogoDataUrl: pending },
      'Logo saved — every company\'s login screen now shows it.',
      () => {
        this.platformBrandingLogoUploading.set(false);
        this.pendingLogoDataUrl.set(null);
      },
    );
  }

  removePlatformLogo() {
    const current = this.platformBranding();
    if (!current || !current.companyLogoDataUrl) {
      return;
    }

    this.savePlatformBranding({ ...current, companyLogoDataUrl: null }, 'Logo removed.');
  }

  // No crop modal for this one (see pendingBackgroundImageUrl's own comment) — uploads
  // immediately on selection, straight to Storage, and stages the returned URL as pending until
  // "Save background" is clicked.
  onPlatformBackgroundImageSelected(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (input) {
      input.value = '';
    }

    if (!file || this.platformBrandingBackgroundUploading()) {
      return;
    }

    this.platformBrandingError.set('');
    this.platformBrandingBackgroundUploading.set(true);
    this.backend.uploadBrandingImage(file)
      .pipe(finalize(() => this.platformBrandingBackgroundUploading.set(false)))
      .subscribe({
        next: (result) => this.pendingBackgroundImageUrl.set(result.url),
        error: () => this.platformBrandingError.set(`Could not upload "${file.name}". Please check your connection and try again.`),
      });
  }

  cancelPendingBackgroundImage() {
    this.pendingBackgroundImageUrl.set(null);
    this.platformBrandingError.set('');
  }

  saveBackgroundImage() {
    const current = this.platformBranding();
    const pending = this.pendingBackgroundImageUrl();
    if (!current || pending === null) {
      return;
    }

    this.savePlatformBranding(
      { ...current, backgroundImageUrl: pending },
      'Background image saved — every company\'s login screen now shows it.',
      () => this.pendingBackgroundImageUrl.set(null),
    );
  }

  removePlatformBackgroundImage() {
    const current = this.platformBranding();
    if (!current || !current.backgroundImageUrl) {
      return;
    }

    this.savePlatformBranding({ ...current, backgroundImageUrl: null }, 'Background image removed.');
  }

  private showPlatformBrandingToast(message: string) {
    if (this.platformBrandingToastTimer) {
      clearTimeout(this.platformBrandingToastTimer);
    }
    this.platformBrandingToast.set(message);
    this.platformBrandingToastTimer = setTimeout(() => {
      this.platformBrandingToast.set(null);
      this.platformBrandingToastTimer = null;
    }, 4000);
  }

  dismissPlatformBrandingToast() {
    if (this.platformBrandingToastTimer) {
      clearTimeout(this.platformBrandingToastTimer);
      this.platformBrandingToastTimer = null;
    }
    this.platformBrandingToast.set(null);
  }

  // Shared by every edit above — optimistic update with rollback on failure, same pattern
  // LmsBrandingService uses for a company's own branding. onSettled (only the logo save passes
  // one) always fires once the save resolves either way, so the "Uploading…" state can't get
  // stuck if the PUT fails.
  private savePlatformBranding(next: PlatformBrandingSettings, successMessage: string, onSettled?: () => void) {
    const previous = this.platformBranding();
    this.platformBranding.set(next);
    this.platformBrandingSaving.set(true);
    this.platformBrandingError.set('');

    this.backend.updateBranding(next)
      .pipe(finalize(() => {
        this.platformBrandingSaving.set(false);
        onSettled?.();
      }))
      .subscribe({
        next: () => this.showPlatformBrandingToast(successMessage),
        error: () => {
          this.platformBranding.set(previous);
          this.platformBrandingError.set('Could not save the login page branding. Please try again.');
        },
      });
  }

  closePanel() {
    this.activePanel.set('none');
    this.activeCompanyId.set(null);
    this.activeCompanySnapshot.set(null);
  }

  logout() {
    clearPlatformAuthSession();
    void this.router.navigate(['/super-admin']);
  }
}
