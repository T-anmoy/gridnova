'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { toast } from 'sonner'
import { Loader2, Download } from 'lucide-react'
import { useAssociateMe, fetchAssociateDocumentLink } from '@/lib/associate/api-client'
import { PortalError } from '@/components/associate/PortalError'
import { portalErrorText } from '@/lib/associate/portal-error'
import { useMessages } from '@/lib/i18n/client'
import type { Messages } from '@/lib/i18n/types'

export default function PortalIdCard({ copy }: { copy: Messages['associates']['portal']['associate']['idCard'] }) {
  const { getToken } = useAuth()
  const { data: me, isLoading, error, refetch } = useAssociateMe()
  const [downloading, setDownloading] = useState<'id_card' | 'welcome_letter' | null>(null)
  const feedback = useMessages('portalFeedback')

  if (error) return <PortalError error={error} onRetry={() => void refetch()} />
  if (isLoading || !me) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#111827]/65" />
      </div>
    )
  }

  async function download(document: 'id_card' | 'welcome_letter') {
    setDownloading(document)
    try {
      const token = await getToken()
      if (!token) return
      const link = await fetchAssociateDocumentLink(document, token)
      window.open(link.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(`${feedback.documents[document]} ${portalErrorText(err, feedback)}`)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[#091c3c]">{copy.title}</h1>
      <p className="mt-2 text-sm text-[#111827]/60 leading-relaxed">{copy.body}</p>

      <div className="mt-8 rounded-2xl border border-[#e4e8ee] bg-white p-8 text-center">
        {me.documents.id_card ? (
          <button
            onClick={() => void download('id_card')}
            disabled={downloading !== null}
            className="btn btn-primary mx-auto min-h-[48px] disabled:opacity-60"
          >
            {downloading === 'id_card' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {copy.download}
          </button>
        ) : (
          <p className="font-utility text-sm text-[#111827]/65">{copy.notReady}</p>
        )}
        {me.documents.welcome_letter && (
          <button
            onClick={() => void download('welcome_letter')}
            disabled={downloading !== null}
            className="btn btn-secondary mx-auto mt-3 min-h-[48px] disabled:opacity-60"
            data-testid="welcome-letter"
          >
            {downloading === 'welcome_letter' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {copy.downloadWelcome}
          </button>
        )}
      </div>
    </div>
  )
}
