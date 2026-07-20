import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { LmsBackendService, ResolveRolesEntry } from '../lms-backend.service';
import { LmsBrandingService } from '../lms-branding.service';
import { createLmsSessionRecord } from '../session-auth';

type LoginRole = 'administrator' | 'training-manager' | 'student';

type LoginDialog = 'forgot-password' | 'contact-admin' | null;

type LoginStep = 'credentials' | 'pick-role';

type SsoLoginPayload = {
  role: LoginRole;
  route: string;
  username: string;
  email: string;
  studentId?: string;
  token: string;
};

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
export class Login implements OnInit {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly backend = inject(LmsBackendService);
  readonly branding = inject(LmsBrandingService);
  readonly adminEmail = 'admin@skillsconnect.app';
  readonly supportEmail = 'help@skillsconnect.app';
  readonly roleLabels: Record<LoginRole, string> = {
    'administrator': 'Administrator',
    'training-manager': 'Training Manager',
    'student': 'Student',
  };

  loginStep: LoginStep = 'credentials';
  resolvedRoles: ResolveRolesEntry[] = [];

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
  showPassword = false;
  readonly shaking = signal(false);

  ngOnInit() {
    this.consumeSsoQueryParams();
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (this.signingIn) {
      return;
    }

    this.errorMessage = '';
    this.signingIn = true;
    this.backend.resolveRoles({
      username: this.username.trim(),
      password: this.password,
    })
      .pipe(finalize(() => (this.signingIn = false)))
      .subscribe({
        next: (response) => {
          if (response.roles.length === 1) {
            this.persistAuthenticatedSession(response.roles[0]);
            void this.router.navigate([response.roles[0].route]);
          } else {
            this.resolvedRoles = response.roles;
            this.loginStep = 'pick-role';
          }
        },
        error: (error) => {
          this.errorMessage = error?.status === 401
            ? 'Invalid login. Check your username and password.'
            : 'Login is unavailable right now. Please try again.';
          this.shaking.set(true);
          setTimeout(() => this.shaking.set(false), 600);
        },
      });
  }

  selectRole(entry: ResolveRolesEntry) {
    this.persistAuthenticatedSession(entry);
    void this.router.navigate([entry.route]);
  }

  backToCredentials() {
    this.loginStep = 'credentials';
    this.resolvedRoles = [];
    this.errorMessage = '';
  }

  startMicrosoftSso() {
    const url = this.backend.microsoftSsoStartUrl();
    window.location.assign(url);
  }

  roleLabel(role: LoginRole) {
    return this.roleLabels[role] ?? 'User';
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
      `Hello LMS Administrator,\n\nI need help with my LMS account.\n\nUsername: ${this.username.trim() || 'Not provided'}\n\nPlease assist.`,
    );
    return `mailto:${this.adminEmail}?subject=${subject}&body=${body}`;
  }

  private consumeSsoQueryParams() {
    const query = this.activatedRoute.snapshot.queryParamMap;
    const ssoPayloadEncoded = query.get('sso');
    const ssoError = query.get('ssoError');

    if (ssoPayloadEncoded) {
      const parsedPayload = this.parseSsoPayload(ssoPayloadEncoded);

      if (parsedPayload) {
        this.persistAuthenticatedSession(parsedPayload);
        void this.router.navigate([parsedPayload.route], { replaceUrl: true });
        return;
      }

      this.errorMessage = 'Single sign-on could not be completed. Please try again.';
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
      return;
    }

    if (ssoError) {
      this.errorMessage = ssoError;
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  private parseSsoPayload(encodedPayload: string): SsoLoginPayload | null {
    try {
      const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      const rawJson = atob(padded);
      const payload = JSON.parse(rawJson) as Partial<SsoLoginPayload>;

      if (
        (payload.role !== 'administrator' && payload.role !== 'training-manager' && payload.role !== 'student')
        || typeof payload.route !== 'string'
        || typeof payload.username !== 'string'
        || typeof payload.email !== 'string'
        || typeof payload.token !== 'string'
      ) {
        return null;
      }

      return {
        role: payload.role,
        route: payload.route,
        username: payload.username,
        email: payload.email,
        studentId: payload.studentId,
        token: payload.token,
      };
    } catch {
      return null;
    }
  }

  private persistAuthenticatedSession(payload: SsoLoginPayload | ResolveRolesEntry) {
    localStorage.setItem('lms-session', JSON.stringify(createLmsSessionRecord({
      role: payload.role,
      username: payload.username,
      email: payload.email,
      studentId: payload.studentId ?? null,
    })));
    localStorage.setItem('lms-token', payload.token);
  }
}
