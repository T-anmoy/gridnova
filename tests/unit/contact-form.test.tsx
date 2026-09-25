import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactForm from "@/app/contact/ContactForm";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/your name/i), "Ravi Sharma");
  await user.type(screen.getByLabelText(/email address/i), "ravi@example.com");
  await user.selectOptions(screen.getByLabelText(/what are you looking for/i), "Residential Rooftop");
  await user.type(screen.getByLabelText(/your message/i), "I would like a quote for a rooftop system please.");
}

describe("ContactForm — real submission (no more mailto: handoff)", () => {
  it("POSTs to /api/contact and shows a real success state, never opening a mail client", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const initialHref = window.location.href;

    const user = userEvent.setup();
    render(<ContactForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText("Message sent")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/contact",
      expect.objectContaining({ method: "POST" })
    );
    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody).toMatchObject({
      name: "Ravi Sharma",
      email: "ravi@example.com",
      interest: "Residential Rooftop",
    });
    // The old primary path navigated the browser to a mailto: link — a real
    // fetch-based submission never touches window.location at all.
    expect(window.location.href).toBe(initialHref);
  });

  it("shows the phone/email fallback in the error banner when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: "This form is not fully configured yet. Please call or email us directly." }), { status: 503 })));

    const user = userEvent.setup();
    render(<ContactForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByText(/not fully configured yet/i)).toBeInTheDocument()
    expect(screen.getByText("+91 98747 74440")).toBeInTheDocument();
    expect(screen.getByText("info@gridnova.in")).toBeInTheDocument();
  });

  it("shows a network-failure message when the request never reaches the server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const user = userEvent.setup();
    render(<ContactForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByText(/couldn.t reach our server/i)).toBeInTheDocument();
  });

  it("never submits when required fields are invalid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ContactForm />);
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
