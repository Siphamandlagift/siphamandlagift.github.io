import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type LogoutDialogStage = 'confirm' | 'success';

// Shared by student-profile/admin-profile/training-manager-profile.component.ts's logout()
// flows: replaces the plain window.confirm('Are you sure you want to log out?') the student
// profile used (and the manager/admin profiles' complete lack of any confirmation at all) with
// one small reusable dialog that also shows a brief "logged out successfully" state before
// navigating away — a plain window.confirm can't do that (it's gone the instant the user
// answers it, and it isn't stylable at all).
@Component({
  selector: 'logout-confirm-dialog',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div class="logout-dialog-backdrop" (click)="onBackdropClick()">
        <div
          class="logout-dialog-card"
          role="alertdialog"
          aria-modal="true"
          [attr.aria-label]="stage === 'confirm' ? 'Confirm log out' : 'Logged out'"
          (click)="$event.stopPropagation()">
          @if (stage === 'confirm') {
            <div class="logout-dialog-icon" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M16 17l5-5-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h2 class="logout-dialog-title">Log out?</h2>
            <p class="logout-dialog-copy">You'll need to sign in again to get back to your account.</p>
            <div class="logout-dialog-actions">
              <button type="button" class="logout-dialog-btn logout-dialog-btn-secondary" (click)="cancelled.emit()">Cancel</button>
              <button type="button" class="logout-dialog-btn logout-dialog-btn-primary" (click)="confirmed.emit()">Log out</button>
            </div>
          } @else {
            <div class="logout-dialog-icon logout-dialog-icon-success" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h2 class="logout-dialog-title">Logged out successfully</h2>
            <p class="logout-dialog-copy">See you again soon.</p>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }

    .logout-dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(2px);
      animation: logoutDialogFadeIn 0.15s ease;
    }

    .logout-dialog-card {
      width: min(100%, 22rem);
      display: grid;
      justify-items: center;
      gap: 0.6rem;
      padding: 1.75rem 1.5rem 1.5rem;
      border-radius: 20px;
      background: #ffffff;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
      text-align: center;
      animation: logoutDialogPopIn 0.18s ease;
    }

    .logout-dialog-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      border-radius: 999px;
      background: rgba(99, 102, 241, 0.12);
      color: #4f46e5;
      margin-bottom: 0.2rem;
    }

    .logout-dialog-icon-success {
      background: rgba(34, 197, 94, 0.14);
      color: #16a34a;
    }

    .logout-dialog-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 800;
      color: #0f172a;
    }

    .logout-dialog-copy {
      margin: 0;
      color: #64748b;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .logout-dialog-actions {
      display: flex;
      gap: 0.6rem;
      width: 100%;
      margin-top: 0.5rem;
    }

    .logout-dialog-btn {
      flex: 1;
      border: 1px solid transparent;
      border-radius: 12px;
      padding: 0.65rem 1rem;
      font: inherit;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }

    .logout-dialog-btn-secondary {
      background: #f1f5f9;
      color: #334155;
    }

    .logout-dialog-btn-secondary:hover,
    .logout-dialog-btn-secondary:focus-visible {
      background: #e2e8f0;
      outline: none;
    }

    .logout-dialog-btn-primary {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: #fff;
    }

    .logout-dialog-btn-primary:hover,
    .logout-dialog-btn-primary:focus-visible {
      transform: translateY(-1px);
      box-shadow: 0 8px 18px rgba(220, 38, 38, 0.28);
      outline: none;
    }

    @keyframes logoutDialogFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes logoutDialogPopIn {
      from { opacity: 0; transform: scale(0.94) translateY(6px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
  `],
})
export class LogoutConfirmDialogComponent {
  @Input() open = false;
  @Input() stage: LogoutDialogStage = 'confirm';
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  onBackdropClick() {
    // Only the confirm stage is dismissable by clicking outside — once logout has actually been
    // confirmed and the success state is showing, the caller is about to navigate away on its own
    // short timer regardless, so there's nothing meaningful to cancel.
    if (this.stage === 'confirm') {
      this.cancelled.emit();
    }
  }
}
