import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from '../services/api.js'

// Who is signed in, and their student profile (programme, targets).
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: getToken() ? 'loading' : 'anon', user: null, student: null })

  const load = useCallback(async () => {
    try {
      const [user, profile] = await Promise.all([api.me(), api.student()])
      setState({ status: 'authed', user, student: profile.student })
    } catch (err) {
      if (err.status === 401) { setToken(null); setState({ status: 'anon', user: null, student: null }) }
      else setState((s) => ({ ...s, status: 'error', error: err }))
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => { setToken(null); setState({ status: 'anon', user: null, student: null }) })
    if (getToken()) load()
  }, [load])

  const value = useMemo(() => ({
    ...state,
    async register(body) {
      const r = await api.register({ ...body, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      setToken(r.token)
      await load()
    },
    async login(body) {
      const r = await api.login(body)
      setToken(r.token)
      await load()
    },
    async logout() {
      try { await api.logout() } catch { /* the token may already be invalid */ }
      setToken(null)
      setState({ status: 'anon', user: null, student: null })
    },
    async deleteAccount() {
      await api.deleteAccount()
      setToken(null)
      setState({ status: 'anon', user: null, student: null })
    },
    refresh: load,
    retry: load,
  }), [state, load])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
