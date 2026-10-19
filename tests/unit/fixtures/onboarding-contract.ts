// POST /api/v1/associate/onboardings — the body the wizard sends when a new
// customer is created (openapi.json `OnboardingCreate`). Shared by the wizard
// payload test and the contract drift guard.
export const ONBOARDING_CREATE_BODY = {
  notice_version: 'v1',
  notice_acknowledged: true,
  customer_name: 'Asha Roy',
  customer_mobile: '9876543210',
  customer_type: 'individual',
  project_family: 'rooftop_solar',
  pin_code: '700016',
  full_address: '12 Park Street',
  site_type: 'rooftop_residential',
  connection_type: 'on_grid',
  state_lgd_code: 19,
  district_lgd_code: 330,
  connection_in_customer_name: true,
  property_in_customer_name: false,
  customer_timeline: 'within_3_months',
  equipment_package: 'dcr',
} as const

/** PATCH …/onboardings/{id} — a step that changed one field. */
export const ONBOARDING_PATCH_NAME = { customer_name: 'New Name' } as const
