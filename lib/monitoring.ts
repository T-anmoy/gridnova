// Frontend error monitoring — currently a documented NO-OP (see docs/monitoring.md).
//
// Nothing here talks to a third-party service. `reportError` hands a *scrubbed*
// summary to a sink if one has been registered; none is, so errors stay in the
// browser console and in the Vercel/Cloud Run logs only. If Grid Nova decides
// to add a vendor (Sentry, …), register it with `setErrorSink` from one place
// and keep these scrubbing rules — they match the backend's:
//   never Aadhaar / PAN / bank / location / payment data, never form contents.

export interface ErrorReport {
  /** Error class name only, e.g. "TypeError". */
  name: string
  /** Message with sensitive patterns removed and length capped. */
  message: string
  /** Where it happened: "site", "portal", "dashboard", … */
  area: string
  /** Next.js error digest, which links to the server log without exposing content. */
  digest?: string
}

type Sink = (report: ErrorReport) => void
let sink: Sink | null = null

/** Register a vendor adapter. Pass null to turn reporting off again. */
export function setErrorSink(next: Sink | null) {
  sink = next
}

const PATTERNS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]'],
  [/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[pan]'],
  [/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, '[ifsc]'],
  [/(?<![\d.])-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}(?![\d.])/g, '[location]'],
  [/(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g, '[phone]'],
  [/(?<!\d)\d(?:[\s-]?\d){8,17}(?!\d)/g, '[number]'],
  [/\/proposal\/accept\/[^\s/?#]+/g, '/proposal/accept/[token]'],
  [/(?:Bearer|token=|key=)\s*[\w.~+/-]+=*/gi, '[secret]'],
]

/** Remove personal, financial and credential-shaped data from free text. */
export function scrubForReport(text: string, maxLength = 300): string {
  let out = text
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement)
  return out.length > maxLength ? `${out.slice(0, maxLength)}…` : out
}

export function reportError(error: unknown, context: { area: string; digest?: string }) {
  if (!sink) return
  const err = error instanceof Error ? error : new Error(String(error))
  try {
    sink({ name: err.name, message: scrubForReport(err.message), area: context.area, digest: context.digest })
  } catch {
    /* monitoring must never break the page */
  }
}
