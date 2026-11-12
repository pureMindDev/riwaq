import { useCallback, useEffect, useState } from 'react'

// Runs an async function and tracks loading / error / success.
// Call `retry()` to run it again.
export function useAsync(fn, deps, { enabled = true } = {}) {
  const [state, setState] = useState({ status: enabled ? 'loading' : 'idle', data: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    setState((s) => ({ status: 'loading', data: s.data, error: null }))
    fn().then(
      (data) => !cancelled && setState({ status: 'success', data, error: null }),
      (error) => !cancelled && setState({ status: 'error', data: null, error }),
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt, enabled])

  const retry = useCallback(() => setAttempt((a) => a + 1), [])
  return { ...state, retry }
}
