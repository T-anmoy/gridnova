import '@/lib/zod-config'
import { z } from 'zod'

// Mirrors docs/api/nova_records.md (and its schemas in docs/api/openapi.json).
// Nullable stays nullable; a key the contract does not list as required stays optional.

export const ASK_STATUSES = ['answered', 'not_on_record', 'needs_clarification', 'refused'] as const
export type AskStatus = (typeof ASK_STATUSES)[number]

export const TABLE_COLUMN_TYPES = ['text', 'ref', 'money', 'kw', 'date', 'number', 'boolean'] as const
export type TableColumnType = (typeof TABLE_COLUMN_TYPES)[number]

export const citationSchema = z.object({
  ref: z.string(),
  kind: z.string(),
  label: z.string(),
  path: z.string().nullable().optional(),
})

export const tableSchema = z.object({
  title: z.string(),
  columns: z.array(z.object({ key: z.string(), label: z.string(), type: z.enum(TABLE_COLUMN_TYPES) })),
  rows: z.array(z.record(z.string(), z.unknown())),
})

export const searchedSchema = z.object({
  tool: z.string(),
  filters: z.record(z.string(), z.unknown()),
  summary: z.string(),
})

export const suggestionSchema = z.object({
  label: z.string(),
  question: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
})

export const askResponseSchema = z.object({
  conversation_id: z.string(),
  turn_id: z.string(),
  status: z.enum(ASK_STATUSES),
  answer: z.string(),
  citations: z.array(citationSchema),
  tables: z.array(tableSchema),
  searched: z.array(searchedSchema),
  suggestions: z.array(suggestionSchema),
  generated_at: z.string(),
})

export const feedbackSchema = z.object({
  at: z.string().nullable().optional(),
  helpful: z.boolean().nullable().optional(),
  note: z.string().nullable().optional(),
})

export const turnSchema = z.object({
  turn_id: z.string(),
  question: z.string(),
  context: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.enum(ASK_STATUSES),
  answer: z.string(),
  citations: z.array(citationSchema),
  tables: z.array(tableSchema),
  searched: z.array(searchedSchema),
  suggestions: z.array(suggestionSchema),
  generated_at: z.string(),
  feedback: feedbackSchema,
})

export const conversationSummarySchema = z.object({
  conversation_id: z.string(),
  title: z.string(),
  turn_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const conversationListSchema = z.object({ items: z.array(conversationSummarySchema) })

export const conversationDetailSchema = conversationSummarySchema.extend({
  employee_id: z.string(),
  role: z.string(),
  turns: z.array(turnSchema),
})

export const feedbackResponseSchema = z.object({
  turn_id: z.string(),
  helpful: z.boolean(),
  note: z.string().nullable().optional(),
  feedback_at: z.string(),
})

export type Citation = z.infer<typeof citationSchema>
export type NovaTable = z.infer<typeof tableSchema>
export type Searched = z.infer<typeof searchedSchema>
export type Suggestion = z.infer<typeof suggestionSchema>
export type AskResponse = z.infer<typeof askResponseSchema>
export type NovaTurn = z.infer<typeof turnSchema>
export type ConversationSummary = z.infer<typeof conversationSummarySchema>
export type ConversationDetail = z.infer<typeof conversationDetailSchema>
export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>

/** The page the question is asked from (contract: any subset; unknown keys are a 422). */
export interface NovaContext {
  lead_id?: number
  project_ref?: string
  customer_id?: number
}

export interface AskRequest {
  question: string
  conversation_id?: string
  context?: NovaContext
}
