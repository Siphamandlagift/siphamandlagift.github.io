import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { fromEvent, interval, Subscription } from 'rxjs';
import { clearLmsAuthSession, hasRequiredSessionFields, isLmsSessionExpired, readLmsSessionRecord, refreshLmsSessionActivity } from './session-auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly router = inject(Router);
  private readonly subscriptions = new Subscription();
  private lastActivityWriteAt = 0;

  protected readonly title = signal('lms-app');

  ngOnInit() {
    const activityEvents: ReadonlyArray<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'touchstart',
      'wheel',
      'scroll',
      'mousedown',
    ];

    for (const eventName of activityEvents) {
      this.subscriptions.add(
        fromEvent(window, eventName).subscribe(() => this.recordUserActivity()),
      );
    }

    this.subscriptions.add(
      interval(15000).subscribe(() => this.enforceSessionTimeout()),
    );

    this.subscriptions.add(
      fromEvent<StorageEvent>(window, 'storage').subscribe((event) => this.handleCrossTabSessionChange(event)),
    );

    this.enforceSessionTimeout();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private recordUserActivity() {
    const now = Date.now();
    // Avoid writing localStorage on every event while still extending active sessions.
    if (now - this.lastActivityWriteAt < 30000) {
      return;
    }

    this.lastActivityWriteAt = now;
    const refreshed = refreshLmsSessionActivity(now);

    if (!refreshed) {
      this.enforceSessionTimeout();
    }
  }

  // TrainingManagerDataService/StudentDataService are root singletons that stay resident in
  // memory across client-side route navigation — correct within one tab's own session, but they
  // never anticipated a DIFFERENT tab overwriting the shared lms-token (login, switch-role, or
  // logout all do, in-place, in whichever tab the user acts in). If this tab is sitting on a
  // dashboard when another tab does that, this tab's own per-request companyId staleness guards
  // never catch it — they compare against the now-ALREADY-overwritten shared token, which reads
  // as "unchanged" to them — so a background poll in THIS tab can go on to merge the new
  // session's server data with this tab's still-resident previous-company records (see
  // mergeServerAuthoritative in training-manager-data.service.ts, and its own header comment for
  // the prior incident this exact shape caused). The storage event only ever fires in a tab that
  // did NOT make the write, so this can never fire for this tab's own login/switch-role/logout —
  // only when some OTHER tab changed who's signed in. A full reload is deliberate, not a
  // shortcut: it's the one response that's actually guaranteed to clear every in-memory singleton
  // rather than relying on each one to have its own correct reset logic.
  private handleCrossTabSessionChange(event: StorageEvent) {
    if (event.key !== 'lms-token') {
      return;
    }

    window.location.reload();
  }

  private enforceSessionTimeout() {
    const session = readLmsSessionRecord();
    if (!hasRequiredSessionFields(session)) {
      return;
    }

    if (!isLmsSessionExpired(session)) {
      return;
    }

    clearLmsAuthSession();

    if (this.router.url !== '/') {
      void this.router.navigate(['/']);
    }
  }
}
