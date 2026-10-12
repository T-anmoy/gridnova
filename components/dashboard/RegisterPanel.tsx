'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { readSerialDraft, useSerialDraftWriter } from '@/lib/associate/serial-draft'
import { AlertTriangle, Check, Lock, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ReasonDialog from '@/components/dashboard/ReasonDialog'
import MatchUnitDialog from '@/components/dashboard/MatchUnitDialog'
import CataloguePicker, { type CatalogueItem } from '@/components/execution/CataloguePicker'
import SerialScanButton from '@/components/execution/SerialScanButton'
import {
  checkSerial,
  useBulkCreateUnits,
  useCreateUnit,
  useStaffCatalogue,
  useUpdateUnit,
  useVerifyRegister,
  useVoidUnit,
} from '@/lib/dashboard/register-api-client'
import { REGISTER_ERRORS, registerErrorMessage, rowErrorsOf, unmatchedUnitIdsOf } from '@/lib/dashboard/register-errors'
import { isUnmatched, type StaffRegister, type StaffRegisterUnit } from '@/lib/dashboard/register-staff-types'
import { formatDate } from '@/lib/dashboard/utils'
import type { RegisterUnit, RegisterWarning, RowError, SerialCheck, UnitCategory, UnitInput } from '@/lib/associate/register-types'

const WARNING_TEXT: Record<string, string> = {
  rating_out_of_range: 'The rating looks outside the usual range — please double-check it. (Saved anyway.)',
}
const MAX_ROWS = 200
const field = 'w-full min-h-[44px] rounded-xl border border-[#e4e8ee] bg-white px-3 py-2 text-base focus:border-[#2f5daa] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2f5daa]'

interface DraftRow {
  key: number
  category: UnitCategory
  equipment: CatalogueItem | null
  serial: string
  rating: string
  warranty_start: string
  warranty_end: string
  check: SerialCheck | null
  checkError: string | null
}

let rowKey = 0
const emptyRow = (): DraftRow => ({ key: (rowKey += 1), category: 'module', equipment: null, serial: '', rating: '', warranty_start: '', warranty_end: '', check: null, checkError: null })
const isDirty = (r: DraftRow) => !!(r.serial || r.rating || r.equipment || r.warranty_start || r.warranty_end)
// What survives a discarded tab: the typed values, never a serial-check result.
const storedRow = (r: DraftRow): Record<string, unknown> => {
  const rest: Partial<DraftRow> = { ...r }
  delete rest.key
  delete rest.check
  delete rest.checkError
  return rest
}
const restoredRow = (stored: Record<string, unknown>): DraftRow => ({ ...emptyRow(), ...(stored as Partial<DraftRow>), check: null, checkError: null })

function toInput(r: DraftRow): UnitInput {
  const base: UnitInput = { category: r.category, serial_number: r.serial.trim() }
  if (r.category !== 'other' && r.equipment) base.equipment_id = r.equipment.id
  // Ratings go back exactly as typed, as strings; the DCR flag always comes from the catalogue.
  if (r.category === 'module') {
    base.rating_wp = r.rating.trim()
    if (r.equipment) base.is_dcr = r.equipment.is_dcr_compliant
  }
  if (r.category === 'inverter') base.rating_kw = r.rating.trim()
  if (r.warranty_start && r.warranty_end) {
    base.warranty_start = r.warranty_start
    base.warranty_end = r.warranty_end
  }
  return base
}

function HeldBy({ held }: { held: SerialCheck['held_by'] }) {
  if (!held) return null
  return (
    <span className="ml-1">
      {held.onboarding_id != null ? (
        <Link className="underline" href={`/dashboard/onboardings/${held.onboarding_id}`}>{held.project_reference_id ?? `project ${held.onboarding_id}`}</Link>
      ) : (
        held.project_reference_id ?? null
      )}
    </span>
  )
}

function UnitEntry({ onboardingId, locked, isAdmin }: { onboardingId: number; locked: boolean; isAdmin: boolean }) {
  const { getToken, userId } = useAuth()
  const createUnit = useCreateUnit(onboardingId)
  const bulk = useBulkCreateUnits(onboardingId)
  const draftKey = `gna-register-staff-${userId ?? 'anon'}-${onboardingId}`
  const [restoredRows] = useState(() => readSerialDraft(draftKey, restoredRow))
  const [rows, setRows] = useState<DraftRow[]>(() => restoredRows ?? [emptyRow()])
  useSerialDraftWriter(draftKey, rows, { isDirty, toStored: storedRow })
  const [rowErrors, setRowErrors] = useState<RowError[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<RegisterWarning[]>([])
  const [saved, setSaved] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const moduleCatalogue = useStaffCatalogue('module')
  const inverterCatalogue = useStaffCatalogue('inverter')

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

  // `errors[].row` is the 0-based index of the row in the list that was sent. Rows with no
  // content are not sent, so map back through the sent order to the table row.
  const [sentIndexes, setSentIndexes] = useState<number[]>([])
  const errorsFor = (tableIndex: number) => {
    const sentAt = sentIndexes.indexOf(tableIndex)
    return sentAt < 0 ? [] : rowErrors.filter((e) => e.row === sentAt)
  }

  async function runCheck(r: DraftRow) {
    const serial = r.serial.trim()
    if (!serial) return
    patch(r.key, { check: null, checkError: null })
    try {
      const token = await getToken()
      if (!token) return
      patch(r.key, { check: await checkSerial(onboardingId, serial, token) })
    } catch (err) {
      patch(r.key, { checkError: registerErrorMessage(err) })
    }
  }

  function incomplete(r: DraftRow): boolean {
    if (!r.serial.trim()) return true
    if (r.category !== 'other' && !r.equipment) return true
    if (r.category !== 'other' && !r.rating.trim()) return true
    return false
  }

  async function handleSave() {
    setFormError(null)
    setRowErrors([])
    setWarnings([])
    setSaved(null)
    const filled = rows.filter(isDirty)
    setSentIndexes(rows.flatMap((r, i) => (isDirty(r) ? [i] : [])))
    if (filled.length === 0 || filled.some(incomplete)) {
      setFormError('Fill in the serial number, model and rating for every unit.')
      return
    }
    if (locked && !reason.trim()) {
      setFormError(REGISTER_ERRORS.reason_required)
      return
    }
    setSaving(true)
    try {
      const inputs = filled.map(toInput)
      // All-or-nothing: a bulk save either stores every row or none.
      const result =
        inputs.length === 1 && !locked
          ? await createUnit.mutateAsync(inputs[0])
          : await bulk.mutateAsync({ units: inputs, ...(locked ? { reason: reason.trim() } : {}) })
      setSaved(inputs.length)
      setWarnings(result.warnings ?? [])
      setRows([emptyRow()])
      setReason('')
    } catch (err) {
      const errs = rowErrorsOf(err)
      if (errs.length > 0) setRowErrors(errs)
      setFormError(registerErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (locked && !isAdmin) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500" data-testid="register-locked-note">
        <Lock className="h-4 w-4" /> The register is verified and locked. Only an Admin can change it, with a reason.
      </p>
    )
  }

  return (
    <div className="space-y-4" data-testid="unit-entry">
      <p className="text-sm font-semibold text-gray-800">{locked ? 'Add units (register is locked — reason required)' : 'Add units'}</p>
      {restoredRows && rows.some(isDirty) && (
        <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800" data-testid="serial-draft-restored">
          We restored serial numbers you typed earlier but hadn&apos;t saved yet.
        </p>
      )}
      {rows.map((r, i) => (
        <div key={r.key} className="space-y-3 rounded-xl border border-[#e4e8ee] p-3" data-testid="unit-row">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs uppercase tracking-[0.1em] text-gray-500">
              Type
              <select className={`${field} mt-1.5`} aria-label={`Unit ${i + 1} type`} value={r.category} onChange={(e) => patch(r.key, { category: e.target.value as UnitCategory, equipment: null, rating: '', check: null })}>
                <option value="module">Module</option>
                <option value="inverter">Inverter</option>
                <option value="other">Other</option>
              </select>
            </label>
            {r.category !== 'other' && (
              <CataloguePicker
                id={`unit-${r.key}-model`}
                label="Model"
                value={r.equipment?.id ?? null}
                onChange={(item) => patch(r.key, { equipment: item })}
                source={r.category === 'module' ? moduleCatalogue : inverterCatalogue}
              />
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`unit-${r.key}-serial`} className="mb-1.5 block text-xs uppercase tracking-[0.1em] text-gray-500">Serial number</label>
              <div className="flex gap-2">
                <input
                  id={`unit-${r.key}-serial`}
                  className={field}
                  autoComplete="off"
                  value={r.serial}
                  onChange={(e) => patch(r.key, { serial: e.target.value, check: null, checkError: null })}
                  onBlur={() => void runCheck(r)}
                />
                <SerialScanButton
                  onScan={(value) => {
                    const next = { ...r, serial: value }
                    patch(r.key, { serial: value, check: null })
                    void runCheck(next)
                  }}
                />
              </div>
              {r.check && (
                <p
                  data-testid="serial-check"
                  className={`mt-1.5 flex items-start gap-1 text-xs ${r.check.available ? 'text-green-700' : 'text-red-600'}`}
                >
                  {r.check.available ? <Check className="mt-0.5 h-3 w-3" /> : <AlertTriangle className="mt-0.5 h-3 w-3" />}
                  <span>
                    {r.check.message ?? (r.check.available ? 'Available' : 'Already registered')}
                    {!r.check.available && <HeldBy held={r.check.held_by} />}
                  </span>
                </p>
              )}
              {r.checkError && <p role="alert" className="mt-1.5 text-xs text-red-600">{r.checkError}</p>}
            </div>
            {r.category !== 'other' && (
              <div>
                <label htmlFor={`unit-${r.key}-rating`} className="mb-1.5 block text-xs uppercase tracking-[0.1em] text-gray-500">
                  {r.category === 'module' ? 'Rating (Wp)' : 'Rating (kW)'}
                </label>
                <input id={`unit-${r.key}-rating`} className={field} inputMode="decimal" value={r.rating} onChange={(e) => patch(r.key, { rating: e.target.value })} />
                {r.category === 'module' && r.equipment && (
                  <p className="mt-1.5 text-xs text-gray-500" data-testid="dcr-locked">
                    DCR: <span className="font-semibold">{r.equipment.is_dcr_compliant ? 'Yes' : 'No'}</span> (from the catalogue)
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs uppercase tracking-[0.1em] text-gray-500">
              Warranty start (optional)
              <input type="date" className={`${field} mt-1.5`} aria-label={`Unit ${i + 1} warranty start`} value={r.warranty_start} onChange={(e) => patch(r.key, { warranty_start: e.target.value })} />
            </label>
            <label className="text-xs uppercase tracking-[0.1em] text-gray-500">
              Warranty end (optional)
              <input type="date" className={`${field} mt-1.5`} aria-label={`Unit ${i + 1} warranty end`} value={r.warranty_end} onChange={(e) => patch(r.key, { warranty_end: e.target.value })} />
            </label>
          </div>
          {errorsFor(i).map((e, n) => (
            <p key={n} role="alert" className="text-xs text-red-600" data-testid="row-error">
              Row {sentIndexes[e.row] + 1}: {REGISTER_ERRORS[e.code] ?? e.message}
              {e.held_by && <HeldBy held={e.held_by} />}
            </p>
          ))}
          {rows.length > 1 && (
            <Button variant="outline" size="sm" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
              <Trash2 className="mr-1 h-3 w-3" /> Remove this row
            </Button>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" disabled={rows.length >= MAX_ROWS} onClick={() => setRows((rs) => [...rs, emptyRow()])}>
          <Plus className="mr-1 h-3 w-3" /> Add another unit
        </Button>
        {dirty && <span className="text-xs text-amber-700" data-testid="unsaved-note">Unsaved units — they are lost if you leave this page.</span>}
      </div>
      {locked && (
        <div>
          <label htmlFor="register-reason" className="mb-1.5 block text-xs uppercase tracking-[0.1em] text-gray-500">Reason (required) *</label>
          <input id="register-reason" className={field} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}
      {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
      {saved != null && <p role="status" className="text-sm text-green-700">Saved {saved} unit{saved === 1 ? '' : 's'}.</p>}
      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-900" data-testid="register-warnings">
          {warnings.map((w, n) => <li key={n}>{WARNING_TEXT[w.code] ?? w.message ?? w.code}</li>)}
        </ul>
      )}
      <Button disabled={saving || !dirty} onClick={() => void handleSave()}>
        {saving ? 'Saving…' : rows.filter(isDirty).length > 1 ? 'Save all units' : 'Save unit'}
      </Button>
    </div>
  )
}

function EditUnitDialog({ onboardingId, unit, locked, onClose }: { onboardingId: number; unit: RegisterUnit; locked: boolean; onClose: () => void }) {
  const update = useUpdateUnit(onboardingId)
  const [serial, setSerial] = useState(unit.serial_number)
  const [rating, setRating] = useState((unit.category === 'module' ? unit.rating_wp : unit.rating_kw) ?? '')
  const [start, setStart] = useState(unit.warranty_start ?? '')
  const [end, setEnd] = useState(unit.warranty_end ?? '')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setError(null)
    setBusy(true)
    try {
      await update.mutateAsync({
        unitId: unit.unit_id,
        patch: {
          serial_number: serial.trim(),
          ...(unit.category === 'module' ? { rating_wp: rating.trim() } : unit.category === 'inverter' ? { rating_kw: rating.trim() } : {}),
          ...(start && end ? { warranty_start: start, warranty_end: end } : {}),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
      })
      onClose()
    } catch (err) {
      setError(registerErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit unit {unit.serial_number}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">Serial number<input className={`${field} mt-1`} value={serial} onChange={(e) => setSerial(e.target.value)} /></label>
          {unit.category !== 'other' && (
            <label className="block text-sm">{unit.category === 'module' ? 'Rating (Wp)' : 'Rating (kW)'}<input className={`${field} mt-1`} inputMode="decimal" value={rating} onChange={(e) => setRating(e.target.value)} /></label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">Warranty start<input type="date" className={`${field} mt-1`} value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="block text-sm">Warranty end<input type="date" className={`${field} mt-1`} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
          <label className="block text-sm">{locked ? 'Reason (required — register is locked) *' : 'Reason (optional)'}<input className={`${field} mt-1`} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || (locked && !reason.trim())} onClick={() => void save()}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Staff view of the serial register: units (with the staff-only
 * `previously_voided` signal), capacity / DCR advice, entry (single and bulk,
 * all-or-nothing), edit, void, and the verify-and-lock action. Writes are
 * Operations and Admin; once verified only an Admin, with a reason, may change it.
 */
export default function RegisterPanel({
  onboardingId,
  register,
  canWrite,
  isAdmin,
}: {
  onboardingId: number
  register: StaffRegister
  canWrite: boolean
  isAdmin: boolean
}) {
  const verify = useVerifyRegister(onboardingId)
  const voidUnit = useVoidUnit(onboardingId)
  const [editing, setEditing] = useState<RegisterUnit | null>(null)
  const [voiding, setVoiding] = useState<RegisterUnit | null>(null)
  const [matching, setMatching] = useState<StaffRegisterUnit | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Unit ids a refused verify named; only those still unmatched stay highlighted.
  const [refusedIds, setRefusedIds] = useState<number[]>([])
  const locked = !!register.verified_at
  // Unmatched units first — they are what blocks verification.
  const live = register.units
    .filter((u) => u.status !== 'voided')
    .sort((a, b) => Number(isUnmatched(b)) - Number(isUnmatched(a)))
  const unmatchedCount = live.filter(isUnmatched).length
  const highlighted = new Set(live.filter((u) => isUnmatched(u) && refusedIds.includes(u.unit_id)).map((u) => u.unit_id))
  const makeNotInPackage = register.flags.includes('make_not_in_package') || register.units.some((u) => u.flags?.includes('make_not_in_package'))
  const previouslyVoided = register.flags.includes('previously_voided') || register.units.some((u) => u.previously_voided)

  async function handleVerify() {
    setNotice(null)
    setRefusedIds([])
    try {
      await verify.mutateAsync()
      setNotice('Register verified and locked.')
    } catch (err) {
      const ids = unmatchedUnitIdsOf(err)
      if (ids) {
        setRefusedIds(ids)
        const serials = ids.map((id) => register.units.find((u) => u.unit_id === id)?.serial_number ?? `unit ${id}`)
        setNotice(`${REGISTER_ERRORS.units_unmatched} Still waiting for a match: ${serials.join(', ')}.`)
      } else {
        setNotice(registerErrorMessage(err))
      }
    }
  }

  return (
    <Card data-testid="register-panel">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Serial register</CardTitle>
          {locked ? <Badge variant="green" data-testid="register-verified"><Lock className="mr-1 h-3 w-3" /> Verified · locked {formatDate(register.verified_at)}</Badge> : <Badge variant="gray">Not verified</Badge>}
          {previouslyVoided && <Badge variant="orange" data-testid="previously-voided-flag">Contains a previously voided serial</Badge>}
          {makeNotInPackage && <Badge variant="amber" data-testid="make-not-in-package-flag">Contains a make outside the package (advice only)</Badge>}
          {canWrite && !locked && live.length > 0 && (
            <Button size="sm" className="ml-auto" disabled={verify.isPending} onClick={() => void handleVerify()}>Verify register</Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice && <p role="status" className="text-sm text-gray-700">{notice}</p>}
        {unmatchedCount > 0 && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900" data-testid="unmatched-summary">
            {unmatchedCount} unit{unmatchedCount === 1 ? '' : 's'} not matched to the catalogue yet. The register can’t be verified until each is matched.
          </p>
        )}

        <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4" data-testid="register-totals">
          <div><dt className="text-gray-500">Modules</dt><dd className="font-semibold">{register.totals.modules}</dd></div>
          <div><dt className="text-gray-500">Inverters</dt><dd className="font-semibold">{register.totals.inverters}</dd></div>
          <div><dt className="text-gray-500">Module capacity</dt><dd className="font-semibold">{register.capacity.installed_module_kw} kW{register.capacity.requested_kw ? ` of ${register.capacity.requested_kw} kW requested` : ''}</dd></div>
          <div><dt className="text-gray-500">Inverter capacity</dt><dd className="font-semibold">{register.totals.inverter_kw} kW</dd></div>
        </dl>

        {register.capacity.mismatch && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900" data-testid="capacity-advice">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Installed module capacity is more than {String(register.capacity.tolerance_percent)}% from the requested capacity. Advice only — it doesn’t block anything.
          </p>
        )}
        {register.dcr.mismatch && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900" data-testid="dcr-advice">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {register.dcr.override
              ? `DCR mismatch — override recorded by ${register.dcr.override.by}: ${register.dcr.override.reason}`
              : 'This PM Surya Ghar project has a non-DCR module. The subsidy claim is blocked until an Admin records an override.'}
          </p>
        )}

        {live.length === 0 ? (
          <p className="text-sm text-gray-500">No units entered yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-[#e4e8ee]" aria-label="Units">
            {live.map((u) => (
              <li
                key={u.unit_id}
                className={`flex flex-wrap items-center gap-2 px-3 py-2 text-sm ${highlighted.has(u.unit_id) ? 'bg-amber-50 ring-2 ring-inset ring-amber-400' : ''}`}
                data-testid="register-unit"
                data-highlighted={highlighted.has(u.unit_id) ? 'true' : undefined}
              >
                <span className="font-mono font-semibold">{u.serial_number}</span>
                <Badge variant="secondary">{u.category}</Badge>
                {u.category === 'module' && u.is_dcr != null && <Badge variant={u.is_dcr ? 'green' : 'amber'}>{u.is_dcr ? 'DCR' : 'Non-DCR'}</Badge>}
                <Badge variant={u.status === 'verified' ? 'green' : 'gray'}>{u.status}</Badge>
                {u.previously_voided && <Badge variant="orange" data-testid="unit-previously-voided">Previously voided</Badge>}
                {isUnmatched(u) && <Badge variant="amber" data-testid="unit-unmatched">Needs catalogue match</Badge>}
                {u.flags?.includes('make_not_in_package') && (
                  <Badge variant="amber" data-testid="unit-make-not-in-package">Make not in package</Badge>
                )}
                {(u.equivalent_reason ?? u.equipment?.equivalent_reason) && (
                  <span className="text-xs italic text-gray-500" data-testid="unit-equivalent-reason">Equivalent: {u.equivalent_reason ?? u.equipment?.equivalent_reason}</span>
                )}
                <span className="text-xs text-gray-500">
                  {u.equipment ? `${u.equipment.brand} ${u.equipment.model_name}` : [u.brand_as_printed, u.model_as_printed].filter(Boolean).length ? `As printed: ${[u.brand_as_printed, u.model_as_printed].filter(Boolean).join(' ')}` : ''}
                  {u.rating_wp ? ` · ${u.rating_wp} Wp` : ''}
                  {u.rating_kw ? ` · ${u.rating_kw} kW` : ''}
                </span>
                {u.equipment?.is_placeholder && <Badge variant="orange" data-testid="dummy-chip">Dummy / pending Grid Nova</Badge>}
                {canWrite && (!locked || isAdmin) && (
                  <span className="ml-auto flex gap-2">
                    {isUnmatched(u) && u.category !== 'other' && <Button size="sm" onClick={() => setMatching(u)}>Match</Button>}
                    <Button size="sm" variant="outline" onClick={() => setEditing(u)}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => setVoiding(u)}>Void</Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {canWrite && <UnitEntry onboardingId={onboardingId} locked={locked} isAdmin={isAdmin} />}
      </CardContent>

      {matching && <MatchUnitDialog onboardingId={onboardingId} unit={matching} locked={locked} onClose={() => setMatching(null)} />}
      {editing && <EditUnitDialog onboardingId={onboardingId} unit={editing} locked={locked} onClose={() => setEditing(null)} />}
      <ReasonDialog
        open={!!voiding}
        onOpenChange={(o) => !o && setVoiding(null)}
        title={voiding ? `Void ${voiding.serial_number}` : 'Void unit'}
        description="A voided unit stays on record but no longer counts. Its serial number is flagged if it is entered again."
        label="Reason"
        required
        destructive
        confirmLabel="Void unit"
        describeError={registerErrorMessage}
        onConfirm={(reason) => voidUnit.mutateAsync({ unitId: voiding!.unit_id, reason })}
      />
    </Card>
  )
}
