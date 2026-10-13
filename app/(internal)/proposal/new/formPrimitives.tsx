"use client";

// Shared field primitives for the proposal wizard steps and the public solar
// calculator — extracted rather than duplicated per-step because this form has
// ~40 fields across 5 files. Labels, errors and ARIA wiring come from the shared
// public-form module (components/forms/FormField.tsx) so every form behaves
// the same for keyboard and screen-reader users.

import { useId } from "react";
import { fieldA11y, fieldClass, errorId } from "@/components/forms/FormField";
import { AlertCircle } from "lucide-react";

export function FloatLabel({
  id,
  label,
  error,
  optional,
  optionalLabel = "(optional)",
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  /** Override for the "(optional)" suffix — the public calculator localizes it. */
  optionalLabel?: string;
}) {
  return (
    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3">
      <label htmlFor={id} className="font-utility text-xs uppercase tracking-[0.12em] text-[#111827]/70">
        {label}
        {optional ? (
          <span className="normal-case text-[#111827]/60"> {optionalLabel}</span>
        ) : (
          <span className="text-[#8a5a00]" aria-hidden="true"> *</span>
        )}
      </label>
      {error && (
        <span id={errorId(id)} role="alert" className="flex items-center gap-1 font-utility text-xs text-red-700">
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

export const inputClass = fieldClass;

interface FieldBaseProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  optional?: boolean;
  placeholder?: string;
  optionalLabel?: string;
  autoComplete?: string;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  optional,
  optionalLabel,
  placeholder,
  type = "text",
  inputMode,
  autoComplete,
  disabled,
}: FieldBaseProps & { type?: string; inputMode?: "text" | "numeric" | "tel" | "email" | "decimal"; disabled?: boolean }) {
  const isEmail = type === "email";
  return (
    <div>
      <FloatLabel id={id} label={label} error={error} optional={optional} optionalLabel={optionalLabel} />
      <input
        {...fieldA11y(id, error)}
        name={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete ?? (type === "tel" ? "tel" : isEmail ? "email" : undefined)}
        spellCheck={isEmail ? false : undefined}
        autoCapitalize={isEmail ? "none" : undefined}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onBlur?.()}
        className={`${fieldClass(!!error)} ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
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
  return (
    <div>
      <FloatLabel id={id} label={label} error={error} optional={optional} />
      <textarea
        {...fieldA11y(id, error)}
        name={id}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onBlur?.()}
        className={`${fieldClass(!!error)} resize-none`}
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
  optionalLabel,
  options,
  labels,
  placeholder = "Select…",
  autoComplete,
}: FieldBaseProps & {
  options: string[];
  /** Display text per option value; the value itself is still what's submitted. */
  labels?: Record<string, string>;
}) {
  return (
    <div>
      <FloatLabel id={id} label={label} error={error} optional={optional} optionalLabel={optionalLabel} />
      <select
        {...fieldA11y(id, error)}
        name={id}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onBlur?.()}
        className={`${fieldClass(!!error)} cursor-pointer appearance-none`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </select>
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
  const groupId = useId();
  return (
    <div>
      <p id={groupId} className="font-utility text-xs text-[#111827]/70 uppercase tracking-[0.12em] mb-2.5">
        {label}
        {!optional && <span className="text-[#8a5a00]" aria-hidden="true"> *</span>}
      </p>
      <div role="group" aria-labelledby={groupId} className="inline-flex flex-wrap gap-1 rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-1">
        {options.map(([val, lbl]) => (
          <button
            key={val}
            type="button"
            disabled={disabled}
            onClick={() => onChange(val)}
            aria-pressed={value === val}
            className={`relative min-h-[44px] rounded-lg px-5 py-2.5 font-utility text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] ${
              value === val
                ? "bg-[#0e2a63] text-white"
                : "text-[#111827]/70 hover:text-[#0e2a63]"
            } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
          >
            {lbl}
          </button>
        ))}
      </div>
      {note && (
        <p className="mt-2.5 text-[#111827]/65 text-xs font-utility leading-relaxed max-w-[52ch]">
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
  yesLabel = "Yes",
  noLabel = "No",
}: {
  label: string;
  value: "yes" | "no";
  onChange: (value: "yes" | "no") => void;
  disabled?: boolean;
  note?: string;
  optional?: boolean;
  yesLabel?: string;
  noLabel?: string;
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
        ["yes", yesLabel],
        ["no", noLabel],
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
