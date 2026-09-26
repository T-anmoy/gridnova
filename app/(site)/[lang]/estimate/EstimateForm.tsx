"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "@/components/i18n/Link";
import { fmt, type Messages } from "@/lib/i18n/types";

type T = Messages["estimate"]["form"];

type CustomerType = "residential" | "society";
type RequiredField = "name" | "phone" | "email";
type OptionalField =
  | "state"
  | "cityOrPin"
  | "averageMonthlyBill"
  | "roofType"
  | "roofAreaSqFt"
  | "floors"
  | "connectionPhase";
type Field = RequiredField | OptionalField;

const REQUIRED_FIELDS: RequiredField[] = ["name", "phone", "email"];

// Option values go to /api/estimate-request unchanged (English in every
// locale); visible labels come from t.roofTypes / t.phases, same order.
const ROOF_TYPES = [
  "RCC / Concrete Flat Roof",
  "Sloped Roof (Tin / Tile / Metal)",
  "Ground-Mounted / Open Land",
  "Not Sure",
];

const CONNECTION_PHASES = ["Single Phase", "Three Phase", "Not Sure"];

// ── Per-field validation rules ────────────────────────────────────────────────

function validateField(field: RequiredField, value: string, e: T["errors"]): string | undefined {
  switch (field) {
    case "name": {
      const v = value.trim();
      if (!v) return e.nameRequired;
      if (v.length < 2) return e.nameShort;
      // Any letter in any script — names may be typed in Devanagari or Bengali.
      if (!/\p{L}/u.test(v)) return e.nameInvalid;
      return undefined;
    }
    case "email": {
      const v = value.trim();
      if (!v) return e.emailRequired;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))
        return e.emailInvalid;
      return undefined;
    }
    case "phone": {
      const v = value.trim();
      if (!v) return e.phoneRequired;
      const stripped = v.replace(/[\s\-\(\)\.]/g, "");
      const core = stripped.replace(/^(\+91|91|0)/, "");
      if (!/^\d{10}$/.test(core)) return e.phoneInvalid;
      if (!/^[6-9]/.test(core)) return e.phoneInvalid;
      if (/^(.)\1{9}$/.test(core)) return e.phoneInvalid;
      return undefined;
    }
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FloatLabel({
  id,
  label,
  error,
  optional,
}: {
  id: string;
  label: string;
  error?: string;
  /** The localized "(optional)" suffix, when the field is optional. */
  optional?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <label htmlFor={id} className="font-utility text-xs text-[#111827]/55 uppercase tracking-[0.12em]">
        {label}
        {optional && <span className="normal-case text-[#111827]/35"> {optional}</span>}
      </label>
      <AnimatePresence>
        {error && (
          <motion.span
            key={error}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            className="flex items-center gap-1 text-[11px] text-red-500 font-utility"
          >
            <AlertCircle className="h-3 w-3" />
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputClass = (hasError: boolean) =>
  `w-full rounded-xl border bg-white px-4 py-3.5 text-[#111827] text-sm font-utility outline-none transition-all duration-200 focus:ring-2 ${
    hasError
      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
      : "border-[#e4e8ee] focus:border-[#2f5daa] focus:ring-[#2f5daa]/10"
  }`;

// ── Main form ─────────────────────────────────────────────────────────────────

export default function EstimateForm({ t }: { t: T }) {
  const [customerType, setCustomerType] = useState<CustomerType>("residential");
  const [values, setValues] = useState<Record<Field, string>>({
    name: "",
    phone: "",
    email: "",
    state: "",
    cityOrPin: "",
    averageMonthlyBill: "",
    roofType: "",
    roofAreaSqFt: "",
    floors: "",
    connectionPhase: "",
  });
  const [errors, setErrors] = useState<Partial<Record<RequiredField, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<RequiredField, boolean>>>({});
  const [focused, setFocused] = useState<Field | null>(null);
  // Honeypot: invisible to real users, bots fill it, submission silently rejected
  const [honeypot, setHoneypot] = useState("");

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set(field: Field, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (REQUIRED_FIELDS.includes(field as RequiredField) && touched[field as RequiredField]) {
      const err = validateField(field as RequiredField, value, t.errors);
      setErrors((e) => ({ ...e, [field]: err }));
    }
  }

  function handleBlur(field: RequiredField, currentValue: string) {
    setFocused(null);
    setTouched((t) => ({ ...t, [field]: true }));
    const err = validateField(field, currentValue, t.errors);
    setErrors((e) => ({ ...e, [field]: err }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Silently reject if honeypot is filled (bot submission)
    if (honeypot) return;

    const errs: Partial<Record<RequiredField, string>> = {};
    for (const field of REQUIRED_FIELDS) {
      const err = validateField(field, values[field], t.errors);
      if (err) errs[field] = err;
    }
    setTouched(Object.fromEntries(REQUIRED_FIELDS.map((f) => [f, true])) as Record<RequiredField, boolean>);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setStatus("submitting");
    setSubmitError(null);

    try {
      const res = await fetch("/api/estimate-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerType, ...values, website: honeypot }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setStatus("error");
        setSubmitError(data.error || t.failed);
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setSubmitError(t.failed);
    }
  }

  const visible = (field: RequiredField) => (touched[field] ? errors[field] : undefined);

  if (status === "success") {
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
          {fmt(t.successTitle, { name: values.name.split(" ")[0] })}
        </h2>
        <p className="mt-3 text-[#111827]/65 leading-relaxed max-w-[48ch] mx-auto">
          {t.successBody}
        </p>
        <div className="mt-6 pt-6 border-t border-[#e4e8ee]">
          <p className="text-[#111827]/50 text-sm">
            {t.dontWait}{" "}
            <Link
              href="/book-a-call?source=estimate"
              className="text-[#0e2a63] font-semibold hover:text-[#2f5daa] transition-colors inline-flex items-center gap-1"
            >
              {t.bookInstead}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-white rounded-2xl border border-[#e4e8ee] p-7 md:p-9 space-y-6"
    >
      {/*
        Honeypot field — positioned far off-screen so real visitors never see it.
        Bots crawling the DOM will find and fill it; we silently drop those submissions.
        Not display:none (some bots skip fields hidden that way).
      */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          top: "auto",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          opacity: 0,
          pointerEvents: "none",
        }}
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

      {/* Customer type toggle */}
      <div>
        <p className="font-utility text-xs text-[#111827]/55 uppercase tracking-[0.12em] mb-2.5">
          {t.enquiringAs}
        </p>
        <div className="inline-flex rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-1">
          {(
            [
              ["residential", t.residential],
              ["society", t.society],
            ] as [CustomerType, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCustomerType(value)}
              className={`relative rounded-lg px-5 py-2.5 font-utility text-sm font-semibold transition-colors duration-200 ${
                customerType === value
                  ? "bg-[#0e2a63] text-white"
                  : "text-[#111827]/55 hover:text-[#0e2a63]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[#111827]/50 text-sm leading-relaxed">
          {customerType === "residential"
            ? t.residentialHint
            : t.societyHint}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <FloatLabel id="name" label={t.name} error={visible("name")} />
          <motion.input
            id="name"
            type="text"
            placeholder={t.namePlaceholder}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            onFocus={() => setFocused("name")}
            onBlur={(e) => handleBlur("name", e.target.value)}
            animate={{ scale: focused === "name" ? 1.005 : 1 }}
            transition={{ duration: 0.1 }}
            className={inputClass(!!visible("name"))}
          />
        </div>
        <div>
          <FloatLabel id="email" label={t.email} error={visible("email")} />
          <motion.input
            id="email"
            type="email"
            placeholder="ravi@company.in"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            onFocus={() => setFocused("email")}
            onBlur={(e) => handleBlur("email", e.target.value)}
            animate={{ scale: focused === "email" ? 1.005 : 1 }}
            transition={{ duration: 0.1 }}
            className={inputClass(!!visible("email"))}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <FloatLabel id="phone" label={t.phone} error={visible("phone")} />
          <motion.input
            id="phone"
            type="tel"
            placeholder="+91 98700 00000"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            onFocus={() => setFocused("phone")}
            onBlur={(e) => handleBlur("phone", e.target.value)}
            animate={{ scale: focused === "phone" ? 1.005 : 1 }}
            transition={{ duration: 0.1 }}
            className={inputClass(!!visible("phone"))}
          />
        </div>
        <div>
          <FloatLabel id="state" label={t.state} optional={t.optional} />
          <motion.input
            id="state"
            type="text"
            placeholder={t.statePlaceholder}
            value={values.state}
            onChange={(e) => set("state", e.target.value)}
            onFocus={() => setFocused("state")}
            onBlur={() => setFocused(null)}
            animate={{ scale: focused === "state" ? 1.005 : 1 }}
            transition={{ duration: 0.1 }}
            className={inputClass(false)}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <FloatLabel id="cityOrPin" label={t.city} optional={t.optional} />
          <motion.input
            id="cityOrPin"
            type="text"
            placeholder={t.cityPlaceholder}
            value={values.cityOrPin}
            onChange={(e) => set("cityOrPin", e.target.value)}
            onFocus={() => setFocused("cityOrPin")}
            onBlur={() => setFocused(null)}
            animate={{ scale: focused === "cityOrPin" ? 1.005 : 1 }}
            transition={{ duration: 0.1 }}
            className={inputClass(false)}
          />
        </div>
        <div>
          <FloatLabel id="averageMonthlyBill" label={t.bill} optional={t.optional} />
          <motion.input
            id="averageMonthlyBill"
            type="text"
            inputMode="numeric"
            placeholder="3000"
            value={values.averageMonthlyBill}
            onChange={(e) => set("averageMonthlyBill", e.target.value)}
            onFocus={() => setFocused("averageMonthlyBill")}
            onBlur={() => setFocused(null)}
            animate={{ scale: focused === "averageMonthlyBill" ? 1.005 : 1 }}
            transition={{ duration: 0.1 }}
            className={inputClass(false)}
          />
        </div>
      </div>

      <p className="text-[#111827]/50 text-xs font-utility leading-relaxed -mt-1">
        {t.serviceArea}
      </p>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <FloatLabel id="roofType" label={t.roofType} optional={t.optional} />
          <motion.select
            id="roofType"
            value={values.roofType}
            onChange={(e) => set("roofType", e.target.value)}
            onFocus={() => setFocused("roofType")}
            onBlur={() => setFocused(null)}
            animate={{ scale: focused === "roofType" ? 1.005 : 1 }}
            transition={{ duration: 0.1 }}
            className={`${inputClass(false)} cursor-pointer appearance-none`}
          >
            <option value="">{t.roofTypePlaceholder}</option>
            {ROOF_TYPES.map((r, i) => (
              <option key={r} value={r}>{t.roofTypes[i]}</option>
            ))}
          </motion.select>
        </div>
        <div>
          <FloatLabel id="connectionPhase" label={t.phase} optional={t.optional} />
          <motion.select
            id="connectionPhase"
            value={values.connectionPhase}
            onChange={(e) => set("connectionPhase", e.target.value)}
            onFocus={() => setFocused("connectionPhase")}
            onBlur={() => setFocused(null)}
            animate={{ scale: focused === "connectionPhase" ? 1.005 : 1 }}
            transition={{ duration: 0.1 }}
            className={`${inputClass(false)} cursor-pointer appearance-none`}
          >
            <option value="">{t.phasePlaceholder}</option>
            {CONNECTION_PHASES.map((c, i) => (
              <option key={c} value={c}>{t.phases[i]}</option>
            ))}
          </motion.select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <FloatLabel id="roofAreaSqFt" label={t.roofArea} optional={t.optional} />
          <motion.input
            id="roofAreaSqFt"
            type="text"
            inputMode="numeric"
            placeholder="800"
            value={values.roofAreaSqFt}
            onChange={(e) => set("roofAreaSqFt", e.target.value)}
            onFocus={() => setFocused("roofAreaSqFt")}
            onBlur={() => setFocused(null)}
            animate={{ scale: focused === "roofAreaSqFt" ? 1.005 : 1 }}
            transition={{ duration: 0.1 }}
            className={inputClass(false)}
          />
        </div>
        <div>
          <FloatLabel id="floors" label={t.floors} optional={t.optional} />
          <motion.input
            id="floors"
            type="text"
            inputMode="numeric"
            placeholder="2"
            value={values.floors}
            onChange={(e) => set("floors", e.target.value)}
            onFocus={() => setFocused("floors")}
            onBlur={() => setFocused(null)}
            animate={{ scale: focused === "floors" ? 1.005 : 1 }}
            transition={{ duration: 0.1 }}
            className={inputClass(false)}
          />
        </div>
      </div>

      <AnimatePresence>
        {status === "error" && submitError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 font-utility"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {submitError}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-4 pt-2">
        <p className="text-[#111827]/40 text-xs font-utility leading-snug max-w-[32ch]">
          {t.noPrice}
        </p>
        <motion.button
          type="submit"
          disabled={status === "submitting"}
          whileTap={{ scale: 0.97 }}
          className="btn btn-primary shrink-0"
        >
          {status === "submitting" ? t.sending : t.submit}
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      </div>
    </form>
  );
}
