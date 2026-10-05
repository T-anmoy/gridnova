// Browser-side preparation of a picked photo before upload: shrink big images
// so they survive bad networks, convert HEIC/HEIF (the server rejects it) to
// JPEG, and read the original's taken-time before a re-encode drops the EXIF.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const MAX_LONG_SIDE = 1600
const JPEG_QUALITY = 0.82
const NATIVE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export type PhotoPrepErrorCode = 'not_an_image' | 'heic_conversion_failed' | 'too_large'

export class PhotoPrepError extends Error {
  code: PhotoPrepErrorCode
  constructor(code: PhotoPrepErrorCode) {
    super(code)
    this.name = 'PhotoPrepError'
    this.code = code
  }
}

export function isHeic(file: File): boolean {
  return /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
}

export interface PreparedImage {
  file: File
  reencoded: boolean
  /** Original EXIF DateTimeOriginal as ISO-8601, when it could be read. */
  exifTakenAt: string | null
}

// Minimal JPEG EXIF reader: finds DateTimeOriginal (0x9003) in the Exif IFD.
// Returns null for anything it can't parse — the backend then flags
// `no_metadata`, which is acceptable.
export async function readExifTakenAt(file: Blob): Promise<string | null> {
  try {
    const buf = await file.slice(0, 128 * 1024).arrayBuffer()
    const v = new DataView(buf)
    if (v.getUint16(0) !== 0xffd8) return null
    let off = 2
    while (off + 4 < v.byteLength) {
      const marker = v.getUint16(off)
      const size = v.getUint16(off + 2)
      if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) return parseExif(v, off + 10)
      if ((marker & 0xff00) !== 0xff00) return null
      off += 2 + size
    }
  } catch {
    /* unreadable — fall through */
  }
  return null
}

function parseExif(v: DataView, tiff: number): string | null {
  const little = v.getUint16(tiff) === 0x4949
  const u16 = (o: number) => v.getUint16(tiff + o, little)
  const u32 = (o: number) => v.getUint32(tiff + o, little)
  const readAscii = (o: number, n: number) => {
    let out = ''
    for (let i = 0; i < n - 1; i++) out += String.fromCharCode(v.getUint8(tiff + o + i))
    return out
  }
  const findTag = (ifd: number, tag: number): { type: number; count: number; valueOffset: number } | null => {
    const n = u16(ifd)
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12
      if (u16(e) === tag) return { type: u16(e + 2), count: u32(e + 4), valueOffset: e + 8 }
    }
    return null
  }
  const exifPtr = findTag(u32(4), 0x8769)
  if (!exifPtr) return null
  const dto = findTag(u32(exifPtr.valueOffset), 0x9003)
  if (!dto || dto.type !== 2 || dto.count < 19) return null
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(readAscii(u32(dto.valueOffset), dto.count))
  if (!m) return null
  // EXIF has no time zone; treat it as UTC so the value is stable and explicit.
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(file)
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('decode failed'))
      img.src = url
    })
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined }
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function reencode(file: File, width: number, height: number, source: CanvasImageSource): Promise<File> {
  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) throw new Error('encode failed')
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified })
}

/**
 * Keeps the original when it is already a native image type, no larger than
 * the long-side cap, and under the size limit (preserving its own metadata);
 * otherwise re-encodes to JPEG. HEIC/HEIF is always converted.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const heic = isHeic(file)
  if (!heic && !NATIVE_TYPES.includes(file.type)) throw new PhotoPrepError('not_an_image')

  let decoded: Awaited<ReturnType<typeof decode>> | null = null
  try {
    decoded = await decode(file)
  } catch {
    if (heic) throw new PhotoPrepError('heic_conversion_failed')
    // A native type we can't decode: send it as-is when it fits the limit.
    if (file.size <= MAX_UPLOAD_BYTES) return { file, reencoded: false, exifTakenAt: null }
    throw new PhotoPrepError('too_large')
  }

  try {
    const small = Math.max(decoded.width, decoded.height) <= MAX_LONG_SIDE
    if (!heic && small && file.size <= MAX_UPLOAD_BYTES) return { file, reencoded: false, exifTakenAt: null }
    const exifTakenAt = heic ? null : await readExifTakenAt(file)
    let out: File
    try {
      out = await reencode(file, decoded.width, decoded.height, decoded.source)
    } catch {
      throw new PhotoPrepError(heic ? 'heic_conversion_failed' : 'too_large')
    }
    if (out.size > MAX_UPLOAD_BYTES) throw new PhotoPrepError('too_large')
    return { file: out, reencoded: true, exifTakenAt }
  } finally {
    decoded.close()
  }
}
