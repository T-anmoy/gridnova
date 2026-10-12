import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { en, withI18n } from './helpers/i18n'
import { ApiError } from '@/lib/dashboard/api-error'
import { DRAFT_TTL_MS, readDraft, useAutosaveDraft, writeDraft } from '@/lib/associate/useAutosaveDraft'
import { APPLY_DRAFT_EXCLUDED } from '@/components/associate/AssociateApplyForm'
import { applyDraftKey, clearPortalDeviceData, onboardingDraftKey, registerDraftKey, LAST_TERRITORY_KEY } from '@/lib/associate/portal-session'
import { PHOTO_QUEUE_TTL_MS, listPendingPhotos, purgePendingPhotoScope, putPendingPhoto, type PendingPhoto } from '@/lib/associate/photo-queue'
import { isTransientUploadError } from '@/lib/associate/usePhotoUploads'
import { dashboardFetchForm, UPLOAD_STALL_TIMEOUT_MS } from '@/lib/associate/onboarding-api-client'
import { readSerialDraft, useSerialDraftWriter, SERIAL_DRAFT_DEBOUNCE_MS } from '@/lib/associate/serial-draft'
import { isBareRoute } from '@/components/SiteChrome'
import FileUploadSlot from '@/components/associate/FileUploadSlot'
import PhotoCaptureSlot from '@/components/associate/PhotoCaptureSlot'
import { DashboardError } from '@/components/dashboard/DashboardError'
import type { CapturedPhoto } from '@/lib/associate/photo-types'

const prepare = vi.fn()
vi.mock('@/lib/associate/image-prep', async (orig) => ({ ...(await orig<typeof import('@/lib/associate/image-prep')>()), prepareImage: (f: File) => prepare(f) }))
const signOut = vi.fn()
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok', userId: 'user_1', isLoaded: true }), useClerk: () => ({ signOut }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/associates/portal' }))

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  prepare.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ── H1 ──────────────────────────────────────────────────────────────────

describe('H1 — drafts on a shared phone', () => {
  it('excluded fields never reach storage, and are never restored even if an old build stored them', () => {
    const initial = { full_name: '', aadhaar_number: '', pan: '', bank_account_number: '', bank_ifsc: '', date_of_birth: '', mobile: '' }
    const { result, unmount } = renderHook(() => useAutosaveDraft('k1', initial, { exclude: ['aadhaar_number', 'pan', 'bank_account_number', 'bank_ifsc', 'date_of_birth', 'mobile'] }))
    act(() => result.current[1]({ full_name: 'Asha', aadhaar_number: '123412341234', pan: 'ABCPE1234F', bank_account_number: '1234567890', bank_ifsc: 'SBIN0001234', date_of_birth: '1990-01-01', mobile: '9800000000' }))
    const raw = window.localStorage.getItem('k1')!
    expect(raw).toContain('Asha')
    for (const secret of ['123412341234', 'ABCPE1234F', '1234567890', 'SBIN0001234', '1990-01-01', '9800000000']) expect(raw).not.toContain(secret)
    unmount()

    writeDraft('k2', { full_name: 'B', aadhaar_number: '999988887777' })
    const { result: r2 } = renderHook(() => useAutosaveDraft('k2', initial, { exclude: ['aadhaar_number'] }))
    expect(r2.current[0].full_name).toBe('B')
    expect(r2.current[0].aadhaar_number).toBe('')
  })

  it('the apply form excludes identity, bank, birth date and every mobile number', () => {
    expect([...APPLY_DRAFT_EXCLUDED].sort()).toEqual(['aadhaar_number', 'bank_account_number', 'bank_ifsc', 'date_of_birth', 'mobile', 'pan', 'reference_1_mobile', 'reference_2_mobile'])
  })

  it('a draft older than 24 h is purged on read; a pre-TTL (untimestamped) draft too', () => {
    writeDraft('old', { a: 'x' }, Date.now() - DRAFT_TTL_MS - 1000)
    expect(readDraft('old')).toBeNull()
    expect(window.localStorage.getItem('old')).toBeNull()
    window.localStorage.setItem('legacy', JSON.stringify({ customer_name: 'raw' }))
    expect(readDraft('legacy')).toBeNull()
    expect(window.localStorage.getItem('legacy')).toBeNull()
    writeDraft('fresh', { a: 'y' })
    expect(readDraft('fresh')).toEqual({ a: 'y' })
  })

  it('keys are scoped to the signed-in user', () => {
    expect(onboardingDraftKey('user_1', 'new')).not.toBe(onboardingDraftKey('user_2', 'new'))
    expect(onboardingDraftKey('user_1', 12)).toBe('gna-onboarding-user_1-12')
    expect(registerDraftKey('user_1', 5)).toBe('gna-register-user_1-5')
    expect(applyDraftKey('associate', null)).toBe('gna-apply-associate')
    expect(applyDraftKey('associate', 'user_9')).toBe('gna-apply-associate-user_9')
  })

  it('sign-out wipes drafts, queued photos and the remembered territory — and nothing else', async () => {
    writeDraft('gna-onboarding-user_1-new', { a: 'x' })
    writeDraft('gna-register-user_1-5', { rows: [] })
    writeDraft('gna-apply-associate', { a: 'x' })
    window.localStorage.setItem('NEXT_LOCALE', 'hi')
    window.sessionStorage.setItem(LAST_TERRITORY_KEY, '{}')
    await putPendingPhoto(pending({ id: 'p1', scope: 'user_1:onboarding-5' }))
    await clearPortalDeviceData()
    expect(window.localStorage.getItem('gna-onboarding-user_1-new')).toBeNull()
    expect(window.localStorage.getItem('gna-register-user_1-5')).toBeNull()
    expect(window.localStorage.getItem('gna-apply-associate')).toBeNull()
    expect(window.localStorage.getItem('NEXT_LOCALE')).toBe('hi')
    expect(window.sessionStorage.getItem(LAST_TERRITORY_KEY)).toBeNull()
    expect(await listPendingPhotos('user_1:onboarding-5')).toEqual([])
  })

  it('the portal shell clears device data before signing out', async () => {
    const { default: PortalShell } = await import('@/components/associate/PortalShell')
    writeDraft('gna-onboarding-user_1-new', { a: 'x' })
    render(withI18n(<PortalShell base="/associates/portal" active="home" labels={en.associates.portal.nav} showTerritory={false} signOutLabel="Sign out">x</PortalShell>))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(signOut).toHaveBeenCalled())
    expect(window.localStorage.getItem('gna-onboarding-user_1-new')).toBeNull()
  })
})

