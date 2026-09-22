import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { LmsBackendService, ResolveRolesEntry } from '../lms-backend.service';
import { LmsBrandingService } from '../lms-branding.service';
import { combineDisplayName, createLmsSessionRecord } from '../session-auth';

type LoginRole = 'administrator' | 'training-manager' | 'student';

type LoginDialog = 'forgot-password' | 'contact-admin' | null;

type LoginStep = 'credentials' | 'pick-role';

type SsoLoginPayload = {
  role: LoginRole;
  route: string;
  username: string;
  email: string;
  studentId?: string;
  name?: string;
  surname?: string;
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
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
    // Always show the login theme here — the one shared, Super-Admin-managed default, or (when
    // this company has its own login/:companySlug URL) that company's own branding — regardless of
    // whether this browser also happens to still have a valid session from a previous login
    // (LmsBrandingService's own constructor can't distinguish "fresh load of an authenticated
    // route" from "fresh load of the login route with a stale-but-valid session sitting around",
    // and guesses wrong for the latter). See LmsBrandingService.refreshForPublicScreen for the
    // full reasoning.
    //
    // Subscribes to paramMap rather than reading activatedRoute.snapshot once: '' and
    // 'login/:companySlug' are two distinct routeConfig entries, but two DIFFERENT slugs both
    // match the same 'login/:companySlug' entry — so a client-side navigation between two
    // already-visited company login URLs (e.g. browser back/forward, no full reload) reuses this
    // same component instance without re-running ngOnInit. A one-time snapshot read would leave
    // the FIRST company's branding on screen under the SECOND company's URL; this re-fetches on
    // every param change instead. (Login itself is unaffected either way — onSubmit() below never
    // depends on which company's branding is showing, only on the credentials typed in.)
    this.activatedRoute.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.branding.refreshForPublicScreen(params.get('companySlug') ?? undefined));
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
      .pipe(finalize(() => {
        this.signingIn = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (response) => {
          // Everyone lands on their own student workspace by default — administrators and
          // training managers switch up to their elevated view from there via the profile menu.
          const studentEntry = response.roles.find((entry) => entry.role === 'student');
          const landingEntry = studentEntry ?? (response.roles.length === 1 ? response.roles[0] : undefined);

          if (landingEntry) {
            this.persistAuthenticatedSession(landingEntry);
            void this.router.navigate([landingEntry.route]);
          } else {
            this.resolvedRoles = response.roles;
            this.loginStep = 'pick-role';
            this.cdr.markForCheck();
          }
        },
        error: (error) => {
          // A subscription-expired rejection carries the server's own specific message (see
          // /api/auth/resolve-roles in server.ts) — show that directly rather than the generic
          // fallback below, which would otherwise leave the user thinking something's just
          // temporarily broken instead of telling them what's actually wrong.
          this.errorMessage = error?.status === 401
            ? 'Invalid login. Check your username and password.'
            : error?.error?.reason === 'subscription-inactive'
              ? error.error.message
              : 'Login is unavailable right now. Please try again.';
          this.shaking.set(true);
          this.cdr.markForCheck();
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
    // Set by lmsAuthInterceptor when a company's subscription lapses mid-session and it force-
    // logs-out the current user, redirecting here with the server's own explanation.
    const sessionError = query.get('sessionError');

    if (sessionError) {
      this.errorMessage = sessionError;
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
      return;
    }

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
      displayName: combineDisplayName(payload.name, payload.surname),
    })));
    localStorage.setItem('lms-token', payload.token);

    // This service instance's constructor already ran (before any login existed) and fetched the
    // pre-auth default-company branding for the login screen's own chrome — refresh it now to the
    // just-authenticated caller's real company branding, since Angular won't reconstruct this
    // root-provided singleton on the client-side navigation that follows.
    this.branding.refreshForAuthenticatedSession();
  }
}
