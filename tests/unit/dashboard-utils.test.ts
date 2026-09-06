import { describe, it, expect } from "vitest";
import { formatDate, formatDatetime, formatLongDate, getISTHour, IST_TIME_ZONE } from "@/lib/dashboard/utils";

// This is a REAL record's timestamp from the backend's dev database
// (conversation_messages.id=80, lead_id=19) after the paired backend
// session's UTCDateTime fix — 2026-09-06T15:51:23 UTC, which is
// 2026-09-06 21:21 IST. These tests assert the exact IST-rendered string,
// not just "a string" — proving the fix holds regardless of the machine
// running the test suite, not merely on a machine that happens to be IST.
const REAL_UTC_TIMESTAMP = "2026-09-06T15:51:23.398141+00:00";

describe("dashboard date/time utils — explicit IST, not browser-local", () => {
  it("formatDatetime renders the real record's actual IST time (09:21 pm), not a browser-timezone-shifted one", () => {
    expect(formatDatetime(REAL_UTC_TIMESTAMP)).toBe("06 Sept 2026, 09:21 pm");
  });

  it("formatDate renders the real record's IST calendar date", () => {
    expect(formatDate(REAL_UTC_TIMESTAMP)).toBe("06 Sept 2026");
  });

  it("a UTC timestamp that would roll to a different calendar day in a Western timezone still shows its correct IST date", () => {
    // 11:30pm UTC on the 5th is 5:00am IST on the 6th — this is exactly the
    // class of bug the missing timeZone caused: browsers west of UTC would
    // have shown the 5th.
    expect(formatDate("2026-09-05T23:30:00.000Z")).toBe("06 Sept 2026");
  });

  it("getISTHour returns the real IST hour (21), not the local machine's hour", () => {
    expect(getISTHour(new Date(REAL_UTC_TIMESTAMP))).toBe(21);
  });

  it("getISTHour handles the UTC-day-boundary case correctly (18:30 UTC = 00:00 IST)", () => {
    expect(getISTHour(new Date("2026-09-06T18:30:00.000Z"))).toBe(0);
  });

  it("formatLongDate renders a real weekday/date string for a given instant, in IST", () => {
    // 2026-09-06T15:51 UTC = Sunday 6 September 2026, 21:21 IST.
    expect(formatLongDate(new Date(REAL_UTC_TIMESTAMP))).toBe("Sunday, 6 September 2026");
  });

  it("exports the IST zone identifier other modules should reuse rather than re-declaring it", () => {
    expect(IST_TIME_ZONE).toBe("Asia/Kolkata");
  });

  it("formatDate/formatDatetime still handle null/undefined/empty input gracefully", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDatetime("")).toBe("—");
  });
});
