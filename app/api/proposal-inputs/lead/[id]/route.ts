import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Trimmed lead pre-fill for the site-assessment wizard (app/proposal/new),
// used only when the wizard is opened with a `?leadId=` param from a lead's
// dashboard detail page. The wizard page itself has no ClerkProvider (it
// posts through server-routed Route Handlers, same pattern as
// app/api/proposal-inputs/route.ts), so it can't call the dashboard's
// client-side `useLead` hook — this thin server route does the same
// server-side auth() + fetch instead and returns only the fields the wizard
// can pre-fill. The real GET /api/v1/dashboard/leads/{id} customer shape has
// no phone field, so `phone` here is always null — never fabricated.

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface DashboardLeadDetail {
  lead_id: number;
  customer: { name: string; email: string } | null;
}

export async function GET(_request: Request, ctx: RouteContext<"/api/proposal-inputs/lead/[id]">) {
  const { id } = await ctx.params;

  const session = await auth();
  const token = await session.getToken();
  if (!token) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/dashboard/leads/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json({ success: false, error: "Could not reach the backend." }, { status: 502 });
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : `Lead lookup failed (${res.status})`;
    return NextResponse.json({ success: false, error: detail }, { status: res.status });
  }

  const lead = data as DashboardLeadDetail;
  return NextResponse.json({
    success: true,
    lead_id: lead.lead_id,
    full_name: lead.customer?.name ?? null,
    email: lead.customer?.email ?? null,
    phone: null,
  });
}
