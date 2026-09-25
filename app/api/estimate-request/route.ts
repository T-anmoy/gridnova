import { NextResponse } from "next/server";
import { Resend } from "resend";
import { mirrorToBackend } from "@/lib/backend-mirror";

type CustomerType = "residential" | "society";

interface EstimateRequestBody {
  customerType: CustomerType;
  name: string;
  phone: string;
  email: string;
  state: string;
  cityOrPin: string;
  averageMonthlyBill: string;
  roofType: string;
  roofAreaSqFt?: string;
  floors?: string;
  connectionPhase?: string;
  website?: string; // honeypot — real users never fill this
}

const FIELD_LABELS: Record<keyof Omit<EstimateRequestBody, "website">, string> = {
  customerType: "Customer Type",
  name: "Name",
  phone: "Phone",
  email: "Email",
  state: "State",
  cityOrPin: "City / PIN",
  averageMonthlyBill: "Average Monthly Bill",
  roofType: "Roof Type",
  roofAreaSqFt: "Roof Area (sq ft)",
  floors: "Floors",
  connectionPhase: "Connection Phase",
};

function toFloat(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

function toInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  let body: EstimateRequestBody;
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
      {
        success: false,
        error: "Name, phone, email and customer type are required.",
      },
      { status: 400 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  // Falls back to info@gridnova.in so this stays correct even if the env var
  // doesn't carry over to a future deploy target (e.g. a Vercel migration).
  // TODO: Add Raju Paul's direct email as a second recipient once supplied by Grid Nova.
  // Currently only info@gridnova.in receives these notifications.
  const notifyEmail = process.env.ESTIMATE_NOTIFY_EMAIL || "info@gridnova.in";
  if (!apiKey || !notifyEmail) {
    console.error(
      "Estimate request received but RESEND_API_KEY / ESTIMATE_NOTIFY_EMAIL is not configured."
    );
    return NextResponse.json(
      {
        success: false,
        error:
          "This form is not fully configured yet. Please call or email us directly.",
      },
      { status: 503 }
    );
  }

  const recipients = notifyEmail
    .split(",")
    .map((addr) => addr.trim())
    .filter(Boolean);

  const rows: [string, string | undefined][] = [
    [FIELD_LABELS.customerType, customerType],
    [FIELD_LABELS.name, name],
    [FIELD_LABELS.phone, phone],
    [FIELD_LABELS.email, email],
    [FIELD_LABELS.state, body.state],
    [FIELD_LABELS.cityOrPin, body.cityOrPin],
    [FIELD_LABELS.averageMonthlyBill, body.averageMonthlyBill],
    [FIELD_LABELS.roofType, body.roofType],
    [FIELD_LABELS.roofAreaSqFt, body.roofAreaSqFt],
    [FIELD_LABELS.floors, body.floors],
    [FIELD_LABELS.connectionPhase, body.connectionPhase],
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
      <h2 style="color:#0e2a63;">New Solar Estimate Request</h2>
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
      from: "Grid Nova Estimate Requests <estimates@gridnova.in>",
      to: recipients,
      subject: `New Solar Estimate Request — ${customerType} — ${name}`,
      html,
      text,
    });

    if (error) {
      console.error("Resend failed to send estimate request email:", error);
      return NextResponse.json(
        {
          success: false,
          error: "We couldn't send your request right now. Please call us directly.",
        },
        { status: 502 }
      );
    }

    // Best-effort mirror into the backend so this becomes a real Lead in the
    // ops dashboard. This must never affect what the customer sees — the
    // Resend send above already determined success. mirrorToBackend handles
    // the internal-key/customer-IP headers, the timeout, and logging a
    // non-2xx or network failure without surfacing anything to the caller.
    await mirrorToBackend(
      "/api/v1/public/estimate-request",
      {
        name,
        email,
        phone,
        customer_type: customerType,
        state: body.state || undefined,
        // The backend has one `city` field; the form collects a combined
        // "City / PIN Code" field with no separate PIN — passing it through
        // as-is is the closest honest mapping available.
        city: body.cityOrPin || undefined,
        average_bill: toFloat(body.averageMonthlyBill),
        roof_type: body.roofType || undefined,
        roof_area: toFloat(body.roofAreaSqFt),
        floors: toInt(body.floors),
        connection_phase: body.connectionPhase || undefined,
      },
      request,
      "estimate-request"
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Unexpected error sending estimate request email:", err);
    return NextResponse.json(
      {
        success: false,
        error: "We couldn't send your request right now. Please call us directly.",
      },
      { status: 500 }
    );
  }
}
