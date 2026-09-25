"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle2, Zap } from "lucide-react";
import {
  TextField,
  SelectField,
  ToggleGroup,
  YesNoToggle,
  SectionHeading,
} from "@/app/proposal/new/formPrimitives";
import { STATES } from "@/app/proposal/new/types";
import {
  type CustomerType,
  type SizingMethod,
  type InstantEstimateResult,
  toSegment,
  sizingMethodToEngineKey,
  ROOF_TYPE_LABELS,
  roofLabelToEngineKey,
  CONNECTION_PHASES,
  connectionPhaseToEngineKey,
  ACCESS_DIFFICULTY_LABELS,
  accessDifficultyLabelToEngineKey,
  SHADING_LABELS,
  shadingLabelToEngineKey,
  discomsForState,
  roofAreaToSizeKw,
  validateEmail,
  validatePhone,
  validateName,
  validatePinCode,
} from "./lib";
import StaticEstimateReveal from "./StaticEstimateReveal";

// CountUp (inside EstimateReveal) pulls in gsap + ScrollTrigger — kept out of
// this page's initial JS via next/dynamic, since most visitors haven't
// reached a result yet. Wrapped in our own <Suspense> below (rather than
// dynamic()'s `loading` option) so the fallback can show the real resolved
// breakdown instead of a hardcoded placeholder — same markup, just without
// the count-up animation, so there's no layout shift and no wrong numbers
// flashing while this chunk loads in.
const EstimateReveal = dynamic(() => import("./EstimateReveal"));

const STEP_NAMES = ["Basics", "Sizing", "Site Details", "Your Estimate", "Get In Touch"];
const TOTAL_STEPS = STEP_NAMES.length;

type EstimateStatus = "idle" | "loading" | "success" | "error";
type SubmitStatus = "idle" | "submitting" | "success" | "error";

