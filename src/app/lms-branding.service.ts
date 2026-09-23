import { Injectable, computed, inject, signal } from '@angular/core';
import { BrandingSettings, CompanyBrandingLookup, LmsBackendService, LmsBrandThemeId } from './lms-backend.service';
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

  // Super-Admin-managed only (platform-wide default, or a specific company's own branded login
  // URL) — this service never writes it itself, only displays whatever the last fetch returned;
  // see the login page for where it's actually rendered.
  private readonly backgroundImageUrlSignal = signal<string | null>(null);
  readonly backgroundImageUrl = this.backgroundImageUrlSignal.asReadonly();

  // Set only when the pre-login screen resolved a specific company from its own branded URL
  // (login/:companySlug) — lets that screen show "Signing in to <company>" for a clear visual
  // confirmation. Null for the shared default screen, and cleared again if a slug fetch falls
  // back to the default (see fetchPublicBrandingForSlug).
  private readonly companyDisplayNameSignal = signal<string | null>(null);
  readonly companyDisplayName = this.companyDisplayNameSignal.asReadonly();

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

  // Called once by the login screen itself (see login/login.ts's own ngOnInit) — the constructor
  // above picks fetchAuthenticatedBranding() over this whenever hasActiveLmsSession() is true, but
  // that's only a good guess for a fresh load of an authenticated ROUTE (a refresh on
  // /admin-profile, say). It guesses wrong for the login route itself: nothing in app.routes.ts
  // stops an already-logged-in visitor (session still valid — back button, a bookmark, a second
  // tab) from landing on '/', and the constructor has no way to know that's where it's running.
  // Left uncorrected, that visitor's OWN company branding would render on what's supposed to be
  // the one shared, Super-Admin-managed login screen every company sees identically. This fetch's
  // generation stamp (see fetchGeneration) wins over that earlier, wrong guess regardless of which
  // response lands first, the same way refreshForAuthenticatedSession's does in the other direction.
  //
  // companySlug is set when the visitor reached a company's own branded URL (login/:companySlug —
  // see login.ts) — tries that company's own branding first, falling back to the shared default
  // for an unset/unrecognized slug (or when there's no slug at all) so a bad/stale bookmark
  // degrades gracefully instead of erroring.
  refreshForPublicScreen(companySlug?: string) {
    if (companySlug) {
      this.fetchPublicBrandingForSlug(companySlug);
    } else {
      this.fetchPublicBranding();
    }
  }

  private fetchPublicBranding() {
    const generation = ++this.fetchGeneration;
    this.companyDisplayNameSignal.set(null);
    this.backend.getBranding().subscribe({
      next: (branding) => this.applyBranding(branding, generation),
      error: () => {
        // Neutral default (already set above) stays in place if the API is unavailable.
      },
    });
  }

  private fetchPublicBrandingForSlug(companySlug: string) {
    const generation = ++this.fetchGeneration;
    this.backend.getCompanyBrandingBySlug(companySlug).subscribe({
      next: (lookup) => this.applyCompanyBranding(lookup, generation),
      error: () => {
        // Unset/unrecognized slug (404), or the API is temporarily unavailable — either way, fall
        // back to the one shared default every /login visitor without a company URL already sees,
        // rather than showing an error or a half-applied state. This fallback fetch's own
        // generation stamp supersedes this one, so a still-later fetch (e.g. a rapid route change)
        // correctly wins over it in turn.
        this.fetchPublicBranding();
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
    this.backgroundImageUrlSignal.set(branding.backgroundImageUrl);
  }

  private applyCompanyBranding(lookup: CompanyBrandingLookup, generation: number) {
    if (generation !== this.fetchGeneration) {
      return;
    }

    this.companyDisplayNameSignal.set(lookup.companyName);
    this.applyBranding(lookup.branding, generation);
  }

  selectTheme(themeId: LmsBrandThemeId): Promise<boolean> {
    return this.queueBrandingMutation(
      () => {
        const previousThemeId = this.selectedThemeIdSignal();
        this.selectedThemeIdSignal.set(themeId);
        return previousThemeId;
      },
      (previousThemeId) => {
        // Roll back so the UI doesn't keep showing a theme that was never actually saved —
        // otherwise a reload (or another admin's session) would silently revert it anyway.
        this.selectedThemeIdSignal.set(previousThemeId);
        this.saveToLocalStorage({ themeId: previousThemeId, companyLogoDataUrl: this.companyLogoDataUrlSignal(), backgroundImageUrl: this.backgroundImageUrlSignal() });
      },
    );
  }

  setCompanyLogo(logoDataUrl: string | null): Promise<boolean> {
    return this.queueBrandingMutation(
      () => {
        const previousLogoDataUrl = this.companyLogoDataUrlSignal();
        this.companyLogoDataUrlSignal.set(logoDataUrl);
        return previousLogoDataUrl;
      },
      (previousLogoDataUrl) => {
        this.companyLogoDataUrlSignal.set(previousLogoDataUrl);
        this.saveToLocalStorage({ themeId: this.selectedThemeIdSignal(), companyLogoDataUrl: previousLogoDataUrl, backgroundImageUrl: this.backgroundImageUrlSignal() });
      },
    );
  }

  clearCompanyLogo(): Promise<boolean> {
    return this.setCompanyLogo(null);
  }

  // selectTheme and setCompanyLogo both PUT the FULL branding snapshot (theme + logo together —
  // there's no per-field save endpoint), so two saves fired back to back race on more than just
  // the network: whichever happens to persist LAST wins the shared fields regardless of send
  // order, and if the earlier one then fails and rolls its own signal back, that rollback can
  // land AFTER the later save already re-persisted the pre-rollback value — the UI shows "reverted
  // to the old theme" while the server actually still has the new one. Queuing every mutate+
  // persist+maybe-rollback as one indivisible unit (via brandingMutationQueue) fixes both: sends
  // are strictly ordered, and each save's payload/rollback always reflects the truly-settled state
  // left by the one before it, since the next mutate() can't run until the previous unit — rollback
  // included — has fully finished.
  private brandingMutationQueue: Promise<unknown> = Promise.resolve();

  private queueBrandingMutation<T>(mutate: () => T, rollback: (previous: T) => void): Promise<boolean> {
    const run = this.brandingMutationQueue.then(async () => {
      const previous = mutate();
      const saved = await this.persistBranding();
      if (!saved) {
        rollback(previous);
      }
      return saved;
    });
    // Swallowed here so a failed unit never poisons the queue for later mutations — the caller
    // above still sees the real result via `run`, which this doesn't affect.
    this.brandingMutationQueue = run.catch(() => undefined);
    return run;
  }

  private persistBranding(): Promise<boolean> {
    // backgroundImageUrl rides along here even though this service never lets a company admin
    // change it (Super-Admin-only) — sent as whatever the last fetch returned so a round-trip
    // theme/logo save can't accidentally look like it's clearing it. server.ts's own
    // brandingSettingsSchema for THIS route doesn't declare the field at all, so it's stripped
    // and ignored either way — this is just keeping the local echo consistent.
    const branding: BrandingSettings = {
      themeId: this.selectedThemeIdSignal(),
      companyLogoDataUrl: this.companyLogoDataUrlSignal(),
      backgroundImageUrl: this.backgroundImageUrlSignal(),
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
