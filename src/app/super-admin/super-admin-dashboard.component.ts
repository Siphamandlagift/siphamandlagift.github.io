import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import {
  CompanyWithUsage,
  PlatformBackendService,
  PlatformUsageOverview,
  SubscriptionPlan,
  SubscriptionStatus,
} from './platform-backend.service';
import { clearPlatformAuthSession, readPlatformSessionRecord } from './platform-session-auth';

type ActivePanel = 'none' | 'create-company' | 'edit-subscription' | 'add-admin';

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
                    <span class="pill" [class]="statusPillClass(company.subscription.status)">{{ company.subscription.status }}</span>
                  </div>
                  <div class="company-cell company-cell-dates">
                    {{ company.subscription.startDate }} → {{ company.subscription.endDate }}
                  </div>
                  <div class="company-cell company-cell-actions">
                    <button type="button" class="inline-btn" (click)="openEditSubscription(company)">Edit subscription</button>
                    <button type="button" class="inline-btn" (click)="openAddAdmin(company)">+ Admin</button>
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

    @if (activePanel() === 'add-admin' && editingCompany(); as company) {
      <div class="overlay-panel" role="dialog" aria-modal="true">
        <div class="overlay-header">
          <h3>Add administrator — {{ company.name }}</h3>
          <button type="button" class="icon-btn" (click)="closePanel()" aria-label="Close">✕</button>
        </div>

        <form (ngSubmit)="submitAddAdmin()">
          <label>
            <span>Email</span>
            <input type="email" name="newAdminEmail" [(ngModel)]="newAdminEmail" required />
          </label>

          <label>
            <span>Temporary password</span>
            <input type="text" name="newAdminPassword" [(ngModel)]="newAdminPassword" required />
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
              {{ creatingAdmin() ? 'Creating…' : 'Create admin' }}
            </button>
          </div>
        </form>
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
export class SuperAdminDashboardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly backend = inject(PlatformBackendService);

  readonly adminName = signal(readPlatformSessionRecord()?.name ?? readPlatformSessionRecord()?.email ?? 'Super Admin');

  readonly companies = signal<CompanyWithUsage[]>([]);
  readonly usageOverview = signal<PlatformUsageOverview | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');

  readonly activePanel = signal<ActivePanel>('none');
  private readonly activeCompanyId = signal<string | null>(null);
  readonly editingCompany = computed(() => this.companies().find((company) => company.id === this.activeCompanyId()) ?? null);

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

  ngOnInit() {
    this.loadAll();
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

  statusPillClass(status: SubscriptionStatus) {
    return status === 'active' ? 'pill-active' : status === 'suspended' ? 'pill-suspended' : 'pill-cancelled';
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
          this.openAddAdmin(company as CompanyWithUsage);
        },
        error: (error) => {
          this.createCompanyError.set(error?.error?.message || 'Could not create this company.');
        },
      });
  }

  openEditSubscription(company: CompanyWithUsage) {
    this.activeCompanyId.set(company.id);
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

  openAddAdmin(company: CompanyWithUsage) {
    this.activeCompanyId.set(company.id);
    this.newAdminEmail = '';
    this.newAdminPassword = '';
    this.addAdminError.set('');
    this.addAdminSuccess.set('');
    this.activePanel.set('add-admin');
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
          this.loadAll();
        },
        error: (error) => {
          this.addAdminError.set(error?.error?.message || 'Could not create this administrator account.');
        },
      });
  }

  closePanel() {
    this.activePanel.set('none');
    this.activeCompanyId.set(null);
  }

  logout() {
    clearPlatformAuthSession();
    void this.router.navigate(['/super-admin']);
  }
}
