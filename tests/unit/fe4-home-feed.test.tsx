import { describe, it, expect } from 'vitest'
import { describeTodo, todoHref, todoKey, todoTitle } from '@/lib/onboarding/todo'
import type { HomeItem } from '@/lib/associate/home-api-client'
import { en } from './helpers/i18n'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'

const feed = en.associates.portal.feed
const stages = en.associates.portal.execution.stages

const payout: HomeItem = {
  kind: 'commission_payout_paid',
  message_key: 'todo.commission_payout_paid',
  onboarding_id: null,
  customer_name: null,
  priority: 3,
  params: { batch_id: 3, period: '2026-10', net: '24254.61', bank_reference: 'UTR123456', bank_account_last4: '4321' },
}
const answered: HomeItem = {
  kind: 'commission_query_answered',
  message_key: 'todo.commission_query_answered',
  onboarding_id: null,
  customer_name: null,
  priority: 3,
  params: { query_id: 8, entry_id: 12 },
}

describe('commission to-dos (E5)', () => {
  it('describes a paid payout in the viewer’s language with the money formatted, not calculated', () => {
    expect(describeTodo(payout, feed, stages)).toBe('Commission paid: ₹24,254.61 for 2026-10, sent to the account ending 4321 (reference UTR123456).')
    expect(describeTodo(payout, hi.associates.portal.feed, stages)).toContain('₹24,254.61')
    expect(describeTodo(payout, bn.associates.portal.feed, stages)).toContain('UTR123456')
  })

  it('describes an answered query', () => {
    expect(describeTodo(answered, feed, stages)).toBe('Grid Nova has answered your commission query.')
  })

  it('links to Earnings, not to a customer, even though there is no onboarding', () => {
    expect(todoHref(payout, '/associates/portal')).toBe('/associates/portal/earnings?tab=payouts')
    expect(todoHref(answered, '/preferred/portal')).toBe('/preferred/portal/earnings?entry=12')
  })

  it('a null customer gets a plain title instead of “null”', () => {
    expect(todoTitle(payout, feed)).toBe('Commission payout')
    expect(todoTitle({ ...answered, customer_name: 'Bikash Das' }, feed)).toBe('Bikash Das')
    expect(todoTitle({ ...answered, kind: 'something_new' }, feed)).toBe('Update')
  })

  it('gives two payouts for different batches different keys', () => {
    const other = { ...payout, params: { ...payout.params, batch_id: 4 } }
    expect(todoKey(payout)).not.toBe(todoKey(other))
  })

  it('an unknown key still falls back to the safe generic line', () => {
    expect(describeTodo({ ...payout, message_key: 'todo.brand_new' }, feed, stages)).toBe(feed.todo.generic)
  })
})
