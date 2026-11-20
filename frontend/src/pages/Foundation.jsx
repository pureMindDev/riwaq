import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import AsyncMessage from '../components/AsyncMessage.jsx'
import PassageViewer from '../components/PassageViewer.jsx'
import MuallimRecitation from '../components/MuallimRecitation.jsx'
import { useChapters } from '../context/Chapters.jsx'
import { useAuth } from '../context/Auth.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { api } from '../services/api.js'
import { Icon } from '../components/Icons.jsx'
import LetterAudioButton, { LetterGlyph, AudioCredit } from '../components/LetterAudioButton.jsx'
import LetterPractice, { Makhraj } from '../components/LetterPractice.jsx'
import { ListenQuestion, SayQuestion } from '../components/QuizVoice.jsx'
import { attemptsLabel, bestScore, scoreLabel } from '../lib/lessonStats.js'
import { showJoin, formKeys } from '../lib/join.js'

const Ar = ({ children, big }) => <span className={big ? 'arabic-big' : 'arabic'} lang="ar" dir="rtl" translate="no">{children}</span>

function LessonCard({ l }) {
  const state = l.completed ? 'complete' : l.unlocked ? 'ready' : 'locked'
  const stat = l.hasQuiz ? scoreLabel(l) : 'Read aloud to the Muallim'
  return (
    <li className={`lesson-card is-${state}`}>
      <div className="lc-top">
        <span className="lc-num">Lesson {l.order}</span>
        <span className={`lc-state lc-state-${state}`}>
          <Icon name={state === 'complete' ? 'check' : state === 'locked' ? 'lock' : 'book'} size={16} />
          {state === 'complete' ? 'Complete' : state === 'locked' ? 'Locked' : 'Ready'}
        </span>
      </div>
      <p className="lc-preview" lang="ar" dir="rtl" translate="no" aria-hidden="true">{l.preview || '\u00A0'}</p>
      <h3 className="lc-title">{l.title}</h3>
      <p className="lc-stat muted">{stat}</p>
      <div className="lc-foot">
        <span className="muted small-print">{l.hasQuiz ? attemptsLabel(l) : ''}</span>
        {l.unlocked
          ? <Link className={`btn lc-action ${l.completed ? 'btn-secondary' : 'btn-primary'}`} to={`/foundation/${l.id}`} aria-label={`${l.completed ? 'Review' : 'Open'} lesson ${l.order}: ${l.title}`}>{l.completed ? 'Review' : 'Open'}</Link>
          : <span className="muted small-print">Finish the earlier lessons first</span>}
      </div>
    </li>
  )
}

// Shares only the counts (no name, no account details): the native share sheet on phones, otherwise the clipboard.
function ShareProgress({ done, total }) {
  const [note, setNote] = useState('')
  async function share() {
    const text = `I have completed ${done} of ${total} Foundation reading lessons on Riwaq.`
    try {
      if (navigator.share) { await navigator.share({ text }); setNote('') }
      else { await navigator.clipboard.writeText(text); setNote('Copied. You can paste it anywhere.') }
    } catch (err) {
      if (err?.name !== 'AbortError') setNote(`Could not share automatically. You can copy this: ${text}`)
    }
  }
  return (
    <div className="share">
      <button type="button" className="btn btn-primary share-btn" onClick={share}><Icon name="share" size={18} /> Share progress</button>
      {note && <p className="muted small-print" role="status">{note}</p>}
    </div>
  )
}

// The lessons as a grid of cards (also shown inside the Tahfidh page for foundation students).
export function LessonList() {
  const lessons = useAsync(() => api.lessons(), [])
  const list = lessons.data
  const done = list?.filter((l) => l.completed).length || 0
  return (
    <>
      <AsyncMessage status={lessons.status} error={lessons.error} onRetry={lessons.retry} loadingText="Loading lessons…" />
      {list && (
        <>
          <Summary done={done} total={list.length} />
          <ol className="lesson-grid">{list.map((l) => <LessonCard key={l.id} l={l} />)}</ol>
        </>
      )}
    </>
  )
}

function Summary({ done, total }) {
  return (
    <div className="lessons-summary">
      <p className="lessons-count"><strong>{done}</strong> of {total} lessons completed</p>
      <progress max={total} value={done} aria-label={`${done} of ${total} lessons complete`} />
    </div>
  )
}

