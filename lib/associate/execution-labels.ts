// Friendly labels for evidence keys the backend sends. Known keys come from the
// portal copy; an unknown key (new evidence added server-side) falls back to a
// readable version of the key itself, never a raw "snake_case" string.

export function humanize(key: string): string {
  const spaced = key.replace(/_/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function labelFor(map: Record<string, string>, key: string): string {
  return map[key] ?? humanize(key)
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
