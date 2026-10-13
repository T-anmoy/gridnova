# Frontend error monitoring

**Status: off by design.** No third-party error-monitoring service is installed.
Adding one is a product/cost decision for Grid Nova, so it has not been done.

What exists today:

- Error boundaries show an on-brand message instead of a blank page:
  `app/(site)/[lang]/error.tsx` (public site and both field portals),
  `app/(internal)/dashboard/error.tsx` (staff), `app/global-error.tsx` (root layout failure).
  They log only the Next.js `digest`, never the error message (which can echo form data).
- `lib/monitoring.ts` has `reportError(error, { area, digest })` and `setErrorSink(fn)`.
  With no sink registered it does nothing. Messages are passed through `scrubForReport`
  (email, PAN, IFSC, phone, 9–18-digit numbers incl. Aadhaar/bank accounts, coordinates,
  `/proposal/accept/<token>`, bearer tokens) before they reach a sink.

If Grid Nova wants Sentry (or similar):

1. Add the SDK and call `setErrorSink` once, from a client component mounted in the root layouts.
2. Set `sendDefaultPii: false`, disable session replay and breadcrumbs for inputs/network bodies,
   and keep `beforeSend` returning only the `ErrorReport` fields.
3. Add the vendor's domain to `connect-src` in `lib/security-headers.ts`.
4. Check the Privacy Policy (draft §1.6 already names Sentry as an error-monitoring provider —
   **if no service is added, that sentence is inaccurate and should be removed from the draft**).
