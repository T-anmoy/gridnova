'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useMessages } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/types'
import { formatInr } from '@/lib/money'
import { currentIstMonth, conditionalApplies, formatKw, type BillRow, type SectionRow, type SurveyForm, type YesNo } from '@/lib/associate/survey'
import { CONNECTION_PHASES, SHADING_CONDITIONS, SURVEY_VARIANTS, type SurveyOptions, type SurveyResults } from '@/lib/associate/survey-types'
import { FieldError, FormField, NumberField, SelectField, YesNoField, inputClass, labelClass } from '@/components/associate/wizard-fields'

// The survey's own wizard fields (site_survey.md §1). Values stay strings as
// typed; lib/associate/survey.ts turns them into the PATCH body. Every derived
// value (shadow-free area, averages) is shown from the server, never computed.

export interface CommonCopy {
  yes: string
  no: string
  placeholder: string
}

type Errors = Record<string, string | undefined>
type Patch = (p: Partial<SurveyForm>) => void

const btnSecondary =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#c9d2de] bg-white px-4 text-sm font-semibold text-[#0e2a63] font-utility focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] disabled:opacity-40'
const btnIcon =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#111827]/50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="font-display text-base font-semibold text-[#0e2a63]">{children}</p>
}

// ── Connection (variant, DISCOM, phase, load, variant extras) ─────────────

export function ConnectionSurveyFields({
  form,
  onChange,
  options,
  errors,
  common,
}: {
  form: SurveyForm
  onChange: Patch
  options: SurveyOptions
  errors: Errors
  common: CommonCopy
}) {
  const t = useMessages('survey')
  return (
    <div className="space-y-4" data-testid="survey-connection">
      <SectionTitle>{t.connection.title}</SectionTitle>
      <SelectField
        name="survey_variant"
        label={t.connection.variantLabel}
        value={form.survey_variant}
        onChange={(v) => onChange({ survey_variant: (v || 'individual_house') as SurveyForm['survey_variant'] })}
        options={SURVEY_VARIANTS.map((v) => [v, t.connection.variants[v]] as const)}
        placeholder={common.placeholder}
        error={errors.survey_variant}
      />
      {form.survey_variant === 'housing_society' && (
        <>
          <NumberField name="society_flat_count" integer label={t.connection.societyFlatCountLabel} value={form.society_flat_count} onChange={(v) => onChange({ society_flat_count: v })} error={errors.society_flat_count} />
          <SelectField
            name="society_noc_status"
            label={t.connection.societyNocLabel}
            value={form.society_noc_status}
            onChange={(v) => onChange({ society_noc_status: v })}
            options={options.society_noc_statuses.map((s) => [s, t.nocStatuses[s] ?? s] as const)}
            placeholder={common.placeholder}
            error={errors.society_noc_status}
          />
        </>
      )}
      {form.survey_variant === 'commercial_roof' && (
        <NumberField name="contract_demand_kva" label={t.connection.contractDemandLabel} value={form.contract_demand_kva} onChange={(v) => onChange({ contract_demand_kva: v })} error={errors.contract_demand_kva} />
      )}
      <SelectField
        name="discom"
        label={t.connection.discomLabel}
        value={form.discom_choice}
        onChange={(v) => onChange({ discom_choice: v })}
        // "Other" opens free text; the server keeps `discom` as free text (§1).
        options={options.discom_options.map((d) => [d, d === 'Other' ? t.connection.discomOther : d] as const)}
        placeholder={common.placeholder}
        error={form.discom_choice === 'Other' ? undefined : errors.discom}
      />
      {form.discom_choice === 'Other' && (
        <FormField label={t.connection.discomOtherLabel} error={errors.discom}>
          {(p) => <input {...p} name="discom_other" maxLength={100} className={inputClass(!!errors.discom)} value={form.discom_other} onChange={(e) => onChange({ discom_other: e.target.value })} />}
        </FormField>
      )}
      <FormField label={t.connection.consumerNumberLabel} error={errors.consumer_number}>
        {(p) => (
          <input
            {...p}
            name="consumer_number"
            maxLength={50}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            className={inputClass(!!errors.consumer_number)}
            value={form.consumer_number}
            onChange={(e) => onChange({ consumer_number: e.target.value })}
          />
        )}
      </FormField>
      <SelectField
        name="connection_phase"
        label={t.connection.phaseLabel}
        value={form.connection_phase}
        onChange={(v) => onChange({ connection_phase: v })}
        options={CONNECTION_PHASES.map((p) => [p, t.phases[p]] as const)}
        placeholder={common.placeholder}
        error={errors.connection_phase}
      />
      <NumberField name="sanctioned_load_kw" label={t.connection.sanctionedLoadLabel} value={form.sanctioned_load_kw} onChange={(v) => onChange({ sanctioned_load_kw: v })} error={errors.sanctioned_load_kw} />
    </div>
  )
}

