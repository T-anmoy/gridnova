import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { en } from "./helpers/i18n";
import { ApiError } from "@/lib/dashboard/api-error";
import AssociateApplyForm from "@/components/associate/AssociateApplyForm";

const refetch = vi.fn();
vi.mock("@/lib/associate/api-client", () => ({
  useTerritoryStates: () => ({
    isError: true,
    error: new ApiError(503, "API error 503", "Territory data has not been loaded yet.", { code: "territories_not_seeded" }),
    refetch,
  }),
  useTerritoryDistricts: () => ({}),
  useTerritoryBlocks: () => ({}),
  useKycConsent: () => ({ data: undefined }),
  useSeatAvailability: () => ({ data: undefined, isFetching: false }),
  submitApplication: vi.fn(),
}));

describe("Apply form with territories not seeded", () => {
  it("shows 'not open yet' with Retry on the address step instead of an empty State dropdown", () => {
    const { container } = render(<AssociateApplyForm kind="associate" t={en.associates} />);
    const f = en.associates.wizard.fields;
    // Personal-step inputs, in render order: name, date of birth, mobile, email.
    const inputs = container.querySelectorAll("input");
    ["Asha Roy", "1990-01-01", "9876543210", "asha@example.com"].forEach((v, n) =>
      fireEvent.change(inputs[n], { target: { value: v } }),
    );
    fireEvent.click(screen.getByRole("button", { name: en.associates.wizard.common.next }));

    expect(screen.getByRole("alert")).toHaveTextContent("Registration is not open yet. Please try again soon.");
    expect(screen.queryByRole("combobox", { name: f.state.label })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.associates.territory.retry }));
    expect(refetch).toHaveBeenCalled();
  });
});
