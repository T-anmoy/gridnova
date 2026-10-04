import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/dashboard/api-error";
import { shouldRetryTerritoryLookup, useTerritoryStates } from "@/lib/associate/api-client";

afterEach(() => vi.unstubAllGlobals());

describe("shouldRetryTerritoryLookup", () => {
  it("retries network and 5xx failures, at most twice", () => {
    expect(shouldRetryTerritoryLookup(0, new ApiError(0, "x"))).toBe(true);
    expect(shouldRetryTerritoryLookup(1, new ApiError(500, "x"))).toBe(true);
    expect(shouldRetryTerritoryLookup(0, new ApiError(502, "x"))).toBe(true);
    expect(shouldRetryTerritoryLookup(2, new ApiError(500, "x"))).toBe(false);
  });

  it("never retries 4xx, 503, or unknown errors", () => {
    for (const status of [400, 404, 422, 429, 503]) {
      expect(shouldRetryTerritoryLookup(0, new ApiError(status, "x"))).toBe(false);
    }
    expect(shouldRetryTerritoryLookup(0, new Error("boom"))).toBe(false);
  });
});

describe("useTerritoryStates", () => {
  function wrapper({ children }: { children: React.ReactNode }) {
    // The provider's own default is retry: false; the hook must override it.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  it("makes a single request for a 503 and exposes the structured code", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: { code: "territories_not_seeded", message: "Territory data has not been loaded yet." } }), { status: 503 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useTerritoryStates(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((result.current.error as ApiError).structuredDetail?.code).toBe("territories_not_seeded");
  });

  it("does not refetch on window focus", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useTerritoryStates(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
