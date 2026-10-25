This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Environment matrix

Variables are read in one place each: the backend URL in `lib/config.ts` (an ESLint rule forbids reading `NEXT_PUBLIC_API_URL` anywhere else) and the server-only secrets in `lib/env.ts`. `.env.example` lists every variable with a comment and **no real value**.

`NEXT_PUBLIC_*` values are public and inlined at **build** time (change → rebuild); everything else is server-only. **Secret** = never commit, never prefix with `NEXT_PUBLIC_`.

| Variable | Secret | Production | Preview | Development |
| --- | :---: | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | no | **required** — the production API. The build fails if missing or `localhost` | **required** — a *staging* API, never production | `.env.local` (defaults to `http://localhost:8000`) |
| `NEXT_PUBLIC_PRODUCTION_API_HOST` | no | the production API host | the production API host (so Preview warns if it points there) | optional |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | no | **required** (live key) | **required** (test key) | test key |
| `CLERK_SECRET_KEY` | **yes** | **required** | **required** | test key |
| `RESEND_API_KEY` | **yes** | **required** | optional (use a test key, or leave unset) | optional |
| `ESTIMATE_NOTIFY_EMAIL` | no | recommended (defaults to `info@gridnova.in`) | set to a test inbox | optional |
| `INTERNAL_API_KEY` | **yes** | **required** (equals the backend's) | the staging backend's | optional |
| `NEXT_PUBLIC_ASK_NOVA_ENABLED` | no | unset = **on**; `false` turns it off | same | same |
| `NEXT_PUBLIC_ASSOCIATE_PORTAL_OPEN` | no | `true` once the backend is deployed | as needed | open by default |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | no | the Search Console `content` token | leave unset | leave unset |

Two safety nets: a **production build fails** when `NEXT_PUBLIC_API_URL` is missing or local, and a **Preview build prints a warning** when its API host equals `NEXT_PUBLIC_PRODUCTION_API_HOST`. Production also logs an error at runtime for each missing server secret. Locally, `next build` reads `.env.local`; if that file points at `localhost`, run `NEXT_PUBLIC_API_URL=https://your-staging-api next build`.

To switch Ask Nova off without a code change: set `NEXT_PUBLIC_ASK_NOVA_ENABLED=false` in Vercel and redeploy.

## Associate portal switch

`NEXT_PUBLIC_ASSOCIATE_PORTAL_OPEN` (see `.env.example`) controls whether the Associate Network is offered:

| Value | Careers page | `/associates/*`, `/preferred/*` |
| --- | --- | --- |
| `true` | Apply / Sign-in links | Real forms and portals |
| `false` | Non-clickable "Opening soon" | Friendly "Opening soon" page |
| unset | open in development, **closed in production builds** | same as the Careers page |

It is inlined at build time, so changing it needs a rebuild. Turn it on in production only after the backend is deployed and its territory data is loaded. The state/district/block selects then show "Registration is not open yet" (backend `503 territories_not_seeded`) or a Retry button instead of an empty dropdown. Development builds also show the HTTP status under a failed select.

## Testing

Run the **full suite** (unit + end-to-end) before considering any change done:

```bash
npm test
```

That runs the two layers independently:

```bash
npm run test:unit    # Vitest + React Testing Library (jsdom) — fast, no server
npm run test:e2e     # Playwright — builds the app, serves it, drives real Chromium
```

- **Unit tests** (`tests/unit/`) cover regression-prone pure logic and rendering:
  the Projects stat-row divider/padding classes (`lib/stat-grid.ts`) and the
  home leadership grid (single-column on mobile, no orphaned slot).
- **E2E tests** (`tests/e2e/`) cover the flows that have regressed before or are
  commercially critical: every public page loads with **zero console errors** and
  a **footer visible on load**; the **Ask Nova** panel opens, its thread scrolls
  by both wheel and touch, and a message sends and receives a (mocked) reply;
  the **typing FAQ bubble** appears and cycles at **both** mobile and desktop
  widths in one run; header/footer logo and the footer copyright line **scroll to
  top** on `/` and **navigate** from elsewhere; the **mobile nav** opens and
  closes via its button and via an outside click; and the **contact form** shows
  the right validation error for each bad field and refuses to submit.

`npm run test:e2e` is self-contained — Playwright runs `next build` and serves the
production output on port 3100. Watch mode for unit tests: `npm run test:unit:watch`.
Interactive E2E runner: `npm run test:e2e:ui`.

> **Clerk keys:** the dashboard is Clerk-protected and its middleware needs a
> publishable key on every request. The Playwright config falls back to
> well-formed **test** keys so the public-site E2E suite runs without a real Clerk
> account; set real `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` in
> `.env.local` to exercise the dashboard.

### Visual viewport matrix

```bash
npm run test:visual
```

Every page in scope — the public site (English, plus Hindi and Bengali for the
long-text pages), both portals, the customer accept page and every Admin
dashboard page — at 21 viewports (phones portrait and landscape, tablets,
laptops, desktops, 200 % zoom at 1280×720, and a 125 % root font at 360×800).
For each one it saves a full-page screenshot to `test-results/visual-matrix/`
(git-ignored; tall pages as `-partN` images) and **fails** on: anything wider
than the screen, a control inside a fixed panel (sidebar, drawer) that can never
be scrolled to, a fixed or sticky element covering a control on load (the Ask
Nova teaser over any form field included), and page content covering a fixed
control. Small tap targets, blurry (upscaled) or stretched images, and the
teaser or launcher over a plain link are written to
`test-results/visual-matrix/summary.md` for review, along with a page ×
viewport table.

How it works, and what it needs:

- It runs its **own production build** (`.next-visual/`, port 3200) with
  `VISUAL_STUB_AUTH=1`, which swaps Clerk for a cookie-driven stub
  (`tests/visual/clerk-stub/`) so the dashboard and portals render signed in.
  `next.config.ts` only allows that with a reserved `*.test` API host, and a
  normal build never contains the stub.
- API calls are proxied to a **local backend in development mode** (default
  `http://127.0.0.1:8000`, override with `VISUAL_BACKEND`), which accepts the
  dev identity headers the proxy adds (Admin for the dashboard, an Associate /
  Preferred Associate for the portals — ids from `VISUAL_ASSOCIATE_ID` /
  `VISUAL_PREFERRED_ID`, default `GNA-WB-26-90001` / `GNA-WB-26-90002`). Its
  database must be migrated to head; without a backend the pages render their
  error states and only the layout is checked.
- It takes about 20 minutes with 6 workers. One page:
  `npm run test:visual -- -g " /dashboard/leads "`.
- Without Playwright's own browser installed, add `PW_CHANNEL=chrome` to use the
  installed Google Chrome (this works for `npm run test:e2e` too).

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# gridnova