export default function SolarCalculator() {
  const [step, setStep] = useState(0);

  // Step A — Basics
  const [customerType, setCustomerType] = useState<CustomerType>("residential");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [discom, setDiscom] = useState("");
  const [pinTouched, setPinTouched] = useState(false);

  // Step B — Sizing
  const [sizingMethod, setSizingMethod] = useState<SizingMethod>("bill");
  const [averageMonthlyBill, setAverageMonthlyBill] = useState("");
  const [monthlyUnits, setMonthlyUnits] = useState("");
  const [roofAreaSqFt, setRoofAreaSqFt] = useState("");
  const [connectionPhase, setConnectionPhase] = useState("");

  // Step C — Site Details
  const [roofTypeLabel, setRoofTypeLabel] = useState("");
  const [floors, setFloors] = useState("1");
  const [accessDifficultyLabel, setAccessDifficultyLabel] = useState("");
  const [shadingLabel, setShadingLabel] = useState("");
  const [subsidyInterest, setSubsidyInterest] = useState<"yes" | "no">("yes");

  // Step D — Instant Estimate
  const [estimateStatus, setEstimateStatus] = useState<EstimateStatus>("idle");
  const [estimateResult, setEstimateResult] = useState<InstantEstimateResult | null>(null);

  // Step E — Capture
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [touched, setTouched] = useState<Partial<Record<"fullName" | "phone" | "email", boolean>>>({});
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const nameError = touched.fullName ? validateName(fullName) : undefined;
  const phoneError = touched.phone ? validatePhone(phone) : undefined;
  const emailError = touched.email ? validateEmail(email) : undefined;
  const pinError = pinTouched ? validatePinCode(pinCode) : undefined;

  function handleStateChange(value: string) {
    setState(value);
    setDiscom(""); // last state's DISCOM choice may not apply to the new state
  }

  // Fetch the indicative estimate the moment the results step is reached.
  // Public, unauthenticated call straight to the backend — same direct-fetch
  // pattern AskNova.tsx already uses for its own public endpoint, no Clerk
  // token involved since there's nothing to authenticate here.
  useEffect(() => {
    if (step !== 3 || estimateStatus !== "idle") return;

    async function fetchEstimate() {
      setEstimateStatus("loading");
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        const sizingValue: Record<string, number> =
          sizingMethod === "bill"
            ? { monthly_bill_inr: parseFloat(averageMonthlyBill) }
            : sizingMethod === "units"
              ? { monthly_units_kwh: parseFloat(monthlyUnits) }
              : { usable_roof_area_sqft: parseFloat(roofAreaSqFt) };

        const res = await fetch(`${apiBase}/api/v1/pricing/instant-estimate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            segment: toSegment(customerType),
            state,
            sizing_method: sizingMethodToEngineKey(sizingMethod),
            ...sizingValue,
            connection_phase: connectionPhaseToEngineKey(connectionPhase),
            roof_type: roofLabelToEngineKey(roofTypeLabel),
            floors: floors ? parseInt(floors, 10) : undefined,
            shading: shadingLabelToEngineKey(shadingLabel),
            access_difficulty: accessDifficultyLabelToEngineKey(accessDifficultyLabel),
            is_remote: false,
            is_housing_society: customerType === "society",
          }),
          signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) throw new Error(`Pricing endpoint returned ${res.status}`);

        const data = await res.json();
        if (
          typeof data.recommended_size_kw !== "number" ||
          typeof data.base_cost !== "number" ||
          typeof data.subtotal_before_tax !== "number" ||
          typeof data.is_indicative_range !== "boolean"
        ) {
          throw new Error("Unexpected pricing response shape");
        }

        setEstimateResult({
          recommendedSizeKw: data.recommended_size_kw,
          baseCost: data.base_cost,
          accessDifficultyAdder: data.adders?.access_difficulty ?? 0,
          componentBreakdown: data.component_breakdown ?? {},
          subtotalBeforeTax: data.subtotal_before_tax,
          gstAmount: data.gst_amount,
          subsidyInr: data.subsidy_inr ?? 0,
          netCost: data.net_cost,
          isIndicativeRange: data.is_indicative_range,
          netCostRangeMin: data.net_cost_range_min,
          netCostRangeMax: data.net_cost_range_max,
          note: data.note,
        });
        setEstimateStatus("success");
      } catch {
        // Never let an unreachable/slow pricing endpoint strand the visitor —
        // the rest of the flow (and Lead creation) works exactly the same
        // either way; only the live number is unavailable.
        setEstimateStatus("error");
      }
    }

    void fetchEstimate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function goNext() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const step0Valid = !!state && !!city.trim() && !validatePinCode(pinCode);
  const step1Valid =
    (sizingMethod === "bill"
      ? !!averageMonthlyBill && Number(averageMonthlyBill) > 0
      : sizingMethod === "units"
        ? !!monthlyUnits && Number(monthlyUnits) > 0
        : !!roofAreaSqFt && Number(roofAreaSqFt) > 0) && !!connectionPhase;
  // Site Details is entirely optional/never-blocking, per design — every
  // field here has a sensible backend fallback when omitted.
  const step2Valid = true;

  async function handleSubmit() {
    if (honeypot) return; // silent bot rejection

    const nErr = validateName(fullName);
    const pErr = validatePhone(phone);
    const eErr = validateEmail(email);
    if (nErr || pErr || eErr) {
      setTouched({ fullName: true, phone: true, email: true });
      return;
    }

    setSubmitStatus("submitting");
    setSubmitError(null);

    try {
      const res = await fetch("/api/configurator-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerType,
          name: fullName,
          phone,
          email,
          state,
          city,
          pinCode,
          discom: discom || undefined,
          sizingMethod,
          averageMonthlyBill: sizingMethod === "bill" ? averageMonthlyBill : undefined,
          monthlyUnits: sizingMethod === "units" ? monthlyUnits : undefined,
          roofAreaSqFt: sizingMethod === "roof_area" ? roofAreaSqFt : undefined,
          connectionPhase: connectionPhase || undefined,
          roofType: roofTypeLabel || undefined,
          floors: floors || undefined,
          accessDifficulty: accessDifficultyLabel || undefined,
          shading: shadingLabel || undefined,
          subsidyInterest,
          indicativeTotalInr: estimateResult?.netCost ?? estimateResult?.netCostRangeMax ?? undefined,
          website: honeypot,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setSubmitStatus("error");
        setSubmitError(data?.error || "Something went wrong. Please try again or call us directly.");
        return;
      }

      setSubmitStatus("success");
    } catch {
      setSubmitStatus("error");
      setSubmitError("Something went wrong. Please try again or call us directly.");
    }
  }

  if (submitStatus === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="bg-white rounded-2xl border border-[#e4e8ee] p-10 md:p-14 text-center"
      >
        <div className="mx-auto h-14 w-14 rounded-full bg-[#f7a800]/10 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-[#f7a800]" />
        </div>
        <h2 className="mt-6 font-display text-[#0e2a63] text-2xl font-semibold">
          Thank you, {fullName.split(" ")[0]}.
        </h2>
        <p className="mt-3 text-[#111827]/65 leading-relaxed max-w-[48ch] mx-auto">
          We&rsquo;ve received your details. Our team will get back to you
          within 48 business hours to walk through your estimate in detail.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e4e8ee] p-7 md:p-9">
      {/* Honeypot — invisible to real users, silently rejected if filled. */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", top: "auto", width: "1px", height: "1px", overflow: "hidden", opacity: 0, pointerEvents: "none" }}
      >
        <label htmlFor="hp_website">Website</label>
        <input
          id="hp_website"
          name="website"
          type="text"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="font-utility text-xs text-[#111827]/55 uppercase tracking-[0.12em]">
            Step {step + 1} of {TOTAL_STEPS} — {STEP_NAMES[step]}
          </p>
          <p className="font-utility text-xs text-[#111827]/35">
            {Math.round(((step + 1) / TOTAL_STEPS) * 100)}%
          </p>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#e4e8ee] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[#f7a800]"
            initial={false}
            animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>
      </div>

      <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
        {step === 0 && (
          <div className="space-y-6">
            <SectionHeading>Tell us about your project</SectionHeading>
            <ToggleGroup<CustomerType>
              label="I'm enquiring as a"
              value={customerType}
              onChange={setCustomerType}
              options={[
                ["residential", "Residential"],
                ["society", "Housing Society"],
              ]}
            />
            <div className="grid sm:grid-cols-2 gap-5">
              <SelectField
                id="sc-state"
                label="State"
                value={state}
                onChange={handleStateChange}
                options={STATES}
                placeholder="Select state…"
              />
              <TextField
                id="sc-city"
                label="City"
                value={city}
                onChange={setCity}
                placeholder="Kolkata"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <TextField
                id="sc-pin"
                label="PIN Code"
                value={pinCode}
                onChange={(v) => setPinCode(v.replace(/\D/g, "").slice(0, 6))}
                onBlur={() => setPinTouched(true)}
                error={pinError}
                placeholder="700001"
                inputMode="numeric"
              />
              <SelectField
                id="sc-discom"
                label="DISCOM / Electricity Board"
                value={discom}
                onChange={setDiscom}
                options={discomsForState(state)}
                optional
                placeholder="Select DISCOM…"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <SectionHeading>Size your system</SectionHeading>
            <ToggleGroup<SizingMethod>
              label="How would you like to size this?"
              value={sizingMethod}
              onChange={setSizingMethod}
              options={[
                ["bill", "By Monthly Bill"],
                ["units", "By Monthly Units"],
                ["roof_area", "By Roof Area"],
              ]}
              note="Not sure which? Your monthly electricity consumption (in units/kWh) usually gives the most accurate estimate."
            />
            {sizingMethod === "bill" ? (
              <TextField
                id="sc-bill"
                label="Average Monthly Electricity Bill (₹)"
                value={averageMonthlyBill}
                onChange={setAverageMonthlyBill}
                placeholder="3500"
                inputMode="numeric"
              />
            ) : sizingMethod === "units" ? (
              <TextField
                id="sc-units"
                label="Average Monthly Consumption (units / kWh)"
                value={monthlyUnits}
                onChange={setMonthlyUnits}
                placeholder="450"
                inputMode="numeric"
              />
            ) : (
              <div>
                <TextField
                  id="sc-roof-area"
                  label="Available Roof Area (sq ft)"
                  value={roofAreaSqFt}
                  onChange={setRoofAreaSqFt}
                  placeholder="800"
                  inputMode="numeric"
                />
                {!!roofAreaSqFt && Number(roofAreaSqFt) > 0 && (
                  <p className="mt-1.5 text-[#111827]/45 text-xs font-utility">
                    &asymp; {roofAreaToSizeKw(Number(roofAreaSqFt))} kW indicative capacity
                  </p>
                )}
              </div>
            )}
            <SelectField
              id="sc-phase"
              label="Connection Phase"
              value={connectionPhase}
              onChange={setConnectionPhase}
              options={CONNECTION_PHASES}
              placeholder="Select connection phase…"
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <SectionHeading>Tell us about the site</SectionHeading>
            <div className="grid sm:grid-cols-2 gap-5">
              <SelectField
                id="sc-roof-type"
                label="Roof Type"
                value={roofTypeLabel}
                onChange={setRoofTypeLabel}
                options={ROOF_TYPE_LABELS}
                optional
                placeholder="Select roof type…"
              />
              <TextField
                id="sc-floors"
                label="Number of Floors"
                value={floors}
                onChange={(v) => setFloors(v.replace(/\D/g, ""))}
                optional
                placeholder="1"
                inputMode="numeric"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <SelectField
                id="sc-access"
                label="Site Access Difficulty"
                value={accessDifficultyLabel}
                onChange={setAccessDifficultyLabel}
                options={ACCESS_DIFFICULTY_LABELS}
                optional
                placeholder="Select access difficulty…"
              />
              <SelectField
                id="sc-shading"
                label="Shading Condition"
                value={shadingLabel}
                onChange={setShadingLabel}
                options={SHADING_LABELS}
                optional
                placeholder="Select shading condition…"
              />
            </div>
            <YesNoToggle
              label="Interested in the PM Surya Ghar subsidy?"
              value={subsidyInterest}
              onChange={setSubsidyInterest}
              note="A residential rooftop system may qualify for a central government subsidy — we'll factor this into your estimate below."
            />
            <p className="text-[#111827]/50 text-xs font-utility leading-relaxed rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] px-4 py-3.5">
              You can share your electricity bill or roof photos with our team after submitting —
              WhatsApp us at{" "}
              <a href="tel:+919874774440" className="text-[#0e2a63] font-medium hover:underline">
                +91 98747 74440
              </a>{" "}
              or email{" "}
              <a href="mailto:info@gridnova.in" className="text-[#0e2a63] font-medium hover:underline">
                info@gridnova.in
              </a>
              .
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <SectionHeading>Your instant estimate</SectionHeading>

            {estimateStatus === "loading" && (
              <div className="rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-10 text-center">
                <Zap className="h-6 w-6 text-[#f7a800] mx-auto animate-pulse" />
                <p className="mt-3 font-utility text-sm text-[#111827]/55">Calculating your estimate…</p>
              </div>
            )}

            {estimateStatus === "success" && estimateResult && (
              <Suspense fallback={<StaticEstimateReveal result={estimateResult} />}>
                <EstimateReveal result={estimateResult} />
              </Suspense>
            )}

            {estimateStatus === "error" && (
              <div className="rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-8 text-center">
                <AlertCircle className="h-6 w-6 text-[#2f5daa] mx-auto" />
                <p className="mt-3 font-utility text-sm text-[#0e2a63] font-medium">
                  We&rsquo;ll calculate your estimate and follow up personally.
                </p>
                <p className="mt-1.5 text-[#111827]/50 text-xs font-utility leading-relaxed max-w-[42ch] mx-auto">
                  Our instant calculator is briefly unavailable, but your details below will still reach
                  our team so we can prepare your estimate directly.
                </p>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <SectionHeading>Get in touch</SectionHeading>
            <p className="text-[#111827]/50 text-sm font-utility -mt-4">
              Share your contact details and our team will follow up with your full estimate.
            </p>
            <div className="grid sm:grid-cols-2 gap-5">
              <TextField
                id="sc-name"
                label="Your Name"
                value={fullName}
                onChange={setFullName}
                onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
                error={nameError}
                placeholder="Ravi Sharma"
              />
              <TextField
                id="sc-email"
                label="Email Address"
                value={email}
                onChange={setEmail}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                error={emailError}
                placeholder="ravi@company.in"
                type="email"
              />
            </div>
            <TextField
              id="sc-phone"
              label="Phone Number"
              value={phone}
              onChange={setPhone}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              error={phoneError}
              placeholder="+91 98700 00000"
              type="tel"
            />

            {submitStatus === "error" && submitError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 font-utility">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {submitError}
              </div>
            )}
          </div>
        )}
      </motion.div>

      <div className="mt-9 pt-6 border-t border-[#e4e8ee] flex items-center justify-between gap-4">
        {step > 0 ? (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-full border border-[#e4e8ee] text-[#0e2a63] font-utility font-semibold text-sm px-5 py-3 hover:bg-[#f7f9fc] transition-colors duration-300 active:scale-[0.97]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          <span />
        )}

        {step === 0 && (
          <button
            type="button"
            onClick={goNext}
            disabled={!step0Valid}
            className="inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#2f5daa] transition-colors duration-300 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
        {step === 1 && (
          <button
            type="button"
            onClick={goNext}
            disabled={!step1Valid}
            className="inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#2f5daa] transition-colors duration-300 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
        {step === 2 && (
          <button
            type="button"
            onClick={goNext}
            disabled={!step2Valid}
            className="inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#2f5daa] transition-colors duration-300 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
        {step === 3 && estimateStatus === "success" && estimateResult ? (
          // Once a real result is shown, the primary path becomes booking a
          // site visit — carrying the calculator's own output forward as
          // read-only context (see BookingContextSummary on /book-a-call)
          // rather than making the visitor re-explain themselves.
          <Link
            href={{
              pathname: "/book-a-call",
              query: {
                estimatedTotal: String(estimateResult.netCost ?? estimateResult.netCostRangeMax ?? ""),
                sizingMethod,
                sizingValue:
                  sizingMethod === "bill" ? averageMonthlyBill : sizingMethod === "units" ? monthlyUnits : roofAreaSqFt,
                source: "calculator",
              },
            }}
            className="inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#2f5daa] transition-colors duration-300 active:scale-[0.97]"
          >
            Book a Free Site Visit
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : step === 3 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={estimateStatus === "loading"}
            className="inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#2f5daa] transition-colors duration-300 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : null}
        {step === 4 && (
          <motion.button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitStatus === "submitting"}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#2f5daa] transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitStatus === "submitting" ? "Sending…" : "Get My Full Estimate"}
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        )}
      </div>
    </div>
  );
}
