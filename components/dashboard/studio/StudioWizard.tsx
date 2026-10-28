'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, FileCheck2, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/dashboard/utils'
import { studioApi, studioKeys, useStudioToken } from '@/lib/studio/api'
import { APPROVAL_REASON_LABEL, WIZARD_STEPS, groupChecks, isWizardStep, stepOfField, studioError, type WizardStepId } from '@/lib/studio/logic'
import { useStudioAutosave } from '@/lib/studio/use-autosave'
import type { AssistantSuggestion, StudioOptions, StudioView } from '@/lib/studio/types'
import { AssistantBox } from './AssistantBox'
import { FiguresSummary } from './FiguresSummary'
import { ProofCheck } from './ProofCheck'
import { StudioPreview } from './StudioPreview'
import { Notice, SaveIndicator, StatusChip, focusStudioField } from './ui'
import { StepCustomer, StepPrice, StepProject, StepSite, StepSystem, StepTerms, type StepProps } from './WizardSteps'

// The guided edit: one page, a stepper (left on wide screens, on top on phones), autosave on
// every field. The last step shows the live PDF beside the proof-check and the one button the
// API allows next: "Issue proposal" or "Send for approval".

const SECTION_NAMES: Record<string, string> = {
  boq: 'the bill of quantities',
  customer_scope: 'what the customer provides',
  payment_terms: 'the payment terms',
}

