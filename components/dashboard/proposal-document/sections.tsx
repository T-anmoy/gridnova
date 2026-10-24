'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { fieldAnchorId, paymentTotal, type FieldErrors } from '@/lib/proposals/document-logic'
import type { Addressee, Connection, PaymentFigure, PaymentTerm, Plant, PmSuryaGhar, Site, SystemSpec } from '@/lib/proposals/document-types'
import { formatInr } from '@/lib/money'
import { CheckField, ComputedValue, FieldError, LinesField, SelectField, TextField, TokenChips } from './fields'

// One form per editable section. Each receives the section's whole draft value
// and returns a whole new value: PATCH …/document replaces one section at a time.

interface SectionProps<T> {
  value: T
  onChange: (v: T) => void
  editable: boolean
  errors: FieldErrors
}

// Enumerations from docs/api/proposal_document.md (Document fields).
const TITLES = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'M/s'] as const
const CATEGORIES = ['Residential', 'Commercial', 'Industrial', 'Government', 'Agricultural'] as const
const MODULE_TECHNOLOGIES = ['Mono PERC', 'TOPCon'] as const

export function AddresseeForm({ value, onChange, editable, errors }: SectionProps<Addressee>) {
  const set = (p: Partial<Addressee>) => onChange({ ...value, ...p })
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          field="addressee.customer_type"
          label="Customer type"
          value={value.customer_type ?? null}
          options={[{ value: 'individual', label: 'Individual' }, { value: 'organisation', label: 'Organisation' }]}
          onChange={(v) => set({ customer_type: v ?? 'individual' })}
          editable={editable}
          errors={errors}
        />
        <SelectField
          field="addressee.title"
          label="Title"
          value={value.title ?? null}
          options={TITLES.map((t) => ({ value: t, label: t }))}
          emptyLabel="No title"
          onChange={(v) => set({ title: v })}
          editable={editable}
          errors={errors}
          hint="Never guessed from a name."
        />
      </div>
      <TextField field="addressee.name" label="Name" value={value.name} onChange={(v) => set({ name: v })} editable={editable} errors={errors} maxLength={120} />
      {value.customer_type === 'organisation' && (
        <TextField field="addressee.attention" label="Kind attention (contact person)" value={value.attention} onChange={(v) => set({ attention: v })} editable={editable} errors={errors} maxLength={120} />
      )}
      <LinesField field="addressee.address_lines" label="Address" lines={value.address_lines ?? []} onChange={(v) => set({ address_lines: v })} editable={editable} errors={errors} max={5} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField field="addressee.mobile" label="Mobile" value={value.mobile} onChange={(v) => set({ mobile: v.replace(/\D/g, '') })} editable={editable} errors={errors} inputMode="tel" maxLength={10} hint="10 digits." />
        <TextField
          field="addressee.aadhaar_last4"
          label="Aadhaar — last 4 digits (optional)"
          value={value.aadhaar_last4}
          onChange={(v) => set({ aadhaar_last4: v.replace(/\D/g, '') })}
          editable={editable}
          errors={errors}
          inputMode="numeric"
          maxLength={4}
          hint="Only the last 4 digits — printed as XXXX XXXX 1234. Leave empty to leave the row off."
        />
      </div>
      <TextField field="addressee.salutation" label="Salutation" value={value.salutation} onChange={(v) => set({ salutation: v })} editable={editable} errors={errors} hint="The greeting line of the letter." />
    </>
  )
}

export function ConnectionForm({ value, onChange, editable, errors }: SectionProps<Connection>) {
  const set = (p: Partial<Connection>) => onChange({ ...value, ...p })
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField field="connection.discom" label="DISCOM" value={value.discom} onChange={(v) => set({ discom: v })} editable={editable} errors={errors} maxLength={60} />
      <TextField field="connection.consumer_number" label="Consumer number" value={value.consumer_number} onChange={(v) => set({ consumer_number: v })} editable={editable} errors={errors} maxLength={40} />
      <TextField field="connection.sub_division" label="Sub-division" value={value.sub_division} onChange={(v) => set({ sub_division: v })} editable={editable} errors={errors} maxLength={80} />
      <TextField field="connection.sanctioned_load_kw" label="Sanctioned load (kW)" value={value.sanctioned_load_kw} onChange={(v) => set({ sanctioned_load_kw: v })} editable={editable} errors={errors} inputMode="decimal" />
      <SelectField
        field="connection.category"
        label="Category"
        value={value.category ?? null}
        options={CATEGORIES.map((c) => ({ value: c, label: c }))}
        emptyLabel="Not set"
        onChange={(v) => set({ category: v })}
        editable={editable}
        errors={errors}
      />
      <SelectField
        field="connection.phase"
        label="Phase"
        value={value.phase ?? null}
        options={[{ value: 'single', label: 'Single phase' }, { value: 'three', label: 'Three phase' }]}
        emptyLabel="Not set"
        onChange={(v) => set({ phase: v })}
        editable={editable}
        errors={errors}
        hint="Changing the phase can change the price."
      />
    </div>
  )
}

