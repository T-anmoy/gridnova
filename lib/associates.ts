// Associate Network entry points: apply wizards, sign-in and portals.
export const ASSOCIATE_ROUTES = {
  applyAssociate: "/associates/apply/associate",
  applyPreferred: "/associates/apply/preferred",
  associateSignIn: "/associates/sign-in",
  preferredSignIn: "/preferred/sign-in",
} as const;

// Whether the Associate Network is offered to the public. Driven by
// NEXT_PUBLIC_ASSOCIATE_PORTAL_OPEN ("true" / "false"); when unset it is open
// in development and closed in production builds, so a deploy without the
// backend never offers a form that cannot work.
export function resolvePortalOpen(raw: string | undefined, nodeEnv: string | undefined): boolean {
  const flag = raw?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return nodeEnv !== "production";
}

// The env reads must stay literal property accesses so Next inlines them.
export const ASSOCIATE_PORTAL_OPEN = resolvePortalOpen(
  process.env.NEXT_PUBLIC_ASSOCIATE_PORTAL_OPEN,
  process.env.NODE_ENV,
);
