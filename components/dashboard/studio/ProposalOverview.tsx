'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookmarkPlus,
  CheckCircle2,
  Copy,
  CopyPlus,
  Download,
  FilePen,
  GitCompare,
  Loader2,
  Mail,
  MessageCircle,
  PencilLine,
  Stamp,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import DateField from '@/components/forms/DateField'
import { formatDate } from '@/lib/dashboard/utils'
import { usePermissions } from '@/lib/access/use-permissions'
import { studioApi, studioKeys, useStudioCustomer, useStudioEvents, useStudioToken, useVersionDiff } from '@/lib/studio/api'
import { diffValue, eventLabel, eventNote, fieldLabel, isEditableStatus, isWhatsappLink, kwpText, lastIssuedBefore, studioError, timeline, todayIst, validityText } from '@/lib/studio/logic'
import type { StudioView } from '@/lib/studio/types'
import { FiguresSummary } from './FiguresSummary'
import { StudioPreview } from './StudioPreview'
import { INPUT, Notice, Panel, StatusChip, TextInput } from './ui'

const dateTime = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const at = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : '—')

type DialogName = 'email' | 'accepted' | 'lost' | 'revise' | 'duplicate' | 'convert' | 'template' | null

export function ProposalOverview({ view, justIssued }: { view: StudioView; justIssued: boolean }) {
  const router = useRouter()
  const qc = useQueryClient()
  const token = useStudioToken()
  const { can: perm } = usePermissions()
  const id = view.proposal.id
  const can = view.can
  const events = useStudioEvents(id)
  const customer = useStudioCustomer(view.proposal.customer?.id ?? null)
  // The customer's link: returned once by issue; later from the WhatsApp-link route.
  const cachedLink = useQuery<string | null>({ queryKey: ['studio', 'public-url', id], queryFn: () => null, enabled: false, initialData: null })
  const [dialog, setDialog] = useState<DialogName>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [compare, setCompare] = useState<{ a: number; b: number } | null>(null)

  const v = view.version
  const issued = !!v.issued_at
  const current = v.version === view.proposal.current_version
  const editableNow = isEditableStatus(v.status) && can?.edit && current

  /** One action. From a dialog (`inDialog`), a refusal is shown in the dialog, not on the page. */
  async function run<T>(name: string, fn: () => Promise<T>, after?: (r: T) => void, inDialog = false) {
    setBusy(name)
    setError(null)
    try {
      const r = await fn()
      if (r && typeof r === 'object' && 'proposal' in r) qc.setQueryData(studioKeys.proposal(id), r)
      void qc.invalidateQueries({ queryKey: studioKeys.events(id) })
      void qc.invalidateQueries({ queryKey: ['studio', 'proposals'] })
      void qc.invalidateQueries({ queryKey: ['studio', 'summary'] })
      after?.(r)
      return r
    } catch (e) {
      if (!inDialog) setError(studioError(e).message)
      throw e
    } finally {
      setBusy(null)
    }
  }

  async function link(): Promise<string | null> {
    if (cachedLink.data) return cachedLink.data
    const r = await run('link', () => studioApi.whatsappLink(token, id))
    qc.setQueryData(['studio', 'public-url', id], r.link)
    return r.link
  }

  async function copyLink() {
    const l = await link().catch(() => null)
    if (!l) return
    try {
      await navigator.clipboard.writeText(l)
      toast.success('Link copied. Paste it into a message to the customer.')
    } catch {
      window.prompt('Copy the customer’s link:', l)
    }
  }

  async function whatsapp() {
    // Open the tab inside the click (pop-up blockers), then point it at wa.me.
    const win = window.open('', '_blank')
    try {
      const r = await run('whatsapp', () => studioApi.whatsappLink(token, id))
      qc.setQueryData(['studio', 'public-url', id], r.link)
      if (isWhatsappLink(r.url) && win) win.location.href = r.url
      else win?.close()
    } catch {
      win?.close()
    }
  }

  const prevIssued = lastIssuedBefore(view.versions, v.version)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-utility text-xs text-[#111827]/60">
            <Link href="/dashboard/studio/proposals" className="hover:underline">Studio proposals</Link> / {view.proposal.code}
          </p>
          <h1 className="mt-0.5 font-display text-xl font-bold text-[#091c3c] md:text-2xl">{view.proposal.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-utility text-sm text-[#111827]/70">
            <StatusChip status={view.proposal.status === 'converted' || view.proposal.status === 'lost' ? view.proposal.status : v.status} />
            {v.document_reference && <span>{v.document_reference}</span>}
            {v.document_date && <span>· {formatDate(v.document_date)}</span>}
            {v.valid_until && <span>· {validityText(v.valid_until)}</span>}
            {!current && <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-800">Version {v.version} — not the current one</span>}
          </div>
        </div>
        {editableNow && (
          <Link href={`/dashboard/studio/proposals/${id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#f7a800] px-4 font-utility text-sm font-semibold text-[#091c3c]">
            <PencilLine className="h-4 w-4" /> Continue editing
          </Link>
        )}
      </div>

      {justIssued && issued && (
        <Notice tone="ok" testId="issued-banner">
          <p className="font-medium">Issued as {v.document_reference}. Now send it to the customer.</p>
          <p className="mt-0.5 text-xs">Email, WhatsApp or copy the link — the customer can read, download and accept it online.</p>
        </Notice>
      )}
      {v.status === 'pending_approval' && (
        <Notice tone="info">
          Waiting for approval by an Admin or Management.{' '}
          {can?.approve && <Link className="font-semibold underline" href={`/dashboard/studio/proposals/${id}/review`}>Review it now</Link>}
        </Notice>
      )}
      {view.proposal.lost_reason && <Notice tone="warn">Marked lost: {view.proposal.lost_reason}</Notice>}
      {view.proposal.lead_id && (
        <Notice tone="ok">
          A lead was created from this proposal.{' '}
          {perm(['leads.view_all', 'leads.view_assigned']) && <Link className="font-semibold underline" href={`/dashboard/leads/${view.proposal.lead_id}`}>Open the lead</Link>}
        </Notice>
      )}
      {error && <Notice tone="error" testId="overview-error">{error}</Notice>}

      {/* Actions — each shown only when the API says this person may do it now. */}
      <div className="flex flex-wrap gap-2" data-testid="proposal-actions">
        {issued && (
          <Button type="button" variant="outline" className="min-h-11" disabled={busy === 'pdf'} onClick={() => void run('pdf', () => studioApi.downloadPdf(token, id, v.version, v.pdf_filename ?? `${view.proposal.code}.pdf`)).catch(() => {})} data-testid="action-download">
            {busy === 'pdf' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />} Download PDF
          </Button>
        )}
        {can?.deliver && current && (
          <>
            <Button type="button" className="min-h-11" onClick={() => setDialog('email')} data-testid="action-email">
              <Mail className="mr-1.5 h-4 w-4" /> Email to customer
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => void whatsapp()} disabled={busy === 'whatsapp'} data-testid="action-whatsapp">
              <MessageCircle className="mr-1.5 h-4 w-4" /> Share on WhatsApp
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => void copyLink()} disabled={busy === 'link'} data-testid="action-copy-link">
              <Copy className="mr-1.5 h-4 w-4" /> Copy link
            </Button>
          </>
        )}
        {can?.mark_accepted && current && (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialog('accepted')} data-testid="action-accepted">
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark accepted in person
          </Button>
        )}
        {can?.revise && (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialog('revise')} data-testid="action-revise">
            <FilePen className="mr-1.5 h-4 w-4" /> Revise
          </Button>
        )}
        {perm('studio.edit') && (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialog('duplicate')} data-testid="action-duplicate">
            <CopyPlus className="mr-1.5 h-4 w-4" /> Duplicate
          </Button>
        )}
        {can?.convert && (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialog('convert')} data-testid="action-convert">
            <UserPlus className="mr-1.5 h-4 w-4" /> Create lead
          </Button>
        )}
        {can?.approve && (
          <Link href={`/dashboard/studio/proposals/${id}/review`} className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-[#e4e8ee] bg-white px-4 font-utility text-sm" data-testid="action-review">
            <Stamp className="h-4 w-4" /> Review for approval
          </Link>
        )}
        {perm('studio.library.manage') && (
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => setDialog('template')} data-testid="action-template">
            <BookmarkPlus className="mr-1.5 h-4 w-4" /> Save as template
          </Button>
        )}
        {can?.mark_lost && current && (
          <Button type="button" variant="ghost" className="min-h-11 text-red-700" onClick={() => setDialog('lost')} data-testid="action-lost">
            <XCircle className="mr-1.5 h-4 w-4" /> Mark lost
          </Button>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="space-y-5">
          <Panel title="Customer and figures">
            <div className="grid gap-4 md:grid-cols-2">
              <dl className="space-y-2 font-utility text-sm">
                <div>
                  <dt className="text-xs text-[#111827]/60">Customer</dt>
                  <dd className="text-[#091c3c]">
                    {view.proposal.customer ? <Link className="hover:underline" href={`/dashboard/studio/customers/${view.proposal.customer.id}`}>{view.proposal.customer.name}</Link> : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#111827]/60">Mobile</dt>
                  <dd>{view.document.addressee.mobile ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#111827]/60">Email</dt>
                  <dd>{customer.data?.customer.email ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#111827]/60">Plant</dt>
                  <dd>{kwpText(view.figures.capacity_kwp)} · {view.layout} layout</dd>
                </div>
                {v.accepted_at && (
                  <div>
                    <dt className="text-xs text-[#111827]/60">Accepted</dt>
                    <dd>{at(v.accepted_at)}{v.accepted_name ? ` by ${v.accepted_name}` : ''}{v.accepted_via ? ` (${v.accepted_via === 'online' ? 'online' : 'in person'})` : ''}</dd>
                  </div>
                )}
                {v.declined_at && (
                  <div>
                    <dt className="text-xs text-[#111827]/60">Declined</dt>
                    <dd>{at(v.declined_at)}{v.decline_reason ? ` — “${v.decline_reason}”` : ''}</dd>
                  </div>
                )}
                {v.verification_code && (
                  <div>
                    <dt className="text-xs text-[#111827]/60">Verification code (on the QR)</dt>
                    <dd className="font-mono">{v.verification_code}</dd>
                  </div>
                )}
              </dl>
              <FiguresSummary figures={view.figures} compact />
            </div>
          </Panel>

          <Panel title="What happened" description="Every step, including when the customer opened and downloaded it.">
            {events.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <ol className="relative space-y-3 border-l-2 border-[#e4e8ee] pl-4" data-testid="timeline">
                {timeline(events.data?.items ?? []).map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#0e2a63]" aria-hidden="true" />
                    <p className="font-utility text-sm text-[#091c3c]">
                      {eventLabel(e.type)}
                      {e.version != null && view.versions.length > 1 && <span className="ml-1 text-xs text-[#111827]/50">v{e.version}</span>}
                    </p>
                    <p className="font-utility text-xs text-[#111827]/60">
                      {at(e.at)}
                      {eventNote(e) ? ` · ${eventNote(e)}` : ''}
                    </p>
                  </li>
                ))}
                {v.view_count > 0 && <li className="font-utility text-xs text-[#111827]/60">Opened {v.view_count} time{v.view_count === 1 ? '' : 's'} in all{v.first_viewed_at ? `, first on ${at(v.first_viewed_at)}` : ''}.</li>}
              </ol>
            )}
          </Panel>

          <Panel title="Versions">
            <ul className="divide-y divide-[#eef1f5]" data-testid="versions">
              {[...view.versions].reverse().map((x) => (
                <li key={x.version} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="font-utility text-sm font-medium text-[#091c3c]">Version {x.version}</span>
                  <StatusChip status={x.status} />
                  {x.document_reference && <span className="font-utility text-xs text-[#111827]/60">{x.document_reference}</span>}
                  <span className="ml-auto flex flex-wrap gap-1">
                    <Link href={`/dashboard/studio/proposals/${id}?view=overview&version=${x.version}`} className="inline-flex min-h-11 items-center rounded px-2 font-utility text-xs text-[#0e2a63] hover:underline md:min-h-8">Open</Link>
                    {x.document_reference && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => void run(`pdf-${x.version}`, () => studioApi.downloadPdf(token, id, x.version, `${view.proposal.code}-v${x.version}.pdf`)).catch(() => {})}>
                        <Download className="mr-1 h-3.5 w-3.5" /> PDF
                      </Button>
                    )}
                    {x.version > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setCompare({ a: x.version - 1, b: x.version })} data-testid={`compare-${x.version}`}>
                        <GitCompare className="mr-1 h-3.5 w-3.5" /> Compare with v{x.version - 1}
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {v.change_summary.length > 0 && prevIssued && (
              <p className="mt-2 font-utility text-xs text-[#111827]/60">{v.change_summary.length} change{v.change_summary.length === 1 ? '' : 's'} since version {prevIssued}.</p>
            )}
            {compare && <CompareView proposalId={id} a={compare.a} b={compare.b} onClose={() => setCompare(null)} />}
          </Panel>
        </div>

        {issued || view.figures.total ? <StudioPreview proposalId={id} version={v.version} refreshKey={`${v.version}-${view.revision}`} issued={issued} /> : null}
      </div>

      <EmailDialog open={dialog === 'email'} onClose={() => setDialog(null)} defaultTo={customer.data?.customer.email ?? ''} name={view.document.addressee.name ?? ''} reference={v.document_reference} onSend={(to) => run('email', () => studioApi.email(token, id, to), (r) => toast.success(`Sent to ${r.to}.`), true)} />
      <AcceptedDialog open={dialog === 'accepted'} onClose={() => setDialog(null)} onSave={(date, file) => run('accepted', () => studioApi.markAccepted(token, id, date, file), (r) => {
        toast.success('Recorded as accepted.')
        if (r.convert_offered && can?.convert) setDialog('convert')
      }, true)} />
      <ReasonPrompt open={dialog === 'lost'} onClose={() => setDialog(null)} title="Mark this proposal lost" label="Why was it lost?" hint="e.g. “Went with another installer”, “Postponed to next year”" confirm="Mark lost" destructive onConfirm={(reason) => run('lost', () => studioApi.markLost(token, id, reason), undefined, true)} />
      <ReasonPrompt open={dialog === 'template'} onClose={() => setDialog(null)} title="Save as a template" label="Template name" hint="The customer’s details are left out. Start new proposals from it under Library → Templates." confirm="Save template" onConfirm={(name) => run('template', () => studioApi.saveAsTemplate(token, id, name), () => toast.success('Template saved to the Library.'), true)} />
      <Confirm open={dialog === 'revise'} onClose={() => setDialog(null)} title="Start a new version?" body="Everything is copied into a new draft version. When you issue it, it replaces this one (reference …-R1) and the customer’s old link shows that a newer version exists." confirm="Start the new version" onConfirm={() => run('revise', () => studioApi.revise(token, id), () => router.push(`/dashboard/studio/proposals/${id}?step=review`), true)} />
      <Confirm open={dialog === 'duplicate'} onClose={() => setDialog(null)} title="Copy into a new proposal?" body={`A new draft is made from version ${v.version} for the same customer. You can change the customer in it.`} confirm="Make a copy" onConfirm={() => run('duplicate', () => studioApi.duplicate(token, id, { version: v.version }), (r) => router.push(`/dashboard/studio/proposals/${r.proposal.id}`), true)} />
      <Confirm open={dialog === 'convert'} onClose={() => setDialog(null)} title="Create a lead from this proposal?" body="A lead is made with this proposal (same document, reference and PDF), assigned to the proposal’s owner, so the project can move on to survey and agreement." confirm="Create the lead" onConfirm={() => run('convert', () => studioApi.convert(token, id), (r) => toast.success(r.created ? 'Lead created.' : 'The lead already exists.'), true)} />
    </div>
  )
}

function CompareView({ proposalId, a, b, onClose }: { proposalId: number; a: number; b: number; onClose: () => void }) {
  const diff = useVersionDiff(proposalId, a, b)
  return (
    <div className="mt-3 rounded-lg border border-[#e4e8ee] p-3" data-testid="compare-view">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-utility text-sm font-semibold text-[#091c3c]">What changed from version {a} to {b}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      {diff.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : diff.error ? (
        <Notice tone="error">{studioError(diff.error).message}</Notice>
      ) : (diff.data?.changes ?? []).length === 0 ? (
        <p className="font-utility text-sm text-[#111827]/60">No differences.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full font-utility text-sm">
            <thead>
              <tr className="text-left text-xs text-[#111827]/60">
                <th className="py-1 pr-3 font-medium">What</th>
                <th className="py-1 pr-3 font-medium">Version {a}</th>
                <th className="py-1 font-medium">Version {b}</th>
              </tr>
            </thead>
            <tbody>
              {diff.data!.changes.map((c) => (
                <tr key={c.field} className="border-t border-[#eef1f5] align-top">
                  <td className="py-1.5 pr-3 text-[#091c3c]">{fieldLabel(c.field)}</td>
                  <td className="py-1.5 pr-3 text-red-800 line-through decoration-red-300">{diffValue(c.before)}</td>
                  <td className="py-1.5 text-green-800">{diffValue(c.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function EmailDialog({ open, onClose, defaultTo, name, reference, onSend }: { open: boolean; onClose: () => void; defaultTo: string; name: string; reference: string | null; onSend: (to: string | null) => Promise<unknown> }) {
  const [to, setTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const value = to ?? defaultTo
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setTo(null); setError(null) } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email the proposal</DialogTitle>
          <DialogDescription>The PDF is attached, with the link to read and accept it online. Replies come to you.</DialogDescription>
        </DialogHeader>
        <TextInput field="email.to" label="Send to" type="email" inputMode="email" value={value} onChange={setTo} hint="Change it to send to another address this time" />
        <div className="rounded-lg bg-[#f7f9fc] p-3 font-utility text-sm text-[#111827]/80" data-testid="email-preview">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#111827]/50">The message</p>
          <p className="mt-1">Subject: Your proposal from Grid Nova Energy — {reference}</p>
          <p className="mt-1">Dear {name}, thank you for considering Grid Nova Energy. Please find our proposal attached. You can also read it, download it and accept it online using the link in the email.</p>
          <p className="mt-1 text-xs text-[#111827]/55">Grid Nova’s standard wording — the message itself cannot be edited yet.</p>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await onSend(value.trim() && value.trim() !== defaultTo ? value.trim() : null)
                onClose()
              } catch (e) {
                setError(studioError(e).message)
              } finally {
                setBusy(false)
              }
            }}
            data-testid="email-send"
          >
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AcceptedDialog({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (date: string, file: File) => Promise<unknown> }) {
  const [date, setDate] = useState(todayIst())
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tooBig = !!file && file.size > 10 * 1024 * 1024
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accepted in person</DialogTitle>
          <DialogDescription>Record the date and upload the copy the customer signed.</DialogDescription>
        </DialogHeader>
        <DateField variant="dashboard" label="Date it was signed" value={date} onChange={setDate} />
        <div>
          <label htmlFor="signed-copy" className="mb-1 block font-utility text-sm font-medium text-[#091c3c]">Signed copy</label>
          <input id="signed-copy" type="file" accept="application/pdf,image/jpeg,image/png" className={INPUT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <p className="mt-1 font-utility text-xs text-[#111827]/60">A PDF, or a photo (JPEG or PNG), at most 10 MB.</p>
          {tooBig && <p role="alert" className="mt-1 font-utility text-xs text-red-700">This file is larger than 10 MB.</p>}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            disabled={busy || !file || !date || tooBig}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await onSave(date, file!)
                onClose()
              } catch (e) {
                setError(studioError(e).message)
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ReasonPrompt({ open, onClose, title, label, hint, confirm, destructive, required = true, onConfirm }: { open: boolean; onClose: () => void; title: string; label: string; hint?: string; confirm: string; destructive?: boolean; required?: boolean; onConfirm: (reason: string) => Promise<unknown> }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div>
          <label htmlFor="reason-text" className="mb-1 block font-utility text-sm font-medium text-[#091c3c]">{label}</label>
          <textarea id="reason-text" className={INPUT} rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
          {hint && <p className="mt-1 font-utility text-xs text-[#111827]/60">{hint}</p>}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy || (required && text.trim().length < 3)}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await onConfirm(text.trim())
                setText('')
                onClose()
              } catch (e) {
                setError(studioError(e).message)
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Confirm({ open, onClose, title, body, confirm, onConfirm }: { open: boolean; onClose: () => void; title: string; body: string; confirm: string; onConfirm: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        {error && <Notice tone="error">{error}</Notice>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await onConfirm()
                onClose()
              } catch (e) {
                setError(studioError(e).message)
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
