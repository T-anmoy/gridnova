import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PortalHome from '@/components/associate/PortalHome'
import CustomersList from '@/components/associate/CustomersList'
import LocationChip from '@/components/associate/LocationChip'
import LocationDetailCard from '@/components/associate/LocationDetailCard'
import { describeTodo } from '@/lib/onboarding/todo'
import { en, withI18n } from './helpers/i18n'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'
import type { HomeItem } from '@/lib/associate/home-api-client'
import type { Onboarding, SiteLocation } from '@/lib/associate/onboarding-types'

const h = vi.hoisted(() => ({
  home: {} as { data?: unknown },
  onboardings: {} as { data?: unknown },
}))
vi.mock('@/lib/associate/home-api-client', () => ({ useAssociateHome: () => ({ ...h.home, refetch: vi.fn() }) }))
vi.mock('@/lib/associate/api-client', () => ({
  useAssociateMe: () => ({ data: { full_name: 'Asha Roy', associate_id: 'GNA-1', level: null, status: 'active' }, refetch: vi.fn() }),
}))
vi.mock('@/lib/associate/onboarding-api-client', () => ({
  useOnboardings: () => ({ ...h.onboardings, refetch: vi.fn() }),
}))
vi.mock('@/lib/commissions/associate-api-client', () => ({ useMyRate: () => ({ data: undefined, isLoading: false }) }))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 't' }), useClerk: () => ({ signOut: vi.fn() }) }))

const m = en.siteLocation
const feed = en.associates.portal.feed
const item = (over: Partial<HomeItem> = {}): HomeItem => ({ kind: 'x', message_key: 'todo.x', onboarding_id: 5, customer_name: 'Bikash Das', priority: 1, params: {}, ...over })

beforeEach(() => {
  h.home = { data: { items: [], totals: { customers: 0, awaiting_grid_nova: 0, needing_action: 0 } } }
  h.onboardings = {}
})

describe('LocationChip', () => {
  it('confirmed → "Location confirmed ✓"', () => {
    render(withI18n(<LocationChip location={{ present: true, confirmed: true }} status="draft" />))
    expect(screen.getByTestId('location-chip')).toHaveTextContent(m.chip.confirmed)
  })
  it('a draft with no location → "Location needed"; set but unconfirmed → "Confirm location"', () => {
    const { rerender } = render(withI18n(<LocationChip location={{ present: false, confirmed: false }} status="draft" />))
    expect(screen.getByTestId('location-chip')).toHaveTextContent(m.chip.needed)
    rerender(withI18n(<LocationChip location={{ present: true, confirmed: false }} status="draft" />))
    expect(screen.getByTestId('location-chip')).toHaveTextContent(m.chip.toConfirm)
  })
  it('a submitted customer without a location (grandfathered) is not nagged', () => {
    render(withI18n(<LocationChip location={{ present: false, confirmed: false }} status="submitted" />))
    expect(screen.queryByTestId('location-chip')).not.toBeInTheDocument()
  })
})

describe('to-do feed kinds', () => {
  it('renders both new kinds in English, Hindi and Bengali', () => {
    for (const [key, locale] of [['site_location_missing', en], ['site_location_unconfirmed', en], ['site_location_missing', hi], ['site_location_unconfirmed', bn]] as const) {
      const f = (locale as typeof en).associates.portal.feed
      expect(describeTodo(item({ message_key: `todo.${key}` }), f, {})).toBe(f.todo[key])
    }
    expect(hi.associates.portal.feed.todo.site_location_missing).not.toBe(en.associates.portal.feed.todo.site_location_missing)
  })

  it('an unknown key still falls back to the generic line', () => {
    expect(describeTodo(item({ message_key: 'todo.something_new_in_3d' }), feed, {})).toBe(feed.todo.generic)
  })

  it('the cards link to the edit wizard on the house step', () => {
    h.home = {
      data: {
        items: [
          item({ kind: 'site_location_missing', message_key: 'todo.site_location_missing', onboarding_id: 11 }),
          item({ kind: 'site_location_unconfirmed', message_key: 'todo.site_location_unconfirmed', onboarding_id: 12 }),
        ],
        totals: { customers: 2, awaiting_grid_nova: 0, needing_action: 2 },
      },
    }
    render(withI18n(<PortalHome copy={en.associates.portal.associate.home} feed={feed} stageNames={{}} portalBase="/associates/portal" />))
    const cards = screen.getAllByTestId('todo-card')
    expect(cards[0]).toHaveAttribute('href', '/associates/portal/customers/11/edit?step=house')
    expect(cards[1]).toHaveAttribute('href', '/associates/portal/customers/12/edit?step=house')
    expect(cards[0]).toHaveTextContent(feed.todo.site_location_missing)
    expect(document.body.textContent).not.toMatch(/todo\.site_location/)
  })
})

