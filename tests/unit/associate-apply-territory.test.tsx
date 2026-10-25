import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { en } from "./helpers/i18n";
import { fillDateField } from "./helpers/date-field";
import { ApiError } from "@/lib/dashboard/api-error";
import AssociateApplyForm from "@/components/associate/AssociateApplyForm";

const refetch = vi.fn();
vi.mock('@/lib/associate/portal-session', async (orig) => ({ ...(await orig<object>()), ...(await import('./helpers/survey-mocks')).portalSessionOverrides }))
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
    render(<AssociateApplyForm kind="associate" t={en.associates} />);
    const f = en.associates.wizard.fields;
    fireEvent.change(screen.getByLabelText(f.full_name.label), { target: { value: "Asha Roy" } });
    fillDateField(f.date_of_birth.label, "1990-01-01");
    fireEvent.change(screen.getByLabelText(f.mobile.label), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText(f.email.label), { target: { value: "asha@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: en.associates.wizard.common.next }));

    expect(screen.getByRole("alert")).toHaveTextContent("Registration is not open yet. Please try again soon.");
    expect(screen.queryByRole("combobox", { name: f.state.label })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.associates.territory.retry }));
    expect(refetch).toHaveBeenCalled();
  });
});
