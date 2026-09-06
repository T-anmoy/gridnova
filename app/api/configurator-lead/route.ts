import { NextResponse } from "next/server";
import { Resend } from "resend";

interface ConfiguratorLeadBody {
  customerType: "residential" | "society";
  name: string;
  phone: string;
  email: string;
  state?: string;
  city?: string;
  pinCode?: string;
  discom?: string;
  sizingMethod?: string;
  averageMonthlyBill?: string;
  monthlyUnits?: string;
  roofAreaSqFt?: string;
  connectionPhase?: string;
  tier?: string;
  roofType?: string;
  floors?: string;
  accessDifficulty?: string;
  shading?: string;
  subsidyInterest?: "yes" | "no";
  indicativeTotalInr?: number;
  website?: string; // honeypot — real users never fill this
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toFloat(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

// Mirrors app/api/estimate-request/route.ts's own pattern exactly (Resend
// send first and unconditional, then a separate, isolated, best-effort
// backend mirror) rather than sharing code with it — that file is out of
// scope for this change.
export async function POST(request: Request) {
  let body: ConfiguratorLeadBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  // Honeypot — bots fill this field, real users never see it. Reject silently
  // (as a generic success) so bots get no signal their submission was caught.
  if (body.website) {
    return NextResponse.json({ success: true });
  }

  const { customerType, name, phone, email } = body;
  if (!customerType || !name || !phone || !email) {
    return NextResponse.json(
      { success: false, error: "Name, phone, email and customer type are required." },
      { status: 400 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.ESTIMATE_NOTIFY_EMAIL || "info@gridnova.in";
  if (!apiKey || !notifyEmail) {
    console.error(
      "Solar Calculator lead received but RESEND_API_KEY / ESTIMATE_NOTIFY_EMAIL is not configured."
    );
    return NextResponse.json(
      {
        success: false,
        error: "This form is not fully configured yet. Please call or email us directly.",
      },
      { status: 503 }
    );
  }

  const recipients = notifyEmail
    .split(",")
    .map((addr) => addr.trim())
    .filter(Boolean);

  const rows: [string, string | undefined][] = [
    ["Customer Type", customerType],
    ["Name", name],
    ["Phone", phone],
    ["Email", email],
    ["State", body.state],
    ["City", body.city],
    ["PIN Code", body.pinCode],
    ["DISCOM", body.discom],
    ["Sizing Method", body.sizingMethod],
    ["Average Monthly Bill", body.averageMonthlyBill],
    ["Average Monthly Units (kWh)", body.monthlyUnits],
    ["Roof Area (sq ft)", body.roofAreaSqFt],
    ["Connection Phase", body.connectionPhase],
    ["Equipment Tier", body.tier],
    ["Roof Type", body.roofType],
    ["Number of Floors", body.floors],
    ["Site Access Difficulty", body.accessDifficulty],
    ["Shading Condition", body.shading],
    ["Interested in PM Surya Ghar Subsidy", body.subsidyInterest === "yes" ? "Yes" : body.subsidyInterest === "no" ? "No" : undefined],
    [
      "Indicative Estimate Shown",
      body.indicativeTotalInr != null ? `₹${body.indicativeTotalInr.toLocaleString("en-IN")}` : undefined,
    ],
  ];

  const htmlRows = rows
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px;color:#555;font-weight:600;">${escapeHtml(
          label
        )}</td><td style="padding:6px 12px;">${escapeHtml(String(value))}</td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:560px;">
      <h2 style="color:#0e2a63;">New Solar Calculator Lead</h2>
      <table style="border-collapse:collapse;width:100%;">${htmlRows}</table>
    </div>
  `;

  const text = rows
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "Grid Nova Solar Calculator <estimates@gridnova.in>",
      to: recipients,
      subject: `New Solar Calculator Lead — ${customerType} — ${name}`,
      html,
      text,
    });

    if (error) {
      console.error("Resend failed to send Solar Calculator lead email:", error);
      return NextResponse.json(
        {
          success: false,
          error: "We couldn't send your request right now. Please call us directly.",
        },
        { status: 502 }
      );
    }

    // Best-effort mirror into the backend, exactly the same discipline as
    // app/api/estimate-request/route.ts: isolated try/catch, a short timeout
    // so an unreachable/slow backend can't delay this response, and a
    // server-side log on failure instead of surfacing anything to the caller.
    // Reuses the same backend endpoint /estimate already mirrors to — its
    // accepted fields already cover everything this configurator collects,
    // so no new backend Lead-creation endpoint was needed.
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    try {
      await fetch(`${apiBase}/api/v1/public/estimate-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          customer_type: customerType,
          state: body.state || undefined,
          city: body.city || undefined,
          average_bill: toFloat(body.averageMonthlyBill),
          roof_type: body.roofType || undefined,
          roof_area: toFloat(body.roofAreaSqFt),
          connection_phase: body.connectionPhase || undefined,
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (backendErr) {
      console.error(
        "Backend Solar Calculator lead mirror failed (non-fatal — customer's email already sent):",
        backendErr
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Unexpected error sending Solar Calculator lead email:", err);
    return NextResponse.json(
      {
        success: false,
        error: "We couldn't send your request right now. Please call us directly.",
      },
      { status: 500 }
    );
  }
}
