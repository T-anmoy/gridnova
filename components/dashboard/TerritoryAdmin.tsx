'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { useAddTerritory, useAdminTerritories, useUpdateTerritory, type AdminTerritoryLevel } from '@/lib/associate/api-client'
import type { AdminTerritoryItem } from '@/lib/associate/types'
import { ApiError } from '@/lib/dashboard/api-error'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const LEVEL_LABEL: Record<AdminTerritoryLevel, string> = { states: 'States', districts: 'Districts', blocks: 'Blocks' }
const SINGULAR: Record<AdminTerritoryLevel, string> = { states: 'state', districts: 'district', blocks: 'block' }

// 409 (already exists / conflicts) and 422 (bad value) arrive as plain sentences
// or `field: message` lines from the shared transport — shown as the server
// said them, never as "[object Object]".
function friendly(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return 'Can’t reach the server — nothing was changed. Try again.'
    if (err.status === 403) return 'Only an Admin can change territories.'
    return err.detail || err.message
  }
  return err instanceof Error ? err.message : 'Something went wrong — nothing was changed.'
}

type Pending =
  | { kind: 'rename'; item: AdminTerritoryItem; name: string }
  | { kind: 'toggle'; item: AdminTerritoryItem }

/**
 * Admin-only maintenance of the territory list: add a district or block missing
 * from the seed data (by its official LGD code), rename a territory, or switch
 * one off / on. The LGD code is the territory's identity — it is entered once
 * when adding and is read-only everywhere after (the backend's PATCH accepts
 * only name and is_active). Switching a territory off stops it being offered on
 * the registration forms; existing applications, associates and seats keep it.
 */
