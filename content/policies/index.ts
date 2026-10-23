import policies from "./policies.en.json";
import notices from "./notices.en.json";

// Grid Nova policy set — generated verbatim from GridNova_Policies_Draft_v1.md
// in this folder. Any `[bracketed]` text would be a fact Grid Nova has not
// confirmed yet and is rendered as a visible placeholder.
// English only: legal text is not machine-translated (see the hi/bn notice).

export type PolicyBlock =
  | { type: "p" | "h4" | "note" | "checkbox"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] };

export type PolicySection = { id: string; heading: string | null; blocks: PolicyBlock[] };

export type PolicyDoc = {
  slug: string;
  number: number;
  sourceTitle: string;
  meta: { label: string; value: string }[];
  sections: PolicySection[];
};

export const POLICY_SLUGS = [
  "privacy",
  "terms",
  "associate-terms",
  "commission-policy",
  "payment-policy",
] as const;
export type PolicySlug = (typeof POLICY_SLUGS)[number];

export function getPolicy(slug: PolicySlug): PolicyDoc {
  return (policies.documents as Record<PolicySlug, PolicyDoc>)[slug];
}

/** Values still awaiting Grid Nova (the draft's own list); null once everything is confirmed. */
export const POLICY_PENDING_ITEMS = (policies as { pendingItems?: unknown }).pendingItems ?? null;

/**
 * Documents 6 and 7 are not pages. The KYC & Data Consent Notice is shown on
 * its own screen in Associate registration (Phase 2); the Customer
 * Information Notice is read or shown to customers by Associates before any
 * details are recorded (Phase 3).
 */
export const ASSOCIATE_KYC_CONSENT_NOTICE = notices.notices["associate-kyc-consent"] as PolicyDoc;
export const CUSTOMER_INFORMATION_NOTICE = notices.notices["customer-information-notice"] as PolicyDoc;
