import { useCallback, useEffect, useRef, useState } from 'react'
import { useRecorder } from '../hooks/useRecorder.js'
import { api } from '../services/api.js'
import { letterPlayer, loadLetterAudio } from '../lib/letterAudio.js'
import { activeRecorder } from '../lib/activeRecorder.js'
import { useLetterAudio } from './LetterAudioButton.jsx'
import AiVerdict from './AiVerdict.jsx'
import { Icon } from './Icons.jsx'

const MAX_MS = 4000

// "Listen, then pick the letter you heard." The recording is the question: the letter is never printed.
export function ListenQuestion({ q, value, onChange }) {
  const { url, playing, failed } = useLetterAudio(q.letterId)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { let live = true; loadLetterAudio().then(() => { if (live) setLoaded(true) }); return () => { live = false } }, [])
  const ok = Boolean(url) && !failed
  return (
    <>
      {ok ? (
        <button type="button" className={`btn btn-primary listen-btn${playing ? ' is-playing' : ''}`} onClick={() => letterPlayer.toggle(q.letterId, url)} aria-pressed={playing}>
          <Icon name={playing ? 'stop' : 'volume'} size={20} /> {playing ? 'Stop' : 'Play the letter'}
        </button>
      ) : loaded ? <p className="form-error" role="alert">The recording for this question is not available right now. Try again later.</p> : null}
      <div className="choices choices-ar" role="radiogroup" aria-label="Which letter did you hear?">
        {q.choices.map((c) => (
          <label key={c} className="radio"><input type="radio" name={q.id} checked={value === c} onChange={() => onChange(c)} /> <span className="arabic" lang="ar" dir="rtl" translate="no">{c}</span></label>
        ))}
      </div>
    </>
  )
}

// "Say this letter." The AI checker listens; only a green "Correct" gives the receipt the server needs to count it.
export function SayQuestion({ q, proof, onProof }) {
  const [ai, setAi] = useState({ phase: 'idle' })
  const timer = useRef(null)
  const live = useRef(true)
  const rec = useRecorder({
    onRecorded: (blob) => {
      setAi({ phase: 'checking' })
      api.checkLetter(q.letterId, blob).then((result) => {
        if (!live.current) return
        setAi({ phase: 'done', result })
        if (result.result === 'match' && result.proof) onProof(result.proof)
      }).catch((err) => { if (live.current) setAi({ phase: 'error', message: err.message }) })
    },
  })
  const { start, stop } = rec
  const stopMe = useCallback(() => { clearTimeout(timer.current); stop() }, [stop])
  useEffect(() => {
    live.current = true // set again on every mount: React's dev double-mount runs the cleanup once before the real mount
    return () => { live.current = false; clearTimeout(timer.current); activeRecorder.release(stopMe) }
  }, [stopMe])

  async function begin() {
    letterPlayer.stop()
    activeRecorder.stopOthers(stopMe)
    setAi({ phase: 'recording' })
    if (await start()) { activeRecorder.set(stopMe); timer.current = setTimeout(stopMe, MAX_MS) } else setAi({ phase: 'idle' })
  }

  const got = Boolean(proof)
  return (
    <div className="practice">
      {ai.phase === 'recording' ? (
        <button type="button" className="btn btn-primary practice-btn is-listening" onClick={stopMe} aria-label="Stop and check">
          <Icon name="stop" size={18} /> Listening… tap when done
        </button>
      ) : (
        <button type="button" className="btn btn-primary practice-btn" onClick={begin} disabled={ai.phase === 'checking'} aria-label={`Say this letter aloud`}>
          <Icon name="mic" size={18} /> {ai.phase === 'checking' ? 'Checking…' : got || ai.phase === 'done' ? 'Try again' : 'Say it'} <span className="beta">AI</span>
        </button>
      )}
      <AiVerdict ai={ai} recError={rec.error} />
      {got && ai.phase !== 'done' && <p className="verdict verdict-ok"><Icon name="check" size={18} /> Correct</p>}
      <p className="muted small-print practice-note">Get a green “Correct” for this one to earn the point. You can try as many times as you like. The AI checker is experimental and can make mistakes. Your recording is not stored.</p>
    </div>
  )
}
