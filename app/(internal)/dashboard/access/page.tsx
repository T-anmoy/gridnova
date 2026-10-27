'use client'

import { Fragment, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { AccessTabs } from '@/components/dashboard/access/AccessTabs'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAccessMatrix } from '@/lib/access/api'
import { groupMatrix, holds } from '@/lib/access/matrix-view'
import { rolesLine, sortRoles } from '@/lib/access/roles'
import { usePermissions } from '@/lib/access/use-permissions'

const ALL = 'all'

// GET /access/matrix — read-only, any staff (access_control.md §2).
export default function WhoCanDoWhatPage() {
  const { data, isLoading, error, refetch } = useAccessMatrix()
  const { roles: myRoles } = usePermissions()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState(ALL)

  const roles = data ? sortRoles(data.roles.map((r) => r.id)).map((id) => data.roles.find((r) => r.id === id)!) : []
  const shownRoles = roleFilter === ALL ? roles : roles.filter((r) => r.id === roleFilter)
  const groups = data ? groupMatrix(data, query, roleFilter === ALL ? null : roleFilter) : []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">Who can do what</h1>
        <p className="mt-1 font-utility text-sm text-[#111827]/65">
          Each role is a bundle of permissions; a person holding several roles can do everything any of them allows.
          {myRoles.length > 0 && <> You hold <strong>{rolesLine(myRoles, data)}</strong>.</>} Ask an Admin to change roles.
        </p>
      </div>
      <AccessTabs />

      {error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <section aria-labelledby="roles-heading" className="space-y-2">
            <h2 id="roles-heading" className="sr-only">Roles</h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {roles.map((r) => (
                <li key={r.id} className="rounded-xl border border-[#e4e8ee] bg-white p-4" data-testid={`role-card-${r.id}`}>
                  <p className="font-utility text-sm font-semibold text-[#091c3c]">{r.label}</p>
                  <p className="mt-1 text-xs text-[#111827]/70">{r.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-[11px]">{r.permissions.length} permissions</Badge>
                    {r.requires_two_factor && <Badge variant="amber" className="text-[11px]">Two-step sign-in</Badge>}
                    {r.can_assign_roles.length > 0 && <Badge variant="blue" className="text-[11px]">Gives: {rolesLine(r.can_assign_roles, data)}</Badge>}
                    {data.exclusive_roles.includes(r.id) && <Badge variant="outline" className="text-[11px]">One of Sales / Engineer / Operations</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="matrix-search">Search permissions</Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#111827]/45" aria-hidden="true" />
                <Input id="matrix-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. payout, approve, lead" className="min-h-[44px] pl-9" />
              </div>
            </div>
            <div className="sm:w-56">
              <Label htmlFor="matrix-role">Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger id="matrix-role" className="mt-1 min-h-[44px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Every role</SelectItem>
                  {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="text-sm text-[#111827]/60" data-testid="matrix-no-match">No permission matches “{query}”.</p>
          ) : (
            <Card>
              <div className="relative w-full overflow-auto">
                <table className="w-full min-w-[640px] text-sm font-utility" data-testid="access-matrix">
                  <caption className="sr-only">Permissions by role. A tick means the role holds the permission.</caption>
                  <thead>
                    <tr className="border-b border-[#e4e8ee] text-left text-xs text-[#111827]/65">
                      <th scope="col" className="sticky left-0 z-10 bg-white p-3 font-medium">Permission</th>
                      {shownRoles.map((r) => <th key={r.id} scope="col" className="p-3 text-center font-medium">{r.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <Fragment key={g.area}>
                        <tr className="bg-[#f7f9fc]">
                          <th scope="colgroup" colSpan={shownRoles.length + 1} className="sticky left-0 p-3 text-left text-xs font-semibold uppercase tracking-wide text-[#0e2a63]">{g.area}</th>
                        </tr>
                        {g.permissions.map((p) => (
                          <tr key={p.id} className="border-b border-[#e4e8ee] last:border-0" data-testid={`perm-${p.id}`}>
                            <th scope="row" className="sticky left-0 z-10 max-w-[16rem] bg-white p-3 text-left font-normal">
                              <span className="block text-[#091c3c]">{p.description}</span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#111827]/55">
                                <code>{p.id}</code>
                                {p.sensitive && <span className="font-medium text-amber-800">Two-step sign-in</span>}
                              </span>
                            </th>
                            {shownRoles.map((r) => (
                              <td key={r.id} className="p-3 text-center">
                                {holds(r, p.id) ? (
                                  <Check className="mx-auto h-4 w-4 text-green-700" aria-label={`${r.label}: yes`} />
                                ) : (
                                  <span className="text-[#111827]/25" aria-label={`${r.label}: no`}>—</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
