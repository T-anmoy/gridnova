"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarClock, CheckCircle2, Loader2, RefreshCcw } from "lucide-react";
import CountUp from "@/components/CountUp";
import { ApiShapeError } from "@/lib/dashboard/api-error";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  bookingAvailabilityResponseSchema,
  bookingConflictDetailSchema,
  bookingCreateResponseSchema,
  formatZodError,
} from "@/lib/dashboard/schemas";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Same shape check the backend itself uses (public_booking.py's _EMAIL_RE) —
// mirrored here so a bad address is caught before the round trip, not after.
const EMAIL_RE = /^[\w.+-]+@[\w-]+\.[\w.-]+$/;
const PHONE_RE = /^[+\d][\d\s()-]{6,20}$/;

// Mirrors public_booking.py's own DEFAULT_DAYS_AHEAD — a UI hint for the date
// input's range, not an enforced limit (the backend is the real authority;
// it validates/clamps days_ahead server-side regardless of what's picked here).
const ASK_MAX_DAYS_AHEAD = 14;

// How many nearby alternatives to offer when the exact ask isn't open — a
// short, glanceable list, not a second grid.
const ALTERNATIVE_COUNT = 3;

// The visitor should only ever be able to ask for a time that could possibly
// be a real slot — mirrors the backend's actual scheduling config
// (grid-nova-ai-backend/app/config.py: business_hours_start_ist=10,
// business_hours_end_ist=18, scheduling_default_duration_minutes=30) and the
// exact loop condition availability.py's _candidate_slots uses (a slot's
// start, plus its full duration, must fit before closing time) — so this
// list can never offer a time the backend wouldn't also generate.
const BUSINESS_HOURS_START_IST = 10;
const BUSINESS_HOURS_END_IST = 18;
const SLOT_DURATION_MINUTES = 30;

function generateTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const startMinutes = BUSINESS_HOURS_START_IST * 60;
  const endMinutes = BUSINESS_HOURS_END_IST * 60;
  for (let m = startMinutes; m + SLOT_DURATION_MINUTES <= endMinutes; m += SLOT_DURATION_MINUTES) {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    const value = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    const hour12 = hh % 12 === 0 ? 12 : hh % 12;
    const label = `${hour12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
    options.push({ value, label });
  }
  return options;
}
const TIME_OPTIONS = generateTimeOptions();

type Slot = { scheduledAt: string; label: string; date: Date };

function toSlot(raw: { scheduled_at: string; label: string }): Slot {
  return { scheduledAt: raw.scheduled_at, label: raw.label, date: new Date(raw.scheduled_at) };
}

function extractErrorMessage(detail: unknown, fallback: string): { message: string; code?: string } {
  if (typeof detail === "string" && detail.trim()) return { message: detail };
  if (detail && typeof detail === "object") {
    const d = detail as { code?: string; message?: string };
    if (d.message) return { message: d.message, code: d.code };
  }
  return { message: fallback };
}

// The visitor's date + time are treated as IST — the same fixed business
// timezone every slot label already carries (e.g. "Wed 10 Sep, 14:00 IST")
// and the only timezone this page ever mentions ("Mon–Sat, 9am–7pm IST").
// Building the instant with an explicit +05:30 offset means this comparison
// is correct regardless of the visitor's own browser timezone.
function buildRequestedInstant(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00+05:30`);
}

