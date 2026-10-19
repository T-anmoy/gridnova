// First-load JavaScript per prerendered route, measured from a finished
// `next build` (Next 16 no longer prints a route-size table).
//
//   node scripts/route-sizes.mjs [path/to/.next]
//
// For every prerendered HTML page it collects the <script src> files the
// browser must download on first load, de-duplicates them, and reports their
// total gzip size. Dynamic (server-rendered on demand) routes have no static
// HTML and are not listed. Also prints the total size of all client chunks.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const nextDir = path.resolve(process.argv[2] ?? '.next')
const appDir = path.join(nextDir, 'server', 'app')
if (!existsSync(appDir)) {
  console.error(`No build output at ${appDir} — run \`npm run build\` first.`)
  process.exit(1)
}

const gzCache = new Map()
function gzipKb(file) {
  if (!gzCache.has(file)) gzCache.set(file, gzipSync(readFileSync(path.join(nextDir, file))).length)
  return gzCache.get(file)
}

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* htmlFiles(full)
    else if (entry.name.endsWith('.html') && !entry.name.startsWith('_')) yield full
  }
}

const rows = []
for (const file of htmlFiles(appDir)) {
  const html = readFileSync(file, 'utf8')
  const scripts = new Set()
  for (const m of html.matchAll(/<script[^>]+src="\/_next\/(static\/[^"?]+\.js)/g)) scripts.add(m[1])
  let route = path.relative(appDir, file).replace(/\.html$/, '').replace(/\(.*?\)\//g, '')
  route = '/' + route.replace(/(^|\/)index$/, '')
  const bytes = [...scripts].reduce((n, s) => n + (existsSync(path.join(nextDir, s)) ? gzipKb(s) : 0), 0)
  rows.push({ route, files: scripts.size, kb: bytes / 1024 })
}
rows.sort((a, b) => a.route.localeCompare(b.route))

const width = Math.max(...rows.map((r) => r.route.length), 5)
console.log(`${'route'.padEnd(width)}  scripts  first-load JS (gzip)`)
for (const r of rows) console.log(`${r.route.padEnd(width)}  ${String(r.files).padStart(7)}  ${r.kb.toFixed(1).padStart(8)} kB`)

let total = 0
const chunkDir = path.join(nextDir, 'static', 'chunks')
for (const name of readdirSync(chunkDir)) {
  if (name.endsWith('.js') && statSync(path.join(chunkDir, name)).isFile()) total += gzipKb(path.join('static', 'chunks', name))
}
console.log(`\nAll client chunks: ${(total / 1024).toFixed(0)} kB gzip`)