function listItem(over: Partial<Onboarding>): Onboarding {
  return {
    onboarding_id: 1,
    status: 'draft',
    customer: { name: 'Bikash Das', mobile: '9800000000', email: null },
    score: null,
    formal_proposal_blocked: null,
    progress_summary: undefined,
    ...over,
  } as Onboarding
}
const nextStep = en.associates.portal.shared.nextStep

describe('customer cards (list items carry the location summary — no extra requests)', () => {
  it('shows a chip per card from the list response alone', () => {
    h.onboardings = {
      data: {
        items: [
          listItem({ onboarding_id: 1, site_location: { present: true, confirmed: true } }),
          listItem({ onboarding_id: 2, customer: { name: 'Chitra', mobile: '9', email: null }, site_location: { present: false, confirmed: false } }),
        ],
        page: 1,
        page_size: 50,
        total: 2,
      },
    }
    render(withI18n(<CustomersList copy={en.associates.portal.customers} nextStepCopy={nextStep} actionNeededLabel="Needs you" portalBase="/associates/portal" />))
    const chips = screen.getAllByTestId('location-chip')
    expect(chips.map((c) => c.getAttribute('data-state'))).toEqual(['confirmed', 'needed'])
  })

  it('a Preferred viewer sees only captured/confirmed for a downline customer — no coordinates anywhere', () => {
    h.onboardings = {
      data: {
        items: [
          listItem({
            onboarding_id: 3,
            site_latitude: null,
            site_longitude: null,
            // Exactly what the backend sends a Preferred Associate: {present, confirmed} only.
            site_location: { present: true, confirmed: true },
          }),
        ],
        page: 1,
        page_size: 50,
        total: 1,
      },
    }
    const { container } = render(withI18n(<CustomersList copy={en.associates.portal.customers} nextStepCopy={nextStep} actionNeededLabel="Needs you" portalBase="/preferred/portal" />))
    expect(screen.getByTestId('location-chip')).toHaveTextContent(m.chip.confirmed)
    expect(container.textContent).not.toMatch(/\d{1,3}\.\d{3,}/)
    expect(container.querySelector('a[href*="google.com/maps"]')).toBeNull()
  })
})

describe('LocationDetailCard', () => {
  const FULL: SiteLocation = { present: true, confirmed: true, latitude: 22.5726, longitude: 88.3639, source: 'device_gps', accuracy_m: 8, verified: true, maps_url: 'https://www.google.com/maps?q=22.5726,88.3639' }

  it('shows the owner where it is and a link to check it in Google Maps', () => {
    render(withI18n(<LocationDetailCard location={FULL} isOwner editHref="/associates/portal/customers/1/edit?step=house" />))
    expect(screen.getByTestId('location-detail')).toHaveTextContent('22.5726, 88.3639')
    expect(screen.getByRole('link', { name: m.actions.openMaps })).toHaveAttribute('href', FULL.maps_url)
    expect(screen.getByRole('link', { name: m.actions.change })).toHaveAttribute('href', '/associates/portal/customers/1/edit?step=house')
  })

  it('never renders coordinates or a map link for anyone who does not own the customer — even if they were somehow sent', () => {
    const { container } = render(withI18n(<LocationDetailCard location={FULL} isOwner={false} />))
    expect(screen.getByTestId('location-detail-other')).toHaveTextContent(m.detail.confirmedOther)
    expect(container.textContent).not.toMatch(/22\.57|88\.36/)
    expect(container.querySelector('a')).toBeNull()
  })

  it('says only "captured" or "not captured" to a non-owner', () => {
    const { rerender } = render(withI18n(<LocationDetailCard location={{ present: true, confirmed: false }} isOwner={false} />))
    expect(screen.getByTestId('location-detail-other')).toHaveTextContent(m.detail.capturedOther)
    rerender(withI18n(<LocationDetailCard location={{ present: false, confirmed: false }} isOwner={false} />))
    expect(screen.getByTestId('location-detail-other')).toHaveTextContent(m.detail.notCaptured)
  })
})
