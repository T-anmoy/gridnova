'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Info, Lock, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate } from '@/lib/dashboard/utils'
import {
  REFERENCE_PENDING,
  SECTION_TITLES,
  canEditSection,
  cleanSectionValue,
  describeSaveOutcome,
  documentError,
  isDocumentSection,
  layoutLabel,
  sameValue,
  sectionOfField,
  sectionValue,
  validateSection,
  type FieldErrors,
} from '@/lib/proposals/document-logic'
import { useEditDocumentSection, useProposalDocument } from '@/lib/proposals/document-api-client'
import {
  isTechnicalDocument,
  type Addressee,
  type BoqRow,
  type Connection,
  type DocumentSection,
  type MissingField,
  type PaymentTerm,
  type Plant,
  type PmSuryaGhar,
  type ProposalDocument,
  type Site,
  type SystemSpec,
} from '@/lib/proposals/document-types'
import { BoqEditor } from './BoqEditor'
import { FixedParts, MissingList, PriceSummary, SessionChanges, focusField, type SessionChange } from './panels'
import { ProposalPreview } from './ProposalPreview'
import { SectionCard } from './SectionCard'
import { AddresseeForm, BulletsForm, ConnectionForm, PaymentTermsForm, PlantForm, PmSuryaGharForm, SiteForm, SystemForm } from './sections'

type Drafts = Partial<Record<DocumentSection, unknown>>

interface Notice {
  id: number
  lines: string[]
}

export interface ProposalDocumentEditorProps {
  proposalId: number
  /** From the proposal detail — compared with the save response to explain a price move. */
  totalValue: number | null | undefined
  requiresSignoff: boolean | undefined
  /** Present when this user may change the price now (Adjust Price lives on the page). */
  onAdjustPrice?: () => void
  onDirtyChange?: (dirty: boolean) => void
  /** The page's "Request revision" action, shown in the locked banner when the role may use it. */
  revisionAction?: React.ReactNode
  /** `missing` from a 409 missing_required on approve / send. */
  serverMissing?: MissingField[] | null
}

