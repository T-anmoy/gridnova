import { AlertTriangle, Check, Clock } from 'lucide-react'
import { formatDate } from '@/lib/dashboard/utils'
import type { Register, RegisterUnit } from '@/lib/associate/register-types'
import type { Messages } from '@/lib/i18n/types'

type RegisterCopy = Messages['associates']['portal']['execution']['register']

const fill = (template: string, vars: Record<string, string>) => Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), template)

/**
 * Read-only serial register — what the associate sees (and the base of what
 * staff see). Ratings are the server's strings. Capacity and DCR mismatches are
 * advice, never a block. It deliberately ignores `previously_voided`: that
 * signal is staff-only and never reaches an associate screen.
 */
export default function RegisterReadOnly({
  register,
  copy,
  renderUnitActions,
}: {
  register: Register
  copy: RegisterCopy
  /** Edit / remove controls, only passed while the associate may still change the register. */
  renderUnitActions?: (unit: RegisterUnit) => React.ReactNode
}) {
  const units = register.units.filter((u) => u.status !== 'voided')
  return (
    <div className="space-y-3" data-testid="register-readonly">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.title}</p>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-utility text-xs font-semibold ${
            register.verified_at ? 'bg-emerald-100 text-emerald-800' : 'bg-[#111827]/10 text-[#111827]/60'
          }`}
          data-testid="register-badge"
        >
          {register.verified_at ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {register.verified_at ? copy.verifiedBadge : copy.notVerifiedBadge}
        </span>
      </div>

      {units.length === 0 ? (
        <p className="text-sm text-[#111827]/55">{copy.empty}</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4" data-testid="register-totals">
            <div><dt className="text-[#111827]/50">{copy.totalModules}</dt><dd className="font-semibold">{register.totals.modules}</dd></div>
            <div><dt className="text-[#111827]/50">{copy.totalInverters}</dt><dd className="font-semibold">{register.totals.inverters}</dd></div>
            <div><dt className="text-[#111827]/50">{copy.moduleKw}</dt><dd className="font-semibold">{fill(copy.kw, { value: register.capacity.installed_module_kw })}</dd></div>
            <div><dt className="text-[#111827]/50">{copy.inverterKw}</dt><dd className="font-semibold">{fill(copy.kw, { value: register.totals.inverter_kw })}</dd></div>
          </dl>
          <ul className="divide-y divide-[#e4e8ee] rounded-xl border border-[#e4e8ee]">
            {units.map((u) => (
              <li key={u.unit_id} className="space-y-0.5 px-3 py-2 text-sm" data-testid="register-unit">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold text-[#091c3c]">{u.serial_number}</span>
                  <span className="rounded bg-[#f7f9fc] px-1.5 py-0.5 text-[11px] text-[#111827]/60">{copy.category[u.category]}</span>
                  {u.category !== 'other' && u.equipment == null && (
                    <span className="rounded bg-[#111827]/10 px-1.5 py-0.5 text-[11px] text-[#111827]/70" data-testid="waiting-match-chip">{copy.entry.waiting}</span>
                  )}
                  {u.category === 'module' && u.is_dcr != null && (
                    <span className={`rounded px-1.5 py-0.5 text-[11px] ${u.is_dcr ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{u.is_dcr ? copy.dcr : copy.nonDcr}</span>
                  )}
                </p>
                <p className="text-xs text-[#111827]/60">
                  {u.equipment
                    ? `${u.equipment.brand} ${u.equipment.model_name}`
                    : u.brand_as_printed || u.model_as_printed
                      ? fill(copy.entry.printedAs, { brand: u.brand_as_printed ?? '', model: u.model_as_printed ?? '' })
                      : ''}
                  {u.rating_wp ? ` · ${fill(copy.ratingWp, { value: u.rating_wp })}` : ''}
                  {u.rating_kw ? ` · ${fill(copy.ratingKw, { value: u.rating_kw })}` : ''}
                  {u.warranty_start && u.warranty_end ? ` · ${fill(copy.warranty, { start: formatDate(u.warranty_start), end: formatDate(u.warranty_end) })}` : ''}
                </p>
                {renderUnitActions?.(u)}
              </li>
            ))}
          </ul>
        </>
      )}

      {register.capacity.mismatch && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900" data-testid="capacity-advice">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {fill(copy.capacityMismatch, { tolerance: String(register.capacity.tolerance_percent) })}
        </p>
      )}
      {register.dcr.mismatch && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900" data-testid="dcr-advice">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {register.dcr.override ? copy.dcrOverride : copy.dcrMismatch}
        </p>
      )}
    </div>
  )
}
