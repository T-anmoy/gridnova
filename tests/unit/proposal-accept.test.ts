import { describe, it, expect } from "vitest";
import {
  normalizeAcceptResponse,
  isAccepted,
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
    });
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
  it("maps 404 to notfound, 410 to expired, 409 to accepted (reused token)", () => {
    expect(screenForHttpStatus(404)).toBe("notfound");
    expect(screenForHttpStatus(410)).toBe("expired");
    expect(screenForHttpStatus(409)).toBe("accepted");
  });
  it("maps other errors to error", () => {
    expect(screenForHttpStatus(500)).toBe("error");
    expect(screenForHttpStatus(403)).toBe("error");
  });
});