// IST calendar-date ("YYYY-MM-DD") and clock-time ("HH:MM") for a real Date
// instant — used to bucket the availability response's slots by the same
// date/time keys the ask form itself uses, regardless of the visitor's own
// browser timezone. en-CA formats as YYYY-MM-DD directly; hour12:false on
// en-GB gives a 24h "HH:MM" matching TIME_OPTIONS' own value format.
function istDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
function istTimeKey(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

// A slot within `toleranceMinutes` of the ask counts as "that time is open" —
// the tolerance is the backend's own slot granularity (duration_minutes), so
// a visitor asking for a few minutes either side of a real slot boundary
// still lands on it instead of being told "no" over a rounding difference.
function findMatch(slots: Slot[], requested: Date, toleranceMinutes: number): Slot | null {
  let best: Slot | null = null;
  let bestDiff = Infinity;
  for (const slot of slots) {
    const diff = Math.abs(slot.date.getTime() - requested.getTime()) / 60_000;
    if (diff <= toleranceMinutes && diff < bestDiff) {
      best = slot;
      bestDiff = diff;
    }
  }
  return best;
}

function nearestAlternatives(slots: Slot[], requested: Date, count: number): Slot[] {
  return [...slots]
    .sort((a, b) => Math.abs(a.date.getTime() - requested.getTime()) - Math.abs(b.date.getTime() - requested.getTime()))
    .slice(0, count);
}

type Stage = "ask" | "checking" | "alternatives" | "form" | "submitting" | "success" | "load-error";
type AltBanner = "no-exact-match" | "slot-taken";

export default function BookingWidget({
  estimatedTotal,
  sizingMethod,
  sizingValue,
  source,
}: {
  estimatedTotal?: string;
  sizingMethod?: string;
  sizingValue?: string;
  source?: string;
}) {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState<Stage>("ask");
  const [loadErrorMessage, setLoadErrorMessage] = useState("");

  const [askDate, setAskDate] = useState("");
  const [askTime, setAskTime] = useState("");
  const [askError, setAskError] = useState("");
  const [lastRequested, setLastRequested] = useState<Date | null>(null);

  const [durationMinutes, setDurationMinutes] = useState(30);
  const [alternatives, setAlternatives] = useState<Slot[]>([]);
  const [altBanner, setAltBanner] = useState<AltBanner>("no-exact-match");
  // The backend's own conflict message on a real 409 — already names the
  // exact requested time (e.g. "The Wed 10 Sep, 14:00 IST slot is no longer
  // available — it was just taken."). Only set for a genuine slot-taken
  // conflict; the generic copy below covers the "ask wasn't open" case.
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState<{ name?: boolean; email?: boolean; phone?: boolean }>({});
  const [submitError, setSubmitError] = useState("");

  const [confirmed, setConfirmed] = useState<{ label: string; meetLink?: string | null } | null>(null);

  // Per-date cross-out data for the time picker: which date it's for, whether
  // that date's real availability is loaded, and the open "HH:MM" times on
  // it. Kept separate from `alternatives`/`stage` — this drives the ask
  // form's own Select options, not a stage transition.
  const [dateSlotsStatus, setDateSlotsStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [dateSlotsFor, setDateSlotsFor] = useState("");
  const [dateOpenTimes, setDateOpenTimes] = useState<Set<string>>(new Set());

  // The ask-check and the date-triggered cross-out fetch hit the exact same
  // endpoint — cached here so picking a date and then clicking "Check
  // availability" moments later costs one real network call, not two.
  // Cleared on failure so the next attempt (a retry, or the submit flow)
  // gets a fresh try rather than replaying a dead rejection.
  const availabilityPromiseRef = useRef<Promise<{ duration: number; slots: Slot[] }> | null>(null);
  const fetchAvailability = (): Promise<{ duration: number; slots: Slot[] }> => {
    if (!availabilityPromiseRef.current) {
      availabilityPromiseRef.current = (async () => {
        const res = await fetch(`${API_BASE}/api/v1/public/booking/availability`);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { detail?: unknown };
          const { message } = extractErrorMessage(body.detail, `Error ${res.status}`);
          throw new Error(message);
        }
        const raw: unknown = await res.json();
        const parsed = bookingAvailabilityResponseSchema.safeParse(raw);
        if (!parsed.success) {
          throw new ApiShapeError("/api/v1/public/booking/availability", formatZodError(parsed.error));
        }
        return { duration: parsed.data.duration_minutes, slots: parsed.data.slots.map(toSlot) };
      })().catch((err) => {
        availabilityPromiseRef.current = null;
        throw err;
      });
    }
    return availabilityPromiseRef.current;
  };

  const totalNumber = estimatedTotal ? Number(estimatedTotal) : undefined;
  const hasTotal = totalNumber != null && Number.isFinite(totalNumber) && totalNumber > 0;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const maxDateStr = new Date(now.getTime() + ASK_MAX_DAYS_AHEAD * 86_400_000).toISOString().slice(0, 10);

  // Fires as soon as a (real, not-already-past) date is picked — fetches
  // real availability and buckets it by IST date so the time Select can
  // cross out that day's already-taken options immediately. A date already
  // fully in the past needs no fetch — every time on it will fail the
  // future-only check on submit regardless.
  const handleDateChange = (value: string) => {
    setAskDate(value);
    setAskTime("");
    setAskError("");
    if (!value || value < todayStr) {
      setDateSlotsStatus("idle");
      setDateSlotsFor("");
      setDateOpenTimes(new Set());
      return;
    }
    setDateSlotsFor(value);
    setDateSlotsStatus("loading");
    fetchAvailability()
      .then(({ slots }) => {
        const openTimes = new Set(
          slots.filter((s) => istDateKey(s.date) === value).map((s) => istTimeKey(s.date)),
        );
        setDateOpenTimes(openTimes);
        setDateSlotsStatus("loaded");
        // A time picked while this fetch was still in flight can turn out
        // taken once real data arrives — clear it rather than leave a
        // now-invalid selection sitting in the trigger.
        setAskTime((current) => (current && openTimes.size > 0 && !openTimes.has(current) ? "" : current));
      })
      .catch(() => {
        // Non-fatal — the picker just shows no cross-outs for this date; the
        // submit flow's own availability check still catches an unavailable
        // pick exactly as it always has.
        setDateOpenTimes(new Set());
        setDateSlotsStatus("error");
      });
  };

  // A date with at least one real open slot is confirmed as a live business
  // day — any grid option missing from dateOpenTimes on it is genuinely
  // taken. A date with zero (not yet loaded, load failed, or a real
  // day-off/fully-booked day) is left entirely unmarked rather than crossing
  // out every option — indistinguishable from "no data" otherwise, and
  // crossing out a whole day's grid would recreate the wall-of-non-options
  // problem this is explicitly meant to avoid.
  const dateHasKnownOpenings = dateSlotsFor === askDate && dateSlotsStatus === "loaded" && dateOpenTimes.size > 0;
  // A time already in the past needs no separate check here — the backend
  // never includes a past slot in the first place (see availability.py's own
  // `slot_utc > now_utc` filter), so it's already absent from dateOpenTimes
  // on any date whose real availability was actually fetched. A wholly past
  // date skips the fetch entirely (handleDateChange), leaving this false for
  // it — submit's own "pick a time in the future" check still catches that.
  const isTimeOptionTaken = (timeValue: string): boolean => {
    return !!askDate && dateHasKnownOpenings && !dateOpenTimes.has(timeValue);
  };

  // Fetches availability, then either lands on an exact/close match (straight
  // to the contact form) or offers nearby alternatives — never renders the
  // full list. `banner` distinguishes the two ways this gets triggered: the
  // visitor's own ask, or a re-check after their booking attempt hit a slot
  // that was just taken.
  const checkAvailability = async (requested: Date, banner: AltBanner) => {
    setLastRequested(requested);
    setStage("checking");
    setLoadErrorMessage("");
    setConflictMessage(null);
    // A "slot-taken" re-check means the world just changed (the slot the
    // visitor asked for was live-verified as vanished) — never answer that
    // with a fetch cached from before the conflict was even known about.
    if (banner === "slot-taken") {
      availabilityPromiseRef.current = null;
    }
    try {
      const { duration, slots } = await fetchAvailability();
      setDurationMinutes(duration);

      const match = findMatch(slots, requested, duration);
      if (match) {
        setSelected(match);
        setStage("form");
        return;
      }
      setAlternatives(nearestAlternatives(slots, requested, ALTERNATIVE_COUNT));
      setAltBanner(banner);
      setStage("alternatives");
    } catch (err) {
      setLoadErrorMessage(
        err instanceof Error ? err.message : "Couldn't check availability right now.",
      );
      setStage("load-error");
    }
  };

  const submitAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!askDate || !askTime) {
      setAskError("Please pick both a date and a time.");
      return;
    }
    const requested = buildRequestedInstant(askDate, askTime);
    if (Number.isNaN(requested.getTime())) {
      setAskError("That doesn't look like a valid date and time.");
      return;
    }
    if (requested.getTime() <= Date.now()) {
      setAskError("Please pick a time in the future.");
      return;
    }
    setAskError("");
    checkAvailability(requested, "no-exact-match");
  };

  const backToAsk = () => {
    setSelected(null);
    setSubmitError("");
    setStage("ask");
  };

  const chooseAlternative = (slot: Slot) => {
    setSelected(slot);
    setStage("form");
  };

  const nameError = touched.name && !name.trim() ? "Please enter your name." : "";
  const emailError = touched.email && !EMAIL_RE.test(email.trim()) ? "Please enter a valid email address." : "";
  const phoneError = touched.phone && phone.trim() && !PHONE_RE.test(phone.trim()) ? "Please enter a valid phone number." : "";
  const formValid = name.trim().length > 0 && EMAIL_RE.test(email.trim()) && (!phone.trim() || PHONE_RE.test(phone.trim()));

  const submitBooking = async () => {
    setTouched({ name: true, email: true, phone: true });
    if (!selected || !formValid) return;

    setStage("submitting");
    setSubmitError("");

    try {
      const res = await fetch(`${API_BASE}/api/v1/public/booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          scheduled_at: selected.scheduledAt,
          duration_minutes: durationMinutes,
          estimated_total: hasTotal ? totalNumber : undefined,
          sizing_method: sizingMethod || undefined,
          sizing_value: sizingValue ? Number(sizingValue) : undefined,
          source: source || undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: unknown };
        const { message, code } = extractErrorMessage(body.detail, `Error ${res.status}`);
        if (res.status === 409 || code === "slot_unavailable") {
          // The slot vanished between the ask-check and the submit. The 409
          // body already names the exact requested time and carries nearby
          // alternatives computed fresh at the moment of conflict — use those
          // directly rather than losing that specific wording in a re-fetch.
          const conflict = bookingConflictDetailSchema.safeParse(body.detail);
          if (conflict.success) {
            setAlternatives(conflict.data.alternatives.map(toSlot));
            setConflictMessage(conflict.data.message);
            setAltBanner("slot-taken");
            setStage("alternatives");
            return;
          }
          // Unexpected shape — fall back to a fresh live re-check rather than
          // showing nothing.
          if (lastRequested) {
            checkAvailability(lastRequested, "slot-taken");
          } else {
            backToAsk();
          }
          return;
        }
        throw new Error(message);
      }

      const raw: unknown = await res.json();
      const parsed = bookingCreateResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new ApiShapeError("/api/v1/public/booking", formatZodError(parsed.error));
      }

      setConfirmed({ label: selected.label, meetLink: parsed.data.meet_link });
      setStage("success");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong submitting your booking.",
      );
      setStage("form");
    }
  };

  const cardClass = "bg-white rounded-2xl border border-[#e4e8ee] p-10 md:p-14";
  const revealProps = reduced
    ? { initial: false as const }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
      };

  if (stage === "checking") {
    return (
      <div className={`${cardClass} text-center min-h-[420px] flex flex-col items-center justify-center`}>
        <Loader2 className={`h-6 w-6 text-[#2f5daa] ${reduced ? "" : "animate-spin"}`} aria-hidden="true" />
        <p className="mt-4 text-[#111827]/60 text-sm">Checking availability&hellip;</p>
      </div>
    );
  }

  if (stage === "load-error") {
    return (
      <div className={`${cardClass} text-center min-h-[420px] flex flex-col items-center justify-center`} role="alert">
        <p className="font-display text-[#0e2a63] text-lg font-semibold">Couldn&rsquo;t check availability</p>
        <p className="mt-2 text-[#111827]/50 text-sm max-w-[42ch]">
          {loadErrorMessage || "Give it another try, or use WhatsApp/call below — a Solar Advisor is standing by."}
        </p>
        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={() => lastRequested && checkAvailability(lastRequested, "no-exact-match")}
            className="inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility text-sm font-semibold px-6 py-3 hover:bg-[#2f5daa] transition-colors duration-300 active:scale-[0.97]"
          >
            <RefreshCcw className="h-4 w-4" />
            Try again
          </button>
          <button
            type="button"
            onClick={backToAsk}
            className="text-sm font-medium text-[#111827]/50 hover:text-[#0e2a63] transition-colors"
          >
            Change time
          </button>
        </div>
      </div>
    );
  }

  if (stage === "success" && confirmed) {
    return (
      <motion.div {...revealProps} className={`${cardClass} text-center`} role="status">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f7a800]/10">
          <CheckCircle2 className="h-6 w-6 text-[#f7a800]" />
        </div>
        <p className="mt-5 font-display text-[#0e2a63] text-xl md:text-2xl font-semibold">
          You&rsquo;re booked for {confirmed.label}
        </p>
        <p className="mt-3 text-[#111827]/60 text-sm max-w-[46ch] mx-auto leading-relaxed">
          A Grid Nova Solar Advisor will call you at that time.
          {hasTotal && (
            <>
              {" "}We&rsquo;ll walk through your <CountUp value={new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(totalNumber!)} className="font-semibold text-[#0e2a63]" /> indicative estimate together.
            </>
          )}
        </p>
        {confirmed.meetLink && (
          <a
            href={confirmed.meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block text-[#2f5daa] text-sm font-semibold hover:underline underline-offset-2"
          >
            Video call link
          </a>
        )}
      </motion.div>
    );
  }

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2.5 mb-6">
        <CalendarClock className="h-5 w-5 text-[#2f5daa]" aria-hidden="true" />
        <h2 className="font-display text-[#0e2a63] text-lg font-semibold">When works best for you?</h2>
      </div>

      {(stage === "ask" || stage === "alternatives") && (
        <>
          <form onSubmit={submitAsk} noValidate className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="booking-date" className="block text-sm font-medium text-[#0e2a63] mb-1.5">
                Date
              </label>
              <input
                id="booking-date"
                type="date"
                value={askDate}
                min={todayStr}
                max={maxDateStr}
                onChange={(e) => handleDateChange(e.target.value)}
                aria-invalid={!!askError}
                aria-describedby={askError ? "booking-ask-error" : undefined}
                className="rounded-xl border border-[#e4e8ee] px-4 py-2.5 text-sm focus:outline-none focus:border-[#2f5daa] transition-colors"
              />
            </div>
            <div>
              <label htmlFor="booking-time" className="block text-sm font-medium text-[#0e2a63] mb-1.5">
                Time
              </label>
              <Select value={askTime} onValueChange={setAskTime}>
                <SelectTrigger
                  id="booking-time"
                  aria-invalid={!!askError}
                  aria-describedby={askError ? "booking-ask-error" : undefined}
                  className="h-auto w-[140px] rounded-full border-[#e4e8ee] bg-white px-4 py-2.5 text-sm font-utility font-medium text-[#0e2a63] shadow-none hover:border-[#2f5daa] focus:outline-none focus:ring-0 focus:border-[#2f5daa] data-[state=open]:border-[#2f5daa] data-[placeholder]:text-[#111827]/40 data-[placeholder]:font-normal transition-colors"
                >
                  <SelectValue placeholder="Select a time" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-[#e4e8ee]">
                  {TIME_OPTIONS.map((opt) => {
                    const taken = isTimeOptionTaken(opt.value);
                    return (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        disabled={taken}
                        // The strikethrough + Radix's own data-disabled dimming
                        // (base SelectItem styling) are the "already booked"
                        // signal — deliberately not appended as extra text
                        // inside the option, which would change its accessible
                        // name away from the plain time label. Radix already
                        // announces aria-disabled on a disabled option to
                        // assistive tech.
                        className="rounded-lg font-utility text-[#0e2a63] data-[highlighted]:bg-[#2f5daa]/8 focus:bg-[#2f5daa]/8 data-[state=checked]:font-semibold data-[disabled]:line-through"
                      >
                        {opt.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility text-sm font-semibold px-6 py-3 hover:bg-[#2f5daa] transition-colors duration-300 active:scale-[0.97]"
            >
              Check availability
            </button>
          </form>
          {askError && (
            <p id="booking-ask-error" className="mt-3 text-sm text-red-600" role="alert">
              {askError}
            </p>
          )}
          <p className="mt-3 text-[#111827]/50 text-sm">
            Pick a date and time — we&rsquo;ll check it against real availability instantly.
          </p>
        </>
      )}

      {stage === "alternatives" && (
        <motion.div {...revealProps} className="mt-8 pt-8 border-t border-[#e4e8ee]">
          {alternatives.length === 0 ? (
            <p className="text-[#111827]/50 text-sm">
              No open slots in the next couple of weeks &mdash; call or WhatsApp us below and we&rsquo;ll find a time
              that works.
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-[#111827]/70">
                {altBanner === "slot-taken"
                  ? conflictMessage ?? "That time was just booked by someone else — here are a few nearby options:"
                  : "That exact time isn't open, but here are a few nearby options:"}
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Nearby available times">
                {alternatives.map((slot) => (
                  <button
                    key={slot.scheduledAt}
                    type="button"
                    onClick={() => chooseAlternative(slot)}
                    className="rounded-full border border-[#e4e8ee] text-[#0e2a63] px-4 py-2 text-sm font-utility font-medium transition-colors duration-200 hover:border-[#2f5daa] hover:bg-[#2f5daa]/5 active:scale-[0.97]"
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={backToAsk}
                className="mt-4 text-sm font-medium text-[#111827]/50 hover:text-[#0e2a63] transition-colors"
              >
                Try a different time
              </button>
            </>
          )}
        </motion.div>
      )}

      {(stage === "form" || stage === "submitting") && selected && (
        <motion.div {...revealProps} className="mt-8 pt-8 border-t border-[#e4e8ee]">
          <p className="mb-5 text-sm text-[#111827]/60">
            Booking <span className="font-semibold text-[#0e2a63]">{selected.label}</span>
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitBooking();
            }}
            noValidate
            className="flex flex-col gap-4"
          >
            <div>
              <label htmlFor="booking-name" className="block text-sm font-medium text-[#0e2a63] mb-1.5">
                Name
              </label>
              <input
                id="booking-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                aria-invalid={!!nameError}
                aria-describedby={nameError ? "booking-name-error" : undefined}
                disabled={stage === "submitting"}
                className="w-full rounded-xl border border-[#e4e8ee] px-4 py-2.5 text-sm focus:outline-none focus:border-[#2f5daa] transition-colors disabled:opacity-50"
              />
              {nameError && (
                <p id="booking-name-error" className="mt-1.5 text-xs text-red-600">
                  {nameError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="booking-email" className="block text-sm font-medium text-[#0e2a63] mb-1.5">
                Email
              </label>
              <input
                id="booking-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "booking-email-error" : undefined}
                disabled={stage === "submitting"}
                className="w-full rounded-xl border border-[#e4e8ee] px-4 py-2.5 text-sm focus:outline-none focus:border-[#2f5daa] transition-colors disabled:opacity-50"
              />
              {emailError && (
                <p id="booking-email-error" className="mt-1.5 text-xs text-red-600">
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="booking-phone" className="block text-sm font-medium text-[#0e2a63] mb-1.5">
                Phone <span className="text-[#111827]/40 font-normal">(optional)</span>
              </label>
              <input
                id="booking-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                aria-invalid={!!phoneError}
                aria-describedby={phoneError ? "booking-phone-error" : undefined}
                disabled={stage === "submitting"}
                className="w-full rounded-xl border border-[#e4e8ee] px-4 py-2.5 text-sm focus:outline-none focus:border-[#2f5daa] transition-colors disabled:opacity-50"
              />
              {phoneError && (
                <p id="booking-phone-error" className="mt-1.5 text-xs text-red-600">
                  {phoneError}
                </p>
              )}
            </div>

            {submitError && (
              <p className="text-sm text-red-600" role="alert">
                {submitError}
              </p>
            )}

            <div className="flex items-center gap-3 mt-2">
              <button
                type="submit"
                disabled={stage === "submitting"}
                className="inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility text-sm font-semibold px-6 py-3 hover:bg-[#2f5daa] transition-colors duration-300 active:scale-[0.97] disabled:opacity-50"
              >
                {stage === "submitting" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {stage === "submitting" ? "Booking…" : "Confirm booking"}
              </button>
              <button
                type="button"
                onClick={backToAsk}
                disabled={stage === "submitting"}
                className="text-sm font-medium text-[#111827]/50 hover:text-[#0e2a63] transition-colors disabled:opacity-50"
              >
                Change time
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </div>
  );
}
