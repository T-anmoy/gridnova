import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function MockResend() {
    return { emails: { send: (...args: unknown[]) => sendMock(...args) } };
  }),
}));

const VALID_BODY = {
  name: "Ravi Sharma",
  email: "ravi@example.com",
  phone: "9876543210",
  interest: "Residential Rooftop",
  message: "I would like a quote for a 5kW rooftop system on my house.",
  website: "",
};

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("ESTIMATE_NOTIFY_EMAIL", "info@gridnova.in");
  sendMock.mockReset();
  sendMock.mockResolvedValue({ data: { id: "mock-email-id" }, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/contact", () => {
  it("silently accepts a honeypot-filled submission without contacting Resend or the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(makeRequest({ ...VALID_BODY, website: "bot-filled-this" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(sendMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...VALID_BODY, name: "" }, "Name is required."],
    [{ ...VALID_BODY, name: "x".repeat(201) }, "Name must be 200 characters or fewer."],
    [{ ...VALID_BODY, email: "not-an-email" }, "Enter a valid email address."],
    [{ ...VALID_BODY, phone: "1".repeat(31) }, "Phone must be 30 characters or fewer."],
    [{ ...VALID_BODY, message: "" }, "Message is required."],
    [{ ...VALID_BODY, message: "x".repeat(2001) }, "Message must be 2000 characters or fewer."],
    [{ ...VALID_BODY, interest: "x".repeat(101) }, "Interest must be 100 characters or fewer."],
  ])("rejects invalid input (%#) before contacting Resend", async (body, expectedError) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(makeRequest(body));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe(expectedError);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("escapes HTML in the message before embedding it in the notification email", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    const { POST } = await import("@/app/api/contact/route");
    await POST(makeRequest({ ...VALID_BODY, message: "<script>alert('xss')</script>" }));

    expect(sendMock).toHaveBeenCalledTimes(1);
    const sentEmail = sendMock.mock.calls[0][0];
    expect(sentEmail.html).not.toContain("<script>alert");
    expect(sentEmail.html).toContain("&lt;script&gt;");
  });

  it("sends with reply_to set to the visitor's email, from a gridnova.in sender", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    const { POST } = await import("@/app/api/contact/route");
    await POST(makeRequest(VALID_BODY));

    const sentEmail = sendMock.mock.calls[0][0];
    expect(sentEmail.replyTo).toBe("ravi@example.com");
    expect(sentEmail.from).toContain("@gridnova.in");
  });

  it("returns 503 and never calls Resend when RESEND_API_KEY is unset", async () => {
    vi.unstubAllEnvs();
    // Blank, not merely "not stubbed": a developer's .env.local may hold a real key, and this test
    // must not depend on the machine it runs on.
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("ESTIMATE_NOTIFY_EMAIL", "info@gridnova.in");
    // With no email channel the route falls back to the CRM mirror; keep it off the network so a
    // backend running on this machine cannot turn the 503 into a 200 (and receive a test lead).
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("call or email us directly");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("mirrors the enquiry into the CRM via POST /api/v1/public/contact with the mapped fields", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ lead_id: 1, success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/api/v1/public/contact");
    const sentBody = JSON.parse(options.body);
    expect(sentBody).toEqual({
      name: "Ravi Sharma",
      email: "ravi@example.com",
      phone: "9876543210",
      message: VALID_BODY.message,
      interest: "Residential Rooftop",
    });
  });

  it("still returns success to the visitor when the CRM mirror is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("@/app/api/contact/route");
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    // The CRM mirror runs alongside (and after) the response, so wait for its log.
    await vi.waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Backend contact mirror failed"), expect.any(Error))
    );
  });
});
