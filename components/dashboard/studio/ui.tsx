'use client'

import { AlertCircle, CheckCircle2, Cloud, Loader2, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/dashboard/utils'
import { formatInr } from '@/lib/money'
import { statusLabel, statusTone, studioFieldId } from '@/lib/studio/logic'
import type { SaveState } from '@/lib/studio/use-autosave'

// Small building blocks shared by the Studio screens. Plain words, a hint under every field,
// an error that says what to do. Every control carries the DOM id of its backend field path,
// so a proof-check line or a server error can scroll to it.

export const INPUT =
  'w-full min-h-11 rounded-lg border border-[#d5dbe4] bg-white px-3 py-2 text-[15px] font-utility text-[#111827] outline-none transition-colors placeholder:text-[#111827]/40 focus-visible:border-[#2f5daa] focus-visible:ring-2 focus-visible:ring-[#f7a800]/60 disabled:cursor-not-allowed disabled:bg-[#f7f9fc] disabled:text-[#111827]/70 aria-[invalid=true]:border-red-500'

export function StatusChip({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={statusTone(status)} className={cn('whitespace-nowrap font-utility', className)} data-testid={`status-${status}`}>
      {statusLabel(status)}
    </Badge>
  )
}

export function Money({ value, className }: { value: string | null | undefined; className?: string }) {
  return <span className={cn('tabular-nums', className)}>{formatInr(value)}</span>
}

interface FieldProps {
  field: string
  label: string
  hint?: string
  error?: string | null
  required?: boolean
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => React.ReactNode
  className?: string
}

/** A label, the control (render prop gets id + aria wiring), the hint and the error. */
export function Field({ field, label, hint, error, required, children, className }: FieldProps) {
  const id = studioFieldId(field)
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('min-w-0', className)} data-field={field}>
      <label htmlFor={id} className="mb-1 block font-utility text-sm font-medium text-[#091c3c]">
        {label}
        {required && <span className="ml-1 text-[#8a5a00]" aria-hidden="true">*</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 font-utility text-xs text-[#111827]/60">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 flex items-start gap-1 font-utility text-xs text-red-700">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

export function TextInput({
  field,
  label,
  hint,
  error,
  value,
  onChange,
  disabled,
  required,
  inputMode,
  maxLength,
  placeholder,
  type = 'text',
  className,
  autoComplete,
}: {
  field: string
  label: string
  hint?: string
  error?: string | null
  value: string | number | null | undefined
  onChange: (v: string) => void
  disabled?: boolean
  required?: boolean
  inputMode?: 'numeric' | 'decimal' | 'tel' | 'text' | 'email'
  maxLength?: number
  placeholder?: string
  type?: 'text' | 'email'
  className?: string
  autoComplete?: string
}) {
  return (
    <Field field={field} label={label} hint={hint} error={error} required={required} className={className}>
      {(p) => (
        <input
          {...p}
          type={type}
          className={INPUT}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          inputMode={inputMode}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete={autoComplete ?? 'off'}
        />
      )}
    </Field>
  )
}

export function TextArea({
  field,
  label,
  hint,
  error,
  value,
  onChange,
  disabled,
  rows = 3,
  maxLength,
  placeholder,
}: {
  field: string
  label: string
  hint?: string
  error?: string | null
  value: string | null | undefined
  onChange: (v: string) => void
  disabled?: boolean
  rows?: number
  maxLength?: number
  placeholder?: string
}) {
  return (
    <Field field={field} label={label} hint={hint} error={error}>
      {(p) => (
        <textarea
          {...p}
          className={cn(INPUT, 'min-h-[5.5rem]')}
          rows={rows}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          maxLength={maxLength}
          placeholder={placeholder}
        />
      )}
    </Field>
  )
}

export function SelectInput({
  field,
  label,
  hint,
  error,
  value,
  options,
  onChange,
  disabled,
  emptyLabel,
  required,
}: {
  field: string
  label: string
  hint?: string
  error?: string | null
  value: string | null | undefined
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  disabled?: boolean
  emptyLabel?: string
  required?: boolean
}) {
  return (
    <Field field={field} label={label} hint={hint} error={error} required={required}>
      {(p) => (
        <select {...p} className={INPUT} value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

/** A yes/no as a large checkbox row with its explanation. */
export function Toggle({
  field,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  field: string
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  const id = studioFieldId(field)
  return (
    <label
      htmlFor={id}
      data-field={field}
      className={cn(
        'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-[#e4e8ee] bg-white px-3 py-2.5 transition-colors hover:border-[#2f5daa]/50',
        checked && 'border-[#2f5daa]/60 bg-[#2f5daa]/[0.04]',
        disabled && 'cursor-not-allowed opacity-70',
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 accent-[#0e2a63]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      <span className="min-w-0">
        <span className="block font-utility text-sm font-medium text-[#091c3c]">{label}</span>
        {hint && (
          <span id={`${id}-hint`} className="mt-0.5 block font-utility text-xs text-[#111827]/60">
            {hint}
          </span>
        )}
      </span>
    </label>
  )
}

/** The calm autosave line: "Saving…", "Saved", "Not saved — …", "Reloaded". */
export function SaveIndicator({ state, className }: { state: SaveState; className?: string }) {
  const map: Record<SaveState, { icon: React.ReactNode; text: string; tone: string } | null> = {
    idle: { icon: <Cloud className="h-3.5 w-3.5" aria-hidden="true" />, text: 'Changes save automatically', tone: 'text-[#111827]/55' },
    saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />, text: 'Saving…', tone: 'text-[#111827]/65' },
    saved: { icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />, text: 'Saved', tone: 'text-green-700' },
    error: { icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />, text: 'Not saved — see the highlighted field', tone: 'text-red-700' },
    reloaded: { icon: <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />, text: 'Reloaded the latest version', tone: 'text-amber-800' },
  }
  const m = map[state]
  if (!m) return null
  return (
    <p role="status" aria-live="polite" data-testid="save-indicator" data-state={state} className={cn('inline-flex items-center gap-1.5 font-utility text-xs', m.tone, className)}>
      {m.icon}
      {m.text}
    </p>
  )
}

export function Panel({ title, description, actions, children, className, id }: { title?: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn('rounded-xl border border-[#e4e8ee] bg-white p-4 md:p-6', className)}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="font-display text-lg font-semibold text-[#091c3c]">{title}</h2>}
            {description && <p className="mt-0.5 font-utility text-sm text-[#111827]/65">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Notice({ tone = 'info', children, className, testId }: { tone?: 'info' | 'warn' | 'error' | 'ok'; children: React.ReactNode; className?: string; testId?: string }) {
  const tones = {
    info: 'border-[#2f5daa]/25 bg-[#2f5daa]/[0.05] text-[#0e2a63]',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-800',
    ok: 'border-green-200 bg-green-50 text-green-800',
  }
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} data-testid={testId} className={cn('rounded-lg border p-3 font-utility text-sm', tones[tone], className)}>
      {children}
    </div>
  )
}

/** Scrolls to and focuses the control for a backend field path (after a step change). */
export function focusStudioField(field: string): void {
  const tryFocus = (attempt: number) => {
    const el = document.getElementById(studioFieldId(field)) ?? document.querySelector<HTMLElement>(`[data-field="${field.replace(/\[\d+\].*$/, '')}"]`)
    if (!el) {
      if (attempt < 10) setTimeout(() => tryFocus(attempt + 1), 60)
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const target = el.matches('input,select,textarea,button') ? el : el.querySelector<HTMLElement>('input,select,textarea,button')
    target?.focus({ preventScroll: true })
  }
  tryFocus(0)
}
