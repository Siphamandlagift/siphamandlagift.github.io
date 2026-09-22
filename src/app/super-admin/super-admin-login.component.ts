import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { PlatformBackendService } from './platform-backend.service';
import { createPlatformSessionRecord, persistPlatformSession } from './platform-session-auth';

@Component({
  selector: 'app-super-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

        <form (ngSubmit)="onSubmit()">
          <label>
            <span>Email</span>
            <input type="email" name="email" [(ngModel)]="email" autocomplete="username" required />
          </label>

          <label>
            <span>Password</span>
            <input type="password" name="password" [(ngModel)]="password" autocomplete="current-password" required />
          </label>

          @if (errorMessage()) {
            <div class="error">{{ errorMessage() }}</div>
          }

          <button type="submit" [disabled]="signingIn()">
            {{ signingIn() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <button type="button" class="forgot-link" (click)="openForgotPassword()">Forgot password?</button>
      </div>
    </div>

    @if (forgotPasswordOpen()) {
      <div class="dialog-backdrop" (click)="closeForgotPassword()"></div>
      <div class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title">
        <div class="dialog-header">
          <h2 id="forgot-password-title">Reset your password</h2>
          <button type="button" class="icon-btn" (click)="closeForgotPassword()" aria-label="Close">✕</button>
        </div>

        @if (forgotPasswordSubmitted()) {
          <p class="dialog-message">{{ forgotPasswordMessage() }}</p>
          <button type="button" (click)="closeForgotPassword()">Close</button>
        } @else {
          <form (ngSubmit)="submitForgotPassword()">
            <label>
              <span>Email</span>
              <input type="email" name="forgotPasswordEmail" [(ngModel)]="forgotPasswordEmail" autocomplete="username" required />
            </label>

            @if (forgotPasswordError()) {
              <div class="error">{{ forgotPasswordError() }}</div>
            }

            <button type="submit" [disabled]="sendingReset()">
              {{ sendingReset() ? 'Sending…' : 'Send reset link' }}
            </button>
          </form>
        }
      </div>
    }
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
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      margin-bottom: 1.75rem;
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

    .forgot-link {
      display: block;
      margin: 1rem auto 0;
      background: none;
      border: none;
      color: #334155;
      font-size: 0.82rem;
      font-weight: 700;
      text-decoration: underline;
      cursor: pointer;
      padding: 0;
    }

    .dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(2, 6, 23, 0.55);
      z-index: 10;
    }

    .dialog-card {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: calc(100% - 2rem);
      max-width: 24rem;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 30px 60px rgba(2, 6, 23, 0.45);
      padding: 1.5rem;
      box-sizing: border-box;
      z-index: 11;
      display: grid;
      gap: 1rem;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 800;
      color: #0f172a;
    }

    .icon-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      color: #64748b;
      padding: 0.2rem;
    }

    .dialog-message {
      margin: 0;
      color: #334155;
      font-size: 0.88rem;
      line-height: 1.5;
    }
  `],
})
export class SuperAdminLoginComponent {
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly backend = inject(PlatformBackendService);

  email = '';
  password = '';
  readonly signingIn = signal(false);
  readonly errorMessage = signal('');

  onSubmit() {
    if (this.signingIn()) {
      return;
    }

    this.errorMessage.set('');
    this.signingIn.set(true);

    this.backend.login({ email: this.email.trim(), password: this.password })
      .pipe(finalize(() => {
        this.signingIn.set(false);
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (response) => {
          persistPlatformSession(
            createPlatformSessionRecord({ adminId: response.adminId, name: response.name, email: response.email }),
            response.token,
          );
          void this.router.navigate(['/super-admin/dashboard']);
        },
        error: (error) => {
          this.errorMessage.set(error?.status === 401
            ? 'Invalid login. Check your email and password.'
            : 'Login is unavailable right now. Please try again.');
        },
      });
  }

  readonly forgotPasswordOpen = signal(false);
  readonly sendingReset = signal(false);
  readonly forgotPasswordSubmitted = signal(false);
  readonly forgotPasswordError = signal('');
  readonly forgotPasswordMessage = signal('');
  forgotPasswordEmail = '';

  openForgotPassword() {
    this.forgotPasswordEmail = '';
    this.forgotPasswordError.set('');
    this.forgotPasswordMessage.set('');
    this.forgotPasswordSubmitted.set(false);
    this.forgotPasswordOpen.set(true);
  }

  closeForgotPassword() {
    this.forgotPasswordOpen.set(false);
  }

  submitForgotPassword() {
    const email = this.forgotPasswordEmail.trim().toLowerCase();

    this.forgotPasswordError.set('');

    if (!email) {
      this.forgotPasswordError.set('Enter the email address linked to your Super Admin account.');
      return;
    }

    if (this.sendingReset()) {
      return;
    }

    this.sendingReset.set(true);
    this.backend.requestPasswordReset({ email })
      .pipe(finalize(() => {
        this.sendingReset.set(false);
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (response) => {
          this.forgotPasswordSubmitted.set(true);
          this.forgotPasswordMessage.set(response.message);
        },
        error: (error) => {
          this.forgotPasswordError.set(error?.error?.message || 'The reset email could not be sent right now.');
        },
      });
  }
}
