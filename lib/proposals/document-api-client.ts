'use client'

import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchBlob, getTokenOrThrow } from '@/lib/api/http'
import { ApiError } from '@/lib/dashboard/api-error'
import type { DocumentEditInput, DocumentEditResponse, DocumentView } from './document-types'

// BE-13 document routes (docs/api/proposal_document.md).
const BASE = '/api/v1/dashboard/proposals'

export const documentQueryKey = (proposalId: number) => ['proposal-document', proposalId] as const

export function useProposalDocument(proposalId: number, enabled = true) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: documentQueryKey(proposalId),
    queryFn: async ({ signal }) => {
      const token = await getTokenOrThrow(getToken)
      return apiFetch<DocumentView>(`${BASE}/${proposalId}/document`, token, { signal })
    },
    enabled: enabled && Number.isFinite(proposalId),
    // An editor: never refetch underneath someone's typing on window focus.
    refetchOnWindowFocus: false,
    // A 403/404 is an answer, not a blip.
    retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
  })
}

/** One section per call; the response replaces the cached document. */
export function useEditDocumentSection() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ proposalId, ...body }: DocumentEditInput) => {
      const token = await getTokenOrThrow(getToken)
      return apiFetch<DocumentEditResponse>(`${BASE}/${proposalId}/document`, token, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
    },
    onSuccess: (data, vars) => {
      qc.setQueryData<DocumentView>(documentQueryKey(vars.proposalId), data)
      // The total and the sign-off flag may have moved with the plant.
      void qc.invalidateQueries({ queryKey: ['proposal', vars.proposalId] })
      void qc.invalidateQueries({ queryKey: ['proposals'] })
    },
  })
}

export const previewPdfPath = (proposalId: number) => `${BASE}/${proposalId}/preview.pdf`

/** The current draft rendered now (never stored). 403 for Engineers, 429 past 20 a minute. */
export async function fetchPreviewPdf(proposalId: number, token: string, signal?: AbortSignal): Promise<Blob> {
  return apiFetchBlob(previewPdfPath(proposalId), token, { signal })
}
