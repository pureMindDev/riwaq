import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/Auth.jsx'
import AsyncMessage from './AsyncMessage.jsx'

// Wraps pages that need an account. New students are sent to the initial assessment first.
export default function RequireAuth({ children, allowUnassessed = false }) {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading') return <p className="muted" role="status">Loading…</p>
  if (auth.status === 'error') return <AsyncMessage status="error" error={auth.error} onRetry={auth.retry} />
  if (auth.status === 'anon') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (!auth.student.onboarded && !allowUnassessed) return <Navigate to="/welcome" replace />
  return children
}