// One letter. Score and attempts are the saved quiz results of the lesson that teaches it (not per letter).
// The card is not a link itself (it holds a play button); the name's link is stretched over it.
function LetterCard({ letter, lesson }) {
  const state = lesson.completed ? 'complete' : lesson.unlocked ? 'ready' : 'locked'
  const best = bestScore(lesson)
  const title = lesson.unlocked
    ? <Link className="ltr-link" to={`/foundation/${lesson.id}`} aria-label={`${letter.name}: open lesson ${lesson.order}, ${lesson.title}`}>{letter.name}</Link>
    : letter.name
  return (
    <li>
      <div className={`letter-tile is-${state}`}>
        <div className="ltr-top">
          <h3 className="ltr-name">{title}</h3>
          <span className="ltr-icons">
            <LetterAudioButton id={letter.id} name={letter.name} />
            {state !== 'ready' && <span className={`ltr-state ltr-${state}`}><Icon name={state === 'complete' ? 'check' : 'lock'} size={16} /><span className="sr-only">{state === 'complete' ? 'Lesson complete' : 'Locked'}</span></span>}
          </span>
        </div>
        <Ar big>{letter.char}</Ar>
        <p className="ltr-sound">{letter.sound ? `Transliteration: ${letter.sound}` : 'Long vowel “ā”'}</p>
        <p className="ltr-note">{letter.joins ? 'Joins the next letter' : 'Does not join the next letter'}</p>
        <div className="ltr-foot"><span>Score: {best ? `${best.percent}%` : 'not tried'}</span><span>{attemptsLabel(lesson)}</span></div>
      </div>
    </li>
  )
}

function LetterSection({ lesson }) {
  const state = lesson.completed ? 'complete' : lesson.unlocked ? 'ready' : 'locked'
  return (
    <section className="letter-section" aria-labelledby={`h-${lesson.id}`}>
      <div className="ls-head">
        <h2 id={`h-${lesson.id}`}>Lesson {lesson.order}: {lesson.title.replace(/^Letters \d: /, '')}</h2>
        <span className={`lc-state lc-state-${state}`}>{state === 'complete' ? 'Complete' : state === 'locked' ? 'Locked' : 'Ready'}</span>
        {lesson.unlocked
          ? <Link className={`btn lc-action ${lesson.completed ? 'btn-secondary' : 'btn-primary'}`} to={`/foundation/${lesson.id}`}>{lesson.completed ? 'Review' : 'Open lesson'}</Link>
          : <span className="muted small-print">Finish the earlier lessons first</span>}
      </div>
      <ul className="letter-tiles">{lesson.letters.map((l) => <LetterCard key={l.id} letter={l} lesson={lesson} />)}</ul>
    </section>
  )
}

// The Foundation reading page: letters as cards, then the other lessons, all with real saved scores and attempts.
export function FoundationHub() {
  const lessons = useAsync(() => api.lessons(), [])
  const list = lessons.data
  const done = list?.filter((l) => l.completed).length || 0
  const letterLessons = list?.filter((l) => l.letters) || []
  const others = list?.filter((l) => !l.letters) || []
  return (
    <>
      <div className="hub-head">
        <Link className="btn btn-outline" to="/"><Icon name="arrowLeft" size={18} /> Home</Link>
        <div className="hub-title"><span className="hub-icon" aria-hidden="true"><Icon name="book" size={24} /></span><h1>Foundation reading</h1></div>
        {list && <ShareProgress done={done} total={list.length} />}
      </div>
      <p className="lead">Learn to read Arabic step by step. Finish the lessons in order; each one unlocks the next.</p>
      <AsyncMessage status={lessons.status} error={lessons.error} onRetry={lessons.retry} loadingText="Loading lessons…" />
      {list && (
        <>
          <Summary done={done} total={list.length} />
          {letterLessons.map((l) => <LetterSection key={l.id} lesson={l} />)}
          {others.length > 0 && (
            <section className="letter-section" aria-labelledby="h-skills">
              <div className="ls-head"><h2 id="h-skills">Reading skills</h2></div>
              <ol className="lesson-grid">{others.map((l) => <LessonCard key={l.id} l={l} />)}</ol>
            </section>
          )}
        </>
      )}
    </>
  )
}

// The shapes of a letter, one cell each: the Arabic character above its label.
// Six letters (ا د ذ ر ز و) never connect to the NEXT letter, so they have only two shapes: alone, and joined to
// the previous letter. Showing four cells for them would repeat the same shapes under wrong names.
const FORM_NAMES = { isolated: 'Alone', initial: 'Start', medial: 'Middle', final: 'End' }
function Forms({ forms, joins = true }) {
  return (
    <>
      <ul className="forms" aria-label="Letter shapes">
        {formKeys(joins).map((key) => (
          <li key={key} className="form-cell">
            <span className="form-glyph" lang="ar" dir="rtl" translate="no">{showJoin(forms[key])}</span>
            <span className="form-label">{FORM_NAMES[key]}</span>
          </li>
        ))}
      </ul>
      {!joins && <p className="muted small-print form-note">Never connects to the next letter, so it has only two shapes.</p>}
    </>
  )
}

