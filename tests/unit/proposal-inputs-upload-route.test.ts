// @vitest-environment node
//
// This suite exercises real multipart Request/FormData round-tripping, which
// jsdom's fetch polyfill doesn't fully implement (it loses the file's
// filename and constructs FormData from a different realm than the test's
// own FormData global). Route Handlers actually run on Node/undici in
// production, so the Node environment here is the more faithful one, not a
// workaround.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));

function makeUploadRequest(file: File, target = "document", documentType = "electricity_bill") {
  const form = new FormData();
  form.set("file", file);
  form.set("target", target);
  form.set("document_type", documentType);
  return new Request("http://localhost/api/proposal-inputs/501/upload", { method: "POST", body: form });
}

function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) };
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

describe("POST /api/proposal-inputs/[id]/upload", () => {
  it("returns an honest 401 and never calls the backend without a real Clerk session", async () => {
    mockAuth.mockResolvedValue({ getToken: async () => null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/proposal-inputs/[id]/upload/route");
    const res = await POST(makeUploadRequest(new File(["x"], "bill.pdf", { type: "application/pdf" })), ctxFor("501"));

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the real file bytes as multipart form data with the caller's bearer token", async () => {
    mockAuth.mockResolvedValue({ getToken: async () => "real-clerk-jwt" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 501, document_refs: [{ type: "electricity_bill", filename: "bill.pdf" }] }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["real pdf bytes"], "bill.pdf", { type: "application/pdf" });
    const { POST } = await import("@/app/api/proposal-inputs/[id]/upload/route");
    const res = await POST(makeUploadRequest(file), ctxFor("501"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/api/v1/proposal-inputs/501/upload");
    expect(options.headers.Authorization).toBe("Bearer real-clerk-jwt");
    expect(options.body).toBeInstanceOf(FormData);
    const sentFile = options.body.get("file") as File;
    expect(sentFile.name).toBe("bill.pdf");
    expect(await sentFile.text()).toBe("real pdf bytes");
  });

  it("reports storage_not_configured as a distinct, honest failure — never a fake success", async () => {
    mockAuth.mockResolvedValue({ getToken: async () => "real-clerk-jwt" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ detail: { code: "storage_not_configured", message: "R2 storage is not configured" } }),
        { status: 503 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/proposal-inputs/[id]/upload/route");
    const res = await POST(
      makeUploadRequest(new File(["x"], "bill.pdf", { type: "application/pdf" })),
      ctxFor("501")
    );

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe("storage_not_configured");
    expect(data.error).toMatch(/not saved/i);
  });

  it("passes through other real backend errors (e.g. unsupported file type) honestly", async () => {
    mockAuth.mockResolvedValue({ getToken: async () => "real-clerk-jwt" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Unsupported file type: 'text/plain'." }), { status: 422 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/proposal-inputs/[id]/upload/route");
    const res = await POST(
      makeUploadRequest(new File(["x"], "notes.txt", { type: "text/plain" })),
      ctxFor("501")
    );

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Unsupported file type");
  });

  it("reports an honest 502 when the backend is unreachable", async () => {
    mockAuth.mockResolvedValue({ getToken: async () => "real-clerk-jwt" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const { POST } = await import("@/app/api/proposal-inputs/[id]/upload/route");
    const res = await POST(
      makeUploadRequest(new File(["x"], "bill.pdf", { type: "application/pdf" })),
      ctxFor("501")
    );

    expect(res.status).toBe(502);
    expect((await res.json()).success).toBe(false);
  });
});
