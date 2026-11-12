import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import AsyncMessage from '../components/AsyncMessage.jsx'
import SurahRange from '../components/SurahRange.jsx'
import AnalysisResult from '../components/AnalysisResult.jsx'
import MuallimFeedback from '../components/MuallimFeedback.jsx'
import ReferenceText from '../components/ReferenceText.jsx'
import Attribution from '../components/Attribution.jsx'
import { useChapters } from '../context/Chapters.jsx'
import { useAuth } from '../context/Auth.jsx'
import { api, friendlyError } from '../services/api.js'
import { useAsync } from '../hooks/useAsync.js'
import { describeSpeechError, useSpeechRecognition } from '../hooks/useSpeechRecognition.js'
import { validateRange } from '../lib/passages.js'
import { splitWords } from '../lib/recitation/normalize.js'
import { alignRecitation } from '../lib/recitation/align.js'

const MAX_UPLOAD = 10 * 1024 * 1024
const ENGINE_LABEL = {
  server: 'this site’s recognition service',
  browser: 'your browser’s built-in speech recognition (ordinary Arabic, not trained for Qur’an recitation)',
}

// Record (or upload) a recitation and compare what was recognised with the reference text.
// Nothing here is simulated: with no engine available, the page only records and plays back.
export default function Recite() {
  const ch = useChapters()
  const status = useAsync(() => api.status(), [])
  const auth = useAuth()
  const speech = useSpeechRecognition()
  const [range, setRange] = useState({ surah: '', from: '', to: '' })
  const [engine, setEngine] = useState(null) // 'server' | 'browser' | 'none'
  const [phase, setPhase] = useState('idle') // idle | recording | recorded
  const [source, setSource] = useState(null) // 'mic' | 'upload'
  const [micError, setMicError] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [blob, setBlob] = useState(null)
  const [consent, setConsent] = useState(false)
  const [analysis, setAnalysis] = useState({ status: 'idle', result: null, error: null, engine: null })
  const streamRef = useRef(null)
  const recRef = useRef(null)
  const urlRef = useRef(null)

  const signedIn = auth.status === 'authed'
  const serverAvailable = status.data?.recitation?.available === true && signedIn
  const serverConfigured = status.data?.recitation?.available === true
  const serverValidated = status.data?.recitation?.validated === true
  const chapter = ch.byId?.(Number(range.surah))
  const rangeProblem = validateRange({ surah: Number(range.surah), from: Number(range.from), to: Number(range.to) }, chapter?.versesCount)
  const rangeOk = Boolean(range.surah) && !rangeProblem && Boolean(chapter)

  const verses = useAsync(() => api.verses(Number(range.surah), Number(range.from), Number(range.to)), [range.surah, range.from, range.to], { enabled: rangeOk })
  const reference = useMemo(
    () => (verses.data?.verses || []).flatMap((v) => splitWords(v.textUthmani).map((text) => ({ text, verseKey: v.verseKey }))),
    [verses.data],
  )

  // Pick a sensible default engine once we know what is available.
  useEffect(() => {
    if (engine !== null || status.status === 'loading') return
    if (serverAvailable) setEngine('server')
    else if (speech.supported) setEngine('browser')
    else setEngine('none')
  }, [engine, status.status, serverAvailable, speech.supported])

  // Live follow-along: which reference words have been heard so far (browser engine only).
  const live = useMemo(
    () => (engine === 'browser' && phase === 'recording' && reference.length ? alignRecitation(reference, speech.heard, { conservative: true }) : null),
    [engine, phase, reference, speech.heard],
  )

  // When a browser-engine session has finished, analyse what was heard.
  useEffect(() => {
    if (engine !== 'browser' || source !== 'mic' || phase !== 'recorded' || speech.listening || analysis.status !== 'idle') return
    if (speech.error) {
      setAnalysis({ status: 'error', result: null, error: { message: describeSpeechError(speech.error) }, engine: 'browser' })
      return
    }
    setAnalysis({ status: 'success', result: alignRecitation(reference, speech.heard, { conservative: true }), error: null, engine: 'browser' })
  }, [engine, source, phase, speech.listening, speech.error, speech.heard, reference, analysis.status])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  function clear() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setAudioUrl(null)
    setBlob(null)
    setSource(null)
    setAnalysis({ status: 'idle', result: null, error: null, engine: null })
    setPhase('idle')
  }

  function setRecording(b, src) {
    const u = URL.createObjectURL(b)
    urlRef.current = u
    setBlob(b)
    setAudioUrl(u)
    setSource(src)
    setPhase('recorded')
  }

  async function start() {
    setMicError(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMicError('This browser cannot record audio. Try a recent Chrome, Edge, Firefox or Safari.')
      return
    }
    try {
      clear()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }) // asked only now, after the learner pressed Start
      streamRef.current = stream
      const rec = new MediaRecorder(stream)
      const chunks = []
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecording(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), 'mic')
      }
      recRef.current = rec
      rec.start()
      if (engine === 'browser') speech.start()
      setPhase('recording')
    } catch (err) {
      setMicError(err?.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow it in your browser settings to record.'
        : 'Could not start the microphone.')
    }
  }

  function stop() {
    if (engine === 'browser') speech.stop()
    recRef.current?.stop()
  }

  function onUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMicError(null)
    if (!file.type.startsWith('audio/')) return setMicError('Please choose an audio file.')
    if (file.size > MAX_UPLOAD) return setMicError('That file is larger than 10 MB.')
    clear()
    setRecording(file, 'upload')
  }

  async function analyse() {
    setAnalysis({ status: 'loading', result: null, error: null, engine: 'server' })
    try {
      const data = await api.analyze(blob, Number(range.surah), Number(range.from), Number(range.to))
      setAnalysis({ status: 'success', result: data.result, feedback: data.feedback, error: null, engine: 'server' })
    } catch (error) {
      setAnalysis({ status: 'error', result: null, error, engine: 'server' })
    }
  }

  const canRecord = rangeOk && engine !== null && (engine !== 'browser' || consent)
  const needsServerForUpload = engine !== 'server' && source === 'upload'

  return (
    <>
      <p><Link to="/listen">&larr; Listen &amp; Practise</Link></p>
      <PageHeader title="Recitation Check" intro="Experimental. Recite a passage and compare what was recognised with the text. It cannot judge Tajweed." />

      <section className="card stack" aria-labelledby="pick">
        <h2 id="pick">1. Choose the passage</h2>
        <SurahRange value={range} onChange={(v) => { setRange(v); clear() }} idPrefix="rec" />
        {range.surah && rangeProblem && <p className="form-error" role="status">{rangeProblem}</p>}
        {rangeOk && <AsyncMessage status={verses.status} error={verses.error} onRetry={verses.retry} loadingText="Loading the text…" />}
        {verses.status === 'success' && (
          <>
            <ReferenceText verses={verses.data.verses} liveItems={live?.items} />
            <Attribution />
          </>
        )}
      </section>

      <section className="card stack" aria-labelledby="how">
        <h2 id="how">2. How should it be checked?</h2>
        {status.status === 'error' && <AsyncMessage status="error" error={status.error} onRetry={status.retry} />}
        <fieldset className="field">
          <legend className="sr-only">Recognition method</legend>
          <label className="radio">
            <input type="radio" name="engine" disabled={!serverAvailable} checked={engine === 'server'} onChange={() => { setEngine('server'); clear() }} />
            <span><strong>Recognition service (after recording)</strong><br /><span className="muted">{serverAvailable ? 'Your recording is analysed by this site’s recognition service.' : serverConfigured ? 'Sign in to use the recognition service.' : 'Not available: no recognition service is connected to this site.'}</span></span>
          </label>
          <label className="radio">
            <input type="radio" name="engine" disabled={!speech.supported} checked={engine === 'browser'} onChange={() => { setEngine('browser'); clear() }} />
            <span><strong>Browser speech recognition (live follow-along)</strong><br /><span className="muted">{speech.supported ? 'Highlights words as you recite. Built for ordinary Arabic, so it is often wrong for Qur’an recitation.' : 'Not supported by this browser.'}</span></span>
          </label>
          <label className="radio">
            <input type="radio" name="engine" checked={engine === 'none'} onChange={() => { setEngine('none'); clear() }} />
            <span><strong>Just record and listen back</strong><br /><span className="muted">Nothing is analysed.</span></span>
          </label>
        </fieldset>
        {engine === 'browser' && (
          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            I understand my browser may send my voice to its speech service (for example Google or Microsoft) to recognise it. This app does not store it.
          </label>
        )}
      </section>

      <section className="card stack" aria-labelledby="rec">
        <h2 id="rec">3. Recite</h2>
        <div className="actions">
          {phase !== 'recording'
            ? <button type="button" className="btn btn-primary" onClick={start} disabled={!canRecord}>Start recording</button>
            : <button type="button" className="btn btn-primary" onClick={stop}>Stop recording</button>}
          {phase === 'recorded' && <button type="button" className="btn btn-link" onClick={clear}>Discard and retry</button>}
        </div>
        {!rangeOk && <p className="muted">Choose a passage first.</p>}
        {rangeOk && engine === 'browser' && !consent && <p className="muted">Tick the box above to enable live recognition.</p>}
        <p role="status" aria-live="polite">
          {phase === 'recording' ? (engine === 'browser' ? 'Listening… words you recite are highlighted. Mistake checking happens when you press Stop.' : 'Recording… recite the passage, then press Stop.') : ''}
        </p>
        {speech.error && phase === 'recording' && <p className="form-error" role="alert">{describeSpeechError(speech.error)}</p>}
        {micError && <p className="form-error" role="alert">{micError}</p>}
        {phase !== 'recording' && (
          <div className="field">
            <label htmlFor="upload">Or upload a recording (audio file, up to 10 MB)</label>
            <input id="upload" type="file" accept="audio/*" onChange={onUpload} disabled={!rangeOk} />
          </div>
        )}
        {audioUrl && (
          <div>
            <p className="muted">Your recording (kept on this device unless you send it for analysis):</p>
            <audio controls src={audioUrl} />
          </div>
        )}
        {needsServerForUpload && (
          <p className="status-note" role="note">
            {serverAvailable ? 'Choose “Recognition service” above to analyse an uploaded file.' : 'Uploaded files can only be analysed by a recognition service, and none is connected. You can still listen to the file here.'}
          </p>
        )}
      </section>

      {phase === 'recorded' && engine === 'server' && (
        <section className="card stack" aria-labelledby="an">
          <h2 id="an">4. Analyse after recording</h2>
          <p className="muted">This is checked after you finish; it is not live.</p>
          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            I understand my recording will be sent to the recognition service to be analysed. It is not stored by this app.
          </label>
          <div><button type="button" className="btn btn-primary" disabled={!consent || analysis.status === 'loading' || !rangeOk} onClick={analyse}>Analyse my recitation</button></div>
          {analysis.status === 'loading' && <p role="status">Analysing…</p>}
        </section>
      )}
      {analysis.status === 'error' && <p className="form-error" role="alert">{friendlyError(analysis.error)}</p>}
      {analysis.engine === 'server' && analysis.feedback && <section className="card"><h2>The Muallim (practice: nothing is saved)</h2><MuallimFeedback feedback={analysis.feedback} /></section>}
      {analysis.result && analysis.engine === 'browser' && (
        <AnalysisResult
          result={analysis.result}
          engineLabel={ENGINE_LABEL[analysis.engine]}
          notValidated={analysis.engine === 'browser' || !serverValidated}
        />
      )}
    </>
  )
}
