import { useState } from 'react'
import MuallimFeedback from './MuallimFeedback.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { useRecorder } from '../hooks/useRecorder.js'
import { api, friendlyError } from '../services/api.js'

// Recite to the Muallim. `submit(blob)` sends the recording and must resolve to
// { id, passed, verdict, headline, corrections, ... }. Nothing is saved except the outcome.
export default function MuallimRecitation({ submit, onResult, title = 'Recite to the Muallim', hint }) {
  const status = useAsync(() => api.status(), [])
  const rec = useRecorder()
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState({ status: 'idle' })
  const available = status.data?.recitation?.available === true
  // An engine is connected but nobody has yet checked it against qualified teachers' marking.
  const unvalidated = available && status.data?.recitation?.validated !== true

  async function send() {
    setState({ status: 'loading' })
    try {
      const data = await submit(rec.blob)
      setState({ status: 'success', data })
      onResult?.(data)
    } catch (error) {
      setState({ status: 'error', error })
    }
  }
  function again() { rec.clear(); setState({ status: 'idle' }) }

  return (
    <section className="card stack" aria-labelledby="mr-h">
      <h2 id="mr-h">{title}</h2>
      {hint && <p className="muted">{hint}</p>}
      {status.status === 'success' && !available && (
        <p className="status-note" role="alert">
          <strong>The Muallim is not available yet.</strong> No recognition service is connected to this site, so this step cannot be passed. The site owner needs to connect one.
        </p>
      )}
      {unvalidated && (
        <p className="status-note" role="note" data-testid="engine-unvalidated">
          <strong>Experimental.</strong> The recognition service has not yet been checked against qualified teachers. It listens to words and letters only (it does not judge Tajweed), and it can be wrong. Treat its corrections as a practice aid, not a ruling, and check anything doubtful with a teacher.
        </p>
      )}
      {available && state.status !== 'success' && (
        <>
          <div className="actions">
            {rec.phase !== 'recording'
              ? <button type="button" className="btn btn-secondary" onClick={rec.start}>Start reciting</button>
              : <button type="button" className="btn btn-primary" onClick={rec.stop}>Stop</button>}
            {rec.phase === 'recorded' && <button type="button" className="btn btn-link" onClick={again}>Discard</button>}
          </div>
          {rec.phase === 'recording' && <p role="status">Listening… recite, then press Stop.</p>}
          {rec.error && <p className="form-error" role="alert">{rec.error}</p>}
          {rec.url && <audio controls src={rec.url} />}
          {rec.phase === 'recorded' && (
            <>
              <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I understand my recording is sent to the recognition service so the Muallim can listen. The audio is not stored.</label>
              <div><button type="button" className="btn btn-primary" disabled={!consent || state.status === 'loading'} onClick={send}>Recite to the Muallim</button></div>
            </>
          )}
          {state.status === 'loading' && <p role="status">The Muallim is listening…</p>}
          {state.status === 'error' && <p className="form-error" role="alert">{friendlyError(state.error)}</p>}
        </>
      )}
      {state.status === 'success' && (
        <>
          <MuallimFeedback feedback={state.data} />
          {!state.data.passed && <div><button type="button" className="btn btn-primary" onClick={again}>Recite again</button></div>}
        </>
      )}
    </section>
  )
}
