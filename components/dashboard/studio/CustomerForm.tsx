'use client'

import { useState } from 'react'
import { Building2, Loader2, Plus, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/dashboard/utils'
import { studioError } from '@/lib/studio/logic'
import type { CustomerInput, CustomerType, DuplicateCustomer, StudioCustomer } from '@/lib/studio/types'
import { Notice, SelectInput, TextInput } from './ui'

// Add or edit a Studio customer. The server checks the mobile (10 digits) and the GSTIN
// (format and check digit); a customer with the same mobile or GSTIN is a warning only.

export function emptyCustomer(): CustomerInput {
  return { customer_type: 'individual', title: null, name: '', attention: null, mobile: '', email: null, address_lines: [''], gstin: null }
}

export function customerInput(c: StudioCustomer): CustomerInput {
  return {
    customer_type: c.customer_type,
    title: c.title,
    name: c.name,
    attention: c.attention,
    mobile: c.mobile,
    email: c.email,
    address_lines: c.address_lines.length ? c.address_lines : [''],
    gstin: c.gstin,
  }
}

/** What is sent: blank optional fields as null, empty address lines dropped. */
export function cleanCustomer(c: CustomerInput): CustomerInput {
  const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)
  return {
    customer_type: c.customer_type,
    title: blank(c.title),
    name: c.name.trim(),
    attention: c.customer_type === 'organisation' ? blank(c.attention) : null,
    mobile: c.mobile.trim(),
    email: blank(c.email),
    address_lines: c.address_lines.map((l) => l.trim()).filter(Boolean),
    gstin: blank(c.gstin)?.toUpperCase() ?? null,
  }
}

export function DuplicateWarning({ duplicates, onUse }: { duplicates: DuplicateCustomer[]; onUse?: (id: number) => void }) {
  if (!duplicates.length) return null
  return (
    <Notice tone="warn" testId="duplicate-warning">
      <p className="font-medium">This may be a customer you already have:</p>
      <ul className="mt-1 space-y-1">
        {duplicates.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2">
            <span>
              {d.name} · {d.mobile}
              {d.gstin ? ` · ${d.gstin}` : ''} — same {d.matched_on.join(' and ')}
            </span>
            {onUse && (
              <Button type="button" size="sm" variant="outline" onClick={() => onUse(d.id)}>
                Use this one instead
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Notice>
  )
}

export function CustomerForm({
  initial,
  titles,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: CustomerInput
  titles: string[]
  submitLabel: string
  /** Throws to keep the form open; the error is shown under the field it names. */
  onSubmit: (value: CustomerInput) => Promise<void>
  onCancel?: () => void
}) {
  const [c, setC] = useState<CustomerInput>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ field: string | null; message: string } | null>(null)
  const set = (patch: Partial<CustomerInput>) => setC((x) => ({ ...x, ...patch }))
  const org = c.customer_type === 'organisation'
  const err = (f: string) => (error?.field === f ? error.message : null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSubmit(cleanCustomer(c))
    } catch (x) {
      const info = studioError(x)
      setError({ field: info.field, message: info.message })
    } finally {
      setBusy(false)
    }
  }

  const typeButton = (t: CustomerType, label: string, Icon: React.ElementType, hint: string) => (
    <button
      type="button"
      onClick={() => set({ customer_type: t, title: t === 'organisation' ? 'M/s' : c.title === 'M/s' ? null : c.title })}
      aria-pressed={c.customer_type === t}
      className={cn(
        'flex min-h-14 flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#f7a800]',
        c.customer_type === t ? 'border-[#0e2a63] bg-[#0e2a63]/[0.05]' : 'border-[#e4e8ee] bg-white hover:border-[#2f5daa]/50',
      )}
    >
      <Icon className="h-5 w-5 shrink-0 text-[#0e2a63]" aria-hidden="true" />
      <span>
        <span className="block font-utility text-sm font-semibold text-[#091c3c]">{label}</span>
        <span className="block font-utility text-xs text-[#111827]/60">{hint}</span>
      </span>
    </button>
  )

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="customer-form" noValidate>
      <fieldset>
        <legend className="mb-2 font-utility text-sm font-medium text-[#091c3c]">Who is the customer?</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          {typeButton('individual', 'A person', User, 'A home owner or an individual')}
          {typeButton('organisation', 'A business or organisation', Building2, 'A company, society, school, office…')}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <SelectInput
          field="customer.title"
          label="Title"
          value={c.title}
          emptyLabel="None"
          options={titles.map((t) => ({ value: t, label: t }))}
          onChange={(v) => set({ title: v || null })}
          hint="Optional"
        />
        <TextInput
          field="customer.name"
          label={org ? 'Organisation name' : 'Full name'}
          required
          value={c.name}
          onChange={(v) => set({ name: v })}
          error={err('name') ?? err('customer.name')}
          hint={org ? 'As it should print, e.g. “Sunrise Apartments Welfare Society”' : 'As it should print on the proposal'}
          maxLength={200}
          autoComplete="name"
        />
      </div>
      {org && (
        <TextInput
          field="customer.attention"
          label="Contact person"
          value={c.attention}
          onChange={(v) => set({ attention: v })}
          hint="Printed as “Kind Attn.” — the person you are dealing with"
          maxLength={200}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          field="customer.mobile"
          label="Mobile number"
          required
          value={c.mobile}
          onChange={(v) => set({ mobile: v })}
          error={err('mobile') ?? err('customer.mobile')}
          inputMode="tel"
          hint="10 digits. The customer will need its last 4 digits to accept online."
          autoComplete="tel"
        />
        <TextInput
          field="customer.email"
          label="Email"
          type="email"
          value={c.email}
          onChange={(v) => set({ email: v })}
          error={err('email') ?? err('customer.email')}
          inputMode="email"
          hint="Optional — needed to email the proposal"
          autoComplete="email"
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="font-utility text-sm font-medium text-[#091c3c]">Address</legend>
        <p className="font-utility text-xs text-[#111827]/60">One line per box, as it should print. The last line usually has the district, state and PIN.</p>
        {c.address_lines.map((line, i) => (
          <input
            key={i}
            aria-label={`Address line ${i + 1}`}
            className="w-full min-h-11 rounded-lg border border-[#d5dbe4] bg-white px-3 py-2 text-[15px] font-utility outline-none focus-visible:ring-2 focus-visible:ring-[#f7a800]/60"
            value={line}
            onChange={(e) => set({ address_lines: c.address_lines.map((l, j) => (j === i ? e.target.value : l)) })}
            maxLength={120}
          />
        ))}
        {c.address_lines.length < 5 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => set({ address_lines: [...c.address_lines, ''] })}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add a line
          </Button>
        )}
        {err('address_lines') && <p className="font-utility text-xs text-red-700" role="alert">{err('address_lines')}</p>}
      </fieldset>
      {org && (
        <TextInput
          field="customer.gstin"
          label="GSTIN"
          value={c.gstin}
          onChange={(v) => set({ gstin: v.toUpperCase() })}
          error={err('gstin') ?? err('customer.gstin')}
          hint="Optional. 15 characters, e.g. 19ABCDE1234F1Z5 — we check it is a real GSTIN."
          maxLength={15}
        />
      )}
      {error && !error.field && <Notice tone="error">{error.message}</Notice>}
      {error?.field && !['name', 'mobile', 'email', 'gstin', 'address_lines', 'customer.name', 'customer.mobile', 'customer.email', 'customer.gstin'].includes(error.field) && (
        <Notice tone="error">{error.message}</Notice>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !c.name.trim() || !c.mobile.trim()} className="min-h-11">
          {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="min-h-11">
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
