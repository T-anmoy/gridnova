"use client";

// Shared field primitives for the proposal wizard steps — extracted rather
// than duplicated per-step because this form has ~40 fields across 5 files.
// Visual output matches app/estimate/EstimateForm.tsx exactly: same
// FloatLabel, same inputClass, same toggle-pill pattern, same focus-scale
// micro-interaction.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";

export function FloatLabel({
  id,
  label,
  error,
  optional,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <label htmlFor={id} className="font-utility text-xs text-[#111827]/55 uppercase tracking-[0.12em]">
        {label}
        {optional ? (
          <span className="normal-case text-[#111827]/35"> (optional)</span>
        ) : (
          <span className="text-[#f7a800]"> *</span>
        )}
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

export const inputClass = (hasError: boolean) =>
  `w-full rounded-xl border bg-white px-4 py-3.5 text-[#111827] text-sm font-utility outline-none transition-all duration-200 focus:ring-2 ${
    hasError
      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
      : "border-[#e4e8ee] focus:border-[#2f5daa] focus:ring-[#2f5daa]/10"
  }`;

interface FieldBaseProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  optional?: boolean;
  placeholder?: string;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  optional,
  placeholder,
  type = "text",
  inputMode,
  disabled,
}: FieldBaseProps & { type?: string; inputMode?: "text" | "numeric" | "tel" | "email"; disabled?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <FloatLabel id={id} label={label} error={error} optional={optional} />
      <motion.input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        animate={{ scale: focused ? 1.005 : 1 }}
        transition={{ duration: 0.1 }}
        className={`${inputClass(!!error)} ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
      />
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  optional,
  placeholder,
  rows = 4,
}: FieldBaseProps & { rows?: number }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <FloatLabel id={id} label={label} error={error} optional={optional} />
      <motion.textarea
        id={id}
        name={id}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        animate={{ scale: focused ? 1.002 : 1 }}
        transition={{ duration: 0.1 }}
        className={`${inputClass(!!error)} resize-none`}
      />
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  optional,
  options,
  placeholder = "Select…",
}: FieldBaseProps & { options: string[] }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <FloatLabel id={id} label={label} error={error} optional={optional} />
      <motion.select
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        animate={{ scale: focused ? 1.005 : 1 }}
        transition={{ duration: 0.1 }}
        className={`${inputClass(!!error)} cursor-pointer appearance-none`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </motion.select>
    </div>
  );
}

export function ToggleGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
  note,
  optional,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
  disabled?: boolean;
  note?: string;
  optional?: boolean;
}) {
  return (
    <div>
      <p className="font-utility text-xs text-[#111827]/55 uppercase tracking-[0.12em] mb-2.5">
        {label}
        {!optional && <span className="text-[#f7a800]"> *</span>}
      </p>
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-1">
        {options.map(([val, lbl]) => (
          <button
            key={val}
            type="button"
            disabled={disabled}
            onClick={() => onChange(val)}
            className={`relative rounded-lg px-5 py-2.5 font-utility text-sm font-semibold transition-colors duration-200 ${
              value === val
                ? "bg-[#0e2a63] text-white"
                : "text-[#111827]/55 hover:text-[#0e2a63]"
            } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
          >
            {lbl}
          </button>
        ))}
      </div>
      {note && (
        <p className="mt-2.5 text-[#111827]/50 text-xs font-utility leading-relaxed max-w-[52ch]">
          {note}
        </p>
      )}
    </div>
  );
}

export function YesNoToggle({
  label,
  value,
  onChange,
  disabled,
  note,
  optional,
}: {
  label: string;
  value: "yes" | "no";
  onChange: (value: "yes" | "no") => void;
  disabled?: boolean;
  note?: string;
  optional?: boolean;
}) {
  return (
    <ToggleGroup
      label={label}
      value={value}
      onChange={onChange}
      disabled={disabled}
      optional={optional}
      note={note}
      options={[
        ["yes", "Yes"],
        ["no", "No"],
      ]}
    />
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[#0e2a63] text-xl font-semibold mb-1">
      {children}
    </h2>
  );
}
