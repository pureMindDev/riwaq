import { Link } from 'react-router-dom'

// Shown when there is genuinely no data yet. We never show fake numbers.
export default function EmptyState({ message, actionLabel, actionTo }) {
  return (
    <div className="empty">
      <p>{message}</p>
      {actionLabel && (
        <Link className="btn btn-secondary" to={actionTo}>{actionLabel}</Link>
      )}
    </div>
  )
}
