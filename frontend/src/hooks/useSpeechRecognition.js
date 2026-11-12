import { useCallback, useEffect, useRef, useState } from 'react'

// Wraps the browser's built-in speech recognition (Chrome, Edge, Safari).
// It recognises ORDINARY Arabic and is not trained for Qur'an recitation, so treat results with caution.
// The browser may send the audio to its vendor's servers.
const getCtor = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null)
const FATAL = ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported', 'network']

export const speechSupported = () => Boolean(getCtor())

export function describeSpeechError(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Speech recognition was blocked. Allow the microphone and speech service in your browser settings.'
    case 'network':
      return 'Speech recognition needs an internet connection to your browser’s speech service.'
    case 'audio-capture':
      return 'No microphone was found.'
    case 'language-not-supported':
      return 'This browser does not support Arabic speech recognition.'
    default:
      return 'Speech recognition stopped unexpectedly.'
  }
}

export function useSpeechRecognition({ lang = 'ar-SA' } = {}) {
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState([]) // [{ text, confidence? }]
  const [error, setError] = useState(null)
  const recRef = useRef(null)
  const wantRef = useRef(false)
  const finals = useRef([])
  const interim = useRef([])

  const publish = () => setHeard([...finals.current, ...interim.current])

  const start = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) return false
    finals.current = []
    interim.current = []
    setHeard([])
    setError(null)
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      interim.current = []
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        const alt = r[0]
        // Confidence is per phrase, and only meaningful once a phrase is final.
        const confidence = r.isFinal && alt.confidence > 0 ? alt.confidence : undefined
        const words = alt.transcript.split(/\s+/).filter(Boolean).map((text) => ({ text, confidence }))
        if (r.isFinal) finals.current.push(...words)
        else interim.current.push(...words)
      }
      publish()
    }
    rec.onerror = (e) => {
      if (FATAL.includes(e.error)) {
        wantRef.current = false
        setError(e.error)
      }
    }
    rec.onend = () => {
      if (wantRef.current) {
        try {
          rec.start() // browsers end sessions after silence; keep listening until the learner stops
          return
        } catch { /* fall through */ }
      }
      wantRef.current = false
      setListening(false)
    }
    recRef.current = rec
    wantRef.current = true
    try {
      rec.start()
    } catch {
      wantRef.current = false
      setError('unknown')
      return false
    }
    setListening(true)
    return true
  }, [lang])

  const stop = useCallback(() => {
    wantRef.current = false
    try { recRef.current?.stop() } catch { /* already stopped */ }
  }, [])

  useEffect(() => () => {
    wantRef.current = false
    try { recRef.current?.abort() } catch { /* ignore */ }
  }, [])

  return { supported: speechSupported(), listening, heard, error, start, stop }
}