// ── Bills ─────────────────────────────────────────────────────────────────

export function BillsStep({
  form,
  onChange,
  options,
  errors,
  results,
}: {
  form: SurveyForm
  onChange: Patch
  options: SurveyOptions
  errors: Errors
  /** Live results once the customer exists; the averages come from here (server-derived). */
  results?: SurveyResults
}) {
  const t = useMessages('survey')
  const b = t.bills
  const rows = form.bills
  const filled = rows.filter((r) => r.units.trim() || r.bill.trim()).length
  const maxMonth = currentIstMonth()

  const setRow = (i: number, p: Partial<BillRow>) => onChange({ bills: rows.map((r, j) => (j === i ? { ...r, ...p } : r)) })
  const removeRow = (i: number) => onChange({ bills: rows.filter((_, j) => j !== i) })
  const addRow = () => onChange({ bills: [...rows, { month: '', units: '', bill: '' }] })

  const avg = results?.bills
  return (
    <div className="space-y-4" data-testid="survey-bills">
      <div>
        <SectionTitle>{b.title}</SectionTitle>
        <p className="mt-1 text-sm text-[#111827]/65 leading-relaxed">
          {fmt(b.intro, { requested: options.requested_consumption_months, min: options.min_consumption_months, max: options.max_consumption_months })}
        </p>
        <p className={`mt-2 text-xs font-semibold font-utility ${filled >= options.min_consumption_months ? 'text-[#0e2a63]' : 'text-amber-700'}`} aria-live="polite">
          {fmt(b.recorded, { count: filled, min: options.min_consumption_months })}
        </p>
      </div>

      <ol className="space-y-3">
        {rows.map((r, i) => {
          const rowError = errors[`bills.${i}`]
          const rowErrorId = `bill-row-${i}-error`
          const invalid = rowError ? ({ 'aria-invalid': true, 'aria-describedby': rowErrorId } as const) : {}
          return (
            <li key={i} className={`rounded-xl border p-3 ${rowError ? 'border-red-300 bg-red-50/40' : 'border-[#e4e8ee]'}`} data-testid={`bill-row-${i}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-utility text-sm font-semibold text-[#0e2a63]">{fmt(b.rowHeading, { n: i + 1 })}</p>
                <button type="button" className={btnIcon} onClick={() => removeRow(i)} aria-label={fmt(b.removeMonth, { n: i + 1 })}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
                <div className="col-span-2 sm:col-span-1">
                <FormField label={b.monthLabel}>
                  {(p) => <input {...p} {...invalid} type="month" max={maxMonth} min="2000-01" className={inputClass(!!rowError)} value={r.month} onChange={(e) => setRow(i, { month: e.target.value })} />}
                </FormField>
                </div>
                <FormField label={b.unitsLabel}>
                  {(p) => <input {...p} {...invalid} type="text" inputMode="decimal" autoComplete="off" className={inputClass(!!rowError)} value={r.units} onChange={(e) => setRow(i, { units: e.target.value.replace(',', '.') })} />}
                </FormField>
                <FormField label={b.billLabel}>
                  {(p) => <input {...p} type="text" inputMode="decimal" autoComplete="off" className={inputClass(false)} value={r.bill} onChange={(e) => setRow(i, { bill: e.target.value.replace(',', '.') })} />}
                </FormField>
              </div>
              {rowError && <FieldError id={rowErrorId} message={rowError} />}
            </li>
          )
        })}
      </ol>
      {errors.bills && <FieldError message={errors.bills} />}

      <button type="button" className={btnSecondary} onClick={addRow} disabled={rows.length >= options.max_consumption_months}>
        <Plus className="h-4 w-4" aria-hidden="true" /> {b.addMonth}
      </button>

      <div className="rounded-xl bg-[#f7f9fc] p-4" aria-live="polite" data-testid="bill-averages">
        <p className="font-utility text-sm font-semibold text-[#0e2a63]">{b.averagesTitle}</p>
        {avg && avg.months_recorded > 0 ? (
          <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-[#111827]/55">{b.avgUnits}</dt>
              <dd className="font-utility text-[#111827]/85">{avg.average_monthly_units_kwh == null ? '—' : `${formatKw(avg.average_monthly_units_kwh)} kWh`}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#111827]/55">{b.avgBill}</dt>
              <dd className="font-utility text-[#111827]/85">{formatInr(avg.average_monthly_bill_inr)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#111827]/55">{b.impliedTariff}</dt>
              <dd className="font-utility text-[#111827]/85">{avg.implied_tariff_inr_per_kwh ? fmt(b.perUnit, { amount: formatInr(avg.implied_tariff_inr_per_kwh) }) : '—'}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-1 text-xs text-[#111827]/55">{b.averagesPending}</p>
        )}
      </div>
    </div>
  )
}

// ── Roof (inside the house step, after the location is confirmed) ──────────

export function RoofSurveyFields({
  form,
  onChange,
  options,
  errors,
  common,
  derivedShadowFree,
  sectionsDirty,
}: {
  form: SurveyForm
  onChange: Patch
  options: SurveyOptions
  errors: Errors
  common: CommonCopy
  /** The server's shadow-free area when it derived it from stored sections. */
  derivedShadowFree: number | null
  /** Sections changed since the last save — the derived figure is stale until saved. */
  sectionsDirty: boolean
}) {
  const t = useMessages('survey')
  const r = t.roof
  const yesNo = (name: keyof SurveyForm, label: string) => (
    <YesNoField
      name={name}
      label={label}
      value={form[name] as YesNo}
      onChange={(v) => onChange({ [name]: v } as Partial<SurveyForm>)}
      yes={common.yes}
      no={common.no}
      placeholder={common.placeholder}
      error={errors[name]}
    />
  )
  const obstacles = form.roof_obstacles
  const toggleObstacle = (o: string, on: boolean) => {
    const current = obstacles ?? []
    const next = on ? [...current, o] : current.filter((x) => x !== o)
    // Unticking the last one means "not surveyed yet", not "none" — "None" is its own box.
    onChange({ roof_obstacles: next.length ? options.roof_obstacles.filter((x) => next.includes(x)) : null })
  }
  const sections = form.roof_sections
  const setSection = (i: number, p: Partial<SectionRow>) => onChange({ roof_sections: sections.map((s, j) => (j === i ? { ...s, ...p } : s)) })

  return (
    <div className="space-y-4" data-testid="survey-roof">
      <SectionTitle>{r.title}</SectionTitle>
      {yesNo('roof_accessible', r.accessibleLabel)}
      <FormField label={r.accessNoteLabel} error={errors.roof_access_note}>
        {(p) => <textarea {...p} name="roof_access_note" rows={2} maxLength={1000} className={inputClass(!!errors.roof_access_note)} value={form.roof_access_note} onChange={(e) => onChange({ roof_access_note: e.target.value })} />}
      </FormField>
      <SelectField
        name="roof_material"
        label={r.materialLabel}
        value={form.roof_material}
        onChange={(v) => onChange({ roof_material: v })}
        options={options.roof_materials.map((m) => [m, t.roofMaterials[m] ?? m] as const)}
        placeholder={common.placeholder}
        error={errors.roof_material}
      />
      {form.roof_material === 'other' && (
        <FormField label={r.materialOtherLabel} error={errors.roof_material_other}>
          {(p) => <input {...p} name="roof_material_other" maxLength={200} className={inputClass(!!errors.roof_material_other)} value={form.roof_material_other} onChange={(e) => onChange({ roof_material_other: e.target.value })} />}
        </FormField>
      )}
      <SelectField
        name="roof_orientation"
        label={r.orientationLabel}
        value={form.roof_orientation}
        onChange={(v) => onChange({ roof_orientation: v })}
        options={options.roof_orientations.map((o) => [o, r.orientations[o] ?? o] as const)}
        placeholder={common.placeholder}
        error={errors.roof_orientation}
      />

      <fieldset>
        <legend className={labelClass}>{r.obstaclesLabel}</legend>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <label className="flex min-h-[44px] items-center gap-3 font-utility text-base text-[#111827]/85">
            <input
              type="checkbox"
              name="roof_obstacles_none"
              className="h-5 w-5 rounded border-[#c9d2de] accent-[#0e2a63]"
              checked={Array.isArray(obstacles) && obstacles.length === 0}
              onChange={(e) => onChange({ roof_obstacles: e.target.checked ? [] : null })}
            />
            {r.obstaclesNone}
          </label>
          {options.roof_obstacles.map((o) => (
            <label key={o} className="flex min-h-[44px] items-center gap-3 font-utility text-base text-[#111827]/85">
              <input
                type="checkbox"
                name="roof_obstacles"
                value={o}
                className="h-5 w-5 rounded border-[#c9d2de] accent-[#0e2a63]"
                checked={!!obstacles?.includes(o)}
                onChange={(e) => toggleObstacle(o, e.target.checked)}
              />
              {r.obstacles[o as keyof typeof r.obstacles] ?? o}
            </label>
          ))}
        </div>
        {errors.roof_obstacles && <FieldError message={errors.roof_obstacles} />}
      </fieldset>

      {yesNo('roof_ownership_confirmed', r.ownershipLabel)}
      {/* Asked only when options.conditional says so (roof not owned → tenant NOC). */}
      {conditionalApplies(options, form, 'tenant_noc_available') && yesNo('tenant_noc_available', r.tenantNocLabel)}
      <NumberField name="floors" integer label={r.floorsLabel} value={form.floors} onChange={(v) => onChange({ floors: v })} error={errors.floors} />
      <SelectField
        name="shading_condition"
        label={r.shadingLabel}
        value={form.shading_condition}
        onChange={(v) => onChange({ shading_condition: v })}
        options={SHADING_CONDITIONS.map((s) => [s, t.shading[s]] as const)}
        placeholder={common.placeholder}
        error={errors.shading_condition}
      />

      <div className="space-y-4 border-t border-[#e4e8ee] pt-4">
        <SectionTitle>{r.areaTitle}</SectionTitle>
        <NumberField name="roof_area_sqft" label={r.roofAreaLabel} value={form.roof_area_sqft} onChange={(v) => onChange({ roof_area_sqft: v })} error={errors.roof_area_sqft} />
        <fieldset>
          <legend className={labelClass}>{r.modeLabel}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(['sections', 'direct'] as const).map((mode) => (
              <label
                key={mode}
                className={`flex min-h-[44px] items-center gap-3 rounded-xl border px-3 py-2 font-utility text-base ${form.area_mode === mode ? 'border-[#0e2a63] bg-[#0e2a63]/5' : 'border-[#e4e8ee]'}`}
              >
                <input type="radio" name="area_mode" value={mode} className="h-5 w-5 accent-[#0e2a63]" checked={form.area_mode === mode} onChange={() => onChange({ area_mode: mode })} />
                {mode === 'sections' ? r.modeSections : r.modeDirect}
              </label>
            ))}
          </div>
        </fieldset>

        {form.area_mode === 'sections' ? (
          <div className="space-y-3">
            <p className="text-sm text-[#111827]/65 leading-relaxed">{r.sectionsIntro}</p>
            <ol className="space-y-3">
              {sections.map((s, i) => {
                const err = errors[`roof_sections.${i}`]
                return (
                  <li key={i} className={`rounded-xl border p-3 ${err ? 'border-red-300 bg-red-50/40' : 'border-[#e4e8ee]'}`} data-testid={`roof-section-${i}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-utility text-sm font-semibold text-[#0e2a63]">{fmt(r.sectionHeading, { n: i + 1 })}</p>
                      <button type="button" className={btnIcon} onClick={() => onChange({ roof_sections: sections.filter((_, j) => j !== i) })} aria-label={fmt(r.removeSection, { n: i + 1 })}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <FormField label={r.sectionLabel}>
                          {(p) => <input {...p} maxLength={40} className={inputClass(!!err)} value={s.label} onChange={(e) => setSection(i, { label: e.target.value })} />}
                        </FormField>
                      </div>
                      <NumberField label={r.lengthLabel} value={s.length} onChange={(v) => setSection(i, { length: v })} />
                      <NumberField label={r.widthLabel} value={s.width} onChange={(v) => setSection(i, { width: v })} />
                      <div className="col-span-2">
                        <NumberField label={r.obstacleAreaLabel} value={s.obstacle} onChange={(v) => setSection(i, { obstacle: v })} />
                      </div>
                    </div>
                    {err && <FieldError message={err} />}
                  </li>
                )
              })}
            </ol>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={btnSecondary}
                disabled={sections.length >= options.max_roof_sections}
                onClick={() => onChange({ roof_sections: [...sections, { label: '', length: '', width: '', obstacle: '' }] })}
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> {r.addSection}
              </button>
              <span className="text-xs text-[#111827]/55 font-utility">{fmt(r.maxSections, { max: options.max_roof_sections })}</span>
            </div>
            {errors.roof_sections && <FieldError message={errors.roof_sections} />}
            <p className="rounded-xl bg-[#f7f9fc] px-4 py-3 text-sm text-[#0e2a63] font-utility" aria-live="polite" data-testid="derived-shadow-free">
              {derivedShadowFree != null && !sectionsDirty ? fmt(r.derivedShadowFree, { area: formatKw(derivedShadowFree) }) : r.derivedPending}
            </p>
          </div>
        ) : (
          <NumberField name="shadow_free_area_sqft" label={r.shadowFreeLabel} value={form.shadow_free_area_sqft} onChange={(v) => onChange({ shadow_free_area_sqft: v })} error={errors.shadow_free_area_sqft} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField name="roofs_available_count" integer label={r.roofsAvailableLabel} value={form.roofs_available_count} onChange={(v) => onChange({ roofs_available_count: v })} error={errors.roofs_available_count} />
        <NumberField name="roofs_considered_count" integer label={r.roofsConsideredLabel} value={form.roofs_considered_count} onChange={(v) => onChange({ roofs_considered_count: v })} error={errors.roofs_considered_count} />
      </div>
      {yesNo('future_roof_expansion_planned', r.expansionLabel)}
    </div>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────

export function LayoutStep({
  form,
  onChange,
  options,
  errors,
  common,
}: {
  form: SurveyForm
  onChange: Patch
  options: SurveyOptions
  errors: Errors
  common: CommonCopy
}) {
  const t = useMessages('survey')
  const l = t.layout
  const maxHint = fmt(l.maxDistance, { max: options.distance_max_m })
  return (
    <div className="space-y-4" data-testid="survey-layout">
      <SectionTitle>{l.title}</SectionTitle>
      <SelectField
        name="inverter_location"
        label={l.inverterLocationLabel}
        value={form.inverter_location}
        onChange={(v) => onChange({ inverter_location: v })}
        options={options.inverter_locations.map((x) => [x, l.inverterLocations[x] ?? x] as const)}
        placeholder={common.placeholder}
        error={errors.inverter_location}
      />
      <YesNoField name="indoor_wall_available" label={l.indoorWallLabel} value={form.indoor_wall_available} onChange={(v) => onChange({ indoor_wall_available: v })} yes={common.yes} no={common.no} placeholder={common.placeholder} error={errors.indoor_wall_available} />
      <YesNoField name="water_available" label={l.waterLabel} value={form.water_available} onChange={(v) => onChange({ water_available: v })} yes={common.yes} no={common.no} placeholder={common.placeholder} error={errors.water_available} />
      <NumberField name="distance_panel_to_inverter_m" label={l.panelToInverterLabel} hint={maxHint} value={form.distance_panel_to_inverter_m} onChange={(v) => onChange({ distance_panel_to_inverter_m: v })} error={errors.distance_panel_to_inverter_m} />
      <NumberField name="distance_inverter_to_lt_panel_m" label={l.inverterToLtLabel} hint={maxHint} value={form.distance_inverter_to_lt_panel_m} onChange={(v) => onChange({ distance_inverter_to_lt_panel_m: v })} error={errors.distance_inverter_to_lt_panel_m} />
      <SelectField
        name="distance_method"
        label={l.methodLabel}
        value={form.distance_method}
        onChange={(v) => onChange({ distance_method: v })}
        options={options.distance_methods.map((x) => [x, l.methods[x] ?? x] as const)}
        placeholder={common.placeholder}
        error={errors.distance_method}
      />
    </div>
  )
}
