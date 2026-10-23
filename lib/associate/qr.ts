import qrcode from 'qrcode-generator'

/** The QR code's dark/light modules for `text` (medium error correction — survives a smudged print). */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M')
  qr.addData(text, 'Byte')
  qr.make()
  const n = qr.getModuleCount()
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)))
}

/** One SVG path for every dark module, in module units (no quiet zone). */
export function qrPath(matrix: boolean[][]): string {
  let d = ''
  matrix.forEach((row, r) => row.forEach((dark, c) => {
    if (dark) d += `M${c} ${r}h1v1h-1z`
  }))
  return d
}

/** Draws the code (with a 4-module quiet zone) on a canvas and returns a PNG, for printing. */
export function qrPngBlob(matrix: boolean[][], cell = 16, quiet = 4): Promise<Blob | null> {
  const size = (matrix.length + quiet * 2) * cell
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#000000'
  matrix.forEach((row, r) => row.forEach((dark, c) => {
    if (dark) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell)
  }))
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}
