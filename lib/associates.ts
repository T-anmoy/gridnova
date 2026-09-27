// Associate Network entry points. Phase 2B ships the routes below (apply
// wizards, sign-in, portals) — every Apply / Login button on the Careers
// page now links to a real route instead of showing "Opening soon".
export const ASSOCIATE_PORTAL_OPEN = true;

export const ASSOCIATE_ROUTES = {
  applyAssociate: "/associates/apply/associate",
  applyPreferred: "/associates/apply/preferred",
  associateSignIn: "/associates/sign-in",
  preferredSignIn: "/preferred/sign-in",
} as const;
