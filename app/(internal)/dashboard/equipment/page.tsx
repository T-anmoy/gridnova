'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Filter, Package, Plus } from 'lucide-react'
import { useEquipment, useCreateEquipment, useSetEquipmentActive } from '@/lib/dashboard/api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/dashboard/utils'
import type { Equipment, EquipmentCategory } from '@/lib/dashboard/types'
import { usePermissions } from '@/lib/access/use-permissions'

const CATEGORIES: EquipmentCategory[] = ['module', 'inverter', 'structure', 'bos_component']

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  module: 'Module',
  inverter: 'Inverter',
  structure: 'Structure',
  bos_component: 'BOS Component',
}

const CATEGORY_BADGE: Record<EquipmentCategory, 'blue' | 'navy' | 'amber' | 'gray'> = {
  module: 'blue',
  inverter: 'navy',
  structure: 'amber',
  bos_component: 'gray',
}

// ApiError.message is a generic "API error 4xx" string — the backend's real
// detail lives in `.detail` and should be shown instead.
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.detail || err.message
  if (err instanceof Error) return err.message
  return fallback
}

const EMPTY_FORM = {
  brand: '',
  modelName: '',
  category: '' as EquipmentCategory | '',
  specification: '',
  isDcrCompliant: false,
  procurementPrice: '',
}

function AddEquipmentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const createEquipment = useCreateEquipment()

  function reset() {
    setForm(EMPTY_FORM)
  }

  async function handleSubmit() {
    if (!form.brand.trim() || !form.modelName.trim() || !form.category) return
    try {
      await createEquipment.mutateAsync({
        category: form.category,
        brand: form.brand.trim(),
        model_name: form.modelName.trim(),
        specification: form.specification.trim() || undefined,
        is_dcr_compliant: form.isDcrCompliant,
        procurement_price_inr: form.procurementPrice ? parseFloat(form.procurementPrice) : undefined,
      })
      toast.success(`${form.brand} ${form.modelName} added to the equipment master`)
      reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to add equipment'))
    }
  }

  const canSubmit = form.brand.trim() && form.modelName.trim() && form.category

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Equipment</DialogTitle>
          <DialogDescription>
            Add a module, inverter, structure or BOS component to the equipment master.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="eq-brand" className="text-xs text-[#111827]/60">Brand</Label>
              <Input
                id="eq-brand"
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                placeholder="Waaree"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="eq-model" className="text-xs text-[#111827]/60">Model Name</Label>
              <Input
                id="eq-model"
                value={form.modelName}
                onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
                placeholder="Vertex-540"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-[#111827]/60">Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v as EquipmentCategory }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select category…" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="eq-spec" className="text-xs text-[#111827]/60">Specification</Label>
            <Textarea
              id="eq-spec"
              value={form.specification}
              onChange={(e) => setForm((f) => ({ ...f, specification: e.target.value }))}
              placeholder="540W monocrystalline, 21.5% efficiency"
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[#e4e8ee] px-3 py-2.5">
            <div>
              <p className="font-utility text-sm text-[#091c3c]">DCR Compliant</p>
              <p className="font-utility text-xs text-[#111827]/65">Eligible for domestic-content-required schemes</p>
            </div>
            <Switch
              checked={form.isDcrCompliant}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, isDcrCompliant: checked }))}
              aria-label="DCR Compliant"
            />
          </div>

          <div>
            <Label htmlFor="eq-price" className="text-xs text-[#111827]/60">
              Procurement Price (₹)
              <span className="ml-1.5 normal-case text-[#111827]/65">— internal only, never shown to customers</span>
            </Label>
            <Input
              id="eq-price"
              type="number"
              min={0}
              value={form.procurementPrice}
              onChange={(e) => setForm((f) => ({ ...f, procurementPrice: e.target.value }))}
              placeholder="12500"
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit || createEquipment.isPending}>
            {createEquipment.isPending ? 'Adding...' : 'Add Equipment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EmptyEquipmentState({ isAdmin, onAdd }: { isAdmin: boolean; onAdd: () => void }) {
  return (
    <Card>
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f7a800]/10 mb-4">
          <Package className="h-7 w-7 text-[#f7a800]" />
        </div>
        <p className="font-display text-lg font-semibold text-[#091c3c]">No equipment yet</p>
        <p className="font-utility text-sm text-[#111827]/65 mt-1.5 max-w-[42ch]">
          This is where Grid Nova&apos;s equipment catalog — modules, inverters, structures and
          BOS components — will live once real SKU data is added. Nothing is broken; the catalog
          is simply pending.
        </p>
        {isAdmin && (
          <Button onClick={onAdd} className="mt-5 gap-2">
            <Plus className="h-4 w-4" />
            Add the first item
          </Button>
        )}
      </div>
    </Card>
  )
}

