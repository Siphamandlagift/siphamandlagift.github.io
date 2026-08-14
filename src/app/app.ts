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
