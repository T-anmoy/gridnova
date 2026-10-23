// Regenerates content/policies/policies.en.json and notices.en.json from
// content/policies/GridNova_Policies_Draft_v1.md.
//
//   npm run policies            # write the two JSON files
//   npm run policies -- --check # fail (exit 1) if they differ from the draft
//
// The draft is the single source of truth: edit the .md, run this, commit all
// three. Legal text is never paraphrased or edited in the JSON by hand. The
// parser is deliberately strict — a line it does not understand stops the build
// instead of being dropped.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const SOURCE = 'content/policies/GridNova_Policies_Draft_v1.md'

/** Document number in the draft -> [kind, slug]. 1-5 are public pages, 6-7 are notices. */
const DOCS = {
  1: ['documents', 'privacy'],
  2: ['documents', 'terms'],
  3: ['documents', 'associate-terms'],
  4: ['documents', 'commission-policy'],
  5: ['documents', 'payment-policy'],
  6: ['notices', 'associate-kyc-consent'],
  7: ['notices', 'customer-information-notice'],
}

export const slugify = (heading) =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

/** Turn the lines of one section into blocks. */
function parseBlocks(lines, where) {
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    if (line.startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++])
      const [head, sep, ...body] = rows
      if (!sep || !/^\|[\s:|-]+\|?$/.test(sep)) throw new Error(`${where}: table without a separator row`)
      blocks.push({ type: 'table', head: parseTableRow(head), rows: body.map(parseTableRow) })
      continue
    }
    if (/^- /.test(line)) {
      const items = []
      while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2).trim())
      blocks.push({ type: 'ul', items })
      continue
    }
    if (/^\d+\. /.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\d+\. /, '').trim())
      blocks.push({ type: 'ol', items })
      continue
    }
    if (line.startsWith('☐')) {
      blocks.push({ type: 'checkbox', text: line.replace(/^☐\s*/, '').trim() })
      i++
      continue
    }
    const note = line.match(/^\*\((.*)\)\*$/)
    if (note) {
      blocks.push({ type: 'note', text: note[1] })
      i++
      continue
    }
    const h4 = line.match(/^\*\*([^*]+)\*\*$/)
    if (h4) {
      blocks.push({ type: 'h4', text: h4[1].trim() })
      i++
      continue
    }
    // Paragraph: consecutive plain lines join with a single space.
    const para = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(\||- |\d+\. |☐)/.test(lines[i]) &&
      !/^\*\((.*)\)\*$/.test(lines[i]) &&
      !/^\*\*([^*]+)\*\*$/.test(lines[i])
    ) {
      para.push(lines[i++].trim())
    }
    blocks.push({ type: 'p', text: para.join(' ') })
  }
  return blocks
}

function parseMeta(line) {
  return line.split(' · ').map((part) => {
    const m = part.match(/^\*\*(.+?):\*\*\s*(.*)$/)
    if (!m) throw new Error(`Unrecognised meta line: ${line}`)
    return { label: m[1], value: m[2] }
  })
}

export function parseDraft(md) {
  const title = md.match(/^# .*\(Draft (v[\d.]+)\)/m)
  const prepared = md.match(/\*\*Prepared:\*\* (\d{1,2} \w+ \d{4})/)
  if (!title || !prepared) throw new Error('Draft header (version / prepared date) not found')

  const out = { documents: {}, notices: {}, pendingItems: null, version: title[1], prepared: prepared[1] }
  const parts = md.split(/^## /m).slice(1)
  for (const part of parts) {
    const [headingLine, ...rest] = part.split('\n')
    const body = rest.join('\n').replace(/\n---\s*(\n---\s*)?\n*$/, '\n')
    const numbered = headingLine.match(/^(\d+)\. (.+)$/)

    if (!numbered) {
      if (/^ITEMS FOR GRID NOVA TO CONFIRM/.test(headingLine)) {
        const block = parseBlocks(body.split('\n'), 'pending items')[0]
        if (block?.type !== 'table') throw new Error('Pending-items table not found')
        out.pendingItems = { head: block.head, rows: block.rows }
        continue
      }
      throw new Error(`Unrecognised top-level heading: ${headingLine}`)
    }

    const number = Number(numbered[1])
    const target = DOCS[number]
    if (!target) throw new Error(`Document ${number} has no slug mapping`)

    // Split into the intro (before the first ###) and the ### sections. Documents 4 and 5
    // write their numbered sections as a bold line (**4.1 Rate schedule**) instead of a ### heading.
    const chunks = body.replace(/^\*\*(\d+\.\d+ [^*]+)\*\*$/gm, '### $1').split(/^### /m)
    const intro = chunks.shift().split('\n')
    let meta = []
    // Only the leading "**Label:** value" line is document metadata.
    const firstContent = intro.findIndex((l) => l.trim())
    if (firstContent >= 0 && /^\*\*[^*]+:\*\*/.test(intro[firstContent])) {
      meta = parseMeta(intro[firstContent])
      intro.splice(firstContent, 1)
    }
    const sections = []
    const introBlocks = parseBlocks(intro.filter((l) => l.trim() !== '---'), `document ${number} intro`)
    if (introBlocks.length) sections.push({ id: 'intro', heading: null, blocks: introBlocks })
    for (const chunk of chunks) {
      const [h, ...lines] = chunk.split('\n')
      sections.push({
        id: slugify(h),
        heading: h.trim(),
        blocks: parseBlocks(lines.filter((l) => l.trim() !== '---'), `document ${number} section ${h}`),
      })
    }
    out[target[0]][target[1]] = { number, sourceTitle: numbered[2].trim(), meta, sections, slug: target[1] }
  }
  return out
}

export function buildJson(parsed) {
  const policies = {
    _source: `${SOURCE} (Draft ${parsed.version}, prepared ${parsed.prepared}). Generated verbatim from the draft — edit the draft and regenerate, do not paraphrase here.`,
    documents: parsed.documents,
    pendingItems: parsed.pendingItems,
  }
  const notices = {
    _source: `${SOURCE}, documents 6 and 7. Not pages: shown inside the Associate registration flow (Phase 2) and read to customers by Associates (Phase 3).`,
    notices: parsed.notices,
  }
  return { policies, notices }
}

const file = (name) => path.join(root, 'content/policies', name)
// The committed files have no trailing newline; keep it that way so the output is byte-identical.
const serialise = (obj) => JSON.stringify(obj, null, 2)

export function generate() {
  const parsed = parseDraft(readFileSync(path.join(root, SOURCE), 'utf8'))
  const { policies, notices } = buildJson(parsed)
  return { policies, notices, text: { 'policies.en.json': serialise(policies), 'notices.en.json': serialise(notices) } }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { text } = generate()
  if (process.argv.includes('--check')) {
    let stale = false
    for (const [name, content] of Object.entries(text)) {
      if (readFileSync(file(name), 'utf8') !== content) {
        console.error(`${name} differs from the draft — run \`npm run policies\``)
        stale = true
      }
    }
    process.exit(stale ? 1 : 0)
  }
  for (const [name, content] of Object.entries(text)) writeFileSync(file(name), content)
  console.log('Wrote policies.en.json and notices.en.json')
}
