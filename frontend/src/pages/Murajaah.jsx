import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import AsyncMessage from '../components/AsyncMessage.jsx'
import AddPassageForm from '../components/AddPassageForm.jsx'
import PassageViewer from '../components/PassageViewer.jsx'
import MuallimRecitation from '../components/MuallimRecitation.jsx'
import { PassageChips } from '../components/PassageBits.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { api } from '../services/api.js'
import { formatDate, plural } from '../lib/format.js'

const STALE_DAYS = 14
const RATING_LABEL = { easy: 'Easy', moderate: 'Moderate', difficult: 'Difficult' }

function MemorisedRow({ p, onChange }) {
  const [error, setError] = useState(null)
  const last = p.schedule.lastRevised
  const act = async (fn) => { setError(null); try { await fn(); onChange() } catch (err) { setError(err.message) } }
  const stale = p.daysSinceRevised === null || p.daysSinceRevised >= STALE_DAYS
  return (
    <li className="card passage">
      <div className="passage-head">
        <h3>{p.label}</h3>
        <div className="chips">
          <PassageChips passage={p} />
          {stale && <span className="chip chip-stale">{p.daysSinceRevised === null ? 'Not revised yet' : `Not revised for ${p.daysSinceRevised} days`}</span>}
        </div>
      </div>
      <p className="muted">Last revised: {last ? formatDate(last) : 'never'} · Suggested next: {formatDate(p.schedule.dueDate)}</p>
      <div className="field inline-field">
        <label htmlFor={`due-${p.id}`}>Next revision date</label>
        <input id={`due-${p.id}`} type="date" value={p.schedule.dueDate} onChange={(e) => e.target.value && act(() => api.setDueDate(p.id, e.target.value))} />
      </div>
      <div className="actions">
        <Link className="btn btn-secondary" to={`/murajaah/revise/${p.id}`}>Revise now</Link>
        {p.status === 'memorised' && <button type="button" className="btn btn-link" onClick={() => act(() => api.setPassageStatus(p.id, 'needs_review'))}>Mark as needing more practice</button>}
        <button type="button" className="btn btn-link" onClick={() => act(() => api.setPassageStatus(p.id, 'learning'))}>Move back to learning</button>
      </div>
      <p className="form-error" role="alert">{error}</p>
    </li>
  )
}

function Overview() {
  const location = useLocation()
  const ov = useAsync(() => api.murajaah(), [])
  const history = useAsync(() => api.history(), [])
  const milestones = useAsync(() => api.milestones(), [])
  const refresh = useCallback(() => { ov.retry(); history.retry(); milestones.retry() }, [ov, history, milestones])
  const banner = location.state?.done
  const d = ov.data

  return (
    <>
      <PageHeader title="Muraja’ah" intro="Revision keeps what you have memorised. Revise a little, often." />
      {banner && <p className="status-note" role="status">Session completed: {banner.label}. Suggested next revision: {formatDate(banner.next)}.</p>}

      <section className="card" aria-labelledby="today">
        <h2 id="today">Today’s revision</h2>
        <AsyncMessage status={ov.status} error={ov.error} onRetry={ov.retry} loadingText="Loading…" />
        {d && (d.all.length === 0
          ? <p className="muted">You have no passages to revise yet. Add one you already know below, or memorise a passage in Tahfidh.</p>
          : d.due.length === 0
            ? <p>Nothing is due today.</p>
            : (
              <ul className="plain-list">
                {d.due.map((p) => (
                  <li key={p.id} className="task">
                    <div><strong>{p.label}</strong><PassageChips passage={p} /></div>
                    <Link className="btn btn-primary" to={`/murajaah/revise/${p.id}`} aria-label={`Start revising ${p.label}`}>Start</Link>
                  </li>
                ))}
              </ul>
            ))}
      </section>

      <section className="card" aria-labelledby="ms">
        <h2 id="ms">Juz milestones</h2>
        <AsyncMessage status={milestones.status} error={milestones.error} onRetry={milestones.retry} />
        {milestones.data && (milestones.data.length === 0
          ? <p className="muted">When you complete a whole Juz in Tahfidh, a milestone appears here with a revision of that Juz and a cumulative check across everything you have completed.</p>
          : (
            <ul className="plain-list">
              {milestones.data.map((m) => (
                <li key={m.id} className="task">
                  <div><strong>Juz {m.juz}</strong> <span className={`chip ${m.status === 'completed' ? 'chip-memorised' : 'chip-due'}`}>{m.status === 'completed' ? 'Complete' : 'To do'}</span>
                    <div className="muted small-print">Revised {m.progress.revised}/{m.progress.revisionTotal} · Cumulative check {m.progress.assessed}/{m.progress.assessmentTotal}</div></div>
                  <Link className="btn btn-secondary" to={`/milestones/${m.id}`} aria-label={`Open Juz ${m.juz} milestone`}>Open</Link>
                </li>
              ))}
            </ul>
          ))}
      </section>

      <section className="card" aria-labelledby="add-known">
        <h2 id="add-known">Add a passage you already know</h2>
        <p className="muted">You can revise old portions even when you are not memorising anything new.</p>
        <AddPassageForm fixedStatus="memorised" submitLabel="Add to revision" onAdded={refresh} />
      </section>

      <section aria-labelledby="all">
        <h2 id="all">Your memorised passages</h2>
        {d && (d.all.length === 0 ? <p className="muted">None yet.</p> : (
          <ul className="plain-list">
            {[...d.all].sort((a, b) => (a.schedule.lastRevised || '').localeCompare(b.schedule.lastRevised || '')).map((p) => <MemorisedRow key={p.id} p={p} onChange={refresh} />)}
          </ul>
        ))}
        <p className="muted">The dates are suggestions to help you plan. They cannot guarantee you will remember, so change them whenever you like.</p>
      </section>

      <section aria-labelledby="hist">
        <h2 id="hist">Revision history</h2>
        {history.data && (history.data.length === 0 ? <p className="muted">Completed sessions will appear here.</p> : (
          <ul className="plain-list">
            {history.data.map((h) => (
              <li key={h.id}>{formatDate(h.date)} — {h.label}{h.rating && <> <span className={`chip chip-${h.rating}`}>{RATING_LABEL[h.rating]}</span></>}</li>
            ))}
          </ul>
        ))}
      </section>
    </>
  )
}

