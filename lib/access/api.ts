'use client'

import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { apiFetch, notAuthenticatedError } from '@/lib/api/http'
import { shouldRetryQuery } from '@/lib/api/retry-policy'
import type { Employee, EmployeeMe, Role } from '@/lib/dashboard/types'
import type {
  AccessAlerts, AccessMatrix, ApprovalRequest, ApprovalStatus, DeactivateResponse, HandoverResponse, InvitationIn,
  InvitationStatus, PendingApproval, ReactivateResponse, ReassignResponse, RolesUpdated, StaffInvitation,
} from './types'

// BE-17 routes (docs/api/access_control.md), base /api/v1/dashboard.
const BASE = '/api/v1/dashboard'

export const ME_KEY = ['employee-me'] as const
const MATRIX_KEY = ['access-matrix'] as const
const ALERTS_KEY = ['access-alerts'] as const
const INVITATIONS_KEY = ['staff-invitations'] as const
const APPROVALS_KEY = ['approvals'] as const
const EMPLOYEES_KEY = ['employees'] as const

function useTokenGetter() {
  const { getToken } = useAuth()
  return async () => {
    const token = await getToken()
    if (!token) throw notAuthenticatedError()
    return token
  }
}

/**
 * Everything that may follow a change to who holds which role: your own permissions
 * (the change may be yours), the staff list, invitations and the approvals inbox.
 */
export function invalidateAccess(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ME_KEY })
  void qc.invalidateQueries({ queryKey: EMPLOYEES_KEY })
  void qc.invalidateQueries({ queryKey: INVITATIONS_KEY })
  void qc.invalidateQueries({ queryKey: APPROVALS_KEY })
}

/**
 * GET /employees/me — the one permissions source. Cached, refetched when the window
 * regains focus (a role change or deactivation takes effect on the next request, §1),
 * and never retried on a 4xx: `not_invited` / deactivated must show at once.
 */
export function useEmployeeMe(options?: { enabled?: boolean }) {
  const token = useTokenGetter()
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async ({ signal }) => apiFetch<EmployeeMe>(`${BASE}/employees/me`, await token(), { signal }),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: shouldRetryQuery,
    enabled: options?.enabled ?? true,
  })
}

/** GET /access/matrix — any staff. Changes only with a deploy, so it is cached for long. */
export function useAccessMatrix(options?: { enabled?: boolean }) {
  const token = useTokenGetter()
  return useQuery({
    queryKey: MATRIX_KEY,
    queryFn: async ({ signal }) => apiFetch<AccessMatrix>(`${BASE}/access/matrix`, await token(), { signal }),
    staleTime: 30 * 60_000,
    enabled: options?.enabled ?? true,
  })
}

/** GET /access/alerts — any staff. */
export function useAccessAlerts() {
  const token = useTokenGetter()
  return useQuery({
    queryKey: ALERTS_KEY,
    queryFn: async ({ signal }) => apiFetch<AccessAlerts>(`${BASE}/access/alerts`, await token(), { signal }),
  })
}

// ── Staff list ───────────────────────────────────────────────────────────────

/** GET /employees — `staff.manage`. */
export function useStaff(options?: { enabled?: boolean }) {
  const token = useTokenGetter()
  return useQuery({
    queryKey: EMPLOYEES_KEY,
    queryFn: async ({ signal }) => apiFetch<Employee[]>(`${BASE}/employees`, await token(), { signal }),
    enabled: options?.enabled ?? true,
  })
}

// ── Invitations (§3) ─────────────────────────────────────────────────────────

export function useStaffInvitations(status?: InvitationStatus, options?: { enabled?: boolean }) {
  const token = useTokenGetter()
  return useQuery({
    queryKey: [...INVITATIONS_KEY, status ?? 'all'],
    queryFn: async ({ signal }) => {
      const qs = status ? `?status=${status}` : ''
      const res = await apiFetch<{ items: StaffInvitation[] }>(`${BASE}/staff/invitations${qs}`, await token(), { signal })
      return res.items
    },
    enabled: options?.enabled ?? true,
  })
}

