import { Link, Navigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import AsyncMessage from '../components/AsyncMessage.jsx'
import { useAuth } from '../context/Auth.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { api } from '../services/api.js'
import { formatDate, plural } from '../lib/format.js'

const KIND = {
  foundation_lesson: { verb: 'Foundation lesson', to: (i) => `/foundation/${i.lessonId}`, action: 'Start lesson' },
  new_memorisation: { verb: 'Memorise', to: (i) => `/tahfidh/${i.passageId}`, action: 'Open' },
  revision: { verb: 'Revise', to: (i) => `/murajaah/revise/${i.passageId}`, action: 'Start' },
  milestone: { verb: 'Milestone', to: (i) => `/milestones/${i.milestoneId}`, action: 'Open' },
}

function Landing() {
  return (
    <>
      <PageHeader title="Assalamu alaikum" intro="A free digital madrasa: learn to read, memorise a little each day, and keep what you have memorised." />
      <section className="card stack">
        <h2>How it works</h2>
        <ol>
          <li><strong>Assessment.</strong> A few questions suggest where to begin.</li>
          <li><strong>Foundation.</strong> New to reading Arabic? Learn the letters, vowels and joining step by step.</li>
          <li><strong>Tahfidh.</strong> A small daily target, with revision (Muraja’ah) planned alongside it.</li>
          <li><strong>Milestones.</strong> Each completed Juz brings a revision and a cumulative check.</li>
          <li><strong>Hafiz or Hafidah?</strong> Join a Muraja’ah-only programme. No re-memorising.</li>
        </ol>
        <div className="actions">
          <Link className="btn btn-primary" to="/register">Create a free account</Link>
          <Link className="btn btn-secondary" to="/login">Sign in</Link>
          <Link className="btn btn-link" to="/listen">Listen without an account</Link>
        </div>
      </section>
    </>
  )
}

function Today() {
  const auth = useAuth()
  const plan = useAsync(() => api.plan(), [])
  const progress = useAsync(() => api.progress(), [])
  const murajaah = useAsync(() => api.murajaah(), [])
  const activity = useAsync(() => api.activity(), [])
  const p = plan.data
  const pending = p?.items.filter((i) => i.status === 'pending') || []
  const overdue = murajaah.data ? murajaah.data.due.filter((d) => d.due.kind === 'overdue').length : 0
  const pr = progress.data

  return (
    <>
      <PageHeader title={`Assalamu alaikum, ${auth.user.name.split(' ')[0]}`} intro={p ? `Today: ${formatDate(p.date)}` : undefined} />

      <section className="card" aria-labelledby="today-h">
        <h2 id="today-h">Today’s plan</h2>
        <AsyncMessage status={plan.status} error={plan.error} onRetry={plan.retry} loadingText="Preparing today’s plan…" />
        {p && (
          <>
            {p.warnings.map((w) => <p key={w} className="status-note" role="alert">{w}</p>)}
            {p.message && <p className="status-note" role="note">{p.message}</p>}
            {p.items.length > 0 && (
              <ul className="plain-list">
                {p.items.map((i) => (
                  <li key={i.id || `${i.kind}-${i.passageId || i.lessonId || i.milestoneId}`} className={`task ${i.status === 'completed' ? 'task-done' : ''}`}>
                    <div>
                      <span className="muted small-print">{KIND[i.kind].verb}</span><br />
                      <strong>{i.label}</strong>
                      {i.status === 'completed' && <span className="chip chip-memorised">Done</span>}
                    </div>
                    {i.status === 'pending' && <Link className="btn btn-primary" to={KIND[i.kind].to(i)} aria-label={`${KIND[i.kind].action}: ${i.label}`}>{KIND[i.kind].action}</Link>}
                  </li>
                ))}
              </ul>
            )}
            {p.items.length > 0 && pending.length === 0 && <p>You have finished today’s plan. Well done. Come back tomorrow, in shaa Allah.</p>}
          </>
        )}
      </section>

      <div className="grid">
        <section className="card" aria-labelledby="rev-h">
          <h2 id="rev-h">Revision{overdue > 0 && <span className="chip chip-overdue overdue-badge">{overdue} overdue</span>}</h2>
          <AsyncMessage status={murajaah.status} error={murajaah.error} onRetry={murajaah.retry} />
          {murajaah.data && (murajaah.data.all.length === 0
            ? <p className="muted">Nothing to revise yet. Passages you memorise appear here.</p>
            : <p>{plural(murajaah.data.due.length, 'passage')} due now, {plural(murajaah.data.upcoming.length, 'passage')} coming up.</p>)}
          <Link className="btn btn-secondary" to="/murajaah">Open Muraja’ah</Link>
        </section>

        <section className="card" aria-labelledby="done-h">
          <h2 id="done-h">What you have completed</h2>
          <AsyncMessage status={progress.status} error={progress.error} onRetry={progress.retry} />
          {pr && (
            <>
              <p>
                <strong>{plural(pr.memorisedVerses, 'verse')}</strong> recorded as memorised
                {pr.juzCompleted !== null && pr.juzCompleted > 0 ? ` · ${plural(pr.juzCompleted, 'Juz', 'Ajza’')} complete` : ''}.
              </p>
              <h3>Last 7 days</h3>
              <ul className="week" aria-label="Sessions completed in the last 7 days">
                {pr.week.map((d) => (
                  <li key={d.date} aria-label={`${formatDate(d.date)}: ${plural(d.count, 'session')}`}>
                    <span>{new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span>
                    <strong>{d.count}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
          {activity.data?.length > 0 && (
            <>
              <h3>Recent activity</h3>
              <ul className="plain-list small">
                {activity.data.slice(0, 4).map((a) => (
                  <li key={a.id}>{formatDate(a.date)} — {a.type === 'revise' ? 'Revised' : a.type === 'foundation' ? 'Lesson' : a.type === 'milestone' ? 'Milestone' : 'Studied'} {a.label}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  )
}

export default function Home() {
  const auth = useAuth()
  if (auth.status === 'loading') return <p className="muted" role="status">Loading…</p>
  if (auth.status === 'authed' && !auth.student.onboarded) return <Navigate to="/welcome" replace />
  return auth.status === 'authed' ? <Today /> : <Landing />
}
