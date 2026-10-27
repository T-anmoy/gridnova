// The permission ids the dashboard asks about (access_control.md §1, the full list is
// GET /access/matrix). A typed union so a misspelt id is a compile error rather than a
// control that silently never shows. The server decides; these only hide what the
// signed-in person cannot do.

export const PERMISSIONS = [
  // Leads
  'leads.view_all',
  'leads.view_assigned',
  'leads.view_commercial',
  'leads.view_technical',
  'leads.create',
  'leads.edit',
  'leads.change_stage',
  'leads.assign',
  'leads.be_assigned',
  'leads.stale_check.run',
  // Proposals
  'proposals.draft',
  'proposals.approve_standard',
  'proposals.manager_signoff',
  'proposals.partner_signoff',
  'proposals.send',
  'proposals.clear_reverification',
  'proposal_inputs.manage',
  'proposal_inputs.review',
  'pricing.adjust',
  // Customers, meetings, projects
  'customers.memory_query',
  'meetings.view',
  'meetings.view_all',
  'meetings.schedule',
  'meetings.host',
  'projects.record_stage',
  'analytics.view_full',
  // Associate network
  'associates.applications.review',
  'associates.attribution.resolve',
  'associates.seats.manage',
  'associates.network_summary.view',
  'territories.manage',
  'onboardings.view',
  'onboardings.view_all',
  'onboardings.verify',
  'surveys.view',
  'surveys.view_prices',
  'surveys.review',
  // Execution and service
  'execution.view',
  'execution.view_all',
  'execution.view_in_progress',
  'execution.verify',
  'execution.record',
  'execution.mode.switch',
  'execution.admin_override',
  'execution.dcr_override',
  'service_requests.handle',
  // Money
  'payments.view',
  'payments.view_all',
  'payments.record',
  'payments.process',
  'payments.segregation_override',
  'commissions.view',
  'commissions.process',
  'commissions.rates.manage',
  'commissions.individual_rates.view',
  'payouts.segregation_override',
  'payouts.bank_file.export',
  // Company setup and oversight
  'equipment.manage',
  'equipment.procurement_price.view',
  'placeholders.view',
  'placeholders.resolve',
  'archive.manage',
  'governance.manage',
  'records.conversations.read_any',
  'records.commissions.read',
  'audit.view',
  'audit.view_associates',
  'staff.manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

/** What a page or menu item needs: one permission, or any one of several. */
export type PermissionRule = Permission | readonly Permission[] | 'any_staff'

/** True when `granted` satisfies `rule`. `any_staff` = every signed-in employee. */
export function satisfies(granted: ReadonlySet<string>, rule: PermissionRule): boolean {
  if (rule === 'any_staff') return true
  if (typeof rule === 'string') return granted.has(rule)
  return rule.some((p) => granted.has(p))
}

type Can = (rule: PermissionRule) => boolean

/** Sees only their own and unassigned leads (the Sales lead scope). */
export const ownLeadsOnly = (can: Can): boolean => can('leads.view_assigned') && !can('leads.view_all')

/** Reads leads, proposals and surveys limited to technical fields (the Engineer view). */
export const technicalOnly = (can: Can): boolean => can('leads.view_technical') && !can('leads.view_commercial')
