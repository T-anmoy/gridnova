import { backoffDelay, isRetryableError } from '@/lib/dashboard/api-error'

/**
 * The one retry policy for every TanStack QueryClient in the app (staff
 * dashboard, associate portals, public pages): transient failures only —
 * network errors, 429 and 5xx — at most MAX_QUERY_RETRIES times with
 * exponential backoff. Auth, permission, validation and other 4xx errors are
 * never retried; they will not fix themselves.
 *
 * Mutations are not retried at all (they are not idempotent by default).
 * A query with a stricter need (e.g. the territory lookups, which must not
 * retry a 503 "not seeded" answer) overrides `retry` on that one query.
 */
export const MAX_QUERY_RETRIES = 3

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return isRetryableError(error) && failureCount < MAX_QUERY_RETRIES
}

export const queryDefaults = {
  staleTime: 30_000,
  // Off globally; work queues and the activity feed opt back in.
  refetchOnWindowFocus: false,
  retry: shouldRetryQuery,
  retryDelay: backoffDelay,
} as const
