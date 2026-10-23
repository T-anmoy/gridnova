// Ask Nova's network transport (BE-1 §1, POST /api/v1/chat/message). Kept
// apart from ./chat because it pulls in zod and the API client: the widget
// loads this module only on a visitor's first message.
import { publicFetch } from '@/lib/api/http'
import { ApiError } from '@/lib/dashboard/api-error'
import { chatMessageResponseSchema } from '@/lib/dashboard/schemas'
import type { z } from 'zod'

export type ChatResponse = z.infer<typeof chatMessageResponseSchema>

export const CHAT_PATH = '/api/v1/chat/message'

export type ChatErrorKind = 'rate_limit' | 'server' | 'network' | 'other'

export function classifyChatError(error: unknown): ChatErrorKind {
  if (!(error instanceof ApiError)) return 'other'
  if (error.status === 429) return 'rate_limit'
  if (error.status >= 500) return 'server'
  if (error.status === 0) return 'network'
  return 'other'
}

export interface SendChatArgs {
  message: string
  sessionToken: string | null
  signal?: AbortSignal
}

export function sendChatMessage({ message, sessionToken, signal }: SendChatArgs): Promise<ChatResponse> {
  const body: { message: string; session_token?: string } = { message }
  if (sessionToken) body.session_token = sessionToken
  return publicFetch(
    CHAT_PATH,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal },
    chatMessageResponseSchema
  )
}
