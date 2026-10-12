import { getClientIp } from "@/lib/backend-mirror";
import { rateLimit } from "@/lib/rate-limit";

// Receives Content-Security-Policy-Report-Only violation reports (see
// next.config.ts → lib/security-headers.ts) and writes one short log line per
// report, so the policy can be tuned from Vercel logs before it is enforced.
// Nothing is stored. Browsers send these unauthenticated, so it is limited per
// IP (in-memory, first layer only — see lib/rate-limit.ts) and never echoes input.
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (ip && !rateLimit(`csp-report:${ip}`, 30, 60_000).ok) return new Response(null, { status: 204 });
  try {
    const text = (await request.text()).slice(0, 4_000);
    const parsed = JSON.parse(text) as Record<string, Record<string, unknown> | undefined> & { "csp-report"?: Record<string, unknown> };
    const r = parsed["csp-report"] ?? parsed;
    const pick = (k: string) => String((r as Record<string, unknown>)[k] ?? "").slice(0, 200);
    console.warn(
      `[csp-report] directive=${pick("effective-directive") || pick("violated-directive")} blocked=${pick("blocked-uri")} document=${pick("document-uri")}`
    );
  } catch {
    /* malformed report — ignore */
  }
  return new Response(null, { status: 204 });
}
