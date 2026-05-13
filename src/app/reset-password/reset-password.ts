import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { LmsBackendService } from '../lms-backend.service';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly backend = inject(LmsBackendService);

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
          this.successMessage.set(`Password updated for ${response.username}. You can return to login and sign in with your new password.`);
          this.state.set('success');
        },
        error: (error) => {
          this.errorMessage.set(error?.error?.message || 'The password could not be updated.');
        },
      });
  }
}