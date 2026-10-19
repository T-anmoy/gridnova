// Response and request shapes copied from docs/api/nova_records.md (BE-9). Real shapes, shared by the FE-7 suites;
// fe7-contract.test.ts checks them against docs/api/openapi.json.
import type { AskResponse, NovaTurn, ConversationDetail } from '@/lib/nova/schemas'

export const ARCHIVE_ANSWER: AskResponse = {
  conversation_id: '4b0e5c4b0e5c4b0e5c4b0e5c4b0e5c4b',
  turn_id: 'c71d0ac71d0ac71d0ac71d0ac71d0a00',
  status: 'answered',
  answer:
    'Found 2 projects matching district Howrah, at least 5 kW.\n[GN-ARC-0102] 10.000 kW; commercial; Howrah, West Bengal; commissioned 2025-07-01\n[GN-ARC-0101] 5.000 kW; Howrah, West Bengal\nSee [UNLISTED-1] and <b>bold</b> <script>alert(1)</script>',
  citations: [
    { ref: 'GN-ARC-0102', kind: 'archive_project', label: '10.000 kW, Howrah, West Bengal', path: '/dashboard/archive/2' },
    { ref: 'GN-ARC-0101', kind: 'archive_project', label: '5.000 kW, Howrah, West Bengal', path: '/dashboard/archive/1' },
    { ref: 'C12', kind: 'customer', label: 'Kabir Das', path: null },
  ],
  tables: [
    {
      title: 'Projects',
      columns: [
        { key: 'ref', label: 'Reference', type: 'ref' },
        { key: 'capacity_kw', label: 'Capacity (kW)', type: 'kw' },
        { key: 'contract_value', label: 'Contract value', type: 'money' },
        { key: 'commissioning_date', label: 'Commissioned', type: 'date' },
        { key: 'dcr', label: 'DCR', type: 'boolean' },
        { key: 'units', label: 'Units', type: 'number' },
        { key: 'customer', label: 'Customer', type: 'text' },
      ],
      rows: [
        { ref: 'GN-ARC-0102', capacity_kw: '10.000', contract_value: '1234567.50', commissioning_date: '2025-07-01', dcr: true, units: 4, customer: '=HYPERLINK("http://evil","x")' },
        { ref: 'GN-ARC-0101', capacity_kw: '5.000', contract_value: '-250.00', commissioning_date: null, dcr: false, units: 2, customer: '@SUM(A1)' },
      ],
    },
  ],
  searched: [
    {
      tool: 'search_projects',
      filters: { district: 'Howrah', capacity_min_kw: '5' },
      summary: 'district Howrah, at least 5 kW',
    },
  ],
  suggestions: [
    { label: 'Open the first result', question: null, path: '/dashboard/archive/2' },
    { label: 'Totals by district', question: 'How many of these projects are there by district?', path: null },
  ],
  generated_at: '2026-10-17T11:02:44.120371+00:00',
}

export const NOT_ON_RECORD: AskResponse = {
  conversation_id: ARCHIVE_ANSWER.conversation_id,
  turn_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
  status: 'not_on_record',
  answer: 'Nothing on record that you can see matches district Atlantis. Try a broader search — drop a filter or check the spelling.',
  citations: [],
  tables: [],
  searched: [{ tool: 'search_projects', filters: { district: 'Atlantis' }, summary: 'district Atlantis' }],
  suggestions: [],
  generated_at: '2026-10-17T11:05:00+00:00',
}

export const NEEDS_CLARIFICATION: AskResponse = {
  conversation_id: ARCHIVE_ANSWER.conversation_id,
  turn_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2',
  status: 'needs_clarification',
  answer: 'Several customers match “Das”. Which one do you mean?\n[C12] Kabir Das\n[C40] Bikash Das',
  citations: [
    { ref: 'C12', kind: 'customer', label: 'Kabir Das', path: null },
    { ref: 'C40', kind: 'customer', label: 'Bikash Das', path: null },
  ],
  tables: [],
  searched: [],
  suggestions: [],
  generated_at: '2026-10-17T11:06:00+00:00',
}

export const REFUSED: AskResponse = {
  conversation_id: ARCHIVE_ANSWER.conversation_id,
  turn_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa3',
  status: 'refused',
  answer: 'I can only read records — I can’t change, add, assign, approve or delete anything. Open the record in the dashboard to make that change.',
  citations: [],
  tables: [],
  searched: [],
  suggestions: [],
  generated_at: '2026-10-17T11:07:00+00:00',
}

export const HISTORY_TURN: NovaTurn = {
  turn_id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1',
  question: 'Which warranties end next month?',
  context: { project_ref: 'GNE-WB-RES-2026-00125' },
  status: 'answered',
  answer: 'One warranty ends next month. [GNE-WB-RES-2026-00125]',
  citations: [{ ref: 'GNE-WB-RES-2026-00125', kind: 'live_project', label: '3.000 kW, Nadia', path: '/dashboard/operations/5' }],
  tables: [],
  searched: [],
  suggestions: [],
  generated_at: '2026-10-16T09:00:00+00:00',
  feedback: { helpful: true, note: 'Spot on', at: '2026-10-16T09:05:00+00:00' },
}

export const CONVERSATION_DETAIL: ConversationDetail = {
  conversation_id: 'dddddddddddddddddddddddddddddddd',
  title: 'Which warranties end next month?',
  turn_count: 1,
  created_at: '2026-10-16T09:00:00+00:00',
  updated_at: '2026-10-16T09:00:00+00:00',
  employee_id: 'emp-admin-1',
  role: 'admin',
  turns: [HISTORY_TURN],
}

export const CONVERSATION_LIST = {
  items: [
    {
      conversation_id: CONVERSATION_DETAIL.conversation_id,
      title: CONVERSATION_DETAIL.title,
      turn_count: 1,
      created_at: CONVERSATION_DETAIL.created_at,
      updated_at: CONVERSATION_DETAIL.updated_at,
    },
  ],
}

export const FEEDBACK_RESPONSE = { turn_id: ARCHIVE_ANSWER.turn_id, helpful: true, note: 'Thanks', feedback_at: '2026-10-17T11:10:00+00:00' }
