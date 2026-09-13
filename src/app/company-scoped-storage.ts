// Shared by every local-cache layer that persists to localStorage (training-manager-data.service.ts,
// student-data.service.ts, student-badges.component.ts, student-courses.component.ts) — a
// single-tenant-era pattern that's unsafe as-is in a multi-tenant browser: a bare key like
// `lms-app.students` (or even a per-student key like `lms-app.student-badges.<studentId>`, if two
// different companies ever generated the same student id) has no notion of WHICH company it
// belongs to, so a browser that has ever logged into Company A can still have A's cached data
// sitting under a key Company B's session reads from. See training-manager-data.service.ts's own
// history for the concrete bug this caused (Company A's whole roster reappearing inside Company
// B's User Management, via a "keep local records the backend doesn't recognize yet" merge that
// treated A's leftover cache as B's own unsynced edits).
//
// Every cached value is tagged with the companyId it was cached for — read directly off the
// current session's own JWT, decoded client-side (no verification needed for this read-only use;
// the server independently enforces the real company boundary on every request regardless of
// what this reads) — and refused on read-back unless that tag matches the CURRENT company. A
// cache written before this module existed carries no tag at all, which fails the same check a
// mismatched one does, so old unscoped entries are simply discarded rather than trusted.

export function getCurrentCompanyId(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const token = localStorage.getItem('lms-token');
    const payloadSegment = token?.split('.')[1];
    if (!payloadSegment) {
      return null;
    }

    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { companyId?: unknown };
    return typeof payload.companyId === 'string' && payload.companyId ? payload.companyId : null;
  } catch {
    return null;
  }
}

export function readCompanyScopedCache(storageKey: string): unknown {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  const currentCompanyId = getCurrentCompanyId();
  if (!currentCompanyId) {
    // Can't prove this cache is ours — never trust it rather than guess.
    return null;
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { companyId?: unknown; data?: unknown };
    if (!parsed || typeof parsed !== 'object' || parsed.companyId !== currentCompanyId) {
      return null;
    }

    return parsed.data ?? null;
  } catch {
    return null;
  }
}

export function writeCompanyScopedCache(storageKey: string, data: unknown): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const currentCompanyId = getCurrentCompanyId();
  if (!currentCompanyId) {
    // Don't cache data we can't later prove ownership of.
    return;
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify({ companyId: currentCompanyId, data }));
  } catch {
    // Ignore write failures (e.g. quota exceeded, private browsing) — caching is best-effort.
  }
}

export function removeCompanyScopedCache(storageKey: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Ignore — best-effort cleanup.
  }
}
