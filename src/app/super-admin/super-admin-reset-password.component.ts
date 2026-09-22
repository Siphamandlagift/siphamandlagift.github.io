import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { PlatformBackendService } from './platform-backend.service';

// Platform-level counterpart of src/app/reset-password/reset-password.ts — kept as its own
// component rather than shared with it, matching this codebase's convention of keeping every
// Super Admin client surface (login, dashboard, backend service) fully separate from the
// company-user one. Same loading/ready/invalid/success state machine, backed by
// PlatformBackendService instead of LmsBackendService.
@Component({
  selector: 'app-super-admin-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <div class="card">
        <div class="brand">
          <span class="brand-mark">SC</span>
          <div class="brand-copy">
            <h1>SkillsConnect</h1>
            <p>Super Admin</p>
          </div>
        </div>

        @if (state() === 'loading') {
          <p class="copy">Validating your reset link…</p>
        }

        @if (state() === 'ready') {
          <p class="copy">Choose a new password for {{ accountEmail() }}. This link expires at {{ expiresAt() }}.</p>

          <form (ngSubmit)="submit()" #resetForm="ngForm">
            <label>
              <span>New password</span>
              <input type="password" name="password" [(ngModel)]="password" required minlength="8" autocomplete="new-password" />
            </label>

            <label>
              <span>Confirm password</span>
              <input type="password" name="confirmPassword" [(ngModel)]="confirmPassword" required minlength="8" autocomplete="new-password" />
            </label>

            @if (errorMessage()) {
              <div class="error">{{ errorMessage() }}</div>
            }

            <button type="submit" [disabled]="!resetForm.form.valid || submitting()">
              {{ submitting() ? 'Updating…' : 'Update password' }}
            </button>
          </form>
        }

        @if (state() === 'invalid') {
          <div class="error">{{ errorMessage() }}</div>
          <a class="back-link" routerLink="/super-admin">Back to login</a>
        }

        @if (state() === 'success') {
          <div class="success">{{ successMessage() }}</div>
          <a class="back-link" routerLink="/super-admin">Return to login</a>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #0f172a 100%);
      font-family: 'Segoe UI', system-ui, sans-serif;
    }

    .shell {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }

    .card {
      width: 100%;
      max-width: 24rem;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 30px 60px rgba(2, 6, 23, 0.45);
      padding: 2.25rem 2rem;
      box-sizing: border-box;
      display: grid;
      gap: 1rem;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      margin-bottom: 0.5rem;
    }

    .brand-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 12px;
      background: linear-gradient(135deg, #0f172a, #334155);
      color: #fff;
      font-weight: 800;
      font-size: 0.95rem;
      letter-spacing: 0.02em;
      flex-shrink: 0;
    }

    .brand-copy h1 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 800;
      color: #0f172a;
    }

    .brand-copy p {
      margin: 0.1rem 0 0;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #64748b;
    }

    .copy {
      margin: 0;
      color: #334155;
      font-size: 0.88rem;
      line-height: 1.5;
    }

    form {
      display: grid;
      gap: 1rem;
    }

    label {
      display: grid;
      gap: 0.4rem;
      color: #334155;
      font-size: 0.82rem;
      font-weight: 700;
    }

    input {
      padding: 0.65rem 0.8rem;
      border: 1px solid rgba(100, 116, 139, 0.35);
      border-radius: 10px;
      font: inherit;
      color: #0f172a;
      box-sizing: border-box;
    }

    input:focus {
      outline: none;
      border-color: #334155;
      box-shadow: 0 0 0 3px rgba(51, 65, 85, 0.18);
    }

    button {
      margin-top: 0.3rem;
      padding: 0.75rem 1rem;
      border: none;
      border-radius: 10px;
      background: linear-gradient(135deg, #0f172a, #334155);
      color: #fff;
      font-weight: 800;
      font-size: 0.92rem;
      cursor: pointer;
    }

    button:disabled {
      opacity: 0.6;
      cursor: default;
    }

    .error {
      background: rgba(220, 38, 38, 0.08);
      border: 1px solid rgba(220, 38, 38, 0.25);
      color: #b91c1c;
      border-radius: 8px;
      padding: 0.6rem 0.75rem;
      font-size: 0.84rem;
    }

    .success {
      background: rgba(22, 163, 74, 0.08);
      border: 1px solid rgba(22, 163, 74, 0.25);
      color: #166534;
      border-radius: 8px;
      padding: 0.6rem 0.75rem;
      font-size: 0.84rem;
    }

    .back-link {
      color: #334155;
      font-size: 0.84rem;
      font-weight: 700;
    }
  `],
})
export class SuperAdminResetPasswordComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly backend = inject(PlatformBackendService);

  readonly state = signal<'loading' | 'ready' | 'invalid' | 'success'>('loading');
  readonly submitting = signal(false);
  readonly accountEmail = signal('');
  readonly expiresAt = signal('');
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly token = signal('');
  password = '';
  confirmPassword = '';

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';
    this.token.set(token);

    if (!token) {
      this.state.set('invalid');
      this.errorMessage.set('This password reset link is missing its token.');
      return;
    }

    this.backend.validatePasswordResetToken(token).subscribe({
      next: (status) => {
        if (!status.valid) {
          this.state.set('invalid');
          this.errorMessage.set('This password reset link is invalid or has expired.');
          return;
        }

        this.accountEmail.set(status.email ?? '');
        this.expiresAt.set(status.expiresAt ?? '');
        this.state.set('ready');
      },
      error: () => {
        this.state.set('invalid');
        this.errorMessage.set('The password reset link could not be verified right now.');
      },
    });
  }

  submit() {
    if (this.state() !== 'ready' || this.submitting()) {
      return;
    }

    const password = this.password.trim();
    const confirmPassword = this.confirmPassword.trim();
    this.errorMessage.set('');

    if (password.length < 8) {
      this.errorMessage.set('Choose a password with at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      this.errorMessage.set('The password and confirmation do not match.');
      return;
    }

    this.submitting.set(true);
    this.backend.confirmPasswordReset({ token: this.token(), password })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          this.successMessage.set(`Password updated for ${response.name}. You can return to login and sign in with your new password.`);
          this.state.set('success');
        },
        error: (error) => {
          this.errorMessage.set(error?.error?.message || 'The password could not be updated.');
        },
      });
  }
}
