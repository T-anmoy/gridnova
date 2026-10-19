'use client'

import { useId, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Copy, Download, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import { notAuthenticatedError } from '@/lib/api/http'
import { formatDatetime } from '@/lib/dashboard/utils'
import {
  EMAIL_STATUS_LABEL,
  LINK_STATE_LABEL,
  PDF_STATUS_LABEL,
  SKIPPED_REASON_LABEL,
  customerPageUrl,
  handoverErrorMessage,
} from '@/lib/handover/labels'
import type { Pack } from '@/lib/handover/schemas'
import { fetchPackPdfLink, useIssueLink, useRegeneratePdf, useRevokeLink } from '@/lib/handover/staff-api-client'

const PDF_VARIANT: Record<string, 'green' | 'amber' | 'red' | 'gray'> = { ready: 'green', held: 'amber', failed: 'red', not_generated: 'gray' }
const LINK_VARIANT: Record<string, 'green' | 'gray' | 'red' | 'amber'> = { active: 'green', none: 'gray', revoked: 'red', expired: 'amber' }

interface Issued {
  apiUrl: string
  pageUrl: string | null
  expiresAt: string | null | undefined
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const id = useId()
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // No clipboard permission: select the text so the person can copy by hand.
      const el = document.getElementById(id) as HTMLInputElement | null
      el?.select()
      setCopied(false)
    }
  }
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-gray-500">{label}</label>
      <div className="flex gap-2">
        <input id={id} readOnly value={value} onFocus={(e) => e.currentTarget.select()} className="h-11 min-w-0 flex-1 rounded-lg border border-[#e4e8ee] bg-[#f7f9fc] px-3 text-base md:h-9 md:text-sm" />
        <Button type="button" variant="outline" className="h-11 shrink-0 md:h-9" onClick={() => void copy()}>
          <Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}{' '}
          <span className="sr-only">{label}</span>
        </Button>
      </div>
    </div>
  )
}

