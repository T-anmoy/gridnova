import { describe, it, expect } from 'vitest'
import { loadOpenApi, requestSchema, responseSchema, validate } from './helpers/openapi'
import { ARCHIVE_ANSWER, CONVERSATION_DETAIL, CONVERSATION_LIST, FEEDBACK_RESPONSE, NEEDS_CLARIFICATION, NOT_ON_RECORD, REFUSED } from './fixtures/nova-contract'
import { BATCH_ACTIVE, BATCH_VOIDED, CARD, COMMITTED, DOSSIER, DRY_RUN, PAGE, STATS } from './fixtures/archive-contract'
import {
  askResponseSchema, conversationDetailSchema, conversationListSchema, feedbackResponseSchema,
} from '@/lib/nova/schemas'
import {
  archiveStatsSchema, batchDetailSchema, batchListSchema, batchSummarySchema, importReportSchema, projectDossierSchema, projectPageSchema,
} from '@/lib/archive/schemas'

const spec = loadOpenApi()
const NOVA = '/api/v1/dashboard/nova'
const ARCHIVE = '/api/v1/dashboard/archive'
const wire = (v: unknown) => JSON.parse(JSON.stringify(v))

function expectResponse(route: string, method: string, body: unknown) {
  const schema = responseSchema(spec, route, method)
  expect(schema, `${method} ${route} has no response schema`).toBeDefined()
  expect(validate(spec, schema!, wire(body))).toEqual([])
}

describe('the shared FE-7 fixtures satisfy docs/api/openapi.json', () => {
  it.each([
    ['answered', ARCHIVE_ANSWER],
    ['not_on_record', NOT_ON_RECORD],
    ['needs_clarification', NEEDS_CLARIFICATION],
    ['refused', REFUSED],
  ])('POST /nova/ask — %s', (_n, body) => expectResponse(`${NOVA}/ask`, 'post', body))

  it('GET /nova/conversations and /{id}, POST /turns/{id}/feedback', () => {
    expectResponse(`${NOVA}/conversations`, 'get', CONVERSATION_LIST)
    expectResponse(`${NOVA}/conversations/{conversation_id}`, 'get', CONVERSATION_DETAIL)
    expectResponse(`${NOVA}/turns/{turn_id}/feedback`, 'post', FEEDBACK_RESPONSE)
  })

  it('the ask, context and feedback request bodies', () => {
    const ask = requestSchema(spec, `${NOVA}/ask`, 'post')!
    expect(validate(spec, ask, { question: 'q', conversation_id: 'a'.repeat(32), context: { lead_id: 45, project_ref: 'GNE-WB-RES-2026-00125', customer_id: 12 } })).toEqual([])
    // unknown context keys are a 422 in the contract, so the frontend must never send one
    expect(validate(spec, ask, { question: 'q', context: { page: 'leads' } })).not.toEqual([])
    expect(validate(spec, requestSchema(spec, `${NOVA}/turns/{turn_id}/feedback`, 'post')!, { helpful: false, note: 'n' })).toEqual([])
  })

  it('archive: list, detail, stats, batches, import report, void', () => {
    expectResponse(`${ARCHIVE}/projects`, 'get', PAGE([CARD]))
    expectResponse(`${ARCHIVE}/projects/{project_id}`, 'get', DOSSIER)
    expectResponse(`${ARCHIVE}/stats`, 'get', STATS)
    expectResponse(`${ARCHIVE}/imports`, 'get', { items: [BATCH_ACTIVE, BATCH_VOIDED] })
    expectResponse(`${ARCHIVE}/imports`, 'post', DRY_RUN)
    expectResponse(`${ARCHIVE}/imports`, 'post', COMMITTED)
    expectResponse(`${ARCHIVE}/imports/{batch_id}`, 'get', { ...BATCH_ACTIVE, report: COMMITTED })
    expectResponse(`${ARCHIVE}/imports/{batch_id}/void`, 'post', BATCH_VOIDED)
    expect(validate(spec, requestSchema(spec, `${ARCHIVE}/imports/{batch_id}/void`, 'post')!, { reason: 'Wrong file' })).toEqual([])
  })
})

describe('the zod schemas accept exactly those contract shapes', () => {
  it('nova', () => {
    for (const body of [ARCHIVE_ANSWER, NOT_ON_RECORD, NEEDS_CLARIFICATION, REFUSED]) expect(askResponseSchema.safeParse(wire(body)).success).toBe(true)
    expect(conversationListSchema.safeParse(CONVERSATION_LIST).success).toBe(true)
    expect(conversationDetailSchema.safeParse(wire(CONVERSATION_DETAIL)).success).toBe(true)
    expect(feedbackResponseSchema.safeParse(FEEDBACK_RESPONSE).success).toBe(true)
  })

  it('archive', () => {
    expect(projectPageSchema.safeParse(wire(PAGE([CARD]))).success).toBe(true)
    expect(projectDossierSchema.safeParse(wire(DOSSIER)).success).toBe(true)
    expect(archiveStatsSchema.safeParse(STATS).success).toBe(true)
    expect(importReportSchema.safeParse(wire(DRY_RUN)).success).toBe(true)
    expect(batchSummarySchema.safeParse(BATCH_VOIDED).success).toBe(true)
    expect(batchListSchema.safeParse({ items: [BATCH_ACTIVE] }).success).toBe(true)
    expect(batchDetailSchema.safeParse(wire({ ...BATCH_ACTIVE, report: COMMITTED })).success).toBe(true)
  })

  it('rejects a response that breaks the contract (guards the guard)', () => {
    expect(askResponseSchema.safeParse({ ...ARCHIVE_ANSWER, status: 'maybe' }).success).toBe(false)
    expect(askResponseSchema.safeParse({ ...ARCHIVE_ANSWER, tables: [{ title: 't', columns: [{ key: 'a', label: 'A', type: 'currency' }], rows: [] }] }).success).toBe(false)
    expect(projectPageSchema.safeParse({ items: [], page: 1, page_size: 25 }).success).toBe(false)
    expect(importReportSchema.safeParse({ ...DRY_RUN, dry_run: 'yes' }).success).toBe(false)
  })

  it('keeps nullable fields nullable: a citation without a page, an undated row, a feedback-less turn', () => {
    const parsed = askResponseSchema.parse(wire(ARCHIVE_ANSWER))
    expect(parsed.citations[2].path).toBeNull()
    expect(parsed.tables[0].rows[1].commissioning_date).toBeNull()
    expect(conversationDetailSchema.parse(wire({ ...CONVERSATION_DETAIL, turns: [{ ...CONVERSATION_DETAIL.turns[0], feedback: { helpful: null, note: null, at: null } }] })).turns[0].feedback.helpful).toBeNull()
  })
})
