import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ProposalInputForm from "@/app/(internal)/proposal/new/ProposalInputForm";

vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ getToken: async () => "clerk-jwt" }) }));

beforeEach(() => {
  window.scrollTo = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ProposalInputForm — leadId query-param pre-fill/lock", () => {
  it("pre-fills and disables the Lead ID field when opened with a leadId", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 404 })));
    render(<ProposalInputForm initialLeadId="1042" />);

    const leadIdField = screen.getByLabelText(/lead id/i) as HTMLInputElement;
    expect(leadIdField.value).toBe("1042");
    expect(leadIdField).toBeDisabled();
    expect(screen.getByText(/locked — opened from this lead/i)).toBeInTheDocument();
  });

  it("leaves the Lead ID field editable when opened without a leadId", () => {
    render(<ProposalInputForm />);
    const leadIdField = screen.getByLabelText(/lead id/i) as HTMLInputElement;
    expect(leadIdField.value).toBe("");
    expect(leadIdField).not.toBeDisabled();
  });

  it("pre-fills name and email from the linked lead once the lookup resolves, without fabricating a phone number", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, lead_id: 1042, full_name: "Asha Roy", email: "asha@example.com", phone: null }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<ProposalInputForm initialLeadId="1042" />);

    await waitFor(() => {
      expect((screen.getByLabelText(/full name/i) as HTMLInputElement).value).toBe("Asha Roy");
    });
    expect((screen.getByLabelText(/email address/i) as HTMLInputElement).value).toBe("asha@example.com");
    expect((screen.getByLabelText(/contact number/i) as HTMLInputElement).value).toBe("");
    expect(fetchMock).toHaveBeenCalledWith("/api/proposal-inputs/lead/1042");
  });

  it("fails silently and leaves fields blank/editable when the lead lookup errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    render(<ProposalInputForm initialLeadId="1042" />);

    // Give the failed fetch a tick to resolve, then confirm nothing broke.
    await waitFor(() => {
      expect((screen.getByLabelText(/lead id/i) as HTMLInputElement).value).toBe("1042");
    });
    expect((screen.getByLabelText(/full name/i) as HTMLInputElement).value).toBe("");
  });
});
