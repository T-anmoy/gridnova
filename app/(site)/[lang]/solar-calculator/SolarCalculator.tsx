"use client";

import { API_BASE_URL } from "@/lib/config";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/types";
import { m } from "framer-motion";
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle2, ChevronDown, Zap } from "lucide-react";
import {
  TextField,
  SelectField,
  ToggleGroup,
  SectionHeading,
} from "@/app/(internal)/proposal/new/formPrimitives";
import { STATES } from "@/app/(internal)/proposal/new/types";
import {
  type CustomerType,
  type SizingMethod,
  toSegment,
  sizingMethodToEngineKey,
  ROOF_TYPE_LABELS,
  roofLabelToEngineKey,
  CONNECTION_PHASES,
  connectionPhaseToEngineKey,
  SHADING_LABELS,
  shadingLabelToEngineKey,
  discomsForState,
  INPUT_BOUNDS,
  billValid,
  housesValid,
  parseInput,
  positiveValid,
  unitsValid,
  validateEmail,
  validatePhone,
  validateName,
  validatePinCode,
} from "./lib";
import BillCard from "./BillCard";
import { discomCode, estimateSnapshot, parseSolarEstimate, type SolarEstimate } from "@/lib/pricing/solar-estimate";
import { HELPLINE_DISPLAY, HELPLINE_TEL } from "@/lib/contact";
import MotionProvider from "@/components/MotionProvider";

// The result (packages, subsidy, savings, "How we calculate") is only needed
// from the results step on, so it is not part of the page's first load.
const CalculatorReveal = lazy(() => import("./CalculatorReveal"));

const TOTAL_STEPS = 5;

// Select option values stay English (they're what /api/configurator-lead and
// the pricing-engine mappings in ./lib expect); this pairs each value with its
// translated label, by position.
function labelMap(values: readonly string[], labels: readonly string[]): Record<string, string> {
  return Object.fromEntries(values.map((v, i) => [v, labels[i] ?? v]));
}

function scrollToTopRespectingMotion() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
}

const HINT = "mt-1.5 font-utility text-xs leading-relaxed text-[#111827]/65";
const LINK =
  "inline-flex min-h-[44px] items-center font-utility text-sm font-semibold text-[#2f5daa] underline underline-offset-2 hover:text-[#0e2a63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]";

function ResultLoading({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-10 text-center">
      <Zap className="h-6 w-6 text-[#f7a800] mx-auto animate-pulse motion-reduce:animate-none" aria-hidden="true" />
      <p className="mt-3 font-utility text-sm text-[#111827]/70">{text}</p>
    </div>
  );
}

type EstimateStatus = "idle" | "loading" | "success" | "error";
type SubmitStatus = "idle" | "submitting" | "success" | "error";

