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
  // Undefined/null plan (bootstrap hasn't resolved yet, right after login/on every fresh page
  // load) is treated the same as the most restricted tier until the real plan is known — the
  // previous fail-open default meant a Starter company's admin briefly saw every growth/
  // enterprise-only nav item (Succession Planning, HR integration, ...) flash on screen the
  // instant the page loaded, before disappearing once the real 'starter' plan value arrived a
  // moment later. That's a business-tier leak, not just a cosmetic flicker, so it's worth eating
  // the (much less consequential) opposite flash this causes for genuine growth/enterprise
  // accounts — their own gated items are briefly absent for that same instant instead.
  if (plan === 'starter' || plan == null) {
    return !STARTER_EXCLUDED_FEATURES.has(feature);
  }

  return true;
}