function Content({ lesson, onPassed }) {
  const chapters = useChapters()
  const c = lesson.content
  switch (lesson.type) {
    case 'letters':
      return (
        <>
        <div className="letter-grid">
          {c.letters.map((l) => (
            <div key={l.id} className="card letter-card">
              <div className="lc-letter-top"><span className="lc-letter-name">{l.name}</span><LetterAudioButton id={l.id} name={l.name} /></div>
              <LetterGlyph id={l.id} name={l.name}><Ar big>{l.char}</Ar></LetterGlyph>
              <Makhraj makhraj={l.makhraj} />
              <LetterPractice letter={l} />
              <Forms forms={l.forms} joins={l.joins} />
            </div>
          ))}
        </div>
        <AudioCredit />
        </>
      )
    case 'vowels':
      return (
        <div className="stack">
          <ul className="plain-list">{c.marks.map((m) => <li key={m.name}><Ar big>{m.mark}</Ar> <strong>{m.name}</strong> — sounds like “{m.sound}”</li>)}</ul>
          {c.examples.map((e) => (
            <div key={e.letter} className="card"><h3>With <Ar>{e.letter}</Ar></h3>
              <ul className="syllables">{e.syllables.map((s) => <li key={s.text}><Ar big>{s.text}</Ar><span>{s.sound}</span></li>)}</ul></div>
          ))}
        </div>
      )
    case 'marks':
      return <ul className="plain-list">{c.marks.map((m) => <li key={m.name} className="card"><Ar big>{m.example}</Ar> <strong>{m.name}</strong><br /><span className="muted">{m.meaning}</span></li>)}</ul>
    case 'madd':
      return (<div className="stack"><ul className="syllables">{c.examples.map((e) => <li key={e.text}><Ar big>{e.text}</Ar><span>{e.sound}</span></li>)}</ul><p className="muted">{c.note}</p></div>)
    case 'joining':
      return (
        <div className="stack">
          <p>{c.note}</p>
          <h3>Letters that do not connect to the next letter</h3>
          <ul className="syllables">{c.nonJoiners.map((l) => <li key={l.char}><Ar big>{l.char}</Ar><span>{l.name}</span></li>)}</ul>
          <h3>Examples of changing shape</h3>
          {c.examples.map((e) => <div key={e.char} className="card"><strong>{e.name}</strong><Forms forms={e.forms} /></div>)}
        </div>
      )
    case 'info':
      return (
        <div className="stack">
          <ul className="plain-list">{c.areas.map((a) => <li key={a.name} className="card"><strong>{a.name}</strong><br /><Ar big>{a.letters}</Ar><br /><span className="muted">{a.note}</span></li>)}</ul>
          <p className="status-note" role="note">{c.note}</p>
        </div>
      )
    case 'drill':
      return (
        <div className="stack">
          <p>{c.note}</p>
          {c.rows.map((row, i) => <p key={i} className="drill-row" lang="ar" dir="rtl" translate="no">{row.map((s) => <span key={s}>{s}</span>)}</p>)}
        </div>
      )
    case 'readalong':
      return (
        <div className="stack">
          <p>{c.note}</p>
          <PassageViewer surah={c.passage.surah} from={c.passage.from} to={Math.min(c.passage.to, chapters.byId?.(c.passage.surah)?.versesCount ?? c.passage.to)} />
          <MuallimRecitation
            title="Read it aloud to the Muallim"
            hint="Read the whole passage aloud. The Muallim points out every wrong word, letter or vowel. This lesson is complete only when you read it correctly."
            submit={(blob) => api.submitLessonRecitation(lesson.id, blob)}
            onResult={(r) => r.passed && onPassed()}
          />
        </div>
      )
    default:
      return null
  }
}

