// FE-18: seeds a development backend with the Proposal Studio records the visual matrix opens
// (tests/visual/matrix.ts, FE18), through the API with the development identity headers:
//   1. an issued 3 kWp residential proposal (its online token and verification code),
//   2. a residential draft with a warning to check,
//   3. a 52 kWp commercial proposal sent for approval (above the ₹5,00,000 threshold),
//   plus a Library note, a customer-scope item, a set of BOQ rows and a template.
// Prints the VISUAL_STUDIO_* variables to export before `npm run test:visual`.
//
//   node tests/visual/seed-studio.mjs            (VISUAL_BACKEND, default http://127.0.0.1:8000)
//
// Needs a backend in development mode with working storage (issue stores the PDF) and a
// Fernet key. Every name and number is invented (the backend's own sample set).

const BACKEND = (process.env.VISUAL_BACKEND ?? 'http://127.0.0.1:8000').replace(/\/+$/, '')
const D = `${BACKEND}/api/v1/dashboard/studio`
const DESK = { 'X-Employee-Id': 'visual-proposal_desk', 'X-Employee-Role': 'proposal_desk' }

async function call(method, url, body) {
  const res = await fetch(url, { method, headers: { ...DESK, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

async function edit(id, section, value) {
  const view = await call('GET', `${D}/proposals/${id}`)
  return call('PATCH', `${D}/proposals/${id}/document`, { base_revision: view.revision, section, value })
}

async function acknowledgeAll(id) {
  const view = await call('GET', `${D}/proposals/${id}`)
  if (view.warnings_unacknowledged.length) await call('POST', `${D}/proposals/${id}/acknowledge-warnings`, { fingerprints: view.warnings_unacknowledged })
}

const lines = ['12 Example Lane, Habra', 'North 24 Parganas, West Bengal – 743263']
const customer = (await call('POST', `${D}/customers`, { customer_type: 'individual', title: 'Mr.', name: 'Test Kumar Das', mobile: '9830000001', email: 'test.customer@example.in', address_lines: lines })).customer

async function residential(extra = []) {
  const view = await call('POST', `${D}/proposals`, { customer_id: customer.id, project_type: 'residential_rooftop' })
  const id = view.proposal.id
  for (const [section, value] of [
    ['site', { address_lines: lines, town: 'Habra', state: 'West Bengal' }],
    ['connection', { discom: 'WBSEDCL', consumer_number: '100000001', sub_division: 'Habra CCC', category: 'Residential', phase: 'single', sanctioned_load_kw: '3.52' }],
    ['plant', { capacity_kwp: '3', package: 'NOVA_ASSURED', dcr: true }],
    ['pm_surya_ghar', { subsidy_opted: true, portal_registered: true, approved_capacity_kwp: '3' }],
    ['price', { mode: 'price_list' }],
    ...extra,
  ]) await edit(id, section, value)
  return id
}

// 1. Issued
const issuedId = await residential()
await acknowledgeAll(issuedId)
const issued = await call('POST', `${D}/proposals/${issuedId}/issue`)
const token = issued.public_url.split('/').pop()
const code = issued.version.verification_code

// 2. Draft with a warning (plant above the sanctioned load)
const draftId = await residential([['connection', { discom: 'WBSEDCL', consumer_number: '100000001', category: 'Residential', phase: 'single', sanctioned_load_kw: '2' }]])

// 3. Awaiting approval
const org = (await call('POST', `${D}/customers`, { customer_type: 'organisation', title: 'M/s', name: 'Example Metal Works', attention: 'Mr. Test Director (Director)', mobile: '9830012345', address_lines: ['1, Example Road', 'Kolkata – 700006, West Bengal'] })).customer
const pending = await call('POST', `${D}/proposals`, { customer_id: org.id, project_type: 'commercial_rooftop' })
const pendingId = pending.proposal.id
for (const [section, value] of [
  ['site', { address_lines: ['Example Mouza, Example Village', 'Dist. – Howrah – 711401, West Bengal'], town: 'Amta, Howrah', state: 'West Bengal' }],
  ['connection', { category: 'Commercial', phase: 'three', sanctioned_load_kw: '60', discom: 'WBSEDCL' }],
  ['plant', { capacity_kwp: '52', package: null, dcr: false }],
  ['price', { mode: 'staff_basic', basic: '2860000' }],
]) await edit(pendingId, section, value)
await acknowledgeAll(pendingId)
await call('POST', `${D}/proposals/${pendingId}/submit`)

// Library
await call('POST', `${D}/library`, { kind: 'note', name: 'Net metering', body: { text: 'Net metering is applied for by Grid Nova on the customer’s behalf.' } })
await call('POST', `${D}/library`, { kind: 'customer_scope_item', name: 'Storage', body: { text: 'Provide safe storage for the material on receipt at site.' } })
await call('POST', `${D}/library`, { kind: 'boq_preset', name: 'Earthing set', body: { rows: [{ description: 'Earthing kit with chemical earthing', quantity: '3 Sets', make: 'Equivalent' }] } })
await call('POST', `${D}/proposals/${issuedId}/save-as-template`, { name: '3 kW residential, PM Surya Ghar' })

console.log(`export VISUAL_STUDIO_ISSUED_ID=${issuedId} VISUAL_STUDIO_DRAFT_ID=${draftId} VISUAL_STUDIO_PENDING_ID=${pendingId} VISUAL_STUDIO_CUSTOMER_ID=${customer.id} VISUAL_STUDIO_TOKEN=${token} VISUAL_STUDIO_CODE=${code}`)
