import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));

const VALID_BODY = {
  customerType: "individual",
  fullName: "Ravi Sharma",
  contactNumber: "9874774440",
  email: "ravi@example.com",
  referenceLeadId: "1042",
  projectType: "Rooftop Solar",
  linkedToGovtScheme: "no",
  state: "West Bengal",
  districtCity: "Hooghly",
  pinCode: "712235",
  discom: "WBSEDCL",
  siteType: "Rooftop (Residential building)",
  siteAreaSqFt: "800",
  avgMonthlyBill: "3500",
  connectionPhase: "Single Phase",
  primaryObjective: "Reduce electricity bill",
  connectionType: "on-grid",
  dcrRequired: "no",
  evChargingIntegration: "no",
  batteryStorageIntegration: "no",
  website: "",
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/proposal-inputs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000");
  mockAuth.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/proposal-inputs", () => {
  it("silently accepts a honeypot-filled submission without ever contacting the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/proposal-inputs/route");
    const res = await POST(makeRequest({ ...VALID_BODY, website: "bot-filled-this" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockAuth).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a structurally invalid body before ever checking auth or the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/proposal-inputs/route");
    const res = await POST(makeRequest({ ...VALID_BODY, fullName: "" }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Full name is required");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unmapped enum value with a clear 422, never guessing a backend value", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await import("@/app/api/proposal-inputs/route");
    const res = await POST(makeRequest({ ...VALID_BODY, projectType: "Something Not On The Real List" }));

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Unknown project type");
  });

  it("returns an honest 401 and never calls the backend when there is no real Clerk session", async () => {
    mockAuth.mockResolvedValue({ getToken: async () => null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/proposal-inputs/route");
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("sign in as a Grid Nova staff member");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps every field onto the real backend contract and forwards the caller's own session token", async () => {
    mockAuth.mockResolvedValue({ getToken: async () => "real-clerk-jwt" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 501, status: "submitted" }), { status: 201 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/proposal-inputs/route");
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, inputs_id: 501 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/api/v1/proposal-inputs/");
    expect(options.headers.Authorization).toBe("Bearer real-clerk-jwt");

    const sentBody = JSON.parse(options.body);
    expect(sentBody).toMatchObject({
      lead_id: 1042,
      customer_type: "individual",
      project_family: "rooftop_solar",
      scheme_linked: false,
      scheme_name: "none",
      state: "West Bengal",
      district: "Hooghly",
      pin_code: "712235",
      site_type: "rooftop_residential",
      roof_area_sqft: 800,
      avg_monthly_bill_inr: 3500,
      connection_phase: "single_phase",
      connection_type: "on_grid",
      net_metering_required: false,
      dcr_panels_required: false,
      ev_charging: false,
      battery_storage: false,
    });
    // Fields with no real backend column (name/phone/email, primary
    // objective) are preserved in additional_requirements, never dropped.
    expect(sentBody.additional_requirements).toContain("Ravi Sharma");
    expect(sentBody.additional_requirements).toContain("9874774440");
    expect(sentBody.additional_requirements).toContain("ravi@example.com");
    expect(sentBody.additional_requirements).toContain("Reduce electricity bill");
  });

  it("passes through the real backend error and status honestly (e.g. an unknown Lead ID)", async () => {
    mockAuth.mockResolvedValue({ getToken: async () => "real-clerk-jwt" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Lead not found" }), { status: 404 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/proposal-inputs/route");
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Lead not found");
  });

  it("reports an honest 502 when the backend is unreachable, rather than a false success", async () => {
    mockAuth.mockResolvedValue({ getToken: async () => "real-clerk-jwt" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const { POST } = await import("@/app/api/proposal-inputs/route");
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.success).toBe(false);
  });
});