export function SiteForm({ value, onChange, editable, errors }: SectionProps<Site>) {
  const set = (p: Partial<Site>) => onChange({ ...value, ...p })
  return (
    <>
      <LinesField field="site.address_lines" label="Site address" lines={value.address_lines ?? []} onChange={(v) => set({ address_lines: v })} editable={editable} errors={errors} max={5} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField field="site.town" label="Town" value={value.town} onChange={(v) => set({ town: v })} editable={editable} errors={errors} maxLength={80} hint="The town itself, not only the district." />
        <TextField field="site.state" label="State" value={value.state} onChange={(v) => set({ state: v })} editable={editable} errors={errors} maxLength={60} hint="Printed as Destination “Within <state>”." />
      </div>
    </>
  )
}

export function PmSuryaGharForm({ value, onChange, editable, errors }: SectionProps<PmSuryaGhar>) {
  const set = (p: Partial<PmSuryaGhar>) => onChange({ ...value, ...p })
  return (
    <>
      <CheckField field="pm_surya_ghar.subsidy_opted" label="Customer opted for the PM Surya Ghar subsidy" checked={!!value.subsidy_opted} onChange={(v) => set({ subsidy_opted: v })} editable={editable} hint="Changing this can change the price." />
      <CheckField field="pm_surya_ghar.portal_registered" label="Registered on the PM Surya Ghar portal" checked={!!value.portal_registered} onChange={(v) => set({ portal_registered: v })} editable={editable} />
      {value.portal_registered && (
        <TextField
          field="pm_surya_ghar.approved_capacity_kwp"
          label="Approved capacity on the portal (kWp)"
          value={value.approved_capacity_kwp}
          onChange={(v) => set({ approved_capacity_kwp: v })}
          editable={editable}
          errors={errors}
          inputMode="decimal"
          hint="Needed before approval once the portal registration is ticked."
        />
      )}
    </>
  )
}

const MOUNT_LABEL: Record<string, string> = { rooftop: 'Rooftop', ground_mounted: 'Ground mounted' }

export function PlantForm({ value, onChange, editable, errors, mountType, technical }: SectionProps<Plant> & { mountType?: string | null; technical?: boolean }) {
  const set = (p: Partial<Plant>) => onChange({ ...value, ...p })
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        field="plant.capacity_kwp"
        label="Plant capacity (kWp)"
        value={value.capacity_kwp}
        onChange={(v) => set({ capacity_kwp: v })}
        editable={editable}
        errors={errors}
        inputMode="decimal"
        hint="Can change the price, and the layout when it crosses the compact limit."
      />
      {!technical && (
        <SelectField
          field="plant.package"
          label="Package"
          value={value.package ?? null}
          options={[{ value: 'NOVA_ASSURED', label: 'NOVA_ASSURED' }, { value: 'NOVA_SIGNATURE', label: 'NOVA_SIGNATURE' }]}
          emptyLabel="No package"
          onChange={(v) => set({ package: v })}
          editable={editable}
          errors={errors}
          hint="Changing the package can change the price."
        />
      )}
      <CheckField field="plant.dcr" label="DCR (domestic content) modules" checked={!!value.dcr} onChange={(v) => set({ dcr: v })} editable={editable} />
      {mountType != null && <ComputedValue field="plant.mount_type" label="Mounting type" value={MOUNT_LABEL[mountType] ?? mountType} hint="from the lead" />}
    </div>
  )
}

export function SystemForm({ value, onChange, editable, errors }: SectionProps<SystemSpec>) {
  const set = (p: Partial<SystemSpec>) => onChange({ ...value, ...p })
  return (
    <>
      <SelectField
        field="system.module_technology"
        label="Module technology"
        value={value.module_technology ?? null}
        options={MODULE_TECHNOLOGIES.map((t) => ({ value: t, label: t }))}
        onChange={(v) => set({ module_technology: v ?? MODULE_TECHNOLOGIES[0] })}
        editable={editable}
        errors={errors}
      />
      <TextField field="system.inverter" label="Inverter" value={value.inverter} onChange={(v) => set({ inverter: v })} editable={editable} errors={errors} maxLength={160} tokens hint="Leave empty to print the layout’s standard inverter line." />
      <TextField field="system.mounting" label="Mounting structure" value={value.mounting} onChange={(v) => set({ mounting: v })} editable={editable} errors={errors} maxLength={160} tokens hint="Leave empty to print the standard mounting line." />
    </>
  )
}

