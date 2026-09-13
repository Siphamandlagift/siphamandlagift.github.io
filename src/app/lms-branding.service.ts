import { Injectable, computed, inject, signal } from '@angular/core';
import { BrandingSettings, LmsBackendService, LmsBrandThemeId } from './lms-backend.service';
import { hasActiveLmsSession } from './session-auth';
import { LMS_BRAND_THEME_OPTIONS, type LmsBrandThemeOption } from './lms-brand-themes';

export type { LmsBrandThemeId } from './lms-backend.service';
export type { LmsBrandThemeOption } from './lms-brand-themes';

@Injectable({ providedIn: 'root' })
export class LmsBrandingService {
  private static readonly themeStorageKey = 'lms-app.admin-theme';
  private static readonly logoStorageKey = 'lms-app.admin-logo';
  private readonly backend = inject(LmsBackendService);

  readonly themeOptions: ReadonlyArray<LmsBrandThemeOption> = LMS_BRAND_THEME_OPTIONS;

  // Starts from a neutral default rather than seeding from localStorage — GET /api/branding is
  // the one platform-wide login page's branding now (Super-Admin-managed, same for every
  // company — see the login-screen retrofit plan), so a value cached here from a PREVIOUS
  // browser session could be stale against a Super Admin edit made since. Only a deliberate
  // in-app edit (selectTheme/setCompanyLogo below, both always scoped to the current session's
  // own authenticated company) writes to localStorage now — this constructor's own read-only
  // fetch no longer does, so it can't be the source of a stale flash on the NEXT session's
  // pre-paint.
  private readonly selectedThemeIdSignal = signal<LmsBrandThemeId>('ocean');
  readonly selectedThemeId = this.selectedThemeIdSignal.asReadonly();
  readonly currentTheme = computed(
    () => this.themeOptions.find((theme) => theme.id === this.selectedThemeIdSignal()) ?? this.themeOptions[0],
  );

  private readonly companyLogoDataUrlSignal = signal<string | null>(null);
  readonly companyLogoDataUrl = this.companyLogoDataUrlSignal.asReadonly();

  // Guards against a real race: the constructor's own public fetch (fired at page load, before
  // any login) and refreshForAuthenticatedSession()'s fetch (fired right after a successful
  // login) run as two independent, uncoordinated HTTP calls. If the EARLIER one (public) is
  // slower — e.g. it happens to land on a cold Cloud Function instance — its response can arrive
  // AFTER the later, correct, authenticated one, and silently overwrite the just-logged-in
  // company's real branding with the pre-auth platform default's. Each fetch stamps the request
  // counter it started with; a response is only applied if that stamp still matches the counter
  // at the moment it resolves — i.e. no newer fetch has started since. This is exactly the "ignore
  // stale responses" pattern RxJS's switchMap gives you automatically; done by hand here since
  // the two fetches come from otherwise-independent call sites (the constructor vs. an explicit
  // later call), not one continuous observable chain switchMap could sit in front of.
  private fetchGeneration = 0;

  constructor() {
    // Fresh app load with an existing session already in localStorage (a page refresh on
    // /admin-profile, or a bookmarked/direct URL) means this constructor's own fetch can go
    // straight to the authenticated, company-scoped endpoint. A fresh load with NO session yet
    // (visiting / for the first time) still needs the public one for the login screen's own
    // pre-auth chrome — the same Super-Admin-managed branding every company's login screen shows.
    // Either way, this only covers "fresh app load" — a login that happens WITHOUT a full reload
    // (the normal SPA flow) needs refreshForAuthenticatedSession() called explicitly right after
    // (see login.ts), since this constructor runs exactly once per app load and won't re-run just
    // because the user subsequently logs in.
    if (hasActiveLmsSession()) {
      this.fetchAuthenticatedBranding();
    } else {
      this.fetchPublicBranding();
    }
  }

