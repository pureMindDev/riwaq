import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRecorder } from '../hooks/useRecorder.js'
import { letterPlayer } from '../lib/letterAudio.js'
import { api } from '../services/api.js'
import { letterCheckAvailable } from '../lib/engineStatus.js'
import { useLetterListen } from '../hooks/useLetterListen.js'
import { judgeLetter, syllableFor } from '../lib/letterCheck.js'
import { Icon } from './Icons.jsx'

const MAX_MS = 5000
let stopActive = null // only one letter records at a time

// Where the letter is made, from the curriculum (never invented in the browser).
export function Makhraj({ makhraj }) {
  if (!makhraj) return null
  return (
    <details className="makhraj">
      <summary>Where it is made</summary>
      <p><strong>{makhraj.area}</strong></p>
      <p>{makhraj.place}</p>
      <p className="muted small-print">A short textbook summary. Learn the sound itself from a qualified teacher.</p>
    </details>
  )
}

// Record yourself saying the letter and play it back to compare with the reference recording by ear.
// The recording stays in this browser tab (never uploaded or stored) and is NOT graded: there is no automatic
// checking of single letters in Riwaq yet, so nothing here says whether the pronunciation is right.
export default function LetterPractice({ letter }) {
  const name = letter.name
  const purpose = useRef('compare') // what the current recording is for: 'compare' (play back) or 'check' (send to the AI)
  const [aiOn, setAiOn] = useState(false)
  const [ai, setAi] = useState({ phase: 'idle' }) // idle | recording | checking | done | error
  const rec = useRecorder({
    onRecorded: (blob) => {
      if (purpose.current !== 'check') return
      purpose.current = 'compare'
      setAi({ phase: 'checking' })
      api.checkLetter(letter.id, blob).then((result) => setAi({ phase: 'done', result })).catch((err) => setAi({ phase: 'error', message: err.message }))
    },
  })
  const check = useLetterListen()
  useEffect(() => { let live = true; letterCheckAvailable().then((v) => { if (live) setAiOn(v) }); return () => { live = false } }, [])
  const snap = useSyncExternalStore(letterPlayer.subscribe, letterPlayer.getSnapshot)
  const audioRef = useRef(null)
  const [mine, setMine] = useState(false)
  const timer = useRef(null)
  const { phase, url, error, start, stop, clear } = rec

  // The reference starting silences my recording, and vice versa.
  useEffect(() => { if (snap.playing && audioRef.current) { audioRef.current.pause(); setMine(false) } }, [snap.playing])
  const stopMe = useCallback(() => { clearTimeout(timer.current); stop() }, [stop])
  useEffect(() => () => { clearTimeout(timer.current); if (stopActive === stopMe) stopActive = null }, [stopMe])

  async function begin() {
    letterPlayer.stop()
    audioRef.current?.pause(); setMine(false)
    if (stopActive && stopActive !== stopMe) stopActive()
    if (await start()) { stopActive = stopMe; timer.current = setTimeout(stopMe, MAX_MS) }
  }
  function playMine() {
    const a = audioRef.current
    if (!a) return
    if (mine) { a.pause(); a.currentTime = 0; setMine(false); return }
    letterPlayer.stop()
    a.currentTime = 0
    a.play().then(() => setMine(true)).catch(() => setMine(false))
  }

  async function beginAi() {
    letterPlayer.stop()
    audioRef.current?.pause(); setMine(false)
    if (stopActive && stopActive !== stopMe) stopActive()
    purpose.current = 'check'
    setAi({ phase: 'recording' })
    if (await start()) { stopActive = stopMe; timer.current = setTimeout(stopMe, 4000) } else { purpose.current = 'compare'; setAi({ phase: 'idle' }) }
  }
  function beginCheck() {
    letterPlayer.stop()
    audioRef.current?.pause(); setMine(false)
    if (stopActive) stopActive()
    check.listen()
  }
  const verdict = check.phase === 'done' && !check.error ? judgeLetter(letter, check.alternatives) : null

  return (
    <div className="practice">
      <p className="practice-target" dir="rtl" lang="ar"><span className="practice-say">Say:</span> <span className="ar-target">{syllableFor(letter)}</span></p>
      {aiOn ? (
        <>
          {ai.phase === 'recording' ? (
            <button type="button" className="btn btn-primary practice-btn is-listening" onClick={stopMe} aria-label={`Stop and check ${name}`}>
              <Icon name="stop" size={18} /> Listening… tap when done
            </button>
          ) : (
            <button type="button" className="btn btn-primary practice-btn" onClick={beginAi} disabled={ai.phase === 'checking'} aria-label={`Check my pronunciation of ${name}`}>
              <Icon name="mic" size={18} /> {ai.phase === 'checking' ? 'Checking…' : ai.phase === 'done' ? 'Try again' : 'Check me'} <span className="beta">AI</span>
            </button>
          )}
          <div className="check-result" role="status" aria-live="polite">
            {ai.phase === 'done' && ai.result.result === 'match' && <p className="verdict verdict-ok"><Icon name="check" size={18} /> Correct</p>}
            {ai.phase === 'done' && ai.result.result === 'fix' && (
              <div className="verdict verdict-bad verdict-col"><span><Icon name="alert" size={18} /> Right letter, but not yet right. Fix this and try again:</span>
                <ul>{ai.result.hints.map((h) => <li key={h.message}>{h.message}</li>)}</ul></div>
            )}
            {ai.phase === 'done' && ai.result.result === 'miss' && <p className="verdict verdict-bad"><Icon name="alert" size={18} /> Not yet: I heard <span dir="rtl" lang="ar">{ai.result.heard}</span> but this letter is <span dir="rtl" lang="ar">{ai.result.expected}</span>. Listen to the recording and try again.</p>}
            {ai.phase === 'done' && ai.result.result === 'none' && <p className="verdict verdict-bad"><Icon name="alert" size={18} /> I did not hear a letter. Try again, a little louder and closer to the microphone.</p>}
            {ai.phase === 'error' && <p className="verdict verdict-bad"><Icon name="alert" size={18} /> {ai.message}</p>}
            {rec.error && ai.phase !== 'recording' && <p className="verdict verdict-bad"><Icon name="alert" size={18} /> {rec.error}</p>}
          </div>
          <p className="muted small-print practice-note">AI checker (experimental): it can make mistakes, so use it as a guide and not as a final judge. Your recording is sent to Riwaq’s checker and not stored.</p>
        </>
      ) : check.supported ? (
        check.phase === 'listening' ? (
          <button type="button" className="btn btn-primary practice-btn is-listening" onClick={check.cancel} aria-label={`Stop listening for ${name}`}>
            <Icon name="stop" size={18} /> Listening… tap to cancel
          </button>
        ) : (
          <button type="button" className="btn btn-primary practice-btn" onClick={beginCheck} aria-label={`Check my pronunciation of ${name}`}>
            <Icon name="mic" size={18} /> {verdict ? 'Try again' : 'Check me'} <span className="beta">beta</span>
          </button>
        )
      ) : (
        <p className="muted small-print practice-note">Automatic checking needs speech recognition, which this browser does not have (try Chrome, Edge or Safari).</p>
      )}
      {!aiOn && <div className="check-result" role="status" aria-live="polite">
        {verdict?.result === 'match' && <p className="verdict verdict-ok"><Icon name="check" size={18} /> Correct: I heard <span dir="rtl" lang="ar">{verdict.heard}</span></p>}
        {verdict?.result === 'miss' && <p className="verdict verdict-bad"><Icon name="alert" size={18} /> Not quite: I heard <span dir="rtl" lang="ar">{verdict.heard}</span>. Listen again and try again.</p>}
        {verdict?.result === 'none' && <p className="verdict verdict-bad"><Icon name="alert" size={18} /> I did not hear a letter. Try again, a little louder and closer to the microphone.</p>}
        {check.error && <p className="verdict verdict-bad"><Icon name="alert" size={18} /> {check.error}</p>}
      </div>}
      {!aiOn && check.supported && <p className="muted small-print practice-note">Beta: this uses your browser’s speech recognition, which may send your voice to its provider and can be wrong either way. It is not a Tajweed teacher.</p>}
      {phase === 'recording' ? (
        <button type="button" className="btn btn-outline practice-btn is-recording" onClick={stopMe} aria-label={`Stop recording ${name}`}>
          <Icon name="stop" size={18} /> Stop <span className="muted">(max 5 s)</span>
        </button>
      ) : (
        <button type="button" className="btn btn-outline practice-btn" onClick={begin} aria-label={phase === 'recorded' ? `Record ${name} again` : `Record yourself saying ${name}`}>
          <Icon name="mic" size={18} /> {phase === 'recorded' ? 'Record again' : 'Record & compare'}
        </button>
      )}
      {phase === 'recorded' && url && (
        <>
          <audio ref={audioRef} src={url} onEnded={() => setMine(false)} preload="auto" />
          <button type="button" className={`btn btn-outline practice-btn${mine ? ' is-playing' : ''}`} onClick={playMine} aria-pressed={mine} aria-label={mine ? 'Stop my recording' : 'Play my recording'}>
            <Icon name={mine ? 'stop' : 'volume'} size={18} /> {mine ? 'Stop' : 'Hear mine'}
          </button>
          <button type="button" className="link-btn" onClick={() => { audioRef.current?.pause(); setMine(false); clear() }}>Delete</button>
        </>
      )}
      <p className="muted small-print practice-note" role={error ? 'alert' : undefined}>
        {error || (phase === 'recording' ? 'Recording… say the letter, then tap Stop.' : phase === 'recorded' ? 'Compare it with the recording above. This recording stays on your device.' : 'Or record yourself and compare by ear.')}
      </p>
    </div>
  )
}