/** Customer scope and notes: a list of bullets. */
export function BulletsForm({ section, value, onChange, editable, errors, max, addLabel, itemLabel }: SectionProps<string[]> & { section: 'customer_scope' | 'notes'; max: number; addLabel: string; itemLabel: string }) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...value]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }
  return (
    <div id={fieldAnchorId(section)} tabIndex={-1} className="space-y-2 outline-none">
      {value.length === 0 && <p className="font-utility text-sm text-[#111827]/60">None.</p>}
      <ol className="space-y-2">
        {value.map((item, i) => (
          <li key={i} className="rounded-lg border border-[#e4e8ee] p-2">
            <div className="flex gap-2">
              <span className="pt-2 font-utility text-xs text-[#111827]/50" aria-hidden="true">
                {i + 1}.
              </span>
              <Textarea
                id={fieldAnchorId(`${section}[${i}]`)}
                aria-label={`${itemLabel} ${i + 1}`}
                value={item}
                rows={2}
                maxLength={400}
                disabled={!editable}
                onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
              />
            </div>
            <TokenChips text={item} />
            <FieldError field={`${section}[${i}]`} errors={errors} />
            {editable && (
              <div className="mt-1 flex justify-end gap-1">
                <Button type="button" variant="ghost" size="sm" className="min-h-11" disabled={i === 0} aria-label={`Move ${itemLabel.toLowerCase()} ${i + 1} up`} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="min-h-11" disabled={i === value.length - 1} aria-label={`Move ${itemLabel.toLowerCase()} ${i + 1} down`} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="min-h-11" aria-label={`Remove ${itemLabel.toLowerCase()} ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {editable && value.length < max && (
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => onChange([...value, ''])}>
          <Plus className="mr-1 h-4 w-4" /> {addLabel}
        </Button>
      )}
      <FieldError field={section} errors={errors} />
    </div>
  )
}

/** Payment milestones with a running total; the amounts shown are the backend's. */
export function PaymentTermsForm({ value, onChange, editable, errors, payments }: SectionProps<PaymentTerm[]> & { payments?: PaymentFigure[] }) {
  const total = paymentTotal(value)
  const set = (i: number, p: Partial<PaymentTerm>) => onChange(value.map((t, j) => (j === i ? { ...t, ...p } : t)))
  const move = (i: number, d: -1 | 1) => {
    const next = [...value]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }
  return (
    <div id={fieldAnchorId('payment_terms')} tabIndex={-1} className="space-y-2 outline-none">
      <ol className="space-y-2">
        {value.map((t, i) => (
          <li key={i} className="rounded-lg border border-[#e4e8ee] p-3">
            <div className="grid gap-2 sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)]">
              <TextField field={`payment_terms[${i}].percent`} label="Percent" value={t.percent} onChange={(v) => set(i, { percent: v })} editable={editable} errors={errors} inputMode="decimal" />
              <TextField field={`payment_terms[${i}].label`} label="Milestone" value={t.label} onChange={(v) => set(i, { label: v })} editable={editable} errors={errors} maxLength={120} />
              <TextField field={`payment_terms[${i}].short_label`} label="Short label (optional)" value={t.short_label} onChange={(v) => set(i, { short_label: v })} editable={editable} errors={errors} maxLength={80} />
            </div>
            {payments?.[i] && payments[i].label === t.label && payments[i].percent === t.percent && (
              <p className="mt-1 font-utility text-xs text-[#111827]/65">
                Amount on the saved proposal: <span className="font-medium text-[#111827]">{formatInr(payments[i].amount)}</span> <span className="italic">· calculated</span>
              </p>
            )}
            {editable && (
              <div className="mt-1 flex justify-end gap-1">
                <Button type="button" variant="ghost" size="sm" className="min-h-11" disabled={i === 0} aria-label={`Move milestone ${i + 1} up`} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="min-h-11" disabled={i === value.length - 1} aria-label={`Move milestone ${i + 1} down`} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="min-h-11" aria-label={`Remove milestone ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      <p
        className={`font-utility text-sm font-medium ${total?.isHundred ? 'text-green-700' : 'text-amber-800'}`}
        data-testid="payment-total"
        aria-live="polite"
      >
        Total: {total ? `${total.total} %` : '—'} {total?.isHundred ? '✓' : '— must be exactly 100 %'}
      </p>
      {editable && value.length < 6 && (
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => onChange([...value, { percent: '', label: '', short_label: null }])}>
          <Plus className="mr-1 h-4 w-4" /> Add milestone
        </Button>
      )}
      <FieldError field="payment_terms" errors={errors} />
    </div>
  )
}
