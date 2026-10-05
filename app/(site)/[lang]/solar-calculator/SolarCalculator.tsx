"use client";

import { useEffect, useState } from "react";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/types";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle2, Zap } from "lucide-react";
import {
  TextField,
  SelectField,
  ToggleGroup,
  YesNoToggle,
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
import CalculatorReveal from "./CalculatorReveal";
import { parsePriceListEstimate, type PriceListFields } from "@/lib/pricing/price-list";

const TOTAL_STEPS = 5;

// Select option values stay English (they're what /api/configurator-lead and
// the pricing-engine mappings in ./lib expect); this pairs each value with its
// translated label, by position.
function labelMap(values: readonly string[], labels: readonly string[]): Record<string, string> {
  return Object.fromEntries(values.map((v, i) => [v, labels[i] ?? v]));
}

type EstimateStatus = "idle" | "loading" | "success" | "error";
type SubmitStatus = "idle" | "submitting" | "success" | "error";

export default function SolarCalculator() {
  const t = useMessages("calculator");
  const STEP_NAMES = t.stepNames;
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
  const [estimateResult, setEstimateResult] = useState<(PriceListFields & Record<string, unknown>) | null>(null);

  // Step E — Capture
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

        const parsed = parsePriceListEstimate(await res.json());
        if (!parsed) throw new Error("Unexpected pricing response shape");
        setEstimateResult(parsed);
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

  const step0Valid = !!state && !!city.trim() && !validatePinCode(pinCode, t.errors);
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
          // Internal only (the lead email): the back-compat net figure, never shown to the visitor.
          indicativeTotalInr: typeof estimateResult?.net_cost === "number" ? estimateResult.net_cost : undefined,
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
          {fmt(t.successTitle, { name: fullName.split(" ")[0] })}
        </h2>
        <p className="mt-3 text-[#111827]/65 leading-relaxed max-w-[48ch] mx-auto">
          {t.successBody}
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
            {fmt(t.stepOf, { step: step + 1, total: TOTAL_STEPS, name: STEP_NAMES[step] })}
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
            <SectionHeading>{t.basics.heading}</SectionHeading>
            <ToggleGroup<CustomerType>
              label={t.basics.enquiringAs}
              value={customerType}
              onChange={setCustomerType}
              options={[
                ["residential", t.basics.residential],
                ["society", t.basics.society],
              ]}
            />
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
              <TextField
                id="sc-city"
                label={t.basics.city}
                value={city}
                onChange={setCity}
                placeholder={t.basics.cityPlaceholder}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <TextField
                id="sc-pin"
                label={t.basics.pin}
                value={pinCode}
                onChange={(v) => setPinCode(v.replace(/\D/g, "").slice(0, 6))}
                onBlur={() => setPinTouched(true)}
                error={pinError}
                placeholder="700001"
                inputMode="numeric"
              />
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
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <SectionHeading>{t.sizing.heading}</SectionHeading>
            <ToggleGroup<SizingMethod>
              label={t.sizing.method}
              value={sizingMethod}
              onChange={setSizingMethod}
              options={[
                ["bill", t.sizing.byBill],
                ["units", t.sizing.byUnits],
                ["roof_area", t.sizing.byRoof],
              ]}
              note={t.sizing.note}
            />
            {sizingMethod === "bill" ? (
              <TextField
                id="sc-bill"
                label={t.sizing.bill}
                value={averageMonthlyBill}
                onChange={setAverageMonthlyBill}
                placeholder="3500"
                inputMode="numeric"
              />
            ) : sizingMethod === "units" ? (
              <TextField
                id="sc-units"
                label={t.sizing.units}
                value={monthlyUnits}
                onChange={setMonthlyUnits}
                placeholder="450"
                inputMode="numeric"
              />
            ) : (
              <div>
                <TextField
                  id="sc-roof-area"
                  label={t.sizing.roofArea}
                  value={roofAreaSqFt}
                  onChange={setRoofAreaSqFt}
                  placeholder="800"
                  inputMode="numeric"
                />
                {!!roofAreaSqFt && Number(roofAreaSqFt) > 0 && (
                  <p className="mt-1.5 text-[#111827]/45 text-xs font-utility">
                    {fmt(t.sizing.roofAreaHint, { kw: roofAreaToSizeKw(Number(roofAreaSqFt)) })}
                  </p>
                )}
              </div>
            )}
            <SelectField
              id="sc-phase"
              label={t.sizing.phase}
              value={connectionPhase}
              onChange={setConnectionPhase}
              options={CONNECTION_PHASES}
              labels={labelMap(CONNECTION_PHASES, t.sizing.phases)}
              placeholder={t.sizing.phasePlaceholder}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <SectionHeading>{t.site.heading}</SectionHeading>
            <div className="grid sm:grid-cols-2 gap-5">
              <SelectField
                id="sc-roof-type"
                label={t.site.roofType}
                value={roofTypeLabel}
                onChange={setRoofTypeLabel}
                options={ROOF_TYPE_LABELS}
                labels={labelMap(ROOF_TYPE_LABELS, t.site.roofTypes)}
                optional
                optionalLabel={t.optional}
                placeholder={t.site.roofTypePlaceholder}
              />
              <TextField
                id="sc-floors"
                label={t.site.floors}
                value={floors}
                onChange={(v) => setFloors(v.replace(/\D/g, ""))}
                optional
                optionalLabel={t.optional}
                placeholder="1"
                inputMode="numeric"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <SelectField
                id="sc-access"
                label={t.site.access}
                value={accessDifficultyLabel}
                onChange={setAccessDifficultyLabel}
                options={ACCESS_DIFFICULTY_LABELS}
                labels={labelMap(ACCESS_DIFFICULTY_LABELS, t.site.accessLevels)}
                optional
                optionalLabel={t.optional}
                placeholder={t.site.accessPlaceholder}
              />
              <SelectField
                id="sc-shading"
                label={t.site.shading}
                value={shadingLabel}
                onChange={setShadingLabel}
                options={SHADING_LABELS}
                labels={labelMap(SHADING_LABELS, t.site.shadingLevels)}
                optional
                optionalLabel={t.optional}
                placeholder={t.site.shadingPlaceholder}
              />
            </div>
            <YesNoToggle
              label={t.site.subsidy}
              value={subsidyInterest}
              onChange={setSubsidyInterest}
              yesLabel={t.yes}
              noLabel={t.no}
              note={t.site.subsidyNote}
            />
            <p className="text-[#111827]/50 text-xs font-utility leading-relaxed rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] px-4 py-3.5">
              {t.site.shareDocs}{" "}
              <a href="tel:+919874774440" className="text-[#0e2a63] font-medium hover:underline">
                +91 98747 74440
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

            {estimateStatus === "loading" && (
              <div className="rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-10 text-center">
                <Zap className="h-6 w-6 text-[#f7a800] mx-auto animate-pulse" />
                <p className="mt-3 font-utility text-sm text-[#111827]/55">{t.result.loading}</p>
              </div>
            )}

            {estimateStatus === "success" && estimateResult && (
              <CalculatorReveal result={estimateResult} />
            )}

            {estimateStatus === "error" && (
              <div className="rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-8 text-center">
                <AlertCircle className="h-6 w-6 text-[#2f5daa] mx-auto" />
                <p className="mt-3 font-utility text-sm text-[#0e2a63] font-medium">
                  {t.result.errorTitle}
                </p>
                <p className="mt-1.5 text-[#111827]/50 text-xs font-utility leading-relaxed max-w-[42ch] mx-auto">
                  {t.result.errorBody}
                </p>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <SectionHeading>{t.contact.heading}</SectionHeading>
            <p className="text-[#111827]/50 text-sm font-utility -mt-4">
              {t.contact.intro}
            </p>
            <div className="grid sm:grid-cols-2 gap-5">
              <TextField
                id="sc-name"
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
              sizingValue:
                sizingMethod === "bill" ? averageMonthlyBill : sizingMethod === "units" ? monthlyUnits : roofAreaSqFt,
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
          <motion.button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitStatus === "submitting"}
            whileTap={{ scale: 0.97 }}
            className="btn btn-primary"
          >
            {submitStatus === "submitting" ? t.sending : t.contact.submit}
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        )}
      </div>
    </div>
  );
}
