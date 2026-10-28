'use client'

import { useState } from 'react'
import { BookOpen, Copy, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/dashboard/utils'
import { formatInr } from '@/lib/money'
import { useCatalogueBrands, useLibrary } from '@/lib/studio/api'
import { PROJECT_TYPE_HINT, kwpText, studioFieldId } from '@/lib/studio/logic'
import type { StudioAutosave } from '@/lib/studio/use-autosave'
import type {
  StudioAddressee,
  StudioConnection,
  StudioDisplay,
  StudioDocument,
  StudioOptions,
  StudioPlant,
  StudioPmSuryaGhar,
  StudioPrice,
  StudioProject,
  StudioSavingsInputs,
  StudioSite,
  StudioSystem,
  StudioView,
} from '@/lib/studio/types'
import type { BoqRow, PaymentTerm } from '@/lib/proposals/document-types'
import { BoqRowsEditor, ItemsEditor } from './MaterialsEditor'
import { FiguresSummary } from './FiguresSummary'
import { Field, INPUT, Notice, SelectInput, TextInput, Toggle } from './ui'

// The wizard's steps. Each field change replaces its whole section locally and the autosave
// sends it a moment later; the server validates, recomputes every figure and answers with the
// new View. Defaulted sections (materials, customer scope, payment terms) follow the plant
// until someone edits them.

export interface StepProps {
  view: StudioView
  options: StudioOptions
  auto: StudioAutosave
  editable: boolean
  canPrice: boolean
}

function useSection<K extends keyof StudioDocument>(p: StepProps, key: K): [StudioDocument[K], (v: StudioDocument[K], opts?: { immediate?: boolean }) => void] {
  const value = p.auto.value(key as string, p.view.document[key])
  return [value, (v, opts) => p.auto.edit(key as string, v, opts)]
}

/** A list of address lines (1–5). */
function LinesInput({ field, label, hint, lines, onChange, disabled, error }: { field: string; label: string; hint?: string; lines: string[]; onChange: (v: string[]) => void; disabled: boolean; error?: string | null }) {
  const shown = lines.length ? lines : ['']
  return (
    <fieldset className="space-y-2" data-field={field}>
      <legend className="font-utility text-sm font-medium text-[#091c3c]">{label}</legend>
      {hint && <p className="font-utility text-xs text-[#111827]/60">{hint}</p>}
      {shown.map((l, i) => (
        <input
          key={i}
          id={i === 0 ? studioFieldId(field) : undefined}
          aria-label={`${label}, line ${i + 1}`}
          className={INPUT}
          value={l}
          maxLength={120}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(shown.map((x, j) => (j === i ? e.target.value : x)))}
        />
      ))}
      {!disabled && shown.length < 5 && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...shown, ''])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add a line
        </Button>
      )}
      {error && <p role="alert" className="font-utility text-xs text-red-700">{error}</p>}
    </fieldset>
  )
}

