'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import Link from '@/components/i18n/Link'
import AssociateCataloguePicker from '@/components/associate/AssociateCataloguePicker'
import SerialScanButton from '@/components/execution/SerialScanButton'
import { checkAssociateSerial, useAssociateBulkCreateUnits, useAssociateCreateUnit } from '@/lib/associate/register-api-client'
import {
  MAX_ROWS,
  emptyRow,
  entryErrorOf,
  entryErrorText,
  isDirty,
  mapRowErrors,
  rowErrorsOf,
  toInput,
  validateRow,
  type DraftRow,
  type RowProblem,
} from '@/lib/associate/register-entry'
import type { RegisterWarning, RowError, SerialCheck, UnitCategory } from '@/lib/associate/register-types'
import type { Messages } from '@/lib/i18n/types'
import { readSerialDraft, useSerialDraftWriter } from '@/lib/associate/serial-draft'
import { registerDraftKey, useDraftUserId } from '@/lib/associate/portal-session'
import DateField from '@/components/forms/DateField'

// What survives a discarded tab: the typed values, never a serial-check result.
const storedRow = (r: DraftRow): Record<string, unknown> => {
  const rest: Partial<DraftRow> = { ...r }
  delete rest.key
  delete rest.check
  delete rest.checkState
  return rest
}
const restoredRow = (stored: Record<string, unknown>): DraftRow => ({ ...emptyRow(), ...(stored as Partial<DraftRow>), check: null, checkState: 'idle' })

export type EntryCopy = Messages['associates']['portal']['execution']['register']['entry']
type RegisterCopy = Messages['associates']['portal']['execution']['register']

const field = 'w-full min-h-[44px] rounded-xl border border-[#e4e8ee] bg-white px-3 py-2 text-base focus:border-[#2f5daa] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2f5daa]'
const label = 'mb-1.5 block text-xs uppercase tracking-[0.1em] text-[#111827]/65'
const chip = (on: boolean) =>
  `min-h-[44px] rounded-full border px-4 text-sm font-semibold ${on ? 'border-[#0e2a63] bg-[#0e2a63] text-white' : 'border-[#e4e8ee] bg-white text-[#0e2a63]'}`

const fill = (t: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), t)

/** A serial that is held elsewhere links to the customer only when the backend says the associate may see them. */
export function HeldBy({ held, portalBase, copy }: { held: SerialCheck['held_by']; portalBase: string; copy: EntryCopy }) {
  if (!held || held.onboarding_id == null) return null
  return (
    <Link className="ml-1 underline" href={`${portalBase}/customers/${held.onboarding_id}`}>
      {copy.viewCustomer}
    </Link>
  )
}

/**
 * Serial-number entry for the owning associate: pick a model from the list or
 * say "my model is not listed" and type brand and model as printed (Grid Nova
 * matches it later — the associate is never blocked). Single add and several
 * rows at once, saved all-or-nothing. Warnings are advice, never a block.
 */
