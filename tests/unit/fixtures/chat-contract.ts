// POST /api/v1/chat/message as documented in BE-1 §1
// (grid-nova-ai-backend docs/api/be1_public_contracts.md). Shared by the unit
// tests and the e2e mock so neither invents its own shape.
export const CHAT_REPLY_FIXTURE = {
  reply: 'Grid Nova offers Solar EPC and O&M across West Bengal.',
  session_token: 'q3Zk8v1mWmY2c7pQ0sJrT4u9XbLhN5aD6eFgHiJkLmN',
  is_qualified: false,
  missing_fields: ['project_type', 'location'],
  meeting_booked: null,
} as const

/** The deprecated ids the backend no longer returns and ignores if sent. */
export const CHAT_REMOVED_FIELDS = ['lead_id', 'customer_id', 'source'] as const
