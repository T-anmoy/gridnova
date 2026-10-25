'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, CircleDashed, Download, FileText, Loader2, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { notAuthenticatedError } from '@/lib/api/http'
import { formatDatetime } from '@/lib/dashboard/utils'
import { formatInr } from '@/lib/money'
import { STAFF_SURVEY_COPY } from '@/lib/dashboard/staff-copy'
import { formatKw, surveyWarningText } from '@/lib/associate/survey'
import { SolarEstimateWithCatalogue } from '@/components/pricing/SolarEstimateResult'
import { fromSurveyEstimate } from '@/lib/pricing/solar-estimate'
import type { SurveyResults, SurveyReviewOutcome, SurveyStatus } from '@/lib/associate/survey-types'
import {
  fetchStaffSurveyReportLink,
  useGenerateSurveyReport,
  useStaffSurvey,
  useStaffSurveyResults,
  useSubmitSurveyReview,
} from '@/lib/dashboard/survey-review-api-client'
import { REVIEW_OUTCOMES, type SubmitSurveyReviewInput } from '@/lib/dashboard/survey-review-types'
import { OUTCOME_LABEL, OUTCOME_VARIANT, REVISIT_FIELDS, humanize, isSurveyReader, isSurveyReviewer, surveyReviewError } from '@/lib/dashboard/survey-review-ui'
import type { Role } from '@/lib/dashboard/types'

const sectionName = (key: string) => (STAFF_SURVEY_COPY.sections as Record<string, string>)[key] ?? humanize(key)
const fieldName = (key: string) => (STAFF_SURVEY_COPY.fields as Record<string, string>)[key] ?? humanize(key)

const selectClass =
  'block w-full min-h-[44px] rounded-lg border border-[#e4e8ee] bg-white px-3 text-base md:text-sm font-utility focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2f5daa]'

// ── Review block (read) ───────────────────────────────────────────────────

