import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { TenantAuthService } from './tenant-auth.service';

@Component({
  selector: 'app-tenant-login',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tenant-auth-shell">
      <div class="tenant-auth-card">
        <div class="tenant-auth-copy">
          <p class="tenant-auth-eyebrow">Multi-tenant LMS</p>
          <h1>Sign in</h1>
          <p>Use your tenant account to open the correct admin, manager, or learner dashboard.</p>
        </div>

        <form class="tenant-auth-form" [formGroup]="form" (ngSubmit)="submit()">
          <label>
            <span>Email</span>
            <input type="email" formControlName="email" placeholder="you@company.com" />
          </label>

          <label>
            <span>Password</span>
            <input type="password" formControlName="password" placeholder="Enter your password" />
          </label>

          @if (errorMessage(); as error) {
            <p class="tenant-auth-error" role="alert">{{ error }}</p>
          }

          <button type="submit" class="tenant-auth-submit" [disabled]="form.invalid || submitting()">
            {{ submitting() ? 'Signing in...' : 'Login' }}
          </button>
        </form>

        <p class="tenant-auth-footer">
          Need a new tenant?
          <a routerLink="/tenant/register">Register here</a>
        </p>
      </div>
    </section>
  `,
  styles: `
    .tenant-auth-shell {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 2rem 1rem;
      background:
        radial-gradient(circle at top left, rgba(15, 118, 110, 0.2), transparent 34%),
        radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.18), transparent 30%),
        linear-gradient(180deg, #f4fbff 0%, #f8fafc 100%);
    }

    .tenant-auth-card {
      width: min(100%, 30rem);
      display: grid;
      gap: 1.5rem;
      padding: 2rem;
      border-radius: 28px;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(148, 163, 184, 0.18);
      box-shadow: 0 24px 48px rgba(15, 23, 42, 0.12);
    }

    .tenant-auth-copy {
      display: grid;
      gap: 0.5rem;
      color: #173446;
    }

    .tenant-auth-copy h1 {
      margin: 0;
      font-size: clamp(2rem, 4vw, 2.6rem);
    }

    .tenant-auth-copy p,
    .tenant-auth-footer {
      margin: 0;
      color: #475569;
      line-height: 1.6;
    }

    .tenant-auth-eyebrow {
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #0f766e;
    }

    .tenant-auth-form {
      display: grid;
      gap: 1rem;
    }

    .tenant-auth-form label {
      display: grid;
      gap: 0.45rem;
      color: #173446;
      font-weight: 700;
    }

    .tenant-auth-form input {
      width: 100%;
      box-sizing: border-box;
      min-height: 3rem;
      padding: 0.8rem 0.95rem;
      border-radius: 16px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      background: #fff;
      font: inherit;
    }

    .tenant-auth-submit {
      min-height: 3.2rem;
      border: none;
      border-radius: 18px;
      background: linear-gradient(135deg, #0f766e, #0284c7);
      color: #fff;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }

    .tenant-auth-submit:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .tenant-auth-error {
      margin: 0;
      padding: 0.75rem 0.9rem;
      border-radius: 14px;
      background: rgba(239, 68, 68, 0.12);
      color: #b91c1c;
      font-weight: 700;
    }

    .tenant-auth-footer a {
      color: #0f766e;
      font-weight: 800;
    }
  `,
})
export class TenantLoginComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly auth = inject(TenantAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly submitting = signal(false);
  readonly errorMessage = signal('');
  readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit() {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');
    this.submitting.set(true);

    this.auth.login(this.form.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: ({ user }) => {
          const redirectUrl = this.route.snapshot.queryParamMap.get('redirect');
          void this.router.navigateByUrl(redirectUrl || this.auth.dashboardRouteForRole(user.role));
        },
        error: (error) => {
          this.errorMessage.set(error?.error?.message || 'Login failed. Check your credentials and try again.');
        },
      });
  }
}