export function ProposalDocumentEditor({ proposalId, totalValue, requiresSignoff, onAdjustPrice, onDirtyChange, revisionAction, serverMissing }: ProposalDocumentEditorProps) {
  const { data: view, isLoading, error, refetch } = useProposalDocument(proposalId)
  const editMutation = useEditDocumentSection()

  const [drafts, setDrafts] = useState<Drafts>({})
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<DocumentSection, FieldErrors>>>({})
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<DocumentSection, string>>>({})
  const [conflicts, setConflicts] = useState<Partial<Record<DocumentSection, boolean>>>({})
  const [saving, setSaving] = useState<DocumentSection | null>(null)
  const [notices, setNotices] = useState<Notice[]>([])
  const [changes, setChanges] = useState<SessionChange[]>([])

  const doc = view?.document ?? null
  const technical = isTechnicalDocument(doc)

  const serverOf = useCallback((section: DocumentSection) => (doc ? sectionValue(doc, section) : undefined), [doc])
  const valueOf = (section: DocumentSection) => (section in drafts ? drafts[section] : serverOf(section))
  const isDirty = (section: DocumentSection) => section in drafts && !sameValue(drafts[section], serverOf(section))
  const anyDirty = Object.keys(drafts).some((s) => isDocumentSection(s) && isDirty(s))

  useEffect(() => {
    onDirtyChange?.(anyDirty)
  }, [anyDirty, onDirtyChange])

  const setDraft = (section: DocumentSection, value: unknown) => {
    setDrafts((d) => ({ ...d, [section]: value }))
    // Typing clears that section's client errors; server errors are re-checked on save.
    setFieldErrors((e) => ({ ...e, [section]: {} }))
    setSectionErrors((e) => ({ ...e, [section]: undefined }))
  }

  const discard = (section: DocumentSection) => {
    setDrafts((d) => {
      const next = { ...d }
      delete next[section]
      return next
    })
    setFieldErrors((e) => ({ ...e, [section]: {} }))
    setSectionErrors((e) => ({ ...e, [section]: undefined }))
  }

  async function reload(section: DocumentSection) {
    await refetch()
    discard(section)
    setConflicts((c) => ({ ...c, [section]: false }))
  }

  async function save(section: DocumentSection) {
    if (!view || view.revision == null) return
    const value = cleanSectionValue(section, valueOf(section))
    const clientErrors = validateSection(section, value)
    if (Object.keys(clientErrors).length) {
      setFieldErrors((e) => ({ ...e, [section]: clientErrors }))
      focusField(Object.keys(clientErrors)[0])
      return
    }
    const before = { totalValue, requiresSignoff, layout: view.layout }
    setSaving(section)
    try {
      const res = await editMutation.mutateAsync({ proposalId, base_revision: view.revision, section, value })
      discard(section)
      setConflicts((c) => ({ ...c, [section]: false }))
      const at = new Date().toISOString()
      setChanges((list) => [...res.changes.map((c, i) => ({ id: `${at}-${i}`, section, field: c.field, before: c.before, after: c.after, at })), ...list])
      const lines = describeSaveOutcome(before, res, formatCurrency)
      // A section regenerated by the server while it had unsaved typing here.
      const clobbered = res.regenerated_sections.filter((s) => isDocumentSection(s) && s in drafts && s !== section)
      if (clobbered.length) {
        lines.push(`You still have unsaved changes in ${clobbered.map((s) => SECTION_TITLES[s as DocumentSection]).join(', ')}; the saved version was just regenerated — check it before saving.`)
      }
      if (lines.length) setNotices((n) => [{ id: Date.now(), lines }, ...n].slice(0, 4))
    } catch (err) {
      const info = documentError(err)
      if (info.code === 'stale_version') {
        setConflicts((c) => ({ ...c, [section]: true }))
      } else if (info.field && info.field !== section && sectionOfField(info.field) === section) {
        setFieldErrors((e) => ({ ...e, [section]: { ...(e[section] ?? {}), [info.field as string]: info.message } }))
        focusField(info.field)
      } else if (info.code === 'payment_terms_total') {
        setFieldErrors((e) => ({ ...e, [section]: { ...(e[section] ?? {}), payment_terms: info.message } }))
        focusField('payment_terms')
      } else {
        setSectionErrors((e) => ({ ...e, [section]: info.message }))
      }
      // The proposal may have been approved or its permissions changed meanwhile.
      if (info.code === 'proposal_locked' || info.code === 'field_not_editable' || info.code === 'no_document') void refetch()
    } finally {
      setSaving(null)
    }
  }

  // The document's own list is always current; a 409 from approve / send is shown while
  // the page holds it for this revision. (A preview 409 only says "no price yet".)
  const missing = useMemo(() => (serverMissing?.length ? serverMissing : view?.missing_required ?? []), [serverMissing, view?.missing_required])

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (error || !view) {
    const info = error ? documentError(error) : null
    return (
      <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
        <div>
          <p className="font-utility text-sm font-medium text-red-700">The proposal document could not be loaded.</p>
          {info && <p className="font-utility text-xs text-red-700">{info.message}</p>}
          <Button variant="outline" size="sm" className="mt-2 min-h-11" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }
  if (!view.has_document || !doc) return <NoDocumentNote />

  const locked = !!view.locked
  const readOnlyReason = locked ? 'Locked after approval' : undefined
  const approved = !!view.document_reference
  const full = technical ? null : (doc as ProposalDocument)
  const showPm = !!full && !!((valueOf('pm_surya_ghar') as PmSuryaGhar | undefined)?.subsidy_opted || full.pm_surya_ghar.subsidy_opted)

  const card = (section: DocumentSection, body: (editable: boolean, errors: FieldErrors) => React.ReactNode) => {
    const editable = canEditSection(view, section)
    return (
      <SectionCard
        key={section}
        section={section}
        title={SECTION_TITLES[section]}
        editable={editable}
        dirty={isDirty(section)}
        saving={saving === section}
        error={sectionErrors[section]}
        conflict={!!conflicts[section]}
        draftText={JSON.stringify(valueOf(section), null, 2)}
        onSave={() => void save(section)}
        onDiscard={() => discard(section)}
        onReload={() => void reload(section)}
        readOnlyReason={readOnlyReason}
      >
        {body(editable, fieldErrors[section] ?? {})}
      </SectionCard>
    )
  }

  const form = (
    <div className="space-y-4">
      {technical ? (
        <>
          {card('plant', (editable, errors) => (
            <PlantForm value={valueOf('plant') as Plant} onChange={(v) => setDraft('plant', v)} editable={editable} errors={errors} technical />
          ))}
          {card('system', (editable, errors) => <SystemForm value={valueOf('system') as SystemSpec} onChange={(v) => setDraft('system', v)} editable={editable} errors={errors} />)}
          {card('boq', (editable, errors) => <BoqEditor value={valueOf('boq') as BoqRow[]} onChange={(v) => setDraft('boq', v)} editable={editable} errors={errors} />)}
        </>
      ) : (
        <>
          {card('addressee', (editable, errors) => <AddresseeForm value={valueOf('addressee') as Addressee} onChange={(v) => setDraft('addressee', v)} editable={editable} errors={errors} />)}
          {card('connection', (editable, errors) => <ConnectionForm value={valueOf('connection') as Connection} onChange={(v) => setDraft('connection', v)} editable={editable} errors={errors} />)}
          {card('site', (editable, errors) => <SiteForm value={valueOf('site') as Site} onChange={(v) => setDraft('site', v)} editable={editable} errors={errors} />)}
          {showPm && card('pm_surya_ghar', (editable, errors) => <PmSuryaGharForm value={valueOf('pm_surya_ghar') as PmSuryaGhar} onChange={(v) => setDraft('pm_surya_ghar', v)} editable={editable} errors={errors} />)}
          {card('plant', (editable, errors) => (
            <PlantForm value={valueOf('plant') as Plant} onChange={(v) => setDraft('plant', v)} editable={editable} errors={errors} mountType={full?.mount_type ?? null} />
          ))}
          {card('system', (editable, errors) => <SystemForm value={valueOf('system') as SystemSpec} onChange={(v) => setDraft('system', v)} editable={editable} errors={errors} />)}
          {card('boq', (editable, errors) => <BoqEditor value={valueOf('boq') as BoqRow[]} onChange={(v) => setDraft('boq', v)} editable={editable} errors={errors} />)}
          {card('customer_scope', (editable, errors) => (
            <BulletsForm section="customer_scope" value={valueOf('customer_scope') as string[]} onChange={(v) => setDraft('customer_scope', v)} editable={editable} errors={errors} max={20} addLabel="Add item" itemLabel="Scope item" />
          ))}
          {card('payment_terms', (editable, errors) => (
            <>
              <PriceSummary figures={view.figures} price={full?.price} onAdjust={locked ? undefined : onAdjustPrice} />
              <PaymentTermsForm value={valueOf('payment_terms') as PaymentTerm[]} onChange={(v) => setDraft('payment_terms', v)} editable={editable} errors={errors} payments={view.figures?.payments} />
            </>
          ))}
          {card('notes', (editable, errors) => (
            <BulletsForm section="notes" value={valueOf('notes') as string[]} onChange={(v) => setDraft('notes', v)} editable={editable} errors={errors} max={10} addLabel="Add note" itemLabel="Note" />
          ))}
          <FixedParts signatory={view.signatory} />
        </>
      )}
      <SessionChanges changes={changes} />
    </div>
  )

  return (
    <div className="space-y-4" data-testid="proposal-document-editor">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e4e8ee] bg-white px-4 py-3">
        <Badge variant="outline" data-testid="layout-badge" title="Chosen automatically from the plant capacity">
          {layoutLabel(view.layout)} layout
        </Badge>
        {!technical && (
          <span className="font-utility text-sm text-[#111827]/75" data-testid="document-reference">
            Reference: <span className="font-medium text-[#091c3c]">{view.document_reference ?? REFERENCE_PENDING}</span>
            {view.document_date && <> · Date: <span className="font-medium text-[#091c3c]">{formatDate(view.document_date)}</span></>}
          </span>
        )}
        <span className="font-utility text-xs text-[#111827]/55">The layout follows the capacity; it is never chosen by hand.</span>
      </div>

      {locked && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#091c3c]/15 bg-[#f4f6fa] p-4" data-testid="locked-banner">
          <p className="flex items-center gap-2 font-utility text-sm text-[#091c3c]">
            <Lock className="h-4 w-4" aria-hidden="true" /> This proposal is {view.status === 'sent' ? 'sent' : view.status === 'revision_requested' ? 'waiting for a new draft' : 'approved'} and locked. A change needs a revision and a new approval.
          </p>
          {revisionAction}
        </div>
      )}

      {!locked && missing.length > 0 && <MissingList missing={missing} />}

      {notices.map((n) => (
        <div key={n.id} role="status" className="flex items-start justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3" data-testid="save-notice">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
            <ul className="space-y-1 font-utility text-sm text-blue-900">
              {n.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
          <Button type="button" variant="ghost" size="sm" aria-label="Dismiss" onClick={() => setNotices((list) => list.filter((x) => x.id !== n.id))}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {technical ? (
        <>
          <p className="rounded-lg border border-[#e4e8ee] bg-white px-4 py-3 font-utility text-sm text-[#111827]/70" data-testid="technical-note">
            Technical view: plant, system and bill of quantity. The customer, contact details, price and PDF are not shown to Engineers.
          </p>
          {form}
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {form}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <ProposalPreview proposalId={proposalId} refreshKey={`${view.revision}-${view.status}`} approved={approved} />
          </div>
        </div>
      )}
    </div>
  )
}

export function NoDocumentNote() {
  return (
    <p className="rounded-xl border border-[#e4e8ee] bg-[#f4f6fa] px-4 py-3 font-utility text-sm text-[#111827]/75" data-testid="no-document-note">
      This proposal was created before the new template and cannot be edited here.
    </p>
  )
}
