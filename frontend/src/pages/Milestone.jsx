import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import AsyncMessage from '../components/AsyncMessage.jsx'
import MuallimRecitation from '../components/MuallimRecitation.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { api } from '../services/api.js'

// A completed Juz: revise every passage of it, then rate one sample from each completed Juz.
export default function Milestone() {
  const { id } = useParams()
  const ms = useAsync(() => api.milestone(id), [id])
  const [error, setError] = useState(null)
  const m = ms.data

  async function check(itemId, sub) {
    setError(null)
    if (sub.verdict === 'unclear') return
    try { await api.rateMilestoneItem(id, itemId, { submissionId: sub.id }); ms.retry() } catch (err) { setError(err.message) }
  }
  // Keep showing the page while it refreshes: replacing it with "Loading" would wipe the Muallim's feedback.
  if (!m) return <><p><Link to="/murajaah">&larr; Muraja’ah</Link></p><AsyncMessage status={ms.status} error={ms.error} onRetry={ms.retry} /></>
  return (
    <>
      <p><Link to="/murajaah">&larr; Muraja’ah</Link></p>
      <PageHeader title={`Juz ${m.juz} milestone`} intro="You have completed a whole Juz. Revise it, then check yourself across everything you have completed." />
      {m.status === 'completed' && <p className="status-note" role="status"><strong>Milestone complete.</strong> Congratulations. Keep revising regularly.</p>}

      <section className="card" aria-labelledby="rv">
        <h2 id="rv">1. Revise this Juz ({m.progress.revised}/{m.progress.revisionTotal})</h2>
        <ul className="plain-list">
          {m.targets.map((t) => (
            <li key={t.passageId} className="task">
              <div><strong>{t.label}</strong> {t.revisedSince && <span className="chip chip-memorised">Revised</span>}</div>
              {!t.revisedSince && <Link className="btn btn-primary" to={`/murajaah/revise/${t.passageId}`} aria-label={`Revise ${t.label}`}>Revise</Link>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="cum">
        <h2 id="cum">2. Cumulative check ({m.progress.assessed}/{m.progress.assessmentTotal})</h2>
        <p className="muted">One passage from each Juz you have completed, chosen because it was revised least recently. Recite each from memory to the Muallim. An item is passed only when you recite it correctly.</p>
        <ul className="plain-list">
          {m.assessmentItems.map((i) => (
            <li key={i.id}>
              {i.done
                ? <div className="card"><strong>Juz {i.juz}:</strong> {i.label} <span className="chip chip-memorised">Passed</span></div>
                : (
                  <MuallimRecitation
                    title={`Juz ${i.juz}: ${i.label}`}
                    submit={(blob) => api.submitRecitation(i.passageId, blob)}
                    onResult={(sub) => check(i.id, sub)}
                  />
                )}
            </li>
          ))}
        </ul>
        <p className="form-error" role="alert">{error}</p>
      </section>
    </>
  )
}
