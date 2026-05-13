import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import type { TenantDashboardResponse } from './models';
import { TenantApiService } from './tenant-api.service';
import { TenantAuthService } from './tenant-auth.service';

@Component({
  selector: 'app-tenant-dashboard',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tenant-dashboard-shell">
      <header class="tenant-dashboard-topbar">
        <div>
          <p class="tenant-dashboard-eyebrow">{{ currentUser()?.companyName || 'Tenant LMS' }}</p>
          <h1>{{ heading() }}</h1>
          <p>{{ subheading() }}</p>
        </div>

        <div class="tenant-dashboard-actions">
          <button type="button" class="tenant-dashboard-secondary" (click)="loadDashboard()">Refresh</button>
          <button type="button" class="tenant-dashboard-primary" (click)="logout()">Log out</button>
        </div>
      </header>

      @if (errorMessage(); as error) {
        <p class="tenant-dashboard-error" role="alert">{{ error }}</p>
      }

      @if (loading()) {
        <div class="tenant-dashboard-empty">Loading dashboard...</div>
      } @else if (dashboard(); as data) {
        <section class="tenant-metric-grid">
          @for (card of summaryCards(); track card.label) {
            <article class="tenant-metric-card">
              <span class="tenant-metric-label">{{ card.label }}</span>
              <strong class="tenant-metric-value">{{ card.value }}</strong>
              <span class="tenant-metric-copy">{{ card.copy }}</span>
            </article>
          }
        </section>

        @if (canCreateCourses() || canViewUsers()) {
          <section class="tenant-panel-grid">
            @if (canCreateCourses()) {
              <article class="tenant-panel">
                <div class="tenant-panel-heading">
                  <div>
                    <p class="tenant-panel-eyebrow">Admin</p>
                    <h2>Create course</h2>
                  </div>
                  <span>{{ data.user.licenseType | titlecase }} plan</span>
                </div>

                <form class="tenant-course-form" [formGroup]="courseForm" (ngSubmit)="createCourse()">
                  <label>
                    <span>Course Title</span>
                    <input type="text" formControlName="title" placeholder="Leadership Fundamentals" />
                  </label>

                  <button type="submit" class="tenant-dashboard-primary" [disabled]="courseForm.invalid || creatingCourse()">
                    {{ creatingCourse() ? 'Creating...' : 'Create course' }}
                  </button>
                </form>
              </article>
            }

            @if (canViewUsers()) {
              <article class="tenant-panel">
                <div class="tenant-panel-heading">
                  <div>
                    <p class="tenant-panel-eyebrow">{{ isAdmin() ? 'Admin' : 'Manager' }}</p>
                    <h2>Company users</h2>
                  </div>
                  <span>{{ data.users.length }} users</span>
                </div>

                <div class="tenant-list">
                  @for (user of data.users; track user.id) {
                    <div class="tenant-list-item">
                      <strong>{{ user.name }}</strong>
                      <span>{{ user.email }}</span>
                      <span class="tenant-role-pill">{{ user.role }}</span>
                    </div>
                  }
                </div>
              </article>
            }
          </section>
        }

        @if (canViewCompanyEnrollments()) {
          <section class="tenant-panel-grid tenant-panel-grid-single">
            <article class="tenant-panel">
              <div class="tenant-panel-heading">
                <div>
                  <p class="tenant-panel-eyebrow">{{ isAdmin() ? 'Admin' : 'Manager' }}</p>
                  <h2>Learner progress</h2>
                </div>
                <span>{{ data.enrollments.length }} enrollments</span>
              </div>

              <div class="tenant-table-wrap">
                <table class="tenant-table">
                  <thead>
                    <tr>
                      <th>Learner</th>
                      <th>Course</th>
                      <th>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (enrollment of data.enrollments; track enrollment.id) {
                      <tr>
                        <td>
                          <strong>{{ enrollment.learnerName }}</strong>
                          <div>{{ enrollment.learnerEmail }}</div>
                        </td>
                        <td>{{ enrollment.courseTitle }}</td>
                        <td>{{ enrollment.progress }}%</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        }

        @if (canViewOwnEnrollments()) {
          <section class="tenant-panel-grid tenant-panel-grid-single">
            <article class="tenant-panel">
              <div class="tenant-panel-heading">
                <div>
                  <p class="tenant-panel-eyebrow">Learner</p>
                  <h2>My enrolled courses</h2>
                </div>
                <span>{{ data.enrollments.length }} courses</span>
              </div>

              <div class="tenant-list">
                @for (enrollment of data.enrollments; track enrollment.id) {
                  <div class="tenant-course-progress-card">
                    <div class="tenant-course-progress-row">
                      <strong>{{ enrollment.courseTitle }}</strong>
                      <span>{{ enrollment.progress }}%</span>
                    </div>
                    <div class="tenant-progress-track" aria-hidden="true">
                      <span class="tenant-progress-fill" [style.width.%]="enrollment.progress"></span>
                    </div>
                    <label class="tenant-progress-update">
                      <span>Update progress</span>
                      <input
                        type="range"
                        min="0" max="100" step="5"
                        [value]="enrollment.progress"
                        [disabled]="updatingProgressFor() === enrollment.courseId"
                        (change)="setProgress(enrollment.courseId, +$any($event.target).value)" />
                    </label>
                    @if (updatingProgressFor() === enrollment.courseId) {
                      <span class="tenant-progress-saving">Saving…</span>
                    }
                  </div>
                }
              </div>
            </article>
          </section>
        }

        <section class="tenant-panel-grid tenant-panel-grid-single">
          <article class="tenant-panel">
            <div class="tenant-panel-heading">
              <div>
                <p class="tenant-panel-eyebrow">Company</p>
                <h2>Courses</h2>
              </div>
              <span>{{ data.courses.length }} total</span>
            </div>

            <div class="tenant-list">
              @for (course of data.courses; track course.id) {
                <div class="tenant-list-item tenant-list-item-course">
                  <strong>{{ course.title }}</strong>
                  <span>{{ course.enrollmentCount }} enrollment{{ course.enrollmentCount === 1 ? '' : 's' }}</span>
                  <span>{{ course.averageProgress }}% avg. progress</span>
                </div>
              }
            </div>
          </article>
        </section>
      } @else {
        <div class="tenant-dashboard-empty">No dashboard data is available.</div>
      }
    </section>
  `,
  styles: `
    .tenant-dashboard-shell {
      min-height: 100vh;
      padding: 1.5rem;
      background:
        radial-gradient(circle at top left, rgba(15, 118, 110, 0.12), transparent 25%),
        linear-gradient(180deg, #f8fbff 0%, #f8fafc 100%);
      display: grid;
      gap: 1.25rem;
      color: #173446;
    }

    .tenant-dashboard-topbar,
    .tenant-panel,
    .tenant-metric-card {
      box-sizing: border-box;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(148, 163, 184, 0.16);
      box-shadow: 0 18px 38px rgba(15, 23, 42, 0.08);
      backdrop-filter: blur(8px);
    }

    .tenant-dashboard-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.4rem 1.6rem;
      border-radius: 26px;
    }

    .tenant-dashboard-topbar h1,
    .tenant-panel-heading h2 {
      margin: 0;
    }

    .tenant-dashboard-topbar p {
      margin: 0.45rem 0 0;
      color: #475569;
    }

    .tenant-dashboard-eyebrow,
    .tenant-panel-eyebrow {
      margin: 0 0 0.35rem;
      color: #0f766e;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .tenant-dashboard-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .tenant-dashboard-primary,
    .tenant-dashboard-secondary {
      min-height: 2.9rem;
      padding: 0.75rem 1rem;
      border-radius: 16px;
      border: none;
      cursor: pointer;
      font: inherit;
      font-weight: 800;
    }

    .tenant-dashboard-primary {
      background: linear-gradient(135deg, #0f766e, #0284c7);
      color: #fff;
    }

    .tenant-dashboard-secondary {
      background: #e2e8f0;
      color: #173446;
    }

    .tenant-dashboard-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .tenant-metric-grid,
    .tenant-panel-grid {
      display: grid;
      gap: 1rem;
    }

    .tenant-metric-grid {
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    }

    .tenant-panel-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .tenant-panel-grid-single {
      grid-template-columns: 1fr;
    }

    .tenant-metric-card,
    .tenant-panel {
      border-radius: 24px;
      padding: 1.2rem;
    }

    .tenant-metric-card {
      display: grid;
      gap: 0.4rem;
    }

    .tenant-metric-label,
    .tenant-metric-copy,
    .tenant-panel-heading span,
    .tenant-list-item span,
    .tenant-table td div {
      color: #64748b;
    }

    .tenant-metric-value {
      font-size: 1.85rem;
    }

    .tenant-panel-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .tenant-list {
      display: grid;
      gap: 0.75rem;
    }

    .tenant-list-item,
    .tenant-course-progress-card {
      display: grid;
      gap: 0.3rem;
      padding: 0.95rem 1rem;
      border-radius: 18px;
      background: #fbfdff;
      border: 1px solid rgba(148, 163, 184, 0.14);
    }

    .tenant-list-item-course {
      grid-template-columns: minmax(0, 1.2fr) repeat(2, auto);
      align-items: center;
      gap: 0.75rem;
    }

    .tenant-role-pill {
      justify-self: start;
      display: inline-flex;
      align-items: center;
      padding: 0.35rem 0.65rem;
      border-radius: 999px;
      background: rgba(2, 132, 199, 0.12);
      color: #0369a1;
      font-size: 0.78rem;
      font-weight: 800;
      text-transform: capitalize;
    }

    .tenant-course-form {
      display: grid;
      gap: 0.9rem;
    }

    .tenant-course-form label {
      display: grid;
      gap: 0.45rem;
      font-weight: 700;
    }

    .tenant-course-form input {
      width: 100%;
      box-sizing: border-box;
      min-height: 3rem;
      padding: 0.8rem 0.95rem;
      border-radius: 16px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      font: inherit;
    }

    .tenant-table-wrap {
      overflow-x: auto;
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.14);
      background: #fbfdff;
    }

    .tenant-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 34rem;
    }

    .tenant-table th,
    .tenant-table td {
      padding: 0.85rem 0.95rem;
      text-align: left;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      vertical-align: top;
    }

    .tenant-table th {
      color: #64748b;
      font-size: 0.78rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .tenant-progress-track {
      width: 100%;
      height: 0.65rem;
      border-radius: 999px;
      background: #dbeafe;
      overflow: hidden;
    }

    .tenant-progress-fill {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(135deg, #0f766e, #0284c7);
    }

    .tenant-progress-update {
      display: grid;
      gap: 0.3rem;
      font-size: 0.8rem;
      color: #64748b;
      font-weight: 400;
      margin-top: 0.4rem;
    }

    .tenant-progress-update input[type='range'] {
      width: 100%;
      cursor: pointer;
      accent-color: #0f766e;
    }

    .tenant-progress-saving {
      font-size: 0.78rem;
      color: #0284c7;
    }

    .tenant-course-progress-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .tenant-dashboard-error,
    .tenant-dashboard-empty {
      margin: 0;
      padding: 1rem 1.1rem;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.18);
    }

    .tenant-dashboard-error {
      color: #b91c1c;
      background: rgba(254, 242, 242, 0.95);
    }

    @media (max-width: 900px) {
      .tenant-dashboard-topbar,
      .tenant-panel-heading,
      .tenant-list-item-course {
        grid-template-columns: 1fr;
      }

      .tenant-dashboard-topbar,
      .tenant-panel-heading {
        display: grid;
      }

      .tenant-panel-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class TenantDashboardComponent {
  private readonly api = inject(TenantApiService);
  private readonly auth = inject(TenantAuthService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly loading = signal(true);
  readonly creatingCourse = signal(false);
  readonly updatingProgressFor = signal<string | null>(null);
  readonly errorMessage = signal('');
  readonly dashboard = signal<TenantDashboardResponse | null>(null);
  readonly currentUser = this.auth.currentUser;
  readonly courseForm = this.formBuilder.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
  });
  readonly isAdmin = computed(() => this.currentUser()?.role === 'admin');
  readonly isManager = computed(() => this.currentUser()?.role === 'manager');
  readonly isLearner = computed(() => this.currentUser()?.role === 'learner');
  readonly canViewUsers = computed(() => this.auth.hasPermission('users:read'));
  readonly canCreateCourses = computed(() => this.auth.hasPermission('courses:create'));
  readonly canViewCompanyEnrollments = computed(() => this.auth.hasPermission('enrollments:company:read'));
  readonly canViewOwnEnrollments = computed(() => this.auth.hasPermission('enrollments:self:read'));
  readonly heading = computed(() => {
    if (this.isAdmin()) {
      return 'Administrator dashboard';
    }

    if (this.isManager()) {
      return 'Manager dashboard';
    }

    return 'Learner dashboard';
  });
  readonly subheading = computed(() => {
    if (this.isAdmin()) {
      return 'Manage tenant users, company courses, and platform activity in one place.';
    }

    if (this.isManager()) {
      return 'Track learner progress and company-wide course delivery for your tenant.';
    }

    return 'Review your enrolled courses and progress inside your company workspace.';
  });
  readonly summaryCards = computed(() => {
    const data = this.dashboard();

    if (!data) {
      return [] as Array<{ label: string; value: number; copy: string }>;
    }

    if (this.canViewOwnEnrollments()) {
      return [
        { label: 'My Courses', value: data.summary.myEnrollments, copy: 'Courses currently assigned to you.' },
        { label: 'Company Courses', value: data.summary.totalCourses, copy: 'Courses available in your tenant catalog.' },
        { label: 'Average Progress', value: data.summary.averageProgress, copy: 'Tenant-wide average completion progress.' },
      ];
    }

    return [
      { label: 'Users', value: data.summary.totalUsers, copy: 'Users inside this tenant.' },
      { label: 'Courses', value: data.summary.totalCourses, copy: 'Courses created for this tenant.' },
      { label: 'Enrollments', value: data.summary.totalEnrollments, copy: 'Course enrollments scoped to this tenant.' },
      { label: 'Average Progress', value: data.summary.averageProgress, copy: 'Average progress across all enrollments.' },
    ];
  });

  constructor() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.loading.set(true);
    this.errorMessage.set('');

    this.api.getDashboard()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (dashboard) => {
          this.dashboard.set(dashboard);
        },
        error: (error) => {
          this.errorMessage.set(error?.error?.message || 'Could not load the tenant dashboard.');
        },
      });
  }

  createCourse() {
    if (!this.canCreateCourses() || this.courseForm.invalid || this.creatingCourse()) {
      this.courseForm.markAllAsTouched();
      return;
    }

    this.creatingCourse.set(true);
    this.errorMessage.set('');

    this.api.createCourse(this.courseForm.controls.title.value)
      .pipe(finalize(() => this.creatingCourse.set(false)))
      .subscribe({
        next: () => {
          this.courseForm.reset({ title: '' });
          this.loadDashboard();
        },
        error: (error) => {
          this.errorMessage.set(error?.error?.message || 'Course creation failed.');
        },
      });
  }

  logout() {
    this.auth.logout();
  }

  setProgress(courseId: string, progress: number) {
    if (this.updatingProgressFor()) return;
    this.updatingProgressFor.set(courseId);
    this.errorMessage.set('');
    this.api.updateProgress(courseId, progress)
      .pipe(finalize(() => this.updatingProgressFor.set(null)))
      .subscribe({
        next: () => this.loadDashboard(),
        error: (error) => {
          this.errorMessage.set(error?.error?.message || 'Failed to update progress.');
        },
      });
  }
}