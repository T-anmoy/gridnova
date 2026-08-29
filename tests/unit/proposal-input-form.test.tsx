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

  it("shows the confirmation screen after a successful submission, then resets on Start Another Assessment", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true, message: "Received — backend integration pending" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ProposalInputForm />);

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

    await user.click(screen.getByRole("button", { name: /submit for review/i }));

    await screen.findByText(/assessment submitted for review/i);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/proposal-inputs",
      expect.objectContaining({ method: "POST" })
    );

    await user.click(screen.getByRole("button", { name: /start another assessment/i }));

    await screen.findByText(/step 1 of 5/i);
    expect((screen.getByLabelText(/full name/i) as HTMLInputElement).value).toBe("");
  });
});
