// Copy for the staff Leads screens. The staff dashboard is English-only (a
// staff member who browsed the public site in Hindi must not see
// machine-translated text mixed into the dashboard), so this never reads the
// NEXT_LOCALE cookie. The hi/bn `staffLeads` keys stay in messages/ only so the
// i18n key-parity test keeps passing; they are not bundled into the dashboard.
import copy from './staff-leads-copy.generated.json'
import { fmt } from '@/lib/i18n/types'

export type StaffLeadsCopy = typeof copy.en
export { fmt }

export const staffLeadsCopy: StaffLeadsCopy = copy.en

export function useStaffLeadsCopy(): StaffLeadsCopy {
  return staffLeadsCopy
}