function SolarCalculatorInner() {
  const t = useMessages("calculator");
  const STEP_NAMES = t.stepNames;
  const [step, setStep] = useState(0);
  // Each step swaps the form content, so keyboard and screen-reader users are
  // moved to the new step (skipped on first render, which must not steal focus).
  const stepRef = useRef<HTMLDivElement>(null);
  const firstStepRender = useRef(true);
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    stepRef.current?.focus({ preventScroll: true });
  }, [step]);

  // Step 1 — Location
  const [state, setState] = useState("");
  const [discom, setDiscom] = useState("");
  const [city, setCity] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [pinTouched, setPinTouched] = useState(false);

  // Step 2 — Property
  const [customerType, setCustomerType] = useState<CustomerType>("residential");
  const [houses, setHouses] = useState("");
  const isSociety = customerType === "society";

  // Step 3 — Usage. Units first: they give the most accurate estimate; the
  // bill alongside them gives the engine the customer's own price per unit.
  const [sizingMethod, setSizingMethod] = useState<SizingMethod>("units");
  const [monthlyUnits, setMonthlyUnits] = useState("");
  const [averageMonthlyBill, setAverageMonthlyBill] = useState("");
  const [roofAreaSqFt, setRoofAreaSqFt] = useState("");
  // "Improve accuracy" (all optional)
  const [connectionPhase, setConnectionPhase] = useState("");
  const [sanctionedLoad, setSanctionedLoad] = useState("");
  const [roofTypeLabel, setRoofTypeLabel] = useState("");
  const [shadingLabel, setShadingLabel] = useState("");
  const [improveOpen, setImproveOpen] = useState(false);

  // What reaches the engine, per method — a field the visitor typed under
  // another method is never sent.
  const unitsSent = sizingMethod === "units" ? parseInput(monthlyUnits) : undefined;
  const billSent =
    sizingMethod === "bill" || (sizingMethod === "units" && billValid(averageMonthlyBill)) ? parseInput(averageMonthlyBill) : undefined;
  const roofSent = positiveValid(roofAreaSqFt, INPUT_BOUNDS.roofMax) ? parseInput(roofAreaSqFt) : undefined;
  const sanctionedSent = positiveValid(sanctionedLoad, INPUT_BOUNDS.sanctionedMax) ? parseInput(sanctionedLoad) : undefined;
  const housesSent = isSociety && housesValid(houses) ? parseInput(houses) : undefined;
  const phaseSent = connectionPhaseToEngineKey(connectionPhase);
  const discomSent = discom ? discomCode(discom) : undefined;

  // Step 4 — Instant Estimate
  // The estimate is only valid for the exact inputs it was computed from. It is
  // stored with a key derived from every input that reaches the pricing call; a
  // result whose key no longer matches reads as "idle" (never shown, never
  // emailed), so going back, changing an input and returning cannot show — or
  // send — the previous price.
  const inputsKey = JSON.stringify([
    customerType,
    housesSent,
    state,
    discomSent,
    sizingMethod,
    unitsSent,
    billSent,
    roofSent,
    phaseSent,
    sanctionedSent,
    roofTypeLabel,
    shadingLabel,
  ]);
  const [estimate, setEstimate] = useState<{
    key: string;
    status: EstimateStatus;
    result: (SolarEstimate & Record<string, unknown>) | null;
  }>({ key: "", status: "idle", result: null });
  const estimateFresh = estimate.key === inputsKey;
  const estimateStatus: EstimateStatus = estimateFresh ? estimate.status : "idle";
  const estimateResult = estimateFresh ? estimate.result : null;

  // Step 5 — Capture
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [touched, setTouched] = useState<Partial<Record<"fullName" | "phone" | "email", boolean>>>({});
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const nameError = touched.fullName ? validateName(fullName, t.errors) : undefined;
  const phoneError = touched.phone ? validatePhone(phone, t.errors) : undefined;
  const emailError = touched.email ? validateEmail(email, t.errors) : undefined;
  const pinError = pinTouched ? validatePinCode(pinCode, t.errors) : undefined;
  // Range messages show as soon as something out of range is typed; an empty
  // required field just keeps Next disabled.
  const rangeError = (value: string, ok: boolean, message: string) => (value.trim() && !ok ? message : undefined);
  const unitsError = rangeError(monthlyUnits, unitsValid(monthlyUnits), t.errors.unitsRange);
  const billError = rangeError(averageMonthlyBill, billValid(averageMonthlyBill), t.errors.billRange);
  const roofError = rangeError(roofAreaSqFt, roofSent !== undefined, t.errors.roofRange);
  const housesError = rangeError(houses, housesValid(houses), t.errors.housesRange);
  const sanctionedError = rangeError(sanctionedLoad, sanctionedSent !== undefined, t.errors.sanctionedRange);

  function handleStateChange(value: string) {
    setState(value);
    setDiscom(""); // last state's DISCOM choice may not apply to the new state
  }

  // Fetch the indicative estimate the moment the results step is reached.
  // Public, unauthenticated call straight to the backend — same direct-fetch
  // pattern AskNova.tsx already uses for its own public endpoint, no Clerk
  // token involved since there's nothing to authenticate here.
  useEffect(() => {
    if (step !== 3) return;
    // Already loading or loaded for exactly these inputs — nothing to do. An
    // earlier failure for the same inputs is retried on re-entry.
    if (estimate.key === inputsKey && (estimate.status === "loading" || estimate.status === "success")) return;

    const key = inputsKey;
    const controller = new AbortController();

    async function fetchEstimate() {
      setEstimate({ key, status: "loading", result: null });
      try {
        const apiBase = API_BASE_URL;
        const res = await fetch(`${apiBase}/api/v1/pricing/instant-estimate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            segment: toSegment(customerType),
            state,
            discom: discomSent,
            sizing_method: sizingMethodToEngineKey(sizingMethod),
            monthly_units_kwh: unitsSent,
            monthly_bill_inr: billSent,
            usable_roof_area_sqft: roofSent,
            connection_phase: phaseSent,
            sanctioned_load_kw: sanctionedSent,
            roof_type: roofLabelToEngineKey(roofTypeLabel),
            shading: shadingLabelToEngineKey(shadingLabel),
            is_remote: false,
            is_housing_society: isSociety,
            number_of_houses: housesSent,
          }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]),
        });

        if (!res.ok) throw new Error(`Pricing endpoint returned ${res.status}`);

        const parsed = parseSolarEstimate(await res.json());
        if (!parsed) throw new Error("Unexpected pricing response shape");
        setEstimate({ key, status: "success", result: parsed });
      } catch {
        if (controller.signal.aborted) {
          // The visitor left step 3 (or changed an input) mid-request: forget the
          // half-finished attempt so coming back fetches again.
          setEstimate((prev) => (prev.key === key && prev.status === "loading" ? { key: "", status: "idle", result: null } : prev));
          return;
        }
        // Never let an unreachable/slow pricing endpoint strand the visitor —
        // the rest of the flow (and Lead creation) works exactly the same
        // either way; only the live number is unavailable.
        setEstimate({ key, status: "error", result: null });
      }
    }

    void fetchEstimate();
    return () => controller.abort();
    // `estimate` is read only to skip a redundant fetch; re-running on its own
    // updates would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, inputsKey]);

  function goTo(next: number) {
    setStep(Math.max(0, Math.min(next, TOTAL_STEPS - 1)));
    scrollToTopRespectingMotion();
  }
  const goNext = () => goTo(step + 1);
  const goBack = () => goTo(step - 1);

  const step0Valid = !!state && !!city.trim() && !validatePinCode(pinCode, t.errors);
  const step1Valid = !isSociety || housesSent !== undefined;
  // The chosen method's own figure is required; every other field is optional
  // but, when filled, must be in the backend's range.
  const step2Valid =
    (sizingMethod === "units"
      ? unitsValid(monthlyUnits) && !billError
      : sizingMethod === "bill"
        ? billValid(averageMonthlyBill)
        : roofSent !== undefined) &&
    !roofError &&
    !sanctionedError;

  async function handleSubmit() {
    if (honeypot) return; // silent bot rejection

    const nErr = validateName(fullName, t.errors);
    const pErr = validatePhone(phone, t.errors);
    const eErr = validateEmail(email, t.errors);
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
          numberOfHouses: housesSent,
          sizingMethod,
          monthlyUnits: unitsSent !== undefined ? monthlyUnits : undefined,
          averageMonthlyBill: billSent !== undefined ? averageMonthlyBill : undefined,
          roofAreaSqFt: roofSent !== undefined ? roofAreaSqFt : undefined,
          connectionPhase: connectionPhase || undefined,
          sanctionedLoadKw: sanctionedSent !== undefined ? sanctionedLoad : undefined,
          roofType: roofTypeLabel || undefined,
          shading: shadingLabel || undefined,
          // Internal only (the lead email/CRM): the back-compat net figure, never shown to the visitor.
          indicativeTotalInr: typeof estimateResult?.net_cost === "number" ? estimateResult.net_cost : undefined,
          // A copy of the estimate the visitor saw, so the team quotes from the same figures.
          estimate: estimateResult ? estimateSnapshot(estimateResult) : undefined,
          website: honeypot,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setSubmitStatus("error");
        setSubmitError(data?.error || t.failed);
        return;
      }

      setSubmitStatus("success");
    } catch {
      setSubmitStatus("error");
      setSubmitError(t.failed);
    }
  }

  if (submitStatus === "success") {
    return (
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="bg-white rounded-2xl border border-[#e4e8ee] p-10 md:p-14 text-center"
      >
        <div className="mx-auto h-14 w-14 rounded-full bg-[#f7a800]/10 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-[#f7a800]" />
        </div>
        <h2 className="mt-6 font-display text-[#0e2a63] text-2xl font-semibold">
          {fmt(t.successTitle, { name: fullName.split(" ")[0] })}
        </h2>
        <p className="mt-3 text-[#111827]/65 leading-relaxed max-w-[48ch] mx-auto">
          {t.successBody}
        </p>
      </m.div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e4e8ee] p-5 sm:p-7 md:p-9">
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
          <p className="font-utility text-xs text-[#111827]/70 uppercase tracking-[0.12em]">
            {fmt(t.stepOf, { step: step + 1, total: TOTAL_STEPS, name: STEP_NAMES[step] })}
          </p>
          <p className="font-utility text-xs text-[#111827]/60">
            {Math.round(((step + 1) / TOTAL_STEPS) * 100)}%
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-valuenow={step + 1}
          aria-valuetext={fmt(t.stepOf, { step: step + 1, total: TOTAL_STEPS, name: STEP_NAMES[step] })}
          className="h-1.5 w-full rounded-full bg-[#e4e8ee] overflow-hidden"
        >
          <m.div
            className="h-full rounded-full bg-[#f7a800]"
            initial={false}
            animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>
      </div>

      <m.div key={step} ref={stepRef} tabIndex={-1} aria-live="polite" className="outline-none" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
        {step === 0 && (
          <div className="space-y-6">
            <SectionHeading>{t.basics.heading}</SectionHeading>
            <div className="grid sm:grid-cols-2 gap-5">
              <SelectField
                id="sc-state"
                label={t.basics.state}
                value={state}
                onChange={handleStateChange}
                options={STATES}
                labels={t.stateNames}
                placeholder={t.basics.statePlaceholder}
              />
              <div>
                <SelectField
                  id="sc-discom"
                  label={t.basics.discom}
                  value={discom}
                  onChange={setDiscom}
                  options={discomsForState(state)}
                  optional
                  optionalLabel={t.optional}
                  placeholder={t.basics.discomPlaceholder}
                />
                <p className={HINT}>{t.basics.discomHint}</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <TextField
                id="sc-city"
                autoComplete="address-level2"
                label={t.basics.city}
                value={city}
                onChange={setCity}
                placeholder={t.basics.cityPlaceholder}
              />
              <TextField
                id="sc-pin"
                autoComplete="postal-code"
                label={t.basics.pin}
                value={pinCode}
                onChange={(v) => setPinCode(v.replace(/\D/g, "").slice(0, 6))}
                onBlur={() => setPinTouched(true)}
                error={pinError}
                placeholder={t.basics.pinPlaceholder}
                inputMode="numeric"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <SectionHeading>{t.property.heading}</SectionHeading>
            <ToggleGroup<CustomerType>
              label={t.property.label}
              value={customerType}
              onChange={setCustomerType}
              options={[
                ["residential", t.property.home],
                ["society", t.property.society],
              ]}
            />
            {isSociety && (
              <div className="max-w-xs">
                <TextField
                  id="sc-houses"
                  label={t.property.houses}
                  value={houses}
                  onChange={(v) => setHouses(v.replace(/\D/g, ""))}
                  error={housesError}
                  placeholder={t.property.housesPlaceholder}
                  inputMode="numeric"
                />
                <p className={HINT}>{t.property.housesHint}</p>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <SectionHeading>{t.usage.heading}</SectionHeading>
            {sizingMethod === "units" ? (
              <>
                <p className="-mt-3 font-utility text-sm text-[#111827]/70">{t.usage.accuracy}</p>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-5">
                    <div>
                      <TextField
                        id="sc-units"
                        label={t.usage.units}
                        value={monthlyUnits}
                        onChange={setMonthlyUnits}
                        error={unitsError}
                        placeholder={t.usage.unitsPlaceholder}
                        inputMode="decimal"
                      />
                      <p className={HINT}>{t.usage.unitsHint}</p>
                    </div>
                    <div>
                      <TextField
                        id="sc-bill"
                        label={t.usage.bill}
                        value={averageMonthlyBill}
                        onChange={setAverageMonthlyBill}
                        error={billError}
                        optional
                        optionalLabel={t.optional}
                        placeholder={t.usage.billPlaceholder}
                        inputMode="decimal"
                      />
                      <p className={HINT}>{t.usage.billWithUnitsHint}</p>
                    </div>
                  </div>
                  <BillCard t={t.usage.billCard} />
                </div>
              </>
            ) : sizingMethod === "bill" ? (
              <TextField
                id="sc-bill"
                label={t.usage.billOnly}
                value={averageMonthlyBill}
                onChange={setAverageMonthlyBill}
                error={billError}
                placeholder={t.usage.billPlaceholder}
                inputMode="decimal"
              />
            ) : (
              <div>
                <TextField
                  id="sc-roof-area"
                  label={t.usage.roofOnly}
                  value={roofAreaSqFt}
                  onChange={setRoofAreaSqFt}
                  error={roofError}
                  placeholder={t.usage.roofPlaceholder}
                  inputMode="decimal"
                />
                <p className={HINT}>{t.usage.roofHint}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {(
                [
                  ["units", t.usage.knowUnits],
                  ["bill", t.usage.onlyBill],
                  ["roof_area", t.usage.onlyRoof],
                ] as const
              )
                .filter(([m]) => m !== sizingMethod)
                .map(([m, label]) => (
                  <button key={m} type="button" onClick={() => setSizingMethod(m)} className={LINK}>
                    {label}
                  </button>
                ))}
            </div>

            <details className="group rounded-xl border border-[#e4e8ee]" open={improveOpen} onToggle={(e) => setImproveOpen(e.currentTarget.open)}>
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 font-utility text-sm font-semibold text-[#0e2a63] [&::-webkit-details-marker]:hidden">
                <span>
                  {t.usage.improve.title} <span className="font-normal text-[#111827]/60">{t.optional}</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
              </summary>
              <div className="space-y-5 border-t border-[#e4e8ee] px-4 pb-4 pt-3">
                <p className="font-utility text-xs text-[#111827]/65">{t.usage.improve.intro}</p>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <SelectField
                      id="sc-phase"
                      label={t.usage.improve.phase}
                      value={connectionPhase}
                      onChange={setConnectionPhase}
                      options={CONNECTION_PHASES}
                      labels={labelMap(CONNECTION_PHASES, t.usage.improve.phases)}
                      optional
                      optionalLabel={t.optional}
                      placeholder={t.usage.improve.phasePlaceholder}
                    />
                    <p className={HINT}>{t.usage.improve.phaseHint}</p>
                  </div>
                  <div>
                    <TextField
                      id="sc-sanctioned"
                      label={t.usage.improve.sanctioned}
                      value={sanctionedLoad}
                      onChange={setSanctionedLoad}
                      error={sanctionedError}
                      optional
                      optionalLabel={t.optional}
                      placeholder={t.usage.improve.sanctionedPlaceholder}
                      inputMode="decimal"
                    />
                    <p className={HINT}>{t.usage.improve.sanctionedHint}</p>
                  </div>
                </div>
                {sizingMethod !== "roof_area" && (
                  <TextField
                    id="sc-improve-roof"
                    label={t.usage.improve.roofArea}
                    value={roofAreaSqFt}
                    onChange={setRoofAreaSqFt}
                    error={roofError}
                    optional
                    optionalLabel={t.optional}
                    placeholder={t.usage.improve.roofAreaPlaceholder}
                    inputMode="decimal"
                  />
                )}
                <div className="grid sm:grid-cols-2 gap-5">
                  <SelectField
                    id="sc-shading"
                    label={t.usage.improve.shading}
                    value={shadingLabel}
                    onChange={setShadingLabel}
                    options={SHADING_LABELS}
                    labels={labelMap(SHADING_LABELS, t.usage.improve.shadingLevels)}
                    optional
                    optionalLabel={t.optional}
                    placeholder={t.usage.improve.shadingPlaceholder}
                  />
                  <SelectField
                    id="sc-roof-type"
                    label={t.usage.improve.roofType}
                    value={roofTypeLabel}
                    onChange={setRoofTypeLabel}
                    options={ROOF_TYPE_LABELS}
                    labels={labelMap(ROOF_TYPE_LABELS, t.usage.improve.roofTypes)}
                    optional
                    optionalLabel={t.optional}
                    placeholder={t.usage.improve.roofTypePlaceholder}
                  />
                </div>
              </div>
            </details>

            <p className="text-[#111827]/65 text-xs font-utility leading-relaxed rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] px-4 py-3.5">
              {t.usage.shareDocs}{" "}
              <a href={HELPLINE_TEL} className="text-[#0e2a63] font-medium hover:underline">
                {HELPLINE_DISPLAY}
              </a>{" "}
              {t.orEmail}{" "}
              <a href="mailto:info@gridnova.in" className="text-[#0e2a63] font-medium hover:underline">
                info@gridnova.in
              </a>
              .
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <SectionHeading>{t.result.heading}</SectionHeading>

            {(estimateStatus === "loading" || estimateStatus === "idle") && <ResultLoading text={t.result.loading} />}

            {estimateStatus === "success" && estimateResult && (
              <Suspense fallback={<ResultLoading text={t.result.loading} />}>
                <CalculatorReveal
                  result={estimateResult}
                  phasePrompt={
                    phaseSent ? undefined : (
                      <div data-testid="phase-prompt" className="rounded-xl border border-[#2f5daa]/30 bg-[#2f5daa]/5 p-4">
                        <p className="font-utility text-sm font-semibold text-[#0e2a63]">{t.result.phasePrompt}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {CONNECTION_PHASES.slice(0, 2).map((ph, i) => (
                            <button key={ph} type="button" onClick={() => setConnectionPhase(ph)} className="btn btn-secondary">
                              {t.usage.improve.phases[i]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  }
                  housesPrompt={
                    <button type="button" onClick={() => goTo(1)} className={`${LINK} mt-1`}>
                      {t.property.houses}
                    </button>
                  }
                />
              </Suspense>
            )}

            {estimateStatus === "error" && (
              <div className="rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-8 text-center">
                <AlertCircle className="h-6 w-6 text-[#2f5daa] mx-auto" />
                <p className="mt-3 font-utility text-sm text-[#0e2a63] font-medium">
                  {t.result.errorTitle}
                </p>
                <p className="mt-1.5 text-[#111827]/65 text-xs font-utility leading-relaxed max-w-[42ch] mx-auto">
                  {t.result.errorBody}
                </p>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <SectionHeading>{t.contact.heading}</SectionHeading>
            <p className="text-[#111827]/65 text-sm font-utility -mt-4">
              {t.contact.intro}
            </p>
            <div className="grid sm:grid-cols-2 gap-5">
              <TextField
                id="sc-name"
                autoComplete="name"
                label={t.contact.name}
                value={fullName}
                onChange={setFullName}
                onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
                error={nameError}
                placeholder={t.contact.namePlaceholder}
              />
              <TextField
                id="sc-email"
                label={t.contact.email}
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
              label={t.contact.phone}
              value={phone}
              onChange={setPhone}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              error={phoneError}
              placeholder="+91 98700 00000"
              type="tel"
            />

            {submitStatus === "error" && submitError && (
              <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-utility">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                {submitError}
              </div>
            )}
          </div>
        )}
      </m.div>

      <div className="mt-9 pt-6 border-t border-[#e4e8ee] flex items-center justify-between gap-4">
        {step > 0 ? (
          <button
            type="button"
            onClick={goBack}
            className="btn btn-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.back}
          </button>
        ) : (
          <span />
        )}

        {step === 0 && (
          <button
            type="button"
            onClick={goNext}
            disabled={!step0Valid}
            className="btn btn-primary"
          >
            {t.next}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
        {step === 1 && (
          <button
            type="button"
            onClick={goNext}
            disabled={!step1Valid}
            className="btn btn-primary"
          >
            {t.next}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
        {step === 2 && (
          <button
            type="button"
            onClick={goNext}
            disabled={!step2Valid}
            className="btn btn-primary"
          >
            {t.next}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
        {step === 3 && estimateStatus === "success" && estimateResult?.price_status === "list_price" ? (
          // Once a real result is shown, the primary path becomes booking a
          // site visit — carrying the calculator's own output forward as
          // read-only context (see BookingContextSummary on /book-a-call)
          // rather than making the visitor re-explain themselves.
          <Link
            href={`/book-a-call?${new URLSearchParams({
              sizingMethod,
              sizingValue: sizingMethod === "units" ? monthlyUnits : sizingMethod === "bill" ? averageMonthlyBill : roofAreaSqFt,
              source: "calculator",
            }).toString()}`}
            className="btn btn-primary"
          >
            {t.result.bookVisit}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : step === 3 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={estimateStatus === "loading"}
            className="btn btn-primary"
          >
            {t.continue}
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : null}
        {step === 4 && (
          <m.button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitStatus === "submitting"}
            whileTap={{ scale: 0.97 }}
            className="btn btn-primary"
          >
            {submitStatus === "submitting" ? t.sending : t.contact.submit}
            <ArrowRight className="h-4 w-4" />
          </m.button>
        )}
      </div>
    </div>
  );
}

// framer-motion is not in the site-wide layout any more (it only ships to the
// pages that animate with it), so this component brings its own LazyMotion.
export default function SolarCalculator() {
  return (
    <MotionProvider>
      <SolarCalculatorInner />
    </MotionProvider>
  );
}
