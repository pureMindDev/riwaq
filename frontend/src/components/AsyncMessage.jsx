import { friendlyError } from '../services/api.js'

// Standard loading / error display with a Retry button.
export default function AsyncMessage({ status, error, onRetry, loadingText = 'Loading…' }) {
  if (status === 'loading') {
    return <p className="muted" role="status">{loadingText}</p>
  }
  if (status === 'error') {
    return (
      <div className="error-box" role="alert">
        <p>{friendlyError(error)}</p>
        {onRetry && <button type="button" className="btn btn-secondary" onClick={onRetry}>Try again</button>}
      </div>
    )
  }
  return null
}
