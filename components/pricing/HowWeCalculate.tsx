'use client'

import { useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { useMessages } from '@/lib/i18n/client'
import { fmt, type Messages } from '@/lib/i18n/types'
import { formatInr } from '@/lib/money'
import {
  fetchEstimateAssumptions,
  type Assumption,
  type AssumptionValue,
  type EstimateAssumptions,
} from '@/lib/pricing/solar-estimate'
import { StatusBadge, useIsoDate } from '@/components/pricing/StatusBadge'

// "How we calculate": every assumption the engine applies, each with its value,
// source and status, read from GET /api/v1/pricing/estimate-assumptions when the
// panel is first opened. The values and sources are the backend's own text; only
// the labels are ours. If the route cannot be reached, the estimate's own
// `assumptions[]` are shown instead, so the panel is never empty.

type HowCopy = Messages['pricing']['estimate']['how']

/** "west_bengal" → "West Bengal" — the config's state keys, made readable. */
const stateName = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function valueText(v: unknown, unit: string | null | undefined, h: HowCopy): string {
  if (v === true) return h.values.true
  if (v === false) return h.values.false
  if (v == null || v === 'none') return h.values.none
  const text = String(v)
  if (unit === 'INR') return formatInr(text)
  const tpl = unit ? (h.units as Record<string, string>)[unit] : undefined
  if (tpl) return fmt(tpl, { value: text })
  return unit && !['flag', 'scheme', 'basis'].includes(unit) ? `${text} ${unit}` : text
}

function Item({ label, value, status, source, asOf, children }: { label: string; value?: string; status?: string; source?: string | null; asOf?: string | null; children?: ReactNode }) {
  const h = useMessages('pricing').estimate.how
  const isoDate = useIsoDate()
  return (
    <li data-testid="assumption" className="py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-utility text-sm text-[#111827]/85">{label}</span>
        {value && <span className="font-utility text-sm font-semibold text-[#0e2a63]">{value}</span>}
      </div>
      {children}
      {(status || source || asOf) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-utility text-xs text-[#111827]/60">
          {status && <StatusBadge status={status} />}
          {source && <span>{fmt(h.source, { source })}</span>}
          {asOf && <span>{fmt(h.asOf, { date: isoDate(asOf) })}</span>}
        </div>
      )}
    </li>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pt-3">
      <p className="font-utility text-xs font-semibold uppercase tracking-[0.08em] text-[#2f5daa]">{title}</p>
      <ul className="divide-y divide-[#e4e8ee]">{children}</ul>
    </div>
  )
}

const label = (h: HowCopy, name: string | undefined, vars: Record<string, string> = {}) =>
  fmt((h.items as Record<string, string>)[name ?? ''] ?? name ?? '', vars)

function ValueItem({ a, h, name, vars }: { a: AssumptionValue | Assumption | undefined; h: HowCopy; name?: string; vars?: Record<string, string> }) {
  if (!a) return null
  return <Item label={label(h, name ?? a.name, vars)} value={valueText(a.value, a.unit, h)} status={a.status} source={a.source} asOf={a.as_of} />
}

function Note({ text }: { text?: string }) {
  return text ? <li className="py-2 font-utility text-xs leading-relaxed text-[#111827]/70">{text}</li> : null
}

function Panel({ data }: { data: EstimateAssumptions }) {
  const pricing = useMessages('pricing')
  const h = pricing.estimate.how
  const conditions = pricing.subsidy.conditions as Record<string, string>
  const confidence = pricing.estimate.confidence
  const g = data.generation
  const sv = data.savings
  const tf = data.tariffs
  const central = data.subsidies?.central
  const cat = (k: string) => (h.categories as Record<string, string>)[k] ?? k
  const stateLabel = (key: string | undefined) => (!key || key === 'other' ? h.values.otherStates : stateName(key))
  return (
    <div data-testid="assumptions-panel">
      {g && (
        <Group title={h.groups.generation}>
          {g.units_per_kwp_per_month?.map((a) => (
            <ValueItem
              key={a.state}
              a={a}
              h={h}
              name="units_per_kwp_per_month_state"
              vars={{ state: stateLabel(a.state) }}
            />
          ))}
          {g.degradation?.map((a) => <ValueItem key={a.name} a={a} h={h} />)}
          <Note text={g.system_losses} />
          <Note text={g.shading} />
        </Group>
      )}
      {data.roof_area && (
        <Group title={h.groups.roof}>
          {data.roof_area.map((a) => <ValueItem key={a.name} a={a} h={h} />)}
        </Group>
      )}
      {data.sizing && (
        <Group title={h.groups.sizing}>
          <ValueItem a={data.sizing.target_offset} h={h} />
          <Note text={data.sizing.formula} />
          <Note text={data.sizing.sanctioned_load} />
        </Group>
      )}
      {sv && (
        <Group title={h.groups.savings}>
          <Note text={sv.method} />
          <ValueItem a={sv.escalation} h={h} />
          <ValueItem a={sv.long_term_years} h={h} />
          {sv.export_credit?.map((a) => <ValueItem key={a.state} a={a} h={h} name="export_credit" vars={{ state: stateLabel(a.state) }} />)}
          <ValueItem a={sv.o_and_m} h={h} />
          <Note text={sv.payback} />
        </Group>
      )}
      {tf && (
        <Group title={h.groups.tariffs}>
          <ValueItem a={tf.flat_rate} h={h} />
          {tf.implied_rate_sanity && (
            <Item
              label={label(h, 'implied_rate_sanity')}
              value={fmt(h.values.range, { min: formatInr(tf.implied_rate_sanity.min), max: formatInr(tf.implied_rate_sanity.max) })}
              status={tf.implied_rate_sanity.status}
              source={tf.implied_rate_sanity.source}
              asOf={tf.implied_rate_sanity.as_of}
            />
          )}
          {tf.discoms?.map((d) => (
            <Item
              key={`${d.discom}-${d.category}`}
              label={label(h, 'discom', { discom: d.discom, category: d.category })}
              value={d.available ? h.values.available : h.values.notAvailable}
              status={d.status}
              source={d.source}
              asOf={d.as_of}
            />
          ))}
          {tf.free_units?.map((a) => <ValueItem key={a.state} a={a} h={h} vars={{ state: a.state ?? '' }} />)}
        </Group>
      )}
      {central && (
        <Group title={h.groups.subsidies}>
          <Item label={label(h, 'central_cfa')} value={central.scheme} status={central.status} source={central.source} asOf={central.as_of} />
          {Object.entries(central.residential ?? {}).flatMap(([k, r]) => [
            ...r.slabs.map((sl) => (
              <Item key={`${k}-${sl.up_to_kwp}`} label={label(h, 'central_slab', { category: cat(k), kwp: sl.up_to_kwp })} value={valueText(sl.rate_per_kwp, 'INR', h)} />
            )),
            <Item key={`${k}-max`} label={label(h, 'central_max', { category: cat(k) })} value={valueText(r.max_inr, 'INR', h)} />,
          ])}
          {central.housing_society && (
            <Item
              label={label(h, 'society', { perHouse: central.housing_society.kwp_per_house, max: central.housing_society.max_kwp })}
              value={Object.entries(central.housing_society.rate_per_kwp)
                .map(([k, v]) => `${cat(k)}: ${formatInr(v)}`)
                .join(' · ')}
            />
          )}
          {central.special_category_states && central.special_category_states.length > 0 && (
            <Item label={label(h, 'special_states')}>
              <p className="mt-0.5 font-utility text-xs leading-relaxed text-[#111827]/70">{central.special_category_states.join(', ')}</p>
            </Item>
          )}
          {central.conditions && central.conditions.length > 0 && (
            <Item label={label(h, 'conditions')}>
              <ul className="mt-0.5 list-disc pl-5 font-utility text-xs leading-relaxed text-[#111827]/70">
                {[...new Set(central.conditions.map((c) => conditions[c] ?? conditions.other))].map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Item>
          )}
          {data.subsidies?.state_top_ups?.map((s) => (
            <Item key={s.state} label={label(h, 'state_top_up', { state: s.state })} status={s.status} source={s.source} asOf={s.as_of}>
              {s.note && <p className="mt-0.5 font-utility text-xs leading-relaxed text-[#111827]/70">{s.note}</p>}
            </Item>
          ))}
          <Note text={data.subsidies?.deduction_rule} />
        </Group>
      )}
      {data.confidence_rules && (
        <Group title={h.groups.confidence}>
          {(['high', 'medium', 'low'] as const).map((k) =>
            data.confidence_rules?.[k] ? (
              <Item key={k} label={confidence[k]}>
                <p className="mt-0.5 font-utility text-xs leading-relaxed text-[#111827]/70">{data.confidence_rules[k]}</p>
              </Item>
            ) : null
          )}
        </Group>
      )}
      <p className="pt-3 font-utility text-[11px] text-[#111827]/55">{fmt(h.version, { version: data.estimate_version })}</p>
    </div>
  )
}

export default function HowWeCalculate({ fallback }: { fallback: Assumption[] }) {
  const h = useMessages('pricing').estimate.how
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; data: EstimateAssumptions | null }>({ status: 'idle', data: null })
  const started = useRef(false)

  function onToggle(open: boolean) {
    if (!open || started.current) return
    started.current = true
    setState({ status: 'loading', data: null })
    fetchEstimateAssumptions()
      .then((data) => setState({ status: 'ready', data }))
      .catch(() => setState({ status: 'error', data: null }))
  }

  return (
    <details data-testid="how-we-calculate" className="group rounded-xl border border-[#e4e8ee] bg-white" onToggle={(e) => onToggle(e.currentTarget.open)}>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 font-display text-base font-semibold text-[#0e2a63] [&::-webkit-details-marker]:hidden">
        {h.title}
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <div className="border-t border-[#e4e8ee] px-4 pb-4 pt-2">
        <p className="font-utility text-xs leading-relaxed text-[#111827]/70">{h.intro}</p>
        {state.status === 'loading' && (
          <p role="status" className="mt-3 flex items-center gap-2 font-utility text-xs text-[#111827]/65">
            <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {h.loading}
          </p>
        )}
        {state.status === 'ready' && state.data && <Panel data={state.data} />}
        {state.status === 'error' && (
          <>
            <p className="mt-3 font-utility text-xs text-[#111827]/65">{h.error}</p>
            {fallback.length > 0 && (
              <ul data-testid="assumptions-fallback" className="divide-y divide-[#e4e8ee]">
                {fallback.map((a) => (
                  <ValueItem key={a.name} a={a} h={h} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </details>
  )
}
