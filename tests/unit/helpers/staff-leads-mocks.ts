import { vi } from 'vitest'

// Idle stand-ins for the BE-6 hooks (schedule-meeting, customer memory, ask,
// reflect), for suites that render the lead detail page but are about
// something else. Use from a vi.mock factory:
//   vi.mock('@/lib/dashboard/staff-leads-api-client', async () => (await import('./helpers/staff-leads-mocks')).staffLeadsApiMock)
const idleMutation = () => ({ mutateAsync: vi.fn(), isPending: false })

export const staffLeadsApiMock = {
  useScheduleMeeting: idleMutation,
  useAskMemory: idleMutation,
  useReflectLead: idleMutation,
  useCustomerMemory: () => ({ data: undefined, isLoading: false, isFetching: false, error: null, refetch: vi.fn() }),
}
