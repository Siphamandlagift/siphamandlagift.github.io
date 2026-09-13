import type { SubscriptionPlan } from './contracts.js';

// Feature-gating by subscription plan. Only 'starter' has been specified so far (see the
// multi-tenant retrofit's licensing follow-up) — 'growth' and 'enterprise' are left fully
// unrestricted until those tiers get their own definition, rather than guessing at one.
//
// This mirrors src/app/plan-features.ts on the client (kept in sync by hand, same convention
// already used for LoginRole/SubscriptionPlan themselves being duplicated across the client/
// server boundary) — the client uses it to hide nav items, this file is the real enforcement.
export type GatedFeature =
  | 'training-manager-profile'
  | 'student-mentorship'
  | 'student-performance'
  | 'student-idp'
  | 'student-messages'
  | 'student-external-training'
  | 'admin-succession'
  | 'admin-hr-integration'
  | 'admin-approval-settings';

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
]);

export function isFeatureAllowedForPlan(plan: SubscriptionPlan, feature: GatedFeature): boolean {
  if (plan === 'starter') {
    return !STARTER_EXCLUDED_FEATURES.has(feature);
  }

  return true;
}
