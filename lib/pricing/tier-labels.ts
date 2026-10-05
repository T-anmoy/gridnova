import type { PackageCatalogue } from './price-list'

// Staff wizard tier values (stored and sent as equipment_tier) → catalogue equipment_tier.
const TIER_VALUE: Record<string, string> = { Standard: 'standard', Premium: 'premium' }

/**
 * Display text for the wizard's equipment-tier options: the package names from
 * GET /pricing/packages. The stored values are untouched; options the catalogue
 * has no package for keep their own text.
 */
export function equipmentTierLabels(catalogue: PackageCatalogue | null): Record<string, string> {
  const labels: Record<string, string> = { 'As recommended by Grid Nova': 'As recommended by Grid Nova' }
  if (!catalogue) return labels
  for (const [value, tier] of Object.entries(TIER_VALUE)) {
    const pkg = catalogue.packages.find((p) => p.equipment_tier === tier)
    if (pkg?.display_name) labels[value] = pkg.display_name
  }
  return labels
}
