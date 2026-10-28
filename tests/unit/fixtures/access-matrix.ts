// GET /access/matrix as BE-18 serves it (docs/api/access_control.md §2), written out from the
// backend's config/access_control.yaml at BE-18 (commit 7e45373) so tests run against the real
// bundles. Regenerate when the backend's yaml changes; tests/unit/fe17-contract.test.ts checks the
// shape against the contract.
import type { AccessMatrix } from '@/lib/access/types'

export const ACCESS_MATRIX: AccessMatrix = {
  "permissions": [
    {
      "id": "leads.view_all",
      "description": "See every lead (Engineers through technical-only views).",
      "sensitive": false
    },
    {
      "id": "leads.view_assigned",
      "description": "See leads assigned to you or to nobody.",
      "sensitive": false
    },
    {
      "id": "leads.view_commercial",
      "description": "See customer contact details and prices on leads and proposals.",
      "sensitive": false
    },
    {
      "id": "leads.view_technical",
      "description": "Read leads, proposals and surveys limited to technical fields.",
      "sensitive": false
    },
    {
      "id": "leads.create",
      "description": "Enter a new lead.",
      "sensitive": false
    },
    {
      "id": "leads.edit",
      "description": "Edit a lead's details.",
      "sensitive": false
    },
    {
      "id": "leads.change_stage",
      "description": "Move a lead on the opportunity tracker.",
      "sensitive": false
    },
    {
      "id": "leads.assign",
      "description": "Assign a lead to a salesperson.",
      "sensitive": false
    },
    {
      "id": "leads.be_assigned",
      "description": "Can be chosen as the person a lead is assigned to.",
      "sensitive": false
    },
    {
      "id": "leads.stale_check.run",
      "description": "Run the stale-lead check by hand.",
      "sensitive": false
    },
    {
      "id": "proposals.draft",
      "description": "Ask Nova to draft a proposal.",
      "sensitive": false
    },
    {
      "id": "proposals.approve_standard",
      "description": "Approve a proposal at the standard tier.",
      "sensitive": false
    },
    {
      "id": "proposals.manager_signoff",
      "description": "Give manager sign-off on a large proposal.",
      "sensitive": true
    },
    {
      "id": "proposals.partner_signoff",
      "description": "Give the highest (partner) approval tier.",
      "sensitive": true
    },
    {
      "id": "proposals.send",
      "description": "Send a proposal to the customer.",
      "sensitive": false
    },
    {
      "id": "proposals.clear_reverification",
      "description": "Clear a proposal flagged for re-verification after a survey change.",
      "sensitive": false
    },
    {
      "id": "proposal_inputs.manage",
      "description": "Create, upload to and draft from a site assessment.",
      "sensitive": false
    },
    {
      "id": "proposal_inputs.review",
      "description": "Review a site assessment.",
      "sensitive": false
    },
    {
      "id": "pricing.adjust",
      "description": "Adjust a proposal's price and read the price breakdown.",
      "sensitive": true
    },
    {
      "id": "studio.view",
      "description": "Open the Proposal Studio and your own Studio proposals.",
      "sensitive": false
    },
    {
      "id": "studio.view_all",
      "description": "See every Studio proposal, not only your own.",
      "sensitive": false
    },
    {
      "id": "studio.edit",
      "description": "Create Studio customers and proposals; edit, issue, deliver, revise, duplicate, mark accepted or lost.",
      "sensitive": false
    },
    {
      "id": "studio.price",
      "description": "Set and change a Studio proposal's price and discount.",
      "sensitive": true
    },
    {
      "id": "studio.approve",
      "description": "Approve or reject a Studio proposal prepared by someone else.",
      "sensitive": true
    },
    {
      "id": "studio.library.manage",
      "description": "Add, edit and retire Studio notes, scope items, BOQ presets and templates.",
      "sensitive": false
    },
    {
      "id": "studio.convert",
      "description": "Create a lead (and its proposal) from a Studio proposal.",
      "sensitive": false
    },
    {
      "id": "customers.memory_query",
      "description": "Ask Nova about a customer's history.",
      "sensitive": false
    },
    {
      "id": "meetings.view",
      "description": "See meetings.",
      "sensitive": false
    },
    {
      "id": "meetings.view_all",
      "description": "See every employee's meetings, not only your own.",
      "sensitive": false
    },
    {
      "id": "meetings.schedule",
      "description": "Book a meeting with a customer.",
      "sensitive": false
    },
    {
      "id": "meetings.host",
      "description": "Can be booked for customer meetings.",
      "sensitive": false
    },
    {
      "id": "projects.record_stage",
      "description": "Record hand-recorded progress stages (offline acceptance, portal approval).",
      "sensitive": false
    },
    {
      "id": "analytics.view_full",
      "description": "See company-wide analytics.",
      "sensitive": false
    },
    {
      "id": "associates.applications.review",
      "description": "Review, approve and reject associate applications; suspend, reinstate or deactivate associates.",
      "sensitive": true
    },
    {
      "id": "associates.attribution.resolve",
      "description": "Resolve an attribution conflict between two associates.",
      "sensitive": true
    },
    {
      "id": "associates.seats.manage",
      "description": "Release territory seats.",
      "sensitive": true
    },
    {
      "id": "associates.network_summary.view",
      "description": "See the associate network summary (aggregate revenue and commission figures).",
      "sensitive": false
    },
    {
      "id": "territories.manage",
      "description": "Create and edit districts and blocks.",
      "sensitive": true
    },
    {
      "id": "onboardings.view",
      "description": "See associate-sourced customers.",
      "sensitive": false
    },
    {
      "id": "onboardings.view_all",
      "description": "See every associate-sourced customer, not only those on your own leads.",
      "sensitive": false
    },
    {
      "id": "onboardings.verify",
      "description": "Record the staff verification call on an associate-sourced customer.",
      "sensitive": false
    },
    {
      "id": "surveys.view",
      "description": "Read site surveys.",
      "sensitive": false
    },
    {
      "id": "surveys.view_prices",
      "description": "See the indicative prices in a site survey's results.",
      "sensitive": false
    },
    {
      "id": "surveys.review",
      "description": "Review a site survey, apply or reject corrections, generate the survey report.",
      "sensitive": false
    },
    {
      "id": "execution.view",
      "description": "See project execution, submissions, photos and the serial register.",
      "sensitive": false
    },
    {
      "id": "execution.view_all",
      "description": "See execution on every project, not only your own leads.",
      "sensitive": false
    },
    {
      "id": "execution.view_in_progress",
      "description": "See execution on every project from agreement signed onwards.",
      "sensitive": false
    },
    {
      "id": "execution.verify",
      "description": "Verify or reject an associate's stage submission; verify the serial register.",
      "sensitive": false
    },
    {
      "id": "execution.record",
      "description": "Record a stage directly, upload evidence, act on the handover pack.",
      "sensitive": false
    },
    {
      "id": "execution.mode.switch",
      "description": "Take a project's execution over from the associate.",
      "sensitive": true
    },
    {
      "id": "execution.admin_override",
      "description": "Record a stage on an associate-run project, or change a verified serial register, with a reason.",
      "sensitive": true
    },
    {
      "id": "execution.dcr_override",
      "description": "Record why a project with a non-DCR module may still claim the subsidy.",
      "sensitive": true
    },
    {
      "id": "service_requests.handle",
      "description": "Raise, assign and progress warranty and O&M service requests.",
      "sensitive": false
    },
    {
      "id": "payments.view",
      "description": "See payments and the ledger.",
      "sensitive": false
    },
    {
      "id": "payments.view_all",
      "description": "See every customer's payments, not only your own leads'.",
      "sensitive": false
    },
    {
      "id": "payments.record",
      "description": "Record a payment.",
      "sensitive": false
    },
    {
      "id": "payments.process",
      "description": "Deposit, verify, dishonour or cancel payments; schedules, receipts, exports.",
      "sensitive": true
    },
    {
      "id": "payments.segregation_override",
      "description": "Verify a payment you recorded yourself, with a reason.",
      "sensitive": true
    },
    {
      "id": "commissions.view",
      "description": "See commission entries, rate schedules, payout batches and queries.",
      "sensitive": false
    },
    {
      "id": "commissions.process",
      "description": "Approve entries; prepare, approve and pay payout batches; commission exports.",
      "sensitive": true
    },
    {
      "id": "commissions.rates.manage",
      "description": "Publish rate schedules, re-rate pending entries, reverse entries, set individual rates.",
      "sensitive": true
    },
    {
      "id": "commissions.individual_rates.view",
      "description": "See an associate's individual rate and its history.",
      "sensitive": false
    },
    {
      "id": "payouts.segregation_override",
      "description": "Approve a payout batch you prepared yourself, with a reason.",
      "sensitive": true
    },
    {
      "id": "payouts.bank_file.export",
      "description": "Download the payout bank file (full account numbers).",
      "sensitive": true
    },
    {
      "id": "equipment.manage",
      "description": "Add and edit equipment in the catalogue.",
      "sensitive": false
    },
    {
      "id": "equipment.procurement_price.view",
      "description": "See equipment procurement prices.",
      "sensitive": false
    },
    {
      "id": "placeholders.view",
      "description": "See the placeholder registry.",
      "sensitive": false
    },
    {
      "id": "placeholders.resolve",
      "description": "Mark a placeholder as resolved.",
      "sensitive": true
    },
    {
      "id": "archive.manage",
      "description": "Import, void and list project-archive imports.",
      "sensitive": true
    },
    {
      "id": "governance.manage",
      "description": "Switch Nova's agents on and off.",
      "sensitive": true
    },
    {
      "id": "records.conversations.read_any",
      "description": "Read any employee's Nova Records conversation (audited).",
      "sensitive": false
    },
    {
      "id": "records.commissions.read",
      "description": "See commission figures through Nova Records.",
      "sensitive": false
    },
    {
      "id": "audit.view",
      "description": "Read the whole audit log and agent activity.",
      "sensitive": false
    },
    {
      "id": "audit.view_associates",
      "description": "Read the audit log for associate-network records only.",
      "sensitive": false
    },
    {
      "id": "staff.manage",
      "description": "Invite, change roles of, deactivate and reactivate staff (within the roles you may assign).",
      "sensitive": true
    }
  ],
  "roles": [
    {
      "id": "admin",
      "label": "Admin",
      "description": "Every power in the system except the payout bank file (hold Accounts as well for that).",
      "requires_two_factor": true,
      "can_assign_roles": [
        "admin",
        "sales",
        "management",
        "engineer",
        "operations",
        "accounts",
        "network_manager",
        "proposal_desk"
      ],
      "permissions": [
        "leads.view_all",
        "leads.view_assigned",
        "leads.view_commercial",
        "leads.view_technical",
        "leads.create",
        "leads.edit",
        "leads.change_stage",
        "leads.assign",
        "leads.be_assigned",
        "leads.stale_check.run",
        "proposals.draft",
        "proposals.approve_standard",
        "proposals.manager_signoff",
        "proposals.partner_signoff",
        "proposals.send",
        "proposals.clear_reverification",
        "proposal_inputs.manage",
        "proposal_inputs.review",
        "pricing.adjust",
        "studio.view",
        "studio.view_all",
        "studio.edit",
        "studio.price",
        "studio.approve",
        "studio.library.manage",
        "studio.convert",
        "customers.memory_query",
        "meetings.view",
        "meetings.view_all",
        "meetings.schedule",
        "meetings.host",
        "projects.record_stage",
        "analytics.view_full",
        "associates.applications.review",
        "associates.attribution.resolve",
        "associates.seats.manage",
        "associates.network_summary.view",
        "territories.manage",
        "onboardings.view",
        "onboardings.view_all",
        "onboardings.verify",
        "surveys.view",
        "surveys.view_prices",
        "surveys.review",
        "execution.view",
        "execution.view_all",
        "execution.view_in_progress",
        "execution.verify",
        "execution.record",
        "execution.mode.switch",
        "execution.admin_override",
        "execution.dcr_override",
        "service_requests.handle",
        "payments.view",
        "payments.view_all",
        "payments.record",
        "payments.process",
        "payments.segregation_override",
        "commissions.view",
        "commissions.process",
        "commissions.rates.manage",
        "commissions.individual_rates.view",
        "payouts.segregation_override",
        "equipment.manage",
        "equipment.procurement_price.view",
        "placeholders.view",
        "placeholders.resolve",
        "archive.manage",
        "governance.manage",
        "records.conversations.read_any",
        "records.commissions.read",
        "audit.view",
        "audit.view_associates",
        "staff.manage"
      ]
    },
    {
      "id": "management",
      "label": "Management",
      "description": "Oversight — reads everything commercial, gives manager sign-off, assigns leads.",
      "requires_two_factor": true,
      "can_assign_roles": [],
      "permissions": [
        "leads.view_all",
        "leads.view_commercial",
        "leads.create",
        "leads.change_stage",
        "leads.assign",
        "proposals.manager_signoff",
        "proposals.clear_reverification",
        "studio.view",
        "studio.view_all",
        "studio.approve",
        "customers.memory_query",
        "meetings.view",
        "meetings.view_all",
        "analytics.view_full",
        "associates.network_summary.view",
        "onboardings.view",
        "surveys.view",
        "surveys.view_prices",
        "execution.view",
        "execution.view_all",
        "payments.view",
        "payments.view_all",
        "commissions.view",
        "commissions.individual_rates.view",
        "equipment.procurement_price.view",
        "placeholders.view",
        "audit.view"
      ]
    },
    {
      "id": "network_manager",
      "label": "Network Manager",
      "description": "Runs the Associate Network, invites staff below Admin, opens any proposal and adjusts its price. No proposal approval or sending, payments, commission rates or company settings.",
      "requires_two_factor": true,
      "can_assign_roles": [
        "sales",
        "engineer",
        "operations"
      ],
      "permissions": [
        "leads.view_all",
        "leads.view_commercial",
        "pricing.adjust",
        "associates.applications.review",
        "associates.attribution.resolve",
        "associates.seats.manage",
        "associates.network_summary.view",
        "territories.manage",
        "onboardings.view",
        "onboardings.view_all",
        "surveys.view",
        "audit.view_associates",
        "staff.manage"
      ]
    },
    {
      "id": "sales",
      "label": "Sales",
      "description": "Works their own and unassigned leads through to a sent proposal.",
      "requires_two_factor": false,
      "can_assign_roles": [],
      "permissions": [
        "leads.view_assigned",
        "leads.view_commercial",
        "leads.create",
        "leads.edit",
        "leads.change_stage",
        "leads.be_assigned",
        "proposals.draft",
        "proposals.approve_standard",
        "proposals.send",
        "proposal_inputs.manage",
        "proposal_inputs.review",
        "pricing.adjust",
        "customers.memory_query",
        "meetings.view",
        "meetings.schedule",
        "meetings.host",
        "projects.record_stage",
        "onboardings.view",
        "onboardings.verify",
        "surveys.view",
        "surveys.view_prices",
        "execution.view",
        "payments.view",
        "payments.record",
        "equipment.procurement_price.view"
      ]
    },
    {
      "id": "engineer",
      "label": "Engineer",
      "description": "Technical review — sees every lead's technical fields, never prices or contact details.",
      "requires_two_factor": false,
      "can_assign_roles": [],
      "permissions": [
        "leads.view_all",
        "leads.view_technical",
        "proposals.clear_reverification",
        "proposal_inputs.review",
        "surveys.view",
        "surveys.review",
        "execution.view",
        "execution.view_all",
        "service_requests.handle"
      ]
    },
    {
      "id": "operations",
      "label": "Operations",
      "description": "Runs project execution and service from agreement signed. Never money.",
      "requires_two_factor": false,
      "can_assign_roles": [],
      "permissions": [
        "execution.view",
        "execution.view_in_progress",
        "execution.verify",
        "execution.record",
        "service_requests.handle"
      ]
    },
    {
      "id": "accounts",
      "label": "Accounts",
      "description": "Runs payments, commissions and payouts, including the bank file.",
      "requires_two_factor": true,
      "can_assign_roles": [],
      "permissions": [
        "payments.view",
        "payments.view_all",
        "payments.record",
        "payments.process",
        "commissions.view",
        "commissions.process",
        "payouts.bank_file.export",
        "records.commissions.read"
      ]
    },
    {
      "id": "proposal_desk",
      "label": "Proposal Desk",
      "description": "Prepares, prices, issues and tracks proposals in the Proposal Studio. Nothing outside the Studio.",
      "requires_two_factor": false,
      "can_assign_roles": [],
      "permissions": [
        "studio.view",
        "studio.view_all",
        "studio.edit",
        "studio.price",
        "studio.library.manage",
        "studio.convert"
      ]
    }
  ],
  "exclusive_roles": [
    "sales",
    "engineer",
    "operations"
  ]
}

