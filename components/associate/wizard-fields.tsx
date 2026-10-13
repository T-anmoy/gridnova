'use client'

import { useId } from 'react'
import { AlertCircle } from 'lucide-react'

// Form primitives for the associate wizard and survey steps. Every input:
// - is tied to its label (useId → id / htmlFor), with aria-invalid and
//   aria-describedby pointing at its hint and error;
// - is 16px (text-base) so iOS does not zoom on focus, and ≥ 44px tall;
// - keeps a visible focus ring (never outline-none without a replacement).

export const inputClass = (invalid = false) =>
  `block w-full min-h-[44px] rounded-xl border bg-white px-4 py-2.5 text-base text-[#111827] font-utility transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2f5daa] ${
    invalid ? 'border-red-400' : 'border-[#e4e8ee] focus:border-[#2f5daa]'
  }`

export const labelClass = 'font-utility text-xs text-[#111827]/60 uppercase tracking-[0.08em] mb-1.5 block'

export interface ControlProps {
  id: string
  'aria-invalid'?: true
  'aria-describedby'?: string
  'aria-required'?: true
}

export function FormField({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string
  hint?: string
  error?: string
  /** Marks the control `aria-required`; the label carries no extra glyph. */
  required?: boolean
  children: (control: ControlProps) => React.ReactNode
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children({
        id,
        ...(error ? { 'aria-invalid': true as const } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        ...(required ? { 'aria-required': true as const } : {}),
      })}
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-[#111827]/65 leading-relaxed font-utility">
          {hint}
        </p>
      )}
      {error && <FieldError id={errorId} message={error} />}
    </div>
  )
}

export function FieldError({ id, message }: { id?: string; message: string }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600 font-utility">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

/** A labelled <select> whose options are `[value, label]` pairs, with a blank first option. */
export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  hint,
  required,
  name,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly (readonly [string, string])[]
  placeholder: string
  error?: string
  hint?: string
  required?: boolean
  name?: string
}) {
  return (
    <FormField label={label} error={error} hint={hint} required={required}>
      {(p) => (
        <select {...p} name={name} className={inputClass(!!error)} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{placeholder}</option>
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      )}
    </FormField>
  )
}

/** Yes / No as a select: compact on phones and fully keyboard and screen-reader friendly. */
export function YesNoField({
  label,
  value,
  onChange,
  yes,
  no,
  placeholder,
  error,
  hint,
  required,
  name,
}: {
  label: string
  value: '' | 'yes' | 'no'
  onChange: (v: '' | 'yes' | 'no') => void
  yes: string
  no: string
  placeholder: string
  error?: string
  hint?: string
  required?: boolean
  name?: string
}) {
  return (
    <SelectField
      label={label}
      value={value}
      onChange={(v) => onChange(v as '' | 'yes' | 'no')}
      options={[
        ['yes', yes],
        ['no', no],
      ]}
      placeholder={placeholder}
      error={error}
      hint={hint}
      required={required}
      name={name}
    />
  )
}

/** A number typed on a phone: decimal keypad, never a spinner, kept as the string the person typed. */
export function NumberField({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  integer,
  name,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  hint?: string
  required?: boolean
  integer?: boolean
  name?: string
}) {
  return (
    <FormField label={label} error={error} hint={hint} required={required}>
      {(p) => (
        <input
          {...p}
          name={name}
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          autoComplete="off"
          className={inputClass(!!error)}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(',', '.'))}
        />
      )}
    </FormField>
  )
}