function Quiz({ lesson, onPassed, onSubmitted }) {
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const qs = lesson.quiz.questions

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const r = await api.submitQuiz(lesson.id, answers)
      setResult(r)
      onSubmitted?.()
      if (r.passed) onPassed()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <form className="stack" onSubmit={submit} aria-labelledby="quiz-h">
      <h2 id="quiz-h">Quiz</h2>
      <p className="muted">Answer at least {Math.round(lesson.quiz.passRatio * 100)}% correctly to complete this lesson. You can retry as often as you like.{qs.some((q) => q.kind === 'say') && ' Some questions ask you to listen, and some ask you to say a letter aloud to the AI checker; each counts toward your score.'}</p>
      {qs.map((q) => (
        <fieldset key={q.id} className={`card field ${result?.wrong.includes(q.id) ? 'q-wrong' : ''}`}>
          <legend>{q.prompt}</legend>
          {q.display && <Ar big>{q.display}</Ar>}
          {q.kind === 'listen' ? (
            <ListenQuestion q={q} value={answers[q.id]} onChange={(c) => setAnswers({ ...answers, [q.id]: c })} />
          ) : q.kind === 'say' ? (
            <SayQuestion q={q} proof={answers[q.id]} onProof={(p) => setAnswers((a) => ({ ...a, [q.id]: p }))} />
          ) : (
            <div className="choices">
              {q.choices.map((c) => (
                <label key={c} className="radio"><input type="radio" name={q.id} checked={answers[q.id] === c} onChange={() => setAnswers({ ...answers, [q.id]: c })} /> {c}</label>
              ))}
            </div>
          )}
          {result?.wrong.includes(q.id) && <p className="form-error">{q.kind === 'say' ? 'Not counted yet. Say it again until you get a green “Correct”, then check your answers again.' : 'Not quite. Look at this one again.'}</p>}
        </fieldset>
      ))}
      <p className="form-error" role="alert">{error}</p>
      {result && <p className={result.passed ? 'form-ok' : 'form-error'} role="status">{result.passed ? `Well done: ${result.score} of ${result.total} correct.` : `${result.score} of ${result.total} correct. Review the lesson and try again.`}</p>}
      <div><button type="submit" className="btn btn-primary" disabled={busy || qs.some((q) => q.kind !== 'say' && !answers[q.id])}>Check my answers</button></div>
    </form>
  )
}

export function Lesson() {
  const { id } = useParams()
  const navigate = useNavigate()
  const auth = useAuth()
  const lesson = useAsync(() => api.lesson(id), [id])
  const stats = useAsync(() => api.lessons(), [id]) // saved score and attempts: the same record the overview shows
  const record = stats.data?.find((x) => x.id === id)
  const [passedNow, setPassedNow] = useState(false)
  const [finished, setFinished] = useState(null)
  const [error, setError] = useState(null)
  const l = lesson.data
  const passed = passedNow || Boolean(l?.readalongPassed) || Boolean(l?.quizPassed)
  const setPassed = () => setPassedNow(true)

  async function complete() {
    setError(null)
    try {
      setFinished(await api.completeLesson(id))
      await auth.refresh()
    } catch (err) { setError(err.message) }
  }
  async function moveOn() {
    await api.setProgramme('tahfidh')
    await auth.refresh()
    navigate('/settings#programme')
  }

  return (
    <>
      <p><Link className="back-link" to="/foundation">&larr; Foundation lessons</Link></p>
      {lesson.status !== 'success' && <AsyncMessage status={lesson.status} error={lesson.error} onRetry={lesson.retry} loadingText="Loading lesson…" />}
      {l && (
        <>
          <PageHeader title={`${l.order}. ${l.title}`} />
          <p className="lesson-meta">
            {l.completed && <span className="chip chip-memorised">Complete</span>}
            {l.quiz && record && <span className="muted" data-testid="lesson-stats">{scoreLabel(record)} · {attemptsLabel(record)}</span>}
          </p>
          <Content lesson={l} onPassed={() => setPassed(true)} />
          <section className="stack lesson-footer">
            {l.quiz && <Quiz lesson={l} onPassed={() => setPassed(true)} onSubmitted={stats.retry} />}
            {!finished && !l.completed && (
              <div>
                <button type="button" className="btn btn-primary" onClick={complete} disabled={!passed}>Complete lesson</button>
                {!passed && <p className="muted">{l.type === 'readalong' ? 'Read the passage correctly to the Muallim first.' : 'Pass the quiz first.'}</p>}
              </div>
            )}
            <p className="form-error" role="alert">{error}</p>
            {finished && (
              <div className="status-note" role="status">
                <p><strong>Lesson complete.</strong></p>
                {finished.allDone ? (
                  <>
                    <p>You have finished the foundation lessons. When you feel ready, begin Tahfidh.</p>
                    <button type="button" className="btn btn-primary" onClick={moveOn}>Move on to Tahfidh</button>
                  </>
                ) : <Link className="btn btn-primary" to="/foundation">Back to the lessons</Link>}
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}