// ── H5 ──────────────────────────────────────────────────────────────────

function pending(over: Partial<PendingPhoto> = {}): PendingPhoto {
  return { id: 'x', scope: 's', slot: 'front', blob: new Blob(['x']), filename: 'a.jpg', type: 'image/jpeg', captureMethod: 'camera', createdAt: Date.now(), ...over }
}

describe('H5 — the photo queue purges', () => {
  it('drops photos past the TTL when listed', async () => {
    await putPendingPhoto(pending({ id: 'old', scope: 'sc', createdAt: Date.now() - PHOTO_QUEUE_TTL_MS - 1 }))
    await putPendingPhoto(pending({ id: 'new', scope: 'sc' }))
    expect((await listPendingPhotos('sc')).map((p) => p.id)).toEqual(['new'])
    await purgePendingPhotoScope('sc')
  })

  it('purges one scope (on submit) without touching another', async () => {
    await putPendingPhoto(pending({ id: 'a', scope: 'user_1:onboarding-1' }))
    await putPendingPhoto(pending({ id: 'b', scope: 'user_1:onboarding-2' }))
    await purgePendingPhotoScope('user_1:onboarding-1')
    expect(await listPendingPhotos('user_1:onboarding-1')).toEqual([])
    expect((await listPendingPhotos('user_1:onboarding-2')).map((p) => p.id)).toEqual(['b'])
    await purgePendingPhotoScope('user_1:onboarding-2')
  })
})

// ── H6 ──────────────────────────────────────────────────────────────────

