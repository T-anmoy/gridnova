import { describe, it, expect, vi, afterEach } from "vitest";
import { mirrorToBackend, getClientIp } from "@/lib/backend-mirror";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getClientIp", () => {
  it("reads the first address from x-forwarded-for, the header Vercel's edge sets", () => {
    const req = new Request("http://localhost/", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } });
    expect(getClientIp(req)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = new Request("http://localhost/", { headers: { "x-real-ip": "203.0.113.9" } });
    expect(getClientIp(req)).toBe("203.0.113.9");
  });

  it("returns undefined when neither header is present", () => {
    const req = new Request("http://localhost/");
    expect(getClientIp(req)).toBeUndefined();
  });
});

describe("mirrorToBackend", () => {
  it("sends X-Internal-Key and X-Customer-IP when INTERNAL_API_KEY is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000");
    vi.stubEnv("INTERNAL_API_KEY", "secret-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/contact", { headers: { "x-forwarded-for": "198.51.100.4" } });
    await mirrorToBackend("/api/v1/public/contact", { name: "Ravi" }, req, "contact");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/api/v1/public/contact");
    expect(options.headers["X-Internal-Key"]).toBe("secret-key");
    expect(options.headers["X-Customer-IP"]).toBe("198.51.100.4");
  });

  it("omits both headers entirely when INTERNAL_API_KEY is unset — identical to pre-existing behaviour", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/contact", { headers: { "x-forwarded-for": "198.51.100.4" } });
    await mirrorToBackend("/api/v1/public/contact", { name: "Ravi" }, req, "contact");

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["X-Internal-Key"]).toBeUndefined();
    expect(options.headers["X-Customer-IP"]).toBeUndefined();
  });

  it("logs the real status code (not just thrown errors) when the backend responds non-2xx", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "rate limited" }), { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await mirrorToBackend("/api/v1/public/estimate-request", { name: "Ravi" }, new Request("http://localhost/"), "estimate-request");

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Backend estimate-request mirror returned 429"));
  });

  it("never throws — a network failure is logged, not propagated", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8001");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      mirrorToBackend("/api/v1/public/contact", { name: "Ravi" }, new Request("http://localhost/"), "contact")
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Backend contact mirror failed (non-fatal"), expect.any(Error));
  });
});
