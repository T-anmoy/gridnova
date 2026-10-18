'use client'

import { ExternalLink, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { fieldLabel, formatFieldValue, groupDossier, humanize, mapsUrl, readDocuments } from '@/lib/archive/logic'
import type { ProjectDossier, Provenanced } from '@/lib/archive/schemas'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/

/** Any value from the API, shown as plain text. Objects and lists are walked, never interpreted as markup. */
function ValueView({ name, value }: { name: string; value: unknown }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span>—</span>
    return (
      <ul className="list-disc space-y-0.5 pl-4">
        {value.map((v, i) => (
          <li key={i}><ValueView name={name} value={v} /></li>
        ))}
      </ul>
    )
  }
  if (value && typeof value === 'object') {
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-gray-500">{humanize(k)}</dt>
            <dd className="break-words"><ValueView name={k} value={v} /></dd>
          </div>
        ))}
      </dl>
    )
  }
  return <span className="whitespace-pre-wrap break-words">{formatFieldValue(typeof value === 'string' && ISO_DAY.test(value) ? 'date' : name, value)}</span>
}

function FieldRow({ name, item }: { name: string; item: Provenanced }) {
  return (
    <div className="grid gap-0.5 py-2 sm:grid-cols-[12rem_1fr] sm:gap-3" data-testid={`field-${name}`}>
      <dt className="text-xs font-medium text-gray-500">{fieldLabel(name)}</dt>
      <dd className="text-sm text-gray-900" title={`Source: ${item.source_table}`}>
        <ValueView name={name} value={item.value} />
      </dd>
    </div>
  )
}

function Documents({ fieldItems, sectionItems }: { fieldItems: Provenanced[]; sectionItems: Provenanced[] }) {
  // The `documents` field may hold the whole list at once; the section holds one entry per item.
  const values = [...fieldItems, ...sectionItems].flatMap((p) => (Array.isArray(p.value) ? p.value : [p.value]))
  const docs = readDocuments(values)
  if (docs.length === 0) return <p className="text-sm text-gray-500">No documents.</p>
  return (
    <ul className="space-y-1" aria-label="Documents">
      {docs.map((d, i) => (
        <li key={i}>
          {d.url ? (
            // Stored links open in a new tab and never hand the page to the opener.
            <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-[#0e2a63] underline">
              {d.label}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <span className="text-sm text-gray-700">{d.label}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function SectionList({ name, items }: { name: string; items: Provenanced[] }) {
  return (
    <ul className="space-y-2" aria-label={humanize(name)}>
      {items.map((it, i) => (
        <li key={i} className="rounded-lg bg-[#f7f9fc] px-3 py-2 text-sm" title={`Source: ${it.source_table}`}>
          <ValueView name={name} value={it.value} />
        </li>
      ))}
    </ul>
  )
}

export function ArchiveDossier({ dossier }: { dossier: ProjectDossier }) {
  const { fields, sections } = dossier
  const groups = groupDossier(fields, sections)
  const mapLink = 'latitude' in fields && 'longitude' in fields ? mapsUrl(fields.latitude.value, fields.longitude.value) : null
  return (
    <div className="space-y-4" data-testid="archive-dossier">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-semibold text-[#091c3c] md:text-2xl">{dossier.ref}</h1>
        <Badge variant="gray">Archived project</Badge>
      </div>
      {groups.map((g) => (
        <Card key={g.id} data-testid={`group-${g.id}`}>
          <CardHeader>
            <CardTitle className="text-base">{g.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {g.keys.length > 0 && g.id !== 'documents' && (
              <dl className="divide-y divide-[#e4e8ee]">
                {g.keys.map((k) => (
                  <FieldRow key={k} name={k} item={fields[k]} />
                ))}
              </dl>
            )}
            {g.id === 'location' && mapLink && (
              <a href={mapLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-[#0e2a63] underline">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Open on Google Maps
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
            {g.id === 'documents' && <Documents fieldItems={g.keys.map((k) => fields[k])} sectionItems={g.sections.flatMap((s) => sections[s])} />}
            {g.id !== 'documents' && g.sections.map((s) => <SectionList key={s} name={s} items={sections[s]} />)}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