describe('H6 — upload robustness', () => {
  it('retries only network-class errors', () => {
    expect(isTransientUploadError(new ApiError(0, 'Network request failed'))).toBe(true)
    expect(isTransientUploadError(new ApiError(503, 'x'))).toBe(true)
    expect(isTransientUploadError(new ApiError(429, 'x'))).toBe(true)
    expect(isTransientUploadError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isTransientUploadError(new ApiError(422, 'x'))).toBe(false)
    expect(isTransientUploadError(new Error('onboarding not created yet'))).toBe(false)
    expect(isTransientUploadError('weird')).toBe(false)
  })

  it('a stalled upload is aborted after the stall timeout and settles as a network error', async () => {
    vi.useFakeTimers()
    const abort = vi.fn()
    class FakeXhr {
      upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null }
      onprogress: (() => void) | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      ontimeout: (() => void) | null = null
      onabort: (() => void) | null = null
      open() {}
      setRequestHeader() {}
      send() {}
      abort() {
        abort()
        this.onabort?.()
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const p = dashboardFetchForm('/x', 'tok', new FormData(), vi.fn())
    const settled = expect(p).rejects.toMatchObject({ status: 0 })
    await vi.advanceTimersByTimeAsync(UPLOAD_STALL_TIMEOUT_MS + 10)
    await settled
    expect(abort).toHaveBeenCalledTimes(1)
  })

  it('a 2xx that is not JSON is an ApiError, never a crash or a fake success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>proxy</html>', { status: 200 })))
    await expect(dashboardFetchForm('/x', 'tok', new FormData())).rejects.toBeInstanceOf(ApiError)
  })
})

// ── H7 / H8 ─────────────────────────────────────────────────────────────

