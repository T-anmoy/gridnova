import { z } from 'zod'

// Zod 4 probes `new Function("")` to decide whether it may compile fast-path
// parsers. Under our Content-Security-Policy (no 'unsafe-eval') that probe is
// blocked: harmless — zod falls back — but it files a violation report on every
// page load. Turning the JIT off up front skips the probe. Our payloads are tiny,
// so the interpreted parsers cost nothing measurable.
//
// Import this module FIRST in any module that builds zod schemas for the browser.
z.config({ jitless: true })
