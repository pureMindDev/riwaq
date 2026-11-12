import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import AsyncMessage from '../components/AsyncMessage.jsx'
import AddPassageForm from '../components/AddPassageForm.jsx'
import DeclareJuz from '../components/DeclareJuz.jsx'
import PassageViewer from '../components/PassageViewer.jsx'
import MuallimRecitation from '../components/MuallimRecitation.jsx'
import { PassageChips } from '../components/PassageBits.jsx'
import { LessonList } from './Foundation.jsx'
import { useAuth } from '../context/Auth.jsx'
import { useChapters } from '../context/Chapters.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { api } from '../services/api.js'
import { formatDate, plural } from '../lib/format.js'

const STATUS_OPTIONS = {
  learning: [['learning', 'Learning']],
  memorised: [['memorised', 'Memorised'], ['needs_review', 'Needs more practice'], ['learning', 'Back to learning']],
  needs_review: [['needs_review', 'Needs more practice'], ['memorised', 'Memorised'], ['learning', 'Back to learning']],
}

function PassageCard({ p, onChange }) {
  const [error, setError] = useState(null)
  async function setStatus(status) {
    setError(null)
    try { await api.setPassageStatus(p.id, status); onChange() } catch (err) { setError(err.message) }
  }
  async function remove() {
    if (!window.confirm(`Remove ${p.label} from your record? Your history is kept.`)) return
    try { await api.removePassage(p.id); onChange() } catch (err) { setError(err.message) }
  }
  return (
    <li className="card passage">
      <div className="passage-head"><h3>{p.label}</h3><PassageChips passage={p} /></div>
      <p className="muted">{plural(p.verses, 'verse')}{p.memorisedAt ? ` · memorised ${formatDate(p.memorisedAt.slice(0, 10))}` : ''}{p.source === 'assigned' ? ' · assigned to you' : ''}</p>
      <div className="field inline-field">
        <label htmlFor={`status-${p.id}`}>Status</label>
        <select id={`status-${p.id}`} value={p.status} onChange={(e) => setStatus(e.target.value)} disabled={STATUS_OPTIONS[p.status].length === 1}>
          {STATUS_OPTIONS[p.status].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="actions">
        <Link className="btn btn-primary" to={`/tahfidh/${p.id}`}>{p.status === 'learning' ? (p.lastVerse ? `Continue from verse ${p.lastVerse}` : 'Start learning') : 'Open'}</Link>
        {p.status !== 'learning' && <Link className="btn btn-secondary" to={`/murajaah/revise/${p.id}`}>Revise</Link>}
        <button type="button" className="btn btn-link" onClick={remove}>Remove</button>
      </div>
      <p className="form-error" role="alert">{error}</p>
    </li>
  )
}

function Coverage({ rows }) {
  const ch = useChapters()
  if (!rows.length) return null
  return (
    <section className="card" aria-labelledby="cover">
      <h2 id="cover">Surahs you have covered</h2>
      <ul className="plain-list">
        {rows.map((r) => {
          const total = ch.byId(r.surah)?.versesCount
          const name = r.surahName || `Surah ${r.surah}`
          return (
            <li key={r.surah}>
              <div className="cover-row"><strong>{name}</strong>
                <span className="muted">{plural(r.memorisedVerses, 'verse')} memorised{r.learningVerses ? `, ${plural(r.learningVerses, 'verse')} learning` : ''}{total ? ` of ${total}` : ''}</span></div>
              {total && <progress max={total} value={r.memorisedVerses} aria-label={`${name}: ${r.memorisedVerses} of ${total} verses memorised`} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Overview() {
  const auth = useAuth()
  const programme = auth.student.programme
  const passages = useAsync(() => api.passages(), [])
  const progress = useAsync(() => api.progress(), [])
  const refresh = useCallback(() => { passages.retry(); progress.retry() }, [passages, progress])

  if (programme === 'foundation') {
    return (
      <>
        <PageHeader title="Foundation reading" intro="Learn to read Arabic step by step. Finish the lessons in order, then begin Tahfidh." />
        <section className="card"><LessonList /></section>
        <p className="muted">Already read well? You can change your programme in <Link to="/settings#programme">Settings</Link>.</p>
      </>
    )
  }
  const pr = progress.data
  return (
    <>
      <PageHeader title="Tahfidh" intro={programme === 'murajaah_only' ? 'Record what you have memorised so it joins your daily revision.' : 'Your assigned passage appears on Home each day. You can also add passages yourself.'} />
      <section className="card" aria-labelledby="summary">
        <h2 id="summary">Your memorisation</h2>
        <AsyncMessage status={progress.status} error={progress.error} onRetry={progress.retry} />
        {pr && (pr.memorisedVerses === 0 && pr.learningPassages === 0
          ? <p className="muted">Nothing recorded yet.</p>
          : <p><strong>{plural(pr.memorisedVerses, 'verse')}</strong> recorded as memorised{pr.juzCompleted ? ` · ${plural(pr.juzCompleted, 'Juz', 'Ajza’')} complete` : ''}. {pr.learningPassages > 0 ? `${plural(pr.learningPassages, 'passage')} in progress.` : ''}</p>)}
        <p className="muted">This is your own record. It has not been checked by a teacher.</p>
      </section>
      {pr && <Coverage rows={pr.bySurah} />}

      <section className="card" aria-labelledby="declare">
        <h2 id="declare">Already memorised whole Ajza’?</h2>
        <DeclareJuz onDone={refresh} />
      </section>

      {programme === 'tahfidh' && (
        <section className="card" aria-labelledby="add">
          <h2 id="add">Add a passage</h2>
          <AddPassageForm onAdded={refresh} />
        </section>
      )}

      <section aria-labelledby="mine">
        <h2 id="mine">Your passages</h2>
        <AsyncMessage status={passages.status} error={passages.error} onRetry={passages.retry} loadingText="Loading your passages…" />
        {passages.data && (passages.data.length === 0
          ? <div className="empty"><p>No passages yet.</p></div>
          : <ul className="plain-list">{passages.data.map((p) => <PassageCard key={p.id} p={p} onChange={refresh} />)}</ul>)}
      </section>
    </>
  )
}

function Learn({ id }) {
  const navigate = useNavigate()
  const passage = useAsync(() => api.passage(id), [id])
  const recs = useAsync(() => api.passageRecitations(id), [id])
  const status = useAsync(() => api.status(), [])
  const [passedNow, setPassedNow] = useState(false)
  const [devSelf, setDevSelf] = useState(false)
  const [error, setError] = useState(null)
  const [note, setNote] = useState(null)
  const remember = useCallback((verse) => { api.setPosition(id, verse).catch(() => {}) }, [id])
  const p = passage.data
  const hasPassed = passedNow || recs.data?.some((r) => r.passed)
  const devMode = status.data?.muallim?.strict === false // development switch only

  if (passage.status !== 'success') {
    return <><p><Link to="/tahfidh">&larr; Tahfidh</Link></p><AsyncMessage status={passage.status} error={passage.error} onRetry={passage.retry} /></>
  }
  async function memorise() {
    setError(null)
    try { await api.markMemorised(id, !hasPassed && devSelf); navigate('/') } catch (err) { setError(err.message) }
  }
  async function studied() {
    try { await api.logSession(id); setNote('Session recorded.') } catch (err) { setError(err.message) }
  }
  return (
    <>
      <p><Link to="/tahfidh">&larr; Tahfidh</Link></p>
      <PageHeader title={p.label} intro={p.lastVerse && p.status === 'learning' ? `You stopped at verse ${p.lastVerse}. Picking up from there.` : 'Listen, repeat, then recite from memory to the Muallim.'} />
      <PassageChips passage={p} />
      <ol className="card steps">
        <li><strong>Listen</strong> to a verse a few times (use Repeat in the player options).</li>
        <li><strong>Repeat it aloud</strong> while reading the text.</li>
        <li><strong>Hide the text</strong> and recite it from memory.</li>
        <li>When you are ready, <strong>recite the whole passage to the Muallim</strong> below.</li>
      </ol>
      <PassageViewer surah={p.surah} from={p.from} to={p.to} startVerse={p.lastVerse || undefined} onVerseChange={remember} allowHideText />

      <div className="actions page-actions">
        <button type="button" className="btn btn-secondary" onClick={studied}>Log a study session</button>
        {p.status !== 'learning' && <Link className="btn btn-primary" to={`/murajaah/revise/${p.id}`}>Revise this passage</Link>}
      </div>
      {note && <p className="form-ok" role="status">{note}</p>}

      {p.status === 'learning' && (
        <>
          <MuallimRecitation
            submit={(blob) => api.submitRecitation(id, blob)}
            onResult={(r) => { recs.retry(); if (r.passed) setPassedNow(true) }}
            hint="Recite the WHOLE passage from memory. The Muallim points out every wrong word, letter or vowel. The passage counts as memorised only when you recite it correctly."
          />
          <section className="card stack" aria-labelledby="mm-h">
            <h2 id="mm-h">Memorised</h2>
            {hasPassed
              ? <p><strong>The Muallim passed your recitation.</strong> You can now mark this passage as memorised.</p>
              : <p className="muted">This unlocks when the Muallim passes your recitation of the whole passage.</p>}
            {devMode && !hasPassed && (
              <label className="check"><input type="checkbox" checked={devSelf} onChange={(e) => setDevSelf(e.target.checked)} /> (Development mode only) mark it memorised without the Muallim.</label>
            )}
            <p className="form-error" role="alert">{error}</p>
            <div><button type="button" className="btn btn-primary" disabled={!hasPassed && !(devMode && devSelf)} onClick={memorise}>Mark as memorised</button></div>
          </section>
        </>
      )}
    </>
  )
}

export default function Tahfidh() {
  const { id } = useParams()
  return id ? <Learn id={id} /> : <Overview />
}
