'use client'

import { Calculator, Lock, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ALLOWED_TOKENS, fieldAnchorId, tokensIn, type FieldErrors } from '@/lib/proposals/document-logic'

// Small building blocks for the proposal document form. Every control carries
// the anchor id of its backend field path so a `missing_required` link or a
// 422 `field` can scroll to and focus it.

export const CONTROL =
  'w-full rounded-lg border border-[#e4e8ee] bg-white px-3 py-2 text-sm font-utility text-[#111827] outline-none focus-visible:ring-2 focus-visible:ring-[#f7a800] disabled:cursor-not-allowed disabled:bg-[#f7f9fc] disabled:text-[#111827]/70'

export function FieldError({ field, errors }: { field: string; errors: FieldErrors }) {
  const msg = errors[field]
  if (!msg) return null
  return (
    <p id={`${fieldAnchorId(field)}-error`} role="alert" className="mt-1 font-utility text-xs text-red-700">
      {msg}
    </p>
  )
}

/** The `{tokens}` in a text, shown as chips with what they mean. */
export function TokenChips({ text }: { text: string | null | undefined }) {
  const tokens = [...new Set(tokensIn(text ?? ''))].filter((t) => (ALLOWED_TOKENS as readonly string[]).includes(t))
  if (!tokens.length) return null
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1 font-utility text-[11px] text-[#111827]/65" data-testid="token-chips">
      {tokens.map((t) => (
        <span key={t} className="rounded-full border border-[#2f5daa]/30 bg-[#2f5daa]/5 px-2 py-0.5 font-mono text-[#0e2a63]">
          {`{${t}}`}
        </span>
      ))}
      <span>filled in automatically from the plant when the PDF is made.</span>
    </p>
  )
}

interface TextFieldProps {
  field: string
  label: string
  value: string | null | undefined
  onChange: (v: string) => void
  editable: boolean
  errors: FieldErrors
  hint?: string
  multiline?: boolean
  inputMode?: 'numeric' | 'decimal' | 'tel' | 'text'
  maxLength?: number
  tokens?: boolean
  placeholder?: string
}

export function TextField({ field, label, value, onChange, editable, errors, hint, multiline, inputMode, maxLength, tokens, placeholder }: TextFieldProps) {
  const id = fieldAnchorId(field)
  const describedBy = [errors[field] ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined
  const common = {
    id,
    value: value ?? '',
    disabled: !editable,
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': describedBy,
    maxLength,
    placeholder,
  }
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-utility text-xs font-medium text-[#111827]/75">
        {label}
      </label>
      {multiline ? (
        <Textarea {...common} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input {...common} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 font-utility text-[11px] text-[#111827]/60">
          {hint}
        </p>
      )}
      {tokens && <TokenChips text={value} />}
      <FieldError field={field} errors={errors} />
    </div>
  )
}

interface SelectFieldProps<T extends string> {
  field: string
  label: string
  value: T | null | undefined
  options: { value: T; label: string }[]
  onChange: (v: T | null) => void
  editable: boolean
  errors: FieldErrors
  /** Offer an empty choice (null). */
  emptyLabel?: string
  hint?: string
}

export function SelectField<T extends string>({ field, label, value, options, onChange, editable, errors, emptyLabel, hint }: SelectFieldProps<T>) {
  const id = fieldAnchorId(field)
  // A stored value the list does not know is still shown, never silently dropped.
  const all = value && !options.some((o) => o.value === value) ? [...options, { value, label: value }] : options
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-utility text-xs font-medium text-[#111827]/75">
        {label}
      </label>
      <select
        id={id}
        className={CONTROL}
        value={value ?? ''}
        disabled={!editable}
        aria-invalid={errors[field] ? true : undefined}
        onChange={(e) => onChange(e.target.value === '' ? null : (e.target.value as T))}
      >
        {emptyLabel != null && <option value="">{emptyLabel}</option>}
        {all.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 font-utility text-[11px] text-[#111827]/60">{hint}</p>}
      <FieldError field={field} errors={errors} />
    </div>
  )
}

export function CheckField({ field, label, checked, onChange, editable, hint }: { field: string; label: string; checked: boolean; onChange: (v: boolean) => void; editable: boolean; hint?: string }) {
  const id = fieldAnchorId(field)
  return (
    <div>
      <label htmlFor={id} className="flex min-h-11 items-center gap-2 font-utility text-sm text-[#111827]">
        <input id={id} type="checkbox" className="h-4 w-4 accent-[#0e2a63]" checked={checked} disabled={!editable} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {hint && <p className="font-utility text-[11px] text-[#111827]/60">{hint}</p>}
    </div>
  )
}

/** Address lines and similar: 0–N short strings, add/remove. */
export function LinesField({ field, label, lines, onChange, editable, errors, max }: { field: string; label: string; lines: string[]; onChange: (v: string[]) => void; editable: boolean; errors: FieldErrors; max: number }) {
  const id = fieldAnchorId(field)
  return (
    <fieldset id={id} tabIndex={-1} aria-describedby={errors[field] ? `${id}-error` : undefined} className="outline-none">
      <legend className="mb-1 font-utility text-xs font-medium text-[#111827]/75">{label}</legend>
      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2">
            <Input
              id={fieldAnchorId(`${field}[${i}]`)}
              aria-label={`${label} line ${i + 1}`}
              value={line}
              disabled={!editable}
              onChange={(e) => onChange(lines.map((l, j) => (j === i ? e.target.value : l)))}
            />
            {editable && (
              <Button type="button" variant="ghost" size="sm" className="min-h-11 shrink-0" aria-label={`Remove ${label.toLowerCase()} line ${i + 1}`} onClick={() => onChange(lines.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        {lines.length === 0 && !editable && <p className="font-utility text-sm text-[#111827]/60">—</p>}
        {lines.map((_, i) => (
          <FieldError key={i} field={`${field}[${i}]`} errors={errors} />
        ))}
        {editable && lines.length < max && (
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => onChange([...lines, ''])}>
            <Plus className="mr-1 h-4 w-4" /> Add line
          </Button>
        )}
      </div>
      <FieldError field={field} errors={errors} />
    </fieldset>
  )
}

/** A figure the backend calculates — never typed. */
export function ComputedValue({ label, value, hint = 'calculated', field }: { label: string; value: React.ReactNode; hint?: string; field?: string }) {
  return (
    <div id={field ? fieldAnchorId(field) : undefined} tabIndex={field ? -1 : undefined} className="rounded-lg bg-[#f4f6fa] px-3 py-2 outline-none" data-state="computed">
      <p className="flex items-center gap-1 font-utility text-[11px] text-[#111827]/60">
        <Calculator className="h-3 w-3" aria-hidden="true" /> {label} <span className="italic">· {hint}</span>
      </p>
      <p className="font-utility text-sm font-medium text-[#111827]">{value}</p>
    </div>
  )
}

export const FIXED_HINT = 'Same on every proposal — changed only by Admin in settings'

/** A part of the PDF that is the same on every proposal. */
export function FixedValue({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-[#e4e8ee] px-3 py-2" data-state="fixed">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#111827]/50" aria-hidden="true" />
      <div>
        <p className="font-utility text-sm text-[#111827]">{label}</p>
        {value && <p className="font-utility text-sm font-medium text-[#091c3c]">{value}</p>}
        <p className="font-utility text-[11px] text-[#111827]/55">{FIXED_HINT}</p>
      </div>
    </div>
  )
}
