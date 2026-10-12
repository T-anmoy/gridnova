// GET/POST /api/v1/proposals/accept/{token} as documented in BE-1 §3.
export const ACCEPT_VIEW_FIXTURE = {
  proposal_id: 7,
  version: 2,
  scope: [{ id: 'commercial_rooftop_scope', body: 'Structural assessment and system design.' }],
  price: 450000,
  valid_until: '2026-12-01T00:00:00',
  state: 'acceptable',
  accepted_at: null,
  pdf_available: true,
}

export const ACCEPT_POST_FIXTURE = {
  status: 'accepted',
  proposal_id: 7,
  accepted_at: '2026-10-12T05:00:00+00:00',
  already_accepted: false,
}

/** 409/404 bodies: structured `{detail: {code, message}}` (BE-1 §3, BE-2). */
export const conflict = (code: string, message = 'x') => ({ detail: { code, message } })
