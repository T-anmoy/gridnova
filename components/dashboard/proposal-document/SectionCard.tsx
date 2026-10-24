'use client'

import { useState } from 'react'
import { AlertTriangle, Copy, Eye, Loader2, Lock, PencilLine, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { sectionAnchorId } from '@/lib/proposals/document-logic'

export interface SectionCardProps {
  section: string
  title: string
  editable: boolean
  dirty: boolean
  saving: boolean
  /** A section-level message (an error the server did not pin to a field). */
  error?: string | null
  /** 409 stale_version on this section's save: keep the typing, offer copy + reload. */
  conflict?: boolean
  draftText?: string
  onSave?: () => void
  onDiscard?: () => void
  onReload?: () => void
  /** Why a read-only section is read-only (locked proposal vs. role). */
  readOnlyReason?: string
  children: React.ReactNode
}

export function SectionCard({ section, title, editable, dirty, saving, error, conflict, draftText, onSave, onDiscard, onReload, readOnlyReason, children }: SectionCardProps) {
  const [copied, setCopied] = useState(false)
  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draftText ?? '')
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  const headingId = `${sectionAnchorId(section)}-title`
  return (
    <section
      id={sectionAnchorId(section)}
      aria-labelledby={headingId}
      data-section={section}
      data-editable={editable ? 'true' : 'false'}
      className="scroll-mt-24 rounded-xl border border-[#e4e8ee] bg-white"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e8ee] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={headingId} className="font-display text-base font-semibold text-[#091c3c]">
            {title}
          </h3>
          {editable ? (
            <Badge variant="blue" className="gap-1">
              <PencilLine className="h-3 w-3" aria-hidden="true" /> Editable
            </Badge>
          ) : (
            <Badge variant="gray" className="gap-1" title={readOnlyReason}>
              {readOnlyReason ? <Lock className="h-3 w-3" aria-hidden="true" /> : <Eye className="h-3 w-3" aria-hidden="true" />} Read only
            </Badge>
          )}
          {dirty && (
            <span className="inline-flex items-center gap-1 font-utility text-xs font-medium text-amber-700" data-testid={`unsaved-${section}`}>
              <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" /> Unsaved changes
            </span>
          )}
        </div>
        {editable && (
          <div className="flex gap-2">
            {dirty && (
              <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={onDiscard} disabled={saving}>
                Discard
              </Button>
            )}
            <Button type="button" size="sm" className="min-h-11" onClick={onSave} disabled={!dirty || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Saving" /> : `Save ${title.toLowerCase()}`}
            </Button>
          </div>
        )}
      </header>
      {conflict && (
        <div role="alert" className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-2 font-utility text-sm font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Someone else changed this proposal — reload to see their changes.
          </p>
          <p className="mt-1 font-utility text-xs text-amber-800">Your typing is still here. Copy it before reloading if you want to keep it.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void copyDraft()}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy my text'}
            </Button>
            <Button type="button" size="sm" className="min-h-11" onClick={onReload}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reload latest
            </Button>
          </div>
        </div>
      )}
      {error && !conflict && (
        <p role="alert" className="mx-4 mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 font-utility text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="space-y-3 p-4">{children}</div>
    </section>
  )
}
