import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { en, withI18n } from "./helpers/i18n";
import { ApiError } from "@/lib/dashboard/api-error";
import type { PaginatedTerritoryMembers, TerritoryMemberListParams } from "@/lib/associate/types";

// GET /api/v1/associate/territory/members — shapes below are copied from the
// pasted Phase 3A contract, including the capability/level exclusivity.
const hookState: {
  data?: PaginatedTerritoryMembers;
  error?: unknown;
  isLoading: boolean;
  calls: TerritoryMemberListParams[];
} = { isLoading: false, calls: [] };

vi.mock("@/lib/associate/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/associate/api-client")>()),
  useTerritoryMembers: (params: TerritoryMemberListParams) => {
    hookState.calls.push(params);
    return { data: hookState.data, error: hookState.error, isLoading: hookState.isLoading, refetch: vi.fn() };
  },
}));

vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ getToken: async () => "tok" }) }));

const copy = en.associates.portal.preferred.territory;

const page = (over: Partial<PaginatedTerritoryMembers> = {}): PaginatedTerritoryMembers => ({
  items: [
    {
      associate_id: "GNA-WB-26-00012",
      full_name: "Asha Roy",
      associate_type: "associate",
      capability: "sales",
      level: null,
      status: "active",
      customer_count: 2,
      verified_customer_count: 1,
    },
    {
      associate_id: "GNP-WB-26-00003",
      full_name: "Bikash Das",
      associate_type: "preferred_associate",
      capability: null,
      level: "block",
      status: "suspended",
      customer_count: 7,
      verified_customer_count: 4,
    },
  ],
  page: 1,
  page_size: 25,
  total: 2,
  ...over,
});

async function renderRoster() {
  const { default: PortalTerritory } = await import("@/components/associate/PortalTerritory");
  return render(withI18n(<PortalTerritory copy={copy} />));
}

beforeEach(() => {
  hookState.data = undefined;
  hookState.error = undefined;
  hookState.isLoading = false;
  hookState.calls = [];
});

describe("Preferred portal — My Territory roster", () => {
  it("lists members with role, status and both customer counts", async () => {
    hookState.data = page();
    await renderRoster();
    expect(screen.getByText("Asha Roy")).toBeInTheDocument();
    expect(screen.getByText("Associate · Sales")).toBeInTheDocument();
    expect(screen.getByText("Preferred Associate · Block Associate")).toBeInTheDocument();
    expect(within(screen.getByRole("list")).getByText("Suspended")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("2 in your network")).toBeInTheDocument();
  });

  it("lists inactive members by default (no status filter sent)", async () => {
    hookState.data = page();
    await renderRoster();
    expect(hookState.calls.at(-1)).toEqual({ page: 1, page_size: 25, status: undefined, associate_type: undefined });
  });

  it("sends the status/type filters and resets to page 1 when they change", async () => {
    hookState.data = page({ total: 60 });
    await renderRoster();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(hookState.calls.at(-1)?.page).toBe(2);

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "active" } });
    expect(hookState.calls.at(-1)).toMatchObject({ page: 1, status: "active" });

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "preferred_associate" } });
    expect(hookState.calls.at(-1)).toMatchObject({ page: 1, status: "active", associate_type: "preferred_associate" });
  });

  it("paginates from total/page_size", async () => {
    hookState.data = page({ total: 60 });
    await renderRoster();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
  });

  it("uses a different empty message when filters are applied", async () => {
    hookState.data = page({ items: [], total: 0 });
    await renderRoster();
    expect(screen.getByText(copy.empty.title)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "deactivated" } });
    expect(screen.getByText(copy.emptyFiltered.title)).toBeInTheDocument();
  });

  it("shows the localized roster message for the plain-Associate 403", async () => {
    hookState.error = new ApiError(403, "API error 403", "Only Preferred Associates have a territory roster.");
    await renderRoster();
    expect(screen.getByText(copy.notPreferred)).toBeInTheDocument();
  });

  it("does not mistake a suspended-account 403 for the plain-Associate case", async () => {
    hookState.error = new ApiError(403, "API error 403", "This associate account is suspended");
    await renderRoster();
    expect(screen.queryByText(copy.notPreferred)).not.toBeInTheDocument();
  });
});

describe("useTerritoryMembers request", () => {
  it("calls the contract path with the associate token and only the set params", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(page()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { useTerritoryMembers } = await vi.importActual<typeof import("@/lib/associate/api-client")>(
      "@/lib/associate/api-client",
    );

    function Probe() {
      const { data } = useTerritoryMembers({ page: 2, page_size: 25, status: "active", associate_type: undefined });
      return <p>{data ? data.total : "…"}</p>;
    }
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Probe />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/associate\/territory\/members\?page=2&page_size=25&status=active$/);
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok");
    vi.unstubAllGlobals();
  });
});
