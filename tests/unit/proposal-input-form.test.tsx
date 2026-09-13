import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProposalInputForm from "@/app/proposal/new/ProposalInputForm";

// jsdom doesn't always implement the Blob URL APIs FileUploadSlot's image
// previews rely on — stub them so file-upload interactions don't throw.
beforeEach(() => {
  if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => "blob:mock");
  if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn();
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  // jsdom doesn't implement scrollTo; the wizard calls it on every step change.
  window.scrollTo = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function fillStep1(user: ReturnType<typeof userEvent.setup>, { withScheme = false } = {}) {
  await user.type(screen.getByLabelText(/full name/i), "Ravi Sharma");
  await user.type(screen.getByLabelText(/contact number/i), "9874774440");
  await user.type(screen.getByLabelText(/email address/i), "ravi@example.com");
  await user.type(screen.getByLabelText(/lead id/i), "1042");
  await user.selectOptions(screen.getByLabelText(/project type/i), "Rooftop Solar");
  if (withScheme) {
    await user.click(screen.getByRole("button", { name: "Yes" }));
  }
}

// Advances from Step 1 to Step 2 and waits for real Step 2 content to mount
// (not just the progress-indicator text, which updates immediately and can
// race the AnimatePresence exit/enter transition between step components).
async function goToStep2(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^next$/i }));
  await screen.findByLabelText(/district \/ city/i);
}

async function fillStep2(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/^state/i), "West Bengal");
  await user.type(screen.getByLabelText(/district \/ city/i), "Hooghly");
  await user.type(screen.getByLabelText(/pin code/i), "712235");
  await user.selectOptions(screen.getByLabelText(/discom/i), "WBSEDCL");
  await user.selectOptions(screen.getByLabelText(/site type/i), "Rooftop (Residential building)");
  await user.type(screen.getByLabelText(/roof \/ site area/i), "800");
}

async function goToStep3(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^next$/i }));
  await screen.findByLabelText(/average monthly electricity bill/i);
}

async function fillStep3(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/average monthly electricity bill/i), "3500");
  await user.selectOptions(screen.getByLabelText(/connection phase/i), "Single Phase");
  await user.selectOptions(screen.getByLabelText(/primary objective/i), "Reduce electricity bill");
}

async function goToStep4(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^next$/i }));
  await screen.findByText(/connection type/i);
}

async function goToStep5(user: ReturnType<typeof userEvent.setup>) {
  // Step 4 has no required fields — Next is already enabled.
  await user.click(screen.getByRole("button", { name: /^next$/i }));
  await screen.findByText(/electricity bill \(last 3 months\)/i);
}

function makeFile(name: string, type: string) {
  return new File(["dummy content"], name, { type });
}

