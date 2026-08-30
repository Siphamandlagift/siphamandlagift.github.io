import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudentDataService } from './student-data.service';

function relativeTimeLabel(createdAt?: string, fallback = 'Recently'): string {
  if (!createdAt) return fallback;
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`;
}

@Component({
  selector: 'student-dashboard',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dashboard-content">
      <header class="dashboard-header-row">
        <div class="dashboard-title-group">
          <p class="dashboard-kicker">Student Overview</p>
          <h1 class="dashboard-title">Welcome back, {{ studentData.displayName() }}!</h1>
          <p class="dashboard-subtitle">Here is your learning hub snapshot for today.</p>
        </div>
        <div class="dashboard-search">
          <div class="dashboard-search-wrap">
            <svg class="dashboard-search-icon" width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="#94a3b8" stroke-width="2" stroke-linecap="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z"/></svg>
            <input type="search" placeholder="Search courses, badges, updates..." class="dashboard-search-input"
              [value]="searchQuery()"
              (input)="searchQuery.set($any($event.target).value)"
              (keydown.escape)="searchQuery.set('')"
              aria-label="Search courses, badges, and notifications" />
          </div>
          <div *ngIf="searchQuery().trim() && searchResults() as results" class="search-dropdown" role="listbox">
            <div *ngIf="!results.total" class="search-no-results">No results for "{{ searchQuery() }}"</div>

            <ng-container *ngIf="results.courses.length">
              <div class="search-group-label">Courses</div>
              <button *ngFor="let course of results.courses" type="button" class="search-result-item"
                (click)="navigateTo.emit('courses'); searchQuery.set('')" role="option">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" fill="#fbbf24"/></svg>
                <span class="search-result-label">{{ course.name }}</span>
                <span class="search-result-meta">{{ course.completed ? 'Completed' : course.progress ? course.progress + '%' : 'In Progress' }}</span>
              </button>
            </ng-container>

            <ng-container *ngIf="results.badges.length">
              <div class="search-group-label">Badges</div>
              <button *ngFor="let badge of results.badges" type="button" class="search-result-item"
                (click)="navigateTo.emit('badges'); searchQuery.set('')" role="option">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 2l2.09 6.26L20 9.27l-5 3.64L16.18 20 12 16.77 7.82 20 9 12.91l-5-3.64 5.91-1.01z" fill="#a78bfa"/></svg>
                <span class="search-result-label">{{ badge.title }}</span>
                <span class="search-result-meta">{{ badge.earned ? 'Earned' : 'Locked' }}</span>
              </button>
            </ng-container>

            <ng-container *ngIf="results.notifications.length">
              <div class="search-group-label">Notifications</div>
              <button *ngFor="let notif of results.notifications" type="button" class="search-result-item"
                (click)="searchQuery.set('')" role="option">
                <span class="search-result-badge">{{ notif.badge }}</span>
                <span class="search-result-label">{{ notif.title }}</span>
                <span class="search-result-meta">{{ notif.dateLabel }}</span>
              </button>
            </ng-container>
          </div>
        </div>
      </header>

      <section class="dashboard-stats-row" aria-label="Key metrics">
        <article class="stat-card stat-courses">
          <div class="stat-icon">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" fill="#fbbf24"/><rect x="7" y="9" width="10" height="2" rx="1" fill="#fff"/></svg>
          </div>
          <div class="stat-label">Enrolled Courses</div>
          <div class="stat-value">{{ studentData.dashboardStats().enrolledCourses }}</div>
          <div class="stat-footnote">{{ studentData.dashboardStats().courseFootnote }}</div>
        </article>

        <article class="stat-card stat-hours">
          <div class="stat-icon">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#60a5fa"/><path d="M12 7v5l3 3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="stat-label">Total Hours Spent</div>
          <div class="stat-value">{{ studentData.dashboardStats().hoursEarned }}</div>
          <div class="stat-footnote">{{ studentData.dashboardStats().hoursFootnote }}</div>
        </article>

        <article class="stat-card stat-badges">
          <div class="stat-icon">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M12 2l2.09 6.26L20 9.27l-5 3.64L16.18 20 12 16.77 7.82 20 9 12.91l-5-3.64 5.91-1.01z" fill="#a78bfa"/></svg>
          </div>
          <div class="stat-label">Badges Earned</div>
          <div class="stat-value">{{ studentData.dashboardStats().badgesEarned }}</div>
          <div class="stat-footnote">{{ studentData.dashboardStats().badgesFootnote }}</div>
        </article>
      </section>

      <section class="dashboard-panels">
        <article class="dashboard-notifications">
          <div class="notifications-header-row">
            <div>
              <h2 class="notifications-title">Recent Notifications</h2>
              <p class="notifications-subtitle">Stay updated with the latest course activity and announcements.</p>
            </div>
            <button type="button" class="notifications-mark-all" (click)="studentData.markNotificationsRead()">Mark all as read</button>
          </div>

          <div class="notification-list">
            <div *ngIf="!unreadNotifications().length" class="notifications-empty">No new notifications.</div>
            <article *ngFor="let notification of unreadNotifications()" class="notification-card">
              <div class="notification-badge">{{ notification.badge }}</div>
              <div class="notification-title">{{ notification.title }}</div>
              <div class="notification-body">{{ notification.body }}</div>
              <div class="notification-date">{{ relativeTimeLabel(notification.createdAt, notification.dateLabel) }}</div>
            </article>
          </div>
        </article>

        <article class="dashboard-progress-panel">
          <h2 class="progress-panel-title">This Week</h2>
          <div class="progress-panel-card">
            <div class="progress-panel-label">Learning consistency</div>
            <div class="progress-track">
              <div class="progress-fill" [style.width.%]="studentData.dashboardStats().weeklyConsistency"></div>
            </div>
            <div class="progress-panel-meta">{{ studentData.consistencyLabel() }}</div>
          </div>
          <div class="progress-panel-card">
            <div class="progress-panel-label">Assignments due</div>
            <div class="progress-panel-value">{{ studentData.dashboardStats().upcomingTasks }}</div>
          </div>
        </article>

        <!-- Only ever an Active nomination — see StudentDataService.successionStatus / the
             server's computeSuccessionStatus. Nothing renders here for a Draft/Withdrawn/absent
             nomination, and the role's owner manager and incumbent are never included at all. -->
        <article class="dashboard-succession-panel" *ngIf="studentData.successionStatus() as status">
          <div class="succession-panel-header">
            <h2 class="succession-panel-title">My Succession Status</h2>
            <span class="succession-readiness-badge">{{ status.readinessRating }}</span>
          </div>
          <p class="succession-role-copy">You've been earmarked for <strong>{{ status.roleTitle }}</strong>.</p>

          <div *ngIf="status.competencyGaps.length" class="succession-gap-list">
            <div *ngFor="let gap of status.competencyGaps" class="succession-gap-card">
              <div class="succession-gap-title">{{ gap.competency }}</div>
              <ul class="succession-action-list">
                <li *ngFor="let action of gap.developmentActions" class="succession-action-item">
                  <span class="succession-action-status" [class.succession-action-done]="action.status === 'Completed'">{{ action.status }}</span>
                  <span class="succession-action-description">{{ action.description }}</span>
                </li>
              </ul>
            </div>
          </div>
        </article>
      </section>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      flex: 1;
    }

    .dashboard-content {
      width: 100%;
      min-height: 100%;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding: 1.75rem;
      box-sizing: border-box;
      font-family: 'Inter', 'Segoe UI', 'Roboto', Arial, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(99, 102, 241, 0.12), transparent 28%),
        linear-gradient(180deg, #f8faff 0%, #f3f6fb 100%);
      border-radius: 28px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
    }

    .dashboard-header-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1.25rem;
    }

    .dashboard-title-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .dashboard-kicker {
      margin: 0;
      color: #6366f1;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .dashboard-title {
      margin: 0;
      color: #14213d;
      font-size: clamp(2rem, 3vw, 2.6rem);
      font-weight: 800;
      line-height: 1.05;
    }

    .dashboard-subtitle {
      margin: 0;
      color: #64748b;
      font-size: 1rem;
      max-width: 42rem;
    }

    .dashboard-search {
      width: min(100%, 22rem);
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      position: relative;
    }

    .dashboard-search-wrap {
      position: relative;
      width: 100%;
      display: flex;
      align-items: center;
    }

    .dashboard-search-icon {
      position: absolute;
      left: 1rem;
      pointer-events: none;
      flex-shrink: 0;
    }

    .dashboard-search-input {
      width: 100%;
      border: 1px solid #dbe3ef;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.95);
      padding: 0.85rem 1.15rem 0.85rem 2.5rem;
      font-size: 0.98rem;
      color: #14213d;
      outline: none;
      box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      box-sizing: border-box;
    }

    .dashboard-search-input:focus {
      border-color: #818cf8;
      box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
    }

    .search-dropdown {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      width: 100%;
      min-width: 18rem;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 20px 48px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(99,102,241,0.08);
      z-index: 200;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .search-no-results {
      padding: 1rem 1.15rem;
      color: #94a3b8;
      font-size: 0.92rem;
      text-align: center;
    }

    .search-group-label {
      padding: 0.55rem 1rem 0.25rem;
      color: #6366f1;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }

    .search-result-item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      width: 100%;
      padding: 0.6rem 1rem;
      border: none;
      background: transparent;
      cursor: pointer;
      text-align: left;
      transition: background 0.1s ease;
    }

    .search-result-item:hover {
      background: #f1f5f9;
    }

    .search-result-label {
      flex: 1;
      color: #1e293b;
      font-size: 0.93rem;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .search-result-meta {
      color: #94a3b8;
      font-size: 0.82rem;
      white-space: nowrap;
    }

    .search-result-badge {
      font-size: 0.82rem;
      color: #2563eb;
      background: #dbeafe;
      border-radius: 999px;
      padding: 0.1rem 0.5rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .dashboard-stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
    }

    .stat-card {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      min-width: 0;
      padding: 1.35rem 1.4rem;
      background: rgba(255, 255, 255, 0.92);
      border-radius: 20px;
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.06);
      border-bottom: 3px solid transparent;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .stat-card:hover {
      transform: scale(1.03);
      box-shadow: 0 20px 40px rgba(15, 23, 42, 0.1);
    }

    .stat-courses {
      border-bottom-color: #fbbf24;
    }

    .stat-hours {
      border-bottom-color: #60a5fa;
    }

    .stat-badges {
      border-bottom-color: #a78bfa;
    }

    .stat-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 14px;
      background: #f8fafc;
    }

    .stat-label {
      color: #64748b;
      font-size: 0.98rem;
      font-weight: 600;
    }

    .stat-value {
      color: #14213d;
      font-size: 2rem;
      font-weight: 800;
      line-height: 1;
    }

    .stat-footnote {
      color: #8a96a8;
      font-size: 0.9rem;
    }

    .dashboard-panels {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(260px, 0.9fr);
      gap: 1.25rem;
      align-items: start;
    }

    .dashboard-notifications,
    .dashboard-progress-panel,
    .dashboard-succession-panel {
      background: rgba(255, 255, 255, 0.92);
      border-radius: 24px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
      padding: 1.5rem;
    }

    .dashboard-succession-panel {
      grid-column: 1 / -1;
      display: grid;
      gap: 0.9rem;
    }

    .succession-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .succession-panel-title {
      margin: 0;
      color: #14213d;
      font-size: 1.15rem;
      font-weight: 700;
    }

    .succession-readiness-badge {
      padding: 0.35rem 0.8rem;
      border-radius: 999px;
      background: rgba(99, 102, 241, 0.12);
      color: #4f46e5;
      font-size: 0.82rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .succession-role-copy {
      margin: 0;
      color: #475569;
      font-size: 0.96rem;
    }

    .succession-gap-list {
      display: grid;
      gap: 0.85rem;
    }

    .succession-gap-card {
      border-radius: 16px;
      background: #f8fafc;
      padding: 0.95rem 1.05rem;
      display: grid;
      gap: 0.5rem;
    }

    .succession-gap-title {
      color: #14213d;
      font-weight: 700;
      font-size: 0.94rem;
    }

    .succession-action-list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 0.45rem;
    }

    .succession-action-item {
      display: flex;
      align-items: baseline;
      gap: 0.55rem;
      font-size: 0.9rem;
      color: #475569;
    }

    .succession-action-status {
      flex-shrink: 0;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      background: #e2e8f0;
      color: #334155;
      font-size: 0.72rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .succession-action-status.succession-action-done {
      background: rgba(34, 197, 94, 0.16);
      color: #15803d;
    }

    .notifications-header-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .notifications-title,
    .progress-panel-title {
      margin: 0;
      color: #14213d;
      font-size: 1.15rem;
      font-weight: 700;
    }

    .notifications-subtitle {
      margin: 0.35rem 0 0;
      color: #64748b;
      font-size: 0.96rem;
    }

    .notifications-mark-all {
      border: none;
      background: transparent;
      color: #6366f1;
      font-size: 0.95rem;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      padding: 0;
    }

    .notification-list {
      display: grid;
      gap: 0.85rem;
    }

    .notification-card {
      display: grid;
      gap: 0.45rem;
      padding: 1.2rem 1.25rem;
      border-radius: 18px;
      background: #f8fafc;
      border-left: 4px solid #38bdf8;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .notification-card:hover {
      transform: scale(1.02);
      box-shadow: 0 16px 30px rgba(15, 23, 42, 0.08);
    }

    .notification-card-read {
      border-left-color: #cbd5e1;
      opacity: 0.8;
    }

    .notifications-empty {
      padding: 1.2rem 1.25rem;
      border-radius: 18px;
      background: #f8fafc;
      color: #94a3b8;
      font-size: 0.9rem;
      text-align: center;
    }

    .notification-badge {
      display: inline-flex;
      width: fit-content;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      background: #dbeafe;
      color: #2563eb;
      font-size: 0.8rem;
      font-weight: 700;
    }

    .notification-title {
      color: #14213d;
      font-size: 1rem;
      font-weight: 700;
    }

    .notification-body {
      color: #64748b;
      font-size: 0.96rem;
    }

    .notification-date {
      color: #94a3b8;
      font-size: 0.88rem;
    }

    .dashboard-progress-panel {
      display: grid;
      gap: 0.9rem;
    }

    .progress-panel-card {
      display: grid;
      gap: 0.55rem;
      padding: 1rem 1.05rem;
      border-radius: 18px;
      background: #f8fafc;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .progress-panel-card:hover {
      transform: scale(1.02);
      box-shadow: 0 16px 30px rgba(15, 23, 42, 0.08);
    }

    @media (prefers-reduced-motion: reduce) {
      .stat-card,
      .notification-card,
      .progress-panel-card {
        transition: none;
      }

      .stat-card:hover,
      .notification-card:hover,
      .progress-panel-card:hover {
        transform: none;
      }
    }

    .progress-panel-label {
      color: #475569;
      font-size: 0.95rem;
      font-weight: 600;
    }

    .progress-track {
      width: 100%;
      height: 0.55rem;
      border-radius: 999px;
      background: #e2e8f0;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #6366f1, #38bdf8);
    }

    .progress-panel-meta,
    .progress-panel-value {
      color: #64748b;
      font-size: 0.92rem;
    }

    @media (max-width: 960px) {
      .dashboard-panels {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .dashboard-content {
        padding: 1rem;
        border-radius: 22px;
      }

      .dashboard-header-row,
      .notifications-header-row {
        flex-direction: column;
      }

      .dashboard-search {
        width: 100%;
      }

      .dashboard-notifications,
      .dashboard-progress-panel,
      .stat-card {
        border-radius: 18px;
      }
    }
  `],
})
export class StudentDashboardComponent {
  readonly studentData = inject(StudentDataService);
  readonly navigateTo = output<string>();
  readonly searchQuery = signal('');

  readonly searchResults = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return null;
    const courses = this.studentData.courses().filter(
      (c) => c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q),
    ).slice(0, 4);
    const badges = this.studentData.badges().filter(
      (b) => b.title.toLowerCase().includes(q),
    ).slice(0, 4);
    const notifications = this.studentData.notifications().filter(
      (n) => !n.dismissed && (n.title.toLowerCase().includes(q) || (n.body ?? '').toLowerCase().includes(q)),
    ).slice(0, 4);
    return { courses, badges, notifications, total: courses.length + badges.length + notifications.length };
  });

  readonly unreadNotifications = computed(() =>
    this.studentData.notifications().filter((n) => n.unread && !n.dismissed),
  );
  readonly relativeTimeLabel = relativeTimeLabel;
}
