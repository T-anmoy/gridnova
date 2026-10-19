'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { toast } from 'sonner'
import { Loader2, Download } from 'lucide-react'
import { useAssociateMe, fetchAssociateDocumentLink } from '@/lib/associate/api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { ApiError } from '@/lib/dashboard/api-error'
import type { Messages } from '@/lib/i18n/types'

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.detail || err.message
  if (err instanceof Error) return err.message
  return fallback
}

export default function PortalIdCard({ copy }: { copy: Messages['associates']['portal']['associate']['idCard'] }) {
  const { getToken } = useAuth()
  const { data: me, isLoading, error, refetch } = useAssociateMe()
  const [downloading, setDownloading] = useState(false)

  if (error) return <DashboardError error={error} onRetry={() => void refetch()} />
  if (isLoading || !me) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#111827]/65" />
      </div>
    )
  }

  async function download() {
    setDownloading(true)
    try {
      const token = await getToken()
      if (!token) return
      const link = await fetchAssociateDocumentLink('id_card', token)
      window.open(link.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to open ID card'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[#091c3c]">{copy.title}</h1>
      <p className="mt-2 text-sm text-[#111827]/60 leading-relaxed">{copy.body}</p>

      <div className="mt-8 rounded-2xl border border-[#e4e8ee] bg-white p-8 text-center">
        {me.documents.id_card ? (
          <button
            onClick={() => void download()}
            disabled={downloading}
            className="btn btn-primary mx-auto disabled:opacity-60"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {copy.download}
          </button>
        ) : (
          <p className="font-utility text-sm text-[#111827]/65">{copy.notReady}</p>
        )}
      </div>
    </div>
  )
}