export default function EquipmentPage() {
  const { can } = usePermissions()
  // Adding and editing is equipment.manage; the internal procurement price is equipment.procurement_price.view.
  const isAdmin = can('equipment.manage')
  const seesPrice = can('equipment.procurement_price.view')
  const extraCols = (isAdmin ? 1 : 0) + (seesPrice ? 1 : 0)

  const [categoryFilter, setCategoryFilter] = useState<EquipmentCategory | ''>('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('')
  const [addOpen, setAddOpen] = useState(false)

  const { data, isLoading, error, refetch } = useEquipment({
    category: categoryFilter || undefined,
    is_active: statusFilter === '' ? undefined : statusFilter === 'active',
  })
  const setActive = useSetEquipmentActive()

  const items = data ?? []
  const noFiltersApplied = !categoryFilter && !statusFilter
  const isGenuinelyEmpty = !isLoading && !error && items.length === 0 && noFiltersApplied

  async function handleSetActive(item: Equipment, isActive: boolean) {
    try {
      await setActive.mutateAsync({ id: item.id, isActive })
      toast.success(`${item.brand} ${item.model_name} ${isActive ? 'reactivated' : 'deactivated'}`)
    } catch (err) {
      toast.error(errorMessage(err, `Failed to ${isActive ? 'reactivate' : 'deactivate'} equipment`))
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">Equipment Master</h1>
          <p className="font-utility text-sm text-[#111827]/65 mt-1">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Equipment
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#111827]/65" />
              <span className="font-utility text-sm text-[#111827]/60">Filters</span>
            </div>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as EquipmentCategory | '')}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'active' | 'inactive' | '')}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {(categoryFilter || statusFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setCategoryFilter(''); setStatusFilter('') }}>
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : isGenuinelyEmpty ? (
        <EmptyEquipmentState isAdmin={isAdmin} onAdd={() => setAddOpen(true)} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brand</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Specification</TableHead>
                <TableHead>DCR</TableHead>
                {seesPrice && (
                  <TableHead>
                    Procurement Price
                    <span className="ml-1 normal-case font-normal text-[#111827]/65">(internal)</span>
                  </TableHead>
                )}
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 + extraCols }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : items.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={7 + extraCols} className="text-center py-12 font-utility text-[#111827]/65">
                        No equipment matches these filters
                      </TableCell>
                    </TableRow>
                  )
                : items.map((item) => (
                    <TableRow key={item.id} className={item.is_active ? undefined : 'opacity-50'}>
                      <TableCell className="font-utility font-medium text-[#091c3c]">
                        {item.brand}
                        {item.is_placeholder && (
                          <Badge variant="orange" className="ml-2" data-testid="dummy-chip">Dummy / pending Grid Nova</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-utility text-sm">{item.model_name}</TableCell>
                      <TableCell>
                        <Badge variant={CATEGORY_BADGE[item.category]}>{CATEGORY_LABELS[item.category]}</Badge>
                      </TableCell>
                      <TableCell className="font-utility text-sm text-[#111827]/60 max-w-[28ch] truncate" title={item.specification ?? undefined}>
                        {item.specification ?? '—'}
                      </TableCell>
                      <TableCell>
                        {item.is_dcr_compliant ? (
                          <Badge variant="green" className="text-xs">DCR</Badge>
                        ) : (
                          <span className="font-utility text-sm text-[#111827]/65">—</span>
                        )}
                      </TableCell>
                      {seesPrice && (
                        <TableCell className="font-utility text-sm text-[#111827]/60">
                          {item.procurement_price_inr != null ? `₹${item.procurement_price_inr.toLocaleString('en-IN')}` : '—'}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant={item.is_active ? 'green' : 'gray'} className="text-xs">
                          {item.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-utility text-sm text-[#111827]/60">{formatDate(item.created_at)}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {item.is_active ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => void handleSetActive(item, false)}
                              disabled={setActive.isPending}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleSetActive(item, true)}
                              disabled={setActive.isPending}
                            >
                              Reactivate
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {isAdmin && <AddEquipmentDialog open={addOpen} onOpenChange={setAddOpen} />}
    </div>
  )
}