export default function TerritoryAdmin() {
  const [level, setLevel] = useState<AdminTerritoryLevel>('states')
  const [stateLgd, setStateLgd] = useState<number | undefined>()
  const [districtLgd, setDistrictLgd] = useState<number | undefined>()
  const [adding, setAdding] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const { data: states } = useAdminTerritories('states')
  const { data: districts } = useAdminTerritories('districts', stateLgd)
  const parent = level === 'districts' ? stateLgd : level === 'blocks' ? districtLgd : undefined
  const list = useAdminTerritories(level, parent)
  const update = useUpdateTerritory()

  const needsParent = level !== 'states' && parent === undefined
  const items = list.data ?? []

  async function confirm() {
    if (!pending) return
    setDialogError(null)
    const { item } = pending
    try {
      if (pending.kind === 'rename') {
        await update.mutateAsync({ level, lgdCode: item.lgd_code, name: pending.name.trim() })
        toast.success(`Renamed to ${pending.name.trim()}`)
      } else {
        await update.mutateAsync({ level, lgdCode: item.lgd_code, is_active: !item.is_active })
        toast.success(`${item.name} switched ${item.is_active ? 'off' : 'on'}`)
      }
      setPending(null)
    } catch (err) {
      setDialogError(friendly(err))
    }
  }

  return (
    <section aria-labelledby="territory-admin-heading" className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="territory-admin-heading" className="font-display text-xl font-bold text-[#091c3c]">Manage territories</h2>
          <p className="font-utility text-sm text-[#111827]/65 mt-1">Add a missing district or block, rename one, or switch it off for new registrations.</p>
        </div>
        {level !== 'states' && (
          <Button size="sm" className="min-h-11 gap-1" disabled={needsParent} onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add {SINGULAR[level]}
          </Button>
        )}
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div role="tablist" aria-label="Territory level" className="flex gap-2">
            {(Object.keys(LEVEL_LABEL) as AdminTerritoryLevel[]).map((l) => (
              <Button key={l} role="tab" aria-selected={level === l} variant={level === l ? 'default' : 'outline'} size="sm" className="min-h-11" onClick={() => setLevel(l)}>
                {LEVEL_LABEL[l]}
              </Button>
            ))}
          </div>
          {level !== 'states' && (
            <Select value={stateLgd ? String(stateLgd) : ''} onValueChange={(v) => { setStateLgd(Number(v)); setDistrictLgd(undefined) }}>
              <SelectTrigger className="w-52" aria-label="State"><SelectValue placeholder="Choose a state" /></SelectTrigger>
              <SelectContent>{(states ?? []).map((s) => <SelectItem key={s.lgd_code} value={String(s.lgd_code)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {level === 'blocks' && (
            <Select value={districtLgd ? String(districtLgd) : ''} onValueChange={(v) => setDistrictLgd(Number(v))} disabled={!stateLgd}>
              <SelectTrigger className="w-52" aria-label="District"><SelectValue placeholder="Choose a district" /></SelectTrigger>
              <SelectContent>{(districts ?? []).map((d) => <SelectItem key={d.lgd_code} value={String(d.lgd_code)}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      </Card>

      {list.error ? (
        <DashboardError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>LGD code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {needsParent ? (
                <TableRow><TableCell colSpan={4} className="py-10 text-center font-utility text-sm text-[#111827]/65">Choose a {level === 'blocks' ? 'state and district' : 'state'} first.</TableCell></TableRow>
              ) : list.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 4 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-10 text-center font-utility text-sm text-[#111827]/65">None found.</TableCell></TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.lgd_code} data-testid="territory-row" className={item.is_active ? undefined : 'opacity-60'}>
                    <TableCell className="font-utility text-sm text-[#111827]/60">{item.lgd_code}</TableCell>
                    <TableCell className="font-utility text-sm">{item.name}</TableCell>
                    <TableCell><Badge variant={item.is_active ? 'green' : 'gray'}>{item.is_active ? 'Active' : 'Switched off'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="min-h-11" onClick={() => { setDialogError(null); setPending({ kind: 'rename', item, name: item.name }) }}>Rename</Button>
                        <Button variant="outline" size="sm" className="min-h-11" onClick={() => { setDialogError(null); setPending({ kind: 'toggle', item }) }}>
                          {item.is_active ? 'Switch off' : 'Switch on'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Rename / switch on-off — a confirm step for every change. */}
      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.kind === 'rename' ? `Rename ${pending.item.name}` : pending ? `${pending.item.is_active ? 'Switch off' : 'Switch on'} ${pending.item.name}` : ''}
            </DialogTitle>
            <DialogDescription>
              {pending?.kind === 'rename'
                ? `LGD code ${pending.item.lgd_code} does not change.`
                : pending?.item.is_active
                  ? 'It stops being offered on the registration forms. Existing applications, associates and seats keep it.'
                  : 'It will be offered on the registration forms again.'}
            </DialogDescription>
          </DialogHeader>
          {pending?.kind === 'rename' && (
            <div>
              <Label htmlFor="territory-name">New name</Label>
              <Input id="territory-name" value={pending.name} maxLength={200} autoComplete="off" onChange={(e) => setPending({ ...pending, name: e.target.value })} />
            </div>
          )}
          {dialogError && <p role="alert" className="font-utility text-sm text-red-600">{dialogError}</p>}
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setPending(null)}>Cancel</Button>
            <Button className="min-h-11" disabled={update.isPending || (pending?.kind === 'rename' && (!pending.name.trim() || pending.name.trim() === pending.item.name))} onClick={() => void confirm()}>
              {update.isPending ? 'Saving…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {adding && level !== 'states' && parent !== undefined && (
        <AddTerritoryDialog level={level} parentLgd={parent} parentName={level === 'districts' ? states?.find((s) => s.lgd_code === parent)?.name : districts?.find((d) => d.lgd_code === parent)?.name} onClose={() => setAdding(false)} />
      )}
    </section>
  )
}

function AddTerritoryDialog({ level, parentLgd, parentName, onClose }: { level: 'districts' | 'blocks'; parentLgd: number; parentName?: string; onClose: () => void }) {
  const add = useAddTerritory()
  const [lgd, setLgd] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const label = SINGULAR[level]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    // The same bounds the backend enforces: a positive integer LGD code, a 1–200 character name.
    if (!/^[1-9]\d*$/.test(lgd.trim())) return setError('Enter the official LGD code as a positive whole number.')
    if (!name.trim()) return setError('Enter a name.')
    try {
      const base = { lgd_code: Number(lgd.trim()), name: name.trim() }
      await add.mutateAsync(level === 'districts' ? { level, state_lgd_code: parentLgd, ...base } : { level, district_lgd_code: parentLgd, ...base })
      toast.success(`Added ${name.trim()}`)
      onClose()
    } catch (err) {
      setError(friendly(err))
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add a {label}{parentName ? ` to ${parentName}` : ''}</DialogTitle>
            <DialogDescription>For a {label} missing from the seed data. Use its official LGD code — it cannot be changed afterwards.</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="new-territory-lgd">LGD code *</Label>
            <Input id="new-territory-lgd" inputMode="numeric" autoComplete="off" value={lgd} onChange={(e) => setLgd(e.target.value)} aria-invalid={!!error && !/^[1-9]\d*$/.test(lgd.trim())} />
          </div>
          <div>
            <Label htmlFor="new-territory-name">Name *</Label>
            <Input id="new-territory-name" maxLength={200} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {error && <p role="alert" className="font-utility text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="min-h-11" disabled={add.isPending}>{add.isPending ? 'Adding…' : `Add ${label}`}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
