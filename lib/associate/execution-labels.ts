// Friendly labels for evidence keys the backend sends. Known keys come from the
// portal copy; an unknown key (new evidence added server-side) falls back to a
// readable version of the key itself, never a raw "snake_case" string.

export function humanize(key: string): string {
  const spaced = key.replace(/_/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Translate by code: the reader's copy first, then the server's English `label` for a code the
 * copy doesn't know yet (BE-20 `{code, label}` items), then a readable version of the code.
 * Never the other way round — nothing is ever looked up by its English text.
 */
export function labelFor(map: Record<string, string>, key: string, serverLabels?: Record<string, string>): string {
  return map[key] ?? serverLabels?.[key] ?? humanize(key)
}

export interface CodeLabel {
  code: string
  label: string
}

/** `[{code, label}]` → `{code: label}`, for labelFor's fallback. */
export function serverLabelsOf(items: CodeLabel[] | null | undefined): Record<string, string> {
  return Object.fromEntries((items ?? []).filter((i) => i?.code).map((i) => [i.code, i.label]))
}

export function slotKey(def: string | { key: string }): string {
  return typeof def === 'string' ? def : def.key
}

interface MissingCopy {
  missingText: string
  missingDocument: string
  missingPhoto: string
  missingRegister: string
  text: Record<string, string>
  documents: Record<string, string>
  photoSlots: Record<string, string>
}

// `evidence_missing.missing` entries look like `text:net_meter_serial`,
// `document:inspection_report`, `photo:earthing` or `register:verified`.
export function describeMissing(entry: string, copy: MissingCopy): string {
  const [kind, ...rest] = entry.split(':')
  const key = rest.join(':')
  switch (kind) {
    case 'text':
      return copy.missingText.replace('{item}', labelFor(copy.text, key))
    case 'document':
      return copy.missingDocument.replace('{item}', labelFor(copy.documents, key))
    case 'photo':
      return copy.missingPhoto.replace('{item}', labelFor(copy.photoSlots, key))
    case 'register':
      return copy.missingRegister
    default:
      return humanize(entry.replace(':', ' '))
  }
}
