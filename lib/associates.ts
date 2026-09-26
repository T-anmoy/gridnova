// Associate Network entry points. The routes are built in Phase 2; until then
// ASSOCIATE_PORTAL_OPEN stays false and every Apply / Login button renders as
// a clearly labelled "Opening soon" state instead of a link that would 404.
// Flip this to true in the same change that ships those routes.
export const ASSOCIATE_PORTAL_OPEN = false;

export const ASSOCIATE_ROUTES = {
  applyAssociate: "/associates/apply/associate",
  applyPreferred: "/associates/apply/preferred",
  associateSignIn: "/associates/sign-in",
  preferredSignIn: "/preferred/sign-in",
} as const;
