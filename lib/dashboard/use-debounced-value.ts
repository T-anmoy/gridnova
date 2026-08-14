import { useEffect, useState } from 'react'

// Returns a debounced copy of `value` that only updates after `delay` ms of no
// changes. Used to keep text-search inputs responsive while deferring the
// (potentially request-triggering) filtering work until the user pauses typing.
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}
