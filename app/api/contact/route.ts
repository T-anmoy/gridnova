import { NextResponse } from "next/server";
import { Resend } from "resend";
import { mirrorToBackend } from "@/lib/backend-mirror";

interface ContactBody {
  name: string;
  email: string;
  phone?: string;
  message: string;
  interest?: string;
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

// Mirrors the same limits the backend's own POST /api/v1/public/contact
// enforces (grid-nova-ai-backend Prompt 02b) — validated here first so an
// obviously-invalid submission never reaches Resend or the mirror at all.
function validate(body: ContactBody): string | null {
  const name = body.name?.trim() ?? "";
  if (!name) return "Name is required.";
  if (name.length > 200) return "Name must be 200 characters or fewer.";
  const email = body.email?.trim() ?? "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "Enter a valid email address.";
  if (body.phone && body.phone.length > 30) return "Phone must be 30 characters or fewer.";
  const message = body.message?.trim() ?? "";
  if (!message) return "Message is required.";
  if (message.length > 2000) return "Message must be 2000 characters or fewer.";
  if (body.interest && body.interest.length > 100) return "Interest must be 100 characters or fewer.";
  return null;
}

export async function POST(request: Request) {
  let body: ContactBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  // Honeypot — bots fill this field, real users never see it. Reject
  // silently (as a generic success) so bots get no signal their submission
  // was caught.
  if (body.website) {
    return NextResponse.json({ success: true });
  }

  const validationError = validate(body);
  if (validationError) {
    return NextResponse.json({ success: false, error: validationError }, { status: 400 });
  }

  const { name, email, phone, message, interest } = body;

  const apiKey = process.env.RESEND_API_KEY;
  // Same fallback the existing estimate/configurator routes use, so this
  // stays correct even if the env var doesn't carry over to a future deploy
  // target.
  const notifyEmail = process.env.ESTIMATE_NOTIFY_EMAIL || "info@gridnova.in";
  if (!apiKey || !notifyEmail) {
    console.error("Contact form message received but RESEND_API_KEY / ESTIMATE_NOTIFY_EMAIL is not configured.");
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
    ["Name", name],
    ["Email", email],
    ["Phone", phone],
    ["Interest", interest],
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
      <h2 style="color:#0e2a63;">New Contact Form Message</h2>
      <table style="border-collapse:collapse;width:100%;">${htmlRows}</table>
      <p style="margin-top:16px;color:#111827;white-space:pre-wrap;">${escapeHtml(message)}</p>
    </div>
  `;

  const text = [
    ...rows.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`),
    "",
    `Message:\n${message}`,
  ].join("\n");

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "Grid Nova Contact Form <estimates@gridnova.in>",
      to: recipients,
      replyTo: email,
      subject: `New Contact Form Message — ${name}`,
      html,
      text,
    });

    if (error) {
      console.error("Resend failed to send contact form email:", error);
      return NextResponse.json(
        { success: false, error: "We couldn't send your message right now. Please call us directly." },
        { status: 502 }
      );
    }

    // Best-effort mirror into the backend CRM — awaited (bounded by its own
    // 5s timeout) so it actually runs to completion before this serverless
    // function's response ends execution, but its outcome never affects
    // what the visitor sees (the Resend send above already determined
    // success).
    await mirrorToBackend(
      "/api/v1/public/contact",
      { name, email, phone: phone || undefined, message, interest: interest || undefined },
      request,
      "contact"
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Unexpected error sending contact form email:", err);
    return NextResponse.json(
      { success: false, error: "We couldn't send your message right now. Please call us directly." },
      { status: 500 }
    );
  }
}
