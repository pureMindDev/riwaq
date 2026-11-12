import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import AsyncMessage from '../components/AsyncMessage.jsx'
import { useAuth } from '../context/Auth.jsx'
import { useChapters } from '../context/Chapters.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { api } from '../services/api.js'

const PROGRAMMES = {
  foundation: { title: 'Foundation reading', text: 'Arabic letters, vowels, joining letters and reading fluency, step by step.' },
  tahfidh: { title: 'Tahfidh', text: 'Structured memorisation with a small daily target and revision alongside it.' },
  murajaah_only: { title: 'Muraja’ah only', text: 'For those who have memorised the Qur’an: a daily revision rotation, no repeated memorisation.' },
}

// Step 1: the initial assessment. Step 2: confirm (or change) the suggested programme.
export default function Welcome() {
  const auth = useAuth()
  const navigate = useNavigate()
  const chapters = useChapters()
  const questions = useAsync(() => api.assessmentQuestions(), [])
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [programme, setProgramme] = useState('')
  const [newVerses, setNewVerses] = useState(3)
  const [start, setStart] = useState({ surah: '', verse: '1' })
  const [direction, setDirection] = useState('descending')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // Suggest the last available Surah, working backwards: a common way to begin.
  useEffect(() => {
    if (chapters.status === 'success' && !start.surah && chapters.chapters.length) {
      setStart((s) => ({ ...s, surah: String(Math.max(...chapters.chapters.map((c) => c.id))) }))
    }
  }, [chapters.status, chapters.chapters, start.surah])

  const qs = questions.data || []
  const complete = qs.length > 0 && qs.every((q) => answers[q.id] !== undefined)

  async function submitAssessment(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const r = await api.submitAssessment(answers)
      setResult(r); setProgramme(r.programme); setNewVerses(r.suggestedNewVerses)
      await auth.refresh()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function begin() {
    setBusy(true); setError(null)
    try {
      if (programme !== result.programme) await api.setProgramme(programme)
      if (programme === 'tahfidh') {
        const body = { newVerses: Number(newVerses), direction }
        if (start.surah) body.start = { surah: Number(start.surah), verse: Number(start.verse) || 1 }
        await api.updateSettings(body)
      }
      await auth.refresh()
      navigate(programme === 'murajaah_only' ? '/tahfidh' : '/')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  if (result) {
    return (
      <>
        <PageHeader title="Where to begin" intro="A suggestion based on your answers. You can change it at any time." />
        <section className="card stack" aria-labelledby="rec">
          <h2 id="rec">Suggested: {PROGRAMMES[result.programme].title}</h2>
          <ul className="plain-list">{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <fieldset className="field">
            <legend>Your programme</legend>
            {Object.entries(PROGRAMMES).map(([key, p]) => (
              <label key={key} className="radio">
                <input type="radio" name="programme" checked={programme === key} onChange={() => setProgramme(key)} />
                <span><strong>{p.title}</strong><br /><span className="muted">{p.text}</span></span>
              </label>
            ))}
          </fieldset>
          {programme === 'tahfidh' && (
            <div className="stack">
              <div className="field narrow">
                <label htmlFor="nv">New verses to memorise each day</label>
                <input id="nv" type="number" min="1" max="20" value={newVerses} onChange={(e) => setNewVerses(e.target.value)} />
                <span className="muted small-print">A small, steady target is easier to keep. You can change it later.</span>
              </div>
              <AsyncMessage status={chapters.status} error={chapters.error} onRetry={chapters.retry} loadingText="Loading Surahs…" />
              {chapters.status === 'success' && (
                <div className="range-fields">
                  <div className="field">
                    <label htmlFor="start-surah">Begin with Surah</label>
                    <select id="start-surah" value={start.surah} onChange={(e) => setStart({ surah: e.target.value, verse: '1' })}>
                      {chapters.chapters.map((c) => <option key={c.id} value={c.id}>{c.id}. {c.nameSimple}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="start-verse">From verse</label>
                    <input id="start-verse" type="number" min="1" value={start.verse} onChange={(e) => setStart({ ...start, verse: e.target.value })} />
                  </div>
                </div>
              )}
              <fieldset className="field">
                <legend>After that, continue</legend>
                <label className="radio"><input type="radio" name="dir" checked={direction === 'descending'} onChange={() => setDirection('descending')} /> Towards the beginning (Surah numbers going down)</label>
                <label className="radio"><input type="radio" name="dir" checked={direction === 'ascending'} onChange={() => setDirection('ascending')} /> Towards the end (Surah numbers going up)</label>
              </fieldset>
            </div>
          )}
          {programme === 'murajaah_only' && <p className="muted">Next you will tell us which Ajza’ you have memorised, so they join your daily revision. This is your own declaration; it is not verified.</p>}
          <p className="form-error" role="alert">{error}</p>
          <div><button type="button" className="btn btn-primary" disabled={busy} onClick={begin}>{busy ? 'Saving…' : 'Start'}</button></div>
        </section>
      </>
    )
  }

  return (
    <>
      <PageHeader title={`Welcome, ${auth.user?.name?.split(' ')[0] || ''}`} intro="A few questions help us suggest the right starting point. There are no wrong answers." />
      <AsyncMessage status={questions.status} error={questions.error} onRetry={questions.retry} loadingText="Loading questions…" />
      {questions.status === 'success' && (
        <form className="stack" onSubmit={submitAssessment}>
          {qs.map((q) => (
            <fieldset key={q.id} className="card field">
              <legend>{q.text}</legend>
              {q.options.map((o) => (
                <label key={String(o.value)} className="radio">
                  <input type="radio" name={q.id} checked={answers[q.id] === o.value} onChange={() => setAnswers({ ...answers, [q.id]: o.value })} /> {o.label}
                </label>
              ))}
            </fieldset>
          ))}
          <p className="form-error" role="alert">{error}</p>
          <div><button type="submit" className="btn btn-primary" disabled={!complete || busy}>See my suggestion</button></div>
        </form>
      )}
    </>
  )
}