  // Called once, right after a successful login (see login.ts) — the one case the constructor
  // above can't cover, since Angular doesn't reconstruct root-provided singletons on client-side
  // navigation, so switching from the pre-auth platform branding to the caller's own real
  // company's branding has to happen explicitly at that moment instead.
  refreshForAuthenticatedSession() {
    this.fetchAuthenticatedBranding();
  }

  private fetchPublicBranding() {
    const generation = ++this.fetchGeneration;
    this.backend.getBranding().subscribe({
      next: (branding) => this.applyBranding(branding, generation),
      error: () => {
        // Neutral default (already set above) stays in place if the API is unavailable.
      },
    });
  }

  private fetchAuthenticatedBranding() {
    const generation = ++this.fetchGeneration;
    this.backend.getMyBranding().subscribe({
      next: (branding) => this.applyBranding(branding, generation),
      error: () => {
        // Keep whatever was showing (neutral default, or the last successful fetch) if this
        // one fails — never fall back to the public/platform-default endpoint here, since that
        // would silently show the generic login-screen branding to an authenticated user.
      },
    });
  }

  private applyBranding(branding: BrandingSettings, generation: number) {
    if (generation !== this.fetchGeneration) {
      // A newer fetch (almost always the post-login authenticated one) has started since this
      // one did — this response is stale, discard it rather than let it clobber whatever the
      // newer request already applied or is about to.
      return;
    }

    this.selectedThemeIdSignal.set(branding.themeId);
    this.companyLogoDataUrlSignal.set(branding.companyLogoDataUrl);
  }

  selectTheme(themeId: LmsBrandThemeId): Promise<boolean> {
    const previousThemeId = this.selectedThemeIdSignal();
    this.selectedThemeIdSignal.set(themeId);

    return this.persistBranding().then((saved) => {
      if (!saved) {
        // Roll back so the UI doesn't keep showing a theme that was never actually saved —
        // otherwise a reload (or another admin's session) would silently revert it anyway.
        this.selectedThemeIdSignal.set(previousThemeId);
        this.saveToLocalStorage({ themeId: previousThemeId, companyLogoDataUrl: this.companyLogoDataUrlSignal() });
      }

      return saved;
    });
  }

  setCompanyLogo(logoDataUrl: string | null): Promise<boolean> {
    const previousLogoDataUrl = this.companyLogoDataUrlSignal();
    this.companyLogoDataUrlSignal.set(logoDataUrl);

    return this.persistBranding().then((saved) => {
      if (!saved) {
        this.companyLogoDataUrlSignal.set(previousLogoDataUrl);
        this.saveToLocalStorage({ themeId: this.selectedThemeIdSignal(), companyLogoDataUrl: previousLogoDataUrl });
      }

      return saved;
    });
  }

  clearCompanyLogo(): Promise<boolean> {
    return this.setCompanyLogo(null);
  }

  private persistBranding(): Promise<boolean> {
    const branding: BrandingSettings = {
      themeId: this.selectedThemeIdSignal(),
      companyLogoDataUrl: this.companyLogoDataUrlSignal(),
    };

    this.saveToLocalStorage(branding);

    return new Promise((resolve) => {
      this.backend.updateBranding(branding).subscribe({
        next: () => resolve(true),
        // The local copy (and localStorage fallback) still reflect the attempted change — the
        // caller decides whether to roll that back when the save didn't actually reach the server.
        error: () => resolve(false),
      });
    });
  }

  private saveToLocalStorage(branding: BrandingSettings) {
    try {
      localStorage.setItem(LmsBrandingService.themeStorageKey, branding.themeId);

      if (!branding.companyLogoDataUrl) {
        localStorage.removeItem(LmsBrandingService.logoStorageKey);
        return;
      }

      localStorage.setItem(LmsBrandingService.logoStorageKey, branding.companyLogoDataUrl);
    } catch {
      return;
    }
  }
}
