import type { Blocking, PlaceholderItem, PlaceholdersResponse } from '@/lib/dashboard/placeholders-api-client'

export const BLOCKING_ORDER: Blocking[] = ['blocks_launch', 'blocks_feature', 'tunable']

export const BLOCKING_LABEL: Record<string, string> = {
  blocks_launch: 'Blocks launch',
  blocks_feature: 'Blocks a feature',
  tunable: 'Tunable',
}

export const AREA_LABEL = (area: string): string => area.charAt(0).toUpperCase() + area.slice(1).replace(/_/g, ' ')

// Only entries marked `manual` can be resolved by hand; the rest resolve themselves
// when their underlying value is edited.
export const isManual = (item: PlaceholderItem): boolean => item.probe === 'manual'

export function unresolvedItems(data: PlaceholdersResponse): PlaceholderItem[] {
  return data.areas.flatMap((a) => a.items).filter((i) => !i.resolved)
}

/** A clean plain-text list of everything still needed from Grid Nova, grouped by area. */
export function buildGridNovaMessage(data: PlaceholdersResponse): string {
  const rows = data.areas.map((a) => ({ area: a.area, items: a.items.filter((i) => !i.resolved) })).filter((a) => a.items.length > 0)
  const total = rows.reduce((n, a) => n + a.items.length, 0)
  if (total === 0) return 'Nothing is outstanding — every item on the Grid Nova data checklist is resolved.'
  const lines = [`Grid Nova — information we still need from you (${total} item${total === 1 ? '' : 's'})`, '']
  for (const { area, items } of rows) {
    lines.push(AREA_LABEL(area).toUpperCase())
    items.forEach((item, n) => {
      lines.push(`${n + 1}. [${item.id}${item.blocking === 'blocks_launch' ? ' · needed before launch' : ''}] ${item.needed_from_grid_nova}`)
    })
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}
