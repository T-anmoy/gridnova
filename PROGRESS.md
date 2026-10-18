# Grid Nova Energy — repository pointer

This repo is the Grid Nova Energy web app: the public site (en/hi/bn), the associate portals
(en/hi/bn) and the English-only staff dashboard under `app/(internal)/dashboard`. It is a
Next.js 16 · React 19 · Tailwind 4 · shadcn/ui · TanStack Query · Clerk app that talks to the
Grid Nova backend over HTTP.

- **Setup, scripts, structure, testing:** see [README.md](README.md).
- **Backend contracts (the only source of request/response shapes):** [`docs/api/`](docs/api/)
  — start with [`docs/api/README.md`](docs/api/README.md); `docs/api/openapi.json` is checked
  by the contract-drift tests.
- **Agent/contributor rules for this Next.js version:** [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md).

This file used to track a page-by-page marketing build ("2 of 14 pages complete"); that status
was stale and has been removed. Per-feature history lives in git.