function ReviewBlock({ status }: { status: SurveyStatus }) {
  const r = status.review
  if (!r || !r.outcome) return <p className="text-sm text-gray-500" data-testid="review-none">No feasibility review yet.</p>
  return (
    <div className="space-y-2" data-testid="review-block">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={OUTCOME_VARIANT[r.outcome]} data-testid="review-outcome">{OUTCOME_LABEL[r.outcome]}</Badge>
        {r.revised_after_review && <Badge variant="amber">Survey changed since this review</Badge>}
        <span className="text-xs text-gray-500">
          {formatDatetime(r.reviewed_at)}
          {r.reviewed_by ? ` · ${r.reviewed_by}` : ''}
        </span>
      </div>
      {r.notes && <p className="whitespace-pre-wrap text-sm text-gray-700">{r.notes}</p>}
      {r.conditions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500">Conditions</p>
          <ul className="list-disc pl-5 text-sm text-gray-700">{r.conditions.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
      {r.revisit_items.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500">Revisit</p>
          <ul className="list-disc pl-5 text-sm text-gray-700">
            {r.revisit_items.map((it, i) => (
              <li key={i}>
                <span className="font-medium">{sectionName(it.section)}{it.field ? ` › ${fieldName(it.field)}` : ''}</span>: {it.note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Review form (admin, engineer) ─────────────────────────────────────────

interface RevisitDraft { section: string; field: string; note: string }
type FormErrors = { notes?: string; conditions?: string; revisit?: string; items: Record<number, { section?: string; note?: string }> }

function ReviewForm({ onboardingId, status }: { onboardingId: number; status: SurveyStatus }) {
  const submit = useSubmitSurveyReview()
  const [outcome, setOutcome] = useState<SurveyReviewOutcome | ''>('')
  const [notes, setNotes] = useState('')
  const [conditions, setConditions] = useState<string[]>([''])
  const [items, setItems] = useState<RevisitDraft[]>([{ section: '', field: '', note: '' }])
  const [errors, setErrors] = useState<FormErrors>({ items: {} })
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const sections = status.sections.map((s) => s.key)
  const existing = status.review?.outcome
  const notesRequired = outcome === 'revisit_needed' || outcome === 'not_feasible'

  function validate(): FormErrors {
    const e: FormErrors = { items: {} }
    if (notesRequired && !notes.trim()) e.notes = 'Notes are required for this outcome.'
    if (outcome === 'feasible_with_conditions' && !conditions.some((c) => c.trim())) e.conditions = 'Add at least one condition.'
    if (outcome === 'revisit_needed') {
      if (!items.some((i) => i.section || i.note.trim())) e.revisit = 'Add at least one revisit item.'
      items.forEach((it, idx) => {
        if (!it.section && !it.note.trim() && items.length > 1) return
        const ie: { section?: string; note?: string } = {}
        if (!it.section) ie.section = 'Choose a section.'
        if (!it.note.trim()) ie.note = 'Describe what to check again.'
        if (ie.section || ie.note) e.items[idx] = ie
      })
    }
    return e
  }

  function focusFirstInvalid() {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
  }

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setFormError(null)
    if (!outcome) {
      setFormError('Choose an outcome.')
      return
    }
    const e = validate()
    setErrors(e)
    if (e.notes || e.conditions || e.revisit || Object.keys(e.items).length) {
      focusFirstInvalid()
      return
    }
    setConfirmOpen(true)
  }

  function buildInput(): SubmitSurveyReviewInput {
    const input: SubmitSurveyReviewInput = { outcome: outcome as SurveyReviewOutcome }
    if (notes.trim()) input.notes = notes.trim()
    if (outcome === 'feasible_with_conditions') input.conditions = conditions.map((c) => c.trim()).filter(Boolean)
    if (outcome === 'revisit_needed') {
      input.revisit_items = items
        .filter((i) => i.section)
        .map((i) => ({ section: i.section, ...(i.field ? { field: i.field } : {}), note: i.note.trim() }))
    }
    return input
  }

  async function confirm() {
    setConfirmOpen(false)
    try {
      await submit.mutateAsync({ id: onboardingId, input: buildInput() })
      toast.success('Review recorded')
      setOutcome('')
      setNotes('')
      setConditions([''])
      setItems([{ section: '', field: '', note: '' }])
      setErrors({ items: {} })
    } catch (err) {
      setFormError(surveyReviewError(err))
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4 rounded-lg border border-gray-200 p-3" data-testid="review-form">
      <p className="text-sm font-semibold text-[#091c3c]">{existing ? 'Record a new review (replaces the current one)' : 'Record the feasibility review'}</p>
      <fieldset>
        <legend className="mb-1 text-xs font-semibold text-gray-500">Outcome</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {REVIEW_OUTCOMES.map((o) => (
            <label key={o} className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-[#e4e8ee] px-3 text-sm">
              <input type="radio" name="outcome" value={o} checked={outcome === o} onChange={() => { setOutcome(o); setErrors({ items: {} }); setFormError(null) }} className="h-4 w-4 accent-[#0e2a63]" />
              {OUTCOME_LABEL[o]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="review-notes">Notes{notesRequired ? ' (required)' : ' (optional)'}</Label>
        <Textarea
          id="review-notes"
          value={notes}
          maxLength={2000}
          rows={3}
          onChange={(e) => setNotes(e.target.value)}
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={errors.notes ? 'review-notes-error' : undefined}
          className="text-base md:text-sm"
        />
        {errors.notes && <p id="review-notes-error" className="text-xs text-red-600">{errors.notes}</p>}
      </div>

      {outcome === 'feasible_with_conditions' && (
        <fieldset className="space-y-2" aria-describedby={errors.conditions ? 'review-conditions-error' : undefined}>
          <legend className="text-xs font-semibold text-gray-500">Conditions (at least one)</legend>
          {conditions.map((c, i) => (
            <div key={i} className="flex gap-2">
              <Input
                aria-label={`Condition ${i + 1}`}
                value={c}
                maxLength={500}
                aria-invalid={errors.conditions && !c.trim() && i === 0 ? true : undefined}
                onChange={(e) => setConditions((cs) => cs.map((x, j) => (j === i ? e.target.value : x)))}
                className="text-base md:text-sm min-h-[44px]"
              />
              {conditions.length > 1 && (
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove condition ${i + 1}`} className="h-11 w-11 shrink-0" onClick={() => setConditions((cs) => cs.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          ))}
          {errors.conditions && <p id="review-conditions-error" className="text-xs text-red-600">{errors.conditions}</p>}
          {conditions.length < 20 && (
            <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={() => setConditions((cs) => [...cs, ''])}>
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Add condition
            </Button>
          )}
        </fieldset>
      )}

      {outcome === 'revisit_needed' && (
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-gray-500">Revisit items (at least one)</legend>
          {errors.revisit && <p className="text-xs text-red-600" role="alert">{errors.revisit}</p>}
          {items.map((it, i) => {
            const ie = errors.items[i] ?? {}
            const fields = REVISIT_FIELDS[it.section] ?? []
            return (
              <div key={i} className="space-y-2 rounded-lg bg-[#f7f9fc] p-3" data-testid={`revisit-item-${i}`}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`rv-section-${i}`} className="text-xs">Section</Label>
                    <select
                      id={`rv-section-${i}`}
                      value={it.section}
                      aria-invalid={ie.section ? true : undefined}
                      onChange={(e) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, section: e.target.value, field: '' } : x)))}
                      className={selectClass}
                    >
                      <option value="">Choose…</option>
                      {sections.map((s) => <option key={s} value={s}>{sectionName(s)}</option>)}
                    </select>
                    {ie.section && <p className="mt-1 text-xs text-red-600">{ie.section}</p>}
                  </div>
                  <div>
                    <Label htmlFor={`rv-field-${i}`} className="text-xs">Field (optional)</Label>
                    <select id={`rv-field-${i}`} value={it.field} disabled={!fields.length} onChange={(e) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))} className={selectClass}>
                      <option value="">Whole section</option>
                      {fields.map((f) => <option key={f} value={f}>{fieldName(f)}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <Label htmlFor={`rv-note-${i}`} className="text-xs">What to check again</Label>
                  <Input id={`rv-note-${i}`} value={it.note} maxLength={500} aria-invalid={ie.note ? true : undefined} onChange={(e) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} className="text-base md:text-sm min-h-[44px]" />
                  {ie.note && <p className="mt-1 text-xs text-red-600">{ie.note}</p>}
                </div>
                {items.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>
                    <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" /> Remove item
                  </Button>
                )}
              </div>
            )
          })}
          {items.length < 20 && (
            <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={() => setItems((xs) => [...xs, { section: '', field: '', note: '' }])}>
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Add item
            </Button>
          )}
        </fieldset>
      )}

      <div aria-live="polite">{formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700" data-testid="review-error">{formError}</p>}</div>

      <Button type="submit" className="min-h-[44px]" disabled={submit.isPending}>
        {submit.isPending ? 'Saving…' : 'Record review'}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record this review?</DialogTitle>
            <DialogDescription>
              Outcome: {outcome ? OUTCOME_LABEL[outcome] : ''}.{existing ? ' This replaces the current review.' : ''} The owning associate is told by email.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => void confirm()}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}

// ── Report ────────────────────────────────────────────────────────────────

function ReportControls({ onboardingId, status, canGenerate }: { onboardingId: number; status: SurveyStatus; canGenerate: boolean }) {
  const { getToken } = useAuth()
  const generate = useGenerateSurveyReport()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const generatedAt = status.report?.generated_at ?? null
  const hasReview = !!status.review?.outcome

  async function onGenerate() {
    setMessage(null)
    try {
      await generate.mutateAsync(onboardingId)
      toast.success(generatedAt ? 'Report regenerated' : 'Report generated')
    } catch (err) {
      setMessage(surveyReviewError(err))
    }
  }

  async function onDownload() {
    setMessage(null)
    setBusy(true)
    try {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      // Signed links expire: a fresh one on every click.
      const link = await fetchStaffSurveyReportLink(onboardingId, token)
      window.open(link.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setMessage(surveyReviewError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2" data-testid="survey-report">
      <div className="flex flex-wrap items-center gap-2">
        {canGenerate && (
          <Button type="button" variant="outline" size="sm" className="min-h-[44px]" disabled={!hasReview || generate.isPending} onClick={() => void onGenerate()}>
            <FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {generate.isPending ? 'Generating…' : generatedAt ? 'Regenerate report' : 'Generate report'}
          </Button>
        )}
        {generatedAt && (
          <Button type="button" variant="outline" size="sm" className="min-h-[44px]" disabled={busy} onClick={() => void onDownload()}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {busy ? 'Opening…' : 'Download report'}
          </Button>
        )}
      </div>
      {generatedAt ? <p className="text-xs text-gray-500">Generated {formatDatetime(generatedAt)}</p> : <p className="text-xs text-gray-500">{hasReview || !canGenerate ? 'No report generated yet.' : 'Record the review first; the report is built from it.'}</p>}
      <div aria-live="polite">{message && <p role="alert" className="text-sm text-red-700" data-testid="report-error">{message}</p>}</div>
    </div>
  )
}

// ── Live results (an Engineer's carry no `estimate`) ─────────────────────

function ResultsBlock({ results }: { results: SurveyResults }) {
  const est = results.estimate
  // BE-14: the same result the website shows, in English (the dashboard's messages).
  const solar = est ? fromSurveyEstimate(est as unknown as Record<string, unknown>) : null
  const copy = {
    warnings: STAFF_SURVEY_COPY.warnings as Record<string, string>,
    limiting: STAFF_SURVEY_COPY.limiting as Record<string, string>,
    fields: STAFF_SURVEY_COPY.fields as Record<string, string>,
    roofMaterials: STAFF_SURVEY_COPY.roofMaterials as Record<string, string>,
    nocStatuses: STAFF_SURVEY_COPY.nocStatuses as Record<string, string>,
    areaReasons: STAFF_SURVEY_COPY.areaReasons as Record<string, string>,
  }
  return (
    <div className="space-y-2" data-testid="staff-survey-results">
      {results.suggested_kw == null ? (
        <p className="text-sm text-gray-500">Not enough information to size the system yet.</p>
      ) : (
        <p className="text-sm">
          Suggested size <span className="font-semibold text-[#091c3c]">{formatKw(results.suggested_kw)} kW</span>
          {results.limiting_factor && <span className="text-gray-500"> · limited by {copy.limiting[results.limiting_factor] ?? results.limiting_factor}</span>}
        </p>
      )}
      <dl className="grid grid-cols-3 gap-2 text-xs text-gray-600">
        <div><dt>By area</dt><dd className="font-medium">{results.max_by_area_kw == null ? '—' : `${formatKw(results.max_by_area_kw)} kW`}</dd></div>
        <div><dt>By load</dt><dd className="font-medium">{results.max_by_load_kw == null ? '—' : `${formatKw(results.max_by_load_kw)} kW`}</dd></div>
        <div><dt>By usage</dt><dd className="font-medium">{results.recommended_by_usage_kw == null ? '—' : `${formatKw(results.recommended_by_usage_kw)} kW`}</dd></div>
      </dl>
      {results.warnings.length > 0 && (
        <ul className="space-y-1.5">
          {results.warnings.map((w, i) => (
            <li key={`${w.code}-${i}`} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              {surveyWarningText(w, copy)}
            </li>
          ))}
        </ul>
      )}
      {solar ? (
        <div data-testid="staff-survey-estimate" className="pt-2">
          <SolarEstimateWithCatalogue estimate={solar} />
        </div>
      ) : est && est.price_status === 'list_price' && (
        <ul className="text-sm text-gray-700" data-testid="staff-survey-estimate">
          {Object.entries(est.packages).map(([k, p]) => <li key={k}>{p.display_name}: {formatInr(p.final)}</li>)}
        </ul>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────

export default function SurveyPanel({ onboardingId, role }: { onboardingId: number; role: Role | undefined }) {
  const reader = isSurveyReader(role)
  const reviewer = isSurveyReviewer(role)
  const status = useStaffSurvey(onboardingId, reader)
  const results = useStaffSurveyResults(onboardingId, reader && !!status.data)

  if (!reader) return null
  return (
    <Card data-testid="survey-panel">
      <CardHeader>
        <CardTitle className="text-base">Site survey</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {status.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-gray-500" role="status"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading the survey…</p>
        ) : status.error || !status.data ? (
          <DashboardError error={status.error} onRetry={() => void status.refetch()} />
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs text-gray-500">{humanize(status.data.variant)}{status.data.grandfathered || !status.data.required_to_submit ? ' · not required for this customer' : ''}</p>
              <ul className="flex flex-wrap gap-2">
                {status.data.sections.map((s) => (
                  <li key={s.key} data-testid={`panel-section-${s.key}`} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${s.complete ? 'bg-[#0e2a63]/10 text-[#0e2a63]' : 'bg-amber-100 text-amber-900'}`}>
                    {s.complete ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />}
                    {sectionName(s.key)}
                  </li>
                ))}
              </ul>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {(['customer', 'associate'] as const).map((p) => {
                  const sig = status.data!.signatures[p]
                  return (
                    <div key={p} data-testid={`panel-signature-${p}`}>
                      <dt className="text-xs text-gray-500">{p === 'customer' ? 'Customer signature' : 'Associate signature'}</dt>
                      <dd>{sig.signed ? `Signed ${formatDatetime(sig.signed_at)}` : 'Not signed'}</dd>
                    </div>
                  )
                })}
                <div>
                  <dt className="text-xs text-gray-500">Declaration (typed by the customer)</dt>
                  <dd>{status.data.declaration.name ? `${status.data.declaration.name} · ${formatDatetime(status.data.declaration.declared_at)}` : '—'}</dd>
                </div>
              </dl>
            </div>

            {results.data && <ResultsBlock results={results.data} />}

            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-[#091c3c]">Feasibility review</p>
              <ReviewBlock status={status.data} />
              {reviewer ? <ReviewForm onboardingId={onboardingId} status={status.data} /> : <p className="text-xs text-gray-500">Only an engineer or admin can record the review.</p>}
            </div>

            <div className="space-y-2 border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-[#091c3c]">Survey report</p>
              <ReportControls onboardingId={onboardingId} status={status.data} canGenerate={reviewer} />
            </div>

            <p className="text-xs text-gray-500">
              Correction requests are in the <Link className="underline" href="/dashboard/survey-corrections">corrections queue</Link>.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
