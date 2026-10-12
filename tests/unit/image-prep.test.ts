import { describe, it, expect, vi, afterEach } from 'vitest'
import { prepareImage, readExifTakenAt, PhotoPrepError, MAX_UPLOAD_BYTES } from '@/lib/associate/image-prep'

function stubCanvas(blobBytes = 10) {
  const drawImage = vi.fn()
  const canvases: { width: number; height: number }[] = []
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, cb) {
    canvases.push({ width: this.width, height: this.height })
    cb(new Blob([new Uint8Array(blobBytes)], { type: 'image/jpeg' }))
  })
  return { drawImage, canvases }
}

function stubBitmap(width: number, height: number) {
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close: vi.fn() }))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('prepareImage', () => {
  it('converts HEIC to JPEG through a canvas', async () => {
    stubBitmap(1200, 900)
    const { drawImage } = stubCanvas()
    const out = await prepareImage(new File(['x'], 'IMG_0001.HEIC', { type: 'image/heic' }))
    expect(out.reencoded).toBe(true)
    expect(out.file.type).toBe('image/jpeg')
    expect(out.file.name).toBe('IMG_0001.jpg')
    expect(drawImage).toHaveBeenCalled()
  })

  it('also converts HEIF identified only by file extension', async () => {
    stubBitmap(800, 600)
    stubCanvas()
    const out = await prepareImage(new File(['x'], 'a.heif', { type: '' }))
    expect(out.file.type).toBe('image/jpeg')
  })

  it('reports a clear error when HEIC cannot be decoded', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('unsupported')))
    await expect(prepareImage(new File(['x'], 'a.heic', { type: 'image/heic' }))).rejects.toMatchObject({ code: 'heic_conversion_failed' })
  })

  it('shrinks a large image so the long side is at most 1600 px, keeping the aspect ratio', async () => {
    stubBitmap(4000, 3000)
    const { canvases } = stubCanvas()
    const out = await prepareImage(new File(['x'], 'big.jpg', { type: 'image/jpeg' }))
    expect(out.reencoded).toBe(true)
    expect(canvases[0]).toEqual({ width: 1600, height: 1200 })
  })

  it('keeps an already-small JPEG/PNG/WEBP exactly as picked (preserving its own metadata)', async () => {
    stubBitmap(1200, 800)
    const { drawImage } = stubCanvas()
    const original = new File(['x'], 'small.png', { type: 'image/png' })
    const out = await prepareImage(original)
    expect(out.file).toBe(original)
    expect(out.reencoded).toBe(false)
    expect(drawImage).not.toHaveBeenCalled()
  })

  it('rejects things that are not images', async () => {
    await expect(prepareImage(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).rejects.toBeInstanceOf(PhotoPrepError)
  })

  it('rejects an image that is still over the limit after re-encoding', async () => {
    stubBitmap(4000, 3000)
    stubCanvas(MAX_UPLOAD_BYTES + 1)
    await expect(prepareImage(new File(['x'], 'big.jpg', { type: 'image/jpeg' }))).rejects.toMatchObject({ code: 'too_large' })
  })
})

// Minimal big-endian JPEG: SOI, APP1/Exif with DateTimeOriginal 2026:03:05 10:20:30.
function jpegWithExif(date = '2026:03:05 10:20:30'): Blob {
  const tiff: number[] = [0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8]
  const u16 = (n: number) => [(n >> 8) & 255, n & 255]
  const u32 = (n: number) => [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]
  tiff.push(...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0)) // IFD0 → Exif IFD at 26
  tiff.push(...u16(1), ...u16(0x9003), ...u16(2), ...u32(20), ...u32(44), ...u32(0)) // Exif IFD → string at 44
  tiff.push(...[...date].map((c) => c.charCodeAt(0)), 0)
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]
  return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe1, ...u16(exif.length + 2), ...exif, 0xff, 0xd9])], { type: 'image/jpeg' })
}

describe('readExifTakenAt', () => {
  it('reads DateTimeOriginal from a JPEG', async () => {
    expect(await readExifTakenAt(jpegWithExif())).toBe('2026-03-05T10:20:30+05:30')
  })
  it('returns null for a file with no EXIF, or anything unreadable', async () => {
    expect(await readExifTakenAt(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])]))).toBeNull()
    expect(await readExifTakenAt(new Blob(['not an image']))).toBeNull()
  })
})

// Same JPEG with an Exif IFD holding DateTimeOriginal AND OffsetTimeOriginal.
function jpegWithOffset(date: string, offset: string): Blob {
  const u16 = (n: number) => [(n >> 8) & 255, n & 255]
  const u32 = (n: number) => [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]
  const tiff: number[] = [0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8]
  tiff.push(...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0)) // IFD0 → Exif IFD at 26
  tiff.push(...u16(2), ...u16(0x9003), ...u16(2), ...u32(20), ...u32(56), ...u16(0x9011), ...u16(2), ...u32(7), ...u32(76), ...u32(0))
  tiff.push(...[...date].map((c) => c.charCodeAt(0)), 0) // 56..75
  tiff.push(...[...offset].map((c) => c.charCodeAt(0)), 0) // 76..82
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]
  return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe1, ...u16(exif.length + 2), ...exif, 0xff, 0xd9])], { type: 'image/jpeg' })
}

describe('readExifTakenAt — camera local time keeps its offset (H14)', () => {
  it('uses OffsetTimeOriginal when the camera wrote one', async () => {
    expect(await readExifTakenAt(jpegWithOffset('2026:03:05 10:20:30', '+04:00'))).toBe('2026-03-05T10:20:30+04:00')
  })
  it('defaults to IST (+05:30), never Z — a Z would shift an Indian photo by 5½ hours', async () => {
    const v = await readExifTakenAt(jpegWithExif('2026:03:05 10:20:30'))
    expect(v).toBe('2026-03-05T10:20:30+05:30')
    expect(new Date(v!).toISOString()).toBe('2026-03-05T04:50:30.000Z')
  })
  it('reads EXIF for a small photo that is kept as picked', async () => {
    stubBitmap(800, 600)
    stubCanvas()
    const blob = jpegWithExif('2026:01:02 03:04:05')
    const small = new File([blob], 'small.jpg', { type: 'image/jpeg' })
    const out = await prepareImage(small)
    expect(out.reencoded).toBe(false)
    expect(out.exifTakenAt).toBe('2026-01-02T03:04:05+05:30')
  })
})