describe("ProposalInputForm", () => {
  it("renders Step 1 with the progress indicator and no crash", () => {
    render(<ProposalInputForm />);
    expect(screen.getByText(/step 1 of 5/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
  });

  it("walks through all 5 steps without throwing", async () => {
    const user = userEvent.setup();
    render(<ProposalInputForm />);

    await fillStep1(user);
    await goToStep2(user);
    expect(screen.getByText(/step 2 of 5/i)).toBeInTheDocument();

    await fillStep2(user);
    await goToStep3(user);
    expect(screen.getByText(/step 3 of 5/i)).toBeInTheDocument();

    await fillStep3(user);
    await goToStep4(user);
    expect(screen.getByText(/step 4 of 5/i)).toBeInTheDocument();

    await goToStep5(user);
    expect(screen.getByText(/step 5 of 5/i)).toBeInTheDocument();
    expect(screen.getByText(/supporting documents/i)).toBeInTheDocument();
  });

  it("disables Next on Step 1 until required fields are valid", async () => {
    const user = userEvent.setup();
    render(<ProposalInputForm />);

    const nextButton = screen.getByRole("button", { name: /^next$/i });
    expect(nextButton).toBeDisabled();

    await fillStep1(user);
    expect(nextButton).not.toBeDisabled();
  });

  it("auto-sets DCR panels to Yes when a government scheme is linked", async () => {
    const user = userEvent.setup();
    render(<ProposalInputForm />);

    await fillStep1(user, { withScheme: true });
    await goToStep2(user);
    await fillStep2(user);
    await goToStep3(user);
    await fillStep3(user);
    await goToStep4(user);

    // Multiple "Yes"/"No" toggles exist on this step (Net Metering, DCR), so
    // scope to the DCR group specifically via its explanatory note container.
    const dcrNote = await screen.findByText(
      /automatically set to yes because this project is linked to a government scheme/i
    );
    const dcrGroup = dcrNote.parentElement as HTMLElement;
    const dcrYesButton = within(dcrGroup).getByRole("button", { name: "Yes" });
    expect(dcrYesButton).toHaveClass("bg-[#0e2a63]");
    expect(dcrYesButton).toBeDisabled();
  });

  // Fills every step and reaches Step 5 with a bill + a site photo attached,
  // ready for the final submit click — shared by the tests below that only
  // differ in how the backend responds.
  async function reachSubmit(user: ReturnType<typeof userEvent.setup>) {
    await fillStep1(user);
    await goToStep2(user);
    await fillStep2(user);
    await goToStep3(user);
    await fillStep3(user);
    await goToStep4(user);
    await goToStep5(user);

    const billInput = document.getElementById("electricityBills") as HTMLInputElement;
    const photoInput = document.getElementById("sitePhotos") as HTMLInputElement;
    await user.upload(billInput, makeFile("bill.pdf", "application/pdf"));
    await user.upload(photoInput, makeFile("roof.jpg", "image/jpeg"));
  }

  it("sends the real file as multipart form data, not JSON, after a successful create", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ success: true, inputs_id: 501 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, data: { id: 501 } }) });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ProposalInputForm />);
    await reachSubmit(user);
    await user.click(screen.getByRole("button", { name: /submit for review/i }));

    await screen.findByText(/assessment submitted for review/i);

    // Call 1: the structured create, as JSON.
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/proposal-inputs",
      expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } })
    );

    // Call 2: the real file, as multipart FormData against the created row —
    // never JSON.stringify'd, never discarded.
    const [uploadUrl, uploadInit] = fetchMock.mock.calls[1];
    expect(uploadUrl).toBe("/api/proposal-inputs/501/upload");
    expect(uploadInit.body).toBeInstanceOf(FormData);
    const sentFile = uploadInit.body.get("file") as File;
    expect(sentFile.name).toBe("bill.pdf");
    expect(uploadInit.body.get("target")).toBe("document");
    expect(uploadInit.body.get("document_type")).toBe("electricity_bill");

    // Exactly one upload call — the site photo has no real target yet, and
    // must not be silently forced into the wrong one.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/1 document uploaded successfully/i)).toBeInTheDocument();
    expect(screen.getByText(/installation-photo upload isn.t wired up yet/i)).toBeInTheDocument();
  });

  it("shows an honest failure — not a false success — when the backend reports storage isn't configured", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ success: true, inputs_id: 501 }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          success: false,
          code: "storage_not_configured",
          error: "File storage isn't connected yet — this file was NOT saved. The rest of the assessment was submitted.",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ProposalInputForm />);
    await reachSubmit(user);
    await user.click(screen.getByRole("button", { name: /submit for review/i }));

    // The assessment record itself still succeeded — this isn't a submit failure.
    await screen.findByText(/assessment submitted for review/i);
    expect(screen.getByText(/1 document could not be saved/i)).toBeInTheDocument();
    expect(screen.getByText(/file storage isn.t connected yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/1 document.*uploaded successfully/i)).not.toBeInTheDocument();
  });

  it("shows the real backend error and stays on the form when create fails (e.g. not signed in)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        code: "not_authenticated",
        error: "Please sign in as a Grid Nova staff member before submitting this assessment.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ProposalInputForm />);
    await reachSubmit(user);
    await user.click(screen.getByRole("button", { name: /submit for review/i }));

    await screen.findByText(/please sign in as a grid nova staff member/i);
    // Never a false success, and no upload attempted without a real inputs_id.
    expect(screen.queryByText(/assessment submitted for review/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resets fully via Start Another Assessment after a successful submission", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ success: true, inputs_id: 501 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, data: { id: 501 } }) });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ProposalInputForm />);
    await reachSubmit(user);
    await user.click(screen.getByRole("button", { name: /submit for review/i }));

    await screen.findByText(/assessment submitted for review/i);
    await user.click(screen.getByRole("button", { name: /start another assessment/i }));

    await screen.findByText(/step 1 of 5/i);
    expect((screen.getByLabelText(/full name/i) as HTMLInputElement).value).toBe("");
  });
});
