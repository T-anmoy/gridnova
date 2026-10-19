'use client'

import { useState } from 'react'
import React from 'react'
import { useUser } from '@clerk/nextjs'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ShieldOff } from 'lucide-react'
import { useAuditLog } from '@/lib/dashboard/api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDatetime } from '@/lib/dashboard/utils'
import type { AuditLog, Role } from '@/lib/dashboard/types'

const ENTITY_TYPES = ['lead', 'proposal', 'employee', 'customer', 'audit_log']

const PAGE_SIZE = 50

export default function AuditLogPage() {
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined

  const [entityType, setEntityType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data, isLoading, error, refetch } = useAuditLog({
    entity_type: entityType || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    page,
    page_size: PAGE_SIZE,
  })

  // Restrict to admin/management via conditional render (not router.push)
  if (role && role !== 'admin' && role !== 'management') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <ShieldOff className="h-12 w-12 text-[#111827]/65 mx-auto mb-4" />
          <p className="font-display text-lg font-semibold text-[#091c3c]">Access Denied</p>
          <p className="font-utility text-sm text-[#111827]/65 mt-1">The audit log is only available to admins and management.</p>
        </div>
      </div>
    )
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function toggleExpand(id: number) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">Audit Log</h1>
        <p className="font-utility text-sm text-[#111827]/65 mt-1">{total} entries</p>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1) }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All entity types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All types</SelectItem>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-[#111827]/60">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="w-36" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-[#111827]/60">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="w-36" />
            </div>
            {(entityType || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setEntityType(''); setDateFrom(''); setDateTo(''); setPage(1) }}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : items.length === 0
                  ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 font-utility text-[#111827]/65">
                          No audit log entries found
                        </TableCell>
                      </TableRow>
                    )
                  : items.map((log: AuditLog) => (
                      <React.Fragment key={log.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-[#f7f9fc] transition-colors"
                          onClick={() => toggleExpand(log.id)}
                        >
                          <TableCell>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleExpand(log.id) }}
                              aria-expanded={expandedId === log.id}
                              aria-label={`${expandedId === log.id ? 'Hide' : 'Show'} changes for ${log.action}`}
                              className="flex h-8 w-8 items-center justify-center rounded text-[#111827]/65 hover:text-[#111827] focus-visible:outline-2 focus-visible:outline-[#2f5daa]"
                            >
                              {expandedId === log.id
                                ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                                : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                              }
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-utility text-xs">{log.entity_type}</Badge>
                          </TableCell>
                          <TableCell className="font-utility text-sm text-[#111827]/60">{String(log.entity_id)}</TableCell>
                          <TableCell className="font-utility text-sm font-medium text-[#091c3c]">{log.action}</TableCell>
                          <TableCell className="font-utility text-sm text-[#111827]/60">{log.performed_by}</TableCell>
                          <TableCell className="font-utility text-xs text-[#111827]/65">{formatDatetime(log.created_at)}</TableCell>
                        </TableRow>
                        {expandedId === log.id && (
                          <TableRow className="bg-[#f7f9fc]">
                            <TableCell colSpan={6} className="py-3 px-6">
                              <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                  <p className="font-utility text-xs font-semibold text-[#111827]/65 uppercase tracking-wider mb-1">Before</p>
                                  <pre className="font-utility text-xs text-[#111827] bg-white border border-[#e4e8ee] rounded p-3 overflow-x-auto max-h-40">
                                    {log.before_value != null ? JSON.stringify(log.before_value, null, 2) : '(none)'}
                                  </pre>
                                </div>
                                <div>
                                  <p className="font-utility text-xs font-semibold text-[#111827]/65 uppercase tracking-wider mb-1">After</p>
                                  <pre className="font-utility text-xs text-[#111827] bg-white border border-[#e4e8ee] rounded p-3 overflow-x-auto max-h-40">
                                    {log.after_value != null ? JSON.stringify(log.after_value, null, 2) : '(none)'}
                                  </pre>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="font-utility text-sm text-[#111827]/65">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
