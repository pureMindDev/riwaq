import { useCallback, useEffect, useRef, useState } from 'react'
import { speechSupported, describeSpeechError } from './useSpeechRecognition.js'

const getCtor = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null)

// One short listen with the browser's speech recogniser, returning every alternative it offers.
// The browser may send the audio to its speech service (Chrome/Edge: Google/Microsoft; Safari: Apple).
export function useLetterListen() {
  const [state, setState] = useState({ phase: 'idle', alternatives: [], error: null }) // idle | listening | done
  const recRef = useRef(null)
  const timer = useRef(null)
  const alts = useRef([])
  const errRef = useRef(null)

  const finish = useCallback((error = null) => {
    clearTimeout(timer.current)
    setState({ phase: 'done', alternatives: alts.current, error })
  }, [])

  const listen = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) return false
    alts.current = []
    errRef.current = null
    const rec = new Ctor()
    rec.lang = 'ar-SA'
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 5
    rec.onresult = (e) => {
      for (const r of Array.from(e.results)) for (const a of Array.from(r)) alts.current.push(a.transcript)
    }
    // Browsers fire `end` after `error`, so the error is remembered and reported when the session ends.
    rec.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'aborted') errRef.current = describeSpeechError(e.error) }
    rec.onend = () => { if (recRef.current === rec) { recRef.current = null; finish(errRef.current) } }
    recRef.current = rec
    try { rec.start() } catch { recRef.current = null; setState({ phase: 'done', alternatives: [], error: describeSpeechError('unknown') }); return false }
    setState({ phase: 'listening', alternatives: [], error: null })
    timer.current = setTimeout(() => { try { rec.stop() } catch { /* ended */ } }, 6000)
    return true
  }, [finish])

  const cancel = useCallback(() => {
    clearTimeout(timer.current)
    const rec = recRef.current
    recRef.current = null
    try { rec?.abort() } catch { /* ignore */ }
    setState({ phase: 'idle', alternatives: [], error: null })
  }, [])

  useEffect(() => () => { clearTimeout(timer.current); const r = recRef.current; recRef.current = null; try { r?.abort() } catch { /* ignore */ } }, [])
  return { supported: speechSupported(), ...state, listen, cancel }
}
