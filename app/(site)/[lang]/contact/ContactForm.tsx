"use client";

import { useRef, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { FormFieldLabel, fieldA11y, fieldClass, focusFirstInvalid } from "@/components/forms/FormField";
import { ArrowRight, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { fmt, type Messages } from "@/lib/i18n/types";
import { HELPLINE_DISPLAY, HELPLINE_TEL } from "@/lib/contact";
import MotionProvider from "@/components/MotionProvider";

type T = Messages["contact"]["form"];

type Field = "name" | "email" | "phone" | "interest" | "message";
type SubmitStatus = "idle" | "submitting" | "success" | "error";

// Option values are sent to /api/contact as-is and stay English in every
// locale; only the visible labels (t.interests, same order) are translated.
const INTERESTS = [
  "Residential Rooftop",
  "Commercial Rooftop",
  "Industrial Solar EPC",
  "Grid-Scale Solar Infrastructure",
  "Government / PM Kusum",
  "O&M Services",
  "Energy Consulting",
  "Other",
];

const ALL_FIELDS: Field[] = ["name", "email", "phone", "interest", "message"];

// ── Per-field validation rules ────────────────────────────────────────────────

function validateField(field: Field, value: string, e: T["errors"]): string | undefined {
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
      if (!value.trim()) return undefined; // optional field
      const stripped = value.replace(/[\s\-\(\)\.]/g, "");
      const core = stripped.replace(/^(\+91|91|0)/, "");
      if (!/^\d{10}$/.test(core))
        return e.phoneInvalid;
      if (!/^[6-9]/.test(core))
        return e.phoneInvalid;
      // Reject all-same digits (e.g. 9999999999)
      if (/^(.)\1{9}$/.test(core))
        return e.phoneInvalid;
      return undefined;
    }
    case "interest": {
      if (!value) return e.interestRequired;
      return undefined;
    }
    case "message": {
      const v = value.trim();
      if (!v) return e.messageRequired;
      if (v.length < 20) return e.messageShort;
      return undefined;
    }
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────


// ── Main form ─────────────────────────────────────────────────────────────────

function ContactFormInner({ t }: { t: T }) {
  const [values, setValues] = useState<Record<Field, string>>({
    name: "", email: "", phone: "", interest: "", message: "",
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  // Honeypot: invisible to real users, bots fill it, submission silently rejected
  const [honeypot, setHoneypot] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Update value; re-validate immediately if the field has been touched before
  function set(field: Field, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (touched[field]) {
      const err = validateField(field, value, t.errors);
      setErrors((e) => ({ ...e, [field]: err }));
    }
  }

  // Validate field using the live DOM value (avoids stale React state on blur)
  function handleBlur(field: Field, currentValue: string) {
    setTouched((t) => ({ ...t, [field]: true }));
    const err = validateField(field, currentValue, t.errors);
    setErrors((e) => ({ ...e, [field]: err }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Silently reject if honeypot is filled (bot submission)
    if (honeypot) return;

    // Validate all fields and mark all as touched so errors surface
    const errs: Partial<Record<Field, string>> = {};
    for (const field of ALL_FIELDS) {
      const err = validateField(field, values[field], t.errors);
      if (err) errs[field] = err;
    }
    setTouched(Object.fromEntries(ALL_FIELDS.map((f) => [f, true])) as Record<Field, boolean>);
    if (Object.keys(errs).length) {
      setErrors(errs);
      // Wait a frame so aria-invalid is committed before focus moves.
      requestAnimationFrame(() => focusFirstInvalid(formRef.current, Object.keys(errs)));
      return;
    }

    setStatus("submitting");
    setSubmitError(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          phone: values.phone || undefined,
          interest: values.interest || undefined,
          message: values.message,
          website: honeypot,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setStatus("error");
        setSubmitError(
          data?.error || t.sendFailed
        );
        return;
      }

      setStatus("success");
      requestAnimationFrame(() => successRef.current?.focus());
    } catch {
      setStatus("error");
      setSubmitError(t.networkFailed);
    }
  }

  // Only show errors for fields the visitor has already interacted with
  const visible = (field: Field) => (touched[field] ? errors[field] : undefined);

  if (status === "success") {
    return (
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="bg-white rounded-2xl border border-[#e4e8ee] p-7 md:p-9 text-center"
      >
        <div className="mx-auto h-14 w-14 rounded-full bg-[#f7a800]/10 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-[#f7a800]" />
        </div>
        <h2 ref={successRef} tabIndex={-1} className="mt-6 font-display text-[#0e2a63] text-xl font-semibold outline-none">{t.successTitle}</h2>
        <p className="mt-3 text-[#111827]/65 leading-relaxed max-w-[42ch] mx-auto">
          {fmt(t.successBody, { name: values.name || t.successFallbackName })}
        </p>
      </m.div>
    );
  }

  return (
    <form
      ref={formRef}
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

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <FormFieldLabel id="name" label={t.name} error={visible("name")} />
          <input
            {...fieldA11y("name", visible("name"))}
            autoComplete="name"
            type="text"
            placeholder={t.namePlaceholder}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            onBlur={(e) => handleBlur("name", e.target.value)}
            className={fieldClass(!!visible("name"))}
          />
        </div>
        <div>
          <FormFieldLabel id="email" label={t.email} error={visible("email")} />
          <input
            {...fieldA11y("email", visible("email"))}
            autoComplete="email" spellCheck={false} autoCapitalize="none"
            type="email"
            placeholder="ravi@company.in"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            onBlur={(e) => handleBlur("email", e.target.value)}
            className={fieldClass(!!visible("email"))}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <FormFieldLabel id="phone" label={t.phone} error={visible("phone")} />
          <input
            {...fieldA11y("phone", visible("phone"))}
            autoComplete="tel" inputMode="tel"
            type="tel"
            placeholder="+91 98700 00000"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            onBlur={(e) => handleBlur("phone", e.target.value)}
            className={fieldClass(!!visible("phone"))}
          />
        </div>
        <div>
          <FormFieldLabel id="interest" label={t.interest} error={visible("interest")} />
          <select
            {...fieldA11y("interest", visible("interest"))}
            value={values.interest}
            onChange={(e) => set("interest", e.target.value)}
            onBlur={(e) => handleBlur("interest", e.target.value)}
            className={`${fieldClass(!!visible("interest"))} cursor-pointer appearance-none`}
          >
            <option value="">{t.interestPlaceholder}</option>
            {INTERESTS.map((i, idx) => (
              <option key={i} value={i}>{t.interests[idx]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <FormFieldLabel id="message" label={t.message} error={visible("message")} />
        <textarea
          {...fieldA11y("message", visible("message"))}
          rows={5}
          placeholder={t.messagePlaceholder}
          value={values.message}
          onChange={(e) => set("message", e.target.value)}
          onBlur={(e) => handleBlur("message", e.target.value)}
          className={`${fieldClass(!!visible("message"))} resize-none`}
        />
      </div>

      <AnimatePresence>
        {status === "error" && submitError && (
          <m.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-utility"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              {submitError} {t.alsoCall}{" "}
              <a href={HELPLINE_TEL} className="font-semibold underline">{HELPLINE_DISPLAY}</a>{" "}
              {t.orEmail}{" "}
              <a href="mailto:info@gridnova.in" className="font-semibold underline">info@gridnova.in</a>.
            </span>
          </m.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-4 pt-2">
        <p className="text-[#111827]/60 text-xs font-utility leading-snug max-w-[32ch]">
          {t.responseNote}
        </p>
        <m.button
          type="submit"
          disabled={status === "submitting"}
          whileTap={{ scale: 0.97 }}
          className="btn btn-primary shrink-0"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t.sending}
            </>
          ) : (
            <>
              {t.submit}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </m.button>
      </div>
    </form>
  );
}

// framer-motion is not in the site-wide layout any more (it only ships to the
// pages that animate with it), so this component brings its own LazyMotion.
export default function ContactForm(props: { t: T }) {
  return (
    <MotionProvider>
      <ContactFormInner {...props} />
    </MotionProvider>
  );
}
