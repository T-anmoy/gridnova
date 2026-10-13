import { AlertCircle } from "lucide-react";

// Shared building blocks for the public forms (contact, estimate, …).
// Every input is tied to its label (`id`/`htmlFor`), marks itself invalid with
// `aria-invalid`, and points at its error message with `aria-describedby`.
// The error text is a `role="alert"` so a screen reader announces it as soon
// as it appears.

/** Text-size is 16px (`text-base`) so iOS Safari does not zoom on focus. */
export const fieldClass = (hasError: boolean) =>
  `w-full rounded-xl border bg-white px-4 py-3.5 text-[#111827] text-base font-utility outline-none transition-[border-color,box-shadow] duration-200 focus-visible:ring-2 ${
    hasError
      ? "border-red-300 focus-visible:border-red-400 focus-visible:ring-red-200"
      : "border-[#e4e8ee] focus-visible:border-[#2f5daa] focus-visible:ring-[#2f5daa]/25"
  }`;

export const errorId = (id: string) => `${id}-error`;

/** The attributes every field needs for a11y; spread onto the input/select/textarea. */
export function fieldA11y(id: string, error?: string) {
  return {
    id,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? errorId(id) : undefined,
  };
}

export function FormFieldLabel({
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
    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3">
      <label htmlFor={id} className="font-utility text-xs uppercase tracking-[0.12em] text-[#111827]/70">
        {label}
        {optional && <span className="normal-case text-[#111827]/60"> {optional}</span>}
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

/**
 * Focus the first field (in DOM order) whose id is in `invalidIds`.
 * Call it after the errors have been committed so `aria-invalid` is already set.
 */
export function focusFirstInvalid(form: HTMLFormElement | null, invalidIds: string[]) {
  if (!form) return;
  const first = Array.from(form.querySelectorAll<HTMLElement>("input, select, textarea")).find((el) =>
    invalidIds.includes(el.id),
  );
  first?.focus();
}
