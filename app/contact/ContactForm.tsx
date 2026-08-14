"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, AlertCircle } from "lucide-react";

type Field = "name" | "email" | "phone" | "interest" | "message";

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

function validateField(field: Field, value: string): string | undefined {
  switch (field) {
    case "name": {
      const v = value.trim();
      if (!v) return "Name is required";
      if (v.length < 2) return "Name must be at least 2 characters";
      if (!/[a-zA-Z]/.test(v)) return "Enter a valid name";
      return undefined;
    }
    case "email": {
      const v = value.trim();
      if (!v) return "Email is required";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))
        return "Enter a valid email address";
      return undefined;
    }
    case "phone": {
      if (!value.trim()) return undefined; // optional field
      const stripped = value.replace(/[\s\-\(\)\.]/g, "");
      const core = stripped.replace(/^(\+91|91|0)/, "");
      if (!/^\d{10}$/.test(core))
        return "Enter a valid 10-digit mobile number";
      if (!/^[6-9]/.test(core))
        return "Enter a valid 10-digit mobile number";
      // Reject all-same digits (e.g. 9999999999)
      if (/^(.)\1{9}$/.test(core))
        return "Enter a valid 10-digit mobile number";
      return undefined;
    }
    case "interest": {
      if (!value) return "Please select a service";
      return undefined;
    }
    case "message": {
      const v = value.trim();
      if (!v) return "Message is required";
      if (v.length < 20) return "Please write at least 20 characters";
      return undefined;
    }
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FloatLabel({ id, label, error }: { id: string; label: string; error?: string }) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <label htmlFor={id} className="font-utility text-xs text-[#111827]/55 uppercase tracking-[0.12em]">
        {label}
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

export default function ContactForm() {
  const [values, setValues] = useState<Record<Field, string>>({
    name: "", email: "", phone: "", interest: "", message: "",
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [focused, setFocused] = useState<Field | null>(null);
  // Honeypot: invisible to real users, bots fill it, submission silently rejected
  const [honeypot, setHoneypot] = useState("");

  // Update value; re-validate immediately if the field has been touched before
  function set(field: Field, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (touched[field]) {
      const err = validateField(field, value);
      setErrors((e) => ({ ...e, [field]: err }));
    }
  }

  // Validate field using the live DOM value (avoids stale React state on blur)
  function handleBlur(field: Field, currentValue: string) {
    setFocused(null);
    setTouched((t) => ({ ...t, [field]: true }));
    const err = validateField(field, currentValue);
    setErrors((e) => ({ ...e, [field]: err }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Silently reject if honeypot is filled (bot submission)
    if (honeypot) return;

    // Validate all fields and mark all as touched so errors surface
    const errs: Partial<Record<Field, string>> = {};
    for (const field of ALL_FIELDS) {
      const err = validateField(field, values[field]);
      if (err) errs[field] = err;
    }
    setTouched(Object.fromEntries(ALL_FIELDS.map((f) => [f, true])) as Record<Field, boolean>);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    // Transparent mailto: fallback — opens user's email client with pre-filled message.
    // NOTE: True lead-quality control (rate limiting, server-side validation, spam filtering)
    // requires wiring this form to a real backend API route (e.g. via Resend, SendGrid, or
    // a Next.js /api/contact handler) rather than the client-side mailto: handoff here.
    const subject = `Solar Enquiry from ${values.name}${values.interest ? ` — ${values.interest}` : ""}`;
    const body = [
      `Name: ${values.name}`,
      `Email: ${values.email}`,
      values.phone ? `Phone: ${values.phone}` : null,
      values.interest ? `Interest: ${values.interest}` : null,
      "",
      `Message:\n${values.message}`,
    ]
      .filter(Boolean)
      .join("\n");

    window.location.href = `mailto:info@gridnova.in?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  // Only show errors for fields the visitor has already interacted with
  const visible = (field: Field) => (touched[field] ? errors[field] : undefined);

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

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <FloatLabel id="name" label="Your Name" error={visible("name")} />
          <motion.input
            id="name"
            type="text"
            placeholder="Ravi Sharma"
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
          <FloatLabel id="email" label="Email Address" error={visible("email")} />
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
          <FloatLabel id="phone" label="Phone (optional)" error={visible("phone")} />
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
          <FloatLabel id="interest" label="What are you looking for?" error={visible("interest")} />
          <motion.select
            id="interest"
            value={values.interest}
            onChange={(e) => set("interest", e.target.value)}
            onFocus={() => setFocused("interest")}
            onBlur={(e) => handleBlur("interest", e.target.value)}
            animate={{ scale: focused === "interest" ? 1.005 : 1 }}
            transition={{ duration: 0.1 }}
            className={`${inputClass(!!visible("interest"))} cursor-pointer appearance-none`}
          >
            <option value="">Select a service…</option>
            {INTERESTS.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </motion.select>
        </div>
      </div>

      <div>
        <FloatLabel id="message" label="Your Message" error={visible("message")} />
        <motion.textarea
          id="message"
          rows={5}
          placeholder="Describe your site, capacity requirement, or question…"
          value={values.message}
          onChange={(e) => set("message", e.target.value)}
          onFocus={() => setFocused("message")}
          onBlur={(e) => handleBlur("message", e.target.value)}
          animate={{ scale: focused === "message" ? 1.002 : 1 }}
          transition={{ duration: 0.1 }}
          className={`${inputClass(!!visible("message"))} resize-none`}
        />
      </div>

      <div className="flex items-center justify-between gap-4 pt-2">
        <p className="text-[#111827]/40 text-xs font-utility leading-snug max-w-[32ch]">
          Submitting opens your email client — no data is sent without your
          review.
        </p>
        <motion.button
          type="submit"
          whileTap={{ scale: 0.97 }}
          className="shrink-0 inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#2f5daa] transition-colors duration-300"
        >
          Send Message
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      </div>
    </form>
  );
}