describe('H7 — FileUploadSlot', () => {
  const props = {
    label: 'Electricity bill',
    why: '',
    accept: 'image/*,application/pdf',
    acceptedTypesLabel: 'JPG, PNG or PDF',
    file: null,
    chooseLabel: 'Choose file',
    replaceLabel: 'Replace',
    whyLabel: 'Still needed',
  }

  it('is a real, named button reachable by keyboard', async () => {
    render(withI18n(<FileUploadSlot {...props} onChange={vi.fn()} />))
    const btn = screen.getByRole('button', { name: 'Choose file: Electricity bill' })
    const user = userEvent.setup()
    await user.tab()
    expect(btn).toHaveFocus()
  })

  it('shrinks a camera shot through prepareImage before judging its size', async () => {
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'IMG_1.jpg', { type: 'image/jpeg' })
    const small = new File([new Uint8Array(400_000)], 'IMG_1.jpg', { type: 'image/jpeg' })
    prepare.mockResolvedValue({ file: small, reencoded: true, exifTakenAt: null })
    const onChange = vi.fn()
    const { container } = render(withI18n(<FileUploadSlot {...props} onChange={onChange} />))
    await userEvent.setup().upload(container.querySelector('input[type="file"]') as HTMLInputElement, big)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(small))
  })

  it('a PDF over the limit gets the translated message', async () => {
    const onChange = vi.fn()
    const { container } = render(withI18n(<FileUploadSlot {...props} onChange={onChange} />))
    await userEvent.setup().upload(container.querySelector('input[type="file"]') as HTMLInputElement, new File([new Uint8Array(6 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('"big.pdf" is larger than the 5 MB limit.')
    expect(onChange).not.toHaveBeenCalled()
    expect(prepare).not.toHaveBeenCalled()
  })
})

describe('H8 — PhotoCaptureSlot does not leak blob URLs', () => {
  it('creates one URL per photo (not per render) and revokes it when the photo changes and on unmount', () => {
    const create = vi.fn((f: Blob) => `blob:${(f as File).name}`)
    const revoke = vi.fn()
    vi.stubGlobal('URL', Object.assign(function () {}, { createObjectURL: create, revokeObjectURL: revoke }))
    const photo = (name: string): CapturedPhoto => ({ file: new File(['x'], name, { type: 'image/jpeg' }), capture_method: 'gallery', captured_at: '2026-10-12T00:00:00Z' })
    const p1 = photo('a.jpg')
    const base = { label: 'Front', captureLabel: 'Take photo', locationRequiredLabel: 'loc', retryLabel: 'Retry', onChange: vi.fn() }
    const { rerender, unmount } = render(withI18n(<PhotoCaptureSlot {...base} value={p1} status="uploading" progress={10} />))
    rerender(withI18n(<PhotoCaptureSlot {...base} value={p1} status="uploading" progress={50} />))
    rerender(withI18n(<PhotoCaptureSlot {...base} value={p1} status="uploading" progress={90} />))
    expect(create).toHaveBeenCalledTimes(1)
    rerender(withI18n(<PhotoCaptureSlot {...base} value={photo('b.jpg')} status="success" />))
    expect(revoke).toHaveBeenCalledWith('blob:a.jpg')
    unmount()
    expect(revoke).toHaveBeenCalledWith('blob:b.jpg')
  })
})

// ── H9 ──────────────────────────────────────────────────────────────────

describe('H9 — serial rows survive a discarded tab', () => {
  type Row = { serial: string; check?: string }
  const opts = { isDirty: (r: Row) => !!r.serial, toStored: (r: Row) => ({ serial: r.serial }) }

  it('writes dirty rows (debounced, without transient fields), restores them, and clears when all clean', () => {
    vi.useFakeTimers()
    const { rerender } = renderHook(({ rows }) => useSerialDraftWriter('gna-register-user_1-5', rows, opts), { initialProps: { rows: [{ serial: 'SN1', check: 'ok' }, { serial: '' }] as Row[] } })
    expect(window.localStorage.getItem('gna-register-user_1-5')).toBeNull()
    act(() => void vi.advanceTimersByTime(SERIAL_DRAFT_DEBOUNCE_MS + 1))
    expect(readSerialDraft('gna-register-user_1-5', (s) => s as Row)).toEqual([{ serial: 'SN1' }])
    rerender({ rows: [{ serial: '' }] })
    act(() => void vi.advanceTimersByTime(SERIAL_DRAFT_DEBOUNCE_MS + 1))
    expect(window.localStorage.getItem('gna-register-user_1-5')).toBeNull()
  })
})

// ── H10 ─────────────────────────────────────────────────────────────────

describe('H10 — portals render without the marketing chrome', () => {
  it.each(['/associates/portal', '/associates/portal/customers/new', '/preferred/portal/territory', '/associates/sign-in', '/preferred/sign-in/factor-one', '/dashboard', '/proposal/accept/x'])('%s is bare', (p) => {
    expect(isBareRoute(p, true)).toBe(true)
  })
  it.each(['/', '/about', '/associates', '/associates/apply/associate', '/associates/portalx'])('%s keeps the chrome', (p) => {
    expect(isBareRoute(p, true)).toBe(false)
  })
  it('while the portal is closed its routes keep the chrome (the "opening soon" page)', () => {
    expect(isBareRoute('/associates/portal', false)).toBe(false)
  })
})

// ── H11 ─────────────────────────────────────────────────────────────────

describe('H11 — tab bar and viewport', () => {
  it('labels the navs, marks the active tab, pads for the home bar, and uses ≥ 11px labels', async () => {
    const { default: PortalShell } = await import('@/components/associate/PortalShell')
    render(withI18n(<PortalShell base="/associates/portal" active="customers" labels={en.associates.portal.nav} showTerritory={false} signOutLabel="Sign out">x</PortalShell>))
    const navs = screen.getAllByRole('navigation', { name: en.associates.portal.nav.navLabel })
    expect(navs).toHaveLength(2)
    const bar = screen.getByTestId('portal-tab-bar')
    expect(bar.className).toContain('pb-[env(safe-area-inset-bottom)]')
    const active = bar.querySelector('[aria-current="page"]')!
    expect(active).toHaveTextContent(en.associates.portal.nav.customers)
    expect(active.className).toContain('text-[11px]')
    expect(active.className).not.toContain('text-[10px]')
  })

  it('both portal layouts export viewportFit: cover', async () => {
    const a = await import('@/app/(site)/[lang]/associates/layout')
    const p = await import('@/app/(site)/[lang]/preferred/layout')
    expect(a.viewport).toMatchObject({ viewportFit: 'cover', themeColor: '#0e2a63' })
    expect(p.viewport).toMatchObject({ viewportFit: 'cover', themeColor: '#0e2a63' })
  })
})

// ── BE-1 ────────────────────────────────────────────────────────────────

describe('BE-1 — session_token_missing_claims', () => {
  it('shows one plain translated message, no retry loop', () => {
    const retry = vi.fn()
    render(withI18n(<DashboardError error={new ApiError(403, 'x', 'm', { code: 'session_token_missing_claims', message: 'm' })} onRetry={retry} />))
    expect(screen.getByTestId('missing-claims')).toHaveTextContent(en.portalErrors.missingClaims.body)
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })

  it('an ordinary 403 still gets the permission card', () => {
    render(withI18n(<DashboardError error={new ApiError(403, 'x', 'Forbidden')} />))
    expect(screen.queryByTestId('missing-claims')).not.toBeInTheDocument()
  })
})
