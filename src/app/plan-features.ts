import type { SubscriptionPlan } from './lms-backend.service';

// Client-side mirror of server/src/plan-features.ts — used to hide plan-gated nav items so a
// restricted user never sees a route they'd be rejected from anyway. The server is the real
// enforcement (this file has no security value on its own, per how browser-side code always
// works); keep the two lists in sync by hand, same convention already used for SubscriptionPlan
// itself being duplicated across the client/server boundary.
export type GatedFeature =
  | 'training-manager-profile'
  | 'student-mentorship'
  | 'student-performance'
  | 'student-idp'
  | 'student-messages'
  | 'student-external-training'
  | 'admin-succession'
  | 'admin-hr-integration'
  | 'admin-approval-settings'
  // UI-only — the IDP/Performance/Certificates/SETA report views (Training Report always stays
  // available). Not enforced server-side: these are read-only report displays, lower-stakes than
  // the write actions the rest of this list gates, so hiding the menu entries is judged enough.
  | 'admin-reports-extended'
  // UI-only — badges/certificates are derived/computed from existing course-completion data
  // (offerings, quiz/assignment submissions), not their own write path, so there's nothing
  // separate to gate server-side.
  | 'student-badges';

const STARTER_EXCLUDED_FEATURES: ReadonlySet<GatedFeature> = new Set([
  'training-manager-profile',
  'student-mentorship',
  'student-performance',
  'student-idp',
  'student-messages',
  'student-external-training',
  'admin-succession',
  'admin-hr-integration',
  'admin-approval-settings',
  'admin-reports-extended',
  'student-badges',
]);

export function isFeatureAllowedForPlan(plan: SubscriptionPlan | null | undefined, feature: GatedFeature): boolean {
  if (plan === 'starter') {
    return !STARTER_EXCLUDED_FEATURES.has(feature);
  }

  // Undefined/null plan (e.g. bootstrap hasn't resolved yet) fails open, same as the server's own
  // default — this is a display gate, not a security boundary, and failing closed here would
  // flash every nav item as hidden for a moment on every page load.
  return true;
}