/** 201 → the invitation; 202 → waiting for a second Admin (Admin or Accounts in `roles`). */
export function useInviteStaff() {
  const token = useTokenGetter()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: InvitationIn) =>
      apiFetch<StaffInvitation | PendingApproval>(`${BASE}/staff/invitations`, await token(), { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => invalidateAccess(qc),
  })
}

export function useResendInvitation() {
  const token = useTokenGetter()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (invitationId: string) =>
      apiFetch<StaffInvitation>(`${BASE}/staff/invitations/${encodeURIComponent(invitationId)}/resend`, await token(), { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: INVITATIONS_KEY }),
  })
}

export function useRevokeInvitation() {
  const token = useTokenGetter()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (invitationId: string) =>
      apiFetch<StaffInvitation>(`${BASE}/staff/invitations/${encodeURIComponent(invitationId)}`, await token(), { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: INVITATIONS_KEY }),
  })
}

// ── Roles, deactivation, handover (§4) ───────────────────────────────────────

/** PUT /employees/{id}/roles — the complete new set. 202 when Admin or Accounts moves. */
export function useSetEmployeeRoles() {
  const token = useTokenGetter()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ employeeId, roles }: { employeeId: string; roles: Role[] }) =>
      apiFetch<RolesUpdated | PendingApproval>(`${BASE}/employees/${encodeURIComponent(employeeId)}/roles`, await token(), {
        method: 'PUT',
        body: JSON.stringify({ roles }),
      }),
    onSuccess: () => invalidateAccess(qc),
  })
}

export function useHandover(employeeId: string | null) {
  const token = useTokenGetter()
  return useQuery({
    queryKey: ['employee-handover', employeeId],
    queryFn: async ({ signal }) => apiFetch<HandoverResponse>(`${BASE}/employees/${encodeURIComponent(employeeId!)}/handover`, await token(), { signal }),
    enabled: !!employeeId,
  })
}

export function useDeactivateStaff() {
  const token = useTokenGetter()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (employeeId: string) =>
      apiFetch<DeactivateResponse>(`${BASE}/employees/${encodeURIComponent(employeeId)}/deactivate`, await token(), { method: 'PATCH' }),
    onSuccess: () => invalidateAccess(qc),
  })
}

export function useReactivateStaff() {
  const token = useTokenGetter()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (employeeId: string) =>
      apiFetch<ReactivateResponse>(`${BASE}/employees/${encodeURIComponent(employeeId)}/reactivate`, await token(), { method: 'PATCH' }),
    onSuccess: () => invalidateAccess(qc),
  })
}

/** POST /employees/{id}/reassign — `staff.manage` and `leads.assign`. */
export function useReassignLeads() {
  const token = useTokenGetter()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ employeeId, toEmployeeId }: { employeeId: string; toEmployeeId: string }) =>
      apiFetch<ReassignResponse>(`${BASE}/employees/${encodeURIComponent(employeeId)}/reassign`, await token(), {
        method: 'POST',
        body: JSON.stringify({ to_employee_id: toEmployeeId }),
      }),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['employee-handover', v.employeeId] })
      void qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

// ── Second approval (§5) ─────────────────────────────────────────────────────

export function useApprovals(status?: ApprovalStatus, options?: { enabled?: boolean; refetchInterval?: number }) {
  const token = useTokenGetter()
  return useQuery({
    queryKey: [...APPROVALS_KEY, status ?? 'all'],
    queryFn: async ({ signal }) => {
      const qs = status ? `?status=${status}` : ''
      // The contract shows the request object but not the list envelope; accept both.
      const res = await apiFetch<{ items: ApprovalRequest[] } | ApprovalRequest[]>(`${BASE}/approvals${qs}`, await token(), { signal })
      return Array.isArray(res) ? res : (res.items ?? [])
    },
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
    refetchOnWindowFocus: true,
  })
}

type Decision = 'approve' | 'reject' | 'cancel'

export function useDecideApproval() {
  const token = useTokenGetter()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, decision, note }: { id: string; decision: Decision; note?: string }) =>
      apiFetch<ApprovalRequest>(`${BASE}/approvals/${encodeURIComponent(id)}/${decision}`, await token(), {
        method: 'POST',
        ...(decision === 'cancel' ? {} : { body: JSON.stringify(note ? { note } : {}) }),
      }),
    onSuccess: () => invalidateAccess(qc),
  })
}
