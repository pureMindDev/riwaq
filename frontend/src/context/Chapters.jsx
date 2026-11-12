import { createContext, useContext, useMemo } from 'react'
import { api } from '../services/api.js'
import { useAsync } from '../hooks/useAsync.js'

// Loads the Surah list once per visit (kept in memory only, never stored).
const ChaptersContext = createContext(null)

export function ChaptersProvider({ children }) {
  const q = useAsync(() => api.chapters(), [])
  const value = useMemo(
    () => ({
      status: q.status,
      error: q.error,
      retry: q.retry,
      chapters: q.data || [],
      byId: (id) => (q.data || []).find((c) => c.id === id),
      totalVerses: q.data ? q.data.reduce((sum, c) => sum + c.versesCount, 0) : null,
    }),
    [q.status, q.error, q.retry, q.data],
  )
  return <ChaptersContext.Provider value={value}>{children}</ChaptersContext.Provider>
}

export function useChapters() {
  return useContext(ChaptersContext)
}