export function StudioWizard({ view, options }: { view: StudioView; options: StudioOptions }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const qc = useQueryClient()
  const token = useStudioToken()
  const id = view.proposal.id
  const auto = useStudioAutosave(id, view)
  const step: WizardStepId = isWizardStep(sp.get('step')) ? (sp.get('step') as WizardStepId) : 'customer'
  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === step)
  const can = view.can
  const editable = !!can?.edit
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // After a stale_version reload the forms are rebuilt from the server's data (the hook tells the person).
  const reloads = auto.reloadCount
  const headingRef = useRef<HTMLHeadingElement>(null)

  async function goTo(next: WizardStepId, field?: string) {
    await auto.flush()
    const q = new URLSearchParams(sp.toString())
    q.set('step', next)
    router.replace(`${pathname}?${q.toString()}`, { scroll: false })
    if (field) focusStudioField(field)
    else requestAnimationFrame(() => headingRef.current?.focus())
  }

  const groups = groupChecks(view)
  const stepFlags = (s: WizardStepId) => ({
    error: groups.errors.some((c) => stepOfField(c.field) === s && s !== 'review') || view.missing_required.some((m) => stepOfField(m.field) === s),
    warn: groups.warnings.some((w) => !w.acknowledged && stepOfField(w.field) === s && s !== 'review'),
  })

  async function act(name: string, fn: () => Promise<StudioView>, after?: (v: StudioView) => void) {
    setBusy(name)
    setActionError(null)
    try {
      await auto.flush()
      const v = await fn()
      qc.setQueryData(studioKeys.proposal(id), v)
      void qc.invalidateQueries({ queryKey: ['studio', 'proposals'] })
      void qc.invalidateQueries({ queryKey: ['studio', 'summary'] })
      after?.(v)
    } catch (e) {
      const info = studioError(e)
      setActionError(info.message)
      if (['proof_check_failed', 'warnings_unacknowledged', 'unknown_warning', 'invalid_status', 'approval_required'].includes(info.code ?? '')) {
        void qc.invalidateQueries({ queryKey: studioKeys.proposal(id) })
      }
    } finally {
      setBusy(null)
    }
  }

  const acceptSuggestion = (s: AssistantSuggestion) => {
    const current = auto.value(s.section, view.document[s.section]) as unknown as Record<string, unknown>
    auto.edit(s.section, { ...current, [s.field]: s.value })
  }

  const props: StepProps = { view, options, auto, editable, canPrice: !!can?.price }
  const assistant = options.assistant_enabled && editable && (step === 'customer' || step === 'site' || step === 'project')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-utility text-xs text-[#111827]/60">
            <Link href="/dashboard/studio/proposals" className="hover:underline">Studio proposals</Link> / {view.proposal.code} · version {view.version.version}
          </p>
          <h1 className="mt-0.5 font-display text-xl font-bold text-[#091c3c] md:text-2xl">{view.proposal.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusChip status={view.version.status} />
            {editable && <SaveIndicator state={auto.state} />}
          </div>
        </div>
        <Link href={`/dashboard/studio/proposals/${id}?view=overview`} className="inline-flex min-h-11 items-center font-utility text-sm text-[#0e2a63] hover:underline">
          Timeline and versions
        </Link>
      </div>

      {!editable && <Notice tone="info">You can look at this proposal but not change it.</Notice>}
      {view.version.status === 'draft' && view.version.approval_comment && (
        <Notice tone="warn" testId="sent-back">Sent back by the approver: “{view.version.approval_comment}”</Notice>
      )}
      {auto.outcome?.approvalCleared && <Notice tone="warn" testId="approval-cleared">The proposal changed after it was sent for approval, so it is back to draft and needs approval again.</Notice>}
      {auto.outcome && auto.outcome.regenerated.length > 0 && (
        <Notice tone="info" testId="regenerated">
          Updated to match the plant: {auto.outcome.regenerated.map((s) => SECTION_NAMES[s] ?? s).join(', ')}. (You have not changed these, so they follow the plant.)
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
        {/* Stepper: a scrolling row on phones, a column on wide screens. */}
        <nav aria-label="Steps" className="lg:sticky lg:top-4 lg:self-start">
          <ol className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0" data-testid="wizard-steps">
            {WIZARD_STEPS.map((s, i) => {
              const flags = stepFlags(s.id)
              const current = s.id === step
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => void goTo(s.id)}
                    aria-current={current ? 'step' : undefined}
                    data-testid={`step-${s.id}`}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#f7a800]',
                      current ? 'bg-[#091c3c] text-white' : 'text-[#091c3c] hover:bg-white',
                    )}
                  >
                    <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-utility text-xs font-semibold', current ? 'bg-[#f7a800] text-[#091c3c]' : 'bg-[#e4e8ee] text-[#091c3c]')}>{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block whitespace-nowrap font-utility text-sm font-medium">{s.title}</span>
                      <span className={cn('hidden font-utility text-[11px] lg:block', current ? 'text-white/70' : 'text-[#111827]/55')}>{s.hint}</span>
                    </span>
                    {flags.error ? (
                      <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-red-600" aria-label="has something to fix" />
                    ) : flags.warn ? (
                      <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-label="has something to check" />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="min-w-0 space-y-4">
          <section className="rounded-xl border border-[#e4e8ee] bg-white p-4 md:p-6" aria-labelledby="step-title">
            <h2 id="step-title" ref={headingRef} tabIndex={-1} className="font-display text-lg font-semibold text-[#091c3c] outline-none">
              {stepIndex + 1}. {WIZARD_STEPS[stepIndex].title}
            </h2>
            <p className="mb-4 font-utility text-sm text-[#111827]/60">{WIZARD_STEPS[stepIndex].hint}</p>
            {assistant && (
              <div className="mb-4">
                <AssistantBox proposalId={id} sections={step === 'customer' ? ['addressee'] : step === 'site' ? ['site', 'connection'] : ['connection']} onAccept={acceptSuggestion} />
              </div>
            )}
            {step === 'customer' && <StepCustomer key={reloads} {...props} />}
            {step === 'project' && <StepProject key={reloads} {...props} />}
            {step === 'site' && <StepSite key={reloads} {...props} />}
            {step === 'system' && <StepSystem key={reloads} {...props} />}
            {step === 'price' && <StepPrice key={reloads} {...props} />}
            {step === 'terms' && <StepTerms key={reloads} {...props} />}
            {step === 'review' && <ReviewSummary view={view} />}
          </section>

          {step === 'review' && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
              <div className="space-y-4">
                <ProofCheck
                  view={view}
                  editable={editable}
                  busy={busy}
                  onGoTo={(field) => void goTo(stepOfField(field), field)}
                  onAcknowledge={(fps) => void act(fps.length === 1 ? fps[0] : 'ack-all', () => studioApi.acknowledge(token, id, fps))}
                  onIgnoreWord={(w) => void act(`ignore-${w}`, () => studioApi.ignoreWord(token, id, w))}
                />
                <NextAction view={view} busy={busy} allClear={groups.allClear} onSubmit={() => void act('submit', () => studioApi.submit(token, id))} onIssue={() => void act('issue', () => studioApi.issue(token, id), (v) => {
                  const url = (v as StudioView & { public_url?: string }).public_url
                  if (url) qc.setQueryData(['studio', 'public-url', id], url)
                  toast.success('Issued. The customer’s link is ready to send.')
                  router.push(`/dashboard/studio/proposals/${id}?view=overview&issued=1`)
                })} />
                {actionError && <Notice tone="error" testId="action-error">{actionError}</Notice>}
              </div>
              <StudioPreview proposalId={id} refreshKey={view.revision} />
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" className="min-h-11" disabled={stepIndex === 0} onClick={() => void goTo(WIZARD_STEPS[stepIndex - 1].id)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
            </Button>
            {stepIndex < WIZARD_STEPS.length - 1 && (
              <Button type="button" className="min-h-11" onClick={() => void goTo(WIZARD_STEPS[stepIndex + 1].id)} data-testid="next-step">
                Next: {WIZARD_STEPS[stepIndex + 1].title} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ReviewSummary({ view }: { view: StudioView }) {
  const d = view.document
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <dl className="space-y-2 font-utility text-sm">
        <div>
          <dt className="text-xs text-[#111827]/60">Customer</dt>
          <dd className="text-[#091c3c]">{[d.addressee.title, d.addressee.name].filter(Boolean).join(' ') || '—'}{d.addressee.mobile ? ` · ${d.addressee.mobile}` : ''}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#111827]/60">Site</dt>
          <dd className="text-[#091c3c]">{[d.site.town, d.site.state].filter(Boolean).join(', ') || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#111827]/60">Validity</dt>
          <dd className="text-[#091c3c]">{d.validity_days} days from the day it is issued</dd>
        </div>
        {view.missing_required.length > 0 && (
          <div>
            <dt className="text-xs text-red-700">Still needed</dt>
            <dd className="text-red-800">{view.missing_required.map((m) => m.message).join('; ')}</dd>
          </div>
        )}
      </dl>
      <FiguresSummary figures={view.figures} compact />
    </div>
  )
}

function NextAction({ view, busy, allClear, onSubmit, onIssue }: { view: StudioView; busy: string | null; allClear: boolean; onSubmit: () => void; onIssue: () => void }) {
  const can = view.can
  const status = view.version.status
  if (status === 'pending_approval') {
    return (
      <Notice tone="info" testId="waiting-approval">
        <p className="font-medium">Waiting for approval by an Admin or Management.</p>
        <p className="mt-0.5 text-xs">They are told by email. Any change you make now sends it back to draft.</p>
        {can?.approve && (
          <Link href={`/dashboard/studio/proposals/${view.proposal.id}/review`} className="mt-2 inline-flex min-h-11 items-center font-semibold underline">
            Review it now
          </Link>
        )}
      </Notice>
    )
  }
  if (!can?.edit) return null
  const reasons = view.approval_reasons.map((r) => APPROVAL_REASON_LABEL[r] ?? r)
  const needsApproval = view.approval_required && status === 'draft'
  // Errors staff can fix come first; wording Grid Nova has not supplied is not theirs to fix,
  // so once only that is left the reason names it plainly (FE-19 second pass).
  // (Each blocker is also one of the proof-check's errors, as the BE-18 views show.)
  const fixable = view.errors - view.content_blockers.length
  const blockedWhy = fixable > 0 ? 'Fix the items in red first.' : !allClear ? 'Tick “I have checked this” on each amber warning first.' : null

  return (
    <div className="space-y-2 rounded-xl border border-[#e4e8ee] bg-white p-4" data-testid="next-action">
      {needsApproval ? (
        <>
          <p className="font-utility text-sm text-[#111827]/75">It needs a second person’s approval: {reasons.join('; ').toLowerCase()}.</p>
          <Button type="button" className="min-h-12 w-full text-base" disabled={!can.submit || !allClear || !!busy} onClick={onSubmit} data-testid="send-for-approval">
            {busy === 'submit' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Send for approval
          </Button>
        </>
      ) : (
        <>
          {status === 'ready' && view.version.approved_by && (
            <p className="flex items-center gap-1.5 font-utility text-sm text-green-800"><Check className="h-4 w-4" /> Approved{view.version.approval_comment ? ` — “${view.version.approval_comment}”` : ''}</p>
          )}
          <Button type="button" className="min-h-12 w-full text-base" disabled={!can.issue || !allClear || !!busy} onClick={onIssue} data-testid="issue-proposal">
            {busy === 'issue' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />} Issue proposal
          </Button>
          <p className="font-utility text-xs text-[#111827]/60">Gives it its reference number and date, makes the final PDF and the customer’s link. It cannot be changed afterwards — only revised.</p>
        </>
      )}
      {blockedWhy && <p className="font-utility text-xs text-amber-800" data-testid="blocked-why">{blockedWhy}</p>}
      {view.content_blockers.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 font-utility text-sm text-amber-900" role="status" data-testid="not-ready-to-issue">
          <p className="font-semibold">Not ready to issue yet</p>
          <p className="mt-1">You can draft and preview this proposal, but it cannot be sent for approval or issued until Grid Nova supplies:</p>
          <ul className="mt-1 list-disc pl-5">
            {view.content_blockers.map((b) => <li key={b.registry}>{b.message} ({b.registry})</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