/** A list of sentences (customer scope, special notes) with "add from the Library". */
function BulletList({
  field,
  label,
  hint,
  items,
  onChange,
  disabled,
  libraryKind,
  projectType,
  max,
  error,
  addLabel,
}: {
  field: string
  label: string
  hint: string
  items: string[]
  onChange: (v: string[]) => void
  disabled: boolean
  libraryKind: 'note' | 'customer_scope_item'
  projectType: string
  max: number
  error?: string | null
  addLabel: string
}) {
  const [picking, setPicking] = useState(false)
  const library = useLibrary(libraryKind, false, projectType)
  const unused = (library.data?.items ?? []).filter((x) => x.body.text && !items.includes(x.body.text))
  return (
    <fieldset className="space-y-2" data-field={field}>
      <legend className="font-utility text-sm font-medium text-[#091c3c]">{label}</legend>
      <p className="font-utility text-xs text-[#111827]/60">{hint}</p>
      <ol className="space-y-2">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-3 w-5 shrink-0 text-right font-utility text-xs text-[#111827]/50">{i + 1}.</span>
            <textarea
              id={i === 0 ? studioFieldId(field) : studioFieldId(`${field}[${i}]`)}
              aria-label={`${label} ${i + 1}`}
              className={cn(INPUT, 'min-h-11')}
              rows={2}
              maxLength={400}
              value={t}
              disabled={disabled}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            />
            {!disabled && (
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="font-utility text-xs text-red-700">{error}</p>}
      {!disabled && items.length < max && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...items, ''])}>
            <Plus className="mr-1 h-3.5 w-3.5" /> {addLabel}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setPicking((x) => !x)} aria-expanded={picking} data-testid={`library-${libraryKind}`}>
            <BookOpen className="mr-1 h-3.5 w-3.5" /> Add from the Library
          </Button>
        </div>
      )}
      {picking && (
        <div className="rounded-lg border border-[#e4e8ee] bg-[#f7f9fc] p-2">
          {library.isLoading ? (
            <p className="p-2 font-utility text-sm text-[#111827]/60">Loading…</p>
          ) : unused.length === 0 ? (
            <p className="p-2 font-utility text-sm text-[#111827]/60">Nothing more in the Library for this. Admins and the Proposal Desk add items under Library.</p>
          ) : (
            <ul className="space-y-1">
              {unused.map((x) => (
                <li key={x.id}>
                  <button
                    type="button"
                    className="w-full min-h-11 rounded-md px-2 py-1.5 text-left font-utility text-sm hover:bg-white"
                    onClick={() => {
                      onChange([...items.filter((t) => t.trim()), x.body.text!].slice(0, max))
                      setPicking(false)
                    }}
                  >
                    <span className="font-medium text-[#091c3c]">{x.name}</span>
                    <span className="block text-xs text-[#111827]/65">{x.body.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </fieldset>
  )
}

const RESET_WHAT: Record<string, string> = {
  boq: 'the bill of quantities',
  customer_scope: 'what the customer provides',
  payment_terms: 'the payment terms',
  system: 'the panel technology, inverter and mounting wording',
}

/**
 * Whether a section still follows the plant, and — BE-19 — "Reset to defaults" once staff
 * have changed it: the section goes back to what the layout, size and package give, and
 * follows the plant again.
 */
function SectionDefaults({ p, section }: { p: StepProps; section: string }) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const edited = p.view.document.edited?.includes(section)
  const resettable = p.editable && edited && (p.options.resettable_sections ?? []).includes(section)
  return (
    <div className="space-y-1">
      <p className="font-utility text-xs text-[#111827]/60" data-testid={`follows-${section}`}>
        {edited
          ? 'You changed these, so they stay as you set them.'
          : 'Filled in for you from the size and package — they update when the plant changes, until you change them yourself.'}
        {resettable && !asking && (
          <button type="button" className="ml-2 inline-flex min-h-8 items-center gap-1 font-medium text-[#0e2a63] underline" onClick={() => setAsking(true)} data-testid={`reset-${section}`}>
            <RotateCcw className="h-3 w-3" aria-hidden="true" /> Reset to defaults
          </button>
        )}
      </p>
      {asking && (
        <div role="alertdialog" aria-label="Reset to defaults" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 font-utility text-sm text-amber-900" data-testid={`reset-confirm-${section}`}>
          <span className="flex-1 min-w-[12rem]">Put {RESET_WHAT[section] ?? 'this section'} back to Grid Nova’s standard? Your changes here are replaced.</span>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await p.auto.reset(section)
              setBusy(false)
              setAsking(false)
            }}
          >
            {busy ? 'Resetting…' : 'Reset'}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setAsking(false)}>Keep my changes</Button>
        </div>
      )}
    </div>
  )
}

// ── 1. Customer ─────────────────────────────────────────────────────────────

export function StepCustomer(p: StepProps) {
  const [a, setA] = useSection(p, 'addressee')
  const set = (patch: Partial<StudioAddressee>) => setA({ ...a, ...patch })
  const org = a.customer_type === 'organisation'
  const e = p.auto.errorFor
  return (
    <div className="space-y-4">
      <Notice tone="info">This is how the customer is named and addressed on the proposal. Changing it here does not change the customer record.</Notice>
      <SelectInput
        field="addressee.customer_type"
        label="Addressed to"
        value={a.customer_type}
        options={[{ value: 'individual', label: 'A person' }, { value: 'organisation', label: 'A business or organisation' }]}
        onChange={(v) => set({ customer_type: v as StudioAddressee['customer_type'] })}
        disabled={!p.editable}
      />
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <SelectInput field="addressee.title" label="Title" value={a.title} emptyLabel="None" options={p.options.titles.map((t) => ({ value: t, label: t }))} onChange={(v) => set({ title: v || null })} disabled={!p.editable} error={e('addressee.title')} />
        <TextInput field="addressee.name" label={org ? 'Organisation name' : 'Full name'} required value={a.name} onChange={(v) => set({ name: v })} disabled={!p.editable} error={e('addressee.name')} maxLength={120} hint="Exactly as it should print" />
      </div>
      {org && <TextInput field="addressee.attention" label="Contact person (Kind Attn.)" value={a.attention} onChange={(v) => set({ attention: v || null })} disabled={!p.editable} error={e('addressee.attention')} maxLength={120} />}
      <LinesInput field="addressee.address_lines" label="Address" hint="One line per box, as it should print." lines={a.address_lines} onChange={(v) => set({ address_lines: v })} disabled={!p.editable} error={e('addressee.address_lines')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput field="addressee.mobile" label="Mobile number" required value={a.mobile} onChange={(v) => set({ mobile: v || null })} disabled={!p.editable} error={e('addressee.mobile')} inputMode="tel" hint="10 digits — the customer confirms its last 4 to accept online" />
        {!org && (
          <TextInput field="addressee.aadhaar_last4" label="Aadhaar — last 4 digits" value={a.aadhaar_last4} onChange={(v) => set({ aadhaar_last4: v.replace(/\D/g, '').slice(0, 4) || null })} disabled={!p.editable} error={e('addressee.aadhaar_last4')} inputMode="numeric" maxLength={4} hint="Optional. Only the last 4 — printed as XXXX XXXX 1234" />
        )}
      </div>
      <SelectInput field="addressee.salutation" label="Greeting" value={a.salutation} options={p.options.salutations.map((s) => ({ value: s, label: s }))} onChange={(v) => set({ salutation: v })} disabled={!p.editable} hint="The first line of the letter" />
      {e('addressee') && <Notice tone="error">{e('addressee')}</Notice>}
    </div>
  )
}

// ── 2. Project ──────────────────────────────────────────────────────────────

export function StepProject(p: StepProps) {
  const [project, setProject] = useSection(p, 'project')
  const [plant, setPlant] = useSection(p, 'plant')
  const [conn, setConn] = useSection(p, 'connection')
  const [pmsg, setPmsg] = useSection(p, 'pm_surya_ghar')
  const e = p.auto.errorFor
  const type = project.project_type
  const itemised = p.view.layout === 'itemised'
  const residential = type === 'residential_rooftop'
  const society = type === 'housing_society'
  const setPl = (patch: Partial<StudioPlant>) => setPlant({ ...plant, ...patch })
  const setPj = (patch: Partial<StudioProject>) => setProject({ ...project, ...patch })
  const setPm = (patch: Partial<StudioPmSuryaGhar>) => setPmsg({ ...pmsg, ...patch })
  const setC = (patch: Partial<StudioConnection>) => setConn({ ...conn, ...patch })

  return (
    <div className="space-y-5">
      <SelectInput
        field="project.project_type"
        label="Kind of project"
        value={type}
        options={p.options.project_types.map((t) => ({ value: t.id, label: t.label }))}
        onChange={(v) => setPj({ project_type: v })}
        disabled={!p.editable}
        hint={PROJECT_TYPE_HINT[type]}
        error={e('project.project_type') ?? e('project')}
      />
      {!itemised && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              field="plant.capacity_kwp"
              label="Plant size (kWp)"
              required
              value={plant.capacity_kwp}
              onChange={(v) => setPl({ capacity_kwp: v.trim() || null })}
              disabled={!p.editable}
              inputMode="decimal"
              error={e('plant.capacity_kwp') ?? e('plant')}
              hint={`Up to 10 kWp prints the short layout; above it, the detailed one. Now: ${p.view.layout === 'compact' ? 'short' : 'detailed'}.`}
            />
            <Field field="connection.phase" label="Electricity supply" hint="Look at the electricity bill: single-phase or three-phase" error={e('connection.phase')}>
              {(a) => (
                <div role="radiogroup" aria-labelledby={`${a.id}-label`} className="grid grid-cols-2 gap-2" id={a.id}>
                  {(['single', 'three'] as const).map((ph) => (
                    <button
                      key={ph}
                      type="button"
                      role="radio"
                      aria-checked={conn.phase === ph}
                      disabled={!p.editable}
                      onClick={() => setC({ phase: ph })}
                      className={cn('min-h-11 rounded-lg border px-3 font-utility text-sm', conn.phase === ph ? 'border-[#0e2a63] bg-[#0e2a63] text-white' : 'border-[#d5dbe4] bg-white text-[#091c3c] hover:border-[#0e2a63]')}
                    >
                      {ph === 'single' ? 'Single-phase' : 'Three-phase'}
                    </button>
                  ))}
                </div>
              )}
            </Field>
          </div>
          <SelectInput
            field="plant.package"
            label="Package"
            value={plant.package}
            emptyLabel="No package (price set by hand)"
            options={p.options.packages.map((x) => ({ value: x.id, label: x.label }))}
            onChange={(v) => setPl({ package: (v || null) as StudioPlant['package'] })}
            disabled={!p.editable}
            hint="With a package, the size and phase, the price master gives the price."
          />
          <Toggle field="plant.dcr" label="DCR panels (made in India)" hint="Needed for the PM Surya Ghar subsidy" checked={plant.dcr} onChange={(v) => setPl({ dcr: v })} disabled={!p.editable} />
        </>
      )}
      {/* A housing society gets the society subsidy (BE-14, BE-18 sample "60 kWp × 24 houses"). */}
      {(residential || society) && (
        <fieldset className="space-y-3 rounded-xl border border-[#e4e8ee] p-4" data-field="pm_surya_ghar">
          <legend className="px-1 font-utility text-sm font-semibold text-[#091c3c]">PM Surya Ghar subsidy</legend>
          <Toggle field="pm_surya_ghar.subsidy_opted" label="The customer wants the subsidy" hint="The subsidy is printed and taken off the cost the customer bears (DCR panels needed)" checked={pmsg.subsidy_opted} onChange={(v) => setPm({ subsidy_opted: v })} disabled={!p.editable} />
          {pmsg.subsidy_opted && !plant.dcr && (
            <Notice tone="warn" testId="subsidy-needs-dcr">
              <p>The subsidy is only given with DCR (made in India) panels. Without them it will not be printed.</p>
              {p.editable && (
                <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setPl({ dcr: true })}>
                  Use DCR panels
                </Button>
              )}
            </Notice>
          )}
          {pmsg.subsidy_opted && (
            <>
              <Toggle field="pm_surya_ghar.portal_registered" label="Registered on the PM Surya Ghar portal" checked={pmsg.portal_registered} onChange={(v) => setPm({ portal_registered: v })} disabled={!p.editable} />
              <TextInput field="pm_surya_ghar.approved_capacity_kwp" label="Capacity approved on the portal (kWp)" value={pmsg.approved_capacity_kwp} onChange={(v) => setPm({ approved_capacity_kwp: v.trim() || null })} disabled={!p.editable} inputMode="decimal" hint="Optional — if the portal has approved a size" error={e('pm_surya_ghar.approved_capacity_kwp') ?? e('pm_surya_ghar')} />
            </>
          )}
        </fieldset>
      )}
      {society && (
        <TextInput
          field="project.houses"
          label="Number of houses in the society"
          required
          value={project.houses == null ? '' : String(project.houses)}
          onChange={(v) => setPj({ houses: /^\d+$/.test(v) ? Number(v) : null })}
          disabled={!p.editable}
          inputMode="numeric"
          hint="The society subsidy depends on it (3 kW per house at most)"
          error={e('project.houses')}
        />
      )}
      {p.view.content_blockers.length > 0 && (
        <Notice tone="warn" testId="content-blockers">
          You can draft and preview this kind of proposal, but it cannot be issued until Grid Nova supplies: {p.view.content_blockers.map((b) => `${b.message} (${b.registry})`).join('; ')}.
        </Notice>
      )}
    </div>
  )
}

// ── 3. Site & connection ────────────────────────────────────────────────────

export function StepSite(p: StepProps) {
  const [site, setSite] = useSection(p, 'site')
  const [conn, setConn] = useSection(p, 'connection')
  const [project, setProject] = useSection(p, 'project')
  const addressee = p.auto.value('addressee', p.view.document.addressee)
  const e = p.auto.errorFor
  const setS = (patch: Partial<StudioSite>) => setSite({ ...site, ...patch })
  const setC = (patch: Partial<StudioConnection>) => setConn({ ...conn, ...patch })
  const known = !conn.discom || p.options.discoms.includes(conn.discom)
  // "Other…" picked (and nothing typed yet), or a name that is not in the list.
  const [chooseOther, setOther] = useState(false)
  const other = chooseOther || !known

  return (
    <div className="space-y-5">
      <LinesInput field="site.address_lines" label="Where the plant goes" hint="Leave as the customer’s address if it is the same place." lines={site.address_lines} onChange={(v) => setS({ address_lines: v })} disabled={!p.editable} error={e('site.address_lines')} />
      {p.editable && addressee.address_lines.length > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={() => setS({ address_lines: [...addressee.address_lines] })} data-testid="same-as-customer">
          <Copy className="mr-1 h-3.5 w-3.5" /> Same as the customer’s address
        </Button>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput field="site.town" label="Town" required value={site.town} onChange={(v) => setS({ town: v || null })} disabled={!p.editable} error={e('site.town')} hint="Named in the letter, e.g. Habra" />
        <TextInput field="site.state" label="State" required value={site.state} onChange={(v) => setS({ state: v || null })} disabled={!p.editable} error={e('site.state')} hint="West Bengal or Bihar — the subsidy and generation follow it" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput
          field="connection.discom"
          label="Electricity company (DISCOM)"
          value={other ? '__other' : conn.discom}
          emptyLabel="Choose…"
          options={[...p.options.discoms.map((d) => ({ value: d, label: d })), { value: '__other', label: 'Other…' }]}
          onChange={(v) => {
            if (v === '__other') {
              setOther(true)
              setC({ discom: null })
            } else {
              setOther(false)
              setC({ discom: v || null })
            }
          }}
          disabled={!p.editable}
          error={e('connection.discom')}
          hint="As printed on the electricity bill"
        />
        {other && <TextInput field="connection.discom_other" label="Name of the electricity company" value={conn.discom} onChange={(v) => setC({ discom: v || null })} disabled={!p.editable} maxLength={60} />}
        <TextInput field="connection.consumer_number" label="Consumer number" value={conn.consumer_number} onChange={(v) => setC({ consumer_number: v || null })} disabled={!p.editable} error={e('connection.consumer_number')} hint="From the electricity bill" maxLength={40} />
        <TextInput field="connection.sub_division" label="Sub-division / supply office" value={conn.sub_division} onChange={(v) => setC({ sub_division: v || null })} disabled={!p.editable} hint="Optional" maxLength={80} />
        <TextInput field="connection.sanctioned_load_kw" label="Sanctioned load (kW)" value={conn.sanctioned_load_kw} onChange={(v) => setC({ sanctioned_load_kw: v.trim() || null })} disabled={!p.editable} inputMode="decimal" error={e('connection.sanctioned_load_kw')} hint="From the bill. A plant larger than this gets a warning to check." />
        <SelectInput field="connection.category" label="Connection category" value={conn.category} emptyLabel="Choose…" options={p.options.categories.map((c) => ({ value: c, label: c }))} onChange={(v) => setC({ category: v || null })} disabled={!p.editable} error={e('connection.category')} />
        <TextInput
          field="project.roof_area_sqft"
          label="Shadow-free roof area (sq ft)"
          value={project.roof_area_sqft}
          onChange={(v) => setProject({ ...project, roof_area_sqft: v.trim() || null })}
          disabled={!p.editable}
          inputMode="decimal"
          error={e('project.roof_area_sqft')}
          hint="Optional — if measured. A roof too small for the plant gets a warning."
        />
      </div>
      {e('connection') && <Notice tone="error">{e('connection')}</Notice>}
      {e('site') && <Notice tone="error">{e('site')}</Notice>}
    </div>
  )
}

// ── 4. System & materials ───────────────────────────────────────────────────

export function StepSystem(p: StepProps) {
  const [system, setSystem] = useSection(p, 'system')
  const [boq, setBoq] = useSection(p, 'boq')
  const [items, setItems] = useSection(p, 'items')
  const catalogue = useCatalogueBrands()
  const presets = useLibrary('boq_preset', false, p.view.document.project.project_type)
  const [presetOpen, setPresetOpen] = useState(false)
  const e = p.auto.errorFor
  const setSy = (patch: Partial<StudioSystem>) => setSystem({ ...system, ...patch })

  if (p.view.layout === 'itemised') {
    return (
      <div className="space-y-4">
        <ItemsEditor items={items} figures={p.view.figures.items} onChange={(v) => setItems(v)} editable={p.editable} options={p.options} catalogue={catalogue.data ?? []} errorFor={e} />
        {e('items') && <Notice tone="error">{e('items')}</Notice>}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput field="system.module_technology" label="Panel technology" value={system.module_technology} options={p.options.module_technologies.map((t) => ({ value: t, label: t }))} onChange={(v) => setSy({ module_technology: v })} disabled={!p.editable} />
        <TextInput field="system.inverter" label="Inverter wording" value={system.inverter} onChange={(v) => setSy({ inverter: v || null })} disabled={!p.editable} maxLength={160} hint={`Leave blank for the standard wording for ${kwpText(p.view.document.plant.capacity_kwp)}`} error={e('system.inverter')} />
      </div>
      <TextInput field="system.mounting" label="Mounting structure wording" value={system.mounting} onChange={(v) => setSy({ mounting: v || null })} disabled={!p.editable} maxLength={160} hint="Leave blank for the standard wording" error={e('system.mounting')} />
      {p.view.document.edited?.includes('system') && <SectionDefaults p={p} section="system" />}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-[#091c3c]">Bill of quantities</h3>
          {p.editable && (
            <Button type="button" variant="outline" size="sm" onClick={() => setPresetOpen((x) => !x)} aria-expanded={presetOpen} data-testid="boq-presets">
              <BookOpen className="mr-1 h-3.5 w-3.5" /> Add rows from the Library
            </Button>
          )}
        </div>
        <SectionDefaults p={p} section="boq" />
        {presetOpen && (
          <div className="rounded-lg border border-[#e4e8ee] bg-[#f7f9fc] p-2">
            {(presets.data?.items ?? []).length === 0 ? (
              <p className="p-2 font-utility text-sm text-[#111827]/60">No saved sets of rows yet. Add them under Library.</p>
            ) : (
              <ul className="space-y-1">
                {presets.data!.items.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      className="w-full min-h-11 rounded-md px-2 py-1.5 text-left font-utility text-sm hover:bg-white"
                      onClick={() => {
                        setBoq([...boq, ...((x.body.rows ?? []) as BoqRow[])].slice(0, 30))
                        setPresetOpen(false)
                      }}
                    >
                      <span className="font-medium text-[#091c3c]">{x.name}</span>
                      <span className="block text-xs text-[#111827]/65">{(x.body.rows ?? []).length} rows</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <BoqRowsEditor rows={boq} onChange={(v) => setBoq(v)} editable={p.editable} catalogue={catalogue.data ?? []} boqMakes={p.options.boq_makes} errorFor={e} />
        {e('boq') && <Notice tone="error">{e('boq')}</Notice>}
      </div>
    </div>
  )
}

// ── 5. Price ────────────────────────────────────────────────────────────────

type PriceWay = 'price_list' | 'total' | 'basic' | 'rate'

function wayOf(price: StudioPrice): PriceWay {
  if (price.mode === 'staff_total') return 'total'
  if (price.mode === 'staff_basic') return price.rate_per_kwp ? 'rate' : 'basic'
  if (price.mode === 'price_list') return 'price_list'
  return 'total'
}

interface PriceForm {
  way: PriceWay
  amount: string
  discountOn: boolean
  discount: string
  discountReason: string
  reason: string
}

function formOf(price: StudioPrice): PriceForm {
  const way = wayOf(price)
  return {
    way,
    amount: (way === 'total' ? price.total : way === 'basic' ? price.basic : way === 'rate' ? price.rate_per_kwp : null) ?? '',
    discountOn: !!price.discount,
    discount: price.discount?.amount ?? '',
    discountReason: price.discount?.reason ?? '',
    reason: price.reason ?? '',
  }
}

/** The `price` section to send, or null while something needed is still blank. */
export function priceValue(f: PriceForm): Record<string, unknown> | null {
  const amount = f.amount.trim().replace(/,/g, '')
  const discount = f.discountOn && f.way !== 'total' && f.discount.trim() ? { amount: f.discount.trim().replace(/,/g, ''), reason: f.discountReason.trim() } : null
  if (discount && discount.reason.length < 3) return null
  const reason = f.reason.trim() || null
  if (f.way === 'price_list') return { mode: 'price_list', discount, reason }
  if (!amount) return null
  if (f.way === 'total') return { mode: 'staff_total', total: amount, reason }
  if (f.way === 'basic') return { mode: 'staff_basic', basic: amount, discount, reason }
  return { mode: 'staff_basic', rate_per_kwp: amount, discount, reason }
}

export function StepPrice(p: StepProps) {
  const server = p.view.document.price
  const [f, setF] = useState<PriceForm>(() => formOf(server))
  const [display, setDisplay] = useSection(p, 'display')
  const [savings, setSavings] = useSection(p, 'savings')
  const figures = p.view.figures
  const e = p.auto.errorFor
  const priceError = e('price') ?? e('price.mode') ?? e('price.total') ?? e('price.basic') ?? e('price.rate_per_kwp')
  const below = figures.below_price_master
  const update = (patch: Partial<PriceForm>) => {
    const next = { ...f, ...patch }
    setF(next)
    const v = priceValue(next)
    if (v) p.auto.edit('price', v)
  }
  const setD = (patch: Partial<StudioDisplay>) => setDisplay({ ...display, ...patch }, { immediate: true })
  const sv: StudioSavingsInputs = savings ?? { monthly_units: null, monthly_bill: null, tariff_per_unit: null, fixed_charges: null, export_rate: null }
  const setSv = (patch: Partial<StudioSavingsInputs>) => setSavings({ ...sv, ...patch })
  const editable = p.editable && p.canPrice

  if (p.view.layout === 'itemised') {
    return (
      <div className="space-y-4">
        <Notice tone="info">Itemised supply is priced by its line items (step “System & materials”). The totals below are worked out from them.</Notice>
        <FiguresSummary figures={figures} />
      </div>
    )
  }

  const ways: { id: PriceWay; label: string; hint: string }[] = [
    { id: 'price_list', label: 'Use the price master', hint: 'The standard price for this package, phase and size' },
    { id: 'total', label: 'I know the total (incl. GST)', hint: 'Type what the customer pays in all' },
    { id: 'basic', label: 'I know the basic price', hint: 'Before GST — GST is added for you' },
    { id: 'rate', label: 'A rate per kWp', hint: 'Basic price per kWp × the plant size' },
  ]
  const amountLabel = f.way === 'total' ? 'Total the customer pays, incl. GST (₹)' : f.way === 'basic' ? 'Basic price before GST (₹)' : 'Rate per kWp, before GST (₹)'

  return (
    <div className="space-y-5">
      {!p.canPrice && <Notice tone="info">Only people who can set prices change this step. The figures below are read-only for you.</Notice>}
      <div className="rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-3 font-utility text-sm" data-testid="price-master-reference">
        {figures.list_basic ? (
          <>
            Price master for this plant: <strong className="tabular-nums text-[#091c3c]">{formatInr(figures.list_basic)}</strong> basic, before GST.
          </>
        ) : (
          'The price master has no price for this size, package and phase — enter the price yourself.'
        )}
      </div>

      <fieldset disabled={!editable} className="space-y-2">
        <legend className="mb-1 font-utility text-sm font-medium text-[#091c3c]">How do you want to set the price?</legend>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="How to set the price">
          {ways.map((w) => (
            <button
              key={w.id}
              type="button"
              role="radio"
              aria-checked={f.way === w.id}
              disabled={!editable || (w.id === 'price_list' && !figures.list_basic)}
              onClick={() => update({ way: w.id, amount: w.id === f.way ? f.amount : '' })}
              data-testid={`price-way-${w.id}`}
              className={cn(
                'min-h-14 rounded-xl border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50',
                f.way === w.id ? 'border-[#0e2a63] bg-[#0e2a63]/[0.05] ring-1 ring-[#0e2a63]' : 'border-[#d5dbe4] bg-white hover:border-[#0e2a63]/60',
              )}
            >
              <span className="block font-utility text-sm font-semibold text-[#091c3c]">{w.label}</span>
              <span className="block font-utility text-xs text-[#111827]/60">{w.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {f.way !== 'price_list' && (
        <TextInput field={f.way === 'total' ? 'price.total' : f.way === 'basic' ? 'price.basic' : 'price.rate_per_kwp'} label={amountLabel} value={f.amount} onChange={(v) => update({ amount: v })} disabled={!editable} inputMode="decimal" error={priceError} hint="Numbers only, e.g. 201465" />
      )}
      {f.way === 'price_list' && priceError && <Notice tone="error">{priceError}</Notice>}

      {f.way !== 'total' && (
        <div className="space-y-3 rounded-xl border border-[#e4e8ee] p-4">
          <Toggle field="price.discount" label="Give a discount" hint="Taken off the basic price before GST" checked={f.discountOn} onChange={(v) => update({ discountOn: v })} disabled={!editable} />
          {f.discountOn && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput field="price.discount.amount" label="Discount (₹)" value={f.discount} onChange={(v) => update({ discount: v })} disabled={!editable} inputMode="decimal" error={e('price.discount') ?? e('price.discount.amount')} />
              <TextInput field="price.discount.reason" label="Reason for the discount" required value={f.discountReason} onChange={(v) => update({ discountReason: v })} disabled={!editable} maxLength={200} hint="At least 3 characters — kept with the proposal" error={f.discountOn && f.discount.trim() && f.discountReason.trim().length < 3 ? 'Give the reason (at least 3 characters) — the discount is saved once it has one.' : null} />
            </div>
          )}
          {f.discountOn && (
            <Toggle field="display.show_discount_line" label="Show the discount on the proposal" hint="Prints the price before the discount and the discount itself" checked={display.show_discount_line} onChange={(v) => setD({ show_discount_line: v })} disabled={!p.editable} />
          )}
        </div>
      )}

      {(below || e('price.reason')) && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4" data-testid="below-price-master">
          {below && (
            <p className="font-utility text-sm text-amber-900">
              This price is {below.percent}% below the price master. {f.discountOn ? 'The discount reason covers it, or give a reason below.' : 'Give the reason — it goes to the approver.'}
            </p>
          )}
          <TextInput field="price.reason" label="Why is the price lower?" value={f.reason} onChange={(v) => update({ reason: v })} disabled={!editable} maxLength={200} error={e('price.reason')} hint="e.g. “Matching a competitor’s quote, approved by Raju”" />
        </div>
      )}

      <div className="space-y-2">
        {p.view.layout === 'compact' && (
          <Toggle field="display.show_package_comparison" label="Compare the packages on the proposal" hint="Prints both packages side by side (up to 10 kWp)" checked={display.show_package_comparison} onChange={(v) => setD({ show_package_comparison: v })} disabled={!p.editable} />
        )}
        <Toggle field="display.show_savings" label="Add a savings page" hint="Shows the yearly savings and payback from the customer’s bill" checked={display.show_savings} onChange={(v) => setD({ show_savings: v })} disabled={!p.editable} />
      </div>
      {display.show_savings && (
        <fieldset className="grid gap-4 rounded-xl border border-[#e4e8ee] p-4 sm:grid-cols-2" data-field="savings">
          <legend className="px-1 font-utility text-sm font-semibold text-[#091c3c]">From the customer’s electricity bill</legend>
          <TextInput field="savings.monthly_units" label="Average units a month" value={sv.monthly_units} onChange={(v) => setSv({ monthly_units: v.trim() || null })} disabled={!p.editable} inputMode="decimal" hint="Units (kWh) — or give the bill amount instead" />
          <TextInput field="savings.monthly_bill" label="Average bill a month (₹)" value={sv.monthly_bill} onChange={(v) => setSv({ monthly_bill: v.trim() || null })} disabled={!p.editable} inputMode="decimal" />
          <TextInput field="savings.tariff_per_unit" label="Tariff per unit (₹)" required value={sv.tariff_per_unit} onChange={(v) => setSv({ tariff_per_unit: v.trim() || null })} disabled={!p.editable} inputMode="decimal" hint="e.g. 7.50" />
          <TextInput field="savings.fixed_charges" label="Fixed charges a month (₹)" value={sv.fixed_charges} onChange={(v) => setSv({ fixed_charges: v.trim() || null })} disabled={!p.editable} inputMode="decimal" hint="Optional" />
          <TextInput field="savings.export_rate" label="Rate paid for exported units (₹)" value={sv.export_rate} onChange={(v) => setSv({ export_rate: v.trim() || null })} disabled={!p.editable} inputMode="decimal" hint="Optional" />
          {e('savings') && <Notice tone="error" className="sm:col-span-2">{e('savings')}</Notice>}
        </fieldset>
      )}

      <FiguresSummary figures={figures} />
    </div>
  )
}

// ── 6. Terms & notes ────────────────────────────────────────────────────────

export function StepTerms(p: StepProps) {
  const [terms, setTerms] = useSection(p, 'payment_terms')
  const [validity, setValidity] = useSection(p, 'validity_days')
  const [scope, setScope] = useSection(p, 'customer_scope')
  const [notesFree, setNotesFree] = useSection(p, 'notes_free')
  const [highlight, setHighlight] = useSection(p, 'cover_highlight')
  const [validityText, setValidityText] = useState(String(validity))
  const e = p.auto.errorFor
  const type = p.view.document.project.project_type
  const setT = (i: number, patch: Partial<PaymentTerm>) => setTerms(terms.map((t, j) => (j === i ? { ...t, ...patch } : t)))

  return (
    <div className="space-y-6">
      <fieldset className="space-y-2" data-field="payment_terms">
        <legend className="font-display text-base font-semibold text-[#091c3c]">Payment terms</legend>
        <SectionDefaults p={p} section="payment_terms" />
        {p.editable && (p.options.payment_term_presets ?? []).length > 0 && (
          <label className="block max-w-md">
            <span className="mb-0.5 block font-utility text-xs text-[#111827]/65">Use a standard schedule</span>
            <select
              className={INPUT}
              value=""
              data-testid="payment-presets"
              onChange={(ev) => {
                const preset = p.options.payment_term_presets?.find((x) => x.id === ev.target.value)
                if (preset) setTerms(preset.terms.map((t) => ({ percent: t.percent, label: t.label, short_label: t.short_label ?? null })), { immediate: true })
              }}
            >
              <option value="">Choose a schedule…</option>
              {p.options.payment_term_presets!.map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            </select>
          </label>
        )}
        <p className="font-utility text-xs text-[#111827]/60">The percentages must add up to 100. The rupee amount of each milestone is worked out for you.</p>
        <ol className="space-y-2">
          {terms.map((t, i) => {
            const amount = p.view.figures.payments?.[i]?.amount
            return (
              <li key={i} className="grid grid-cols-[5rem_1fr_auto] items-start gap-2 rounded-lg border border-[#e4e8ee] p-2 sm:grid-cols-[5rem_1fr_10rem_auto]">
                <label className="block">
                  <span className="sr-only">Milestone {i + 1} percent</span>
                  <div className="relative">
                    <input id={studioFieldId(`payment_terms[${i}].percent`)} className={cn(INPUT, 'pr-6')} inputMode="decimal" value={t.percent} disabled={!p.editable} onChange={(ev) => setT(i, { percent: ev.target.value })} />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-utility text-sm text-[#111827]/50">%</span>
                  </div>
                </label>
                <label className="block">
                  <span className="sr-only">Milestone {i + 1} wording</span>
                  <input className={INPUT} value={t.label} maxLength={120} disabled={!p.editable} onChange={(ev) => setT(i, { label: ev.target.value })} placeholder="e.g. On signing the agreement" />
                </label>
                <span className="hidden self-center text-right font-utility text-sm tabular-nums text-[#111827]/70 sm:block">{amount ? formatInr(amount) : '—'}</span>
                {p.editable && terms.length > 1 ? (
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove milestone ${i + 1}`} onClick={() => setTerms(terms.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <span />
                )}
              </li>
            )
          })}
        </ol>
        {(e('payment_terms') || e('payment_terms_total')) && <Notice tone="error">{e('payment_terms') ?? e('payment_terms_total')}</Notice>}
        {p.editable && terms.length < 6 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setTerms([...terms, { percent: '', label: '' }])}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add a milestone
          </Button>
        )}
      </fieldset>

      <TextInput
        field="validity_days"
        label="Valid for (days)"
        value={validityText}
        onChange={(v) => {
          setValidityText(v)
          if (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 90) setValidity(Number(v))
        }}
        disabled={!p.editable}
        inputMode="numeric"
        hint={`1 to 90 days from the day it is issued. Grid Nova’s usual: ${p.options.validity_days_default} days.`}
        error={e('validity_days') ?? (/^\d+$/.test(validityText) && Number(validityText) >= 1 && Number(validityText) <= 90 ? null : 'Enter a number of days from 1 to 90.')}
      />

      <TextInput field="cover_highlight" label="One line under the title (optional)" value={highlight} onChange={(v) => setHighlight(v || null)} disabled={!p.editable} maxLength={90} hint="Up to 90 characters, e.g. “Save up to ₹2,400 a month on your bill”" error={e('cover_highlight')} />

      <BulletList field="notes_free" label="Special notes" hint="Printed under “Special Notes”. Add your own, or pick a ready sentence from the Library." items={notesFree} onChange={(v) => setNotesFree(v)} disabled={!p.editable} libraryKind="note" projectType={type} max={10} error={e('notes_free')} addLabel="Add a note" />

      <SectionDefaults p={p} section="customer_scope" />
      <BulletList field="customer_scope" label="What the customer provides" hint="The customer’s side of the work. Filled in for you; change it if this site needs something else." items={scope} onChange={(v) => setScope(v)} disabled={!p.editable} libraryKind="customer_scope_item" projectType={type} max={20} error={e('customer_scope')} addLabel="Add an item" />
    </div>
  )
}
