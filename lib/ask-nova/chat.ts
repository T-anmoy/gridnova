// Ask Nova's live chat transport + helpers (BE-1 §1, POST /api/v1/chat/message).
// A conversation is identified ONLY by the opaque `session_token` the backend
// returns; the browser keeps it and sends it back. No lead/customer ids are
// sent, received or stored.
//
// The network half (sendChatMessage, classifyChatError) lives in ./transport,
// which brings zod and the API client with it; the widget imports it only when
// a visitor actually sends a message, so it is not downloaded on every page.
export type { ChatResponse, ChatErrorKind, SendChatArgs } from './transport'

const SESSION_TOKEN_KEY = 'nova_session_token'
// Keys from before the session token existed. Cleared, never read.
const LEGACY_KEYS = ['nova_lead_id', 'nova_customer_id']

// Safari private mode (and blocked-storage browsers) throw on any access, so
// every sessionStorage touch is guarded and the chat still works in memory.
export function readSessionToken(): string | null {
  try {
    for (const key of LEGACY_KEYS) sessionStorage.removeItem(key)
    return sessionStorage.getItem(SESSION_TOKEN_KEY)
  } catch {
    return null
  }
}

export function writeSessionToken(token: string): void {
  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token)
  } catch {
    /* storage unavailable — the in-memory token still carries the conversation */
  }
}

// ── Reveal ──────────────────────────────────────────────────────────────────

export const REVEAL_TICK_MS = 40
/** A reply is fully shown within this long, however long it is. */
export const REVEAL_MAX_MS = 2_500

/**
 * Next prefix of `full` to show, advancing by whole words. The step grows with
 * the reply length so the total reveal never exceeds REVEAL_MAX_MS.
 */
export function nextRevealLength(full: string, shownLength: number): number {
  const tokens = full.match(/\s+|\S+/g) ?? []
  const perTick = Math.max(1, Math.ceil(tokens.length / (REVEAL_MAX_MS / REVEAL_TICK_MS)))
  let consumed = 0
  let index = 0
  while (index < tokens.length && consumed < shownLength) {
    consumed += tokens[index].length
    index += 1
  }
  const end = Math.min(tokens.length, index + perTick)
  let length = 0
  for (let i = 0; i < end; i++) length += tokens[i].length
  return length
}
