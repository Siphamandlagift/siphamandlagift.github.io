// Session/token storage for the SkillsConnect Super Admin — deliberately a separate module from
// session-auth.ts rather than a variant of it: a Super Admin isn't a 4th company role, it's a
// different identity model entirely (no companyId, lives in its own platformAdmins collection —
// see the multi-tenant retrofit plan's Q4). Kept under its own localStorage keys so a browser can
// hold a company-user session and a Super Admin session at the same time without either
// clobbering the other (e.g. testing both in one browser).
const PLATFORM_SESSION_STORAGE_KEY = 'lms-platform-session';
const PLATFORM_TOKEN_STORAGE_KEY = 'lms-platform-token';

// Same inactivity window as the company-user session (session-auth.ts) — no reason for the two to
// differ.
export const PLATFORM_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

export type PlatformSessionRecord = {
  adminId?: string;
  name?: string;
  email?: string;
  issuedAt?: number;
  lastActivityAt?: number;
  expiresAt?: number;
};

export function createPlatformSessionRecord(payload: {
  adminId: string;
  name: string;
  email: string;
}, now = Date.now()): PlatformSessionRecord {
  return {
    adminId: payload.adminId,
    name: payload.name,
    email: payload.email,
    issuedAt: now,
    lastActivityAt: now,
    expiresAt: now + PLATFORM_INACTIVITY_TIMEOUT_MS,
  };
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function resolvedSessionExpiryTimestamp(session: PlatformSessionRecord): number | null {
  const baseActivityTimestamp = isFiniteTimestamp(session.lastActivityAt)
    ? session.lastActivityAt
    : (isFiniteTimestamp(session.issuedAt) ? session.issuedAt : null);

  const activityExpiry = baseActivityTimestamp !== null
    ? baseActivityTimestamp + PLATFORM_INACTIVITY_TIMEOUT_MS
    : null;

  if (!isFiniteTimestamp(session.expiresAt)) {
    return activityExpiry;
  }

  if (activityExpiry === null) {
    return session.expiresAt;
  }

  return Math.min(activityExpiry, session.expiresAt);
}

export function persistPlatformSession(session: PlatformSessionRecord, token: string) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(PLATFORM_SESSION_STORAGE_KEY, JSON.stringify(session));
  localStorage.setItem(PLATFORM_TOKEN_STORAGE_KEY, token);
}

export function readPlatformSessionRecord(): PlatformSessionRecord | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(PLATFORM_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return parsed as PlatformSessionRecord;
  } catch {
    return null;
  }
}

export function readPlatformToken(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage.getItem(PLATFORM_TOKEN_STORAGE_KEY);
}

export function isPlatformSessionExpired(session = readPlatformSessionRecord(), now = Date.now()): boolean {
  if (!session) {
    return true;
  }

  const expiryTimestamp = resolvedSessionExpiryTimestamp(session);
  if (!isFiniteTimestamp(expiryTimestamp)) {
    return true;
  }

  return now >= expiryTimestamp;
}

export function hasRequiredPlatformSessionFields(session: PlatformSessionRecord | null): boolean {
  if (!session) {
    return false;
  }

  return typeof session.adminId === 'string' && session.adminId.trim().length > 0;
}

export function hasActivePlatformSession(now = Date.now()): boolean {
  const session = readPlatformSessionRecord();
  return hasRequiredPlatformSessionFields(session) && !isPlatformSessionExpired(session, now);
}

export function refreshPlatformSessionActivity(now = Date.now()): boolean {
  const session = readPlatformSessionRecord();
  if (!hasRequiredPlatformSessionFields(session) || isPlatformSessionExpired(session, now)) {
    return false;
  }

  const token = readPlatformToken();
  if (!token) {
    return false;
  }

  persistPlatformSession({
    ...session,
    lastActivityAt: now,
    expiresAt: now + PLATFORM_INACTIVITY_TIMEOUT_MS,
  }, token);
  return true;
}

export function clearPlatformAuthSession() {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.removeItem(PLATFORM_TOKEN_STORAGE_KEY);
  localStorage.removeItem(PLATFORM_SESSION_STORAGE_KEY);
}