/** The alert events and their roles (access_control.md §6), without the live counts. */
export const ALERT_EVENTS = [
  {
    "event": "new_lead",
    "roles": [
      "admin",
      "management"
    ],
    "assigned_employee": true,
    "owner": false
  },
  {
    "event": "lead_qualified",
    "roles": [
      "admin",
      "management"
    ],
    "assigned_employee": true,
    "owner": false
  },
  {
    "event": "meeting_booked",
    "roles": [
      "admin"
    ],
    "assigned_employee": true,
    "owner": false
  },
  {
    "event": "stale_lead_digest",
    "roles": [
      "admin",
      "management"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "manager_signoff_required",
    "roles": [
      "admin",
      "management"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "customer_accepted",
    "roles": [
      "admin",
      "management"
    ],
    "assigned_employee": true,
    "owner": false
  },
  {
    "event": "formal_proposal_requested",
    "roles": [
      "admin"
    ],
    "assigned_employee": true,
    "owner": false
  },
  {
    "event": "survey_review_overdue",
    "roles": [
      "admin",
      "engineer"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "onboarding_overdue",
    "roles": [
      "admin",
      "network_manager"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "stage_submitted",
    "roles": [
      "operations"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "execution_stuck",
    "roles": [
      "admin",
      "operations"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "dcr_mismatch",
    "roles": [
      "admin",
      "operations"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "catalogue_unmatched",
    "roles": [
      "operations"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "handover_blocked",
    "roles": [
      "operations"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "service_request_raised",
    "roles": [
      "operations"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "service_requests_overdue",
    "roles": [
      "admin",
      "operations"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "payment_recorded",
    "roles": [
      "accounts"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "payment_dishonoured",
    "roles": [
      "admin",
      "accounts"
    ],
    "assigned_employee": true,
    "owner": false
  },
  {
    "event": "receipt_blocked",
    "roles": [
      "accounts"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "payments_attention",
    "roles": [
      "accounts"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "commission_queries_overdue",
    "roles": [
      "accounts"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "associate_application_submitted",
    "roles": [
      "admin",
      "network_manager"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "approval_requested",
    "roles": [],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "studio_approval_requested",
    "roles": [
      "admin",
      "management"
    ],
    "assigned_employee": false,
    "owner": false
  },
  {
    "event": "studio_viewed",
    "roles": [],
    "assigned_employee": false,
    "owner": true
  },
  {
    "event": "studio_accepted",
    "roles": [],
    "assigned_employee": false,
    "owner": true
  },
  {
    "event": "studio_declined",
    "roles": [],
    "assigned_employee": false,
    "owner": true
  },
  {
    "event": "studio_expiring",
    "roles": [],
    "assigned_employee": false,
    "owner": true
  },
  {
    "event": "studio_not_viewed",
    "roles": [],
    "assigned_employee": false,
    "owner": true
  }
] as const
