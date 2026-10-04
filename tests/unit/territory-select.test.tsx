import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import { en } from "./helpers/i18n";
import { ApiError } from "@/lib/dashboard/api-error";
import TerritorySelect from "@/components/associate/TerritorySelect";
import type { TerritoryValue } from "@/lib/associate/territory";

// Each lookup is driven directly so every request state can be rendered.
type Lookup = { data?: unknown[]; isLoading?: boolean; isError?: boolean; error?: unknown; refetch?: () => void };
const lookups: { states: Lookup; districts: Lookup; blocks: Lookup } = { states: {}, districts: {}, blocks: {} };
vi.mock("@/lib/associate/api-client", () => ({
  useTerritoryStates: () => lookups.states,
  useTerritoryDistricts: () => lookups.districts,
  useTerritoryBlocks: () => lookups.blocks,
}));

const copy = en.associates.territory;
const STATES = [
  { lgd_code: 19, iso_code: "WB", name: "West Bengal" },
  { lgd_code: 10, iso_code: "BR", name: "Bihar" },
];
const DISTRICTS = [
  { lgd_code: 1901, name: "Howrah", has_blocks: true },
  { lgd_code: 1902, name: "Hooghly", has_blocks: false },
];
const BLOCKS = [
  { lgd_code: 190101, name: "Bally" },
  { lgd_code: 190102, name: "Uluberia" },
];

function Harness({ initial, depth, onValue }: { initial?: Partial<TerritoryValue>; depth?: "state" | "district" | "block"; onValue?: (v: TerritoryValue) => void }) {
  const [value, setValue] = useState<TerritoryValue>({ state: "", district: "", block: "", ...initial });
  return (
    <TerritorySelect
      idPrefix="t"
      copy={copy}
      value={value}
      depth={depth}
      onChange={(n) => {
        setValue(n);
        onValue?.(n);
      }}
      labels={{ state: "State", district: "District", block: "Block" }}
      inputClass={() => "input"}
      renderField={({ id, label, children }) => (
        <div>
          <label htmlFor={id}>{label}</label>
          {children}
        </div>
      )}
    />
  );
}

beforeEach(() => {
  lookups.states = { data: STATES };
  lookups.districts = {};
  lookups.blocks = {};
});
afterEach(() => vi.unstubAllEnvs());

describe("TerritorySelect", () => {
  it("shows a loading skeleton, not an empty select, while states load", () => {
    lookups.states = { isLoading: true };
    render(<Harness />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByLabelText("State")).toBeNull();
  });

  it("shows a plain message and a working Retry when the request fails", () => {
    const refetch = vi.fn();
    lookups.states = { isError: true, error: new ApiError(500, "API error 500"), refetch };
    render(<Harness />);
    expect(screen.getByRole("alert")).toHaveTextContent(copy.loadError);
    fireEvent.click(screen.getByRole("button", { name: copy.retry }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows 'not open yet' for the 503 territories_not_seeded answer", () => {
    lookups.states = {
      isError: true,
      error: new ApiError(503, "API error 503", "Territory data has not been loaded yet.", { code: "territories_not_seeded" }),
      refetch: vi.fn(),
    };
    render(<Harness />);
    expect(screen.getByRole("alert")).toHaveTextContent("Registration is not open yet. Please try again soon.");
  });

  it("treats a 503 without that code as an ordinary error", () => {
    lookups.states = { isError: true, error: new ApiError(503, "API error 503"), refetch: vi.fn() };
    render(<Harness />);
    expect(screen.getByRole("alert")).toHaveTextContent(copy.loadError);
  });

  it("shows 'not open yet' for an empty successful states list", () => {
    lookups.states = { data: [] };
    render(<Harness />);
    expect(screen.getByRole("status")).toHaveTextContent(copy.notOpen);
    expect(screen.queryByLabelText("State")).toBeNull();
  });

  it("renders the options on success with a labelled, ≥44px select", () => {
    render(<Harness />);
    const select = screen.getByLabelText("State");
    expect(select).toHaveClass("min-h-[44px]");
    expect(screen.getByRole("option", { name: "Bihar" })).toBeInTheDocument();
  });

  it("disables district and block with a reason until their parent is chosen", () => {
    render(<Harness />);
    expect(screen.getByLabelText("District")).toBeDisabled();
    expect(screen.getByText(copy.chooseStateFirst)).toBeInTheDocument();
    expect(screen.getByLabelText("Block")).toBeDisabled();
    expect(screen.getByText(copy.chooseDistrictFirst)).toBeInTheDocument();
  });

  it("shows district loading, error + Retry once a state is chosen", () => {
    lookups.districts = { isLoading: true };
    const { unmount } = render(<Harness initial={{ state: "19" }} />);
    expect(screen.getByRole("status")).toHaveTextContent(copy.loading);
    unmount();

    const refetch = vi.fn();
    lookups.districts = { isError: true, error: new ApiError(0, "Network request failed"), refetch };
    render(<Harness initial={{ state: "19" }} />);
    fireEvent.click(screen.getByRole("button", { name: copy.retry }));
    expect(refetch).toHaveBeenCalled();
  });

  it("resets downstream levels when an upstream level changes", () => {
    lookups.districts = { data: DISTRICTS };
    lookups.blocks = { data: BLOCKS };
    const seen: TerritoryValue[] = [];
    render(<Harness initial={{ state: "19", district: "1901", block: "190101" }} onValue={(v) => seen.push(v)} />);
    fireEvent.change(screen.getByLabelText("District"), { target: { value: "1902" } });
    expect(seen.at(-1)).toEqual({ state: "19", district: "1902", block: "" });
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "10" } });
    expect(seen.at(-1)).toEqual({ state: "10", district: "", block: "" });
  });

  it("hides the block select for a district without blocks, and for depth below block", () => {
    lookups.districts = { data: DISTRICTS };
    const { unmount } = render(<Harness initial={{ state: "19", district: "1902" }} />);
    expect(screen.queryByLabelText("Block")).toBeNull();
    unmount();
    render(<Harness depth="district" initial={{ state: "19", district: "1901" }} />);
    expect(screen.queryByLabelText("Block")).toBeNull();
  });

  it("auto-selects a level that has exactly one option", async () => {
    lookups.states = { data: [STATES[0]] };
    lookups.districts = { data: [DISTRICTS[0]] };
    lookups.blocks = { data: [BLOCKS[0]] };
    const seen: TerritoryValue[] = [];
    render(<Harness onValue={(v) => seen.push(v)} />);
    await waitFor(() => expect(seen.at(-1)).toEqual({ state: "19", district: "1901", block: "190101" }));
    expect(screen.getByLabelText("State")).toHaveValue("19");
  });

  it("does not auto-select when there are several options", () => {
    const seen: TerritoryValue[] = [];
    render(<Harness onValue={(v) => seen.push(v)} />);
    expect(seen).toEqual([]);
  });

  it("shows an HTTP-status hint on failure in development, never in production", () => {
    lookups.states = { isError: true, error: new ApiError(503, "API error 503"), refetch: vi.fn() };
    const { unmount } = render(<Harness />);
    expect(screen.getByTestId("territory-debug-hint")).toHaveTextContent("HTTP 503");
    unmount();
    vi.stubEnv("NODE_ENV", "production");
    render(<Harness />);
    expect(screen.queryByTestId("territory-debug-hint")).toBeNull();
  });
});
