// Nova Records (BE-9) — docs/api/nova_records.md. Base path /api/v1/dashboard/nova.
// All six staff roles may ask; every answer is already scoped to the caller's role by the backend.
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getTokenOrThrow } from '@/lib/api/http'
import {
  askResponseSchema,
  conversationDetailSchema,
  conversationListSchema,
  feedbackResponseSchema,
  type AskRequest,
  type AskResponse,
  type ConversationDetail,
  type ConversationSummary,
  type FeedbackResponse,
} from '@/lib/nova/schemas'

// Sub-paths are checked by tests/unit/fe7-endpoints.test.tsx (the static drift test sees only literals).
const DASHBOARD_API = '/api/v1/dashboard'
export const NOVA_BASE = `${DASHBOARD_API}/nova`

export function useNovaAsk() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: AskRequest): Promise<AskResponse> => {
      const token = await getTokenOrThrow(getToken)
      return apiFetch(`${NOVA_BASE}/ask`, token, { method: 'POST', body: JSON.stringify(req) }, askResponseSchema)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['nova-conversations'] }),
  })
}

export function useNovaConversations(enabled = true) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['nova-conversations'],
    enabled,
    queryFn: async ({ signal }): Promise<ConversationSummary[]> => {
      const token = await getTokenOrThrow(getToken)
      const res = await apiFetch(`${NOVA_BASE}/conversations`, token, { signal }, conversationListSchema)
      return res.items
    },
  })
}

export function useNovaConversation(conversationId: string | null) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['nova-conversation', conversationId],
    enabled: !!conversationId,
    queryFn: async ({ signal }): Promise<ConversationDetail> => {
      const token = await getTokenOrThrow(getToken)
      return apiFetch(`${NOVA_BASE}/conversations/${conversationId}`, token, { signal }, conversationDetailSchema)
    },
  })
}

export function useNovaFeedback() {
  const { getToken } = useAuth()
  return useMutation({
    mutationFn: async ({ turnId, helpful, note }: { turnId: string; helpful: boolean; note?: string }): Promise<FeedbackResponse> => {
      const token = await getTokenOrThrow(getToken)
      return apiFetch(
        `${NOVA_BASE}/turns/${turnId}/feedback`,
        token,
        { method: 'POST', body: JSON.stringify({ helpful, ...(note ? { note } : {}) }) },
        feedbackResponseSchema,
      )
    },
  })
}

/** Opens an earlier conversation on demand (the history list); cached under the same key as the hook. */
export function useLoadNovaConversation() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return (conversationId: string): Promise<ConversationDetail> =>
    qc.fetchQuery({
      queryKey: ['nova-conversation', conversationId],
      staleTime: 0,
      queryFn: async ({ signal }) => {
        const token = await getTokenOrThrow(getToken)
        return apiFetch(`${NOVA_BASE}/conversations/${conversationId}`, token, { signal }, conversationDetailSchema)
      },
    })
}
