import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignaturePad, { fitPngUnder, type SignaturePadHandle } from '@/components/associate/SignaturePad'
import { signatureErrorText } from '@/components/associate/survey/SurveyStep'
import { buildSignatureForm } from '@/lib/associate/survey-api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import en from '@/messages/en.json'

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }) }))

afterEach(() => vi.restoreAllMocks())

function fakeCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

describe('fitPngUnder', () => {
  it('returns the PNG as-is when it is under the limit', async () => {
    const encode = vi.fn(async () => new Blob([new Uint8Array(1000)], { type: 'image/png' }))
    const out = await fitPngUnder(fakeCanvas(600, 300), 500 * 1024, encode)
    expect(out?.type).toBe('image/png')
    expect(encode).toHaveBeenCalledTimes(1)
  })

  it('scales down by ¾ until it fits under signature_max_kb', async () => {
    const sizes: number[] = []
    const encode = vi.fn(async (c: HTMLCanvasElement) => {
      sizes.push(c.width)
      // Bytes proportional to area: 1000 px wide → 1,000,000 bytes.
      return new Blob([new Uint8Array(c.width * c.width)], { type: 'image/png' })
    })
    const drawImage = vi.fn()
    const makeCanvas = () => {
      const c = document.createElement('canvas')
      vi.spyOn(c, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D)
      return c
    }
    const out = await fitPngUnder(fakeCanvas(1000, 400), 500 * 1024, encode, makeCanvas)
    expect(out!.size).toBeLessThanOrEqual(500 * 1024)
    expect(sizes).toEqual([1000, 750, 563])
    expect(drawImage).toHaveBeenCalledTimes(2)
  })

  it('gives up (null) instead of sending something the server will refuse', async () => {
    const encode = vi.fn(async () => new Blob([new Uint8Array(10_000)], { type: 'image/png' }))
    const makeCanvas = () => {
      const c = document.createElement('canvas')
      vi.spyOn(c, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
      return c
    }
    expect(await fitPngUnder(fakeCanvas(100, 100), 100, encode, makeCanvas)).toBeNull()
  })
})

describe('SignaturePad', () => {
  function setup() {
    const ctx = { scale: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), save: vi.fn(), restore: vi.fn(), setTransform: vi.fn(), clearRect: vi.fn() }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob([new Uint8Array(2000)], { type: 'image/png' })))
    const ref = createRef<SignaturePadHandle>()
    const onInk = vi.fn()
    render(<SignaturePad ref={ref} id="sig" label="Sign here" hint="Use a finger" clearLabel="Clear" onInkChange={onInk} />)
    return { ref, onInk, ctx }
  }

  it('refuses an empty pad', async () => {
    const { ref } = setup()
    expect(ref.current!.isEmpty()).toBe(true)
    expect(await ref.current!.toPng(500 * 1024)).toBeNull()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()
  })

  it('a stroke (pointer events) produces a PNG; Clear empties it again', async () => {
    const { ref, onInk, ctx } = setup()
    const canvas = screen.getByTestId('sig-canvas')
    expect(canvas).toHaveAccessibleName('Sign here')
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(canvas, { clientX: 40, clientY: 30, pointerId: 1 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })
    expect(ctx.stroke).toHaveBeenCalled()
    expect(onInk).toHaveBeenLastCalledWith(true)
    const png = await ref.current!.toPng(500 * 1024)
    expect(png?.type).toBe('image/png')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear' }))
    expect(ref.current!.isEmpty()).toBe(true)
    expect(onInk).toHaveBeenLastCalledWith(false)
  })
})

describe('signature upload', () => {
  it('the multipart body carries the PNG and, for the customer only, the declaration fields', () => {
    const png = new Blob(['x'], { type: 'image/png' })
    const customer = buildSignatureForm({ party: 'customer', file: png, declaration_name: 'Asha Roy', customer_confirms_data: true })
    expect(customer.get('declaration_name')).toBe('Asha Roy')
    expect(customer.get('customer_confirms_data')).toBe('true')
    expect((customer.get('file') as File).name).toBe('customer-signature.png')
    const associate = buildSignatureForm({ party: 'associate', file: png })
    expect(associate.has('declaration_name')).toBe(false)
    expect(associate.has('customer_confirms_data')).toBe(false)
  })

  const t = en.survey
  it.each([
    [new ApiError(413, 'x', 'too big', { code: 'file_too_large', max_kb: 500 }), 'The signature image is too large (500 KB max). Clear it and sign again.'],
    [new ApiError(413, 'x', 'Request Entity Too Large'), 'The signature image is too large (500 KB max). Clear it and sign again.'],
    [new ApiError(422, 'x', 'm', { code: 'declaration_name_required' }), t.signatures.errors.declaration_name_required],
    [new ApiError(422, 'x', 'm', { code: 'confirmation_required' }), t.signatures.errors.confirmation_required],
    [new ApiError(422, 'x', 'm', { code: 'signature_not_png' }), t.signatures.errors.signature_not_png],
    [new ApiError(409, 'x', 'm', { code: 'not_editable' }), t.signatures.errors.not_editable],
    [new ApiError(503, 'x', 'm', { code: 'storage_not_configured' }), t.signatures.errors.storage_not_configured],
    [new ApiError(0, 'Network request failed'), t.signatures.offline],
    [new ApiError(403, 'x', 'm', { code: 'session_token_missing_claims', message: 'm' }), en.portalErrors.missingClaims.body],
  ])('maps %s to a plain message', (err, text) => {
    expect(signatureErrorText(err, t, 500, en.portalErrors.missingClaims.body, t.signatures.offline)).toBe(text)
  })
})
