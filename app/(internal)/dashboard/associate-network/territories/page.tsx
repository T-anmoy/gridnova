'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { ShieldOff } from 'lucide-react'
import { useAdminTerritories, useTerritorySeats, useReleaseTerritorySeat } from '@/lib/associate/api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/dashboard/utils'
import type { AssociateLevel, TerritorySeat } from '@/lib/associate/types'
import type { Role } from '@/lib/dashboard/types'

const LEVELS: AssociateLevel[] = ['state_head', 'district_head', 'block']

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.detail || err.message
  if (err instanceof Error) return err.message
  return fallback
}

export default function TerritoriesPage() {
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined

  const [stateLgd, setStateLgd] = useState<number | undefined>(undefined)
  const [levelFilter, setLevelFilter] = useState<AssociateLevel | ''>('')
  const [showReleased, setShowReleased] = useState(false)
  const [releaseTarget, setReleaseTarget] = useState<TerritorySeat | null>(null)
  const [reason, setReason] = useState('')

  const { data: states } = useAdminTerritories('states')
  const { data: seats, isLoading, error, refetch } = useTerritorySeats({
    state_lgd_code: stateLgd,
    level: levelFilter || undefined,
    include_released: showReleased,
  })
  const releaseSeat = useReleaseTerritorySeat()

  if (role && role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <ShieldOff className="h-12 w-12 text-[#111827]/20 mx-auto mb-4" />
          <p className="font-display text-lg font-semibold text-[#091c3c]">Access Denied</p>
        </div>
      </div>
    )
  }

  async function confirmRelease() {
    if (!releaseTarget || !reason.trim()) return
    try {
      await releaseSeat.mutateAsync({ seatId: releaseTarget.seat_id, reason: reason.trim() })
      toast.success('Seat released')
      setReleaseTarget(null)
      setReason('')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to release seat'))
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">Territories &amp; Seats</h1>
          <p className="font-utility text-sm text-[#111827]/50 mt-1">State Head, District Head and Block seat holders</p>
        </div>
        <Link href="/dashboard/associate-network" className="btn-text font-utility text-sm text-[#0e2a63]">← Applications</Link>
      </div>

      <Card className="mb-4">
        <div className="p-4 flex flex-wrap items-center gap-3">
          <Select value={stateLgd ? String(stateLgd) : 'all'} onValueChange={(v) => setStateLgd(v === 'all' ? undefined : Number(v))}>
            <SelectTrigger className="w-52"><SelectValue placeholder="All states" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {(states ?? []).map((s) => (
                <SelectItem key={s.lgd_code} value={String(s.lgd_code)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={levelFilter || 'all'} onValueChange={(v) => setLevelFilter(v === 'all' ? '' : (v as AssociateLevel))}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All levels" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l}>{l.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 font-utility text-sm text-[#111827]/60">
            <input type="checkbox" checked={showReleased} onChange={(e) => setShowReleased(e.target.checked)} className="h-4 w-4" />
            Include released seats
          </label>
        </div>
      </Card>

      {error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Territory</TableHead>
                <TableHead>Seat</TableHead>
                <TableHead>Holder</TableHead>
                <TableHead>Claimed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                : (seats ?? []).length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 font-utility text-[#111827]/40">No seats found</TableCell>
                    </TableRow>
                  )
                : (seats ?? []).map((seat) => (
                    <TableRow key={seat.seat_id} className={seat.released_at ? 'opacity-50' : undefined}>
                      <TableCell className="font-utility text-sm">{seat.level.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="font-utility text-sm">{seat.territory}</TableCell>
                      <TableCell className="font-utility text-sm text-[#111827]/60">#{seat.seat_no}</TableCell>
                      <TableCell>
                        {seat.holder ? (
                          <div>
                            <p className="font-utility text-sm text-[#091c3c]">{seat.holder.full_name}</p>
                            <Badge variant={seat.holder.status === 'active' ? 'green' : 'amber'} className="mt-1">{seat.holder.status}</Badge>
                          </div>
                        ) : (
                          <span className="font-utility text-sm text-[#111827]/40">Vacant</span>
                        )}
                      </TableCell>
                      <TableCell className="font-utility text-sm text-[#111827]/60">
                        {seat.released_at ? `Released ${formatDate(seat.released_at)}` : seat.claimed_at ? formatDate(seat.claimed_at) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {seat.holder && !seat.released_at && seat.holder.status !== 'active' && (
                          <Button variant="outline" size="sm" onClick={() => setReleaseTarget(seat)}>Release</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!releaseTarget} onOpenChange={(open) => { if (!open) { setReleaseTarget(null); setReason('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release seat #{releaseTarget?.seat_no}</DialogTitle>
            <DialogDescription>
              {releaseTarget?.holder?.status === 'active'
                ? 'The holder must be suspended before their seat can be released.'
                : 'A reason is required.'}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason for release…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => void confirmRelease()}
              disabled={!reason.trim() || releaseSeat.isPending || releaseTarget?.holder?.status === 'active'}
            >
              {releaseSeat.isPending ? 'Releasing…' : 'Confirm release'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