export default function RegisterEntry({ onboardingId, portalBase, copy }: { onboardingId: number; portalBase: string; copy: RegisterCopy }) {
  const entry = copy.entry
  const { getToken } = useAuth()
  const createUnit = useAssociateCreateUnit(onboardingId)
  const bulk = useAssociateBulkCreateUnits(onboardingId)
  const { userId } = useDraftUserId()
  const draftKey = registerDraftKey(userId, onboardingId)
  const [restoredRows] = useState(() => readSerialDraft(draftKey, restoredRow))
  const [rows, setRows] = useState<DraftRow[]>(() => restoredRows ?? [emptyRow()])
  useSerialDraftWriter(draftKey, rows, { isDirty, toStored: storedRow })
  const [problems, setProblems] = useState<Record<number, RowProblem[]>>({})
  const [rowErrors, setRowErrors] = useState<Map<number, RowError[]>>(new Map())
  const [looseErrors, setLooseErrors] = useState<RowError[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<RegisterWarning[]>([])
  const [saved, setSaved] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // Typed-in rows that haven't been saved: protect them from a refresh or a closed tab.
  const dirty = rows.some(isDirty)
  const savingRef = useRef(saving)
  useEffect(() => {
    savingRef.current = saving
  })
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      if (!savingRef.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const patch = (key: number, p: Partial<DraftRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)))

  async function runCheck(key: number, raw: string) {
    const serial = raw.trim()
    if (!serial) return
    patch(key, { check: null, checkState: 'checking' })
    try {
      const token = await getToken()
      if (!token) return patch(key, { checkState: 'idle' })
      const result = await checkAssociateSerial(onboardingId, serial, token)
      // Ignore an answer for a serial that has since been edited.
      setRows((rs) => rs.map((r) => (r.key === key && r.serial.trim() === serial ? { ...r, check: result, checkState: 'idle' } : r)))
    } catch {
      setRows((rs) => rs.map((r) => (r.key === key && r.serial.trim() === serial ? { ...r, checkState: 'failed' } : r)))
    }
  }

  async function handleSave() {
    setFormError(null)
    setRowErrors(new Map())
    setLooseErrors([])
    setWarnings([])
    setSaved(null)
    const sent = rows.flatMap((r, i) => (isDirty(r) ? [i] : []))
    const found: Record<number, RowProblem[]> = {}
    sent.forEach((i) => {
      const p = validateRow(rows[i])
      if (p.length) found[i] = p
    })
    setProblems(found)
    if (sent.length === 0) return
    if (Object.keys(found).length > 0) {
      setFormError(entry.validation.fillIn)
      return
    }
    setSaving(true)
    try {
      const inputs = sent.map((i) => toInput(rows[i]))
      // All-or-nothing: a bulk save either stores every row or none.
      const result = inputs.length === 1 ? await createUnit.mutateAsync(inputs[0]) : await bulk.mutateAsync({ units: inputs })
      setSaved(inputs.length)
      setWarnings(result.warnings ?? [])
      setRows([emptyRow()])
      setProblems({})
    } catch (err) {
      const mapped = mapRowErrors(sent, rowErrorsOf(err))
      setRowErrors(mapped.byTableIndex)
      setLooseErrors(mapped.unmapped)
      setFormError(entryErrorOf(err, entry.errors))
    } finally {
      setSaving(false)
    }
  }

  const sentCount = rows.filter(isDirty).length

  return (
    <div className="space-y-4" data-testid="register-entry">
      <div>
        <p className="font-display text-base font-semibold text-[#0e2a63]">{entry.heading}</p>
        <p className="mt-1 text-xs text-[#111827]/60">{entry.intro}</p>
      </div>
      {restoredRows && rows.some(isDirty) && (
        <p role="status" className="rounded-lg bg-[#2f5daa]/10 px-3.5 py-2.5 text-sm text-[#0e2a63]" data-testid="serial-draft-restored">
          {entry.draftRestored}
        </p>
      )}

      {rows.map((r, i) => {
        const id = `unit-${r.key}`
        const has = (p: RowProblem) => problems[i]?.includes(p)
        const err = (p: RowProblem) => (has(p) ? <p role="alert" className="mt-1.5 text-xs text-red-600">{entry.validation[p]}</p> : null)
        const listed = r.category !== 'other' && !r.unlisted
        return (
          <div key={r.key} className="space-y-3 rounded-xl border border-[#e4e8ee] p-3" data-testid="unit-row">
            <div role="group" aria-label={entry.typeLabel} className="flex flex-wrap gap-2">
              {(['module', 'inverter', 'other'] as UnitCategory[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={r.category === c}
                  className={chip(r.category === c)}
                  onClick={() => r.category !== c && patch(r.key, { category: c, equipment: null, unlisted: false, brand: '', model: '', rating: '', dcr: '' })}
                >
                  {copy.category[c]}
                </button>
              ))}
            </div>

            {r.category !== 'other' && (
              <div className="space-y-2">
                {listed ? (
                  <>
                    <AssociateCataloguePicker id={`${id}-search`} category={r.category as Exclude<UnitCategory, 'other'>} value={r.equipment} copy={entry} onChange={(item) => patch(r.key, { equipment: item })} />
                    <button type="button" className="min-h-[44px] text-sm font-semibold text-[#2f5daa] underline" onClick={() => patch(r.key, { unlisted: true, equipment: null })}>
                      {entry.notListed}
                    </button>
                    {err('modelRequired')}
                  </>
                ) : (
                  <div className="space-y-3" data-testid="unlisted-fields">
                    <p className="rounded-lg bg-[#f7f9fc] p-3 text-xs text-[#111827]/70">{entry.notListedNote}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor={`${id}-brand`} className={label}>{entry.brandPrinted}</label>
                        <input id={`${id}-brand`} className={field} maxLength={100} value={r.brand} onChange={(e) => patch(r.key, { brand: e.target.value })} autoComplete="off" />
                        {err('brandRequired')}
                      </div>
                      <div>
                        <label htmlFor={`${id}-model`} className={label}>{entry.modelPrinted}</label>
                        <input id={`${id}-model`} className={field} maxLength={100} value={r.model} onChange={(e) => patch(r.key, { model: e.target.value })} autoComplete="off" />
                        {err('modelPrintedRequired')}
                      </div>
                    </div>
                    <button type="button" className="min-h-[44px] text-sm font-semibold text-[#2f5daa] underline" onClick={() => patch(r.key, { unlisted: false, brand: '', model: '', dcr: '' })}>
                      {entry.chooseFromList}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-serial`} className={label}>{entry.serial}</label>
                <div className="flex gap-2">
                  <input
                    id={`${id}-serial`}
                    className={field}
                    autoComplete="off"
                    value={r.serial}
                    onChange={(e) => patch(r.key, { serial: e.target.value, check: null, checkState: 'idle' })}
                    onBlur={() => void runCheck(r.key, r.serial)}
                  />
                  <SerialScanButton
                    label={entry.scan}
                    cancelLabel={entry.cancelScan}
                    unavailableText={entry.scanUnavailable}
                    onScan={(value) => {
                      patch(r.key, { serial: value, check: null })
                      void runCheck(r.key, value)
                    }}
                  />
                </div>
                {r.checkState === 'checking' && <p role="status" className="mt-1.5 text-xs text-[#111827]/65">{entry.checking}</p>}
                {r.check && (
                  <p data-testid="serial-check" className={`mt-1.5 flex items-start gap-1 text-xs ${r.check.available ? 'text-green-700' : 'text-red-600'}`}>
                    {r.check.available ? <Check className="mt-0.5 h-3 w-3 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />}
                    <span>
                      {/* The backend's associate-safe sentence, exactly as returned. */}
                      {r.check.available ? entry.serialAvailable : r.check.message ?? entry.serialTaken}
                      {!r.check.available && <HeldBy held={r.check.held_by} portalBase={portalBase} copy={entry} />}
                    </span>
                  </p>
                )}
                {r.checkState === 'failed' && <p role="status" className="mt-1.5 text-xs text-amber-800">{entry.checkFailed}</p>}
                {err('serialRequired')}
              </div>

              {r.category !== 'other' && (
                <div>
                  <label htmlFor={`${id}-rating`} className={label}>{r.category === 'module' ? entry.ratingWp : entry.ratingKw}</label>
                  <input id={`${id}-rating`} className={field} inputMode="decimal" value={r.rating} onChange={(e) => patch(r.key, { rating: e.target.value })} />
                  {err('ratingRequired')}
                </div>
              )}
            </div>

            {r.category === 'module' && (
              <div>
                {r.equipment && !r.unlisted ? (
                  <p className="text-xs text-[#111827]/60" data-testid="dcr-locked">{fill(entry.dcrFromList, { value: r.equipment.is_dcr_compliant ? entry.dcrYes : entry.dcrNo })}</p>
                ) : r.unlisted ? (
                  <fieldset data-testid="dcr-declaration">
                    <legend className={label}>{entry.dcrQuestion}</legend>
                    <div className="flex gap-2">
                      {(['yes', 'no'] as const).map((v) => (
                        <button key={v} type="button" aria-pressed={r.dcr === v} className={chip(r.dcr === v)} onClick={() => patch(r.key, { dcr: v })}>
                          {v === 'yes' ? entry.dcrYes : entry.dcrNo}
                        </button>
                      ))}
                    </div>
                    {err('dcrRequired')}
                  </fieldset>
                ) : null}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-ws`} className={label}>{entry.warrantyStart}</label>
                <DateField id={`${id}-ws`} label={entry.warrantyStart} max={r.warrantyEnd || undefined} value={r.warrantyStart} onChange={(v) => patch(r.key, { warrantyStart: v })} />
              </div>
              <div>
                <label htmlFor={`${id}-we`} className={label}>{entry.warrantyEnd}</label>
                <DateField id={`${id}-we`} label={entry.warrantyEnd} min={r.warrantyStart || undefined} value={r.warrantyEnd} onChange={(v) => patch(r.key, { warrantyEnd: v })} />
              </div>
            </div>
            {err('warrantyPair')}

            {(rowErrors.get(i) ?? []).map((e, n) => (
              <p key={n} role="alert" className="text-xs text-red-600" data-testid="row-error">
                {fill(entry.rowError, { row: i + 1, message: entryErrorText(e.code, e.field, e.message, entry.errors) })}
                {e.held_by && <HeldBy held={e.held_by} portalBase={portalBase} copy={entry} />}
              </p>
            ))}

            {rows.length > 1 && (
              <button type="button" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[#111827]/60" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                <Trash2 className="h-3.5 w-3.5" /> {entry.removeRow}
              </button>
            )}
          </div>
        )
      })}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={rows.length >= MAX_ROWS} className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-[#e4e8ee] px-3 text-sm font-semibold text-[#0e2a63] disabled:opacity-50" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
          <Plus className="h-4 w-4" /> {entry.addAnother}
        </button>
        {dirty && <span className="text-xs text-amber-700" data-testid="unsaved-note">{entry.unsaved}</span>}
      </div>

      {looseErrors.map((e, n) => (
        <p key={n} role="alert" className="text-xs text-red-600" data-testid="loose-error">{entryErrorText(e.code, e.field, e.message, entry.errors)}</p>
      ))}
      {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="form-error">{formError}</p>}
      {saved != null && <p role="status" className="text-sm text-green-700">{saved === 1 ? entry.savedOne : fill(entry.savedMany, { count: saved })}</p>}
      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-900" data-testid="register-warnings">
          {warnings.map((w, n) => (
            <li key={n}>{w.code === 'rating_out_of_range' ? entry.warnings.ratingOutOfRange : w.message ?? w.code}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={saving || !dirty}
        onClick={() => void handleSave()}
        className="inline-flex min-h-[44px] items-center rounded-lg bg-[#0e2a63] px-5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? entry.saving : sentCount > 1 ? entry.saveAll : entry.save}
      </button>
    </div>
  )
}
