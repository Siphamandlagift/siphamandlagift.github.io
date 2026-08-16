import { Injectable, computed, inject, signal } from '@angular/core';
import { BrandingSettings, LmsBackendService, LmsBrandThemeId } from './lms-backend.service';

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

  private readonly selectedThemeIdSignal = signal<LmsBrandThemeId>(this.loadTheme());
  readonly selectedThemeId = this.selectedThemeIdSignal.asReadonly();
  readonly currentTheme = computed(
    () => this.themeOptions.find((theme) => theme.id === this.selectedThemeIdSignal()) ?? this.themeOptions[0],
  );

  private readonly companyLogoDataUrlSignal = signal<string | null>(this.loadLogo());
  readonly companyLogoDataUrl = this.companyLogoDataUrlSignal.asReadonly();

  constructor() {
    this.backend.getBranding().subscribe({
      next: (branding) => {
        this.selectedThemeIdSignal.set(branding.themeId);
        this.companyLogoDataUrlSignal.set(branding.companyLogoDataUrl);
        this.saveToLocalStorage(branding);
      },
      error: () => {
        // Keep local fallback if the API is temporarily unavailable.
      },
    });
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

  private loadTheme(): LmsBrandThemeId {
    try {
      const storedTheme = localStorage.getItem(LmsBrandingService.themeStorageKey) as LmsBrandThemeId | null;
      return this.themeOptions.some((theme) => theme.id === storedTheme) ? storedTheme! : 'ocean';
    } catch {
      return 'ocean';
    }
  }

  private loadLogo() {
    try {
      return localStorage.getItem(LmsBrandingService.logoStorageKey);
    } catch {
      return null;
    }
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