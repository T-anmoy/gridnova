import { describe, it, expect } from "vitest";
import {
  normalizeAcceptResponse,
  isAccepted,
  isExpired,
  screenForHttpStatus,
} from "@/lib/proposal-accept";

describe("normalizeAcceptResponse", () => {
  it("reads canonical fields", () => {
    const v = normalizeAcceptResponse({
      id: 7,
      status: "pending",
      total_value: 250000,
      valid_until: "2026-03-01",
      customer_name: "Ravi Sharma",
      company: "Acme Pvt Ltd",
      scope: "12 kW rooftop system",
      accepted_at: null,
    });
    expect(v).toEqual({
      id: 7,
      customerName: "Ravi Sharma",
      company: "Acme Pvt Ltd",
      scope: "12 kW rooftop system",
      totalValue: 250000,
      validUntil: "2026-03-01",
      status: "pending",
      acceptedAt: null,
      pdfAvailable: false,
      document: null,
    });
  });

  it("falls back across plausible backend field names", () => {
    const v = normalizeAcceptResponse({
      proposal_id: 9,
      price: 99999,
      validity: "2026-04-01",
      customer: { name: "Meera", company: "Sun Co" },
      content: { scope_of_work: "Ground-mount 50 kW" },
    });
    expect(v.id).toBe(9);
    expect(v.totalValue).toBe(99999);
    expect(v.validUntil).toBe("2026-04-01");
    expect(v.customerName).toBe("Meera");
    expect(v.company).toBe("Sun Co");
    expect(v.scope).toBe("Ground-mount 50 kW");
  });

  it("returns all-null view for empty/undefined input", () => {
    const v = normalizeAcceptResponse(undefined);
    expect(v).toEqual({
      id: null, customerName: null, company: null, scope: null,
      totalValue: null, validUntil: null, status: null, acceptedAt: null,
      pdfAvailable: false,
      document: null,
    });
  });

  it("joins the real backend shape: scope as an array of {id, body} sections", () => {
    const v = normalizeAcceptResponse({
      proposal_id: 1,
      version: 1,
      scope: [
        { id: "commercial_rooftop_scope", body: "Structural assessment and system design." },
        { id: "install_note", body: "Installation within 4-6 weeks of signoff." },
      ],
      price: 450000,
      valid_until: "2026-09-14T22:29:43.012373",
      state: "acceptable",
      accepted_at: null,
    });
    expect(v.scope).toBe(
      "Structural assessment and system design.\n\nInstallation within 4-6 weeks of signoff."
    );
    expect(v.totalValue).toBe(450000);
    expect(v.status).toBe("acceptable");
  });

  it("skips sections with no body and returns null scope for an empty array", () => {
    expect(normalizeAcceptResponse({ scope: [] }).scope).toBeNull();
    expect(normalizeAcceptResponse({ scope: [{ id: "x", body: null }] }).scope).toBeNull();
  });

  it("only reports the PDF available when the backend says pdf_available is exactly true", () => {
    expect(normalizeAcceptResponse({ pdf_available: true }).pdfAvailable).toBe(true);
    expect(normalizeAcceptResponse({ pdf_available: false }).pdfAvailable).toBe(false);
    expect(normalizeAcceptResponse({}).pdfAvailable).toBe(false);
  });

  it("reads the POST accept response's `status` field the same as GET's `state`", () => {
    const v = normalizeAcceptResponse({
      status: "accepted",
      proposal_id: 1,
      accepted_at: "2026-01-02T00:00:00Z",
    });
    expect(v.status).toBe("accepted");
  });
});

describe("isExpired", () => {
  it("is true when the GET response's state is expired", () => {
    expect(isExpired(normalizeAcceptResponse({ state: "expired" }))).toBe(true);
  });
  it("is false for an acceptable or accepted proposal", () => {
    expect(isExpired(normalizeAcceptResponse({ state: "acceptable" }))).toBe(false);
    expect(isExpired(normalizeAcceptResponse({ state: "accepted" }))).toBe(false);
  });
});

describe("isAccepted", () => {
  it("is true when status is accepted", () => {
    expect(isAccepted(normalizeAcceptResponse({ status: "accepted" }))).toBe(true);
  });
  it("is true when acceptedAt is present even without status", () => {
    expect(isAccepted(normalizeAcceptResponse({ accepted_at: "2026-01-02" }))).toBe(true);
  });
  it("is false for a pending proposal", () => {
    expect(isAccepted(normalizeAcceptResponse({ status: "pending" }))).toBe(false);
  });
});

describe("screenForHttpStatus", () => {
  it("maps success to ready", () => {
    expect(screenForHttpStatus(200)).toBe("ready");
  });
  it("maps 404 to notfound, 410 and 409 to expired", () => {
    // The backend's POST accept handler only ever returns 409 for an expired
    // proposal — accepting an already-accepted proposal is a 200 (idempotent
    // success with already_accepted: true), never a 409. See
    // app/api/routes/public_proposals.py::accept_proposal on the backend.
    expect(screenForHttpStatus(404)).toBe("notfound");
    expect(screenForHttpStatus(410)).toBe("expired");
    expect(screenForHttpStatus(409)).toBe("expired");
  });
  it("maps other errors to error", () => {
    expect(screenForHttpStatus(500)).toBe("error");
    expect(screenForHttpStatus(403)).toBe("error");
  });
});
