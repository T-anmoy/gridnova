import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, ApiShapeError } from '@/lib/dashboard/api-error'
import { MAX_QUERY_RETRIES, queryDefaults, shouldRetryQuery } from '@/lib/api/retry-policy'
import { QueryProvider } from '@/components/dashboard/QueryProvider'
import { AssociateQueryProvider } from '@/components/associate/AssociateQueryProvider'
import { PublicQueryProvider } from '@/components/associate/PublicQueryProvider'

describe('shouldRetryQuery — one policy for every client', () => {
  it.each([
    ['network failure', new ApiError(0, 'Network request failed')],
    ['429', new ApiError(429, 'x')],
    ['500', new ApiError(500, 'x')],
    ['503', new ApiError(503, 'x')],
    ['a thrown non-API error (e.g. Clerk offline)', new Error('ClerkOfflineError')],
  ])('retries %s', (_n, err) => {
    expect(shouldRetryQuery(0, err)).toBe(true)
  })

  it.each([
    ['401', new ApiError(401, 'x')],
    ['403', new ApiError(403, 'x')],
    ['404', new ApiError(404, 'x')],
    ['422', new ApiError(422, 'x')],
    ['a response of the wrong shape', new ApiShapeError('/x', 'bad')],
  ])('never retries %s', (_n, err) => {
    expect(shouldRetryQuery(0, err)).toBe(false)
  })

  it('stops after MAX_QUERY_RETRIES attempts', () => {
    const err = new ApiError(500, 'x')
    expect(shouldRetryQuery(MAX_QUERY_RETRIES - 1, err)).toBe(true)
    expect(shouldRetryQuery(MAX_QUERY_RETRIES, err)).toBe(false)
  })

  it('backs off exponentially up to a ceiling', () => {
    const delays = [0, 1, 2, 3, 4, 10].map((i) => queryDefaults.retryDelay(i))
    expect(delays).toEqual([1000, 2000, 4000, 8000, 8000, 8000])
  })
})

describe('all three QueryProviders use that policy', () => {
  function defaultsOf(tree: React.ReactNode) {
    let seen: ReturnType<ReturnType<typeof useQueryClient>['getDefaultOptions']> | undefined
    function Probe() {
      seen = useQueryClient().getDefaultOptions()
      return null
    }
    const Wrapped = tree as React.ReactElement<{ children?: React.ReactNode }>
    render(<Wrapped.type {...Wrapped.props}><Probe /></Wrapped.type>)
    return seen!.queries!
  }

  it.each([
    ['staff dashboard', <QueryProvider key="a">{null}</QueryProvider>],
    ['associate portal', <AssociateQueryProvider key="b" signInPath="/associates/sign-in">{null}</AssociateQueryProvider>],
    ['public pages', <PublicQueryProvider key="c">{null}</PublicQueryProvider>],
  ])('%s', (_name, tree) => {
    const q = defaultsOf(tree)
    expect(q.retry).toBe(shouldRetryQuery)
    expect(q.retryDelay).toBe(queryDefaults.retryDelay)
    expect(q.refetchOnWindowFocus).toBe(false)
    expect(q.staleTime).toBe(30_000)
  })
})
