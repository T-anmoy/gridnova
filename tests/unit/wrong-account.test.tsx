import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError, classifyApiError, isRetryableError } from '@/lib/dashboard/api-error'
import { DashboardError } from '@/components/dashboard/DashboardError'
import PhotoFlagBadges from '@/components/dashboard/PhotoFlagBadges'

const signOut = vi.fn()
vi.mock('@clerk/nextjs', () => ({ useClerk: () => ({ signOut }) }))

const ASSOCIATE_ON_STAFF = 'This account cannot access staff endpoints.'
const STAFF_ON_ASSOCIATE = 'This endpoint is for Grid Nova associates only.'

beforeEach(() => signOut.mockReset())

describe('wrong-account handling', () => {
  it('classifies the two exact backend sentences as a wrong account, on 403 and on 401', () => {
    for (const status of [403, 401]) {
      expect(classifyApiError(new ApiError(status, 'x', ASSOCIATE_ON_STAFF)).kind).toBe('wrongAccount')
      expect(classifyApiError(new ApiError(status, 'x', STAFF_ON_ASSOCIATE)).kind).toBe('wrongAccount')
    }
  })

  it('a plain 401 stays the normal session-expired path, and a plain 403 stays "forbidden"', () => {
    expect(classifyApiError(new ApiError(401, 'x', 'Invalid token')).kind).toBe('auth')
    expect(classifyApiError(new ApiError(403, 'x', 'Only Admin can do this')).kind).toBe('forbidden')
  })

  it('is never retried', () => {
    expect(isRetryableError(new ApiError(403, 'x', ASSOCIATE_ON_STAFF))).toBe(false)
  })

  it('an associate on the staff dashboard sees the page and signs out to the staff sign-in only on click', async () => {
    render(<DashboardError error={new ApiError(403, 'x', ASSOCIATE_ON_STAFF)} onRetry={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Wrong account')
    expect(signOut).not.toHaveBeenCalled() // no automatic sign-out
    await userEvent.setup().click(screen.getByRole('button', { name: /staff sign-in/i }))
    expect(signOut).toHaveBeenCalledWith({ redirectUrl: '/dashboard/sign-in' })
  })

  it('a staff user in the Preferred portal is sent to the Preferred sign-in', async () => {
    window.history.pushState({}, '', '/hi/preferred/portal/customers')
    render(<DashboardError error={new ApiError(403, 'x', STAFF_ON_ASSOCIATE)} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /sign out/i }))
    expect(signOut).toHaveBeenCalledWith({ redirectUrl: '/preferred/sign-in' })
    window.history.pushState({}, '', '/')
  })
})

describe('staff-only photo flags', () => {
  it('renders provenance and each backend flag as a badge', () => {
    render(<PhotoFlagBadges captureMethod="gallery" locationVerified={false} flags={['gallery_upload', 'no_metadata', 'old_photo', 'duplicate_photo']} />)
    const text = screen.getByTestId('photo-flags').textContent ?? ''
    for (const label of ['Gallery', 'location not verified', 'Gallery upload', 'No metadata', 'Old photo', 'Duplicate photo']) expect(text).toContain(label)
  })

  it('is never imported by any associate- or public-facing code', () => {
    const roots = ['components/associate', 'app/(site)']
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(tsx?|ts)$/.test(name) && readFileSync(p, 'utf8').includes('PhotoFlagBadges')) offenders.push(p)
      }
    }
    roots.forEach(walk)
    expect(offenders).toEqual([])
  })
})
