import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { LmsBackendService } from '../lms-backend.service';

type LoginRole = 'administrator' | 'training-manager' | 'student';

type LoginRoleMeta = {
  hint: string;
};

type LoginDialog = 'forgot-password' | 'contact-admin' | null;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  host: {
    '(document:keydown.escape)': 'closeDialog()',
  },
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly router = inject(Router);
  private readonly backend = inject(LmsBackendService);
  readonly adminEmail = 'admin@skillsconnect.app';
  readonly supportEmail = 'help@skillsconnect.app';
  private readonly roleMeta: Record<LoginRole, LoginRoleMeta> = {
    administrator: {
      hint: 'Use admin/admin to open the administrator workspace.',
    },
    'training-manager': {
      hint: 'Use manager/manager to open the training manager workspace.',
    },
    student: {
      hint: 'Use student/student to open the student workspace.',
    },
  };

  readonly roleOptions: ReadonlyArray<{ value: LoginRole; label: string }> = [
    { value: 'administrator', label: 'Administrator' },
    { value: 'training-manager', label: 'Training Manager' },
    { value: 'student', label: 'Student' },
  ];

  selectedRole: LoginRole = 'training-manager';
  username = '';
  password = '';
  errorMessage = '';
  activeDialog: LoginDialog = null;
  forgotPasswordEmail = '';
  forgotPasswordError = '';
  forgotPasswordMessage = '';
  forgotPasswordSubmitted = false;
  signingIn = false;
  sendingReset = false;

  onSubmit() {
    if (this.signingIn) {
      return;
    }

    this.errorMessage = '';
    this.signingIn = true;
    this.backend.login({
      role: this.selectedRole,
      username: this.username.trim(),
      password: this.password,
    })
      .pipe(finalize(() => (this.signingIn = false)))
      .subscribe({
        next: (response) => {
          // Store session info for auth guard
          localStorage.setItem('lms-session', JSON.stringify({
            role: response.role,
            username: response.username,
            email: response.email,
            studentId: response.studentId ?? null,
          }));
          localStorage.setItem('lms-token', response.token);
          this.router.navigate([response.route]);
        },
        error: (error) => {
          this.errorMessage = error?.status === 401
            ? `Invalid ${this.roleLabel(this.selectedRole).toLowerCase()} login. Check your username and password.`
            : 'Login is unavailable right now. Please try again.';
        },
      });
  }

  roleHint() {
    return this.roleMeta[this.selectedRole].hint;
  }

  roleLabel(role: LoginRole) {
    return this.roleOptions.find((option) => option.value === role)?.label ?? 'User';
  }

  openForgotPassword(event: Event) {
    event.preventDefault();
    this.forgotPasswordEmail = '';
    this.forgotPasswordError = '';
    this.forgotPasswordMessage = '';
    this.forgotPasswordSubmitted = false;
    this.activeDialog = 'forgot-password';
  }

  openContactAdmin(event: Event) {
    event.preventDefault();
    this.activeDialog = 'contact-admin';
  }

  closeDialog() {
    this.activeDialog = null;
  }

  submitForgotPassword() {
    const email = this.forgotPasswordEmail.trim().toLowerCase();

    this.forgotPasswordError = '';
    this.forgotPasswordMessage = '';

    if (!email) {
      this.forgotPasswordError = 'Enter the email address linked to your account.';
      return;
    }

    if (this.sendingReset) {
      return;
    }

    this.sendingReset = true;
    this.backend.requestPasswordReset({ email })
      .pipe(finalize(() => (this.sendingReset = false)))
      .subscribe({
        next: (response) => {
          this.forgotPasswordSubmitted = true;
          this.forgotPasswordMessage = response.message;
        },
        error: (error) => {
          this.forgotPasswordError = error?.error?.message || 'The reset email could not be sent right now.';
        },
      });
  }

  contactAdminMailtoLink() {
    const subject = encodeURIComponent('LMS account support request');
    const body = encodeURIComponent(
      `Hello LMS Administrator,\n\nI need help with my LMS account.\n\nRole: ${this.roleLabel(this.selectedRole)}\nUsername: ${this.username.trim() || 'Not provided'}\n\nPlease assist.`,
    );
    return `mailto:${this.adminEmail}?subject=${subject}&body=${body}`;
  }
}
