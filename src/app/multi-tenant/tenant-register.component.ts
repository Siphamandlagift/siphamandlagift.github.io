import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import type { TenantLicenseType } from './models';
import { TenantAuthService } from './tenant-auth.service';

@Component({
  selector: 'app-tenant-register',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tenant-auth-shell">
      <div class="tenant-auth-card tenant-auth-card-wide">
        <div class="tenant-auth-copy">
          <p class="tenant-auth-eyebrow">Tenant onboarding</p>
          <h1>Create a company workspace</h1>
          <p>Registration creates a new tenant and its initial administrator account.</p>
        </div>

        <form class="tenant-auth-form tenant-register-grid" [formGroup]="form" (ngSubmit)="submit()">
          <label>
            <span>Company Name</span>
            <input type="text" formControlName="companyName" placeholder="Acme Learning" />
          </label>

          <label>
            <span>License Type</span>
            <select formControlName="licenseType">
              @for (option of licenseOptions; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </label>

          <label>
            <span>Administrator Name</span>
            <input type="text" formControlName="name" placeholder="Jordan Smith" />
          </label>

          <label>
            <span>Email</span>
            <input type="email" formControlName="email" placeholder="admin@acme.com" />
          </label>

          <label class="tenant-register-span-two">
            <span>Password</span>
            <input type="password" formControlName="password" placeholder="At least 8 characters" />
          </label>

          @if (errorMessage(); as error) {
            <p class="tenant-auth-error tenant-register-span-two" role="alert">{{ error }}</p>
          }

          <button type="submit" class="tenant-auth-submit tenant-register-span-two" [disabled]="form.invalid || submitting()">
            {{ submitting() ? 'Creating workspace...' : 'Register tenant' }}
          </button>
        </form>

        <p class="tenant-auth-footer">
          Already have an account?
          <a routerLink="/tenant/login">Sign in</a>
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
        radial-gradient(circle at top right, rgba(2, 132, 199, 0.18), transparent 28%),
        radial-gradient(circle at bottom left, rgba(15, 118, 110, 0.18), transparent 26%),
        linear-gradient(180deg, #f4fbff 0%, #f8fafc 100%);
    }

    .tenant-auth-card {
      width: min(100%, 44rem);
      display: grid;
      gap: 1.5rem;
      padding: 2rem;
      border-radius: 28px;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(148, 163, 184, 0.18);
      box-shadow: 0 24px 48px rgba(15, 23, 42, 0.12);
    }

    .tenant-auth-card-wide {
      width: min(100%, 48rem);
    }

    .tenant-auth-copy {
      display: grid;
      gap: 0.5rem;
      color: #173446;
    }

    .tenant-auth-copy h1,
    .tenant-auth-copy p,
    .tenant-auth-footer {
      margin: 0;
    }

    .tenant-auth-copy h1 {
      font-size: clamp(2rem, 4vw, 2.8rem);
    }

    .tenant-auth-copy p,
    .tenant-auth-footer {
      color: #475569;
      line-height: 1.6;
    }

    .tenant-auth-eyebrow {
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #0284c7;
    }

    .tenant-auth-form {
      display: grid;
      gap: 1rem;
    }

    .tenant-register-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .tenant-register-span-two {
      grid-column: 1 / -1;
    }

    .tenant-auth-form label {
      display: grid;
      gap: 0.45rem;
      color: #173446;
      font-weight: 700;
    }

    .tenant-auth-form input,
    .tenant-auth-form select {
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
      color: #0284c7;
      font-weight: 800;
    }

    @media (max-width: 720px) {
      .tenant-register-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class TenantRegisterComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly auth = inject(TenantAuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly errorMessage = signal('');
  readonly licenseOptions: ReadonlyArray<{ value: TenantLicenseType; label: string }> = [
    { value: 'starter', label: 'Starter' },
    { value: 'growth', label: 'Growth' },
    { value: 'enterprise', label: 'Enterprise' },
  ];
  readonly form = this.formBuilder.group({
    companyName: ['', [Validators.required, Validators.minLength(2)]],
    licenseType: ['starter' as TenantLicenseType, [Validators.required]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit() {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');
    this.submitting.set(true);

    this.auth.register(this.form.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: ({ user }) => {
          void this.router.navigateByUrl(this.auth.dashboardRouteForRole(user.role));
        },
        error: (error) => {
          this.errorMessage.set(error?.error?.message || 'Tenant registration failed. Please try again.');
        },
      });
  }
}