export default function HandoverDelivery({ onboardingId, pack }: { onboardingId: number; pack: Pack }) {
  const { getToken } = useAuth()
  const issue = useIssueLink(onboardingId)
  const revoke = useRevokeLink(onboardingId)
  const regenerate = useRegeneratePdf(onboardingId)
  const [dialog, setDialog] = useState<'issue' | 'email' | 'revoke' | 'regenerate' | null>(null)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)

  if (!pack.handover_recorded) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-gray-600" data-testid="delivery-pending">
          The handover pack PDF and the customer’s link are created automatically once handover is recorded.
        </CardContent>
      </Card>
    )
  }

  const canAct = !!pack.can_act
  const pdf = pack.pdf
  const link = pack.link
  const email = pack.email

  async function openPdf() {
    setOpenError(null)
    try {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      // A signed URL expires: fetch a fresh one on every click.
      const signed = await fetchPackPdfLink(onboardingId, token)
      window.open(signed.url, '_blank', 'noopener')
    } catch (err) {
      setOpenError(handoverErrorMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      <Card data-testid="pdf-card">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Handover pack PDF</CardTitle>
            <Badge variant={PDF_VARIANT[pdf.status] ?? 'gray'} data-testid="pdf-status">{PDF_STATUS_LABEL[pdf.status] ?? pdf.status}</Badge>
          </div>
          {pdf.generated_at && <p className="text-xs text-gray-500">Generated {formatDatetime(pdf.generated_at)}</p>}
        </CardHeader>
        <CardContent className="space-y-3">
          {pdf.status === 'held' && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="pdf-held">
              <p>The PDF is held, and the customer has not been emailed, while some printed text is still a placeholder (for example the O&amp;M terms after the first year, or company details). It is rendered once Grid Nova supplies them.</p>
              {pdf.held_reason && <p className="mt-1 text-xs">Reason: {pdf.held_reason}</p>}
            </div>
          )}
          {pdf.status === 'failed' && <p className="text-sm text-red-700">The PDF could not be rendered. Try regenerating it.</p>}
          {pdf.status === 'not_generated' && <p className="text-sm text-gray-600">The PDF has not been generated yet. It is rendered in the background after handover is recorded.</p>}
          <div className="flex flex-wrap gap-2">
            {pdf.status === 'ready' && (
              <Button variant="outline" className="h-11 md:h-9" onClick={() => void openPdf()}>
                <Download className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Download PDF
              </Button>
            )}
            {canAct && <Button variant="outline" className="h-11 md:h-9" onClick={() => setDialog('regenerate')}>Regenerate…</Button>}
          </div>
          <p role="alert" className={openError ? 'text-sm text-red-600' : 'sr-only'}>{openError}</p>
        </CardContent>
      </Card>

      <Card data-testid="link-card">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Customer link</CardTitle>
            {link && <Badge variant={LINK_VARIANT[link.state] ?? 'gray'} data-testid="link-state">{LINK_STATE_LABEL[link.state] ?? link.state}</Badge>}
          </div>
          {link && link.state !== 'none' && (
            <p className="text-xs text-gray-500">
              Issued {formatDatetime(link.issued_at)}{link.issued_by ? ` by ${link.issued_by}` : ''}
              {link.state === 'active' && ` · ${link.expires_at ? `expires ${formatDatetime(link.expires_at)}` : 'does not expire'}`}
              {link.revoked_at && ` · revoked ${formatDatetime(link.revoked_at)}`}
            </p>
          )}
          {email?.status && (
            <p className="text-xs text-gray-500" data-testid="email-status">
              {EMAIL_STATUS_LABEL[email.status] ?? email.status}
              {email.emailed_at ? ` ${formatDatetime(email.emailed_at)}` : ''}
              {email.skipped_reason ? ` — ${SKIPPED_REASON_LABEL[email.skipped_reason] ?? email.skipped_reason}` : ''}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            The customer opens their warranty and service page from this link. The link itself cannot be shown again after it is created — to share it again, issue a new one: the old link stops working.
          </p>
          {issued && (
            <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3" data-testid="issued-link" role="status">
              <p className="text-sm font-medium text-emerald-900">New link created. This is the only time it is shown — copy it now.</p>
              {issued.pageUrl && <CopyRow label="Customer page link" value={issued.pageUrl} />}
              <CopyRow label="Direct PDF link" value={issued.apiUrl} />
              {issued.pageUrl && (
                <a href={issued.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-[#0e2a63] underline md:min-h-0">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Preview the customer page
                </a>
              )}
              <p className="text-xs text-gray-600">{issued.expiresAt ? `Expires ${formatDatetime(issued.expiresAt)}.` : 'This link does not expire, but you can revoke it.'}</p>
            </div>
          )}
          {canAct ? (
            <div className="flex flex-wrap gap-2">
              <Button className="h-11 md:h-9" onClick={() => setDialog('issue')}>Create a link to copy…</Button>
              <Button variant="outline" className="h-11 md:h-9" onClick={() => setDialog('email')}>Resend email…</Button>
              {link?.state === 'active' && <Button variant="outline" className="h-11 md:h-9" onClick={() => setDialog('revoke')}>Revoke link…</Button>}
            </div>
          ) : (
            <p className="text-xs text-gray-500">Only Operations and Admin issue or revoke the customer link.</p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={dialog === 'issue'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Create a new customer link?"
        description="This issues a new link and shows it here one time only so you can copy it. The current link, if there is one, stops working at once. The customer is not emailed."
        confirmLabel="Create link"
        describeError={handoverErrorMessage}
        onConfirm={async () => {
          const r = await issue.mutateAsync(false)
          setIssued({ apiUrl: r.link.url, pageUrl: customerPageUrl(r.link.url, window.location.origin), expiresAt: r.link.expires_at })
        }}
      />
      <ConfirmDialog
        open={dialog === 'email'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Email the customer a new link?"
        description="The old link cannot be read back, so sending again issues a new link and emails it. The current link stops working at once."
        confirmLabel="Issue and email"
        describeError={handoverErrorMessage}
        onConfirm={async () => {
          const r = await issue.mutateAsync(true)
          setIssued({ apiUrl: r.link.url, pageUrl: customerPageUrl(r.link.url, window.location.origin), expiresAt: r.link.expires_at })
        }}
      />
      <ConfirmDialog
        open={dialog === 'revoke'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Revoke the customer link?"
        description="The customer will no longer be able to open their page or the PDF from it. You can issue a new link afterwards."
        confirmLabel="Revoke link"
        destructive
        describeError={handoverErrorMessage}
        onConfirm={async () => {
          await revoke.mutateAsync()
          setIssued(null)
        }}
      />
      <ConfirmDialog
        open={dialog === 'regenerate'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Regenerate the handover pack PDF?"
        description="The PDF is rendered again in the background from the current records. If printed text is still a placeholder it stays held."
        confirmLabel="Regenerate"
        describeError={handoverErrorMessage}
        onConfirm={() => regenerate.mutateAsync()}
      />
    </div>
  )
}
