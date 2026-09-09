import { Injectable, computed, inject, signal } from '@angular/core';
import { BrandingSettings, LmsBackendService, LmsBrandThemeId } from './lms-backend.service';
import { hasActiveLmsSession } from './session-auth';

export type { LmsBrandThemeId } from './lms-backend.service';

export type LmsBrandThemeOption = {
  id: LmsBrandThemeId;
  label: string;
  copy: string;
  primary: string;
  secondary: string;
  tint: string;
  surface: string;
};

@Injectable({ providedIn: 'root' })
export class LmsBrandingService {
  private static readonly themeStorageKey = 'lms-app.admin-theme';
  private static readonly logoStorageKey = 'lms-app.admin-logo';
  private readonly backend = inject(LmsBackendService);

  readonly themeOptions: ReadonlyArray<LmsBrandThemeOption> = [
    {
      id: 'ocean',
      label: 'Ocean Blue',
      copy: 'A single blue theme for a calm executive workspace.',
      primary: '#2563eb',
      secondary: '#2563eb',
      tint: '#dbeafe',
      surface: '#eff6ff',
    },
    {
      id: 'forest',
      label: 'Forest Teal',
      copy: 'A single teal theme for steady platform operations.',
      primary: '#0f766e',
      secondary: '#0f766e',
      tint: '#ccfbf1',
      surface: '#f0fdfa',
    },
    {
      id: 'sunrise',
      label: 'Sunrise Coral',
      copy: 'A single orange theme for a warmer admin view.',
      primary: '#ea580c',
      secondary: '#ea580c',
      tint: '#ffedd5',
      surface: '#fff7ed',
    },
    {
      id: 'purple',
      label: 'Royal Purple',
      copy: 'A single purple theme for a richer workspace mood.',
      primary: '#7c3aed',
      secondary: '#7c3aed',
      tint: '#ede9fe',
      surface: '#f5f3ff',
    },
    {
      id: 'black',
      label: 'Carbon Black',
      copy: 'A single near-black theme for a sharper executive look.',
      primary: '#111827',
      secondary: '#111827',
      tint: '#e5e7eb',
      surface: '#f3f4f6',
    },
    {
      id: 'grey',
      label: 'Slate Grey',
      copy: 'A single grey theme for a neutral, understated workspace.',
      primary: '#6b7280',
      secondary: '#6b7280',
      tint: '#e5e7eb',
      surface: '#f9fafb',
    },
  ];

  // Starts from a neutral default rather than seeding from localStorage — GET /api/branding is
  // now company-scoped (see the multi-tenant retrofit plan), so a value cached here from a
  // PREVIOUS browser session could belong to a different company than whoever loads the app next
  // on a shared/kiosk device. Only a deliberate in-app edit (selectTheme/setCompanyLogo below,
  // both always scoped to the current session's own authenticated company) writes to localStorage
  // now — this constructor's own read-only fetch no longer does, so it can't be the source of a
  // stale cross-company flash on the NEXT session's pre-paint.
  private readonly selectedThemeIdSignal = signal<LmsBrandThemeId>('ocean');
  readonly selectedThemeId = this.selectedThemeIdSignal.asReadonly();
  readonly currentTheme = computed(
    () => this.themeOptions.find((theme) => theme.id === this.selectedThemeIdSignal()) ?? this.themeOptions[0],
  );

  private readonly companyLogoDataUrlSignal = signal<string | null>(null);
  readonly companyLogoDataUrl = this.companyLogoDataUrlSignal.asReadonly();

  constructor() {
    // Fresh app load with an existing session already in localStorage (a page refresh on
    // /admin-profile, or a bookmarked/direct URL) means this constructor's own fetch can go
    // straight to the authenticated, company-scoped endpoint. A fresh load with NO session yet
    // (visiting / for the first time) still needs the public one for the login screen's own
    // pre-auth chrome. Either way, this only covers "fresh app load" — a login that happens
    // WITHOUT a full reload (the normal SPA flow) needs refreshForAuthenticatedSession() called
    // explicitly right after (see login.ts), since this constructor runs exactly once per app
    // load and won't re-run just because the user subsequently logs in.
    if (hasActiveLmsSession()) {
      this.fetchAuthenticatedBranding();
    } else {
      this.fetchPublicBranding();
    }
  }

  // Called once, right after a successful login (see login.ts) — the one case the constructor
  // above can't cover, since Angular doesn't reconstruct root-provided singletons on client-side
  // navigation, so switching from the pre-auth default-company branding to the caller's own real
  // company's branding has to happen explicitly at that moment instead.
  refreshForAuthenticatedSession() {
    this.fetchAuthenticatedBranding();
  }

  private fetchPublicBranding() {
    this.backend.getBranding().subscribe({
      next: (branding) => this.applyBranding(branding),
      error: () => {
        // Neutral default (already set above) stays in place if the API is unavailable.
      },
    });
  }

  private fetchAuthenticatedBranding() {
    this.backend.getMyBranding().subscribe({
      next: (branding) => this.applyBranding(branding),
      error: () => {
        // Keep whatever was showing (neutral default, or the last successful fetch) if this
        // one fails — never fall back to the public/default-company endpoint here, since that
        // would silently show a DIFFERENT company's branding to an authenticated user.
      },
    });
  }

  private applyBranding(branding: BrandingSettings) {
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