function Revise({ id }) {
  const navigate = useNavigate()
  const passage = useAsync(() => api.passage(id), [id])
  const status = useAsync(() => api.status(), [])
  const [sub, setSub] = useState(null)
  const [rating, setRating] = useState('')
  const [error, setError] = useState(null)
  const p = passage.data
  const devMode = status.data?.muallim?.strict === false // development switch only

  if (passage.status !== 'success') return <><p><Link to="/murajaah">&larr; Muraja’ah</Link></p><AsyncMessage status={passage.status} error={passage.error} onRetry={passage.retry} /></>
  if (!p.schedule) return <><PageHeader title="Not memorised yet" /><p>Only memorised passages can be revised. <Link to={`/tahfidh/${p.id}`}>Open it in Tahfidh</Link>.</p></>

  async function finish(input) {
    setError(null)
    try {
      const done = await api.completeRevision(id, input)
      navigate('/murajaah', { state: { done: { label: p.label, next: done.schedule.dueDate } } })
    } catch (err) { setError(err.message) }
  }
  const outcome = sub && sub.verdict !== 'unclear'
    ? (sub.passed ? 'You recited it correctly. This counts as an easy revision.' : `The Muallim found ${sub.corrections.length} ${sub.corrections.length === 1 ? 'thing' : 'things'} to correct. This revision will come back sooner.`)
    : null
  return (
    <>
      <p><Link to="/murajaah">&larr; Muraja’ah</Link></p>
      <PageHeader title={p.label} intro="Listen if you need to, then recite the passage from memory to the Muallim." />
      <PassageViewer surah={p.surah} from={p.from} to={p.to} allowHideText />
      <MuallimRecitation
        submit={(blob) => api.submitRecitation(id, blob)}
        onResult={setSub}
        hint="Hide the text and recite the whole passage from memory. How it goes decides how soon it comes back for revision."
      />
      {outcome && (
        <section className="card stack">
          <p>{outcome}</p>
          <p className="form-error" role="alert">{error}</p>
          <div><button type="button" className="btn btn-primary" onClick={() => finish({ submissionId: sub.id })}>Finish this revision</button></div>
        </section>
      )}
      {devMode && (
        <details className="card"><summary>Development mode: finish without the Muallim</summary>
          <fieldset className="field">
            <legend>Self-rating</legend>
            {Object.entries(RATING_LABEL).map(([value, label]) => (
              <label key={value} className="radio"><input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} /> {label}</label>
            ))}
          </fieldset>
          <button type="button" className="btn btn-secondary" disabled={!rating} onClick={() => finish({ rating })}>Complete (dev)</button>
        </details>
      )}
    </>
  )
}

export default function Murajaah() {
  const { id } = useParams()
  return id ? <Revise id={id} /> : <Overview />
}
