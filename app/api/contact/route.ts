import { handleLeadRequest } from "@/lib/lead-capture";
import { contactMirrorPayload } from "@/lib/lead-mirror";
import { contactSchema } from "@/lib/lead-schemas";

// The contact form. Validation mirrors the limits of the backend's own
// POST /api/v1/public/contact, so an obviously-invalid message never reaches
// Resend or the CRM. The email's reply-to is the visitor's address.
export async function POST(request: Request) {
  return handleLeadRequest(request, {
    route: "contact",
    schema: contactSchema,
    email: (d) => ({
      from: "Grid Nova Contact Form <estimates@gridnova.in>",
      subject: `New Contact Form Message — ${d.name}`,
      heading: "New Contact Form Message",
      rows: [
        ["Name", d.name],
        ["Email", d.email],
        ["Phone", d.phone],
        ["Interest", d.interest],
      ],
      message: d.message,
      replyTo: d.email,
    }),
    mirror: { path: "/api/v1/public/contact", label: "contact", payload: contactMirrorPayload },
    failureMessage: "We couldn't send your message right now. Please call us directly.",
  });
}
