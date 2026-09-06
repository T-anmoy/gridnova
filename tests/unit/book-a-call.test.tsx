import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BookACallPage from "@/app/book-a-call/page";
import BookingWidget from "@/app/book-a-call/BookingWidget";

// BookACallPage is an async server component (`searchParams: Promise<...>`).
// Resolving it once and rendering the returned element is the same shape
// Next.js itself uses at request time — no server-only APIs are touched here,
// so this is a faithful render, not a workaround.
async function renderPage(query: Record<string, string> = {}) {
  const element = await BookACallPage({ searchParams: Promise.resolve(query) });
  render(element);
}

// Computed relative to the real "now" (10 days out, safely inside the
// backend's ~14-day window) so the suite never goes stale — no system-time
// mocking needed since the widget just compares real Date instants.
const ASK_INSTANT = new Date(Date.now() + 10 * 86_400_000);
ASK_INSTANT.setUTCHours(8, 30, 0, 0); // 14:00 IST, on a 30-min slot boundary

function istParts(d: Date) {
  const local = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][local.getUTCDay()];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateStr = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
  const timeStr = `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
  const label = `${weekday} ${String(local.getUTCDate()).padStart(2, "0")} ${months[local.getUTCMonth()]}, ${timeStr} IST`;
  return { dateStr, timeStr, label };
}

function slotsAround(...instants: Date[]) {
  return instants.map((d) => ({ scheduled_at: d.toISOString(), label: istParts(d).label }));
}

// Mirrors BookingWidget's own 24h -> 12h label formatting, so the test can
// find the real dropdown option by its visible text.
function to12HourLabel(timeStr: string): string {
  const [hh, mm] = timeStr.split(":").map(Number);
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
}

const ASK = { ...istParts(ASK_INSTANT), timeLabel: to12HourLabel(istParts(ASK_INSTANT).timeStr) };
const EXACT_SLOT_ISO = ASK_INSTANT.toISOString();
const NEARBY_INSTANTS = [
  new Date(ASK_INSTANT.getTime() + 60 * 60_000), // +1h
  new Date(ASK_INSTANT.getTime() + 2 * 60 * 60_000), // +2h
  new Date(ASK_INSTANT.getTime() + 24 * 60 * 60_000), // next day, same time
];

const AVAILABILITY_WITH_EXACT = {
  duration_minutes: 30,
  days_ahead: 14,
  slots: slotsAround(ASK_INSTANT, ...NEARBY_INSTANTS),
};

const AVAILABILITY_WITHOUT_EXACT = {
  duration_minutes: 30,
  days_ahead: 14,
  slots: slotsAround(...NEARBY_INSTANTS),
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

// The date stays a native input (segmented in real browsers, so setting
// .value directly via a change event is how it's driven here); the time is
// now a real Select dropdown, so it's opened and its option clicked like any
// other Radix Select in this codebase (see employees-lifecycle.test.tsx).
async function askFor(user: ReturnType<typeof userEvent.setup>, dateStr: string, timeLabel: string) {
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: dateStr } });
  await user.click(screen.getByRole("combobox"));
  const option = await screen.findByRole("option", { name: timeLabel });
  await user.click(option);
  await user.click(screen.getByRole("button", { name: /check availability/i }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  // jsdom doesn't implement pointer-capture or scrollIntoView, which Radix
  // Select's trigger relies on when opened (same stub as employees-lifecycle.test.tsx).
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BookACallPage — direct call section", () => {
  it("renders the real phone number as a tel: link, not a placeholder", async () => {
    await renderPage();
    const callLink = screen.getByRole("link", { name: /\+91 98747 74440/ });
    expect(callLink).toHaveAttribute("href", "tel:+919874774440");
  });

  it("keeps the WhatsApp link and the call link as a matched, independently reachable pair", async () => {
    await renderPage();
    const whatsapp = screen.getByRole("link", { name: /whatsapp/i });
    expect(whatsapp).toHaveAttribute("href", "https://wa.me/919874774440");
    const call = screen.getByRole("link", { name: /\+91 98747 74440/ });
    expect(call).toHaveAttribute("href", "tel:+919874774440");
    expect(whatsapp.tagName).toBe("A");
    expect(call.tagName).toBe("A");
  });

  it("shows the 'prefer to talk right now' divider introducing the call option", async () => {
    await renderPage();
    expect(screen.getByText(/prefer to talk right now/i)).toBeInTheDocument();
  });

  it("still carries forward calculator context when present in the query", async () => {
    await renderPage({ estimatedTotal: "250000", sizingMethod: "bill", sizingValue: "4000", source: "calculator" });
    expect(screen.getByText(/carried forward from solar calculator/i)).toBeInTheDocument();
  });

  it("opens on the ask-then-confirm prompt, not a slot grid", async () => {
    await renderPage();
    expect(screen.getByText("When works best for you?")).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Time")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("BookingWidget — ask-then-confirm flow", () => {
  it("does not fetch availability until the visitor asks for a time", async () => {
    render(<BookingWidget />);
    expect(screen.getByText("When works best for you?")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("offers only real 30-minute-increment times within business hours, not free-form entry", async () => {
    const user = userEvent.setup();
    render(<BookingWidget />);

    // No native time input exists any more — the control is a real listbox.
    expect(document.querySelector('input[type="time"]')).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox"));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    // 10:00 AM through 5:30 PM in 30-minute steps = 16 options, matching the
    // backend's business_hours_start_ist=10 / end_ist=18 / duration=30.
    expect(options).toHaveLength(16);
    expect(options[0]).toBe("10:00 AM");
    expect(options[options.length - 1]).toBe("5:30 PM");
    expect(options).toContain("12:30 PM");
    // Every option lands on a real 30-minute boundary — no minute values like ":17".
    expect(options.every((label) => /:(00|30) (AM|PM)$/.test(label!))).toBe(true);
  });

  it("selecting a time option updates the trigger's displayed value", async () => {
    const user = userEvent.setup();
    render(<BookingWidget />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "11:30 AM" }));

    expect(screen.getByRole("combobox")).toHaveTextContent("11:30 AM");
  });

  it("is keyboard-operable: opens and selects a time without a mouse", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(AVAILABILITY_WITH_EXACT));
    render(<BookingWidget />);

    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await user.keyboard("{Enter}");
    const option = await screen.findByRole("option", { name: ASK.timeLabel });
    option.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("combobox")).toHaveTextContent(ASK.timeLabel);
  });

  it("validates that both a date and time are provided before checking", async () => {
    const user = userEvent.setup();
    render(<BookingWidget />);
    await user.click(screen.getByRole("button", { name: /check availability/i }));
    expect(await screen.findByText(/please pick both a date and a time/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a time in the past without a network call", async () => {
    const user = userEvent.setup();
    render(<BookingWidget />);
    await askFor(user, "2020-01-01", "10:00 AM");
    expect(await screen.findByText(/pick a time in the future/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("an exact-match ask goes straight to the contact form", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(AVAILABILITY_WITH_EXACT));
    const user = userEvent.setup();
    render(<BookingWidget />);

    await askFor(user, ASK.dateStr, ASK.timeLabel);

    expect(await screen.findByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByText(ASK.label, { selector: "span" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/public/booking/availability"));
  });

  it("no exact match shows a warm message with nearby alternatives, not an error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(AVAILABILITY_WITHOUT_EXACT));
    const user = userEvent.setup();
    render(<BookingWidget />);

    await askFor(user, ASK.dateStr, ASK.timeLabel);

    expect(await screen.findByText(/that exact time isn.t open, but here are a few nearby options/i)).toBeInTheDocument();
    // Offers a short list (2-4), not the full slot set.
    const altGroup = screen.getByRole("group", { name: /nearby available times/i });
    expect(altGroup.querySelectorAll("button").length).toBeGreaterThanOrEqual(2);
    expect(altGroup.querySelectorAll("button").length).toBeLessThanOrEqual(4);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the graceful empty state when there are no open slots at all", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ duration_minutes: 30, days_ahead: 14, slots: [] }),
    );
    const user = userEvent.setup();
    render(<BookingWidget />);

    await askFor(user, ASK.dateStr, ASK.timeLabel);

    expect(await screen.findByText(/no open slots in the next couple of weeks/i)).toBeInTheDocument();
  });

  it("selecting a nearby alternative proceeds to the contact form with that time", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(AVAILABILITY_WITHOUT_EXACT));
    const user = userEvent.setup();
    render(<BookingWidget />);

    await askFor(user, ASK.dateStr, ASK.timeLabel);
    const altGroup = await screen.findByRole("group", { name: /nearby available times/i });
    const firstAlt = altGroup.querySelector("button") as HTMLElement;
    const altLabel = firstAlt.textContent;
    await user.click(firstAlt);

    expect(await screen.findByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByText(altLabel!, { selector: "span" })).toBeInTheDocument();
  });

  it("'Try a different time' returns to the ask prompt", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(AVAILABILITY_WITHOUT_EXACT));
    const user = userEvent.setup();
    render(<BookingWidget />);

    await askFor(user, ASK.dateStr, ASK.timeLabel);
    await screen.findByText(/nearby options/i);
    await user.click(screen.getByRole("button", { name: /try a different time/i }));

    expect(screen.getByLabelText("Date")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("shows a distinct load-error state with retry when the check fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<BookingWidget />);

    await askFor(user, ASK.dateStr, ASK.timeLabel);

    expect(await screen.findByText(/couldn.t check availability/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("blocks submission and shows validation errors for an empty name / invalid email", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(AVAILABILITY_WITH_EXACT));
    const user = userEvent.setup();
    render(<BookingWidget />);

    await askFor(user, ASK.dateStr, ASK.timeLabel);
    await screen.findByLabelText("Email");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: /confirm booking/i }));

    expect(await screen.findByText(/please enter your name/i)).toBeInTheDocument();
    expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    // Only the availability GET fired — no booking POST attempted with invalid input.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("on success, shows a warm confirmation restating the real booked time", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse(AVAILABILITY_WITH_EXACT))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          lead_id: 1,
          meeting_id: 2,
          scheduled_at: EXACT_SLOT_ISO,
          duration_minutes: 30,
          meet_link: null,
        }),
      );
    const user = userEvent.setup();
    render(<BookingWidget estimatedTotal="250000" sizingMethod="bill" sizingValue="4000" source="calculator" />);

    await askFor(user, ASK.dateStr, ASK.timeLabel);
    await user.type(await screen.findByLabelText("Name"), "Asha Roy");
    await user.type(screen.getByLabelText("Email"), "asha@example.com");
    await user.click(screen.getByRole("button", { name: /confirm booking/i }));

    expect(await screen.findByText(`You’re booked for ${ASK.label}`)).toBeInTheDocument();

    const [, postCall] = fetchMock.mock.calls;
    const body = JSON.parse((postCall[1] as RequestInit).body as string);
    expect(body).toMatchObject({
      name: "Asha Roy",
      email: "asha@example.com",
      scheduled_at: EXACT_SLOT_ISO,
      estimated_total: 250000,
      sizing_method: "bill",
      sizing_value: 4000,
      source: "calculator",
    });
  });

  it("on a 409 slot-taken submit, re-checks and offers fresh nearby alternatives", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse(AVAILABILITY_WITH_EXACT)) // initial ask-check
      .mockResolvedValueOnce(
        jsonResponse({ detail: { code: "slot_unavailable", message: "That slot is no longer available." } }, 409),
      ) // booking submit fails
      .mockResolvedValueOnce(jsonResponse(AVAILABILITY_WITHOUT_EXACT)); // re-check after 409
    const user = userEvent.setup();
    render(<BookingWidget />);

    await askFor(user, ASK.dateStr, ASK.timeLabel);
    await user.type(await screen.findByLabelText("Name"), "Asha Roy");
    await user.type(screen.getByLabelText("Email"), "asha@example.com");
    await user.click(screen.getByRole("button", { name: /confirm booking/i }));

    expect(await screen.findByText(/that time was just booked by someone else/i)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(3);
    const altGroup = screen.getByRole("group", { name: /nearby available times/i });
    expect(altGroup.querySelectorAll("button").length).toBeGreaterThan(0);
  });

  it("shows a generic, distinct error state for other failures without losing form input", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse(AVAILABILITY_WITH_EXACT))
      .mockResolvedValueOnce(jsonResponse({ detail: "Internal server error" }, 500));
    const user = userEvent.setup();
    render(<BookingWidget />);

    await askFor(user, ASK.dateStr, ASK.timeLabel);
    await user.type(await screen.findByLabelText("Name"), "Asha Roy");
    await user.type(screen.getByLabelText("Email"), "asha@example.com");
    await user.click(screen.getByRole("button", { name: /confirm booking/i }));

    expect(await screen.findByText(/internal server error/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Asha Roy");
  });
});
