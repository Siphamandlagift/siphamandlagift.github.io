const LMS_SESSION_STORAGE_KEY = 'lms-session';
const LMS_TOKEN_STORAGE_KEY = 'lms-token';

// Expire authenticated sessions after 15 minutes without user activity.
export const LMS_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

export type LmsSessionRecord = {
  role?: string;
  username?: string;
  email?: string;
  studentId?: string | null;
  displayName?: string | null;
  issuedAt?: number;
  lastActivityAt?: number;
  expiresAt?: number;
};

export function combineDisplayName(name?: string, surname?: string): string | null {
  const combined = [name, surname].filter((part) => part?.trim()).join(' ').trim();
  return combined || null;
}

export function createLmsSessionRecord(payload: {
  role: string;
  username: string;
  email: string;
  studentId?: string | null;
  displayName?: string | null;
}, now = Date.now()): LmsSessionRecord {
  return {
    role: payload.role,
    username: payload.username,
    email: payload.email,
    studentId: payload.studentId ?? null,
    displayName: payload.displayName ?? null,
    issuedAt: now,
    lastActivityAt: now,
    expiresAt: now + LMS_INACTIVITY_TIMEOUT_MS,
  };
}

function writeLmsSessionRecord(session: LmsSessionRecord) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(LMS_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function resolvedSessionExpiryTimestamp(session: LmsSessionRecord): number | null {
  const baseActivityTimestamp = isFiniteTimestamp(session.lastActivityAt)
    ? session.lastActivityAt
    : (isFiniteTimestamp(session.issuedAt) ? session.issuedAt : null);

  const activityExpiry = baseActivityTimestamp !== null
    ? baseActivityTimestamp + LMS_INACTIVITY_TIMEOUT_MS
    : null;

  if (!isFiniteTimestamp(session.expiresAt)) {
    return activityExpiry;
  }

  if (activityExpiry === null) {
    return session.expiresAt;
  }

  return Math.min(activityExpiry, session.expiresAt);
}

export function readLmsSessionRecord(): LmsSessionRecord | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(LMS_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return parsed as LmsSessionRecord;
  } catch {
    return null;
  }
}

export function isLmsSessionExpired(session = readLmsSessionRecord(), now = Date.now()): boolean {
  if (!session) {
    return true;
  }

  const expiryTimestamp = resolvedSessionExpiryTimestamp(session);
  if (!isFiniteTimestamp(expiryTimestamp)) {
    return true;
  }

  return now >= expiryTimestamp;
}

export function hasRequiredSessionFields(session: LmsSessionRecord | null): boolean {
  if (!session) {
    return false;
  }

  return typeof session.role === 'string'
    && session.role.trim().length > 0
    && typeof session.username === 'string'
    && session.username.trim().length > 0;
}

export function hasActiveLmsSession(now = Date.now()): boolean {
  const session = readLmsSessionRecord();
  return hasRequiredSessionFields(session) && !isLmsSessionExpired(session, now);
}

export function refreshLmsSessionActivity(now = Date.now()): boolean {
  const session = readLmsSessionRecord();
  if (!hasRequiredSessionFields(session) || isLmsSessionExpired(session, now)) {
    return false;
  }

  writeLmsSessionRecord({
    ...session,
    lastActivityAt: now,
    expiresAt: now + LMS_INACTIVITY_TIMEOUT_MS,
  });
  return true;
}

export function clearLmsAuthSession() {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.removeItem(LMS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(LMS_SESSION_STORAGE_KEY);
}
