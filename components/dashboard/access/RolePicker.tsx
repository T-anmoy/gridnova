'use client'

import { useId } from 'react'
import type { Role } from '@/lib/dashboard/types'
import type { AccessRole } from '@/lib/access/types'
import { SECOND_APPROVAL_ROLES } from '@/lib/access/roles'
import { toggleRole } from '@/lib/access/staff-logic'

/**
 * Multi-select of roles, each with the matrix's own label and description. Only the roles
 * the signed-in person may assign are passed in; ticking one of the exclusive roles
 * unticks the others. Admin and Accounts carry the second-approval note (§5).
 */
export function RolePicker({
  options,
  selected,
  exclusive,
  onChange,
  error,
  legend = 'Roles',
}: {
  options: AccessRole[]
  selected: Role[]
  exclusive: Role[]
  onChange: (roles: Role[]) => void
  error?: string | null
  legend?: string
}) {
  const id = useId()
  return (
    <fieldset aria-describedby={error ? `${id}-error` : undefined} data-testid="role-picker">
      <legend className="font-utility text-sm font-medium text-[#091c3c]">{legend}</legend>
      <p className="mt-0.5 text-xs text-[#111827]/60">A person may hold several roles; only one of Sales, Engineer and Operations.</p>
      <ul className="mt-2 space-y-2">
        {options.map((r) => {
          const checked = selected.includes(r.id)
          return (
            <li key={r.id}>
              <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${checked ? 'border-[#0e2a63] bg-[#0e2a63]/[0.04]' : 'border-[#e4e8ee] hover:bg-[#f7f9fc]'}`}>
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#0e2a63]"
                  checked={checked}
                  onChange={() => onChange(toggleRole(selected, r.id, exclusive))}
                  data-testid={`role-option-${r.id}`}
                />
                <span className="min-w-0">
                  <span className="block font-utility text-sm font-medium text-[#091c3c]">{r.label}</span>
                  <span className="block text-xs text-[#111827]/65">{r.description}</span>
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[#111827]/55">
                    {r.requires_two_factor && <span>Needs two-step verification</span>}
                    {SECOND_APPROVAL_ROLES.includes(r.id) && <span className="font-medium text-amber-800">Needs a second Admin’s approval</span>}                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </fieldset>
  )
}
